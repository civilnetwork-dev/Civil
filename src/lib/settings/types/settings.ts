export interface Settings {
  currentSettingScreen: "proxy" | "look" | "transport" | "wisp-or-bare";
  onSettingsPage: boolean;
  preStoredSettings: {
    proxy: "rammerhead" | "meteor" | "scramjet" | "ultraviolet";
  };
}
