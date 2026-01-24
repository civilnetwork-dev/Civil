import { storage } from "~/lib/localStorage";
import type { Settings } from "./types/settings";

export interface ProxySettings extends Settings {
  proxy: Settings["preStoredSettings"]["proxy"];
  // TODO: add more
}

export class ProxySettingsManager implements Partial<ProxySettings> {
  static proxy = this.getProxy() as ProxySettings["proxy"];

  static setProxy(proxy: ProxySettings["proxy"]) {
    storage.set("proxy", proxy);
  }

  static getProxy() {
    return storage.get("proxy");
  }
}
