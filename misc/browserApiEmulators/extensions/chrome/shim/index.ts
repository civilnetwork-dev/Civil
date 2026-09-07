import type { ShimOptions } from "../types";
import { buildActionAPI } from "./action";
import { buildAlarmsAPI } from "./alarms";
import {
    accessibilityFeatures,
    audio,
    certificateProvider,
    contentSettings,
    declarativeContent,
    declarativeWebRequest,
    desktopCapture,
    devtools,
    dom,
    enterprise,
    extensionTypes,
    fileBrowserHandler,
    fileSystemProvider,
    fontSettings,
    gcm,
    idle,
    input,
    instanceID,
    loginState,
    networking,
    omnibox,
    pageCapture,
    platformKeys,
    power,
    printerProvider,
    printing,
    printingMetrics,
    readingList,
    search,
    serial,
    sessions,
    socket,
    systemLog,
    tabCapture,
    tabGroups,
    topSites,
    tts,
    ttsEngine,
    userScripts,
    vpnProvider,
    wallpaper,
    webAuthenticationProxy,
} from "./apis";
import { buildDNRAPI } from "./declarativeNetRequest";
import {
    bluetooth,
    bluetoothLowEnergy,
    bluetoothSocket,
    chromeEvents,
    clipboard,
    debugger_ as debuggerAPI,
    documentScan,
    enterpriseHardwarePlatform,
    enterpriseKioskApps,
    enterpriseLogin,
    feedback,
    hid,
    mdns,
    networkingOnc,
    processes,
    sockets,
    usb,
    webstore,
} from "./extra";
import {
    buildBookmarksAPI,
    buildBrowsingDataAPI,
    buildCommandsAPI,
    buildContextMenusAPI,
    buildCookiesAPI,
    buildDnsAPI,
    buildDownloadsAPI,
    buildHistoryAPI,
    buildI18nAPI,
    buildManagementAPI,
    buildNotificationsAPI,
    buildOffscreenAPI,
    buildPermissionsAPI,
    buildPrivacyAPI,
    buildProxyAPI,
    buildSidePanelAPI,
    buildWebRequestAPI,
} from "./misc";
import { buildRuntimeAPI } from "./runtime";
import { buildScriptingAPI } from "./scripting";
import { buildStorageAPI } from "./storage";
import { buildTabsAPI } from "./tabs";
import {
    dispatchBrowserEvent,
    extUrl,
    getBiB,
    getCivilBus,
    initBiB,
} from "./util";
import { buildWebNavigationAPI } from "./webNavigation";
import { buildWindowsAPI } from "./windows";

declare const __CIVIL_SHIM_OPTIONS__: ShimOptions;

function _buildSystemCpuInfo() {
    const numOfProcessors =
        typeof navigator !== "undefined"
            ? (navigator.hardwareConcurrency ?? 4)
            : 4;
    return {
        numOfProcessors,
        archName: "x86-64",
        modelName: "Civil Shim CPU",
        features: [],
        processors: Array.from({ length: numOfProcessors }, () => ({
            usage: { kernel: 0, user: 0, idle: 100, total: 100 },
        })),
    };
}

function _buildDisplayInfo(): unknown[] {
    try {
        if (typeof screen !== "undefined") {
            return [
                {
                    id: "display:0",
                    isPrimary: true,
                    isInternal: false,
                    isEnabled: true,
                    dpiX: (window.devicePixelRatio ?? 1) * 96,
                    dpiY: (window.devicePixelRatio ?? 1) * 96,
                    rotation: 0,
                    bounds: {
                        left: 0,
                        top: 0,
                        width: screen.width,
                        height: screen.height,
                    },
                    overscan: { left: 0, top: 0, right: 0, bottom: 0 },
                    workArea: {
                        left: 0,
                        top: 0,
                        width: screen.availWidth,
                        height: screen.availHeight,
                    },
                    workAreaInsets: { left: 0, top: 0, right: 0, bottom: 0 },
                },
            ];
        }
    } catch {}
    return [];
}

async function _buildNetworkInterfaces(): Promise<unknown[]> {
    const ifaces: {
        name: string;
        address: string;
        prefixLength: number;
    }[] = [];
    try {
        if (typeof RTCPeerConnection !== "undefined") {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });
            pc.createDataChannel("");
            await pc.setLocalDescription(await pc.createOffer());
            await new Promise<void>(resolve => setTimeout(resolve, 400));
            const sdp = pc.localDescription?.sdp ?? "";
            pc.close();
            const ipRegex = /(?:host|srflx|prflx) [\d.]+ ([\d.]+)/g;
            let m: RegExpExecArray | null;
            const seen = new Set<string>();
            while ((m = ipRegex.exec(sdp)) !== null) {
                const ip = m[1];
                if (ip && !seen.has(ip)) {
                    seen.add(ip);
                    ifaces.push({
                        name: "eth0",
                        address: ip,
                        prefixLength: 24,
                    });
                }
            }
        }
    } catch {}
    return ifaces.length > 0
        ? ifaces
        : [{ name: "eth0", address: "127.0.0.1", prefixLength: 8 }];
}

