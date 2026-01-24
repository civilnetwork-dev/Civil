import EventEmitter from "eventemitter3";
//@ts-expect-error
import { Filer } from "filer";
import type {
  ContentScriptInjectorEvents,
  InjectionStats,
  ProxyInjectionResult,
  TransformMetadata,
} from "~/types/extensions";

interface ProxyClient {
  name: string;
  injectScript: (code: string, matches: string[]) => Promise<void>;
}

const allHostsRegexp =
  /^(?:(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])$/;

export class ContentScriptInjector extends EventEmitter<ContentScriptInjectorEvents> {
  private fs: Filer;
  private proxyClients: Map<string, ProxyClient>;

  constructor() {
    super();
    this.fs = new Filer();
    this.proxyClients = new Map();

    this.setupProxyClients();
  }
}
