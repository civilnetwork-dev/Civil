import type { StrShuffler as WasmStrShuffler } from "../pkg/rammerheadenc";

export class StrShuffler {
  private inner: WasmStrShuffler;

  private constructor(inner: WasmStrShuffler) {
    this.inner = inner;
  }

  static fromDictionary(dictionary: string) {
    const { StrShuffler: WasmClass } = (globalThis as any).__rammerheadWasm;
    return new StrShuffler(WasmClass.fromDictionary(dictionary));
  }

  static generate(seed?: bigint) {
    const { StrShuffler: WasmClass } = (globalThis as any).__rammerheadWasm;
    const s = seed ?? BigInt(Date.now());
    return new StrShuffler(WasmClass.generate(s));
  }

  get dictionary() {
    return this.inner.dictionary;
  }

  shuffle(input: string) {
    return this.inner.shuffle(input);
  }

  unshuffle(input: string) {
    return this.inner.unshuffle(input);
  }

  free() {
    this.inner.free();
  }

  unwrap() {
    return this.inner;
  }
}
