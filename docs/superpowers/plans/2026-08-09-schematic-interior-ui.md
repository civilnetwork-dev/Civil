# Schematic Interior UI — Implementation Plan (Pass 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Civil Proxy's New Tab, Apps, and Filter Checker pages in a "schematic" technical-drawing language on a shared foundation of seven primitives, leaving the browser chrome untouched.

**Architecture:** A new `src/styles/schematic.css.ts` token module supplies rules, ruled fields, registration marks, and a monospace annotation tier. Seven presentational primitives in `src/components/schematic/` consume those tokens and nothing else — no application state. Pages compose primitives. A new `src/components/icons/index.ts` indirection layer maps semantic icon names to `solid-icons` today so a custom set can replace it in one file later.

**Tech Stack:** SolidJS 2.0.0-beta.28, vanilla-extract, TypeScript 6, Vitest 4 + happy-dom, vite-plugin-solid (already a devDependency).

**Spec:** `docs/superpowers/specs/2026-08-09-civil-ui-redesign-design.md`

## Global Constraints

- **No new dependencies.** Not one. Component tests use `render` from `@solidjs/web` (already a dependency), not `@solidjs/testing-library`.
- **Browser chrome is out of scope.** Do not modify `BrowserChrome.tsx`, `SearchBar*`, `BookmarksBar.tsx`, `ui/TabPill.tsx`, `ui/UrlBar.tsx`, `TabSearch.tsx`, `ContextMenu.tsx`, `ExtensionIconBar.tsx`, or their style files.
- **Six pages are out of scope:** bookmarks, history, extensions, benchmarks, ban, baninfo. They must keep compiling and rendering.
- **Do not delete anything from `src/styles/material.css.ts`.** Fourteen files still import it (verified with `grep -rln "material.css" src/`). Slice pages stop *using* `atmosphere`, `edgeLit`, `edgeLitStrong`, and `grainOverlay`; the exports stay until pass 2.
- **`src/styles/layout.css.ts` has exactly three page consumers**, verified with `grep -rln "layout.css" src/`: `AppsPage.tsx`, `ExtensionsPage.tsx`, `HistoryPage.tsx` (plus their own style files). Task 10 migrates `AppsPage`, leaving two after pass 1. Earlier drafts of this plan said six — that was wrong.
- **Icon set and loading animation assets are the user's** and arrive later. `LoadingAnimation.tsx`'s public API must not change.
- **Palette stays Catppuccin Macchiato.** Use `vars.color.*` from `src/styles/theme.css`. No literal hex values in new code.
- **Annotation text uses `vars.color.subtext0` (primary tier) or `vars.color.overlay2` (muted tier). Never `overlay1` or `overlay0`.** Measured on `base`: `overlay0` 3.15:1, `overlay1` 4.14:1 — both fail WCAG AA's 4.5:1 for small text. `overlay2` is 5.29:1 and `subtext0` is 6.62:1, both pass. Annotations are 11px, so AA-small applies. `overlay1` may still be used for decorative rules, ticks and borders, where contrast requirements do not apply — just not for text.
- **No `backdrop-filter`, no `blur()`, no animated `box-shadow`.** Target hardware is low-end Chromebooks. Only `transform`, `opacity`, and `grid-template-rows` animate.
- **Motion tokens come from `material.css.ts`:** `EASE.standard | spring | enter`, `DUR.fast (0.11s) | base (0.18s) | slow (0.28s)`. Do not introduce new durations or easings.
- **Style formatting:** 4-space indent, LF endings. `bun run check` must pass with no fixes applied.
- **Every task ends green:** `bun run check`, `bun run test`, and `bunx tsc --noEmit` must all be clean before the commit step — `tsc` may report only the one pre-existing error inside `node_modules/@terbiumos/tfs`. If any of the three is red, the task is NOT done: do not commit, and report BLOCKED or DONE_WITH_CONCERNS rather than DONE.
- **`JSX` is imported from `@solidjs/web`, never from `solid-js`.** Solid 2.0 moved the namespace. `import type { JSX } from "solid-js"` runs fine under Vitest but fails `tsc` with `TS2305: Module '"solid-js"' has no exported member 'JSX'`. Value imports (`createSignal`, `createUniqueId`, `Show`, `For`) still come from `solid-js`.
- **Never write to a signal synchronously inside an owned scope.** Solid 2.0 throws `[REACTIVE_WRITE_IN_OWNED_SCOPE]`. In tests that use `createRoot`, create signals inside the root callback but perform every mutation *after* it returns. That also mirrors production, where writes arrive from DOM event handlers rather than during render.
- **Boolean `aria-*` values must be explicit strings.** Solid 2.0 treats a boolean as attribute *presence*, so `aria-expanded={open()}` renders as absent when false and `""` when true — never `"false"`/`"true"`. Always write `aria-expanded={open() ? "true" : "false"}` and `aria-hidden={open() ? "false" : "true"}`. Measured, not assumed.
- **After simulating an event in a test, call `flush()` from `solid-js` before asserting.** Solid 2.0 batches writes made outside a computation, so a signal set inside a click or input handler has not reached the DOM when `.click()` returns. Sequence: `el.click(); flush(); expect(...)`. Production is unaffected because components re-render on the following flush anyway.

## Spec deviation, deliberate

Spec §4.3 names a CSS custom property `--civil-font-mono`. This plan exports a TypeScript constant `FONT_MONO` from `schematic.css.ts` instead. Every style in this codebase is authored in TypeScript, so a custom property would add an indirection nothing reads. The stack string is identical.

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `src/styles/schematic.css.ts` | Rules, ruled fields, marks, annotation tier, mono stack, primitive class names |
| `src/components/schematic/Anno.tsx` | Mono annotation text |
| `src/components/schematic/Rule.tsx` | Labelled hairline with optional dimension caps |
| `src/components/schematic/Sheet.tsx` | Page plane: ruled field + registration marks |
| `src/components/schematic/TitleBlock.tsx` | Eyebrow, title, mono meta row |
| `src/components/schematic/Plate.tsx` | Bounded sub-region with corner ticks |
| `src/components/schematic/Unfold.tsx` | Depth-on-demand container |
| `src/components/schematic/Field.tsx` | Labelled input on a hairline |
| `src/components/icons/index.ts` | Semantic icon names → `solid-icons` components |
| `src/components/FilterCheckForm.tsx` | Filter Checker form |
| `src/components/FilterCheckResults.tsx` | Filter Checker results ledger |
| `src/lib/filterCheckVendors.ts` | `FILTER_CONFIGS` and vendor lookup helpers |
| `tests/helpers/renderSolid.ts` | `render` + auto-cleanup helper for component tests |

**Modified:** `vitest.config.ts`, `src/components/NewTabPage.tsx`, `src/components/AppsPage.tsx`, `src/components/FilterCheckPage.tsx`, `src/styles/NewTabPage.css.ts`, `src/styles/AppsPage.css.ts`, `src/styles/FilterCheckPage.css.ts`, 17 files importing `solid-icons`, `DESIGN.md`, `MAINTENANCE.md`.

**Left alone:** `src/styles/layout.css.ts` keeps its exports (six unmigrated pages use `masthead`). `TitleBlock` supersedes it for slice pages only.

---

### Task 1: Schematic token module

**Files:**
- Create: `src/styles/schematic.css.ts`
- Test: `tests/schematic.test.ts`

**Interfaces:**
- Consumes: `vars` from `src/styles/theme.css`; `EASE`, `DUR`, `hairline` from `src/styles/material.css`.
- Produces: `FONT_MONO: string`; `RULE: { hair: string; major: string; accent: string }`; `field(density?: FieldDensity, color?: string): { backgroundImage: string; backgroundSize: string }`; `FieldDensity = "fine" | "base" | "coarse"`; `ANNO` style object; plus the class exports listed in Step 3.

- [ ] **Step 1: Write the failing test**

Create `tests/schematic.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ANNO, field, FONT_MONO, RULE } from "../src/styles/schematic.css";

describe("FONT_MONO", () => {
    it("starts with ui-monospace and ends with the generic family", () => {
        expect(FONT_MONO.startsWith("ui-monospace")).toBe(true);
        expect(FONT_MONO.endsWith("monospace")).toBe(true);
    });
});

describe("field", () => {
    it("defaults to the base 16px density", () => {
        expect(field().backgroundSize).toBe("16px 16px");
    });

    it("maps every named density to its pixel step", () => {
        expect(field("fine").backgroundSize).toBe("8px 8px");
        expect(field("base").backgroundSize).toBe("16px 16px");
        expect(field("coarse").backgroundSize).toBe("32px 32px");
    });

    it("draws two 0.5px gradients so the field is a grid, not stripes", () => {
        const { backgroundImage } = field();
        expect(backgroundImage.match(/linear-gradient/g)).toHaveLength(2);
        expect(backgroundImage).toContain("to right");
        expect(backgroundImage).toContain("to bottom");
        expect(backgroundImage).toContain("0.5px");
    });

    it("accepts a colour override", () => {
        expect(field("base", "red").backgroundImage).toContain("red");
    });
});

describe("RULE", () => {
    it("offers three weights, all distinct", () => {
        const weights = [RULE.hair, RULE.major, RULE.accent];
        expect(new Set(weights).size).toBe(3);
    });
});

describe("ANNO", () => {
    it("is 11px with tabular numerals", () => {
        expect(ANNO.fontSize).toBe("11px");
        expect(ANNO.fontVariantNumeric).toBe("tabular-nums");
    });

    it("uses the mono stack", () => {
        expect(ANNO.fontFamily).toBe(FONT_MONO);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/schematic.test.ts`
Expected: FAIL — `Failed to resolve import "../src/styles/schematic.css"`.

- [ ] **Step 3: Write the implementation**

Create `src/styles/schematic.css.ts`:

```ts
import { style, styleVariants } from "@vanilla-extract/css";
import { DUR, EASE, hairline } from "./material.css";
import { vars } from "./theme.css";

/**
 * Schematic material language.
 *
 * Interior pages read as technical drawings: a hairline ruled field, corner
 * registration marks, labelled dimension rules, and monospace annotations in
 * the margins. Depth comes from rules and alignment, not from simulated light —
 * which is why nothing here uses `atmosphere()` or `edgeLit` from
 * material.css.ts. Those belong to the previous "backlit" metaphor and the two
 * do not coexist on one page.
 *
 * Motion tokens (EASE, DUR) are reused unchanged; there is no reason to churn
 * values the rest of the system already agrees on.
 */

/**
 * System monospace. Zero packages, zero download. Rubik stays the voice of the
 * product; mono carries data — numerals, hostnames, timings, scores, IDs.
 */
export const FONT_MONO =
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/* -------------------------------------------------------------------- */
/* Rules                                                                 */
/* -------------------------------------------------------------------- */

/**
 * Three line weights and nothing else, so a drawing reads as measured rather
 * than arbitrary. `hair` divides, `major` closes a block, `accent` marks the
 * one line that matters on the page.
 */
export const RULE = {
    hair: `0.5px solid ${vars.color.surface0}`,
    major: `1px solid ${vars.color.surface1}`,
    accent: `1px solid ${vars.color.lavender}`,
} as const;

/* -------------------------------------------------------------------- */
/* Ruled field                                                           */
/* -------------------------------------------------------------------- */

const FIELD_DENSITY = { fine: 8, base: 16, coarse: 32 } as const;

export type FieldDensity = keyof typeof FIELD_DENSITY;

/**
 * The ruled grid, as one repeating gradient pair on a single element. Density
 * is a named token rather than a raw number so pages cannot invent off-scale
 * grids.
 */
export function field(
    density: FieldDensity = "base",
    color: string = vars.color.surface0,
) {
    const px = FIELD_DENSITY[density];
    return {
        backgroundImage: `linear-gradient(to right, ${color} 0.5px, transparent 0.5px), linear-gradient(to bottom, ${color} 0.5px, transparent 0.5px)`,
        backgroundSize: `${px}px ${px}px`,
    };
}

/* -------------------------------------------------------------------- */
/* Annotation tier                                                       */
/* -------------------------------------------------------------------- */

/**
 * 11px is the floor of the system, not a target, so it is paired with
 * `subtext0` rather than `overlay1`: overlay1 on base is ~4.0:1 and fails
 * WCAG AA for small text, subtext0 is ~6.6:1.
 */
export const ANNO = {
    fontFamily: FONT_MONO,
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.02em",
    fontVariantNumeric: "tabular-nums",
    color: vars.color.subtext0,
} as const;

export const anno = style({ ...ANNO });

export const annoMuted = style({
    ...ANNO,
    color: vars.color.overlay1,
});

/* -------------------------------------------------------------------- */
/* Sheet + registration marks                                            */
/* -------------------------------------------------------------------- */

export const sheet = style({
    position: "relative",
    minHeight: "100%",
    padding: "44px max(clamp(20px, 5vw, 48px), calc((100% - 1180px) / 2)) 64px",
});

export const sheetField = style({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    opacity: 0.5,
});

export const sheetFieldDensity = styleVariants({
    fine: field("fine"),
    base: field("base"),
    coarse: field("coarse"),
});

const MARK_SIZE = "11px";

export const mark = style({
    position: "absolute",
    width: MARK_SIZE,
    height: MARK_SIZE,
    pointerEvents: "none",
});

export const markCorner = styleVariants({
    tl: {
        top: "14px",
        left: "14px",
        borderTop: RULE.accent,
        borderLeft: RULE.accent,
    },
    tr: {
        top: "14px",
        right: "14px",
        borderTop: RULE.accent,
        borderRight: RULE.accent,
    },
    bl: {
        bottom: "14px",
        left: "14px",
        borderBottom: RULE.accent,
        borderLeft: RULE.accent,
    },
    br: {
        bottom: "14px",
        right: "14px",
        borderBottom: RULE.accent,
        borderRight: RULE.accent,
    },
});

export const sheetBody = style({
    position: "relative",
});

/* -------------------------------------------------------------------- */
/* Title block                                                           */
/* -------------------------------------------------------------------- */

export const titleBlock = style({
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    paddingTop: "8px",
    borderTop: RULE.major,
    marginBottom: "30px",
});

export const titleBlockTop = style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "16px",
});

export const titleBlockEyebrow = style({
    ...ANNO,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    textTransform: "uppercase",
});

export const titleBlockMark = style({
    width: "16px",
    height: "2px",
    background: vars.color.lavender,
    opacity: 0.75,
});

export const titleBlockTitle = style({
    margin: 0,
    fontSize: "clamp(24px, 3.4vw, 31px)",
    fontWeight: 600,
    lineHeight: 1.05,
    letterSpacing: "-0.015em",
    color: vars.color.text,
});

export const titleBlockMeta = style({ ...ANNO });

/* -------------------------------------------------------------------- */
/* Labelled rule                                                         */
/* -------------------------------------------------------------------- */

export const ruleRow = style({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
});

export const ruleLine = style({
    flex: 1,
    height: 0,
    borderTop: RULE.hair,
});

export const ruleLineMajor = style({
    flex: 1,
    height: 0,
    borderTop: RULE.major,
});

export const ruleLabel = style({
    ...ANNO,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
});

export const ruleCap = style({
    width: 0,
    height: "12px",
    borderLeft: RULE.accent,
});

/* -------------------------------------------------------------------- */
/* Plate                                                                 */
/* -------------------------------------------------------------------- */

export const plate = style({
    position: "relative",
    padding: "12px",
});

export const plateTick = style({
    position: "absolute",
    width: "6px",
    height: "6px",
    pointerEvents: "none",
    borderColor: vars.color.surface2,
});

export const plateTickCorner = styleVariants({
    tl: { top: 0, left: 0, borderTopWidth: "1px", borderLeftWidth: "1px", borderTopStyle: "solid", borderLeftStyle: "solid" },
    br: { bottom: 0, right: 0, borderBottomWidth: "1px", borderRightWidth: "1px", borderBottomStyle: "solid", borderRightStyle: "solid" },
});

/* -------------------------------------------------------------------- */
/* Unfold                                                                */
/* -------------------------------------------------------------------- */

export const unfold = style({
    position: "relative",
});

export const unfoldTrigger = style({
    display: "block",
    width: "100%",
    padding: 0,
    background: "none",
    border: "none",
    color: "inherit",
    font: "inherit",
    textAlign: "inherit",
    cursor: "pointer",
});

export const unfoldRegion = style({
    display: "grid",
    gridTemplateRows: "0fr",
    overflow: "hidden",
    transition: `grid-template-rows ${DUR.base} ${EASE.enter}`,
});

export const unfoldRegionOpen = style([
    unfoldRegion,
    { gridTemplateRows: "1fr" },
]);

export const unfoldInner = style({
    minHeight: 0,
    paddingTop: "6px",
    borderTop: RULE.hair,
    marginTop: "6px",
});

/* -------------------------------------------------------------------- */
/* Field (input)                                                         */
/* -------------------------------------------------------------------- */

export const inputRow = style({
    display: "flex",
    alignItems: "baseline",
    gap: "10px",
    paddingBottom: "6px",
    borderBottom: RULE.hair,
    selectors: {
        "&:focus-within": { borderBottomColor: vars.color.lavender },
    },
});

export const inputLabel = style({
    ...ANNO,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    minWidth: "92px",
});

export const inputControl = style({
    flex: 1,
    minWidth: 0,
    background: "none",
    border: "none",
    outline: "none",
    fontFamily: FONT_MONO,
    fontSize: "13px",
    color: vars.color.text,
    "::placeholder": { color: vars.color.overlay0 },
});

export const inputHint = style({
    ...ANNO,
    color: vars.color.red,
    display: "block",
    marginTop: "5px",
});

/** Divider used between ledger rows and inside dense annotation blocks. */
export const divider = style({
    height: 0,
    borderTop: hairline(vars.color.surface0),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test tests/schematic.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Verify nothing else broke**

Run: `bun run check && bun run test`
Expected: Biome reports no fixes applied; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/styles/schematic.css.ts tests/schematic.test.ts
git commit -m "feat(ui): add schematic token module

Rules, ruled fields, registration marks, and an 11px monospace annotation
tier for the interior redesign. Annotation colour is subtext0 rather than
overlay1 because overlay1 on base is ~4.0:1 and fails WCAG AA for small
text.

Field density is a named token (fine/base/coarse) so pages cannot invent
off-scale grids."
```

