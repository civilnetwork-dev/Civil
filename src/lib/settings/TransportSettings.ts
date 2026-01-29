import { storage } from "~/lib/localStorage";
import type { Settings } from "./types/settings";

export interface TransportSettings extends Settings {
  transport: Settings["preStoredSettings"]["transport"];
}

export class TransportSettingsManager implements Partial<TransportSettings> {
  static transport = this.getTransport() as TransportSettings["transport"];

  static setTransport(transport: TransportSettings["transport"]) {
    storage.set("transport", transport);
  }

  static getTransport() {
    return storage.get("transport");
  }
}