// TM's USER_SCRIPT-world scripts are injected via nativeEval, which bypasses
// Scramjet's location proxy, so reads of `window.location.href` return the raw
// Scramjet proxy URL instead of the real page URL. window.location itself is
// non-configurable and can't be overridden. Instead we rewrite location.href
// READS in the injected code to prefer window.__cRealUrl (the real page URL,
function patchUserScriptLocation(code: string): string {
    if (typeof code !== "string" || !code.includes("location")) return code;
    return code.replace(
        /(^|[^.\w$])((?:[A-Za-z_$][\w$]*\.)?location\.href)(?!\s*=(?!=))/g,
        (_m, pre, expr) => `${pre}(window.__cRealUrl||${expr})`,
    );
}

(() => {
    if ((window as unknown as Record<string, unknown>).__civil_chrome_injected)
        return;
    // NOTE: flag is set AFTER w.chrome = chrome so that if the IIFE crashes
    // mid-init, the next injection attempt can retry rather than being blocked
    // by a stuck flag on a context where chrome was never set.

    const opts: ShimOptions = __CIVIL_SHIM_OPTIONS__;
    const { extId, manifest, storageData = {} } = opts;

    initBiB(opts.bib, window.location.origin);
    const bib = getBiB();
    const features = bib.features ?? {};

    const runtime = buildRuntimeAPI(
        extId,
        manifest,
        opts.contextType ?? "content",
    );
    const storage = buildStorageAPI(storageData, extId);
    const dnr =
        features.declarativeNetRequest !== false
            ? buildDNRAPI(extId)
            : buildDNRStub();
    const _getDNRRules = () =>
        "_getAllRules" in dnr && typeof dnr._getAllRules === "function"
            ? (dnr._getAllRules as () => import("../types").DNRRule[])()
            : [];
    const tabs = buildTabsAPI(
        extId,
        runtime._contextId,
        _getDNRRules,
        opts.contextType ?? "content",
    );
    const windows = buildWindowsAPI();
    const action = buildActionAPI();
    const scripting = buildScriptingAPI(opts.contextType ?? "content", extId);
    const webNav =
        features.webNavigation !== false
            ? buildWebNavigationAPI(extId)
            : buildNoopNamespace();
    const i18n = buildI18nAPI();
    const permissions = buildPermissionsAPI();
    const contextMenus =
        features.contextMenus !== false
            ? buildContextMenusAPI()
            : buildNoopNamespace();
    const webRequest =
        features.webRequest !== false
            ? buildWebRequestAPI(
                  _getDNRRules,
                  (opts.contextType ?? "content") === "background",
              )
            : buildNoopNamespace();
    const notifs =
        features.notifications !== false
            ? buildNotificationsAPI()
            : buildNoopNamespace();
    const browsingData = buildBrowsingDataAPI();
    const management = buildManagementAPI();
    const offscreen = buildOffscreenAPI(
        extId,
        manifest as Record<string, unknown>,
        opts.contextType ?? "content",
    );
    const sidePanel = buildSidePanelAPI();
    const privacy =
        features.privacy !== false ? buildPrivacyAPI() : buildNoopNamespace();
    const proxy =
        features.proxy !== false ? buildProxyAPI() : buildNoopNamespace();
    const dns = buildDnsAPI();
    const cookies =
        features.cookies !== false ? buildCookiesAPI() : buildNoopNamespace();
    const history =
        features.history !== false ? buildHistoryAPI() : buildNoopNamespace();
    const bookmarks = buildBookmarksAPI();
    const commands = buildCommandsAPI(
        manifest as Parameters<typeof buildCommandsAPI>[0],
    );
    const downloads =
        features.downloads !== false
            ? buildDownloadsAPI()
            : buildNoopNamespace();
    const alarmsAPI =
        features.alarms !== false ? buildAlarmsAPI() : buildNoopNamespace();

    const extension = {
        getURL: (path: string) => extUrl(extId, path),
        getBackgroundPage: () => null as Window | null,
        getViews: (_fetchProperties?: unknown) => [] as Window[],
        isAllowedIncognitoAccess: (cb?: (allowed: boolean) => void) => {
            if (cb) cb(false);
            return Promise.resolve(false);
        },
        isAllowedFileSchemeAccess: (cb?: (allowed: boolean) => void) => {
            if (cb) cb(false);
            return Promise.resolve(false);
        },
        sendRequest: runtime.sendMessage,
        sendMessage: runtime.sendMessage,
        onRequest: runtime.onMessage,
        onMessage: runtime.onMessage,
        onRequestExternal: runtime.onMessageExternal,
        onMessageExternal: runtime.onMessageExternal,
        inIncognitoContext: bib.incognito,
        lastError: null as { message: string } | null,
        getExtensionTabs: () => [] as unknown[],
    };

    const types = {
        ChromeSetting: class {
            onChange = {
                addListener() {},
                removeListener() {},
                hasListener() {
                    return false;
                },
                hasListeners() {
                    return false;
                },
            };
            get(_d: unknown, cb?: (d: unknown) => void) {
                if (cb)
                    cb({
                        value: undefined,
                        levelOfControl: "not_controllable",
                    });
                return Promise.resolve({
                    value: undefined,
                    levelOfControl: "not_controllable",
                });
            }
            set(_d: unknown, cb?: () => void) {
                if (cb) cb();
                return Promise.resolve();
            }
            clear(_d: unknown, cb?: () => void) {
                if (cb) cb();
                return Promise.resolve();
            }
        },
    };

    const _onSignInChanged = {
        addListener() {},
        removeListener() {},
        hasListener() {
            return false;
        },
        hasListeners() {
            return false;
        },
    };

    const identity = {
        getAuthToken: (_d: unknown, cb?: (t?: string) => void) => {
            if (cb) cb(undefined);
            return Promise.resolve(undefined as string | undefined);
        },
        removeCachedAuthToken: (_d: unknown, cb?: () => void) => {
            if (cb) cb();
            return Promise.resolve();
        },
        getRedirectURL: (path?: string) =>
            `https://${extId}.chromiumapp.org/${path ?? ""}`,
        getProfileUserInfo: (_d: unknown, cb?: (i: unknown) => void) => {
            if (cb) cb({ email: "", id: "" });
            return Promise.resolve({ email: "", id: "" });
        },

        launchWebAuthFlow: (details: unknown, cb?: (url?: string) => void) => {
            const d = details as { url: string; interactive?: boolean };
            const p = (async (): Promise<string | undefined> => {
                if (!d.url) return undefined;
                if (d.interactive === false) return undefined;
                try {
                    const redirectBase = `https://${extId}.chromiumapp.org/`;
                    return await new Promise<string | undefined>(resolve => {
                        const popup = window.open(
                            d.url,
                            "_blank",
                            "width=600,height=700,noopener",
                        );
                        if (!popup) {
                            resolve(undefined);
                            return;
                        }

                        const tid = setInterval(() => {
                            try {
                                if (popup.closed) {
                                    clearInterval(tid);
                                    resolve(undefined);
                                    return;
                                }
                                const href = popup.location?.href;
                                if (href?.startsWith(redirectBase)) {
                                    popup.close();
                                    clearInterval(tid);
                                    resolve(href);
                                }
                            } catch {}
                        }, 200);

                        setTimeout(
                            () => {
                                clearInterval(tid);
                                if (!popup.closed) popup.close();
                                resolve(undefined);
                            },
                            5 * 60 * 1000,
                        );
                    });
                } catch {
                    return undefined;
                }
            })();
            if (cb) p.then(cb).catch(() => cb(undefined));
            return p;
        },
        clearAllCachedAuthTokens: (cb?: () => void) => {
            if (cb) cb();
            return Promise.resolve();
        },
        onSignInChanged: _onSignInChanged,
    };

    const _displayChangedEvent = {
        addListener() {},
        removeListener() {},
        hasListener() {
            return false;
        },
        hasListeners() {
            return false;
        },
    };

    const system = {
        cpu: {
            getInfo: (cb?: (info: unknown) => void) => {
                const info = _buildSystemCpuInfo();
                if (cb) cb(info);
                return Promise.resolve(info);
            },
        },
        memory: {
            getInfo: (cb?: (info: unknown) => void) => {
                const p = (async () => {
                    let capacity = 8 * 1024 * 1024 * 1024;
                    let available = capacity / 2;
                    try {
                        const mem = (
                            performance as unknown as {
                                memory?: {
                                    jsHeapSizeLimit: number;
                                    totalJSHeapSize: number;
                                    usedJSHeapSize: number;
                                };
                            }
                        ).memory;
                        if (mem) {
                            capacity = mem.jsHeapSizeLimit;
                            available = capacity - mem.usedJSHeapSize;
                        } else {
                            const dm = (
                                navigator as unknown as {
                                    deviceMemory?: number;
                                }
                            ).deviceMemory;
                            if (dm) {
                                capacity = dm * 1024 * 1024 * 1024;
                                available = capacity / 2;
                            }
                        }
                    } catch {}
                    return {
                        capacity,
                        availableCapacity: available,
                        physicalMemory: capacity,
                    };
                })();
                if (cb) p.then(cb).catch(() => cb({}));
                return p;
            },
        },
        storage: {
            getInfo: (cb?: (i: unknown[]) => void) => {
                const p = (async () => {
                    try {
                        if (
                            typeof navigator !== "undefined" &&
                            navigator.storage?.estimate
                        ) {
                            const est = await navigator.storage.estimate();
                            return [
                                {
                                    id: "storage:0",
                                    name: "User Data",
                                    type: "fixed",
                                    capacity: est.quota ?? 0,
                                    availableCapacity:
                                        (est.quota ?? 0) - (est.usage ?? 0),
                                },
                            ];
                        }
                    } catch {}
                    return [];
                })();
                if (cb) p.then(cb).catch(() => cb([]));
                return p;
            },
        },
        display: {
            getInfo: (cb?: (i: unknown[]) => void) => {
                const info = _buildDisplayInfo();
                if (cb) cb(info);
                return Promise.resolve(info);
            },
            onDisplayChanged: _displayChangedEvent,
        },
        network: {
            getNetworkInterfaces: (cb?: (i: unknown[]) => void) => {
                const p = _buildNetworkInterfaces();
                if (cb) p.then(cb).catch(() => cb([]));
                return p;
            },
        },
        powerSource: {
            onPowerChanged: {
                addListener() {},
                removeListener() {},
                hasListener() {
                    return false;
                },
                hasListeners() {
                    return false;
                },
            },
        },
    };

    const chrome = {
        runtime,
        storage,
        tabs,
        windows,
        action,
        browserAction: action,
        pageAction: action,
        scripting,
        declarativeNetRequest: dnr,
        webNavigation: webNav,
        webRequest,
        permissions,
        contextMenus,
        notifications: notifs,
        browsingData,
        management,
        offscreen,
        sidePanel,
        privacy,
        proxy,
        dns,
        cookies,
        history,
        bookmarks,
        commands,
        downloads,
        alarms: alarmsAPI,
        i18n,
        extension,
        types,

        accessibilityFeatures,
        audio,
        certificateProvider,
        contentSettings:
            features.contentSettings !== false
                ? contentSettings
                : buildNoopNamespace(),
        declarativeContent,
        declarativeWebRequest,
        desktopCapture,
        devtools: features.devtools !== false ? devtools : undefined,
        dom,
        enterprise: {
            ...enterprise,
            hardwarePlatform: enterpriseHardwarePlatform,
            kioskApps: enterpriseKioskApps,
            login: enterpriseLogin,
        },
        events: chromeEvents,
        extensionTypes,
        fileBrowserHandler,
        fileSystemProvider,
        fontSettings:
            features.fontSettings !== false
                ? fontSettings
                : buildNoopNamespace(),
        gcm,
        idle: features.idle !== false ? idle : buildNoopNamespace(),
        input,
        instanceID,
        loginState,
        networking: {
            ...networking,
            onc: networkingOnc,
        },
        omnibox: features.omnibox !== false ? omnibox : buildNoopNamespace(),
        pageCapture:
            features.pageCapture !== false ? pageCapture : buildNoopNamespace(),
        platformKeys,
        power,
        printerProvider,
        printing,
        printingMetrics,
        readingList,
        search: features.search !== false ? search : buildNoopNamespace(),
        serial,
        sessions: features.sessions !== false ? sessions : buildNoopNamespace(),
        socket,
        sockets,
        systemLog,
        tabCapture,
        tabGroups:
            features.tabGroups !== false ? tabGroups : buildNoopNamespace(),
        topSites,
        tts: features.tts !== false ? tts : buildNoopNamespace(),
        ttsEngine,
        userScripts:
            features.userScripts !== false
                ? opts.contextType === "background"
                    ? // In background context: register() must NOT inject into
                      // the background iframe's document. Store registrations
                      // and broadcast them. Also listen for "contentReady" from
                      // content shims so we can replay stored scripts to pages
                      // that load AFTER register() was first called.
                      (() => {
                          const _bus = getCivilBus(extId);
                          const _storedBatches: unknown[][] = [];
                          const _registeredIds = new Set<string>();
                          let _broadcastTimer: ReturnType<
                              typeof setTimeout
                          > | null = null;
                          const _scheduleBroadcast = () => {
                              if (_broadcastTimer !== null)
                                  clearTimeout(_broadcastTimer);
                              _broadcastTimer = setTimeout(() => {
                                  _broadcastTimer = null;
                                  const _all = _storedBatches.flat() as {
                                      world?: string;
                                      [k: string]: unknown;
                                  }[];
                                  if (!_all.length) return;
                                  _all.sort((a, b) => {
                                      const _o = (w: string | undefined) =>
                                          w === "USER_SCRIPT"
                                              ? 0
                                              : w === "MAIN"
                                                ? 1
                                                : 2;
                                      return _o(a.world) - _o(b.world);
                                  });
                                  _bus.postMessage({
                                      kind: "userScriptRegister",
                                      scripts: _all,
                                  });
                              }, 100);
                          };
                          _bus.addEventListener(
                              "message",
                              (ev: MessageEvent) => {
                                  const d = ev.data as {
                                      kind?: string;
                                  };
                                  if (d?.kind !== "contentReady") return;
                                  const allScripts = _storedBatches.flat() as {
                                      world?: string;
                                      [k: string]: unknown;
                                  }[];
                                  allScripts.sort((a, b) => {
                                      const order = (w: string | undefined) =>
                                          w === "USER_SCRIPT"
                                              ? 0
                                              : w === "MAIN"
                                                ? 1
                                                : 2;
                                      return order(a.world) - order(b.world);
                                  });
                                  if (allScripts.length > 0) {
                                      _bus.postMessage({
                                          kind: "userScriptRegister",
                                          scripts: allScripts,
                                      });
                                  }
                              },
                          );
                          return {
                              ...userScripts,
                              register: async (
                                  scripts: unknown[],
                                  cb?: () => void,
                              ) => {
                                  type JsEntry = {
                                      file?: string;
                                      code?: string;
                                  };
                                  type ScriptDef = {
                                      id?: string;
                                      js?: JsEntry[];
                                      [k: string]: unknown;
                                  };
                                  const _patchFrameCheck = (
                                      file: string | undefined,
                                      code: string,
                                  ): string => {
                                      if (
                                          !file ||
                                          !/(?:^|\/)(?:content|page)\.js$/.test(
                                              file,
                                          )
                                      )
                                          return code;
                                      const patched = code.replace(
                                          /[A-Za-z_$][\w$]*==[A-Za-z_$][\w$]*\.top\b/g,
                                          "(!0)",
                                      );
                                      return patched;
                                  };
                                  // Load a file's raw text via fetch, falling back to
                                  // direct OPFS read (the path the SW uses to store ext
                                  // files). Returns null if both fail.
                                  const _loadRaw = async (
                                      file: string,
                                  ): Promise<string | null> => {
                                      try {
                                          const url = file.startsWith("http")
                                              ? file
                                              : extUrl(extId, file);
                                          const _ac = new AbortController();
                                          const _t = setTimeout(
                                              () => _ac.abort(),
                                              8000,
                                          );
                                          const resp = await fetch(url, {
                                              signal: _ac.signal,
                                          }).finally(() => clearTimeout(_t));
                                          if (resp.ok) return await resp.text();
                                      } catch {
                                          /* fall through to OPFS */
                                      }
                                      try {
                                          const opfsRoot =
                                              await navigator.storage.getDirectory();
                                          const parts =
                                              `extensions/${extId}/${file}`
                                                  .split("/")
                                                  .filter(Boolean);
                                          let dir: FileSystemDirectoryHandle =
                                              opfsRoot;
                                          for (
                                              let i = 0;
                                              i < parts.length - 1;
                                              i++
                                          ) {
                                              dir =
                                                  await dir.getDirectoryHandle(
                                                      parts[i]!,
                                                  );
                                          }
                                          const fh = await dir.getFileHandle(
                                              parts[parts.length - 1]!,
                                          );
                                          return await (
                                              await fh.getFile()
                                          ).text();
                                      } catch {
                                          return null;
                                      }
                                  };
                                  const resolved = await Promise.all(
                                      (scripts as ScriptDef[]).map(async s => {
                                          if (!s.js?.length) return s;
                                          const resolvedJs = await Promise.all(
                                              s.js.map(
                                                  async (entry: JsEntry) => {
                                                      if (entry.file) {
                                                          const raw =
                                                              await _loadRaw(
                                                                  entry.file,
                                                              );
                                                          if (raw != null) {
                                                              return {
                                                                  code: _patchFrameCheck(
                                                                      entry.file,
                                                                      raw,
                                                                  ),
                                                              };
                                                          }
                                                          return entry;
                                                      }
                                                      // In userscripts-dynamic mode TM inlines
                                                      // content.js into a {code} entry built as
                                                      // `window.tm_scripts=window.tm_scripts||null;`
                                                      // + (await fetch(getURL("content.js"))).text().
                                                      // In BiB the background's own fetch of its
                                                      // content.js returns empty, so only the ~133
                                                      // char prefix+sourceURL stub survives and the
                                                      // bridge (which installs the window.pagejs
                                                      // setter to complete the page.js handshake)
                                                      // never runs. Detect that stub and splice in
                                                      // the real content.js, which we CAN load.
                                                      if (
                                                          typeof entry.code ===
                                                              "string" &&
                                                          entry.code.includes(
                                                              "window.tm_scripts=window.tm_scripts||null;",
                                                          ) &&
                                                          entry.code.length <
                                                              4000
                                                      ) {
                                                          const raw =
                                                              await _loadRaw(
                                                                  "content.js",
                                                              );
                                                          if (
                                                              raw != null &&
                                                              raw.length > 4000
                                                          ) {
                                                              return {
                                                                  code:
                                                                      "window.tm_scripts=window.tm_scripts||null;\n" +
                                                                      _patchFrameCheck(
                                                                          "content.js",
                                                                          raw,
                                                                      ) +
                                                                      `\n//# sourceURL=${extUrl(extId, "content.js")}\n`,
                                                              };
                                                          }
                                                      }
                                                      return entry;
                                                  },
                                              ),
                                          );
                                          return { ...s, js: resolvedJs };
                                      }),
                                  );
                                  _storedBatches.push(resolved);
                                  // Schedule a debounced broadcast of the full sorted
                                  // script set. Using setTimeout(0) coalesces concurrent
                                  // register() calls (common when TM registers page.js
                                  // and content.js in separate calls) so content always
                                  // receives one complete, ordered userScriptRegister
                                  // message with USER_SCRIPT before MAIN.
                                  _scheduleBroadcast();
                                  for (const s of resolved) {
                                      const id = (s as { id?: string })?.id;
                                      if (id) _registeredIds.add(id);
                                  }
                                  if (cb) cb();
                              },
                              unregister: (
                                  filter?: { ids?: string[] },
                                  cb?: () => void,
                              ) => {
                                  if (filter?.ids) {
                                      for (const id of filter.ids)
                                          _registeredIds.delete(id);
                                      // Rebuild _storedBatches removing unregistered scripts
                                      for (
                                          let i = _storedBatches.length - 1;
                                          i >= 0;
                                          i--
                                      ) {
                                          _storedBatches[i] = (
                                              _storedBatches[i] as {
                                                  id?: string;
                                              }[]
                                          ).filter(
                                              s =>
                                                  !s.id ||
                                                  !filter.ids!.includes(s.id),
                                          );
                                          if (_storedBatches[i].length === 0)
                                              _storedBatches.splice(i, 1);
                                      }
                                  } else {
                                      _storedBatches.length = 0;
                                      _registeredIds.clear();
                                  }
                                  if (cb) cb();
                                  return Promise.resolve();
                              },
                              getScripts: (
                                  _filter?: unknown,
                                  cb?: (s: unknown[]) => void,
                              ) => {
                                  const all = _storedBatches.flat();
                                  if (cb) cb(all);
                                  return Promise.resolve(all);
                              },
                          };
                      })()
                    : userScripts
                : buildNoopNamespace(),
        vpnProvider,
        wallpaper,
        webAuthenticationProxy,

        bluetooth,
        bluetoothLowEnergy,
        bluetoothSocket,
        clipboard,
        debugger: debuggerAPI,
        documentScan,
        feedback,
        hid,
        mdns,
        processes,
        usb,
        webstore,

        cast: undefined,
        app: {
            getDetails: () => null,
            getIsInstalled: () => false,
            InstallState: {},
            RunningState: {},
        },

        identity,
        system,
    };

    const w = window as unknown as Record<string, unknown>;
    w.chrome = chrome;
    w.browser = chrome;
    w.__civil_chrome_injected = true;

    // Intercept window.open and <a> clicks for chrome-extension:// URLs so
    // that popup/content pages that navigate via window.open or plain links
    // instead of chrome.tabs.create still open as Civil browser tabs.
    if (opts.contextType === "popup" || opts.contextType === "content") {
        try {
            const _nativeOpen = window.open.bind(window);
            window.open = (
                url?: string | URL,
                target?: string,
                windowFeatures?: string,
            ) => {
                const urlStr = url ? String(url) : "";
                if (
                    urlStr.startsWith("chrome-extension://") ||
                    urlStr.startsWith("moz-extension://")
                ) {
                    dispatchBrowserEvent(bib.newTabEvent, { url: urlStr });
                    return null;
                }
                return _nativeOpen(url as string, target, windowFeatures);
            };
        } catch {}

        try {
            document.addEventListener(
                "click",
                (e: MouseEvent) => {
                    const a = (e.target as Element | null)?.closest?.("a");
                    if (!a) return;
                    const href = (a as HTMLAnchorElement).href ?? "";
                    if (
                        href.startsWith("chrome-extension://") ||
                        href.startsWith("moz-extension://")
                    ) {
                        e.preventDefault();
                        e.stopPropagation();
                        dispatchBrowserEvent(bib.newTabEvent, { url: href });
                    }
                },
                true, // capture phase: fires before page handlers
            );
        } catch {}
    }

    // Content context: listen for userScript registrations broadcast by the
    // background (via our userScripts.register override). Execute matching
    // scripts in the page context, mirroring Chrome's userScripts injection.
    // Send "contentReady" AFTER registering the listener so that scripts
    // registered before this page loaded are replayed by the background.
    if (opts.contextType === "content") {
        const _contentBus = getCivilBus(extId);
        // Dedup: background re-broadcasts the full accumulated script set on
        // every register() call AND on contentReady replay. Without dedup,
        // content.js/page.js get injected multiple times → the second
        // content.js reinstalls its window.pagejs setter AFTER page.js already
        // assigned, so the setter waits forever for an assignment that already
        // happened → bridge stuck (no throw). Inject each script id once.
        const _injectedScriptIds = new Set<string>();
        _contentBus.addEventListener("message", (e: MessageEvent) => {
            const data = e.data as {
                kind?: string;
                scripts?: unknown[];
            };
            if (data?.kind !== "userScriptRegister" || !data.scripts) return;
            // Prefer bib.currentTab.url (baked in at inject time by
            // injectExtensionShimsIntoIframe with the real decoded URL)
            // over window.location.href, which returns the scramjet proxy
            // URL for scripts injected from the parent frame.
            const pageUrl =
                bib.currentTab?.url ??
                (typeof window !== "undefined" ? window.location.href : "");
            for (const script of data.scripts) {
                const s = script as {
                    id?: string;
                    matches?: string[];
                    excludeMatches?: string[];
                    js?: Array<{ file?: string; code?: string }>;
                    world?: string;
                };
                if (!s.js?.length) continue;
                if (s.id && _injectedScriptIds.has(s.id)) continue;
                // Basic match-pattern check (same logic as matchesUrlPattern)
                const matches = (patterns: string[], url: string) => {
                    try {
                        const u = new URL(url);
                        return patterns.some(p => {
                            if (p === "<all_urls>") return true;
                            const m =
                                /^(\*|https?|ftp|file):\/\/(\*|[^/]*)(\/.*)?$/.exec(
                                    p,
                                );
                            if (!m) return false;
                            const [, pS, pH, pP = "/*"] = m;
                            const sch = u.protocol.slice(0, -1);
                            if (pS !== "*" && pS !== sch) return false;
                            if (pH !== "*") {
                                if (pH.startsWith("*.")) {
                                    const base = pH.slice(2);
                                    if (
                                        u.hostname !== base &&
                                        !u.hostname.endsWith("." + base)
                                    )
                                        return false;
                                } else if (u.hostname !== pH) return false;
                            }
                            const pathQ = u.pathname + (u.search ?? "");
                            const re = new RegExp(
                                "^" +
                                    pP
                                        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
                                        .replace(/\*/g, ".*") +
                                    "$",
                            );
                            return re.test(pathQ);
                        });
                    } catch {
                        return false;
                    }
                };
                if (s.matches && !matches(s.matches, pageUrl)) continue;
                if (s.excludeMatches && matches(s.excludeMatches, pageUrl))
                    continue;
                if (s.id) _injectedScriptIds.add(s.id);
                for (const jsEntry of s.js) {
                    try {
                        if (jsEntry.code) {
                            const targetWin = window as unknown as Record<
                                string,
                                unknown
                            >;

                            // Get the native eval saved before Scramjet runs.
                            const nativeEval = targetWin.__civilNativeEval as
                                | ((code: string) => unknown)
                                | undefined;

                            // Combined preamble: patch eval/Function to native
                            // (so TM's runner doesn't go through Scramjet's
                            // rewriter), rewrite Scramjet proxy URLs in
                            // sendMessage calls, and expose real page URL.
                            // Both MAIN and USER_SCRIPT worlds run in the same
                            // window (Scramjet proxy iframe), so window.postMessage
                            // between them works without any bridge.
                            const _preamble = (function buildPreamble(
                                realUrl: string,
                            ): string {
                                const safeUrl = JSON.stringify(realUrl);
                                return `(function(){
try {
  var __nEv=window.__civilNativeEval;
  if(__nEv){
    try{Object.defineProperty(window,'eval',{value:__nEv,writable:true,configurable:true});}catch(_){window.eval=__nEv;}
    try{
      var __nFn=__nEv('(function(){return Function})')();
      Object.defineProperty(window,'Function',{value:__nFn,writable:true,configurable:true});
    }catch(_){}
  }
  var __cRealUrl=${safeUrl};
  // window.location cannot be redefined (non-configurable) on the real
  // window, and our nativeEval injection bypasses Scramjet's location
  // proxy, so TM's USER_SCRIPT-world code reads the raw proxy URL. We can't
  // fix the global; instead we expose the real URL + a fake Location object
  // on window, and string-patch each injected script's location reads to
  // prefer window.__cRealUrl (see patchUserScriptLocation in the content
  // injector). The TM tm_scripts populator gates each @match on
  // window.location.href, so without this it skips every script.
  window.__cRealUrl=__cRealUrl;
  try{
    var __cU=new URL(__cRealUrl);
    var __cFakeLoc={
      href:__cU.href,protocol:__cU.protocol,host:__cU.host,
      hostname:__cU.hostname,port:__cU.port,pathname:__cU.pathname,
      search:__cU.search,hash:__cU.hash,origin:__cU.origin,
      toString:function(){return __cU.href;},
      assign:function(x){return window.location.assign(x);},
      replace:function(x){return window.location.replace(x);},
      reload:function(){return window.location.reload();}
    };
    window.__cFakeLoc=__cFakeLoc;
  }catch(_){}
  var __cRe=/^\\/~\\/(scramjet|uv)\\//;
  var __cReAbs=new RegExp('^https?:\\/\\/[^/]+\\/~\\/(scramjet|uv)\\/');
  function __cRewrite(obj) {
    if(!obj||typeof obj!=='object') return obj;
    var o={};
    var ks=Object.keys(obj);
    for(var i=0;i<ks.length;i++){
      var k=ks[i],v=obj[k];
      if(typeof v==='string'&&(__cRe.test(v)||__cReAbs.test(v))){o[k]=__cRealUrl;}
      else if(v&&typeof v==='object'&&!Array.isArray(v)){o[k]=__cRewrite(v);}
      else{o[k]=v;}
    }
    return o;
  }
  var __cChr=window.chrome;
  if(__cChr&&__cChr.runtime){
    if(__cChr.runtime.sendMessage){
      var __cOrig=__cChr.runtime.sendMessage.bind(__cChr.runtime);
      __cChr.runtime.sendMessage=function(){
        var a=Array.prototype.slice.call(arguments);
        if(typeof a[0]==='object'&&a[0]!==null){a[0]=__cRewrite(a[0]);}
        else if(typeof a[0]==='string'&&a[1]&&typeof a[1]==='object'){a[1]=__cRewrite(a[1]);}
        return __cOrig.apply(__cChr.runtime,a);
      };
    }
    if(__cChr.runtime.connect){
      var __cConnOrig=__cChr.runtime.connect.bind(__cChr.runtime);
      __cChr.runtime.connect=function(){
        var port=__cConnOrig.apply(__cChr.runtime,arguments);
        if(port&&port.postMessage){
          var __cPMOrig=port.postMessage.bind(port);
          port.postMessage=function(msg){
            if(msg&&typeof msg==='object') msg=__cRewrite(msg);
            return __cPMOrig(msg);
          };
        }
        return port;
      };
    }
  }
} catch(_){}
})();`;
                            })(pageUrl);
                            // window.location can't be redefined and nativeEval
                            // bypasses Scramjet's location proxy, so TM's
                            // injected USER_SCRIPT code would read the raw
                            // proxy URL. Rewrite its location reads to prefer
                            // window.__cRealUrl (set in the preamble).
                            const _injectCode = patchUserScriptLocation(
                                jsEntry.code,
                            );
                            if (nativeEval) {
                                // nativeEval is a stored reference, not the
                                // eval keyword, so calling it is always an
                                // indirect eval → global scope.
                                nativeEval(_preamble);
                                nativeEval(_injectCode);
                            } else {
                                try {
                                    // Assign to variable = indirect eval →
                                    // global scope (not handler's scope).
                                    // oxlint-disable-next-line no-eval -- global-scope evaluation is the emulated API's contract
                                    const _ieval = eval;
                                    _ieval(_preamble + ";" + _injectCode);
                                } catch {
                                    // eslint-disable-next-line no-new-func
                                    new Function(
                                        _preamble + ";" + _injectCode,
                                    )();
                                }
                            }
                        } else if (jsEntry.file) {
                            const el = document.createElement("script");
                            el.type = "text/javascript";
                            el.src = jsEntry.file.startsWith("http")
                                ? jsEntry.file
                                : extUrl(extId, jsEntry.file);
                            (
                                document.head ?? document.documentElement
                            ).appendChild(el);
                        }
                    } catch (err) {
                        console.warn(
                            `[civil-ext:content:${extId}] userScript inject error:`,
                            err,
                        );
                    }
                }
            }
            // Direct-exec fallback. TM's page.js delivers @grant-none bodies
            // through a blob-URL <script> vault; the page's CSP (e.g. Google)
            // blocks blob: scripts under Scramjet, so the body silently never
            // runs even though the handshake completes. tm_scripts is already
            // built AND URL-gated by the populator (only matching scripts are
            // present), and each entry.code is the bare userscript source
            // (mkCompat does text-only transforms, no function wrapper), so we
            // eval matching bodies directly in the page context here, skipping
            // the Scramjet-hostile vault entirely.
            try {
                const _w2 = window as unknown as Record<string, unknown>;
                if (!_w2.__civilDirectExec) {
                    _w2.__civilDirectExec = true;
                    const _ran = new Set<string>();
                    // Accumulated across ticks so the running-report can be
                    // re-sent even after a uuid stops being "newly executed".
                    const _reported: Record<string, string> = {};
                    const _nativeEval2 = _w2.__civilNativeEval as
                        | ((c: string) => unknown)
                        | undefined;
                    const _runEntries = () => {
                        const ts = _w2.tm_scripts as
                            | Record<
                                  string,
                                  {
                                      entry?: {
                                          code?: string;
                                          script?: { name?: string };
                                      };
                                  }
                              >
                            | undefined;
                        if (!ts) return;
                        for (const [uuid, rec] of Object.entries(ts)) {
                            if (_ran.has(uuid)) continue;
                            const code = rec?.entry?.code;
                            if (typeof code !== "string" || !code) continue;
                            _ran.add(uuid);
                            const patched = patchUserScriptLocation(code);
                            try {
                                if (_nativeEval2) _nativeEval2(patched);
                                // oxlint-disable-next-line no-eval -- global-scope evaluation is the emulated API's contract
                                else (0, eval)(patched);
                                _reported[uuid] =
                                    rec?.entry?.script?.name ?? uuid;
                            } catch (err) {
                                console.warn(
                                    `[civil-ext:content:${extId}] direct-exec error uuid=${uuid}:`,
                                    err,
                                );
                            }
                        }
                        // Report executed scripts to TM's background so the
                        // popup/badge reflect them. page.js normally sends this
                        // "prepare" cleanup message after injecting; since we
                        // bypass its vault, emit it ourselves. The background
                        // handler records each uuid as executed+active (Oh) and
                        // refreshes the badge. Re-sent every tick (not just when
                        // a script is newly executed): the message rides the
                        // BroadcastChannel bus, which has no buffering, so on a
                        // full app reload the background may not be listening yet
                        // when scripts first run. prepare/cleanup is idempotent
                        // (Oh dedups per uuid), so repeated sends are harmless
                        // and guarantee delivery once the background warms up.
                        if (Object.keys(_reported).length) {
                            try {
                                chrome.runtime.sendMessage({
                                    method: "prepare",
                                    cleanup: true,
                                    url:
                                        bib.currentTab?.url ??
                                        String(_w2.__cRealUrl),
                                    scripts: { ..._reported },
                                });
                            } catch (err) {
                                console.warn(
                                    `[civil-ext:content:${extId}] direct-exec running-report failed:`,
                                    err,
                                );
                            }
                        }
                    };
                    let _tries = 0;
                    const _poll = () => {
                        _runEntries();
                        if (++_tries < 50) setTimeout(_poll, 150);
                    };
                    setTimeout(_poll, 200);
                }
            } catch {}
        });
        // Announce this content page is ready. Background replays any
        // userScripts registered before this shim was injected.
        _contentBus.postMessage({ kind: "contentReady" });
    }
})();

