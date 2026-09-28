import { HydrationScript, type JSX } from "@solidjs/web";
import { For } from "solid-js";

import { PALETTE } from "./styles/palette";

/**
 * Proxy runtime scripts. Only the two routes that actually host a proxied
 * frame pay for them; every other route would download the transports and
 * never open a connection.
 */
const proxyScripts = [
    "/wasm_dencode.js",
    "/baremux/index.js",
    "/scramjet/scramjet.js",
    "/scramjetController/controller.api.js",
    "/scramjet_init.js",
];

/**
 * The whole document is what gets hydrated, so both entries render this same
 * tree - the server through `renderToStream`, the client through `hydrate`.
 * Anything that exists on only one side goes through `props.scripts`, a
 * trailing slot in `<head>`: the client passes nothing, and because the slot
 * is last it shifts no positional hydration claim ahead of it.
 *
 * `<!DOCTYPE html>` is prepended by the plugin's handler, not rendered here.
 */
export default function Document(props: {
    /** The page being rendered: the request's on the server, the browser's on the client. */
    pathname: string;
    children?: JSX.Element;
    scripts?: JSX.Element;
}) {
    const isProxy = ["/", "/newtab"].includes(props.pathname);

    return (
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <link rel="icon" href="/favicon.ico" />
                {isProxy && (
                    <For each={proxyScripts} keyed={false}>
                        {path => <script defer src={path()} />}
                    </For>
                )}
                <HydrationScript />
                {props.scripts}
            </head>
            <body>
                <div id="app">{props.children}</div>
                {/*
                 * The relief every Specimen glyph is lit with, declared once
                 * per document because each internal page is its own
                 * document inside a tab's frame. Fractal grain is folded
                 * into the glyph's softened alpha as a height map, lit from
                 * the upper left, clipped back to the glyph, and laid over a
                 * hard basalt drop. It is applied to the glyph's <svg>, so
                 * units are CSS pixels, sized for the 26 to 36px glyphs
                 * specimens hold.
                 */}
                <svg
                    aria-hidden="true"
                    width="0"
                    height="0"
                    style={{ position: "absolute" }}
                >
                    <filter
                        id="civil-emboss"
                        x="-30%"
                        y="-30%"
                        width="160%"
                        height="160%"
                        color-interpolation-filters="sRGB"
                    >
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.65"
                            numOctaves="2"
                            seed="4"
                            result="grain"
                        />
                        <feGaussianBlur
                            in="SourceAlpha"
                            stdDeviation="1"
                            result="soft"
                        />
                        <feComposite
                            in="grain"
                            in2="soft"
                            operator="arithmetic"
                            k2="0.22"
                            k3="1"
                            result="relief"
                        />
                        <feSpecularLighting
                            in="relief"
                            surfaceScale="2.4"
                            specularConstant="1.05"
                            specularExponent="16"
                            lighting-color={PALETTE.firn}
                            result="shine"
                        >
                            <feDistantLight azimuth="225" elevation="42" />
                        </feSpecularLighting>
                        <feComposite
                            in="shine"
                            in2="SourceAlpha"
                            operator="in"
                            result="lit"
                        />
                        <feOffset
                            in="SourceAlpha"
                            dx="0.7"
                            dy="1.4"
                            result="drop"
                        />
                        <feFlood
                            flood-color={PALETTE.basalt}
                            flood-opacity="0.75"
                        />
                        <feComposite in2="drop" operator="in" result="shadow" />
                        <feMerge>
                            <feMergeNode in="shadow" />
                            <feMergeNode in="SourceGraphic" />
                            <feMergeNode in="lit" />
                        </feMerge>
                    </filter>
                </svg>
            </body>
        </html>
    );
}
