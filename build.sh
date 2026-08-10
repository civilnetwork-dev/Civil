#!/usr/bin/env bash

cd misc/config

bun bundle.js

cd ../..

# Required build step, not a test: generates tests/bench_results.json and
# tests/results.db, which the /benchmarks route reads at runtime.
bun run build:benchmarks
bun run build