import type { StrShuffler } from "./shuffler.ts";

export function buildProxyHref(
  baseUrl: string,
  sessionId: string,
  shuffler: StrShuffler,
  prefix?: string,
) {
  const { buildProxyHref: wasmFn } = (globalThis as any).__rammerheadWasm;
  return wasmFn(baseUrl, sessionId, shuffler.unwrap(), prefix);
}

export function isShuffled(s: string) {
  const { isShuffled: wasmFn } = (globalThis as any).__rammerheadWasm;
  return wasmFn(s);
}
