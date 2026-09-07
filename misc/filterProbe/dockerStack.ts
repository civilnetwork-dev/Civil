/**
 * Brings up Civil's own `docker-compose.yml` stack (postgres + redis + app)
 * under Podman, for the live harness to tunnel instead of a bare `bun
 * run.ts`.
 *
 * Orchestration itself goes through `podman compose` — Podman's own, proven
 * compose provider (confirmed on this machine: it delegates to a real
 * Compose v2 binary, transparently bridged to the Podman socket) — not
 * reimplemented on top of `dockerode`'s raw container API. `dockerode` has no
 * notion of a compose file at all; it talks to individual containers, images,
 * networks and volumes one at a time. Hand-rolling `depends_on` +
 * `condition: service_healthy` ordering, build contexts, `.env`
 * interpolation and inter-service DNS on top of that would be reimplementing
 * what `podman compose` already does correctly. `dockerode`'s actual job here
 * is what it's built for: reading the resulting containers' real state
 * (health, logs) from the same engine, not orchestrating them.
 *
 * ## No privilege elevation
 *
 * Podman is rootless by design — that is the whole point of it next to
 * Docker's daemon model — and every port `docker-compose.yml` maps (5432,
 * 6379, the app's own `${PORT:-9876}`, 4983) is unprivileged. Nothing here
 * needs, or attempts, elevated privileges on any OS. If a real permissions
 * error ever surfaces, it is reported as what it is rather than silently
 * retried with `sudo`/`runas` — a script re-invoking itself elevated is a
 * meaningfully different, riskier action than running normally, not
 * something to reach for reflexively just because a platform check fires.
 */

import { spawn } from "node:child_process";
import { platform } from "node:os";
import { join } from "node:path";

import Dockerode from "dockerode";

const CIVIL_DIR = join(import.meta.dirname, "..", "..");
const COMPOSE_FILE = "docker-compose.yml";
const APP_SERVICE = "app";

/**
 * Where Podman's own API socket is, per OS — the same one `podman`/`podman
 * compose` itself already connects through. Confirmed on this machine via
 * `podman machine inspect podman-machine-default`
 * (`ConnectionInfo.PodmanPipe.Path`); the rootless-socket path on Linux/macOS
 * is Podman's own documented default, matching what `podman info --format
 * '{{.Host.RemoteSocket.Path}}'` reports inside the machine.
 */
function podmanSocketPath(): string {
    if (platform() === "win32") return "//./pipe/podman-machine-default";
    const runtimeDir =
        process.env.XDG_RUNTIME_DIR ??
        `/run/user/${process.getuid?.() ?? 1000}`;
    return `${runtimeDir}/podman/podman.sock`;
}

function dockerodeClient(): Dockerode {
    return new Dockerode({ socketPath: podmanSocketPath() });
}

/** Runs `podman compose <args>`, streaming output live — a build can take
 *  minutes on a cold cache, and inherited stdio is what makes that visible
 *  rather than silent. */
function runCompose(
    args: string[],
    env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(
            "podman",
            ["compose", "-f", COMPOSE_FILE, ...args],
            { cwd: CIVIL_DIR, env, stdio: "inherit" },
        );
        child.on("error", reject);
        child.on("exit", code =>
            code === 0
                ? resolve()
                : reject(
                      new Error(
                          `podman compose ${args.join(" ")} exited with code ${code}`,
                      ),
                  ),
        );
    });
}

/** The `app` service's container, found by the label Compose v2 puts on
 *  every container it creates — not a guessed or constructed name, which
 *  Compose is free to suffix/hash however its project-naming rules want. */
async function findAppContainer(
    client: Dockerode,
): Promise<Dockerode.Container | undefined> {
    const containers = await client.listContainers({
        all: true,
        filters: JSON.stringify({
            label: [`com.docker.compose.service=${APP_SERVICE}`],
        }),
    });
    const info = containers[0];
    return info ? client.getContainer(info.Id) : undefined;
}

/** Polls the `app` container's own healthcheck (docker-compose.yml already
 *  defines one — GET /health, same endpoint the bare `run.ts` path polls
 *  directly) via `dockerode` rather than a second, redundant HTTP loop. */
async function waitForHealthy(
    client: Dockerode,
    timeoutMs = 180_000,
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const container = await findAppContainer(client);
        if (container) {
            const info = await container.inspect();
            const status = info.State.Health?.Status;
            if (status === "healthy") return;
            if (status === "unhealthy") {
                const logs = await container.logs({
                    stdout: true,
                    stderr: true,
                    tail: 50,
                });
                throw new Error(
                    `app container reported unhealthy:\n${logs.toString("utf8")}`,
                );
            }
        }
        await new Promise(resolve => setTimeout(resolve, 2_000));
    }
    throw new Error(
        `app container did not become healthy within ${timeoutMs}ms`,
    );
}

export interface DockerStackHandle {
    /** Host port the app container's 9876 is published on — the same value
     *  this was started with. */
    port: number;
    /** Tears the whole stack down via `podman compose down`. Safe to call
     *  more than once. */
    stop(): Promise<void>;
}

/**
 * Brings up postgres + redis + app via `podman compose up -d --build`, waits
 * for the app container to report healthy, and returns a handle whose
 * `stop()` tears the whole stack down the same way. `port` becomes the host
 * side of the app's port mapping (`${PORT:-9876}` in docker-compose.yml), so
 * the caller picks it exactly like it would for a bare `run.ts` child
 * process.
 */
export async function startDockerStack(
    port: number,
): Promise<DockerStackHandle> {
    const client = dockerodeClient();
    const env = { ...process.env, PORT: String(port) };

    await runCompose(["up", "-d", "--build"], env);
    await waitForHealthy(client);

    let stopped = false;
    return {
        port,
        async stop() {
            if (stopped) return;
            stopped = true;
            await runCompose(["down"]);
        },
    };
}
