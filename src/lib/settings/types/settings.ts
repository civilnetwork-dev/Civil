export interface Settings {
  currentSettingScreen: "proxy" | "look" | "transport" | "wisp-or-bare";
  onSettingsPage: boolean;
  preStoredSettings: {
    proxy: "rammerhead" | "meteor" | "scramjet" | "ultraviolet";
    transport:
      | "/epoxy/index.mjs"
      | "/libcurl/index.mjs"
      | "/baremodule/index.mjs";
  };
}
