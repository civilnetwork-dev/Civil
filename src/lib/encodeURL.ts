import type { UVConfig as UltravioletConfig } from "@titaniumnetwork-dev/ultraviolet";
import type { Config as MeteorConfig } from "meteorproxy";

declare global {
  var __uv$config: Required<UltravioletConfig>;

  var $meteor_config: Required<MeteorConfig>;
}

/** the base proxies class */
export class Proxies {
  /**
   * encodes based on the currently-set ultraviolet codec
   * @param url the url to encode
   */
  encodeUltraviolet(url: string) {
    return __uv$config.prefix + __uv$config.encodeUrl(url);
  }

  /**
   * encodes based on the currently-set scramjet codec
   * @param url the url to encode
   */
  encodeScramjet(url: string) {
    //@ts-expect-error
    return window.scramjet.encodeUrl(url);
  }

  /**
   * encodes based on the currently-set meteor codec
   * @param url the url to encode
   */
  encodeMeteor(url: string) {
    return $meteor_config.prefix + $meteor_config.codec.encode(url);
  }
}
