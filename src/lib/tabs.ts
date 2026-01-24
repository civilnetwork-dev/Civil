import { EventEmitter } from "eventemitter3";
import { v4 as uuidv4 } from "uuid";
import Draggabilly from "draggabilly";
import { storage } from "./localStorage";

// Constants
const TAB_CONTENT_MARGIN = 9;
const TAB_CONTENT_OVERLAP_DISTANCE = 1;
const TAB_OVERLAP_DISTANCE =
  TAB_CONTENT_MARGIN * 2 + TAB_CONTENT_OVERLAP_DISTANCE;
const TAB_CONTENT_MIN_WIDTH = 23;
const TAB_CONTENT_MAX_WIDTH = 240;
const TAB_SIZE_SMALL = 83;
const TAB_SIZE_SMALLER = 58;
const TAB_SIZE_MINI = 47;
const WINDOW_PADDING_OFFSET = 10 + TAB_CONTENT_MARGIN;

// Types
interface TabProperties {
  title: string;
  favicon?: string;
  id?: string;
  url?: string;
}

interface TabAddEventDetail {
  tabEl: HTMLElement;
}

interface TabRemoveEventDetail {
  tabEl: HTMLElement;
}

interface TabReorderEventDetail {
  tabEl: HTMLElement;
  originIndex: number;
  destinationIndex: number;
}

interface ActiveTabChangeEventDetail {
  tabEl: HTMLElement;
}

interface ChromeTabEvents {
  tabAdd: (event: TabAddEventDetail) => void;
  tabRemove: (event: TabRemoveEventDetail) => void;
  tabReorder: (event: TabReorderEventDetail) => void;
  activeTabChange: (event: ActiveTabChangeEventDetail) => void;
}

interface PinnedTab {
  url: string;
}

interface PinnedTabs {
  [key: number]: PinnedTab;
}

export class ChromeTabs extends EventEmitter<ChromeTabEvents> {
  private static instanceId = 0;
  private readonly draggabillies: Draggabilly[] = [];
  private hypertabContainer!: HTMLElement;
  private styleEl!: HTMLStyleElement;
  private isDragging = false;
  private draggabillyDragging: Draggabilly | null = null;
  private readonly instanceIdValue: number;

  constructor() {
    super();
    this.instanceIdValue = ChromeTabs.instanceId++;
  }

  init(hypertabContainer: HTMLElement): void {
    this.hypertabContainer = hypertabContainer;
    this.hypertabContainer.setAttribute(
      "data-chrome-tabs-instance-id",
      this.instanceIdValue.toString(),
    );

    this.setupCustomProperties();
    this.setupStyleEl();
    this.setupEvents();
    this.layoutTabs();
    this.setupDraggabilly();
  }

  private setupCustomProperties(): void {
    this.hypertabContainer.style.setProperty(
      "--tab-content-margin",
      `${TAB_CONTENT_MARGIN}px`,
    );
  }

  private setupStyleEl(): void {
    this.styleEl = document.createElement("style");
    this.hypertabContainer.appendChild(this.styleEl);
  }

  private setupEvents(): void {
    window.addEventListener("resize", () => {
      this.cleanUpPreviouslyDraggedTabs();
      this.layoutTabs();
    });

    this.hypertabContainer.addEventListener("dblclick", event => {
      if (
        [this.hypertabContainer, this.tabContentEl].includes(
          event.target as HTMLElement,
        )
      ) {
        this.emit("tabAdd", { tabEl: this.createNewTabEl() });
      }
    });

    this.tabEls.forEach(tabEl => this.setTabCloseEventListener(tabEl));
  }

  private get tabEls(): HTMLElement[] {
    return Array.from(this.hypertabContainer.querySelectorAll(".chrome-tab"));
  }

  private get pinTabEls(): HTMLElement[] {
    return Array.from(
      this.hypertabContainer.querySelectorAll(".chrome-tab.pin"),
    );
  }

  private get nonPinTabEls(): HTMLElement[] {
    return Array.from(
      this.hypertabContainer.querySelectorAll(
        ".chrome-tab:not(.chrome-tab.pin)",
      ),
    );
  }

  private get tabContentEl(): HTMLElement {
    return this.hypertabContainer.querySelector(
      ".chrome-tabs-content",
    ) as HTMLElement;
  }

