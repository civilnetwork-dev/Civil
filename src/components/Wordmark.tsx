import type { JSX } from "@solidjs/web";

import { actEnd, actStart } from "~/lib/acts";

import { vars } from "~/styles/theme.css";
import * as s from "~/styles/Wordmark.css";

export type WordmarkProps = {
    /** Rendered width in px. Height follows the 1729.44 × 226.6 ratio. */
    width?: number;
    class?: string;
};

/**
 * The stone, one path per course so each can move on hover: the top course,
 * then left and right of the door for each course below it.
 */
const COURSES = [
    "M0 0H128V56H0Z",
    "M0 64H128A64 64 0 0 0 66.03 112H0Z",
    "M128 64H192V112H128Z",
    "M0 120H64V168H0Z",
    "M128 120H192V168H128Z",
    "M0 176H64V224H0Z",
    "M128 176H192V224H128Z",
];

/**
 * The door: where the two slabs overlap. The zero-length H is its right jamb,
 * which moves on hover as the slabs slide together.
 */
const DOOR = "M64 224V128A64 64 0 0 1 128 64H128V224Z";

/**
 * CIVIL PROXY, one path per letter, each holding its own counters, filled
 * even-odd. The X is drawn as its two bars, whose overlap that rule knocks
 * out, so it can come apart on hover.
 */
const LETTERS = [
    // C
    "M338.17 226.6Q316.63 226.6 300.56 217.35Q284.33 208.01 275.51 189.67Q266.84 171.66 266.84 145.08Q266.84 118.54 275.48 100Q284.28 81.14 300.46 71.25Q316.57 61.4 338.17 61.4Q360.23 61.4 375.06 70.74Q389.93 80.1 398.7 99.5L400.4 103.25L363.68 122.3L362.19 117.26Q359.73 108.94 354.08 104.02Q348.69 99.34 338.17 99.34Q325.53 99.34 318.04 107.39Q310.42 115.57 310.42 131.86L310.42 156.14Q310.42 172.23 318.05 180.52Q325.54 188.66 338.17 188.66Q348.63 188.66 354.65 183.18Q361.14 177.27 364.24 168.94L366.03 164.12L400.87 184.34L399.07 187.98Q390.12 206.12 375.31 216.3Q360.33 226.6 338.17 226.6Z",
    // I
    "M417.52 224L417.52 189.09L437.03 189.09L437.03 98.91L417.52 98.91L417.52 64L498.17 64L498.17 98.91L478.66 98.91L478.66 189.09L498.17 189.09L498.17 224Z",
    // V
    "M562.87 224L511.29 64L553.83 64L577.36 139.79L585.36 171.65L593.06 139.81L616.6 64L658.07 64L606.03 224Z",
    // I
    "M671.18 224L671.18 189.09L690.69 189.09L690.69 98.91L671.18 98.91L671.18 64L751.83 64L751.83 98.91L732.31 98.91L732.31 189.09L751.83 189.09L751.83 224Z",
    // L
    "M780.23 224L780.23 64L821.85 64L821.85 186.06L879.52 186.06L879.52 224Z",
    // P
    "M968.41 224L968.41 64L1044.29 64Q1059.57 64 1070.89 70.67Q1082.26 77.38 1088.47 89.44Q1094.59 101.32 1094.59 116.68Q1094.59 132.05 1088.46 143.83Q1082.26 155.76 1070.91 162.57Q1059.59 169.37 1044.29 169.37L1010.04 169.37L1010.04 224ZM1010.04 132.08L1040.39 132.08Q1044.35 132.08 1046.91 130.8Q1049.22 129.65 1050.51 127.41Q1051.88 125.05 1051.88 121.45L1051.88 111.91Q1051.88 108.13 1050.55 105.91Q1049.25 103.74 1046.91 102.57Q1044.35 101.29 1040.39 101.29L1010.04 101.29Z",
    // R
    "M1220.42 162.44L1251.2 224L1204.81 224L1178.36 168.5L1161.8 168.5L1161.8 224L1120.17 224L1120.17 64L1196.27 64Q1211.56 64 1222.77 70.68Q1234.02 77.38 1240.23 89.32Q1246.35 101.1 1246.35 116.68Q1246.35 133.04 1238.92 145.66Q1232.46 156.64 1220.42 162.44ZM1161.8 132.08L1192.15 132.08Q1196.11 132.08 1198.67 130.8Q1200.98 129.65 1202.28 127.41Q1203.64 125.05 1203.64 121.45L1203.64 111.91Q1203.64 108.13 1202.31 105.91Q1201.01 103.74 1198.67 102.57Q1196.11 101.29 1192.15 101.29L1161.8 101.29Z",
    // O
    "M1340.88 226.6Q1319.75 226.6 1303.66 217.11Q1287.44 207.54 1278.64 188.89Q1269.98 170.55 1269.98 144Q1269.98 117.22 1278.64 99Q1287.45 80.45 1303.66 70.89Q1319.75 61.4 1340.88 61.4Q1362.23 61.4 1378.22 70.9Q1394.31 80.46 1403.12 99Q1411.77 117.22 1411.77 144Q1411.77 170.55 1403.12 188.89Q1394.31 207.54 1378.22 217.1Q1362.23 226.6 1340.88 226.6ZM1340.88 188.66Q1349.6 188.66 1355.58 184.88Q1361.52 181.14 1364.78 173.88Q1368.2 166.27 1368.2 155.27L1368.2 132.73Q1368.2 121.52 1364.79 114.03Q1361.53 106.87 1355.58 103.12Q1349.6 99.34 1340.88 99.34Q1332.36 99.34 1326.25 103.13Q1320.22 106.88 1316.97 114.03Q1313.56 121.52 1313.56 132.73L1313.56 155.27Q1313.56 166.27 1316.98 173.88Q1320.23 181.13 1326.25 184.87Q1332.36 188.66 1340.88 188.66Z",
    // X
    "M1425.68 64L1474.4 64L1578.24 224L1529.75 224ZM1529.78 64L1575.75 64L1469.16 224L1423.18 224Z",
    // Y
    "M1632.69 224L1632.69 161.61L1577.8 64L1624.66 64L1654.73 119.74L1683.61 64L1729.44 64L1674.54 161.4L1674.54 224Z",
];

