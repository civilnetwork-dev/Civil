import type { JSX } from "@solidjs/web";

import { actEnd, actStart } from "~/lib/acts";

import * as s from "~/styles/icons.css";

type IconProps = { size?: number; class?: string };

/**
 * A single 16-unit grid and motion contract across every screen, cut from the
 * same stone as the Doorway.
 *
 * Every glyph is solid: slabs and 2.2-unit bars with square-cut ends, corners
 * either square or a quadrant like the logo's door head, and even-odd
 * knockouts wherever two pieces overlap, the logo's own rule. The set is drawn
 * in Affinity Designer, one artboard per glyph, and each `<path>` is one part
 * of it, so a gesture can move a lid, a hand or a knob on its own.
 *
 * Each glyph is drawn three times from the one path source: an extrusion
 * offset down and right in a darker tone, a lit rim offset up and left, and
 * the face on top. Together they read as a small raised solid lit from the
 * upper left. On hover the face and rim lift while the extrusion stays put, so
 * the solid visibly deepens. Colour still comes only from `currentColor`.
 */
function icon(name: string, body: () => JSX.Element) {
    return (props: IconProps) => (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            width={props.size ?? 16}
            height={props.size ?? 16}
            class={[s.icon, props.class]}
            data-icon={name}
            aria-hidden="true"
            fill="currentColor"
            onAnimationStart={actStart}
            onAnimationEnd={actEnd}
            onAnimationCancel={actEnd}
        >
            <g class={s.depth}>{body()}</g>
            <g class={s.rim}>{body()}</g>
            <g class={s.face}>{body()}</g>
        </svg>
    );
}

