import { storage } from "./localStorage";
import { Proxies } from "./encodeURL";
import { encodeRammerhead } from "./encodeRammerhead";
import { EventEmitter } from "eventemitter3";

/**
 * initializes the browser
 */
export function InitBrowser(
  iframe?: HTMLIFrameElement,
  input?: HTMLInputElement,
) {
  if (iframe && input) {
    new InputHandler(iframe, input);
  } else {
    const area = document.querySelector<HTMLDivElement>(".browse-section")!;
    const iframeElement = area.querySelectorAll(
      "iframe",
    )[0] as HTMLIFrameElement;
    const inputElement = document.querySelector(
      ".url-input",
    ) as HTMLInputElement;
    new InputHandler(iframeElement, inputElement);
  }
}

export interface InputHandlerEvents {
  enter: (url: string) => void;
  error: (error: Error) => void;
}

export class InputHandler extends EventEmitter<InputHandlerEvents> {
  #iframe: HTMLIFrameElement;
  #input: HTMLInputElement;
  #proxies: Proxies;

  constructor(iframe: HTMLIFrameElement, input: HTMLInputElement) {
    super();
    this.#iframe = iframe;
    this.#input = input;
    this.#proxies = new Proxies();

    this.#input.addEventListener("keydown", this.#handleKeydown.bind(this));
  }

  async #handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      const value = this.#input.value;
      const proxy = storage.get("proxy")!;

      try {
        const encodedUrl = await this.#getEncodedUrl(value, proxy);
        this.#iframe.style.setProperty("display", "flex");
        this.#iframe.src = encodedUrl;
        this.emit("enter", encodedUrl);
      } catch (error) {
        this.emit("error", error as Error);
      }
    }
  }

  async #getEncodedUrl(url: string, proxy: string): Promise<string> {
    switch (proxy as "rammerhead" | "meteor" | "scramjet") {
      case "rammerhead":
        return origin + (await encodeRammerhead(this.#formatUrl(url)));
      case "meteor":
        return (
          origin + (await this.#proxies.encodeMeteor(this.#formatUrl(url)))
        );
      case "scramjet":
        return (
          origin + (await this.#proxies.encodeScramjet(this.#formatUrl(url)))
        );
      default:
        return (
          origin + (await this.#proxies.encodeUltraviolet(this.#formatUrl(url)))
        );
    }
  }

  #formatUrl(url: string) {
    return url.startsWith("http://") || url.startsWith("https://")
      ? url
      : `https://www.google.com/search?q=${url}`;
  }
}