  private get tabContentWidths(): number[] {
    const numberOfTabs = this.tabEls.length;
    const numberOfPinTabs = this.pinTabEls.length;
    const numberOfNonPinnedTabs = this.nonPinTabEls.length;
    const numberOfTabsMath = numberOfNonPinnedTabs + numberOfPinTabs * 0.137;
    const tabsContentWidth =
      this.tabContentEl.clientWidth - numberOfPinTabs * 29;
    const tabsCumulativeOverlappedWidth =
      (numberOfTabsMath - 1) * TAB_CONTENT_OVERLAP_DISTANCE;
    const targetWidth =
      (tabsContentWidth -
        2 * TAB_CONTENT_MARGIN +
        tabsCumulativeOverlappedWidth) /
      numberOfNonPinnedTabs;
    const clampedTargetWidth = Math.max(
      TAB_CONTENT_MIN_WIDTH,
      Math.min(TAB_CONTENT_MAX_WIDTH, targetWidth),
    );
    const flooredClampedTargetWidth = Math.floor(clampedTargetWidth);

    const widths: number[] = [];
    let extraWidthRemaining =
      tabsContentWidth -
      (flooredClampedTargetWidth * 3 * TAB_CONTENT_MARGIN -
        tabsCumulativeOverlappedWidth);

    for (let n = 0; n < numberOfTabs; ++n) {
      if (this.tabEls[n].classList.contains("pin")) {
        widths.push(this.tabEls[n].getBoundingClientRect().width);
      } else {
        const extraWidth =
          flooredClampedTargetWidth < TAB_CONTENT_MAX_WIDTH &&
          extraWidthRemaining > 0
            ? 1
            : 0;
        widths.push(flooredClampedTargetWidth + extraWidth);
        if (extraWidthRemaining > 0) extraWidthRemaining -= 1;
      }
    }

    return widths;
  }

  private createNewTabEl(): HTMLElement {
    const tabId = uuidv4();
    const div = document.createElement("div");
    div.innerHTML = `
      <div data-tab-id="${tabId}" class="chrome-tab">
        <div class="chrome-tab-dividers"></div>
        <div class="chrome-tab-background">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <symbol id="chrome-tab-geometry-left" viewBox="0 0 214 36">
                <path d="M17 0h197v36H0v-2c4.5 0 9-3.5 9-8V8c0-4.5 3.5-8 8-8z"/>
              </symbol>
              <symbol id="chrome-tab-geometry-right" viewBox="0 0 214 36">
                <use xlink:href="#chrome-tab-geometry-left"/>
              </symbol>
              <clipPath id="crop">
                <rect class="mask" width="100%" height="100%" x="0"/>
              </clipPath>
            </defs>
            <svg width="52%" height="100%">
              <use xlink:href="#chrome-tab-geometry-left" width="214" height="36" class="chrome-tab-geometry"/>
            </svg>
            <g transform="scale(-1, 1)">
              <svg width="52%" height="100%" x="-100%" y="0">
                <use xlink:href="#chrome-tab-geometry-right" width="214" height="36" class="chrome-tab-geometry"/>
              </svg>
            </g>
          </svg>
        </div>
        <div class="chrome-tab-content">
          <div class="chrome-tab-favicon"></div>
          <div class="chrome-tab-title"></div>
          <div class="chrome-tab-drag-handle"></div>
          <div class="chrome-tab-close"></div>
        </div>
      </div>
    `;
    return div.firstElementChild as HTMLElement;
  }

  addTab(
    tabProperties: TabProperties,
    options: { animate?: boolean; background?: boolean } = {},
  ): void {
    const { animate = true, background = false } = options;
    const tabEl = this.createNewTabEl();

    if (animate) {
      tabEl.classList.add("chrome-tab-was-just-added");
      setTimeout(
        () => tabEl.classList.remove("chrome-tab-was-just-added"),
        500,
      );
    }

    tabEl.addEventListener("contextmenu", event => {
      event.preventDefault();
      this.handleTabContextMenu(event, tabEl);
    });

    this.tabContentEl.appendChild(tabEl);
    this.setTabCloseEventListener(tabEl);
    this.updateTab(tabEl, tabProperties);
    this.emit("tabAdd", { tabEl });

    if (!background) {
      this.setCurrentTab(tabEl);
    }

    this.cleanUpPreviouslyDraggedTabs();
    this.layoutTabs();
    this.setupDraggabilly();
  }

