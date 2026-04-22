// TypeScript bindings for emscripten-generated code.  Automatically generated at compile time.
declare namespace RuntimeExports {
    let HEAPU8: any;
}
interface WasmModule {
}

type EmbindString = ArrayBuffer|Uint8Array|Uint8ClampedArray|Int8Array|string;
interface EmbindModule {
  getOutBuf(): number;
  getInBuf(_0: number): number;
  outLen(): number;
  encodeBuf(_0: number): void;
  decodeBuf(_0: number): void;
  encode(_0: EmbindString): string;
  decode(_0: EmbindString): string;
  setSearchEngine(_0: EmbindString): void;
  setSearchTemplate(_0: EmbindString): void;
}

export type MainModule = WasmModule & typeof RuntimeExports & EmbindModule;
export default function MainModuleFactory (options?: unknown): Promise<MainModule>;
