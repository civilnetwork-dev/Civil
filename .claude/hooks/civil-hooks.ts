/**
 * Claude Code hooks for this repo, wired in .claude/settings.json. One script,
 * routed by hook event and tool:
 *
 * - PreToolUse, Bash/PowerShell: deny commands that kill every Bun process or
 *   rename a migration folder; ask before commands that discard local work.
 * - PreToolUse, Edit/Write: deny hand edits to generated files.
 * - PostToolUse, Edit/Write: format the file with oxfmt, remind that
 *   misc/config bundles need a rebuild, check the four env var lists agree.
 * - PostToolUse, Bash/PowerShell: check dependency pins after bun installs.
 *
 * It fails open: any error inside the hook exits 0 with no output, so a broken
 * hook never blocks a session. `bun .claude/hooks/civil-hooks.ts --self-test`
 * checks the command and path rules.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

interface HookInput {
    hook_event_name?: string;
    tool_name?: string;
    tool_input?: {
        command?: string;
        file_path?: string;
        notebook_path?: string;
    };
}

const ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

// taskkill /IM bun.exe once took down other sessions' dev servers along with
// the one meant; stopping by port owner only hits the right process.
const KILLS_EVERY_BUN = [
    /\btaskkill\b[^\n|;&]*\bbun(\.exe)?\b/i,
    /\bStop-Process\b[^\n|;&]*-(Process)?Name\s+['"]?bun\b/i,
    /\bGet-Process\s+(-Name\s+)?['"]?bun\b[^\n]*\|\s*Stop-Process/i,
    /\b(pkill|killall)\b[^\n|;&]*\bbun\b/i,
];

// The migrator records applied migrations by folder name.
const RENAMES_MIGRATION =
    /\b(git\s+mv|mv|Move-Item|Rename-Item|ren|move)\b[^\n|;&]*misc[\\/]+database[\\/]+migrations[\\/]+/i;

// The working tree usually holds a lot of uncommitted work.
const DISCARDS_WORK =
    /\bgit\s+(reset\s+--hard|clean\s+-\w*f|stash\s+(drop|clear)|checkout\s+(--\s+)?\.(?=\s|$|;|&)|restore\s+(--worktree\s+)?\.(?=\s|$|;|&))/i;

const GENERATED: [RegExp, string][] = [
    [
        /^src\/routeTree\.gen\.ts$/,
        "The router plugin generates it from src/routes/: change the route files.",
    ],
    [
        /^dist(-config)?\//,
        "Build output: edit the sources, then bun run build or bun run build:configs.",
    ],
    [
        /^bun\.lock$/,
        "Change package.json and run bun install; never hand-edit the lockfile.",
    ],
    [
        /^misc\/database\/migrations\/[^/]+\/snapshot\.json$/,
        "drizzle-kit writes snapshots: change misc/database/schema.ts and run bun run db:generate.",
    ],
    [
        /^\.blocks\/(INDEX\.md|blocks\.lock)$/,
        "caveman-blocks sync and verify write this file.",
    ],
    [
        /(^|\/)zig-(pkg|out)\//,
        "zig build fetches and builds this: change build.zig.zon or the sources.",
    ],
];

const ENV_FILES = new Set([
    "misc/env.ts",
    ".env.example",
    "docker-compose.yml",
    "tests/setup.ts",
]);
const FORMATTED = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
const INSTALLS =
    /\bbun\s+(install|i|add|a|update|remove|rm|patch\s+--commit)\b/;

/** Repo-relative path with forward slashes, or null when outside the repo. */
function repoPath(file: string | undefined): string | null {
    if (!file) return null;
    const rel = relative(ROOT, resolve(ROOT, file)).replaceAll("\\", "/");
    return rel.startsWith("../") || rel === ".." || isAbsolute(rel)
        ? null
        : rel;
}

function shellVerdict(command: string): ["deny" | "ask", string] | null {
    if (KILLS_EVERY_BUN.some(rule => rule.test(command)))
        return [
            "deny",
            "This kills every Bun process, including other sessions' servers. Find the server's process with `caveman-blocks run port-owner --port <port>`, then `Stop-Process -Id <pid>`.",
        ];
    if (RENAMES_MIGRATION.test(command))
        return [
            "deny",
            "Never rename a migration folder: the migrator records applied migrations by folder name (AGENTS.md).",
        ];
    if (DISCARDS_WORK.test(command))
        return [
            "ask",
            "This discards local changes, and this tree usually holds uncommitted work. Confirm with the owner first.",
        ];
    return null;
}

function generatedReason(rel: string): string | null {
    return GENERATED.find(([rule]) => rule.test(rel))?.[1] ?? null;
}

/** caveman-blocks binary: env override, the `hooks install` path, else PATH. */
function blocksBinary(): string | null {
    const installed = join(
        homedir(),
        ".local/share/caveman-blocks/bin/caveman-blocks",
    );
    for (const candidate of [
        process.env.CAVEMAN_BLOCKS_BIN,
        installed,
        `${installed}.exe`,
    ])
        if (candidate && existsSync(candidate)) return candidate;
    const probe = spawnSync("caveman-blocks", ["version"], { stdio: "ignore" });
    return probe.status === 0 ? "caveman-blocks" : null;
}