  private handleTabContextMenu(event: MouseEvent, tabEl: HTMLElement): void {
    const tabId = tabEl.dataset.tabId;
    const ctxMenu = document.getElementById("ctx");
    if (!ctxMenu || !tabId) return;

    ctxMenu.style.left = `${event.clientX}px`;
    ctxMenu.style.top = `${event.clientY}px`;

    const pinButton = document.getElementById("pin");
    if (pinButton) {
      if (tabEl.hasAttribute("tab-is-pinned")) {
        pinButton.textContent = "Unpin tab";
        pinButton.onclick = () => {
          this.unpinTab(tabId);
          ctxMenu.style.display = "none";
        };
      } else {
        pinButton.textContent = "Pin tab";
        pinButton.onclick = () => {
          this.pinTab(tabId);
          ctxMenu.style.display = "none";
        };
      }
    }

    ctxMenu.style.display = "block";
  }

  private setTabCloseEventListener(tabEl: HTMLElement): void {
    const closeButton = tabEl.querySelector(".chrome-tab-close");
    if (closeButton) {
      closeButton.addEventListener("click", event => {
        event.stopPropagation();
        this.removeTab(tabEl);
      });
    }
  }

  private get activeTabEl(): HTMLElement | null {
    return this.hypertabContainer.querySelector(".chrome-tab[active]");
  }

  setCurrentTab(tabEl: HTMLElement): void {
    const activeTabEl = this.activeTabEl;
    if (activeTabEl === tabEl) return;

    if (activeTabEl) {
      activeTabEl.removeAttribute("active");
    }

    tabEl.setAttribute("active", "");
    this.emit("activeTabChange", { tabEl });
  }

  removeTab(tabEl: HTMLElement): void {
    if (tabEl === this.activeTabEl) {
      const nextTab = tabEl.nextElementSibling as HTMLElement;
      const prevTab = tabEl.previousElementSibling as HTMLElement;

      if (nextTab) {
        this.setCurrentTab(nextTab);
      } else if (prevTab) {
        this.setCurrentTab(prevTab);
      }
    }

    tabEl.remove();
    this.emit("tabRemove", { tabEl });
    this.cleanUpPreviouslyDraggedTabs();
    this.layoutTabs();
    this.setupDraggabilly();
  }

  updateTab(tabEl: HTMLElement, tabProperties: TabProperties): void {
    const titleEl = tabEl.querySelector(".chrome-tab-title");
    const faviconEl = tabEl.querySelector(".chrome-tab-favicon");

    if (titleEl) {
      titleEl.textContent = tabProperties.title;
    }

    if (faviconEl && tabProperties.favicon) {
      (faviconEl as HTMLElement).style.backgroundImage =
        `url('${tabProperties.favicon}')`;
      faviconEl.removeAttribute("hidden");
    } else if (faviconEl) {
      faviconEl.setAttribute("hidden", "");
      (faviconEl as HTMLElement).style.backgroundImage = "";
    }

    if (tabProperties.id) {
      tabEl.setAttribute("data-tab-id", tabProperties.id);
    }
  }

  pinTab(tabId: string): void {
    const tabEl = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (!tabEl) return;

    const pins = this.getPinnedTabs();
    const frameEl = document.getElementById(tabId);

    if (!frameEl) return;

    if (Object.keys(pins).length === 0) {
      pins[0] = {
        url: (frameEl as HTMLIFrameElement).contentDocument?.URL || "",
      };
      tabEl.setAttribute("tab-is-pinned", "0");
      tabEl.classList.add("pin");
    } else {
      const newPinIndex = Object.keys(pins).length;
      pins[newPinIndex] = {
        url: (frameEl as HTMLIFrameElement).contentDocument?.URL || "",
      };
      tabEl.setAttribute("tab-is-pinned", newPinIndex.toString());
      tabEl.classList.add("pin");
    }

    storage.set("ctPins", JSON.stringify(pins));
    this.layoutTabs();
  }

