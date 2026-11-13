#!/usr/bin/env bash

cd misc/config

bun bundle.ts

cd ../..

bun run build