///<reference types="serviceworker" />
import type { UVConfig as UltravioletConfig } from "@titaniumnetwork-dev/ultraviolet";

declare global {
  var __uv$config: Required<UltravioletConfig>;
}
