let initialised = false;

export async function init(wasmUrl?: string) {
  if (initialised) return;

  const module = await import(
    /* @vite-ignore */
    wasmUrl ?? new URL("../pkg/rammerheadenc.js", import.meta.url).href
  );

  await module.default();
  (globalThis as any).__rammerheadWasm = module;
  initialised = true;
}