function buildNoopNamespace(): Record<string, unknown> {
    return {};
}

function buildDNRStub() {
    const noop2 = (_a?: unknown, _b?: unknown, cb?: () => void) => {
        if (cb) cb();
        return Promise.resolve();
    };
    return {
        updateDynamicRules: noop2,
        getDynamicRules: (_a?: unknown, cb?: (r: unknown[]) => void) => {
            if (cb) cb([]);
            return Promise.resolve([]);
        },
        updateSessionRules: noop2,
        getSessionRules: (_a?: unknown, cb?: (r: unknown[]) => void) => {
            if (cb) cb([]);
            return Promise.resolve([]);
        },
        updateEnabledRulesets: noop2,
        getEnabledRulesets: (cb?: (r: string[]) => void) => {
            if (cb) cb([]);
            return Promise.resolve([]);
        },
        getAvailableStaticRuleCount: (cb?: (n: number) => void) => {
            if (cb) cb(0);
            return Promise.resolve(0);
        },
        isRegexSupported: (
            _o: unknown,
            cb?: (r: { isSupported: boolean }) => void,
        ) => {
            if (cb) cb({ isSupported: true });
            return Promise.resolve({ isSupported: true });
        },
        onRuleMatchedDebug: {
            addListener() {},
            removeListener() {},
            hasListener() {
                return false;
            },
            hasListeners() {
                return false;
            },
        },
    };
}
