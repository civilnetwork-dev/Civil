import type { EChartsOption } from "echarts";
import { BarChart } from "echarts/charts";
import {
    GridComponent,
    MarkLineComponent,
    TooltipComponent,
} from "echarts/components";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { SlotName } from "../styles/palette";
import { PALETTE } from "../styles/palette";
import { FONT_MONO } from "../styles/schematic.css";

// TitleComponent is deliberately not registered: chart titles are DOM `Rule`s
// now, so they sit in the accessibility tree and match every other section
// heading in the app instead of being baked into a canvas.
use([
    BarChart,
    TooltipComponent,
    GridComponent,
    MarkLineComponent,
    CanvasRenderer,
]);

// echarts renders to canvas and cannot read CSS custom properties, so this
// needs the raw hex from PALETTE rather than the vanilla-extract contract.
export const colors: Record<SlotName, string> = PALETTE;

export type ImplMetadata = { short: string; color: string; tag: string };

const IMPL_METADATA: Record<string, ImplMetadata> = {
    "UltraViolet new encoding method": {
        short: "UltraViolet new",
        color: colors.cobalt,
        tag: "JavaScript",
    },
    "UltraViolet old encoding method": {
        short: "UltraViolet old",
        color: colors.sandstone,
        tag: "JavaScript",
    },
    "Civil C++/WebAssembly encoding method": {
        short: "C++/WASM",
        color: colors.juniper,
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

/**
 * echarts renders to canvas, so none of the schematic language reaches it
 * automatically — every rule, weight and typeface has to be restated here.
 *
 * What that language forbids matters as much as what it asks for. The charts
 * previously drew rounded bars (`borderRadius: [5,5,0,0]`) filled with vertical
 * gradients and lit by a shadow on hover. Rounded corners and simulated light
 * are exactly what the rest of the system dropped when it stopped being the
 * "backlit" metaphor, so a reader landing here met a different product. Bars
 * are now flat rectangles in one flat colour.
 */

export const axisBase = {
    axisLine: { lineStyle: { color: colors.talus } },
    axisTick: { show: false },
    // The ruled field on every other page is a hairline grid; the chart's
    // split lines are the same idea, so they are solid hairlines rather than
    // the dashes echarts defaults to.
    splitLine: { lineStyle: { color: colors.scree, type: "solid" as const } },
    axisLabel: { color: colors.snowmelt, fontFamily: FONT_MONO, fontSize: 10 },
};

export const gridBase = {
    left: "2%",
    right: "3%",
    top: "12%",
    bottom: "8%",
    containLabel: true,
};

export const tooltipBase = {
    trigger: "axis" as const,
    axisPointer: { type: "shadow" as const },
    backgroundColor: colors.basalt,
    borderColor: colors.talus,
    borderWidth: 1,
    textStyle: { color: colors.firn, fontFamily: FONT_MONO, fontSize: 12 },
    // Square, and no drop shadow: depth in this language comes from rules and
    // alignment, never from simulated light.
    extraCssText: "box-shadow:none;border-radius:0",
};

export const axisNameStyle = {
    color: colors.snowmelt,
    fontFamily: FONT_MONO,
    fontSize: 10,
};

/**
 * Flat bars, square corners, one colour each. `barMaxWidth` keeps a
 * three-implementation chart from rendering three slabs.
 */
export function barSeries(
    implColors: string[],
    values: number[],
    labelSuffix = "",
    labelColors?: string[],
) {
    return {
        type: "bar" as const,
        barMaxWidth: 44,
        data: values.map((value, i) => ({
            value,
            itemStyle: { color: implColors[i] },
            label: {
                show: true,
                position: "top" as const,
                color: labelColors?.[i] ?? implColors[i],
                fontFamily: FONT_MONO,
                fontSize: 11,
                fontWeight: 600,
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

export type { EChartsOption };
