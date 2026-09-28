import { RouterProvider } from "@tanstack/solid-router";

import type { createRouter } from "./router";

/**
 * IBM Plex Sans and IBM Plex Mono, one superfamily.
 *
 * Rubik is a rounded geometric face — friendly, and working directly against a
 * language built from hairlines, square corners and measured rules. Plex was
 * drawn for technical documentation and its two cuts share a skeleton, so text
 * and data sit on the same rhythm instead of looking like two products.
 *
 * The sans is the variable cut: one file covering 100-700 rather than a
 * request per weight, which matters on the school networks this runs behind.
 * Plex Mono ships no variable version, so it takes the two weights the system
 * actually uses. Both are split by unicode-range, so a latin reader downloads
 * only the latin subset.
 */
import "@fontsource-variable/ibm-plex-sans/wght.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "~/styles/global.css";

export default function App(props: {
    router: ReturnType<typeof createRouter>;
}) {
    return <RouterProvider router={props.router} />;
}
