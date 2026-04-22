export function generateDictionary(seed?: bigint) {
  const { generateDictionary: wasmFn } = (globalThis as any).__rammerheadWasm;
  return wasmFn(seed ?? BigInt(Date.now()));
}