export const IconArrowLeft = icon("left", () => (
    <>
        <path d="M9.058 3.978L5.036 8L9.058 12.022L7.502 13.578L1.924 8L7.502 2.422Z" />
        <path d="M3.68 6.9L14.08 6.9L14.08 9.1L3.68 9.1L3.68 6.9Z" />
    </>
));
export const IconArrowRight = icon("right", () => (
    <>
        <path d="M6.942 3.978L10.964 8L6.942 12.022L8.498 13.578L14.076 8L8.498 2.422Z" />
        <path d="M12.32 6.9L1.92 6.9L1.92 9.1L12.32 9.1L12.32 6.9Z" />
    </>
));
export const IconForward = icon("right", () => (
    <>
        <path d="M6.942 3.978L10.964 8L6.942 12.022L8.498 13.578L14.076 8L8.498 2.422Z" />
        <path d="M12.32 6.9L1.92 6.9L1.92 9.1L12.32 9.1L12.32 6.9Z" />
    </>
));
export const IconRefresh = icon("refresh", () => (
    <>
        <path d="M13.6 8.6C13.6 11.693 11.093 14.2 8 14.2C4.907 14.2 2.4 11.693 2.4 8.6C2.4 5.507 4.907 3 8 3L8 5.2C6.122 5.2 4.6 6.722 4.6 8.6C4.6 10.478 6.122 12 8 12C9.878 12 11.4 10.478 11.4 8.6Z" />
        <path d="M8 1.8L11.6 4.1L8 6.4L8 1.8Z" />
    </>
));
export const IconPlus = icon("plus", () => (
    <>
        <path d="M9.2 2.4L9.2 13.6L6.8 13.6L6.8 2.4L9.2 2.4Z" />
        <path d="M2.4 6.8L13.6 6.8L13.6 9.2L2.4 9.2L2.4 6.8Z" />
    </>
));
// Two bars cut by the wordmark's rule: where they cross, their overlap is
// knocked out, the same diamond as the X in CIVIL PROXY.
export const IconClose = icon("close", () => (
    <>
        <path d="M4.449 2.751L13.249 11.551L11.551 13.249L2.751 4.449ZM8 6.303L6.303 8L8 9.697L9.697 8Z" />
        <path d="M13.249 4.449L4.449 13.249L2.751 11.551L11.551 2.751ZM8 6.303L6.303 8L8 9.697L9.697 8Z" />
    </>
));
export const IconChevronDown = icon("down", () => (
    <path d="M4.049 4.331L8 8.283L11.951 4.331L13.649 6.029L8 11.677L2.351 6.029Z" />
));
export const IconSearch = icon("search", () => (
    <>
        <path d="M6.24 1.49C8.863 1.49 10.99 3.617 10.99 6.24C10.99 8.863 8.863 10.99 6.24 10.99C3.617 10.99 1.49 8.863 1.49 6.24C1.49 3.617 3.617 1.49 6.24 1.49ZM6.24 3.69C4.832 3.69 3.69 4.832 3.69 6.24C3.69 7.648 4.832 8.79 6.24 8.79C7.648 8.79 8.79 7.648 8.79 6.24C8.79 4.832 7.648 3.69 6.24 3.69Z" />
        <path d="M10.509 8.671L14.509 12.671L12.671 14.509L8.671 10.509L10.509 8.671Z" />
    </>
));
// The keyhole is the Doorway itself: a door with a quadrant head, cut through.
export const IconLock = icon("lock", () => (
    <>
        <path d="M4.5 6.5L4.5 6C4.5 4.067 6.067 2.5 8 2.5C9.933 2.5 11.5 4.067 11.5 6L11.5 6.5L9.7 6.5L9.7 6C9.7 5.061 8.939 4.3 8 4.3C7.061 4.3 6.3 5.061 6.3 6L6.3 6.5Z" />
        <path d="M3.5 6.5L12.5 6.5L12.5 13.5L3.5 13.5ZM7 12L9 12L9 8.5C7.895 8.5 7 9.395 7 10.5Z" />
    </>
));
export const IconWorld = icon("world", () => (
    <>
        <path d="M8 2C11.314 2 14 4.686 14 8C14 11.314 11.314 14 8 14C4.686 14 2 11.314 2 8C2 4.686 4.686 2 8 2ZM8 3.6C5.57 3.6 3.6 5.57 3.6 8C3.6 10.43 5.57 12.4 8 12.4C10.43 12.4 12.4 10.43 12.4 8C12.4 5.57 10.43 3.6 8 3.6Z" />
        <path d="M8 2.1C9.491 2.1 10.7 4.741 10.7 8C10.7 11.259 9.491 13.9 8 13.9C6.509 13.9 5.3 11.259 5.3 8C5.3 4.741 6.509 2.1 8 2.1ZM8 3.5C7.282 3.5 6.7 5.515 6.7 8C6.7 10.485 7.282 12.5 8 12.5C8.718 12.5 9.3 10.485 9.3 8C9.3 5.515 8.718 3.5 8 3.5Z" />
        <path d="M2.4 7.2L13.6 7.2L13.6 8.8L2.4 8.8L2.4 7.2Z" />
    </>
));
// One even-odd path: where the two rings' bands cross, they knock each other
// out, so the links read as interlocked rather than stacked.
export const IconLink = icon("link", () => (
    <path d="M6.656 12.597C6.225 13.028 5.64 13.271 5.03 13.271C4.419 13.271 3.834 13.028 3.403 12.597C2.972 12.166 2.729 11.581 2.729 10.97C2.729 10.36 2.972 9.775 3.403 9.344L6.232 6.515C6.279 6.468 6.329 6.422 6.38 6.38C6.422 6.329 6.468 6.279 6.515 6.232L9.344 3.403C9.775 2.972 10.36 2.729 10.97 2.729C11.581 2.729 12.166 2.972 12.597 3.403C13.028 3.834 13.271 4.419 13.271 5.03C13.271 5.64 13.028 6.225 12.597 6.656L9.768 9.485C9.721 9.532 9.671 9.578 9.62 9.62C9.578 9.671 9.532 9.721 9.485 9.768ZM5.631 11.571L7.231 9.971C6.966 9.857 6.723 9.693 6.515 9.485C6.307 9.277 6.143 9.034 6.029 8.769L4.429 10.369C4.097 10.701 4.097 11.239 4.429 11.571C4.761 11.903 5.299 11.903 5.631 11.571ZM8.769 6.029C9.034 6.143 9.277 6.307 9.485 6.515C9.693 6.723 9.857 6.966 9.971 7.231L11.571 5.631C11.903 5.299 11.903 4.761 11.571 4.429C11.239 4.097 10.701 4.097 10.369 4.429ZM7.231 9.971C7.516 10.094 7.825 10.159 8.142 10.159C8.685 10.159 9.208 9.967 9.62 9.62C9.967 9.208 10.159 8.685 10.159 8.142C10.159 7.825 10.094 7.516 9.971 7.231L8.743 8.459C8.694 8.508 8.641 8.55 8.584 8.584C8.55 8.641 8.508 8.694 8.459 8.743ZM6.029 8.769L7.257 7.541C7.306 7.492 7.359 7.45 7.416 7.416C7.45 7.359 7.492 7.306 7.541 7.257L8.769 6.029C8.484 5.906 8.175 5.841 7.859 5.841C7.315 5.841 6.792 6.033 6.38 6.38C6.033 6.792 5.841 7.315 5.841 7.859C5.841 8.175 5.906 8.484 6.029 8.769ZM7.541 8.459C7.824 8.742 8.257 8.784 8.584 8.584C8.784 8.257 8.742 7.824 8.459 7.541C8.176 7.258 7.743 7.216 7.416 7.416C7.216 7.743 7.258 8.176 7.541 8.459Z" />
));
export const IconArrowUpRight = icon("out", () => (
    <>
        <path d="M3.162 11.282L10.362 4.082L11.918 5.638L4.718 12.838L3.162 11.282Z" />
        <path d="M5.94 3.16L12.84 3.16L12.84 10.06L10.64 10.06L10.64 5.36L5.94 5.36Z" />
    </>
));
// Verdict tiles carry the Doorway's door head on one corner.
export const IconCheck = icon("check", () => (
    <path d="M6 2L14 2L14 14L2 14L2 6C2 3.791 3.791 2 6 2ZM5.272 7.628L3.928 8.972L7.1 12.144L12.272 6.972L10.928 5.628L7.1 9.456Z" />
));
export const IconAlert = icon("alert", () => (
    <path d="M8 2.1L14.4 13.9L1.6 13.9ZM8.85 6.1L7.15 6.1L7.15 9.9L8.85 9.9ZM7.15 11.2L7.15 12.9L8.85 12.9L8.85 11.2Z" />
));
export const IconBan = icon("ban", () => (
    <>
        <path d="M8 2C11.314 2 14 4.686 14 8C14 11.314 11.314 14 8 14C4.686 14 2 11.314 2 8C2 4.686 4.686 2 8 2ZM8 3.8C6.499 3.8 5.113 4.601 4.363 5.9C3.612 7.2 3.612 8.8 4.363 10.1C5.113 11.399 6.499 12.2 8 12.2C9.5 12.2 10.887 11.399 11.637 10.1C12.388 8.8 12.388 7.2 11.637 5.9C10.887 4.601 9.5 3.8 8 3.8Z" />
        <path d="M3.664 11.064L11.064 3.664L12.336 4.936L4.936 12.336L3.664 11.064Z" />
    </>
));
export const IconSpinner = icon("spinner", () => (
    <path d="M13.8 8C13.8 11.203 11.203 13.8 8 13.8C4.797 13.8 2.2 11.203 2.2 8C2.2 4.797 4.797 2.2 8 2.2L8 4.2C5.901 4.2 4.2 5.901 4.2 8C4.2 10.099 5.901 11.8 8 11.8C10.099 11.8 11.8 10.099 11.8 8Z" />
));
// The "unknown" verdict: the same tile as the check, with an empty socket.
export const IconSpinnerFilled = icon("socket", () => (
    <path d="M6 2L14 2L14 14L2 14L2 6C2 3.791 3.791 2 6 2ZM5.5 5.5L5.5 10.5L10.5 10.5L10.5 5.5Z" />
));
export const IconBookmark = icon("bookmark", () => (
    <path d="M6 2L12 2L12 14L8 10.8L4 14L4 4C4 2.895 4.895 2 6 2ZM6.4 5L6.4 6.5L9.6 6.5L9.6 5Z" />
));
export const IconBookmarkFilled = icon("bookmark-filled", () => (
    <path d="M6 2L12 2L12 14L8 10.8L4 14L4 4C4 2.895 4.895 2 6 2Z" />
));
export const IconBookmarkOutline = icon("bookmark-outline", () => (
    <path d="M6 2L12 2L12 14L8 10.8L4 14L4 4C4 2.895 4.895 2 6 2ZM6 3.6C5.779 3.6 5.6 3.779 5.6 4L5.6 10.671L8 8.751L10.4 10.671L10.4 3.6Z" />
));
export const IconPuzzle = icon("puzzle", () => (
    <>
        <path d="M2.47 5.02L5.169 5.02C5.164 5.012 5.159 5.003 5.154 4.995C4.842 4.453 4.842 3.786 5.154 3.245C5.467 2.704 6.045 2.37 6.67 2.37C7.295 2.37 7.873 2.704 8.186 3.245C8.498 3.786 8.498 4.453 8.186 4.995C8.181 5.003 8.176 5.012 8.171 5.02L10.87 5.02L10.87 13.62L2.47 13.62L2.47 10.62C2.934 10.62 3.364 10.372 3.596 9.97C3.828 9.568 3.828 9.072 3.596 8.67C3.364 8.268 2.934 8.02 2.47 8.02Z" />
        <path d="M11.77 7.57C12.736 7.57 13.52 8.353 13.52 9.32C13.52 10.287 12.736 11.07 11.77 11.07C10.804 11.07 10.02 10.287 10.02 9.32C10.02 8.353 10.804 7.57 11.77 7.57Z" />
    </>
));
export const IconClock = icon("clock", () => (
    <>
        <path d="M8 2C11.314 2 14 4.686 14 8C14 11.314 11.314 14 8 14C4.686 14 2 11.314 2 8C2 4.686 4.686 2 8 2ZM8 3.8C6.499 3.8 5.113 4.601 4.363 5.9C3.612 7.2 3.612 8.8 4.363 10.1C5.113 11.399 6.499 12.2 8 12.2C9.5 12.2 10.887 11.399 11.637 10.1C12.388 8.8 12.388 7.2 11.637 5.9C10.887 4.601 9.5 3.8 8 3.8Z" />
        <path d="M8.9 4.6L8.9 7.1L11.2 7.1L11.2 8.9L7.1 8.9L7.1 4.6Z" />
    </>
));
// The lid rests ajar, tipped up off the can: the bin is open for business.
export const IconTrash = icon("trash", () => (
    <>
        <path d="M2.85 4.35L12.85 2.55L13.15 4.15L3.15 5.95ZM6.45 3.35L6.25 2.25L9.05 1.75L9.25 2.85Z" />
        <path d="M4.25 6.15L12.25 6.15L11.45 13.15C11.398 13.773 10.876 14.252 10.25 14.25L6.25 14.25C5.624 14.252 5.102 13.773 5.05 13.15ZM6.85 7.85L6.85 12.35L7.85 12.35L7.85 7.85ZM8.65 7.85L8.65 12.35L9.65 12.35L9.65 7.85Z" />
    </>
));
// Four tiles, so the New Tab shortcut reads as "apps" rather than "a window".
// Each tile's inner corner is a door head, so the four open onto one centre.
export const IconApps = icon("apps", () => (
    <>
        <path d="M2 2L7 2L7 4.5C7 5.881 5.881 7 4.5 7L2 7L2 2Z" />
        <path d="M9 2L14 2L14 7L11.5 7C10.119 7 9 5.881 9 4.5L9 2Z" />
        <path d="M2 9L4.5 9C5.881 9 7 10.119 7 11.5L7 14L2 14L2 9Z" />
        <path d="M11.5 9L14 9L14 14L9 14L9 11.5C9 10.119 10.119 9 11.5 9Z" />
    </>
));
// Three faders, so Settings reads as "adjust" rather than a machine part.
export const IconSliders = icon("sliders", () => (
    <>
        <path d="M2 3.3L14 3.3L14 4.7L2 4.7L2 3.3Z" />
        <path d="M4.6 1.8L6.4 1.8C6.731 1.8 7 2.069 7 2.4L7 5.6C7 5.931 6.731 6.2 6.4 6.2L4.6 6.2C4.269 6.2 4 5.931 4 5.6L4 2.4C4 2.069 4.269 1.8 4.6 1.8Z" />
        <path d="M2 7.3L14 7.3L14 8.7L2 8.7L2 7.3Z" />
        <path d="M9.6 5.8L11.4 5.8C11.731 5.8 12 6.069 12 6.4L12 9.6C12 9.931 11.731 10.2 11.4 10.2L9.6 10.2C9.269 10.2 9 9.931 9 9.6L9 6.4C9 6.069 9.269 5.8 9.6 5.8Z" />
        <path d="M2 11.3L14 11.3L14 12.7L2 12.7L2 11.3Z" />
        <path d="M6.1 9.8L7.9 9.8C8.231 9.8 8.5 10.069 8.5 10.4L8.5 13.6C8.5 13.931 8.231 14.2 7.9 14.2L6.1 14.2C5.769 14.2 5.5 13.931 5.5 13.6L5.5 10.4C5.5 10.069 5.769 9.8 6.1 9.8Z" />
    </>
));
export const IconLayoutNavbar = icon("panel-top", () => (
    <>
        <path d="M4 2L12 2C13.105 2 14 2.895 14 4L14 12C14 13.105 13.105 14 12 14L4 14C2.895 14 2 13.105 2 12L2 4C2 2.895 2.895 2 4 2ZM4.2 3.6C3.869 3.6 3.6 3.869 3.6 4.2L3.6 11.8C3.6 12.131 3.869 12.4 4.2 12.4L11.8 12.4C12.131 12.4 12.4 12.131 12.4 11.8L12.4 4.2C12.4 3.869 12.131 3.6 11.8 3.6Z" />
        <path d="M4 2L12 2C13.105 2 14 2.895 14 4L14 6.6L2 6.6L2 4C2 2.895 2.895 2 4 2Z" />
    </>
));
export const IconLayoutBottom = icon("panel-bottom", () => (
    <>
        <path d="M4 2L12 2C13.105 2 14 2.895 14 4L14 12C14 13.105 13.105 14 12 14L4 14C2.895 14 2 13.105 2 12L2 4C2 2.895 2.895 2 4 2ZM4.2 3.6C3.869 3.6 3.6 3.869 3.6 4.2L3.6 11.8C3.6 12.131 3.869 12.4 4.2 12.4L11.8 12.4C12.131 12.4 12.4 12.131 12.4 11.8L12.4 4.2C12.4 3.869 12.131 3.6 11.8 3.6Z" />
        <path d="M2 9.4L14 9.4L14 12C14 13.105 13.105 14 12 14L4 14C2.895 14 2 13.105 2 12L2 9.4Z" />
    </>
));
export const IconLayoutSidebar = icon("panel-left", () => (
    <>
        <path d="M4 2L12 2C13.105 2 14 2.895 14 4L14 12C14 13.105 13.105 14 12 14L4 14C2.895 14 2 13.105 2 12L2 4C2 2.895 2.895 2 4 2ZM4.2 3.6C3.869 3.6 3.6 3.869 3.6 4.2L3.6 11.8C3.6 12.131 3.869 12.4 4.2 12.4L11.8 12.4C12.131 12.4 12.4 12.131 12.4 11.8L12.4 4.2C12.4 3.869 12.131 3.6 11.8 3.6Z" />
        <path d="M4 2L6.6 2L6.6 14L4 14C2.895 14 2 13.105 2 12L2 4C2 2.895 2.895 2 4 2Z" />
    </>
));
export const IconLayoutSidebarRight = icon("panel-right", () => (
    <>
        <path d="M4 2L12 2C13.105 2 14 2.895 14 4L14 12C14 13.105 13.105 14 12 14L4 14C2.895 14 2 13.105 2 12L2 4C2 2.895 2.895 2 4 2ZM4.2 3.6C3.869 3.6 3.6 3.869 3.6 4.2L3.6 11.8C3.6 12.131 3.869 12.4 4.2 12.4L11.8 12.4C12.131 12.4 12.4 12.131 12.4 11.8L12.4 4.2C12.4 3.869 12.131 3.6 11.8 3.6Z" />
        <path d="M9.4 2L12 2C13.105 2 14 2.895 14 4L14 12C14 13.105 13.105 14 12 14L9.4 14L9.4 2Z" />
    </>
));
export const IconUpload = icon("upload", () => (
    <>
        <path d="M6.9 11.63L6.9 6.086L5.178 7.808L3.622 6.252L8 1.874L12.378 6.252L10.822 7.808L9.1 6.086L9.1 11.63Z" />
        <path d="M2.6 12.33L13.4 12.33L13.4 14.13L2.6 14.13L2.6 12.33Z" />
    </>
));
export const IconLoader = icon("loader", () => (
    <>
        <path d="M8.9 1.8L8.9 4.6L7.1 4.6L7.1 1.8ZM1.8 7.1L4.6 7.1L4.6 8.9L1.8 8.9ZM11.4 7.1L14.2 7.1L14.2 8.9L11.4 8.9ZM8.9 11.4L8.9 14.2L7.1 14.2L7.1 11.4Z" />
        <path d="M11.764 13.036L9.764 11.036L11.036 9.764L13.036 11.764ZM13.036 4.236L11.036 6.236L9.764 4.964L11.764 2.964ZM2.964 11.764L4.964 9.764L6.236 11.036L4.236 13.036ZM4.236 2.964L6.236 4.964L4.964 6.236L2.964 4.236Z" />
    </>
));
export const IconLoaderDots = icon("dots", () => (
    <>
        <path d="M2.4 6.7L5 6.7L5 9.3L2.4 9.3Z" />
        <path d="M6.7 6.7L9.3 6.7L9.3 9.3L6.7 9.3Z" />
        <path d="M11 6.7L13.6 6.7L13.6 9.3L11 9.3Z" />
    </>
));
// Preserve the third-party mark.
export const IconPatreon = icon("patreon", () => (
    <path d="M2.2 2.9C2.2 2.4 2.6 2 3.1 2h1.6c.5 0 .9.4.9.9v10.2c0 .5-.4.9-.9.9H3.1c-.5 0-.9-.4-.9-.9zM9.8 2.2c2.5 0 4.5 1.9 4.5 4.4 0 2.6-1.9 4.4-4.4 4.4-2.8 0-5.1-1.9-5.1-4.4 0-2.6 2.4-4.4 5-4.4z" />
));
