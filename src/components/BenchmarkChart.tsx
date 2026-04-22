import { init } from "echarts/core";
import {
    createEffect,
    createMemo,
    For,
    onCleanup,
    onMount,
    Show,
} from "solid-js";

import {
    axisBase,
    type BenchmarkData,
    barSeries,
    colors,
    dotStyle,
    type EChartsOption,
    getImplMeta,
    gradient,
    gridBase,
    heroCardStyle,
    heroNumberStyle,
    implTagStyle,
    pillStyle,
    styles,
    tableCellStyle,
    titleBase,
    tooltipBase,
} from "~/lib/benchmarkConfig";

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
            title: titleBase(
                "THROUGHPUT",
                "Millions of operations / second (higher is better)",
            ),
            tooltip: {
                ...tooltipBase,
                formatter: (params: { dataIndex: number; value: number }[]) => {
                    const p = params[0];
                    const c = implColors[p.dataIndex];
                    return (
                        `<span style="color:${c};font-weight:700">${names[p.dataIndex]}</span><br/>` +
                        `<span style="font-size:16px;font-weight:700;color:${c}">${p.value}</span>` +
                        `<span style="color:${colors.subtext0}"> Mops/s</span>`
                    );
                },
            },
            grid: gridBase,
            xAxis: { type: "category", data: names, ...axisBase },
            yAxis: {
                type: "value",
                name: "Mops/s",
                nameTextStyle: {
                    color: colors.subtext0,
                    fontFamily: '"Rubik", sans-serif',
                    fontSize: 10,
                },
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
            title: titleBase(
                "LATENCY",
                "Nanoseconds / operation (lower is better)",
            ),
            tooltip: {
                ...tooltipBase,
                formatter: (params: { dataIndex: number; value: number }[]) => {
                    const p = params[0];
                    const c = implColors[p.dataIndex];
                    return (
                        `<span style="color:${c};font-weight:700">${names[p.dataIndex]}</span><br/>` +
                        `<span style="font-size:16px;font-weight:700;color:${c}">${p.value}</span>` +
                        `<span style="color:${colors.subtext0}"> ns/op</span>`
                    );
                },
            },
            grid: gridBase,
            xAxis: { type: "category", data: names, ...axisBase },
            yAxis: {
                type: "value",
                name: "ns/op",
                nameTextStyle: {
                    color: colors.subtext0,
                    fontFamily: '"Rubik", sans-serif',
                    fontSize: 10,
                },
                ...axisBase,
            },
            series: [barSeries(implColors, values, "", undefined, "cc")],
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
        const winFlags = values.map(v => v >= 1.0);
        const implColors = winFlags.map(win =>
            win ? colors.green : colors.red,
        );
        const botColors = winFlags.map(
            win => (win ? colors.teal : colors.maroon) + "44",
        );
        return {
            backgroundColor: "transparent",
            title: titleBase("SPEEDUP FACTOR", "Wasm / JS  (1.0 is parity)"),
            tooltip: {
                ...tooltipBase,
                formatter: (params: { dataIndex: number; value: number }[]) => {
                    const p = params[0];
                    const win = p.value >= 1.0;
                    const c = win ? colors.green : colors.red;
                    return (
                        `<span style="color:${colors.subtext1}">${names[p.dataIndex]}</span><br/>` +
                        `<span style="font-size:20px;font-weight:900;color:${c}">${p.value}×</span>` +
                        `<span style="color:${colors.subtext0}"> ${win ? "faster" : "slower"}</span>`
                    );
                },
            },
            grid: gridBase,
            xAxis: { type: "category", data: names, ...axisBase },
            yAxis: {
                type: "value",
                name: "× ratio",
                min: 0,
                nameTextStyle: {
                    color: colors.subtext0,
                    fontFamily: '"Rubik", sans-serif',
                    fontSize: 10,
                },
                ...axisBase,
                axisLabel: { ...axisBase.axisLabel, formatter: "{value}×" },
            },
            series: [
                {
                    ...barSeries(implColors, values, "×", implColors),
                    data: values.map((value, i) => ({
                        value,
                        itemStyle: {
                            borderRadius: [5, 5, 0, 0],
                            color: gradient(implColors[i], botColors[i]),
                        },
                        label: {
                            show: true,
                            position: "top" as const,
                            color: implColors[i],
                            fontFamily: '"Rubik", sans-serif',
                            fontSize: 13,
                            fontWeight: 900,
                            formatter: `${value}×`,
                        },
                    })),
                    markLine: {
                        silent: true,
                        symbol: "none",
                        lineStyle: {
                            color: colors.overlay1,
                            type: "dashed" as const,
                            width: 1,
                        },
                        data: [
                            {
                                yAxis: 1,
                                label: {
                                    formatter: "parity",
                                    color: colors.overlay0,
                                    fontFamily: '"Rubik", sans-serif',
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

    onMount(() => {
        const maybeInit = (el: HTMLDivElement, opt: EChartsOption | object) => {
            if (!Object.keys(opt).length) return null;
            const c = init(el, null, { renderer: "canvas" });
            c.setOption(opt as EChartsOption);
            return c;
        };

        const cThroughput = maybeInit(refThroughput, throughputOption());
        const cLatency = maybeInit(refLatency, latencyOption());
        const cSpeedup = maybeInit(refSpeedup, speedupOption());

        createEffect(() => {
            const opt = throughputOption();
            if (cThroughput && Object.keys(opt).length)
                cThroughput.setOption(opt as EChartsOption, true);
        });
        createEffect(() => {
            const opt = latencyOption();
            if (cLatency && Object.keys(opt).length)
                cLatency.setOption(opt as EChartsOption, true);
        });
        createEffect(() => {
            const opt = speedupOption();
            if (cSpeedup && Object.keys(opt).length)
                cSpeedup.setOption(opt as EChartsOption, true);
        });

        const charts = [cThroughput, cLatency, cSpeedup].filter(
            Boolean,
        ) as NonNullable<typeof cThroughput>[];
        const ro = new ResizeObserver(() => {
            for (const c of charts) c.resize();
        });
        for (const el of [refThroughput, refLatency, refSpeedup])
            ro.observe(el);

        onCleanup(() => {
            ro.disconnect();
            for (const c of charts) c.dispose();
        });
    });

    return (
        <div style={styles.root}>
            <div style={styles.inner}>
                <div>
                    <div style={styles.chip}>
                        <span style={{ color: colors.green }}>●</span>
                        {iterations().toLocaleString()} iterations |{" "}
                        {runs().length} implementations
                    </div>
                    <h1 style={styles.h1}>XOR encoder benchmark</h1>
                    <p style={styles.subheading}>
                        2 UltraViolet JavaScript implementations compared to
                        Civil's C++/WebAssembly implementation via Emscripten
                    </p>
                </div>

                <Show when={headline()}>
                    <div>
                        <div style={heroCardStyle(wasmWins())}>
                            <div style={heroNumberStyle(wasmWins())}>
                                {headline()}×
                            </div>
                            <div style={styles.heroLabel}>
                                WebAssembly is{" "}
                                {wasmWins() ? "faster" : "slower"} than the best
                                JavaScript implementation
                            </div>
                        </div>
                    </div>
                </Show>

                <div style={styles.pills}>
                    <For each={runs()}>
                        {run => {
                            const m = getImplMeta(run.impl);
                            return (
                                <span style={pillStyle(m.color)}>
                                    <span style={dotStyle(m.color)} />
                                    {m.short}
                                    <span style={implTagStyle(m.color)}>
                                        {m.tag}
                                    </span>
                                </span>
                            );
                        }}
                    </For>
                </div>

                <div style={styles.grid2}>
                    <div style={styles.card}>
                        <div ref={refThroughput} style={styles.chartBox} />
                    </div>
                    <div style={styles.card}>
                        <div ref={refLatency} style={styles.chartBox} />
                    </div>
                </div>

                <Show
                    when={
                        comparisons().length > 0 &&
                        comparisons()[0].speedup_factor != null
                    }
                >
                    <div style={styles.fullCard}>
                        <div ref={refSpeedup} style={styles.fullChart} />
                    </div>
                </Show>

                <div style={styles.tableWrap}>
                    <div style={styles.tableHead}>raw results</div>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <For
                                    each={
                                        [
                                            "Implementation",
                                            "Mops/s",
                                            "ns/op",
                                            "Total ms",
                                        ] as const
                                    }
                                >
                                    {heading => (
                                        <th style={styles.th}>{heading}</th>
                                    )}
                                </For>
                            </tr>
                        </thead>
                        <tbody>
                            <For each={runs()}>
                                {(run, index) => {
                                    const m = getImplMeta(run.impl);
                                    return (
                                        <tr>
                                            <td style={tableCellStyle(index())}>
                                                <span style={styles.implCell}>
                                                    <span
                                                        style={dotStyle(
                                                            m.color,
                                                        )}
                                                    />
                                                    <span
                                                        style={`color:${colors.text}`}
                                                    >
                                                        {run.impl}
                                                    </span>
                                                </span>
                                            </td>
                                            <td
                                                style={`${tableCellStyle(index())};color:${m.color};font-weight:700`}
                                            >
                                                {(
                                                    run.ops_per_sec / 1e6
                                                ).toFixed(4)}
                                            </td>
                                            <td
                                                style={`${tableCellStyle(index())};color:${colors.subtext1}`}
                                            >
                                                {run.avg_ns_per_op.toFixed(1)}
                                            </td>
                                            <td
                                                style={`${tableCellStyle(index())};color:${colors.subtext1}`}
                                            >
                                                {run.total_ms.toFixed(1)}
                                            </td>
                                        </tr>
                                    );
                                }}
                            </For>
                        </tbody>
                    </table>
                </div>

                <div style={styles.footer}>
                    catppuccin macchiato · apache echarts · solidjs
                </div>
            </div>
        </div>
    );
}
