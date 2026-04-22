/* tslint:disable */
/* eslint-disable */

export class StrShuffler {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  static fromDictionary(dictionary: string): StrShuffler;
  static generate(seed: bigint): StrShuffler;
  shuffle(input: string): string;
  unshuffle(input: string): string;
  readonly dictionary: string;
}

export function buildProxyHref(
  base_url: string,
  session_id: string,
  shuffler: StrShuffler,
  prefix?: string | null,
): string;

export function generateDictionary(seed: bigint): string;

export function isShuffled(s: string): boolean;

export type InitInput =
  | RequestInfo
  | URL
  | Response
  | BufferSource
  | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly buildProxyHref: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
  ) => [number, number];
  readonly generateDictionary: (a: bigint) => [number, number];
  readonly isShuffled: (a: number, b: number) => number;
  readonly __wbg_strshuffler_free: (a: number, b: number) => void;
  readonly strshuffler_dictionary: (a: number) => [number, number];
  readonly strshuffler_fromDictionary: (
    a: number,
    b: number,
  ) => [number, number, number];
  readonly strshuffler_generate: (a: bigint) => number;
  readonly strshuffler_shuffle: (
    a: number,
    b: number,
    c: number,
  ) => [number, number];
  readonly strshuffler_unshuffle: (
    a: number,
    b: number,
    c: number,
  ) => [number, number];
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(
  module: { module: SyncInitInput } | SyncInitInput,
): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>,
): Promise<InitOutput>;