/**
 * Civil Proxy's lockup: the Doorway, then CIVIL PROXY.
 *
 * The Doorway is two stone slabs, a tall square one and a shorter one with a
 * quadrant on its top-left corner, combined by XOR: where they overlap, a door
 * opens through both, the same rule as Civil's URL codec. The door's head is
 * the short slab's quadrant and its lintel is the tall slab standing above the
 * short one, so the door is exactly one cap tall. Where the two outlines cross,
 * at the door's top-right corner, the slabs touch at a single point: that kiss
 * is the visible proof of the overlap, so keep it. The stone is cut into
 * courses on the 16-unit grid, the first joint landing on the door's head.
 *
 * The caps are IBM Plex Sans Bold outlines grown 20 units and tracked 44, so
 * the name cannot be retyped in the UI font. PROXY's X is rebuilt from its two
 * bars, combined by the same XOR, which knocks a diamond out of the crossing.
 * Both slabs stand on the type baseline with the short one's top at cap height.
 *
 * Keep the geometry in sync with public/assets/civil-wordmark.svg,
 * public/favicon.ico and the mark in LoadingAnimation.tsx.
 */
export function Wordmark(props: WordmarkProps): JSX.Element {
    const w = () => props.width ?? 240;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1729.44 226.6"
            width={w()}
            height={(w() * 226.6) / 1729.44}
            class={[s.wordmark, props.class]}
            role="img"
            aria-label="Civil Proxy"
            onAnimationStart={actStart}
            onAnimationEnd={actEnd}
            onAnimationCancel={actEnd}
        >
            <g fill={vars.color.firn}>
                {COURSES.map(d => (
                    <path d={d} />
                ))}
            </g>
            <path fill={vars.color.cobalt} d={DOOR} />
            <g fill={vars.color.firn} fill-rule="evenodd">
                {LETTERS.map(d => (
                    <path d={d} />
                ))}
            </g>
        </svg>
    );
}
