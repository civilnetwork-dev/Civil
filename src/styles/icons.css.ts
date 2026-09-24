import { globalStyle, style } from "@vanilla-extract/css";

export const icon = style({
    display: "inline-block",
    flexShrink: 0,
    verticalAlign: "middle",
    overflow: "visible",
});

// Animate the drawing, never its layout box. Parent focus makes the same
// feedback available to keyboard users. No timers or idle animation.
globalStyle(`.${icon} > path`, {
    transformOrigin: "8px 8px",
    transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
    "@media": { "(prefers-reduced-motion: reduce)": { transition: "none" } },
});

const motions: Record<string, Record<string, string>> = {
    left: { "1": "scaleX(0.85)", "2": "translateX(-1.5px)" },
    right: { "1": "scaleX(0.85)", "2": "translateX(1.5px)" },
    refresh: { "1": "rotate(30deg)", "2": "rotate(30deg) scale(0.9)" },
    plus: { "1": "scaleY(0.72)", "2": "scaleX(1.15)" },
    close: {
        "1": "rotate(12deg) scale(0.85)",
        "2": "rotate(-12deg) scale(0.85)",
    },
    down: { "1": "translateY(1.5px) scaleX(0.85)" },
    search: { "1": "scale(1.08)", "2": "translate(1px, 1px)" },
    lock: { "1": "translateY(-1.5px) rotate(-8deg)", "3": "scaleY(0.65)" },
    world: { "2": "scaleX(0.5)", "3": "rotate(-12deg)" },
    link: {
        "1": "translate(1px, -1px)",
        "2": "translate(-1px, 1px)",
        "3": "scale(0.8)",
    },
    out: { "1": "scale(0.85)", "2": "translate(1px, -1px)" },
    check: { "1": "scale(1.08)" },
    alert: { "1": "scaleY(1.08)" },
    ban: { "2": "rotate(12deg)" },
    spinner: { "1": "rotate(45deg) scale(0.9)" },
    bookmark: { "1": "translateY(-1px)", "2": "translateY(-1px) scaleX(0.6)" },
    puzzle: { "1": "rotate(-8deg)", "2": "translateY(-1.5px) rotate(8deg)" },
    clock: { "2": "rotate(45deg)" },
    trash: { "1": "translateY(-1.5px) rotate(-10deg)", "3": "scaleY(0.7)" },
    apps: {
        "1": "translate(-0.75px, -0.75px)",
        "2": "translate(0.75px, -0.75px)",
        "3": "translate(-0.75px, 0.75px)",
        "4": "translate(0.75px, 0.75px)",
    },
    "panel-top": { "2": "translateY(2px)" },
    "panel-bottom": { "2": "translateY(-2px)" },
    "panel-left": { "2": "translateX(2px)" },
    "panel-right": { "2": "translateX(-2px)" },
    upload: { "1": "translateY(-1.5px)", "2": "scaleX(0.85)" },
    loader: { "1": "rotate(45deg)", "2": "rotate(-45deg)" },
    dots: {
        "1": "translateY(-1px)",
        "2": "scale(1.25)",
        "3": "translateY(1px)",
    },
    patreon: { "1": "rotate(-6deg) scale(1.04)" },
};
for (const [name, parts] of Object.entries(motions)) {
    for (const [part, transform] of Object.entries(parts)) {
        const target = `.${icon}[data-icon="${name}"] > path:nth-child(${part})`;
        globalStyle(
            `:is(button, a, summary, [role="button"], [role="tab"]):focus-visible ${target}, .${icon}[data-icon="${name}"]:hover > path:nth-child(${part})`,
            {
                transform,
                "@media": {
                    "(prefers-reduced-motion: reduce)": { transform: "none" },
                },
            },
        );
        globalStyle(
            `:is(button, a, summary, [role="button"], [role="tab"]):not(:disabled):hover ${target}`,
            {
                "@media": {
                    "(hover: hover) and (prefers-reduced-motion: no-preference)":
                        { transform },
                },
            },
        );
    }
}
