import { keyframes, style } from "@vanilla-extract/css";
import {
    atmosphere,
    DUR,
    EASE,
    focusRing,
    hairline,
    hitArea,
    lit,
    machined,
    microLabel,
    SHADOW,
} from "./material.css";
import { vars } from "./theme.css";

const T_FAST = "0.1s ease";

const emptyFadeIn = keyframes({
    from: { opacity: 0, transform: "translateY(6px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const root = style({
    ...atmosphere(vars.color.sirius),
    minHeight: "100vh",
    display: "flex",
    fontFamily: '"Rubik", sans-serif',
    color: vars.color.daylight,
    boxSizing: "border-box",
    // Below this width a fixed 224px rail leaves ~150px for the list, which
    // renders rows as unusable slivers. The rail becomes a filter bar above
    // the content instead.
    "@media": {
        "(max-width: 720px)": {
            flexDirection: "column",
        },
    },
});

export const sidebar = style({
    width: "224px",
    flexShrink: 0,
    background: `linear-gradient(180deg, ${vars.color.night} 0%, ${vars.color.void} 100%)`,
    borderRight: `1px solid ${vars.color.horizon}`,
    boxShadow: "inset -1px 0 0 rgba(0,0,0,0.3)",
    padding: "36px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    "@media": {
        "(max-width: 720px)": {
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            gap: "8px",
            padding: "12px clamp(16px, 4vw, 24px)",
            borderRight: "none",
            borderBottom: `1px solid ${vars.color.horizon}`,
            boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.3)",
            background: `linear-gradient(180deg, ${vars.color.night} 0%, ${vars.color.void} 100%)`,
            overflowX: "auto",
            scrollbarWidth: "none",
        },
    },
});

export const sidebarTitle = style({
    ...microLabel,
    display: "flex",
    alignItems: "center",
    gap: "9px",
    padding: "0 8px",
    marginBottom: "14px",
    "@media": {
        // The page title already says "Bookmarks" once the rail is a bar.
        "(max-width: 720px)": { display: "none" },
    },
    selectors: {
        "&::after": {
            content: '""',
            flex: 1,
            height: "1px",
            background: `linear-gradient(90deg, ${vars.color.horizon}, transparent)`,
        },
    },
});

export const sidebarItem = style({
    display: "flex",
    alignItems: "center",
    gap: "9px",
    whiteSpace: "nowrap",
    flexShrink: 0,
    padding: "7px 10px",
    borderRadius: "8px",
    cursor: "pointer",
    color: vars.color.halo,
    background: "transparent",
    border: "none",
    fontSize: "13px",
    fontFamily: "inherit",
    fontWeight: 400,
    textAlign: "left",
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            background: vars.color.horizon,
            color: vars.color.daylight,
        },
    },
});

