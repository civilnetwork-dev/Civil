import toTitleCase from "to-title-case";

export function showSettingPage(setting: string) {
  const titleCaseSetting = toTitleCase(setting.replace(/-/g, " "));
  document.title = `Comet - Settings - ${titleCaseSetting}`;

  switch (setting) {
    case "proxy":
  }
}