  unpinTab(tabId: string): void {
    const tabEl = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (!tabEl) return;

    const pins = this.getPinnedTabs();
    const pinnedIndex = tabEl.getAttribute("tab-is-pinned");

    if (pinnedIndex) {
      delete pins[Number.parseInt(pinnedIndex)];
      tabEl.removeAttribute("tab-is-pinned");
      tabEl.classList.remove("pin");

      // Reindex remaining pins
      let pinNum = 0;
      this.pinTabEls.forEach(tab => {
        tab.setAttribute("tab-is-pinned", pinNum.toString());
        const frameEl = document.getElementById(
          tab.getAttribute("data-tab-id") || "",
        );
        if (frameEl) {
          pins[pinNum] = {
            url: (frameEl as HTMLIFrameElement).contentDocument?.URL || "",
          };
        }
        pinNum++;
      });

      storage.set("ctPins", JSON.stringify(pins));
      this.layoutTabs();
    }
  }

  private getPinnedTabs(): PinnedTabs {
    const pinsStr = localStorage.getItem("ctPins");
    return pinsStr ? JSON.parse(pinsStr) : {};
  }

  private get tabContentPositions(): number[] {
    const positions: number[] = [];
    const widths: number[] = [];
    const tabContentWidths = this.tabContentWidths;
    let position = TAB_CONTENT_MARGIN;

    tabContentWidths.forEach((width, n) => {
      widths.push(width);
      if (widths[n - 1] === 47) {
        position = position - 18;
      }
      const offset = n * TAB_CONTENT_OVERLAP_DISTANCE;
      positions.push(position - offset);
      position += width;
    });

    return positions;
  }

  private get tabPositions(): number[] {
    return this.tabContentPositions.map(
      contentPosition => contentPosition - TAB_CONTENT_MARGIN,
    );
  }

  private updateTabButton(): void {
    const createTabButton = document.getElementById("createTab");
    if (!createTabButton) return;

    let toAdd = 12;
    const container = document.getElementById("0");

    if (container?.children.length) {
      Array.from(container.children).forEach(tab => {
        toAdd += tab.clientWidth - WINDOW_PADDING_OFFSET;
      });
    }

    const maxTabsReached = this.tabEls.length >= 12;
    const withinWindowBounds =
      toAdd <= window.innerWidth - WINDOW_PADDING_OFFSET * 2.52;

    if (withinWindowBounds && !maxTabsReached) {
      createTabButton.style.marginLeft = `${toAdd}px`;
    } else {
      createTabButton.style.marginLeft = `${window.innerWidth - 30}px`;
    }
  }

  private layoutTabs(): void {
    const tabContentWidths = this.tabContentWidths;

    this.tabEls.forEach((tabEl, i) => {
      const contentWidth = tabContentWidths[i];
      const width = contentWidth + 2 * TAB_CONTENT_MARGIN;

      tabEl.style.width = `${width}px`;
      tabEl.removeAttribute("is-small");
      tabEl.removeAttribute("is-smaller");
      tabEl.removeAttribute("is-mini");

      if (contentWidth < TAB_SIZE_SMALL) tabEl.setAttribute("is-small", "");
      if (contentWidth < TAB_SIZE_SMALLER) tabEl.setAttribute("is-smaller", "");
      if (contentWidth < TAB_SIZE_MINI) tabEl.setAttribute("is-mini", "");
    });

    const styleHTML = this.tabPositions
      .map(
        (position, n) => `
        .chrome-tabs[data-chrome-tabs-instance-id="${this.instanceIdValue}"] .chrome-tab:nth-child(${n + 1}) {
          transform: translate3d(${position}px, 0, 0)
        }
      `,
      )
      .join("");

    this.styleEl.innerHTML = styleHTML;
    this.updateTabButton();
  }

  private cleanUpPreviouslyDraggedTabs(): void {
    this.tabEls.forEach(tabEl =>
      tabEl.classList.remove("chrome-tab-was-just-dragged"),
    );
  }