export const sidebarItemActive = style({
    position: "relative",
    background: `color-mix(in srgb, ${vars.color.sirius} 15%, transparent)`,
    color: vars.color.sirius,
    fontWeight: 500,
    selectors: {
        // A lit bar on the leading edge marks the selected filter the way a
        // channel strip marks the armed channel.
        "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            top: "22%",
            bottom: "22%",
            width: "2px",
            borderRadius: "0 2px 2px 0",
            background: vars.color.sirius,
            boxShadow: `0 0 8px color-mix(in srgb, ${vars.color.sirius} 70%, transparent)`,
            "@media": {
                // Horizontally the same marker belongs on the bottom edge.
                "(max-width: 720px)": {
                    left: "18%",
                    right: "18%",
                    top: "auto",
                    bottom: 0,
                    width: "auto",
                    height: "2px",
                    borderRadius: "2px 2px 0 0",
                },
            },
        },
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.sirius} 21%, transparent)`,
            color: vars.color.sirius,
        },
    },
});

export const main = style({
    flex: 1,
    padding: "40px clamp(20px, 4vw, 48px) 64px",
    minWidth: 0,
    overflowY: "auto",
    "@media": {
        "(max-width: 720px)": { padding: "28px clamp(16px, 4vw, 24px) 56px" },
    },
});

export const mainHeader = style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "26px",
    paddingBottom: "20px",
    gap: "16px",
    borderBottom: "1px solid transparent",
    borderImage: `${hairline(vars.color.haze)} 1`,
});

export const mainTitle = style({
    fontSize: "clamp(24px, 3.4vw, 31px)",
    fontWeight: 600,
    lineHeight: 1.05,
    letterSpacing: "-0.015em",
    color: vars.color.daylight,
});

export const searchInput = style({
    width: "240px",
    maxWidth: "100%",
    background: machined(
        vars.color.horizon,
        `color-mix(in srgb, ${vars.color.horizon} 80%, ${vars.color.night})`,
    ),
    border: `1px solid ${vars.color.haze}`,
    borderRadius: "10px",
    padding: "8px 14px",
    fontSize: "13px",
    color: vars.color.daylight,
    outline: "none",
    fontFamily: "inherit",
    boxShadow: lit(SHADOW.resting),
    transitionProperty: "border-color, box-shadow",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:focus": {
            borderColor: `color-mix(in srgb, ${vars.color.sirius} 70%, transparent)`,
            boxShadow: lit(focusRing(vars.color.sirius)),
        },
        "&::placeholder": { color: vars.color.cinder },
    },
});

export const list = style({
    display: "flex",
    flexDirection: "column",
    gap: "6px",
});

export const card = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px 12px 22px",
    borderRadius: "12px",
    background: machined(vars.color.horizon, vars.color.night),
    border: `1px solid ${vars.color.haze}`,
    cursor: "pointer",
    boxShadow: lit(SHADOW.resting),
    transitionProperty: "background, border-color, transform, box-shadow",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:hover": {
            borderColor: `color-mix(in srgb, ${vars.color.sirius} 40%, ${vars.color.haze})`,
            transform: "translateX(3px)",
            boxShadow: lit(SHADOW.lifted),
        },
        // A literal bookmark ribbon marks each row's leading edge instead of
        // the plain favicon-row recipe shared with History. Anchored to the
        // row's vertical centre like the favicon and text: pinned near the
        // top it sat on a different baseline to everything else in the row
        // and read as a rendering slip rather than a motif.
        "&::before": {
            content: '""',
            position: "absolute",
            left: "8px",
            top: "50%",
            width: "6px",
            height: "18px",
            marginTop: "-9px",
            background: vars.color.cinder,
            clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%)",
            transitionProperty: "background-color, height, margin-top",
            transitionTimingFunction: "ease",
            transitionDuration: "0.1s",
        },
        // Grows from the centre, so the hover state doesn't shunt it upward.
        "&:hover::before": {
            background: vars.color.sirius,
            height: "24px",
            marginTop: "-12px",
        },
    },
});

export const cardFavicon = style({
    width: "20px",
    height: "20px",
    borderRadius: "5px",
    objectFit: "contain",
    flexShrink: 0,
});

export const cardFaviconFallback = style({
    width: "20px",
    height: "20px",
    borderRadius: "5px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: vars.color.cinder,
    background: vars.color.haze,
});

export const cardInfo = style({
    flex: 1,
    minWidth: 0,
});

export const cardTitle = style({
    fontSize: "13px",
    fontWeight: 500,
    color: vars.color.daylight,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const cardUrl = style({
    fontSize: "11.5px",
    color: vars.color.moonlight,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: "2px",
});

export const removeBtn = style({
    position: "relative",
    background: "none",
    border: "none",
    color: vars.color.cinder,
    cursor: "pointer",
    padding: "4px",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    // Hover-/focus-revealed, matching the app tiles, history rows and
    // bookmark bar - six always-on delete crosses made the list read as a
    // management screen rather than a set of links.
    opacity: 0,
    // See AppsPage.removeBtn: hidden controls must not stay clickable.
    pointerEvents: "none",
    transitionProperty: "color, background, opacity",
    transitionTimingFunction: "ease",
    transitionDuration: "0.1s",
    selectors: {
        "&::after": hitArea(),
        [`${card}:hover &, &:focus-visible`]: {
            opacity: 1,
            pointerEvents: "auto",
        },
        "&:hover": {
            color: vars.color.antares,
            background: `color-mix(in srgb, ${vars.color.antares} 14%, transparent)`,
        },
    },
});

export const empty = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    marginTop: "60px",
    animationName: emptyFadeIn,
    animationTimingFunction: "ease",
    animationFillMode: "both",
    animationDuration: "0.3s",
});

// A large dimmed ribbon - the same clip-path silhouette as each row's
// leading edge, scaled up as the empty-state motif instead of stock text.
export const emptyRibbon = style({
    width: "28px",
    height: "40px",
    background: vars.color.haze,
    clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%)",
});

export const emptyText = style({
    color: vars.color.moonlight,
    fontSize: "14px",
    textAlign: "center",
});

export const clearBtn = style({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "none",
    border: `1px solid ${vars.color.haze}`,
    borderRadius: "8px",
    color: vars.color.moonlight,
    cursor: "pointer",
    padding: "6px 14px",
    fontSize: "13px",
    fontFamily: "inherit",
    transition: `color ${T_FAST}, border-color ${T_FAST}, background ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            color: vars.color.antares,
            borderColor: vars.color.antares,
            background: `color-mix(in srgb, ${vars.color.antares} 8%, transparent)`,
        },
    },
});

// Armed state for the second click on Clear.
export const clearBtnArmed = style({
    color: vars.color.antares,
    borderColor: vars.color.antares,
    background: `color-mix(in srgb, ${vars.color.antares} 14%, transparent)`,
});

// Recovery action inside an empty state - quiet, but a real target.
export const emptyAction = style({
    background: "none",
    border: `1px solid ${vars.color.haze}`,
    borderRadius: "8px",
    color: vars.color.halo,
    cursor: "pointer",
    padding: "6px 14px",
    fontSize: "13px",
    fontFamily: "inherit",
    transitionProperty: "color, border-color, background",
    transitionTimingFunction: "ease",
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            color: vars.color.daylight,
            borderColor: vars.color.ember,
            background: vars.color.horizon,
        },
    },
});

// Count beside the page title. moonlight rather than cinder: the previous
// inline style sat under the 4.5:1 contrast floor.
export const mainCount = style({
    color: vars.color.moonlight,
    fontSize: "16px",
    fontWeight: 400,
});

export const mainTitleGroup = style({
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    minWidth: 0,
});

export const mainEyebrow = style({
    ...microLabel,
    display: "flex",
    alignItems: "center",
    gap: "8px",
});

export const mainEyebrowMark = style({
    width: "16px",
    height: "2px",
    borderRadius: "1px",
    background: vars.color.sirius,
    opacity: 0.75,
});

export const mainActions = style({
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
});
