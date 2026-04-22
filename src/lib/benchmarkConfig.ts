import type { ColorName } from "@catppuccin/palette";
import { flavors } from "@catppuccin/palette";
import type { EChartsOption } from "echarts";
import { BarChart } from "echarts/charts";
import {
    GridComponent,
    MarkLineComponent,
    TitleComponent,
    TooltipComponent,
} from "echarts/components";
import { graphic, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

use([
    BarChart,
    TitleComponent,
    TooltipComponent,
    GridComponent,
    MarkLineComponent,
    CanvasRenderer,
]);

const toHex = ({ rgb: { r, g, b } }: { rgb: Record<string, number> }) =>
    `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;

export const colors = Object.fromEntries(
    Object.entries(flavors.macchiato.colors).map(([name, color]) => [
        name,
        toHex(color),
    ]),
) as Record<ColorName, string>;

export type ImplMetadata = { short: string; color: string; tag: string };

const IMPL_METADATA: Record<string, ImplMetadata> = {
    "UltraViolet new encoding method": {
        short: "UltraViolet new",
        color: colors.blue,
        tag: "JavaScript",
    },
    "UltraViolet old encoding method": {
        short: "UltraViolet old",
        color: colors.mauve,
        tag: "JavaScript",
    },
    "Civil C++/WebAssembly encoding method": {
        short: "C++/WASM",
        color: colors.green,
        tag: "WebAssembly",
    },
};

export function getImplMeta(impl: string): ImplMetadata {
    const l = impl.toLowerCase();
    if (l.includes("new"))
        return IMPL_METADATA["UltraViolet new encoding method"];
    if (l.includes("old"))
        return IMPL_METADATA["UltraViolet old encoding method"];
    return IMPL_METADATA["Civil C++/WebAssembly encoding method"];
}

export const FONT = '"Rubik", sans-serif';

export const axisBase = {
    axisLine: { lineStyle: { color: colors.surface2 } },
    axisTick: { show: false },
    splitLine: {
        lineStyle: { color: colors.surface0, type: "dashed" as const },
    },
    axisLabel: { color: colors.subtext0, fontFamily: FONT, fontSize: 11 },
};

export const gridBase = {
    left: "2%",
    right: "3%",
    top: "22%",
    bottom: "10%",
    containLabel: true,
};

export const tooltipBase = {
    trigger: "axis" as const,
    axisPointer: { type: "shadow" as const },
    backgroundColor: colors.mantle,
    borderColor: colors.surface2,
    borderWidth: 1,
    textStyle: { color: colors.text, fontFamily: FONT, fontSize: 12 },
    extraCssText: "box-shadow: 0 8px 32px rgba(0,0,0,0.4); border-radius: 8px;",
};

export const titleBase = (text: string, subtext: string) => ({
    text,
    subtext,
    left: "center" as const,
    top: 10,
    textStyle: {
        color: colors.text,
        fontSize: 11,
        fontWeight: 400,
        letterSpacing: 3,
        fontFamily: FONT,
    },
    subtextStyle: { color: colors.subtext0, fontSize: 10, fontFamily: FONT },
});

export function gradient(top: string, bottom: string) {
    return new graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: top },
        { offset: 1, color: bottom },
    ]);
}

export function barSeries(
    implColors: string[],
    values: number[],
    labelSuffix = "",
    labelColors?: string[],
    topAlpha = "",
) {
    return {
        type: "bar" as const,
        barMaxWidth: 56,
        emphasis: {
            itemStyle: { shadowBlur: 20, shadowColor: implColors[0] + "66" },
        },
        data: values.map((value, i) => ({
            value,
            itemStyle: {
                borderRadius: [5, 5, 0, 0],
                color: gradient(implColors[i] + topAlpha, implColors[i] + "33"),
            },
            label: {
                show: true,
                position: "top" as const,
                color: labelColors?.[i] ?? implColors[i],
                fontFamily: FONT,
                fontSize: 11,
                fontWeight: 700,
                formatter: `${value}${labelSuffix}`,
            },
        })),
    };
}

export type Run = {
    impl: string;
    total_ms: number;
    ops_per_sec: number;
    avg_ns_per_op: number;
};

export type Comparison = {
    baseline_impl: string;
    wasm_ops_per_sec: number | null;
    baseline_ops_per_sec: number;
    speedup_factor: number | null;
};

export interface BenchmarkData {
    iterations: number;
    runs: Run[];
    comparisons: Comparison[];
}

export const styles = {
    root: `background:${colors.base};min-height:100vh;color:${colors.text};font-family:${FONT};padding:2.5rem 2rem 3rem;box-sizing:border-box`,
    inner: `max-width:1100px;margin:0 auto`,
    chip: `display:inline-flex;align-items:center;gap:6px;background:${colors.surface0};border:1px solid ${colors.surface2};border-radius:999px;padding:3px 12px;font-size:10px;color:${colors.subtext0};letter-spacing:1px;text-transform:uppercase;margin-bottom:1.25rem`,
    h1: `margin:0 0 .3rem;font-size:clamp(1.6rem,4vw,2.6rem);font-weight:700;letter-spacing:-.04em;color:${colors.text};font-family:${FONT}`,
    subheading: `margin:0 0 2rem;color:${colors.subtext1};font-size:.82rem;font-weight:400`,
    heroLabel: `font-size:.75rem;color:${colors.subtext0};margin-top:.5rem;text-align:center`,
    pills: `display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:2rem`,
    grid2: `display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.25rem;margin-bottom:1.25rem`,
    card: `background:${colors.mantle};border:1px solid ${colors.surface0};border-radius:12px;overflow:hidden`,
    chartBox: `width:100%;height:300px`,
    fullCard: `background:${colors.mantle};border:1px solid ${colors.surface0};border-radius:12px;overflow:hidden;margin-bottom:1.25rem`,
    fullChart: `width:100%;height:280px`,
    tableWrap: `background:${colors.mantle};border:1px solid ${colors.surface0};border-radius:12px;overflow:hidden`,
    tableHead: `padding:.65rem 1.25rem;border-bottom:1px solid ${colors.surface0};font-size:.65rem;color:${colors.subtext0};letter-spacing:.12em;text-transform:uppercase`,
    table: `width:100%;border-collapse:collapse;font-size:.78rem`,
    th: `padding:.6rem 1.25rem;text-align:left;color:${colors.subtext0};font-weight:500;white-space:nowrap;border-bottom:1px solid ${colors.surface0}`,
    implCell: `display:inline-flex;align-items:center;gap:8px`,
    footer: `text-align:center;margin-top:2rem;color:${colors.overlay0};font-size:.68rem;letter-spacing:.08em`,
} as const;

export const heroCardStyle = (win: boolean) =>
    `display:inline-flex;flex-direction:column;align-items:center;background:${colors.mantle};border:1px solid ${win ? colors.green : colors.red}33;border-radius:14px;padding:1.5rem 3rem 1.25rem;box-shadow:0 0 60px ${win ? colors.green : colors.red}11;margin-bottom:2.5rem`;

export const heroNumberStyle = (win: boolean) =>
    `font-size:clamp(3rem,7vw,4.5rem);font-weight:900;color:${win ? colors.green : colors.red};line-height:1;letter-spacing:-.05em`;

export const pillStyle = (color: string) =>
    `display:inline-flex;align-items:center;gap:6px;background:${colors.surface0};border:1px solid ${color}44;border-radius:999px;padding:4px 12px;font-size:.72rem;color:${colors.subtext1}`;

export const dotStyle = (color: string) =>
    `width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0`;

export const implTagStyle = (color: string) =>
    `background:${color}22;color:${color};border-radius:4px;padding:1px 6px;font-size:.65rem;font-weight:700`;

export const tableCellStyle = (rowIndex: number) =>
    `padding:.65rem 1.25rem;border-bottom:1px solid ${colors.surface0};background:${rowIndex % 2 ? colors.surface0 + "44" : "transparent"}`;

export type { EChartsOption };