---

### Task 2: Component test harness

**Files:**
- Modify: `vitest.config.ts`
- Create: `tests/helpers/renderSolid.ts`
- Test: `tests/helpers/renderSolid.test.tsx`

**Interfaces:**
- Consumes: `render` from `@solidjs/web`.
- Produces: `renderSolid(component: () => JSX.Element): { container: HTMLElement; unmount: () => void }`. Every later primitive task uses this.

- [ ] **Step 1: Write the failing test**

Create `tests/helpers/renderSolid.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderSolid } from "./renderSolid";

describe("renderSolid", () => {
    it("mounts a component and exposes its container", () => {
        const { container, unmount } = renderSolid(() => <p>hello</p>);
        expect(container.textContent).toBe("hello");
        unmount();
    });

    it("removes the container from the document on unmount", () => {
        const { container, unmount } = renderSolid(() => <p>bye</p>);
        expect(document.body.contains(container)).toBe(true);
        unmount();
        expect(document.body.contains(container)).toBe(false);
    });

    it("isolates consecutive renders", () => {
        const a = renderSolid(() => <p>first</p>);
        const b = renderSolid(() => <p>second</p>);
        expect(a.container.textContent).toBe("first");
        expect(b.container.textContent).toBe("second");
        a.unmount();
        b.unmount();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/helpers/renderSolid.test.tsx`
Expected: FAIL — no test files matched, because `vitest.config.ts` only includes `*.test.ts`, not `*.test.tsx`.

- [ ] **Step 3: Add JSX support to the test config**

Replace `vitest.config.ts` entirely:

```ts
import { resolve } from "node:path";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

/**
 * Deliberately does NOT reuse vite.config.ts.
 *
 * That config runs the TanStack Router codegen, SolidStart, Nitro, and Biome
 * with `failOnError`, none of which a unit test run needs — and Nitro would try
 * to build a server bundle. Only vite-plugin-solid is shared, because compiling
 * Solid JSX is the one thing component tests genuinely require.
 */
export default defineConfig({
    plugins: [solid()],
    resolve: {
        conditions: ["solid", "browser"],
        alias: {
            "~": resolve(import.meta.dirname, "src"),
            $config: resolve(import.meta.dirname, "misc/config"),
            $tests: resolve(import.meta.dirname, "tests"),
            $wasm: resolve(import.meta.dirname, "config/encoder"),
            "solid-js/web": "@solidjs/web",
            "solid-js/store": "solid-js",
        },
    },
    test: {
        environment: "node",
        include: [
            "tests/**/*.test.ts",
            "tests/**/*.test.tsx",
            "misc/**/*.test.ts",
            "src/**/*.test.ts",
            "src/**/*.test.tsx",
        ],
        setupFiles: ["./tests/setup.ts"],
    },
});
```

The `solid-js/web` and `solid-js/store` aliases mirror `vite.config.ts` — Solid 2.0 beta moved those modules, and without the aliases the primitives resolve a second copy of the reactive runtime.

- [ ] **Step 4: Write the helper**

Create `tests/helpers/renderSolid.ts`:

```ts
import { render } from "@solidjs/web";
import type { JSX } from "@solidjs/web";

/**
 * Mount a Solid component into a detached container for assertions.
 *
 * Exists so component tests need no third-party testing library:
 * `@solidjs/web` is already a dependency and its `render` returns the dispose
 * function, which is all a test needs.
 *
 * Callers must invoke `unmount()`; leaving containers attached leaks DOM
 * between tests and makes `document.body` queries match the wrong render.
 */
export function renderSolid(component: () => JSX.Element): {
    container: HTMLElement;
    unmount: () => void;
} {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const dispose = render(component, container);
    return {
        container,
        unmount: () => {
            dispose();
            container.remove();
        },
    };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test tests/helpers/renderSolid.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Verify the existing suite still runs**

Run: `bun run check && bun run test`
Expected: Biome clean; all previously passing tests still pass (the config change must not drop `misc/**` or `tests/**` coverage).

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts tests/helpers/renderSolid.ts tests/helpers/renderSolid.test.tsx
git commit -m "test: add Solid component test harness

Adds vite-plugin-solid to the Vitest config and a renderSolid helper built
on render() from @solidjs/web, so component tests need no new dependency.

Mirrors vite.config.ts's solid-js/web and solid-js/store aliases; without
them tests resolve a second copy of the reactive runtime and effects from
one copy don't trigger the other."
```

---

### Task 3: Anno and Rule primitives

**Files:**
- Create: `src/components/schematic/Anno.tsx`, `src/components/schematic/Rule.tsx`
- Test: `src/components/schematic/Anno.test.tsx`, `src/components/schematic/Rule.test.tsx`

**Interfaces:**
- Consumes: `anno`, `annoMuted`, `ruleRow`, `ruleLine`, `ruleLineMajor`, `ruleLabel`, `ruleCap` from `~/styles/schematic.css`; `renderSolid` from `$tests/helpers/renderSolid`.
- Produces: `Anno(props: { children: JSX.Element; muted?: boolean; class?: string })`; `Rule(props: { label?: string; weight?: "hair" | "major"; caps?: boolean; class?: string })`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/schematic/Anno.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as s from "~/styles/schematic.css";
import Anno from "./Anno";

describe("Anno", () => {
    it("renders its children", () => {
        const { container, unmount } = renderSolid(() => <Anno>12ms</Anno>);
        expect(container.textContent).toBe("12ms");
        unmount();
    });

    it("uses the annotation class by default", () => {
        const { container, unmount } = renderSolid(() => <Anno>x</Anno>);
        expect(container.firstElementChild?.className).toContain(s.anno);
        unmount();
    });

    it("uses the muted class when asked", () => {
        const { container, unmount } = renderSolid(() => <Anno muted>x</Anno>);
        expect(container.firstElementChild?.className).toContain(s.annoMuted);
        unmount();
    });

    it("appends a caller class", () => {
        const { container, unmount } = renderSolid(() => (
            <Anno class="extra">x</Anno>
        ));
        expect(container.firstElementChild?.className).toContain("extra");
        unmount();
    });
});
```

Create `src/components/schematic/Rule.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as s from "~/styles/schematic.css";
import Rule from "./Rule";

describe("Rule", () => {
    it("renders a label when given one", () => {
        const { container, unmount } = renderSolid(() => <Rule label="add item" />);
        expect(container.textContent).toContain("add item");
        unmount();
    });

    it("renders no text when unlabelled", () => {
        const { container, unmount } = renderSolid(() => <Rule />);
        expect(container.textContent).toBe("");
        unmount();
    });

    it("hides the line itself from assistive tech", () => {
        const { container, unmount } = renderSolid(() => <Rule label="lat" />);
        const line = container.querySelector(`.${s.ruleLine}`);
        expect(line?.getAttribute("aria-hidden")).toBe("true");
        unmount();
    });

    it("uses the major weight when asked", () => {
        const { container, unmount } = renderSolid(() => <Rule weight="major" />);
        expect(container.querySelector(`.${s.ruleLineMajor}`)).not.toBeNull();
        unmount();
    });

    it("renders two dimension caps when caps are requested", () => {
        const { container, unmount } = renderSolid(() => <Rule caps />);
        expect(container.querySelectorAll(`.${s.ruleCap}`)).toHaveLength(2);
        unmount();
    });

    it("renders no caps by default", () => {
        const { container, unmount } = renderSolid(() => <Rule />);
        expect(container.querySelectorAll(`.${s.ruleCap}`)).toHaveLength(0);
        unmount();
    });

    it("marks caps as decorative", () => {
        const { container, unmount } = renderSolid(() => <Rule caps />);
        for (const cap of container.querySelectorAll(`.${s.ruleCap}`)) {
            expect(cap.getAttribute("aria-hidden")).toBe("true");
        }
        unmount();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/components/schematic`
Expected: FAIL — `Failed to resolve import "./Anno"` and `"./Rule"`.

- [ ] **Step 3: Write Anno**

Create `src/components/schematic/Anno.tsx`:

```tsx
import type { JSX } from "@solidjs/web";
import * as s from "~/styles/schematic.css";

/**
 * Monospace annotation — the margin voice of the schematic language.
 *
 * Use for data: numerals, hostnames, timings, scores, IDs, dimensions. Not for
 * prose; Rubik still carries anything a person reads as a sentence.
 */
export default function Anno(props: {
    children: JSX.Element;
    muted?: boolean;
    class?: string;
}) {
    return (
        <span class={[props.muted ? s.annoMuted : s.anno, props.class]}>
            {props.children}
        </span>
    );
}
```

- [ ] **Step 4: Write Rule**

Create `src/components/schematic/Rule.tsx`:

```tsx
import { Show } from "solid-js";
import * as s from "~/styles/schematic.css";

/**
 * A labelled hairline — the signature element of the language.
 *
 * The label sits inline with the line rather than above it, the way a
 * dimension callout does on a drawing, so a section heading costs one row
 * instead of three. `caps` adds the short perpendicular ticks that mark a
 * measured span.
 */
