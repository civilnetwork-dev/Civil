import type { UVConfig as UltravioletConfig } from "@titaniumnetwork-dev/ultraviolet";

declare global {
  interface Window {
    __uv$config: Required<UltravioletConfig>;
  }
}
