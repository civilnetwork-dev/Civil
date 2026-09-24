import type { JSX } from "@solidjs/web";

import { vars } from "~/styles/theme.css";

export type WordmarkProps = {
    /** Rendered width in px. Height follows the 376 × 92 ratio. */
    width?: number;
    class?: string;
};

/**
 * Civil Proxy's lockup: CIVIL steps down into PROXY, and the foot of the L is
 * the roof of the P. One stroke serves both letters, and its colour turns from
 * firn to cobalt at CIVIL's baseline, where the handoff happens.
 *
 * PROXY is painted first and the P runs a few units up under the L, so the two
 * colours overlap rather than abut and no anti-aliased seam shows at the
 * handoff. Keep the geometry in sync with public/assets/civil-wordmark.svg and
 * docs/brand/civil-proxy-logo.ai.
 */
export function Wordmark(props: WordmarkProps): JSX.Element {
    const w = () => props.width ?? 376;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 376.06 92"
            width={w()}
            height={(w() * 92) / 376.06}
            class={props.class}
            role="img"
            aria-label="Civil Proxy"
        >
            <path
                fill={vars.color.cobalt}
                d="M282.06 66.25C282.06 84.79 274.85 92 256.31 92C237.77 92 230.56 84.79 230.56 66.25C230.56 47.71 237.77 40.5 256.31 40.5C274.85 40.5 282.06 47.71 282.06 66.25ZM186.56 41.25L206.56 41.25C218.08 41.25 222.56 45.73 222.56 57.25C222.56 64.18 220.94 68.56 217.14 70.95L225.56 91.25L214.46 91.25L207 73.25C206.85 73.25 206.7 73.25 206.56 73.25L197.56 73.25L197.56 91.25L186.56 91.25ZM143.06 44.25L174.62 44.25C176.5 45.77 177.73 47.9 178.41 50.75C178.85 52.61 179.06 54.76 179.06 57.25C179.06 68.77 174.58 73.25 163.06 73.25L154.06 73.25L154.06 91.25L143.06 91.25ZM286.56 41.25L298.61 41.25L308.06 56.51L317.5 41.25L329.56 41.25L314.08 66.25L329.56 91.25L317.5 91.25L308.06 75.99L298.61 91.25L286.56 91.25L302.03 66.25ZM332.06 41.25L344.07 41.25L354.06 57.59L364.05 41.25L376.06 41.25L359.56 68.25L359.56 91.25L348.56 91.25L348.56 68.25ZM270.31 66.25C270.31 55.53 265.55 50 256.31 50C247.07 50 242.31 55.53 242.31 66.25C242.31 76.97 247.07 82.5 256.31 82.5C265.55 82.5 270.31 76.97 270.31 66.25ZM154.06 50.75L154.06 63.75L163.06 63.75C165.86 63.75 167.31 61.54 167.31 57.25C167.31 52.96 165.86 50.75 163.06 50.75ZM197.56 50.75L197.56 63.75L206.56 63.75C209.36 63.75 210.81 61.54 210.81 57.25C210.81 52.96 209.36 50.75 206.56 50.75Z"
            />
            <path
                fill={vars.color.firn}
                d="M50.56 15.75L37.68 15.75C35.46 11.61 31.46 9.5 25.75 9.5C16.51 9.5 11.75 15.02 11.75 25.75C11.75 36.47 16.51 42 25.75 42C31.46 42 35.46 39.89 37.68 35.75L50.56 35.75C48.07 46.94 40.49 51.5 25.75 51.5C7.21 51.5 0 44.29 0 25.75C0 7.21 7.21 0 25.75 0C40.49 0 48.07 4.56 50.56 15.75ZM72.06 0.75L83.12 0.75L95.56 31.47L108 0.75L119.06 0.75L98.81 50.75L92.31 50.75ZM143.06 0.75L154.06 0.75L154.06 41.25L163.06 41.25C172.09 41.25 176.8 44.01 178.41 50.75L143.06 50.75ZM57.06 0.75L68.06 0.75L68.06 50.75L57.06 50.75ZM123.06 0.75L134.06 0.75L134.06 50.75L123.06 50.75Z"
            />
        </svg>
    );
}
