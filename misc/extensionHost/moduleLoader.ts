/**
 * A real `importModuleDynamically` resolver, for the one shape
 * `vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER` (host.ts's `compileScript`)
 * can't handle: a `chrome-extension://` specifier, built the same way every
 * other extension-relative reference in this host is built —
 * `chrome.runtime.getURL(path)` — and then dynamically imported. Node's
 * default loader only resolves `file:`/`data:`/`node:` and rejects that
 * scheme outright (`ERR_UNSUPPORTED_ESM_URL_SCHEME`), because it has no way
 * to know a `chrome-extension://` origin means "this extension's own files,
 * on disk, under `extensionDir`" — the same translation `api/platform.ts`'s
 * `buildFetch` already does for `fetch()`, done here for `import()` instead.
 *
 * Relative specifiers (`./`, `../`) resolve the same way `import()` resolves
 * anywhere: against the *importing* file's own path, recursively — a module
 * this resolver loads can itself dynamically-import another, and that one
 * resolves against its own path in turn, not the original entry's.
 *
 * Needs `vm.SourceTextModule`, which is experimental: enabled process-wide by
 * `vitest.config.ts` so nothing here has to gate on it being present, since
 * the only place this runs is inside a test process.
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import * as vm from "node:vm";

/** `vm.SourceTextModule` is still marked experimental in @types/node — the
 *  runtime API (guarded by vitest.config.ts's flag) is ahead of the
 *  published types, so this is the one, shared cast the whole file needs. */
const SourceTextModuleCtor = (
    vm as unknown as {
        SourceTextModule: new (
            source: string,
            options: { identifier: string; context: vm.Context },
        ) => vm.Module;
    }
).SourceTextModule;

export interface ModuleLoaderOptions {
    /** The vm context the importing script/module already runs in — a
     *  dynamically-loaded module runs in the *same* context, so it sees the
     *  same `chrome`, `fetch`, etc. the rest of the sandbox does. */
    context: vm.Context;
    extensionId: string;
    extensionDir: string;
    /** The top-level script's own path, so *its* dynamic imports (as opposed
     *  to a further import from a module this resolver already loaded, which
     *  carries its own path via `.identifier`) have a base to resolve
     *  relative specifiers against. */
    entryPath: string;
}

/** Resolves a specifier to an absolute file path, or `undefined` for
 *  anything this host has no business trying to serve (a bare/npm-style
 *  specifier — the same "resolve to nothing runnable" call `compileScript`'s
 *  own esbuild fallback already makes for those). */
function resolveSpecifier(
    specifier: string,
    referencingPath: string,
    extensionId: string,
    extensionDir: string,
): string | undefined {
    const extensionPrefix = `chrome-extension://${extensionId}/`;
    if (specifier.startsWith(extensionPrefix)) {
        const relative = decodeURIComponent(
            specifier.slice(extensionPrefix.length).split(/[?#]/)[0] ?? "",
        );
        const resolved = resolvePath(extensionDir, relative);
        // Nothing outside the extension directory, matching buildFetch's own
        // containment for the same URL shape.
        return resolved.startsWith(resolvePath(extensionDir))
            ? resolved
            : undefined;
    }
    if (specifier.startsWith(".") || specifier.startsWith("/")) {
        return resolvePath(dirname(referencingPath), specifier);
    }
    // A bare specifier (an npm-style package name) — nothing this host
    // resolves; matches compileScript's own esbuild plugin, which sends the
    // same shape to an empty module rather than failing the whole load.
    return undefined;
}

/** Builds the `importModuleDynamically` callback for one script/context. */
export function createModuleLoader(
    options: ModuleLoaderOptions,
): (
    specifier: string,
    referencer: vm.Script | vm.Module,
) => Promise<vm.Module> {
    const { context, extensionId, extensionDir, entryPath } = options;
    const cache = new Map<string, Promise<vm.Module>>();

    function emptyModule(identifier: string): vm.Module {
        return new SourceTextModuleCtor("export default undefined;", {
            identifier,
            context,
        });
    }

    async function load(filePath: string | undefined): Promise<vm.Module> {
        const key = filePath ?? `unresolved:${cache.size}`;
        const cached = cache.get(key);
        if (cached) return cached;

        const promise = (async () => {
            const source = filePath
                ? await readFile(filePath, "utf8").catch(() => undefined)
                : undefined;
            if (source === undefined) return emptyModule(key);

            const module: vm.Module = new SourceTextModuleCtor(source, {
                // Non-null: `source` only resolves past the check above when
                // `filePath` was truthy (see its own conditional, three lines
                // up) — the two are never independent.
                identifier: filePath!,
                context,
            });
            await module.link(async (specifier: string) => {
                const resolved = resolveSpecifier(
                    specifier,
                    filePath!,
                    extensionId,
                    extensionDir,
                );
                return load(resolved);
            });
            await module.evaluate();
            return module;
        })();
        cache.set(key, promise);
        return promise;
    }

    return async (specifier, referencer) => {
        const referencingPath =
            "identifier" in referencer
                ? (referencer as vm.Module).identifier
                : entryPath;
        const resolved = resolveSpecifier(
            specifier,
            referencingPath,
            extensionId,
            extensionDir,
        );
        return load(resolved);
    };
}
