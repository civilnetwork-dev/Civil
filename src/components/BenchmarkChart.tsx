import { init } from "echarts/core";
import { createEffect, createMemo, For, onSettled, Show } from "solid-js";

import Anno from "~/components/schematic/Anno";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import {
    axisBase,
    axisNameStyle,
    type BenchmarkData,
    barSeries,
    colors,
    type EChartsOption,
    getImplMeta,
    gridBase,
    tooltipBase,
} from "~/lib/benchmarkConfig";
import * as s from "~/styles/BenchmarksPage.css";

interface BenchmarkChartProps {
    data: BenchmarkData;
}

export default function BenchmarkChart(props: BenchmarkChartProps) {
    const runs = createMemo(() => props.data?.runs ?? []);
    const comparisons = createMemo(() => props.data?.comparisons ?? []);
    const iterations = createMemo(() => props.data?.iterations ?? 0);

    const wasmRow = createMemo(() =>
        runs().find(
            ({ impl }) => impl.includes("wasm") || impl.includes("c++"),
        ),
    );
    const bestJs = createMemo(() =>
        runs()
            .filter(
                ({ impl }) => !(impl.includes("wasm") || impl.includes("c++")),
            )
            .reduce<(typeof runs extends () => (infer R)[] ? R : never) | null>(
                (best, cur) =>
                    (best?.ops_per_sec ?? 0) > cur.ops_per_sec ? best : cur,
                null,
            ),
    );
    const headline = createMemo(() => {
        const w = wasmRow(),
            b = bestJs();
        return w && b ? (w.ops_per_sec / b.ops_per_sec).toFixed(2) : null;
    });
    const wasmWins = createMemo(() => parseFloat(headline() ?? "0") >= 1.0);

    const throughputOption = createMemo<EChartsOption | object>(() => {
        const r = runs();
        if (!r.length) return {};
        const names = r.map(({ impl }) => getImplMeta(impl).short);
        const implColors = r.map(({ impl }) => getImplMeta(impl).color);
        const values = r.map(
            ({ ops_per_sec }) => +(ops_per_sec / 1e6).toFixed(4),
        );
        return {
            backgroundColor: "transparent",
            tooltip: {
                ...tooltipBase,
                formatter: (params: { dataIndex: number; value: number }[]) => {
                    const p = params[0];
                    const c = implColors[p.dataIndex];
                    return (
                        `<span style="color:${c};font-weight:600">${names[p.dataIndex]}</span><br/>` +
                        `<span style="font-size:16px;font-weight:600;color:${c}">${p.value}</span>` +
                        `<span style="color:${colors.moonlight}"> Mops/s</span>`
                    );
                },
            },
            grid: gridBase,
            xAxis: { type: "category", data: names, ...axisBase },
            yAxis: {
                type: "value",
                name: "Mops/s",
                nameTextStyle: axisNameStyle,
                ...axisBase,
            },
            series: [barSeries(implColors, values)],
        };
    });

    const latencyOption = createMemo<EChartsOption | object>(() => {
        const r = runs();
        if (!r.length) return {};
        const names = r.map(({ impl }) => getImplMeta(impl).short);
        const implColors = r.map(({ impl }) => getImplMeta(impl).color);
        const values = r.map(({ avg_ns_per_op }) => +avg_ns_per_op.toFixed(1));
        return {
            backgroundColor: "transparent",
            tooltip: {
                ...tooltipBase,
                formatter: (params: { dataIndex: number; value: number }[]) => {
                    const p = params[0];
                    const c = implColors[p.dataIndex];
                    return (
                        `<span style="color:${c};font-weight:600">${names[p.dataIndex]}</span><br/>` +
                        `<span style="font-size:16px;font-weight:600;color:${c}">${p.value}</span>` +
                        `<span style="color:${colors.moonlight}"> ns/op</span>`
                    );
                },
            },
            grid: gridBase,
            xAxis: { type: "category", data: names, ...axisBase },
            yAxis: {
                type: "value",
                name: "ns/op",
                nameTextStyle: axisNameStyle,
                ...axisBase,
            },
            series: [barSeries(implColors, values)],
        };
    });

    const speedupOption = createMemo<EChartsOption | object>(() => {
        const comps = comparisons();
        if (!comps.length || comps[0].speedup_factor == null) return {};
        const names = comps.map(
            ({ baseline_impl }) => `vs ${getImplMeta(baseline_impl).short}`,
        );
        const values = comps.map(
            ({ speedup_factor }) => +(speedup_factor as number).toFixed(3),
        );
        const implColors = values.map(v =>
            v >= 1.0 ? colors.airglow : colors.antares,
        );
        return {
            backgroundColor: "transparent",
            tooltip: {
                ...tooltipBase,
                formatter: (params: { dataIndex: number; value: number }[]) => {
                    const p = params[0];
                    const win = p.value >= 1.0;
                    const c = win ? colors.airglow : colors.antares;
                    return (
                        `<span style="color:${colors.halo}">${names[p.dataIndex]}</span><br/>` +
                        `<span style="font-size:20px;font-weight:600;color:${c}">${p.value}×</span>` +
                        `<span style="color:${colors.moonlight}"> ${win ? "faster" : "slower"}</span>`
                    );
                },
            },
            grid: gridBase,
            xAxis: { type: "category", data: names, ...axisBase },
            yAxis: {
                type: "value",
                name: "× ratio",
                min: 0,
                nameTextStyle: axisNameStyle,
                ...axisBase,
                axisLabel: { ...axisBase.axisLabel, formatter: "{value}×" },
            },
            series: [
                {
                    ...barSeries(implColors, values, "×", implColors),
                    // The datum the whole page is oriented around, drawn as the
                    // one accent line on the chart.
                    markLine: {
                        silent: true,
                        symbol: "none",
                        lineStyle: {
                            color: colors.sirius,
                            type: "solid" as const,
                            width: 1,
                        },
                        data: [
                            {
                                yAxis: 1,
                                label: {
                                    formatter: "parity",
                                    color: colors.starlight,
                                    fontFamily: "monospace",
                                    fontSize: 10,
                                },
                            },
                        ],
                    },
                },
            ],
        };
    });

    let refThroughput!: HTMLDivElement;
    let refLatency!: HTMLDivElement;
    let refSpeedup!: HTMLDivElement;

    onSettled(() => {
        const maybeInit = (el: HTMLDivElement, opt: EChartsOption | object) => {
            if (!Object.keys(opt).length) return null;
            const c = init(el, null, { renderer: "canvas" });
            c.setOption(opt as EChartsOption);
            return c;
        };

        const cThroughput = maybeInit(refThroughput, throughputOption());
        const cLatency = maybeInit(refLatency, latencyOption());
        const cSpeedup = maybeInit(refSpeedup, speedupOption());

        if (cThroughput) {
            createEffect(throughputOption, opt => {
                if (Object.keys(opt).length)
                    cThroughput.setOption(opt as EChartsOption, true);
            });
        }
        if (cLatency) {
            createEffect(latencyOption, opt => {
                if (Object.keys(opt).length)
                    cLatency.setOption(opt as EChartsOption, true);
            });
        }
        if (cSpeedup) {
            createEffect(speedupOption, opt => {
                if (Object.keys(opt).length)
                    cSpeedup.setOption(opt as EChartsOption, true);
            });
        }

        const charts = [cThroughput, cLatency, cSpeedup].filter(
            Boolean,
        ) as NonNullable<typeof cThroughput>[];
        const ro = new ResizeObserver(() => {
            for (const c of charts) c.resize();
        });
        for (const el of [refThroughput, refLatency, refSpeedup])
            ro.observe(el);

        return () => {
            ro.disconnect();
            for (const c of charts) c.dispose();
        };
    });

    return (
        <Sheet density="fine">
            <TitleBlock
                eyebrow="measurement"
                title="XOR encoder benchmark"
                meta={`${iterations().toLocaleString()} iterations · ${String(runs().length)} implementations`}
            />

            <p class={s.lede}>
                Two UltraViolet JavaScript implementations compared against
                Civil's C++/WebAssembly encoder, built with Emscripten.
            </p>

            <Show when={headline()}>
                <div class={s.headline}>
                    <span class={wasmWins() ? s.figure.win : s.figure.loss}>
                        {headline()}×
                    </span>
                    <span class={s.headlineText}>
                        <span class={s.headlineClaim}>
                            WebAssembly is {wasmWins() ? "faster" : "slower"}{" "}
                            than the fastest JavaScript implementation measured.
                        </span>
                        <span class={s.headlineDatum}>
                            parity = 1.00× · higher is faster
                        </span>
                    </span>
                </div>
            </Show>

            <div class={s.legend}>
                <For each={runs()} keyed={false}>
                    {run => {
                        const m = () => getImplMeta(run().impl);
                        return (
                            <span class={s.legendItem}>
                                <span
                                    class={s.legendSwatch}
                                    style={{ background: m().color }}
                                    aria-hidden="true"
                                />
                                <span class={s.legendName}>{m().short}</span>
                                <span class={s.legendTag}>{m().tag}</span>
                            </span>
                        );
                    }}
                </For>
            </div>

            <div class={s.chartPair}>
                <div class={s.chartBlock}>
                    <Rule label="throughput" weight="major" />
                    <Anno muted class={s.chartCaption}>
                        millions of operations per second — higher is better
                    </Anno>
                    <div ref={refThroughput} class={s.chartBox} />
                </div>
                <div class={s.chartBlock}>
                    <Rule label="latency" weight="major" />
                    <Anno muted class={s.chartCaption}>
                        nanoseconds per operation — lower is better
                    </Anno>
                    <div ref={refLatency} class={s.chartBox} />
                </div>
            </div>

            <Show
                when={
                    comparisons().length > 0 &&
                    comparisons()[0].speedup_factor != null
                }
            >
                <div class={s.chartBlock}>
                    <Rule label="speedup factor" weight="major" />
                    <Anno muted class={s.chartCaption}>
                        wasm ÷ js — the marked line is parity
                    </Anno>
                    <div ref={refSpeedup} class={s.chartBoxWide} />
                </div>
            </Show>

            <Rule label="raw results" weight="major" />
            <div class={s.tableScroll}>
                <table class={s.table}>
                    <thead>
                        <tr>
                            <th class={s.th}>implementation</th>
                            <th class={s.thNum}>Mops/s</th>
                            <th class={s.thNum}>ns/op</th>
                            <th class={s.thNum}>total ms</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={runs()} keyed={false}>
                            {run => {
                                const m = () => getImplMeta(run().impl);
                                return (
                                    <tr>
                                        <td class={s.tdImpl}>
                                            <span class={s.implCell}>
                                                <span
                                                    class={s.legendSwatch}
                                                    style={{
                                                        background: m().color,
                                                    }}
                                                    aria-hidden="true"
                                                />
                                                {run().impl}
                                            </span>
                                        </td>
                                        <td class={s.tdLead}>
                                            {(run().ops_per_sec / 1e6).toFixed(
                                                4,
                                            )}
                                        </td>
                                        <td class={s.tdNum}>
                                            {run().avg_ns_per_op.toFixed(1)}
                                        </td>
                                        <td class={s.tdNum}>
                                            {run().total_ms.toFixed(1)}
                                        </td>
                                    </tr>
                                );
                            }}
                        </For>
                    </tbody>
                </table>
            </div>

            <Anno muted class={s.footer}>
                apache echarts · solidjs
            </Anno>
        </Sheet>
    );
}
