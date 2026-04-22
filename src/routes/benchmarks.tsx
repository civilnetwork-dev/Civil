import { clientOnly } from "@solidjs/start";
import { createFileRoute } from "@tanstack/solid-router";
import results from "$tests/bench_results.json" with { type: "json" };

const BenchmarkChart = clientOnly(
    () => import("~/components/BenchmarkChart.tsx"),
);

export const Route = createFileRoute("/benchmarks")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <main>
            <BenchmarkChart data={results} />
        </main>
    );
}