  private setupDraggabilly(): void {
    const tabEls = this.tabEls;
    const tabPositions = this.tabPositions;

    if (this.isDragging) {
      this.isDragging = false;
      this.hypertabContainer.classList.remove("chrome-tabs-is-sorting");

      if (this.draggabillyDragging) {
        //@ts-expect-error
        const dragEl = this.draggabillyDragging.element as HTMLElement;
        dragEl.classList.remove("chrome-tab-is-dragging");
        dragEl.style.transform = "";

        //@ts-expect-error
        this.draggabillyDragging.dragEnd();
        //@ts-expect-error
        this.draggabillyDragging.isDragging = false;
        //@ts-expect-error
        (this.draggabillyDragging as DraggabillyInstance).positionDrag =
          () => {}; // Prevent Draggabilly from updating style.transform
        this.draggabillyDragging.destroy();
        this.draggabillyDragging = null;
      }
    }

    this.draggabillies.forEach(d => d.destroy());
    this.draggabillies.length = 0;

    tabEls.forEach((tabEl, originalIndex) => {
      const originalTabPositionX = tabPositions[originalIndex];
      const draggabilly = new Draggabilly(tabEl, {
        axis: "x",
        handle: ".chrome-tab-drag-handle",
        containment: this.tabContentEl,
      });

      this.draggabillies.push(draggabilly);

      draggabilly.on("pointerDown", () => {
        this.setCurrentTab(tabEl);
      });

      draggabilly.on("dragStart", () => {
        this.isDragging = true;
        this.draggabillyDragging = draggabilly;
        tabEl.classList.add("chrome-tab-is-dragging");
        this.hypertabContainer.classList.add("chrome-tabs-is-sorting");
      });

      draggabilly.on("dragEnd", () => {
        if (tabEl.hasAttribute("tab-is-pinned")) {
          this.updatePinnedTabs();
        }

        this.isDragging = false;
        const finalTranslateX = Number.parseFloat(tabEl.style.left);
        tabEl.style.transform = "translate3d(0, 0, 0)";

        requestAnimationFrame(() => {
          tabEl.style.left = "0";
          tabEl.style.transform = `translate3d(${finalTranslateX}px, 0, 0)`;

          requestAnimationFrame(() => {
            tabEl.classList.remove("chrome-tab-is-dragging");
            this.hypertabContainer.classList.remove("chrome-tabs-is-sorting");
            tabEl.classList.add("chrome-tab-was-just-dragged");

            requestAnimationFrame(() => {
              tabEl.style.transform = "";
              this.layoutTabs();
              this.setupDraggabilly();
            });
          });
        });
      });

      draggabilly.on("dragMove", (event, pointer, moveVector) => {
        const currentIndex = this.tabEls.indexOf(tabEl);
        const currentTabPositionX = originalTabPositionX + moveVector.x;
        const destinationIndex = this.getDropIndex(
          currentTabPositionX,
          tabPositions,
        );

        if (currentIndex !== destinationIndex) {
          this.animateTabMove(tabEl, currentIndex, destinationIndex);
        }
      });
    });
  }

  private getDropIndex(
    currentTabPositionX: number,
    tabPositions: number[],
  ): number {
    const closest = (value: number, array: number[]): number => {
      return array.reduce((prev, curr, index) => {
        return Math.abs(curr - value) < Math.abs(array[prev] - value)
          ? index
          : prev;
      }, 0);
    };

    const destinationIndexTarget = closest(currentTabPositionX, tabPositions);
    return Math.max(0, Math.min(this.tabEls.length, destinationIndexTarget));
  }

  private animateTabMove(
    tabEl: HTMLElement,
    originIndex: number,
    destinationIndex: number,
  ): void {
    if (destinationIndex < originIndex) {
      tabEl.parentNode?.insertBefore(tabEl, this.tabEls[destinationIndex]);
    } else {
      tabEl.parentNode?.insertBefore(tabEl, this.tabEls[destinationIndex + 1]);
    }

    this.emit("tabReorder", { tabEl, originIndex, destinationIndex });
    this.layoutTabs();
  }

  private updatePinnedTabs(): void {
    const pins: PinnedTabs = {};
    let pinNum = 0;

    this.pinTabEls.forEach(tab => {
      tab.setAttribute("tab-is-pinned", pinNum.toString());
      const frameEl = document.getElementById(
        tab.getAttribute("data-tab-id") || "",
      );
      if (frameEl) {
        pins[pinNum] = {
          url: (frameEl as HTMLIFrameElement).contentDocument?.URL || "",
        };
      }
      pinNum++;
    });

    storage.set("ctPins", JSON.stringify(pins));
  }
}