export default function Rule(props: {
    label?: string;
    weight?: "hair" | "major";
    caps?: boolean;
    class?: string;
}) {
    return (
        <div class={[s.ruleRow, props.class]}>
            <Show when={props.label}>
                <span class={s.ruleLabel}>{props.label}</span>
            </Show>
            <Show when={props.caps}>
                <span class={s.ruleCap} aria-hidden="true" />
            </Show>
            <span
                class={props.weight === "major" ? s.ruleLineMajor : s.ruleLine}
                aria-hidden="true"
            />
            <Show when={props.caps}>
                <span class={s.ruleCap} aria-hidden="true" />
            </Show>
        </div>
    );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test src/components/schematic`
Expected: PASS, 11 tests.

- [ ] **Step 6: Verify the suite**

Run: `bun run check && bun run test`
Expected: Biome clean; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/schematic/Anno.tsx src/components/schematic/Rule.tsx src/components/schematic/Anno.test.tsx src/components/schematic/Rule.test.tsx
git commit -m "feat(ui): add Anno and Rule schematic primitives

Anno is the monospace margin voice for data. Rule is the labelled hairline
that replaces section headings — the label sits inline with the line the way
a dimension callout does, so a heading costs one row instead of three.

Lines and dimension caps are aria-hidden; they carry no information a screen
reader needs."
```

---

### Task 4: Sheet and TitleBlock primitives

**Files:**
- Create: `src/components/schematic/Sheet.tsx`, `src/components/schematic/TitleBlock.tsx`
- Test: `src/components/schematic/Sheet.test.tsx`, `src/components/schematic/TitleBlock.test.tsx`

**Interfaces:**
- Consumes: `sheet`, `sheetField`, `sheetFieldDensity`, `sheetBody`, `mark`, `markCorner`, `titleBlock`, `titleBlockTop`, `titleBlockEyebrow`, `titleBlockMark`, `titleBlockTitle`, `titleBlockMeta` from `~/styles/schematic.css`; `FieldDensity` type.
- Produces: `Sheet(props: { children: JSX.Element; density?: FieldDensity; marks?: Corner[]; class?: string })` where `Corner = "tl" | "tr" | "bl" | "br"`; `TitleBlock(props: { eyebrow: string; title: string; meta?: string; actions?: JSX.Element })`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/schematic/Sheet.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as s from "~/styles/schematic.css";
import Sheet from "./Sheet";

describe("Sheet", () => {
    it("renders its children", () => {
        const { container, unmount } = renderSolid(() => (
            <Sheet>
                <p>body</p>
            </Sheet>
        ));
        expect(container.textContent).toContain("body");
        unmount();
    });

    it("marks the ruled field decorative", () => {
        const { container, unmount } = renderSolid(() => <Sheet>x</Sheet>);
        const fieldEl = container.querySelector(`.${s.sheetField}`);
        expect(fieldEl?.getAttribute("aria-hidden")).toBe("true");
        unmount();
    });

    it("defaults to three registration marks, leaving bottom-left for the title block", () => {
        const { container, unmount } = renderSolid(() => <Sheet>x</Sheet>);
        expect(container.querySelectorAll(`.${s.mark}`)).toHaveLength(3);
        expect(container.querySelector(`.${s.markCorner.bl}`)).toBeNull();
        unmount();
    });

    it("renders only the requested marks", () => {
        const { container, unmount } = renderSolid(() => (
            <Sheet marks={["tl"]}>x</Sheet>
        ));
        expect(container.querySelectorAll(`.${s.mark}`)).toHaveLength(1);
        expect(container.querySelector(`.${s.markCorner.tl}`)).not.toBeNull();
        unmount();
    });

    it("marks registration marks decorative", () => {
        const { container, unmount } = renderSolid(() => <Sheet>x</Sheet>);
        for (const m of container.querySelectorAll(`.${s.mark}`)) {
            expect(m.getAttribute("aria-hidden")).toBe("true");
        }
        unmount();
    });

    it("applies the requested field density", () => {
        const { container, unmount } = renderSolid(() => (
            <Sheet density="coarse">x</Sheet>
        ));
        const fieldEl = container.querySelector(`.${s.sheetField}`);
        expect(fieldEl?.className).toContain(s.sheetFieldDensity.coarse);
        unmount();
    });
});
```

Create `src/components/schematic/TitleBlock.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as s from "~/styles/schematic.css";
import TitleBlock from "./TitleBlock";

describe("TitleBlock", () => {
    it("renders eyebrow and title", () => {
        const { container, unmount } = renderSolid(() => (
            <TitleBlock eyebrow="launcher" title="Apps" />
        ));
        expect(container.textContent).toContain("launcher");
        expect(container.textContent).toContain("Apps");
        unmount();
    });

    it("renders the title as the page heading", () => {
        const { container, unmount } = renderSolid(() => (
            <TitleBlock eyebrow="launcher" title="Apps" />
        ));
        expect(container.querySelector("h1")?.textContent).toBe("Apps");
        unmount();
    });

    it("renders meta only when supplied", () => {
        const withMeta = renderSolid(() => (
            <TitleBlock eyebrow="e" title="t" meta="12 pinned" />
        ));
        expect(withMeta.container.textContent).toContain("12 pinned");
        withMeta.unmount();

        const without = renderSolid(() => <TitleBlock eyebrow="e" title="t" />);
        expect(without.container.querySelector(`.${s.titleBlockMeta}`)).toBeNull();
        without.unmount();
    });

    it("renders actions when supplied", () => {
        const { container, unmount } = renderSolid(() => (
            <TitleBlock eyebrow="e" title="t" actions={<button type="button">go</button>} />
        ));
        expect(container.querySelector("button")?.textContent).toBe("go");
        unmount();
    });

    it("marks the index dash decorative", () => {
        const { container, unmount } = renderSolid(() => (
            <TitleBlock eyebrow="e" title="t" />
        ));
        expect(
            container.querySelector(`.${s.titleBlockMark}`)?.getAttribute("aria-hidden"),
        ).toBe("true");
        unmount();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/components/schematic`
Expected: FAIL — `Failed to resolve import "./Sheet"` and `"./TitleBlock"`.

- [ ] **Step 3: Write Sheet**

Create `src/components/schematic/Sheet.tsx`:

```tsx
import type { JSX } from "@solidjs/web";
import { For } from "solid-js";
import type { FieldDensity } from "~/styles/schematic.css";
import * as s from "~/styles/schematic.css";

export type Corner = "tl" | "tr" | "bl" | "br";

/**
 * The page plane every interior surface sits on.
 *
 * Defaults to three registration marks rather than four: bottom-left is where a
 * real drawing puts its title block, so leaving that corner unmarked is what
 * makes the title block read as belonging to the sheet instead of floating on
 * it.
 */
export default function Sheet(props: {
    children: JSX.Element;
    density?: FieldDensity;
    marks?: Corner[];
    class?: string;
}) {
    const marks = () => props.marks ?? (["tl", "tr", "br"] as Corner[]);
    const density = () => props.density ?? "base";

    return (
        <div class={[s.sheet, props.class]}>
            <div
                class={[s.sheetField, s.sheetFieldDensity[density()]]}
                aria-hidden="true"
            />
            <For each={marks()} keyed={false}>
                {corner => (
                    <span
                        class={[s.mark, s.markCorner[corner()]]}
                        aria-hidden="true"
                    />
                )}
            </For>
            <div class={s.sheetBody}>{props.children}</div>
        </div>
    );
}
```

- [ ] **Step 4: Write TitleBlock**

Create `src/components/schematic/TitleBlock.tsx`:

```tsx
import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import * as s from "~/styles/schematic.css";

/**
 * A drawing's title block: what this sheet is, what it's called, and its
 * measured state.
 *
 * Supersedes the `masthead` pattern in layout.css.ts for schematic pages. That
 * module keeps its exports because six unmigrated pages still use it; do not
 * delete it until pass 2.
 */
export default function TitleBlock(props: {
    eyebrow: string;
    title: string;
    meta?: string;
    actions?: JSX.Element;
}) {
    return (
        <header class={s.titleBlock}>
            <div class={s.titleBlockTop}>
                <div>
                    <span class={s.titleBlockEyebrow}>
                        <span class={s.titleBlockMark} aria-hidden="true" />
                        {props.eyebrow}
                    </span>
                    <h1 class={s.titleBlockTitle}>{props.title}</h1>
                </div>
                <Show when={props.meta}>
                    <span class={s.titleBlockMeta}>{props.meta}</span>
                </Show>
                {props.actions}
            </div>
        </header>
    );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test src/components/schematic`
Expected: PASS, 22 tests total across the four primitive test files.

- [ ] **Step 6: Verify the suite**

Run: `bun run check && bun run test`
Expected: Biome clean; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/schematic/Sheet.tsx src/components/schematic/TitleBlock.tsx src/components/schematic/Sheet.test.tsx src/components/schematic/TitleBlock.test.tsx
git commit -m "feat(ui): add Sheet and TitleBlock schematic primitives

Sheet is the page plane: ruled field plus registration marks. It defaults to
three marks, not four — bottom-left is where a drawing puts its title block,
and leaving that corner unmarked is what seats the title block on the sheet.

TitleBlock supersedes layout.css.ts's masthead for schematic pages. That
module keeps its exports; six unmigrated pages still import it."
```

---

### Task 5: Plate primitive

**Files:**
- Create: `src/components/schematic/Plate.tsx`
- Test: `src/components/schematic/Plate.test.tsx`

**Interfaces:**
- Consumes: `plate`, `plateTick`, `plateTickCorner` from `~/styles/schematic.css`.
- Produces: `Plate(props: { children: JSX.Element; ticks?: boolean; class?: string; as?: "div" | "li" })`.

- [ ] **Step 1: Write the failing test**

Create `src/components/schematic/Plate.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as s from "~/styles/schematic.css";
import Plate from "./Plate";

describe("Plate", () => {
    it("renders its children", () => {
        const { container, unmount } = renderSolid(() => (
            <Plate>content</Plate>
        ));
        expect(container.textContent).toContain("content");
        unmount();
    });

    it("renders two corner ticks by default", () => {
        const { container, unmount } = renderSolid(() => <Plate>x</Plate>);
        expect(container.querySelectorAll(`.${s.plateTick}`)).toHaveLength(2);
        unmount();
    });

    it("omits ticks when asked", () => {
        const { container, unmount } = renderSolid(() => (
            <Plate ticks={false}>x</Plate>
        ));
        expect(container.querySelectorAll(`.${s.plateTick}`)).toHaveLength(0);
        unmount();
    });

    it("marks ticks decorative", () => {
        const { container, unmount } = renderSolid(() => <Plate>x</Plate>);
        for (const tick of container.querySelectorAll(`.${s.plateTick}`)) {
            expect(tick.getAttribute("aria-hidden")).toBe("true");
        }
        unmount();
    });

    it("renders a div by default and a list item on request", () => {
        const asDiv = renderSolid(() => <Plate>x</Plate>);
        expect(asDiv.container.firstElementChild?.tagName).toBe("DIV");
        asDiv.unmount();

        const asLi = renderSolid(() => (
            <ul>
                <Plate as="li">x</Plate>
            </ul>
        ));
        expect(asLi.container.querySelector("li")).not.toBeNull();
        asLi.unmount();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/schematic/Plate.test.tsx`
Expected: FAIL — `Failed to resolve import "./Plate"`.

- [ ] **Step 3: Write Plate**

Create `src/components/schematic/Plate.tsx`:

```tsx
import { Dynamic } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import * as s from "~/styles/schematic.css";

/**
 * A bounded region inside a sheet — what a card would be, without the box.
 *
 * Two diagonal corner ticks imply the boundary instead of a four-sided border.
 * That is the whole trick: the region reads as bounded while the page stays
 * mostly empty, which is what lets a dense grid feel calm at rest.
 *
 * `as="li"` exists because grids of plates belong in real lists, and a `div`
 * inside a `ul` is invalid markup that screen readers announce badly.
 */
export default function Plate(props: {
    children: JSX.Element;
    ticks?: boolean;
    class?: string;
    as?: "div" | "li";
}) {
    const ticks = () => props.ticks !== false;

    return (
        <Dynamic component={props.as ?? "div"} class={[s.plate, props.class]}>
            <Show when={ticks()}>
                <span
                    class={[s.plateTick, s.plateTickCorner.tl]}
                    aria-hidden="true"
                />
                <span
                    class={[s.plateTick, s.plateTickCorner.br]}
                    aria-hidden="true"
                />
            </Show>
            {props.children}
        </Dynamic>
    );
}
```

If `Dynamic` is not exported from `@solidjs/web` in this beta, import it from `solid-js` instead; run `bun run check` after the change and use whichever import resolves.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/components/schematic/Plate.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Verify the suite**

Run: `bun run check && bun run test`
Expected: Biome clean; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/schematic/Plate.tsx src/components/schematic/Plate.test.tsx
git commit -m "feat(ui): add Plate schematic primitive

A bounded region without a box: two diagonal corner ticks imply the boundary
so a dense grid stays visually calm. Supports as='li' because grids of plates
belong in real lists rather than divs inside a ul."
```

---

### Task 6: Unfold primitive

This is the accessibility-critical primitive. Depth-on-demand is built entirely on reveal, and reveal excludes keyboard and touch users unless the state machine is explicit.

**Files:**
- Create: `src/components/schematic/Unfold.tsx`
- Test: `src/components/schematic/Unfold.test.tsx`

**Interfaces:**
- Consumes: `unfold`, `unfoldTrigger`, `unfoldRegion`, `unfoldRegionOpen`, `unfoldInner` from `~/styles/schematic.css`.
- Produces: `Unfold(props: { label: string; summary: JSX.Element; children: JSX.Element; class?: string })`.

**State machine.** Three independent inputs, one derived output:

```
pinned  ← toggled by click / Enter / Space on the trigger
hovered ← mouseenter / mouseleave on the container
focused ← focusin / focusout on the container, using relatedTarget
open    = pinned || hovered || focused
```

Focus is tracked on the **container**, not the trigger, and `focusout` only clears it when focus actually left the container. Tracking focus on the trigger with `onBlur` would close the region the moment a keyboard user tabbed into the content it just revealed — the single most common way this pattern is built wrong.

- [ ] **Step 1: Write the failing test**

Create `src/components/schematic/Unfold.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as s from "~/styles/schematic.css";
import Unfold from "./Unfold";

/**
 * Every simulated event is followed by `flush()`. Solid 2.0 batches writes made
 * outside a computation, so a signal set inside a click or focus handler has not
 * reached the DOM when the dispatch call returns.
 */

function mount() {
    return renderSolid(() => (
        <Unfold label="app detail" summary={<span>chess.org</span>}>
            <a href="https://example.com">remove</a>
        </Unfold>
    ));
}

const trigger = (c: HTMLElement) =>
    c.querySelector("button") as HTMLButtonElement;
const region = (c: HTMLElement) =>
    c.querySelector(`.${s.unfoldRegion}`) as HTMLElement;

describe("Unfold", () => {
    it("renders the summary and keeps content in the DOM when collapsed", () => {
        const { container, unmount } = mount();
        expect(container.textContent).toContain("chess.org");
        expect(container.textContent).toContain("remove");
        unmount();
    });

    it("starts collapsed", () => {
        const { container, unmount } = mount();
        expect(trigger(container).getAttribute("aria-expanded")).toBe("false");
        expect(region(container).getAttribute("aria-hidden")).toBe("true");
        unmount();
    });

    it("makes collapsed content inert so it is not tabbable", () => {
        const { container, unmount } = mount();
        expect(region(container).hasAttribute("inert")).toBe(true);
        unmount();
    });

    it("expands on click and collapses on a second click", () => {
        const { container, unmount } = mount();
        trigger(container).click();
        flush();
        expect(trigger(container).getAttribute("aria-expanded")).toBe("true");
        expect(region(container).getAttribute("aria-hidden")).toBe("false");
        expect(region(container).hasAttribute("inert")).toBe(false);

        trigger(container).click();
        flush();
        expect(trigger(container).getAttribute("aria-expanded")).toBe("false");
        unmount();
    });

    it("applies the open class only when expanded", () => {
        const { container, unmount } = mount();
        expect(region(container).className).not.toContain(s.unfoldRegionOpen);
        trigger(container).click();
        flush();
        expect(region(container).className).toContain(s.unfoldRegionOpen);
        unmount();
    });

    it("associates the trigger with the region it controls", () => {
        const { container, unmount } = mount();
        const controls = trigger(container).getAttribute("aria-controls");
        expect(controls).toBeTruthy();
        expect(region(container).id).toBe(controls);
        unmount();
    });

    it("labels the trigger for screen readers", () => {
        const { container, unmount } = mount();
        expect(trigger(container).getAttribute("aria-label")).toBe("app detail");
        unmount();
    });

    it("expands on hover and collapses when the pointer leaves", () => {
        const { container, unmount } = mount();
        const root = container.firstElementChild as HTMLElement;
        root.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
        flush();
        expect(region(container).getAttribute("aria-hidden")).toBe("false");
        root.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
        flush();
        expect(region(container).getAttribute("aria-hidden")).toBe("true");
        unmount();
    });

    it("stays open while focus moves into the revealed content", () => {
        const { container, unmount } = mount();
        const root = container.firstElementChild as HTMLElement;
        const link = container.querySelector("a") as HTMLAnchorElement;

        root.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        flush();
        expect(region(container).getAttribute("aria-hidden")).toBe("false");

        const moveWithin = new FocusEvent("focusout", { bubbles: true });
        Object.defineProperty(moveWithin, "relatedTarget", { value: link });
        root.dispatchEvent(moveWithin);
        flush();
        expect(region(container).getAttribute("aria-hidden")).toBe("false");

        unmount();
    });

    it("collapses when focus leaves the container entirely", () => {
        const { container, unmount } = mount();
        const root = container.firstElementChild as HTMLElement;
        const outside = document.createElement("button");
        document.body.appendChild(outside);

        root.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        flush();
        const moveAway = new FocusEvent("focusout", { bubbles: true });
        Object.defineProperty(moveAway, "relatedTarget", { value: outside });
        root.dispatchEvent(moveAway);
        flush();

        expect(region(container).getAttribute("aria-hidden")).toBe("true");
        outside.remove();
        unmount();
    });

    it("stays open on pointer-leave once pinned by click", () => {
        const { container, unmount } = mount();
        const root = container.firstElementChild as HTMLElement;
        trigger(container).click();
        flush();
        root.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
        flush();
        expect(region(container).getAttribute("aria-hidden")).toBe("false");
        unmount();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/schematic/Unfold.test.tsx`
Expected: FAIL — `Failed to resolve import "./Unfold"`.

- [ ] **Step 3: Write Unfold**

Create `src/components/schematic/Unfold.tsx`:

```tsx
import type { JSX } from "@solidjs/web";
import { createSignal, createUniqueId } from "solid-js";
import * as s from "~/styles/schematic.css";

/**
 * Depth on demand: a summary at rest, a dense block on intent.
 *
 * Three independent inputs drive one derived state, because each has a
 * different lifetime:
 *
 *   pinned  — an explicit decision (click, Enter, Space). Survives the pointer
 *             leaving, which is what makes the content readable at all.
 *   hovered — a pointer convenience. No keyboard or touch equivalent.
 *   focused — keyboard presence anywhere inside the container.
 *
 * Focus is tracked on the container rather than the trigger. Using the
 * trigger's own blur would collapse the region the instant a keyboard user
 * tabbed into the content it had just revealed; `focusout` with a
 * `relatedTarget` containment check is what avoids that.
 *
 * Collapsed content stays mounted but gets `aria-hidden` and `inert`, so it is
 * neither announced nor reachable by Tab while invisible. Keeping it mounted is
 * what allows the height transition.
 */
export default function Unfold(props: {
    label: string;
    summary: JSX.Element;
    children: JSX.Element;
    class?: string;
}) {
    const [pinned, setPinned] = createSignal(false);
    const [hovered, setHovered] = createSignal(false);
    const [focused, setFocused] = createSignal(false);
    const open = () => pinned() || hovered() || focused();
    const regionId = createUniqueId();

    let root: HTMLDivElement | undefined;

    const handleFocusOut = (event: FocusEvent) => {
        const next = event.relatedTarget as Node | null;
        if (next && root?.contains(next)) return;
        setFocused(false);
    };

    return (
        <div
            ref={root}
            class={[s.unfold, props.class]}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocusIn={() => setFocused(true)}
            onFocusOut={handleFocusOut}
        >
            <button
                type="button"
                class={s.unfoldTrigger}
                aria-expanded={open() ? "true" : "false"}
                aria-controls={regionId}
                aria-label={props.label}
                onClick={() => setPinned(p => !p)}
            >
                {props.summary}
            </button>
            <div
                id={regionId}
                class={open() ? s.unfoldRegionOpen : s.unfoldRegion}
                aria-hidden={open() ? "false" : "true"}
                inert={!open() || undefined}
            >
                <div class={s.unfoldInner}>{props.children}</div>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/components/schematic/Unfold.test.tsx`
Expected: PASS, 11 tests.

Both `aria-*` values are already written as explicit strings and every state-changing test already calls `flush()`. Both were measured against Solid 2.0.0-beta.28: a boolean renders as attribute presence (absent when false, `""` when true), and a write from a click handler does not reach the DOM until the scheduler flushes. Do not "simplify" either back to the boolean or drop the `flush()` calls — the tests will fail.

- [ ] **Step 5: Verify the suite**

Run: `bun run check && bun run test`
Expected: Biome clean; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/schematic/Unfold.tsx src/components/schematic/Unfold.test.tsx
git commit -m "feat(ui): add Unfold primitive for depth on demand

Summary at rest, dense block on intent. Three inputs (pinned, hovered,
focused) drive one derived open state because each has a different lifetime:
a click survives the pointer leaving, hover does not, and focus can live
anywhere inside the container.

Focus is tracked on the container with a relatedTarget containment check,
not on the trigger's blur — trigger blur would collapse the region the
instant a keyboard user tabbed into the content it just revealed.

Collapsed content stays mounted but is aria-hidden and inert, so it is
neither announced nor tabbable while invisible."
```

---

### Task 7: Field primitive

**Files:**
- Create: `src/components/schematic/Field.tsx`
- Test: `src/components/schematic/Field.test.tsx`

**Interfaces:**
- Consumes: `inputRow`, `inputLabel`, `inputControl`, `inputHint` from `~/styles/schematic.css`.
- Produces: `Field(props: { label: string; value: string; onInput: (value: string) => void; type?: string; placeholder?: string; hint?: string; required?: boolean; onEnter?: () => void })`.

- [ ] **Step 1: Write the failing test**

Create `src/components/schematic/Field.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as s from "~/styles/schematic.css";
import Field from "./Field";

describe("Field", () => {
    it("associates its label with its input", () => {
        const { container, unmount } = renderSolid(() => (
            <Field label="url to check" value="" onInput={() => {}} />
        ));
        const label = container.querySelector("label") as HTMLLabelElement;
        const input = container.querySelector("input") as HTMLInputElement;
        expect(label.getAttribute("for")).toBe(input.id);
        expect(input.id).toBeTruthy();
        unmount();
    });

    it("shows the label text", () => {
        const { container, unmount } = renderSolid(() => (
            <Field label="add item" value="" onInput={() => {}} />
        ));
        expect(container.textContent).toContain("add item");
        unmount();
    });

    it("reflects the value", () => {
        const { container, unmount } = renderSolid(() => (
            <Field label="l" value="chess.org" onInput={() => {}} />
        ));
        expect((container.querySelector("input") as HTMLInputElement).value).toBe(
            "chess.org",
        );
        unmount();
    });

    it("reports typed input as a plain string", () => {
        const onInput = vi.fn();
        const { container, unmount } = renderSolid(() => (
            <Field label="l" value="" onInput={onInput} />
        ));
        const input = container.querySelector("input") as HTMLInputElement;
        input.value = "typed";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        expect(onInput).toHaveBeenCalledWith("typed");
        unmount();
    });

    it("calls onEnter when Enter is pressed", () => {
        const onEnter = vi.fn();
        const { container, unmount } = renderSolid(() => (
            <Field label="l" value="" onInput={() => {}} onEnter={onEnter} />
        ));
        const input = container.querySelector("input") as HTMLInputElement;
        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        expect(onEnter).toHaveBeenCalledOnce();
        unmount();
    });

    it("ignores other keys", () => {
        const onEnter = vi.fn();
        const { container, unmount } = renderSolid(() => (
            <Field label="l" value="" onInput={() => {}} onEnter={onEnter} />
        ));
        const input = container.querySelector("input") as HTMLInputElement;
        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "a", bubbles: true }),
        );
        expect(onEnter).not.toHaveBeenCalled();
        unmount();
    });

    it("renders a hint and links it to the input for assistive tech", () => {
        const { container, unmount } = renderSolid(() => (
            <Field label="l" value="" onInput={() => {}} hint="not a web address" />
        ));
        const input = container.querySelector("input") as HTMLInputElement;
        const hint = container.querySelector(`.${s.inputHint}`) as HTMLElement;
        expect(hint.textContent).toBe("not a web address");
        expect(input.getAttribute("aria-describedby")).toBe(hint.id);
        unmount();
    });

    it("omits the hint element when there is no hint", () => {
        const { container, unmount } = renderSolid(() => (
            <Field label="l" value="" onInput={() => {}} />
        ));
        expect(container.querySelector(`.${s.inputHint}`)).toBeNull();
        expect(
            (container.querySelector("input") as HTMLInputElement).hasAttribute(
                "aria-describedby",
            ),
        ).toBe(false);
        unmount();
    });

    it("defaults to a text input and honours an override", () => {
        const asText = renderSolid(() => (
            <Field label="l" value="" onInput={() => {}} />
        ));
        expect((asText.container.querySelector("input") as HTMLInputElement).type).toBe(
            "text",
        );
        asText.unmount();

        const asEmail = renderSolid(() => (
            <Field label="l" value="" onInput={() => {}} type="email" />
        ));
        expect((asEmail.container.querySelector("input") as HTMLInputElement).type).toBe(
            "email",
        );
        asEmail.unmount();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/schematic/Field.test.tsx`
Expected: FAIL — `Failed to resolve import "./Field"`.

- [ ] **Step 3: Write Field**

Create `src/components/schematic/Field.tsx`:

```tsx
import { createUniqueId, Show } from "solid-js";
import * as s from "~/styles/schematic.css";

/**
 * An input that sits on a rule rather than inside a box.
 *
 * The label lives in the margin at a fixed width so stacked fields align on one
 * column, the way a spec sheet does. The underline is the only chrome; it picks
 * up the accent on `:focus-within`.
 *
 * `onInput` hands back a plain string rather than an event, so callers never
 * reach into `currentTarget` and cannot accidentally read a stale value.
 */
export default function Field(props: {
    label: string;
    value: string;
    onInput: (value: string) => void;
    type?: string;
    placeholder?: string;
    hint?: string;
    required?: boolean;
    onEnter?: () => void;
}) {
    const inputId = createUniqueId();
    const hintId = createUniqueId();

    return (
        <div>
            <div class={s.inputRow}>
                <label class={s.inputLabel} for={inputId}>
                    {props.label}
                </label>
                <input
                    id={inputId}
                    class={s.inputControl}
                    type={props.type ?? "text"}
                    placeholder={props.placeholder}
                    value={props.value}
                    required={props.required}
                    aria-describedby={props.hint ? hintId : undefined}
                    onInput={e => props.onInput(e.currentTarget.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") props.onEnter?.();
                    }}
                />
            </div>
            <Show when={props.hint}>
                <span id={hintId} class={s.inputHint}>
                    {props.hint}
                </span>
            </Show>
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/components/schematic/Field.test.tsx`
Expected: PASS, 9 tests.

- [ ] **Step 5: Verify the suite**

Run: `bun run check && bun run test`
Expected: Biome clean; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/schematic/Field.tsx src/components/schematic/Field.test.tsx
git commit -m "feat(ui): add Field schematic input primitive

An input on a rule instead of in a box. Labels sit in a fixed-width margin so
stacked fields align on one column; the underline is the only chrome and picks
up the accent on :focus-within.

onInput hands back a string rather than an event so callers never reach into
currentTarget. Hints are linked with aria-describedby."
```

---

### Task 8: Icon indirection layer

The user is authoring a custom icon set in vector software. The point of this task is that adopting it later is a one-file edit, not a 17-file sweep.

**Files:**
- Create: `src/components/icons/index.ts`
- Test: `src/components/icons/index.test.ts`
- Modify (import lines only): the 17 files listed in Step 4.

**Interfaces:**
- Consumes: `solid-icons/{bi,cg,fa,tb}`.
- Produces: 31 named exports, each a Solid component accepting `{ size?: number; class?: string }`. Names are semantic (`IconClose`), never vendor-shaped (`TbOutlineX`).

- [ ] **Step 1: Write the failing test**

Create `src/components/icons/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as icons from "./index";

const EXPECTED = [
    "IconAlert",
    "IconArrowLeft",
    "IconArrowRight",
    "IconArrowUpRight",
    "IconBan",
    "IconBookmark",
    "IconBookmarkFilled",
    "IconBookmarkOutline",
    "IconCheck",
    "IconChevronDown",
    "IconClock",
    "IconClose",
    "IconForward",
    "IconLayoutBottom",
    "IconLayoutNavbar",
    "IconLayoutSidebar",
    "IconLayoutSidebarRight",
    "IconLink",
    "IconLoader",
    "IconLoaderDots",
    "IconLock",
    "IconPatreon",
    "IconPlus",
    "IconPuzzle",
    "IconRefresh",
    "IconSearch",
    "IconSpinner",
    "IconSpinnerFilled",
    "IconTrash",
    "IconUpload",
    "IconWorld",
] as const;

describe("icon indirection layer", () => {
    it("exports every semantic name the app uses", () => {
        for (const name of EXPECTED) {
            expect(icons, `missing export: ${name}`).toHaveProperty(name);
        }
    });

    it("exports only functions", () => {
        for (const [name, value] of Object.entries(icons)) {
            expect(typeof value, `${name} is not a component`).toBe("function");
        }
    });

    it("exports nothing vendor-shaped, so call sites stay portable", () => {
        for (const name of Object.keys(icons)) {
            expect(name).toMatch(/^Icon[A-Z]/);
        }
    });

    it("has no duplicate underlying components under different names", () => {
        const seen = new Map<unknown, string>();
        const aliases: string[] = [];
        for (const [name, value] of Object.entries(icons)) {
            const prior = seen.get(value);
            if (prior) aliases.push(`${name} === ${prior}`);
            else seen.set(value, name);
        }
        expect(aliases).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/icons`
Expected: FAIL — `Failed to resolve import "./index"`.

- [ ] **Step 3: Write the indirection module**

Create `src/components/icons/index.ts`:

```ts
import { BiRegularLeftArrowAlt, BiRegularRightArrowAlt } from "solid-icons/bi";
import { CgSpinner } from "solid-icons/cg";
import { FaRegularBookmark, FaSolidBookmark } from "solid-icons/fa";
import {
    TbFillAlertSquareRounded,
    TbFillBrandPatreon,
    TbFillFidgetSpinner,
    TbFillSquareRoundedCheck,
    TbOutlineArrowRight,
    TbOutlineArrowUpRight,
    TbOutlineBan,
    TbOutlineBookmark,
    TbOutlineChevronDown,
    TbOutlineClock,
    TbOutlineLayoutBottombar,
    TbOutlineLayoutNavbar,
    TbOutlineLayoutSidebar,
    TbOutlineLayoutSidebarRight,
    TbOutlineLink,
    TbOutlineLoader,
    TbOutlineLoader2,
    TbOutlineLock,
    TbOutlinePlus,
    TbOutlinePuzzle,
    TbOutlineRefresh,
    TbOutlineSearch,
    TbOutlineTrash,
    TbOutlineUpload,
    TbOutlineWorld,
    TbOutlineX,
} from "solid-icons/tb";

/**
 * The app's icon vocabulary, named by meaning rather than by vendor.
 *
 * Every component in the app imports from here. That is the entire purpose:
 * a custom icon set is being drawn separately, and when it lands this file is
 * the only one that changes. Importing `solid-icons/tb` directly anywhere else
 * defeats it — a lint-free way to reintroduce a 17-file migration.
 *
 * Names describe the job ("close", "world"), not the glyph or the pack, so a
 * replacement drawing does not have to imitate Tabler's shapes.
 */

export const IconAlert = TbFillAlertSquareRounded;
export const IconArrowLeft = BiRegularLeftArrowAlt;
export const IconArrowRight = TbOutlineArrowRight;
export const IconArrowUpRight = TbOutlineArrowUpRight;
export const IconBan = TbOutlineBan;
export const IconBookmark = TbOutlineBookmark;
export const IconBookmarkFilled = FaSolidBookmark;
export const IconBookmarkOutline = FaRegularBookmark;
export const IconCheck = TbFillSquareRoundedCheck;
export const IconChevronDown = TbOutlineChevronDown;
export const IconClock = TbOutlineClock;
export const IconClose = TbOutlineX;
export const IconForward = BiRegularRightArrowAlt;
export const IconLayoutBottom = TbOutlineLayoutBottombar;
export const IconLayoutNavbar = TbOutlineLayoutNavbar;
export const IconLayoutSidebar = TbOutlineLayoutSidebar;
export const IconLayoutSidebarRight = TbOutlineLayoutSidebarRight;
export const IconLink = TbOutlineLink;
export const IconLoader = TbOutlineLoader;
export const IconLoaderDots = TbOutlineLoader2;
export const IconLock = TbOutlineLock;
export const IconPatreon = TbFillBrandPatreon;
export const IconPlus = TbOutlinePlus;
export const IconPuzzle = TbOutlinePuzzle;
export const IconRefresh = TbOutlineRefresh;
export const IconSearch = TbOutlineSearch;
export const IconSpinner = CgSpinner;
export const IconSpinnerFilled = TbFillFidgetSpinner;
export const IconTrash = TbOutlineTrash;
export const IconUpload = TbOutlineUpload;
export const IconWorld = TbOutlineWorld;
```

`IconArrowLeft` and `IconForward` are the back/forward pair in `ui/UrlBar.tsx`. They are named asymmetrically on purpose: `IconArrowRight` is already taken by an unrelated Tabler glyph used elsewhere, and collapsing the two would make the "no two names alias the same component" test fail for a real reason.

- [ ] **Step 4: Migrate every call site**

Replace the vendor import in each file with a single import from `~/components/icons`, then rename the JSX usages. The mapping is exactly the table in Step 3, read right-to-left.

| File | Old import | New import |
|---|---|---|
| `src/components/AppsPage.tsx` | `TbOutlinePlus, TbOutlineWorld, TbOutlineX` from `solid-icons/tb` | `IconPlus, IconWorld, IconClose` |
| `src/components/HistoryPage.tsx` | `TbOutlineSearch, TbOutlineWorld, TbOutlineX` | `IconSearch, IconWorld, IconClose` |
| `src/components/ExtensionsPage.tsx` | multi-line from `solid-icons/tb` | matching `Icon*` names |
| `src/components/BookmarksBar.tsx` | `FaRegularBookmark, FaSolidBookmark` from `solid-icons/fa`; `TbOutlineWorld, TbOutlineX` from `solid-icons/tb` | `IconBookmarkOutline, IconBookmarkFilled, IconWorld, IconClose` |
| `src/components/BookmarksPage.tsx` | multi-line from `solid-icons/tb` | matching `Icon*` names |
| `src/components/IbossGatewayToast.tsx` | `TbOutlineX` | `IconClose` |
| `src/components/FilterCheckPage.tsx` | `TbFillAlertSquareRounded, TbFillFidgetSpinner, TbFillSquareRoundedCheck, TbOutlineLoader2` | `IconAlert, IconSpinnerFilled, IconCheck, IconLoaderDots` |
| `src/components/TabSearch.tsx` | `TbOutlineSearch, TbOutlineWorld` | `IconSearch, IconWorld` |
| `src/components/ui/TabPill.tsx` | `CgSpinner`; `TbOutlineWorld, TbOutlineX` | `IconSpinner, IconWorld, IconClose` |
| `src/components/BanInfoPage.tsx` | `TbOutlineBan, TbOutlineLoader` | `IconBan, IconLoader` |
| `src/components/ui/Select.tsx` | `TbOutlineChevronDown` | `IconChevronDown` |
| `src/components/BrowserChrome.tsx` | `TbOutlinePlus, TbOutlinePuzzle, TbOutlineWorld` | `IconPlus, IconPuzzle, IconWorld` |
| `src/components/ui/PatreonLoginButton.tsx` | `TbFillBrandPatreon` | `IconPatreon` |
| `src/components/ui/UrlBar.tsx` | `BiRegularLeftArrowAlt, BiRegularRightArrowAlt` from `solid-icons/bi`; multi-line from `solid-icons/tb` | `IconArrowLeft, IconForward`, plus matching `Icon*` names |
| `src/components/ChiiPanel.tsx` | multi-line from `solid-icons/tb` | matching `Icon*` names |
| `src/components/GoGuardianManifestToast.tsx` | `TbOutlineX` | `IconClose` |

Example, `src/components/AppsPage.tsx` line 1:

```tsx
import { IconClose, IconPlus, IconWorld } from "~/components/icons";
```

and every `<TbOutlineWorld size={28} />` becomes `<IconWorld size={28} />`, `<TbOutlineX size={11} />` becomes `<IconClose size={11} />`, `<TbOutlinePlus size={28} />` becomes `<IconPlus size={28} />`.

For the four files with multi-line vendor imports (`ExtensionsPage.tsx`, `BookmarksPage.tsx`, `ui/UrlBar.tsx`, `ChiiPanel.tsx`), read the existing import block, map each name through the Step 3 table, and replace the block with one `~/components/icons` import.

- [ ] **Step 5: Verify no vendor imports remain outside the indirection module**

Run:

```bash
grep -rn "solid-icons" src/ --include=*.tsx --include=*.ts | grep -v "src/components/icons/index.ts"
```

Expected: no output. Any line printed is a call site that was missed and will silently diverge when the custom set lands.

- [ ] **Step 6: Run the tests**

Run: `bun run test src/components/icons`
Expected: PASS, 4 tests.

- [ ] **Step 7: Verify the whole app still builds**

Run: `bun run check && bun run test && bun run build`
Expected: Biome clean; all tests pass; Vite build succeeds. The build is required here because this task touches 17 files including chrome components no test covers.

- [ ] **Step 8: Commit**

```bash
git add src/components/icons \
  src/components/AppsPage.tsx src/components/HistoryPage.tsx \
  src/components/ExtensionsPage.tsx src/components/BookmarksBar.tsx \
  src/components/BookmarksPage.tsx src/components/IbossGatewayToast.tsx \
  src/components/FilterCheckPage.tsx src/components/TabSearch.tsx \
  src/components/BanInfoPage.tsx src/components/BrowserChrome.tsx \
  src/components/ChiiPanel.tsx src/components/GoGuardianManifestToast.tsx \
  src/components/ui/TabPill.tsx src/components/ui/Select.tsx \
  src/components/ui/PatreonLoginButton.tsx src/components/ui/UrlBar.tsx
git commit -m "refactor(ui): route all icons through a semantic indirection layer

Every component now imports from ~/components/icons instead of
solid-icons/{bi,cg,fa,tb}. Names describe the job (IconClose, IconWorld)
rather than the glyph or the pack.

A custom icon set is being drawn separately; when it lands this is the only
file that changes. A test asserts no export is vendor-shaped and that no two
names alias the same component."
```

---

### Task 9: New Tab as a title sheet

**Files:**
- Modify: `src/components/NewTabPage.tsx`, `src/styles/NewTabPage.css.ts`
- Test: `src/components/NewTabPage.test.tsx`

**Interfaces:**
- Consumes: `Sheet`, `TitleBlock` are *not* used here — New Tab's title block sits bottom-left, which is the one page where the block is not a header. It uses `Sheet`, `Anno`, `Rule`, and `Unfold` directly.
- Produces: nothing other tasks depend on.

**Verification caveat.** `NewTabPage` renders its search bar only inside an iframe (`window.self !== window.top`). Visiting `/newtab` directly shows the title block but not the omnibox, and therefore not the status unfold. Verify the unfold by loading `/` and opening a new tab inside the chrome.

- [ ] **Step 1: Write the failing test**

Create `src/components/NewTabPage.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as s from "~/styles/schematic.css";
import NewTabPage from "./NewTabPage";

describe("NewTabPage", () => {
    it("renders the wordmark as the page heading", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        expect(container.querySelector("h1")?.textContent).toBe("Civil");
        unmount();
    });

    it("renders the sheet's ruled field", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        expect(container.querySelector(`.${s.sheetField}`)).not.toBeNull();
        unmount();
    });

    it("renders registration marks as decoration", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        const marks = container.querySelectorAll(`.${s.mark}`);
        expect(marks.length).toBeGreaterThan(0);
        for (const m of marks) {
            expect(m.getAttribute("aria-hidden")).toBe("true");
        }
        unmount();
    });

    it("keeps the ad notice, since ad revenue is a fixed product constraint", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        expect(container.textContent?.toLowerCase()).toContain("ads keep civil");
        unmount();
    });

    it("hides the omnibox outside a frame", () => {
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        expect(container.querySelector("input")).toBeNull();
        unmount();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/NewTabPage.test.tsx`
Expected: FAIL — no element matches `.${s.sheetField}`, because the page does not use `Sheet` yet.

- [ ] **Step 3: Rewrite the component**

Replace `src/components/NewTabPage.tsx` entirely:

```tsx
import { Show } from "solid-js";
import Anno from "~/components/schematic/Anno";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import Unfold from "~/components/schematic/Unfold";
import * as s from "~/styles/NewTabPage.css";
import SearchBarContainer from "./SearchBarContainer";

/**
 * The title sheet.
 *
 * The one page where the title block sits bottom-left rather than at the top,
 * because that is where a drawing puts it. Everything above is deliberately
 * empty except the omnibox, which sits on the sheet's primary rule with
 * dimension caps marking its span.
 */
export default function NewTabPage() {
    const inFrame = () =>
        typeof window !== "undefined" && window.self !== window.top;

    return (
        <Sheet density="coarse" class={s.newtabSheet}>
            <div class={s.omniboxZone}>
                <Show when={inFrame()}>
                    <div class={s.omniboxWrap}>
                        <Rule caps class={s.omniboxRule} />
                        <SearchBarContainer inline />
                        <Unfold
                            label="Session detail"
                            summary={<Anno muted>session</Anno>}
                        >
                            <dl class={s.statusStrip}>
                                <div class={s.statusPair}>
                                    <dt class={s.statusKey}>engine</dt>
                                    <dd class={s.statusValue}>scramjet</dd>
                                </div>
                                <div class={s.statusPair}>
                                    <dt class={s.statusKey}>transport</dt>
                                    <dd class={s.statusValue}>epoxy</dd>
                                </div>
                                <div class={s.statusPair}>
                                    <dt class={s.statusKey}>wisp</dt>
                                    <dd class={s.statusValue}>2</dd>
                                </div>
                            </dl>
                        </Unfold>
                    </div>
                </Show>
            </div>

            <div class={s.titleZone}>
                <div class={s.titleBlockCorner}>
                    <Rule weight="major" class={s.titleRule} />
                    <h1 class={s.wordmark}>Civil</h1>
                    <Anno muted>rev 2.0 · your web proxy</Anno>
                </div>
                <p class={s.adNote}>
                    <Anno muted>note 01 — ads keep Civil free and open source</Anno>
                </p>
            </div>
        </Sheet>
    );
}
```

The status strip's values are placeholders in this task — Task 9b wires them to live data. Keeping them static here means this task's test asserts structure, not fetch behaviour, and can therefore run without stubbing the network.

- [ ] **Step 4: Rewrite the style file**

Replace `src/styles/NewTabPage.css.ts` entirely:

```ts
import { style } from "@vanilla-extract/css";
import { ANNO, FONT_MONO, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * New Tab is the only sheet whose title block sits at the bottom, so its layout
 * is a three-row grid: empty headroom, the omnibox on the centre rule, then the
 * title block and margin note pinned to the base.
 */

export const newtabSheet = style({
    display: "grid",
    gridTemplateRows: "1fr auto",
    minHeight: "100vh",
});

export const omniboxZone = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const omniboxWrap = style({
    width: "min(560px, 100%)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
});

export const omniboxRule = style({
    opacity: 0.7,
});

export const statusStrip = style({
    display: "flex",
    flexWrap: "wrap",
    gap: "18px",
    margin: 0,
});

export const statusPair = style({
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
});

export const statusKey = style({
    ...ANNO,
    color: vars.color.overlay1,
    textTransform: "uppercase",
});

export const statusValue = style({
    ...ANNO,
    margin: 0,
    color: vars.color.text,
});

export const titleZone = style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "20px",
});

export const titleBlockCorner = style({
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    minWidth: "220px",
});

export const titleRule = style({
    marginBottom: "3px",
});

export const wordmark = style({
    margin: 0,
    fontSize: "clamp(28px, 4vw, 35px)",
    fontWeight: 500,
    lineHeight: 1.1,
    letterSpacing: "-0.015em",
    color: vars.color.text,
});

export const adNote = style({
    margin: 0,
    maxWidth: "260px",
    textAlign: "right",
    paddingTop: "6px",
    borderTop: RULE.hair,
    fontFamily: FONT_MONO,
});
```

Every previously exported name (`newtabRoot`, `welcomeText`, `eyebrow`, `eyebrowDot`, `wordmarkRule`, `tagline`, `searchbarWrap`, `cornerBracket`, `cornerTL/TR/BL/BR`, `axisTick`, `axisTickLeft/Right`, `adNotice`) is gone. `NewTabPage.tsx` was its only consumer — confirm with:

```bash
grep -rn "NewTabPage.css" src/ | grep -v "src/styles/NewTabPage.css.ts"
```

Expected: only `src/components/NewTabPage.tsx`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test src/components/NewTabPage.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Verify the build and look at it**

Run: `bun run check && bun run test && ./build.sh`
Then: `PORT=1234 bun run start:watch` and open `http://localhost:1234/newtab`.
Expected: a ruled sheet, three corner marks, wordmark and mono meta bottom-left, margin note bottom-right, no omnibox (correct outside a frame).

- [ ] **Step 7: Commit**

```bash
git add src/components/NewTabPage.tsx src/styles/NewTabPage.css.ts src/components/NewTabPage.test.tsx
git commit -m "feat(ui): rebuild New Tab as a schematic title sheet

The title block moves bottom-left, where a drawing puts it, and the omnibox
sits on the sheet's primary rule with dimension caps marking its span. The ad
notice becomes a labelled margin note rather than an apologetic sentence — ad
revenue is a fixed product constraint, so the slot stays.

Status values are static in this commit; the next wires them to live data."
```

---

### Task 9b: Wire the New Tab status strip to live data

**Files:**
- Modify: `src/components/NewTabPage.tsx`
- Test: `src/components/NewTabPage.test.tsx`

**Interfaces:**
- Consumes: `fetchBestProxy` from `~/lib/bestProxy` (returns `Promise<BestProxy | null>` where `BestProxy = { proxy: "uv" | "scramjet"; transport: "epoxy" | "libcurl" | "bare"; wispVersion: 1 | 2; score?: number; cached?: boolean }`); the `detectedFilters` localStorage key, a JSON string array written by `~/lib/swUtils`.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Append to `src/components/NewTabPage.test.tsx`:

```tsx
describe("NewTabPage status strip", () => {
    it("reads detected filters from localStorage", () => {
        localStorage.setItem("detectedFilters", JSON.stringify(["securly"]));
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        expect(container.textContent).toContain("securly");
        localStorage.removeItem("detectedFilters");
        unmount();
    });

    it("reports none when no filters were detected", () => {
        localStorage.removeItem("detectedFilters");
        const { container, unmount } = renderSolid(() => <NewTabPage />);
        expect(container.textContent).toContain("none");
        unmount();
    });

    it("survives a corrupt localStorage value without throwing", () => {
        localStorage.setItem("detectedFilters", "{not json");
        expect(() => {
            const { unmount } = renderSolid(() => <NewTabPage />);
            unmount();
        }).not.toThrow();
        localStorage.removeItem("detectedFilters");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/NewTabPage.test.tsx`
Expected: FAIL — "securly" is not in the output; the strip is still static.

- [ ] **Step 3: Add the reactive reads**

In `src/components/NewTabPage.tsx`, add these imports:

```tsx
import { createResource, createSignal, onMount, Show } from "solid-js";
import { fetchBestProxy } from "~/lib/bestProxy";
```

Inside the component, above the `return`:

```tsx
    const [filters, setFilters] = createSignal<string[]>([]);

    onMount(() => {
        // localStorage is unavailable during SSR and can hold a value written
        // by an older build, so both the read and the parse are guarded.
        try {
            const raw = localStorage.getItem("detectedFilters");
            const parsed = raw ? JSON.parse(raw) : [];
            if (Array.isArray(parsed)) setFilters(parsed as string[]);
        } catch {
            setFilters([]);
        }
    });

    // Probing the current origin is the cheapest honest question we can ask:
    // it exercises the same decision path a real navigation would.
    const [proxy] = createResource(() =>
        typeof window === "undefined"
            ? Promise.resolve(null)
            : fetchBestProxy(window.location.origin),
    );

    const filterLabel = () =>
        filters().length > 0 ? filters().join(" · ") : "none";
```

Replace the three static `statusPair` blocks with:

```tsx
                            <dl class={s.statusStrip}>
                                <div class={s.statusPair}>
                                    <dt class={s.statusKey}>filters</dt>
                                    <dd class={s.statusValue}>{filterLabel()}</dd>
                                </div>
                                <div class={s.statusPair}>
                                    <dt class={s.statusKey}>engine</dt>
                                    <dd class={s.statusValue}>
                                        {proxy()?.proxy ?? "—"}
                                    </dd>
                                </div>
                                <div class={s.statusPair}>
                                    <dt class={s.statusKey}>transport</dt>
                                    <dd class={s.statusValue}>
                                        {proxy()?.transport ?? "—"}
                                    </dd>
                                </div>
                                <div class={s.statusPair}>
                                    <dt class={s.statusKey}>wisp</dt>
                                    <dd class={s.statusValue}>
                                        {proxy()?.wispVersion ?? "—"}
                                    </dd>
                                </div>
                            </dl>
```

An em dash is the resting value for anything not yet resolved, so the strip never shows a stale or invented figure.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/components/NewTabPage.test.tsx`
Expected: PASS, 8 tests. `fetchBestProxy` calls `fetch`, which happy-dom leaves unstubbed — the promise rejects and `fetchBestProxy` already swallows it, returning `null`, so the em-dash fallbacks render. No network stub is needed.

- [ ] **Step 5: Verify the suite**

Run: `bun run check && bun run test`
Expected: Biome clean; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/NewTabPage.tsx src/components/NewTabPage.test.tsx
git commit -m "feat(ui): wire the New Tab status strip to live session data

Detected filters come from the detectedFilters localStorage key; engine,
transport and Wisp version come from /api/best-proxy via fetchBestProxy. Both
reads are guarded — localStorage is absent during SSR and can hold a value
written by an older build.

Unresolved values render as an em dash so the strip never shows an invented
figure."
```

---

### Task 10: Apps as a parts plate

**Files:**
- Modify: `src/components/AppsPage.tsx`, `src/styles/AppsPage.css.ts`
- Test: `src/components/AppsPage.test.tsx`

**Interfaces:**
- Consumes: `Sheet`, `TitleBlock`, `Rule`, `Anno`, `Plate`, `Unfold`, `Field` primitives; `apps`, `appsAdd`, `appsRemove` from `~/api/apps`; `tabManager` from `~/lib/TabManager`; `CivilApp` from `~/types`; `IconWorld`, `IconPlus`, `IconClose` from `~/components/icons`.
- Produces: nothing.

**Behaviour that must not change.** The URL validation in `handleAdd` rejects anything whose hostname fails `/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i`, because `new URL()` alone turns "not a valid url" into the host `not%20a%20valid%20url` and lands it in the grid. Keep that check and its message verbatim.

- [ ] **Step 1: Write the failing test**

Create `src/components/AppsPage.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";

import { flush } from "solid-js";

vi.mock("~/api/apps", () => ({
    apps: () => [],
    appsAdd: vi.fn(async () => undefined),
    appsRemove: vi.fn(),
}));

vi.mock("~/lib/TabManager", () => ({
    tabManager: { tabs: [], createTab: vi.fn(() => ({ id: "t1" })), activateTab: vi.fn() },
    BROWSER_URLS: {},
}));

const { default: AppsPage } = await import("./AppsPage");
const s = await import("~/styles/schematic.css");

describe("AppsPage", () => {
    it("renders the page title", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(container.querySelector("h1")?.textContent).toBe("Apps");
        unmount();
    });

    it("sits on a sheet", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(container.querySelector(`.${s.sheetField}`)).not.toBeNull();
        unmount();
    });

    it("labels the add field", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        const label = container.querySelector("label") as HTMLLabelElement;
        const input = container.querySelector("input") as HTMLInputElement;
        expect(label.getAttribute("for")).toBe(input.id);
        expect(container.textContent?.toLowerCase()).toContain("add item");
        unmount();
    });

    it("renders the empty state as ghost positions", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(container.querySelectorAll("[data-ghost]").length).toBeGreaterThan(0);
        unmount();
    });

    it("rejects input that is not a hostname", async () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        const input = container.querySelector("input") as HTMLInputElement;
        input.value = "not a valid url";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        await Promise.resolve();
        flush();
        expect(container.textContent).toContain("doesn't look like a web address");
        unmount();
    });

    it("uses a real list for the grid", () => {
        const { container, unmount } = renderSolid(() => <AppsPage />);
        expect(container.querySelector("ul")).not.toBeNull();
        unmount();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/AppsPage.test.tsx`
Expected: FAIL — no `.sheetField`, no `label[for]`, no `ul`.

- [ ] **Step 3: Rewrite the component**

Replace `src/components/AppsPage.tsx` entirely:

```tsx
import { createSignal, For, Show } from "solid-js";
import { apps, appsAdd, appsRemove } from "~/api/apps";
import { IconWorld } from "~/components/icons";
import Anno from "~/components/schematic/Anno";
import Field from "~/components/schematic/Field";
import Plate from "~/components/schematic/Plate";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import Unfold from "~/components/schematic/Unfold";
import { tabManager } from "~/lib/TabManager";
import * as s from "~/styles/AppsPage.css";
import type { CivilApp } from "~/types";

const GHOST_POSITIONS = 8;

function AppIcon(props: { icon: string | null; name: string }) {
    const [failed, setFailed] = createSignal(false);
    return (
        <Show
            when={props.icon && !failed()}
            fallback={
                <div class={s.iconFallback}>
                    <IconWorld size={24} />
                </div>
            }
        >
            <img
                src={props.icon!}
                class={s.icon}
                alt=""
                onError={() => setFailed(true)}
            />
        </Show>
    );
}

/**
 * The parts plate.
 *
 * Each app is a numbered position on a ruled field rather than a card in a
 * grid. Metadata and the remove action live inside the position's unfold, which
 * is what lets a plate of forty items read as calm at rest.
 */
export default function AppsPage() {
    const [input, setInput] = createSignal("");
    const [adding, setAdding] = createSignal(false);
    const [addError, setAddError] = createSignal<string | null>(null);

    const handleAdd = async () => {
        const raw = input().trim();
        if (!raw) return;

        // `new URL()` alone accepts almost anything once a scheme is bolted on:
        // "not a valid url" becomes the host "not%20a%20valid%20url", which then
        // lands in the plate as a position labelled with the escaped text.
        // Require something that actually looks like a host first.
        let url: URL;
        try {
            url = new URL(
                /^[a-z][\w+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`,
            );
        } catch {
            setAddError("That doesn't look like a web address. Try youtube.com");
            return;
        }
        if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) {
            setAddError("That doesn't look like a web address. Try youtube.com");
            return;
        }

        setAdding(true);
        setAddError(null);
        try {
            await appsAdd(url.toString());
            setInput("");
        } catch (e) {
            setAddError(e instanceof Error ? e.message : "Failed to add app");
        } finally {
            setAdding(false);
        }
    };

    const handleOpen = (app: CivilApp) => {
        const existing = tabManager.tabs.find(t => t.url === app.url);
        if (existing) {
            tabManager.activateTab(existing.id);
        } else {
            const t = tabManager.createTab(app.url);
            tabManager.activateTab(t.id);
        }
    };

    const position = (index: number) => String(index + 1).padStart(2, "0");

    return (
        <Sheet>
            <TitleBlock
                eyebrow="launcher"
                title="Apps"
                meta={`${apps().length} pinned`}
            />

            <Field
                label="add item"
                value={input()}
                onInput={setInput}
                onEnter={handleAdd}
                placeholder="youtube.com"
                hint={addError() ?? undefined}
            />
            <Show when={adding()}>
                <Anno muted class={s.addingNote}>adding…</Anno>
            </Show>

            <Rule label="positions" weight="major" class={s.gridRule} />

            <Show
                when={apps().length > 0}
                fallback={
                    <div class={s.ghostGrid}>
                        <For each={Array.from({ length: GHOST_POSITIONS })} keyed={false}>
                            {(_, i) => (
                                <div class={s.ghost} data-ghost>
                                    <Anno muted>{position(i())}</Anno>
                                </div>
                            )}
                        </For>
                        <p class={s.ghostNote}>
                            <Anno muted>
                                no positions filled — add an address above
                            </Anno>
                        </p>
                    </div>
                }
            >
                <ul class={s.grid}>
                    <For each={apps()} keyed={false}>
                        {(app, i) => (
                            <Plate as="li" class={s.position}>
                                <Unfold
                                    label={`${app().name} detail`}
                                    summary={
                                        <span class={s.summary}>
                                            <Anno muted>{position(i())}</Anno>
                                            <span class={s.iconStage}>
                                                <AppIcon
                                                    icon={app().icon}
                                                    name={app().name}
                                                />
                                            </span>
                                            <span class={s.name}>{app().name}</span>
                                        </span>
                                    }
                                >
                                    <div class={s.detail}>
                                        <Anno muted>{new URL(app().url).hostname}</Anno>
                                        <div class={s.detailActions}>
                                            <button
                                                type="button"
                                                class={s.detailBtn}
                                                onClick={() => handleOpen(app())}
                                            >
                                                open
                                            </button>
                                            <button
                                                type="button"
                                                class={s.detailBtnDanger}
                                                onClick={() => appsRemove(app().id)}
                                            >
                                                remove
                                            </button>
                                        </div>
                                    </div>
                                </Unfold>
                            </Plate>
                        )}
                    </For>
                </ul>
            </Show>
        </Sheet>
    );
}
```

Opening an app moves from a click on the tile to an explicit "open" button inside the unfold. That removes the `noStaticElementInteractions` and `useKeyWithClickEvents` Biome suppressions the old file carried — a div with a click handler was never keyboard-reachable.

- [ ] **Step 4: Rewrite the style file**

Replace `src/styles/AppsPage.css.ts` entirely:

```ts
import { style } from "@vanilla-extract/css";
import { DUR, EASE } from "./material.css";
import { ANNO, FONT_MONO, RULE } from "./schematic.css";
import { vars } from "./theme.css";

export const addingNote = style({ display: "block", marginTop: "6px" });

export const gridRule = style({ margin: "26px 0 14px" });

export const grid = style({
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
    gap: "10px",
});

export const position = style({
    transition: `background ${DUR.fast} ${EASE.standard}`,
    selectors: {
        "&:hover, &:focus-within": {
            background: vars.color.mantle,
        },
    },
});

export const summary = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
});

export const iconStage = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "34px",
    height: "34px",
});

export const icon = style({
    width: "26px",
    height: "26px",
    objectFit: "contain",
});

export const iconFallback = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.color.overlay1,
});

export const name = style({
    fontSize: "12.5px",
    fontWeight: 500,
    color: vars.color.subtext1,
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
});

export const detail = style({
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    alignItems: "center",
});

export const detailActions = style({
    display: "flex",
    gap: "8px",
});

const detailBtnBase = {
    background: "none",
    border: "none",
    padding: "2px 4px",
    cursor: "pointer",
    fontFamily: FONT_MONO,
    fontSize: "11px",
    letterSpacing: "0.02em",
    borderBottom: RULE.hair,
} as const;

export const detailBtn = style({
    ...detailBtnBase,
    color: vars.color.lavender,
});

export const detailBtnDanger = style({
    ...detailBtnBase,
    color: vars.color.red,
});

export const ghostGrid = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
    gap: "10px",
});

export const ghost = style({
    height: "74px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: "6px",
    border: `0.5px dashed ${vars.color.surface0}`,
});

export const ghostNote = style({
    ...ANNO,
    gridColumn: "1 / -1",
    margin: "10px 0 0",
});
```

Confirm nothing else imported the old names:

```bash
grep -rn "AppsPage.css" src/ | grep -v "src/styles/AppsPage.css.ts"
```

Expected: only `src/components/AppsPage.tsx`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test src/components/AppsPage.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 6: Verify and look at it**

Run: `bun run check && bun run test && ./build.sh`
Then open `http://localhost:1234/apps`.
Expected: title block, an "add item" field on a rule, a "positions" rule, and eight dashed ghost positions when empty. Hovering or tabbing to a filled position reveals hostname plus open/remove.

- [ ] **Step 7: Commit**

```bash
git add src/components/AppsPage.tsx src/styles/AppsPage.css.ts src/components/AppsPage.test.tsx
git commit -m "feat(ui): rebuild Apps as a schematic parts plate

Each app is a numbered position on a ruled field. Hostname and the remove
action move into the position's unfold, so a plate of forty items reads calm
at rest.

Opening an app is now an explicit button rather than a click handler on a div,
which removes two Biome a11y suppressions — the old tile was never
keyboard-reachable. The hostname validation and its message are unchanged."
```

---

### Task 11: Split FilterCheckPage without changing behaviour

Mechanical extraction only. No visual change. A reviewer should be able to approve this and reject Task 12, or the reverse.

**Files:**
- Create: `src/lib/filterCheckVendors.ts`
- Modify: `src/components/FilterCheckPage.tsx`
- Test: `src/lib/filterCheckVendors.test.ts`

**Interfaces:**
- Produces: `type FilterStatus = "allowed" | "blocked" | "warned" | "unknown" | "error"`; `type FilterResult = { filterKey: string; filterName: string; status: FilterStatus; detail: string; categories?: string[] }`; `type FilterConfig = { name: string; aliases: string[]; needsEmail?: boolean; endpoint: string; buildPayload: (url: string, email: string) => Record<string, unknown>; parseResult: (data: unknown) => { status: FilterStatus; detail: string; categories?: string[] } }`; `FILTER_CONFIGS: Record<string, FilterConfig>`; `SECURLY_EXTENSION_ID: string`; `findFilterConfig(name: string): [string, FilterConfig] | null`; `prettifyFilterName(key: string): string`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/filterCheckVendors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
    FILTER_CONFIGS,
    findFilterConfig,
    prettifyFilterName,
} from "./filterCheckVendors";

describe("FILTER_CONFIGS", () => {
    it("gives every vendor an endpoint under /filterCheck", () => {
        for (const [key, config] of Object.entries(FILTER_CONFIGS)) {
            expect(config.endpoint, key).toMatch(/^\/filterCheck\//);
        }
    });

    it("gives every vendor a display name and at least one alias", () => {
        for (const [key, config] of Object.entries(FILTER_CONFIGS)) {
            expect(config.name, key).toBeTruthy();
            expect(config.aliases.length, key).toBeGreaterThan(0);
        }
    });

    it("never reuses an alias across vendors", () => {
        const seen = new Map<string, string>();
        for (const [key, config] of Object.entries(FILTER_CONFIGS)) {
            for (const alias of config.aliases) {
                expect(seen.has(alias), `${alias} used by ${seen.get(alias)} and ${key}`).toBe(false);
                seen.set(alias, key);
            }
        }
    });
});

describe("findFilterConfig", () => {
    it("finds a vendor by its own key", () => {
        const found = findFilterConfig("securly");
        expect(found?.[0]).toBe("securly");
    });

    it("is case-insensitive", () => {
        expect(findFilterConfig("SECURLY")?.[0]).toBe("securly");
    });

    it("returns null for an unknown vendor", () => {
        expect(findFilterConfig("definitely-not-a-filter")).toBeNull();
    });
});

describe("prettifyFilterName", () => {
    it("returns a non-empty label for every configured vendor", () => {
        for (const key of Object.keys(FILTER_CONFIGS)) {
            expect(prettifyFilterName(key).length).toBeGreaterThan(0);
        }
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/filterCheckVendors.test.ts`
Expected: FAIL — `Failed to resolve import "./filterCheckVendors"`.

- [ ] **Step 3: Move the vendor layer out**

Create `src/lib/filterCheckVendors.ts` and move into it, unchanged, from `src/components/FilterCheckPage.tsx`:

- the `FilterStatus`, `FilterResult`, and `FilterConfig` type declarations (currently lines 26–48), each now `export type`
- `SECURLY_EXTENSION_ID` (line 49), now `export const`
- `FILTER_CONFIGS` (lines 51–291), now `export const`
- `findFilterConfig` (lines 292–301), now `export function`
- `prettifyFilterName` (lines 302–349), now `export function`

Add this module docblock at the top:

```ts
/**
 * Per-vendor filter-check configuration.
 *
 * Extracted from FilterCheckPage.tsx, which had grown to 865 lines with 240 of
 * them being this table. It lives in lib/ rather than beside the component
 * because it is data and request-shaping, not rendering — and because vendor
 * APIs drift, so this is the file that changes when a checker breaks.
 */
```

Then in `src/components/FilterCheckPage.tsx`, delete those declarations and import them:

```tsx
import {
    FILTER_CONFIGS,
    type FilterConfig,
    type FilterResult,
    type FilterStatus,
    findFilterConfig,
    prettifyFilterName,
    SECURLY_EXTENSION_ID,
} from "~/lib/filterCheckVendors";
```

Change nothing else. No JSX edits, no logic edits.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/filterCheckVendors.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Confirm the page is unchanged in behaviour**

Run: `bun run check && bun run test && ./build.sh`
Then open `http://localhost:1234/checkfilters` and run a check against `https://example.com`.
Expected: identical appearance and behaviour to before this task. Line count of `FilterCheckPage.tsx` drops by roughly 320.

Verify the drop:

```bash
wc -l src/components/FilterCheckPage.tsx src/lib/filterCheckVendors.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/filterCheckVendors.ts src/lib/filterCheckVendors.test.ts src/components/FilterCheckPage.tsx
git commit -m "refactor: extract filter vendor config from FilterCheckPage

Moves the types, FILTER_CONFIGS, findFilterConfig and prettifyFilterName into
src/lib/filterCheckVendors.ts. Behaviour is unchanged — this is a move, not a
rewrite.

It lives in lib/ because it is data and request-shaping rather than rendering,
and because vendor APIs drift: this is the file that changes when a checker
breaks. Tests assert every vendor has an endpoint and that no alias is shared
between two vendors."
```

---

### Task 12: Filter Checker as a test-report ledger

**Files:**
- Create: `src/components/FilterCheckForm.tsx`, `src/components/FilterCheckResults.tsx`
- Modify: `src/components/FilterCheckPage.tsx`, `src/styles/FilterCheckPage.css.ts`
- Test: `src/components/FilterCheckResults.test.tsx`

**Interfaces:**
- Consumes: `FilterResult`, `FilterStatus` from `~/lib/filterCheckVendors`; `Sheet`, `TitleBlock`, `Rule`, `Anno`, `Unfold`, `Field` primitives; `IconAlert`, `IconCheck`, `IconLoaderDots`, `IconSpinnerFilled` from `~/components/icons`.
- Produces: `FilterCheckForm(props: { needsEmail: boolean; email: string; url: string; loading: boolean; onEmail: (v: string) => void; onUrl: (v: string) => void; onSubmit: () => void })`; `FilterCheckResults(props: { results: FilterResult[] })`.

- [ ] **Step 1: Write the failing test**

Create `src/components/FilterCheckResults.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import type { FilterResult } from "~/lib/filterCheckVendors";
import FilterCheckResults from "./FilterCheckResults";

const RESULTS: FilterResult[] = [
    {
        filterKey: "securly",
        filterName: "Securly",
        status: "allowed",
        detail: "not blocked",
        categories: ["games", "social"],
    },
    {
        filterKey: "goguardian",
        filterName: "GoGuardian",
        status: "blocked",
        detail: "vendor schema drift",
    },
];

describe("FilterCheckResults", () => {
    it("renders one row per vendor", () => {
        const { container, unmount } = renderSolid(() => (
            <FilterCheckResults results={RESULTS} />
        ));
        expect(container.querySelectorAll("li")).toHaveLength(2);
        unmount();
    });

    it("shows each vendor name and verdict", () => {
        const { container, unmount } = renderSolid(() => (
            <FilterCheckResults results={RESULTS} />
        ));
        const text = container.textContent ?? "";
        expect(text).toContain("Securly");
        expect(text).toContain("allowed");
        expect(text).toContain("GoGuardian");
        expect(text).toContain("blocked");
        unmount();
    });

    it("reports the category count in the ledger row", () => {
        const { container, unmount } = renderSolid(() => (
            <FilterCheckResults results={RESULTS} />
        ));
        expect(container.textContent).toContain("2");
        unmount();
    });

    it("keeps the detail in the DOM but collapsed until asked", () => {
        const { container, unmount } = renderSolid(() => (
            <FilterCheckResults results={RESULTS} />
        ));
        expect(container.textContent).toContain("vendor schema drift");
        const regions = container.querySelectorAll("[aria-hidden='true']");
        expect(regions.length).toBeGreaterThan(0);
        unmount();
    });

    it("expands a row on click", () => {
        const { container, unmount } = renderSolid(() => (
            <FilterCheckResults results={RESULTS} />
        ));
        const trigger = container.querySelector("button") as HTMLButtonElement;
        expect(trigger.getAttribute("aria-expanded")).toBe("false");
        trigger.click();
        flush();
        expect(trigger.getAttribute("aria-expanded")).toBe("true");
        unmount();
    });

    it("renders a column header row", () => {
        const { container, unmount } = renderSolid(() => (
            <FilterCheckResults results={RESULTS} />
        ));
        const text = container.textContent ?? "";
        expect(text).toContain("vendor");
        expect(text).toContain("verdict");
        unmount();
    });

    it("renders nothing but the header when there are no results", () => {
        const { container, unmount } = renderSolid(() => (
            <FilterCheckResults results={[]} />
        ));
        expect(container.querySelectorAll("li")).toHaveLength(0);
        unmount();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/FilterCheckResults.test.tsx`
Expected: FAIL — `Failed to resolve import "./FilterCheckResults"`.

- [ ] **Step 3: Write the results ledger**

Create `src/components/FilterCheckResults.tsx`:

```tsx
import { For, Show } from "solid-js";
import { IconAlert, IconCheck } from "~/components/icons";
import Anno from "~/components/schematic/Anno";
import Unfold from "~/components/schematic/Unfold";
import type { FilterResult, FilterStatus } from "~/lib/filterCheckVendors";
import * as s from "~/styles/FilterCheckPage.css";

/**
 * The report ledger.
 *
 * One row per vendor in aligned monospace columns, because the question a user
 * actually has is comparative — "which of these is blocking me" — and cards
 * make comparison impossible. The verdict keeps its status colour; everything
 * else is the annotation tier.
 *
 * The unfold carries the detail string, which is where the backend's typed
 * error discriminant surfaces. Every misc/filters/*/checker.ts returns a
 * neverthrow Result with an error union (INVALID_URL | NETWORK | PARSE) and
 * vendor-specific verdicts; the previous card UI flattened all of it into a
 * colour.
 */
function StatusMark(props: { status: FilterStatus }) {
    return (
        <Show
            when={props.status === "allowed"}
            fallback={<IconAlert size={13} class={s.markIcon[props.status]} />}
        >
            <IconCheck size={13} class={s.markIcon.allowed} />
        </Show>
    );
}

export default function FilterCheckResults(props: { results: FilterResult[] }) {
    return (
        <div class={s.ledger}>
            <div class={s.ledgerHead} aria-hidden="true">
                <span>vendor</span>
                <span>verdict</span>
                <span>cat</span>
            </div>
            <ul class={s.ledgerBody}>
                <For each={props.results} keyed={false}>
                    {result => (
                        <li class={s.ledgerRow}>
                            <Unfold
                                label={`${result().filterName} detail`}
                                summary={
                                    <span class={s.rowGrid}>
                                        <span class={s.rowVendor}>
                                            <StatusMark status={result().status} />
                                            {result().filterName}
                                        </span>
                                        <span class={s.rowVerdict[result().status]}>
                                            {result().status}
                                        </span>
                                        <span class={s.rowCat}>
                                            {result().categories?.length ?? 0}
                                        </span>
                                    </span>
                                }
                            >
                                <div class={s.rowDetail}>
                                    <Anno>{result().detail}</Anno>
                                    <Show
                                        when={
                                            result().categories &&
                                            result().categories!.length > 0
                                        }
                                    >
                                        <div class={s.catRow}>
                                            <For
                                                each={result().categories}
                                                keyed={false}
                                            >
                                                {cat => (
                                                    <span class={s.catChip}>
                                                        {cat()}
                                                    </span>
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                </div>
                            </Unfold>
                        </li>
                    )}
                </For>
            </ul>
        </div>
    );
}
```

- [ ] **Step 4: Write the form**

Create `src/components/FilterCheckForm.tsx`:

```tsx
import { Show } from "solid-js";
import { IconLoaderDots } from "~/components/icons";
import Field from "~/components/schematic/Field";
import * as s from "~/styles/FilterCheckPage.css";

/**
 * The report's specimen section: what to test, and who to test it as.
 *
 * Fields sit on rules with margin labels so they align on one column, the way a
 * spec sheet does.
 */
export default function FilterCheckForm(props: {
    needsEmail: boolean;
    email: string;
    url: string;
    loading: boolean;
    onEmail: (value: string) => void;
    onUrl: (value: string) => void;
    onSubmit: () => void;
}) {
    return (
        <form
            class={s.form}
            onSubmit={e => {
                e.preventDefault();
                props.onSubmit();
            }}
        >
            <Show when={props.needsEmail}>
                <Field
                    label="school email"
                    type="email"
                    value={props.email}
                    onInput={props.onEmail}
                    placeholder="student@school.edu"
                    required
                />
            </Show>
            <Field
                label="specimen url"
                type="url"
                value={props.url}
                onInput={props.onUrl}
                placeholder="https://example.com"
                required
            />
            <button class={s.submit} type="submit" disabled={props.loading}>
                <Show when={props.loading} fallback="run report">
                    <IconLoaderDots size={14} class={s.spinner} /> running…
                </Show>
            </button>
        </form>
    );
}
```

- [ ] **Step 5: Rewire the page**

In `src/components/FilterCheckPage.tsx`, keep every signal, effect, and handler exactly as-is. Replace only the JSX returned at the end: wrap it in `Sheet`, use `TitleBlock`, and delegate to the two new components.

The structure of the new `return`:

```tsx
    return (
        <>
            <Show when={showManifestToast()}>
                <GoGuardianManifestToast
                    extensionId={goguardianExtensionId()}
                    onDismiss={() => setShowManifestToast(false)}
                />
            </Show>
            <Show when={showIbossToast()}>
                <IbossGatewayToast onDismiss={() => setShowIbossToast(false)} />
            </Show>

            <Sheet marks={["tl", "tr", "br"]}>
                <TitleBlock
                    eyebrow="diagnostic"
                    title="Filter report"
                    meta={`${detectedFilters().length} detected`}
                    actions={
                        <button
                            type="button"
                            class={s.rescan}
                            onClick={handleRescan}
                            disabled={rescanning()}
                        >
                            <Show when={rescanning()} fallback="re-scan">
                                <IconLoaderDots size={13} class={s.spinner} /> scanning…
                            </Show>
                        </button>
                    }
                />

                <Rule label="specimen" />
                <div class={s.specimenRow}>
                    <Show
                        when={detectedFilters().length > 0}
                        fallback={<Anno muted>no filters detected on this network</Anno>}
                    >
                        <For each={detectedFilters()} keyed={false}>
                            {f => <span class={s.specimenChip}>{f()}</span>}
                        </For>
                    </Show>
                </div>

                <Show when={unsupportedFilters().length > 0}>
                    <div class={s.unsupported}>
                        <For each={unsupportedFilters()} keyed={false}>
                            {f => (
                                <Anno muted>
                                    unsupported extension id — {prettifyFilterName(f())}
                                </Anno>
                            )}
                        </For>
                    </div>
                </Show>

                <FilterCheckForm
                    needsEmail={needsEmail()}
                    email={email()}
                    url={url()}
                    loading={loading()}
                    onEmail={setEmail}
                    onUrl={setUrl}
                    onSubmit={() => void handleCheck()}
                />

                <Show when={checked()}>
                    <Rule label="results" weight="major" class={s.resultsRule} />
                    <FilterCheckResults results={results()} />
                </Show>
            </Sheet>
        </>
    );
```

Delete the local `StatusIcon` function (lines 350–372 of the original) — `FilterCheckResults` owns status marks now. Add these imports and drop any that become unused:

```tsx
import { IconLoaderDots } from "~/components/icons";
import Anno from "~/components/schematic/Anno";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import FilterCheckForm from "./FilterCheckForm";
import FilterCheckResults from "./FilterCheckResults";
```

- [ ] **Step 6: Replace the style file's page-level exports**

In `src/styles/FilterCheckPage.css.ts`, delete `page`, `header`, `headerTitle`, `eyebrow`, `eyebrowMark`, `title`, `subtitle`, `noFiltersText`, `detectedBadges`, `detectedLabel`, `badge`, `label`, `input`, `checkBtn`, `results`, `resultCard`, `resultIcon`, `resultIconColor`, `resultBody`, `resultName`, `resultDetail`, `categories`, `resultStatus`, `rescanBtn`, `unsupportedNotice`. Keep `spinner` and `catChip`. Add:

```ts
import { style, styleVariants } from "@vanilla-extract/css";
import { ANNO, FONT_MONO, RULE } from "./schematic.css";
import { vars } from "./theme.css";

const STATUS_COLOR = {
    allowed: vars.color.green,
    blocked: vars.color.red,
    warned: vars.color.yellow,
    unknown: vars.color.overlay1,
    error: vars.color.maroon,
} as const;

const LEDGER_COLUMNS = "minmax(0, 1fr) 96px 40px";

export const rescan = style({
    ...ANNO,
    background: "none",
    border: "none",
    borderBottom: RULE.hair,
    cursor: "pointer",
    color: vars.color.mauve,
});

export const specimenRow = style({
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    margin: "10px 0 22px",
});

export const specimenChip = style({
    ...ANNO,
    padding: "2px 8px",
    border: RULE.hair,
    color: vars.color.subtext1,
});

export const unsupported = style({
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginBottom: "18px",
});

export const form = style({
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "520px",
});

export const submit = style({
    ...ANNO,
    alignSelf: "flex-start",
    marginTop: "4px",
    padding: "7px 18px",
    background: vars.color.mauve,
    color: vars.color.crust,
    border: "none",
    cursor: "pointer",
    textTransform: "uppercase",
    selectors: {
        "&:disabled": { opacity: 0.6, cursor: "default" },
    },
});

export const resultsRule = style({ margin: "30px 0 12px" });

export const ledger = style({ marginTop: "4px" });

export const ledgerHead = style({
    ...ANNO,
    display: "grid",
    gridTemplateColumns: LEDGER_COLUMNS,
    gap: "10px",
    paddingBottom: "6px",
    color: vars.color.overlay1,
    textTransform: "uppercase",
});

export const ledgerBody = style({ listStyle: "none", margin: 0, padding: 0 });

export const ledgerRow = style({ borderTop: RULE.hair });

export const rowGrid = style({
    display: "grid",
    gridTemplateColumns: LEDGER_COLUMNS,
    gap: "10px",
    alignItems: "center",
    padding: "7px 0",
});

export const rowVendor = style({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12.5px",
    fontWeight: 500,
    color: vars.color.text,
});

export const rowVerdict = styleVariants(STATUS_COLOR, color => ({
    fontFamily: FONT_MONO,
    fontSize: "11px",
    letterSpacing: "0.02em",
    color,
}));

export const markIcon = styleVariants(STATUS_COLOR, color => ({ color }));

export const rowCat = style({
    ...ANNO,
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
});

export const rowDetail = style({
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    paddingBottom: "8px",
});

export const catRow = style({ display: "flex", flexWrap: "wrap", gap: "6px" });
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bun run test src/components/FilterCheckResults.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 8: Verify and exercise it for real**

Run: `bun run check && bun run test && ./build.sh`
Then open `http://localhost:1234/checkfilters`, run a report against `https://example.com`, and expand a row.
Expected: a ledger with aligned columns; expanding a row shows its detail string and category chips. Confirm a deliberately bad URL surfaces an error verdict rather than a blank row.

- [ ] **Step 9: Commit**

```bash
git add src/components/FilterCheckPage.tsx src/components/FilterCheckForm.tsx src/components/FilterCheckResults.tsx src/styles/FilterCheckPage.css.ts src/components/FilterCheckResults.test.tsx
git commit -m "feat(ui): rebuild Filter Checker as a schematic test report

Results become a ledger of aligned monospace columns instead of one card per
vendor, because the user's real question is comparative — which of these is
blocking me — and cards make comparison impossible.

Expanding a row surfaces the detail string, which is where the backend's typed
error discriminant lives. Every checker returns a neverthrow Result with an
INVALID_URL | NETWORK | PARSE union and vendor-specific verdicts; the card UI
flattened all of that into a colour.

The gradient headline is gone: a gradient text fill cannot coexist with flat
ink."
```

---

### Task 13: Bring the documentation back into truth

**Files:**
- Modify: `DESIGN.md`, `MAINTENANCE.md`

- [ ] **Step 1: Rewrite DESIGN.md's north star and rules**

Edit the front-matter `description` to: `A stealth browser chrome wrapped around schematic interior pages — a technical drawing you can browse from`.

In the prose, replace the "Creative North Star: The Stealth Cockpit" section with a two-layer statement: the chrome stays stealth and browser-shaped because it is what a passer-by sees; interior pages are schematic because only the user sees them.

Then make these specific corrections:

| Rule | Change |
|---|---|
| The One-Family Rule | Retired. Rubik carries prose and labels; a system monospace stack carries data. Document `FONT_MONO`. |
| Flat by default | Retired for interior pages. Interior depth comes from rules and alignment, not shadow *or* light. |
| The Two-Lane Accent Rule | Retained. Lavender = chrome, mauve = Filter Checker. |
| `atmosphere()` / `edgeLit` | Record as **deliberately retired**, with the reason: they belong to the backlit metaphor, which does not coexist with flat ink. Note that the exports survive only until the six pass-2 pages migrate. |
| Annotation contrast | `overlay1` on `base` is ~4.0:1 and fails WCAG AA for small text. Annotations use `subtext0`. |

Add a "Schematic language" section documenting the sheet model, the three rule weights, the three field densities, registration-mark convention (three corners; bottom-left belongs to the title block), and the seven primitives with one line each.

Add a "Migration state" section listing which pages are schematic (newtab, apps, checkfilters) and which are still backlit (bookmarks, history, extensions, benchmarks, ban, baninfo), so the inconsistency is documented rather than mysterious.

- [ ] **Step 2: Update MAINTENANCE.md**

- In the file map, add `src/styles/schematic.css.ts`, `src/components/schematic/`, `src/components/icons/`, `src/lib/filterCheckVendors.ts`, `tests/helpers/renderSolid.ts`.
- Add a "Schematic primitives" subsection to the Solid section: the seven primitives, and the rule that `Unfold` is the only reveal mechanism — do not hand-roll hover states.
- Add to the icon section: **never import `solid-icons` directly**; import from `~/components/icons`. Include the verification command:
  ```bash
  grep -rn "solid-icons" src/ | grep -v "src/components/icons/index.ts"
  ```
- Update the testing table with the new component test files and note the `// @vitest-environment happy-dom` docblock requirement plus `renderSolid`.
- In "Known problems", remove item 5 if `oxc-parser`/`oxc-transform` were resolved, and add: *interior pages are mid-migration — three schematic, six backlit.*

- [ ] **Step 3: Verify**

Run: `bun run check && bun run test && ./build.sh`
Expected: all green. Documentation changes cannot break the build, but this confirms the tree is clean before the final commit.

- [ ] **Step 4: Commit**

```bash
git add DESIGN.md MAINTENANCE.md
git commit -m "docs: rewrite DESIGN.md for the schematic interior

Records the two-layer north star (stealth chrome, schematic interior), the
sheet model, the seven primitives, and the three field densities.

Marks the One-Family and Flat-by-default rules retired, and records
atmosphere() and edgeLit as deliberately retired with the reason — so nobody
reinstates them assuming they were lost by accident. Corrects the annotation
contrast value: overlay1 on base is ~4.0:1 and fails AA for small text.

Adds a migration-state section: three pages schematic, six still backlit."
```

---

## Self-Review

**Spec coverage.** Every numbered spec section maps to a task: §4.1–4.4 foundation → Task 1; §5 primitives → Tasks 3–7; §5.1 `Unfold` → Task 6; §6 icon indirection → Task 8; §7.1 New Tab → Tasks 9 and 9b; §7.2 Apps → Task 10; §7.3 Filter Checker → Task 12; §7.4 component split → Task 11; §8 accessibility → distributed through the primitive tests, with the contrast correction in Task 1; §9 motion → Task 1's `unfoldRegion` transition; §10 performance → the Global Constraints block; §11 empty and error states → Tasks 10 and 12; §12 testing → Task 2 plus per-task tests; §13 verification → the verify step in Tasks 9–12; §14 documentation → Task 13.

One spec item is **deliberately not implemented in pass 1**: §11's "service worker unavailable → labelled margin note". `swUtils.ts` only logs to the console today, and surfacing it needs a shared toast or status channel that no slice page owns. It belongs with the chrome work in pass 2. Flagged rather than silently dropped.

**Type consistency.** `FilterStatus`, `FilterResult`, and `FilterConfig` keep the exact shapes from the current `FilterCheckPage.tsx` through Tasks 11 and 12. `Corner` is defined in Task 4 and reused in Task 12's `marks={["tl", "tr", "br"]}`. `FieldDensity` is defined in Task 1 and consumed in Tasks 4 and 9. `renderSolid`'s `{ container, unmount }` return is used identically in every component test. `IconForward` is exported in Task 8 Step 3 and called out in the note there because it is missing from the test list — add it when writing that test.

**Placeholder scan.** No `TBD`, no "add error handling", no "similar to Task N". Two places intentionally defer to the implementer with a stated fallback rather than a guess: Task 5's `Dynamic` import location, and Task 6's `aria-expanded` boolean coercion. Both name the exact symptom and the exact remedy, because both depend on Solid 2.0 beta behaviour that should be confirmed against the installed version rather than assumed.
