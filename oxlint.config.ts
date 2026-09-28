import { defineConfig } from "oxlint";

/**
 * Ported from the biome.json this replaced. Two things biome did that oxlint
 * splits out: formatting moved to oxfmt.config.ts, and import ordering moved
 * to oxfmt's `sortImports` (biome ran it as an assist action).
 *
 * oxlint reads .eslintignore, not .gitignore, so the build outputs and vendored
 * trees biome skipped via its VCS integration are listed here explicitly.
 */
export default defineConfig({
    plugins: [
        "typescript",
        "unicorn",
        "oxc",
        "import",
        "promise",
        // biome's recommended preset linted a11y; keep that coverage.
        "jsx-a11y",
    ],
    categories: {
        correctness: "error",
        suspicious: "warn",
        perf: "warn",
    },
    ignorePatterns: [
        "dist",
        "dist-config",
        "data",
        "target",
        "zig-out",
        "**/.zig-cache",
        "config",
        "misc/apps/anura",
        "misc/obfuscatti/**/*.js",
        "misc/wisp/native/index.*",
        "src/routeTree.gen.ts",
        // Fixtures are test inputs, not source: an intentionally empty
        // background script is the point of noop-extension.
        "**/fixtures/**",
    ],
    rules: {
        // Kept off from biome: the proxy and browser-emulation layers pass
        // through values whose shape is genuinely unknown at the boundary.
        "typescript/no-explicit-any": "off",
        "typescript/no-non-null-assertion": "off",
        "typescript/no-non-null-asserted-optional-chain": "off",
        // Namespacing constants on a class is a deliberate pattern here.
        "typescript/no-extraneous-class": "off",
        "typescript/no-unused-vars": [
            "warn",
            { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
        // Solid binds element refs with a bare `let ref;` that the JSX
        // `ref={ref}` assigns at creation time - invisible to a syntactic pass.
        "no-unassigned-vars": "off",
        // Fall-through cases document the vendor matrices in misc/filters.
        "unicorn/no-useless-switch-case": "off",
        "unicorn/prefer-node-protocol": "warn",
        // String concatenation stays legal; biome had useTemplate off too.
        "prefer-template": "off",
        // `_`-prefixed internals are a convention here, and the app talks to
        // runtime globals it does not name (`_$HY`, `__civilDebug`).
        "no-underscore-dangle": "off",
        // Sequential awaits in a loop are usually the point: ordered probes,
        // rate-limited vendor calls, migrations.
        "no-await-in-loop": "off",
        // Components and closures declared inside components are how Solid is
        // written; hoisting them out would break the reactive scope.
        "unicorn/consistent-function-scoping": "off",
        // A style preference, not an accessibility defect: every hit here is a
        // case where the native element is wrong (inline SVG cannot be an
        // <img>, <dialog> only renders from the top layer, <output> is
        // form-associated, <datalist> is not a custom-rendered dropdown) and
        // role + aria-label is the documented equivalent.
        "jsx-a11y/prefer-tag-over-role": "off",
        // ul -> listbox and li -> option is the mapping the ARIA authoring
        // practices prescribe for a custom dropdown; oxlint's port of this
        // rule does not carry eslint-plugin-jsx-a11y's default allowances.
        "jsx-a11y/no-noninteractive-element-to-interactive-role": "off",
        // Every hit is a deliberate side-effect import: dotenv/config, the
        // vanilla-extract global stylesheet, the font subsets.
        "import/no-unassigned-import": "off",
        // Aimed at O(n^2) accumulator spreads; here it only catches the
        // fixed-size `{ ...item, field }` immutable update this codebase uses
        // throughout, which allocates once per element either way.
        "oxc/no-map-spread": "off",
        // Every hit is a terminal then() doing a side effect - the chain ends
        // there (most are `void`-ed or followed by .catch), so there is no
        // downstream link a missing return could starve.
        "promise/always-return": ["warn", { ignoreLastCallback: true }],
        // Every call site is BroadcastChannel.postMessage, whose signature has
        // no targetOrigin - the rule only applies to window/iframe postMessage.
        "unicorn/require-post-message-target-origin": "off",
        // The rule warns that Express drops rejections from async handlers.
        // That was Express 4; this app runs Express 5, which forwards a
        // rejected handler promise to next(err) itself.
        "oxc/no-async-endpoint-handlers": "off",
        // Every hit assigns a one-shot handler on an object the same function
        // just created (IDBRequest, XMLHttpRequest, Image, WebSocket,
        // BroadcastChannel, SpeechSynthesisUtterance) to bridge it to a
        // promise. There is no second listener to clobber, and the assignment
        // is what keeps the bridge from leaking one.
        "unicorn/prefer-add-event-listener": "off",
    },
    overrides: [
        {
            files: ["tests/**", "**/*.test.ts", "**/*.test.tsx"],
            rules: {
                "typescript/no-unused-vars": "off",
            },
        },
        {
            // The chrome API emulation layer exists to put a callback API back
            // on top of promises - that is the module's whole contract.
            files: [
                "misc/browserApiEmulators/**",
                "misc/extensionHost/**",
                "misc/filterProbe/sandbox.ts",
                "src/api/chromeApis.ts",
            ],
            rules: {
                "promise/no-callback-in-promise": "off",
                "promise/no-promise-in-callback": "off",
            },
        },
    ],
});