/** Run a block and return its JSON answer, or null when it cannot run. */
function runBlock(name: string): Record<string, unknown> | null {
    const bin = blocksBinary();
    if (!bin) return null;
    const result = spawnSync(bin, ["run", name], {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 30_000,
    });
    const line = (result.stdout ?? "")
        .trim()
        .split("\n")
        .findLast(text => text.startsWith("{"));
    return line ? JSON.parse(line) : null;
}

function emit(output: object): void {
    process.stdout.write(JSON.stringify(output));
}

function preToolUse(input: HookInput): void {
    const command = input.tool_input?.command;
    if (command !== undefined) {
        const verdict = shellVerdict(command);
        if (verdict)
            emit({
                hookSpecificOutput: {
                    hookEventName: "PreToolUse",
                    permissionDecision: verdict[0],
                    permissionDecisionReason: verdict[1],
                },
            });
        return;
    }
    const rel = repoPath(
        input.tool_input?.file_path ?? input.tool_input?.notebook_path,
    );
    const reason = rel && generatedReason(rel);
    if (reason)
        emit({
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason: `${rel} is generated. ${reason}`,
            },
        });
}

function afterEdit(rel: string): void {
    if (FORMATTED.test(rel))
        // oxfmt skips files its ignorePatterns exclude. --no-install: a clone
        // without node_modules must not download a formatter on every edit.
        spawnSync(
            process.execPath,
            ["x", "--no-install", "oxfmt", "-c", "oxfmt.config.ts", rel],
            { cwd: ROOT, stdio: "ignore", timeout: 30_000 },
        );
    if (ENV_FILES.has(rel)) {
        const answer = runBlock("env-sync");
        if (answer && answer.ok === false)
            return emit({
                decision: "block",
                reason: `Required env vars no longer agree across misc/env.ts, .env.example, docker-compose.yml and tests/setup.ts: ${JSON.stringify(answer.missing)}. Add them where missing.`,
            });
    }
    if (rel.startsWith("misc/config/"))
        emit({
            hookSpecificOutput: {
                hookEventName: "PostToolUse",
                additionalContext:
                    "misc/config/ bundles are not rebuilt by the Vite dev server: run `bun run build:configs` before checking the change in a browser.",
            },
        });
}

function afterInstall(command: string): void {
    if (!INSTALLS.test(command)) return;
    const answer = runBlock("dep-pins");
    if (answer && answer.ok === false)
        emit({
            decision: "block",
            reason: `Dependency pins broke: ${JSON.stringify(answer.problems)}. Follow the civil-deps-upgrade skill.`,
        });
}

function postToolUse(input: HookInput): void {
    const command = input.tool_input?.command;
    if (command !== undefined) return afterInstall(command);
    const rel = repoPath(input.tool_input?.file_path);
    if (rel) afterEdit(rel);
}

function selfTest(): void {
    const cases: [string, string | undefined][] = [
        ["taskkill /F /IM bun.exe", "deny"],
        ["Stop-Process -Name bun -Force", "deny"],
        ["Get-Process bun | Stop-Process", "deny"],
        ["pkill -f bun", "deny"],
        ["Stop-Process -Id 4242", undefined],
        [
            "git mv misc/database/migrations/a misc/database/migrations/b",
            "deny",
        ],
        ["git reset --hard", "ask"],
        ["git checkout -- .", "ask"],
        ["git restore .", "ask"],
        ["git stash drop stash@{0}", "ask"],
        ["git restore --staged package.json", undefined],
        ["git checkout -b feat/x", undefined],
        ["bun run test", undefined],
    ];
    for (const [command, want] of cases) {
        const got = shellVerdict(command)?.[0];
        if (got !== want)
            throw new Error(`${command}: want ${want}, got ${got}`);
    }
    const paths: [string, boolean][] = [
        ["src/routeTree.gen.ts", true],
        ["dist/client/index.html", true],
        ["bun.lock", true],
        ["misc/database/migrations/20260610194037_x/snapshot.json", true],
        ["misc/database/migrations/20260610194037_x/migration.sql", false],
        ["misc/obfuscatti/zig-pkg/yuku/src/a.zig", true],
        ["src/routes/index.tsx", false],
    ];
    for (const [path, want] of paths)
        if ((generatedReason(path) !== null) !== want)
            throw new Error(`${path}: want generated=${want}`);
    if (repoPath(join(ROOT, "src", "a.ts")) !== "src/a.ts")
        throw new Error("repoPath inside the repo");
    if (repoPath(resolve(ROOT, "..", "elsewhere.ts")) !== null)
        throw new Error("repoPath outside the repo");
    if (!INSTALLS.test("bun add -d --exact x") || INSTALLS.test("bun run test"))
        throw new Error("install detection");
    console.log("civil-hooks self-test passed");
}

async function main(): Promise<void> {
    if (process.argv.includes("--self-test")) return selfTest();
    const input: HookInput = JSON.parse(await Bun.stdin.text());
    if (input.hook_event_name === "PreToolUse") preToolUse(input);
    else if (input.hook_event_name === "PostToolUse") postToolUse(input);
}

// Top-level await: with a floating promise Bun exits before stdin is read.
try {
    await main();
} catch (error) {
    if (process.argv.includes("--self-test")) {
        console.error(error);
        process.exit(1);
    }
    // Fail open: a broken hook must never block the session.
    process.exit(0);
}
