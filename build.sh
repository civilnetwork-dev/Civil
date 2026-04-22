#!/usr/bin/env bash

cd misc/config

bun bundle.js

cd ../..

# don't question it. the application fundamentally NEEDS this.
# it's NOT a test runner
bun run test:encoders
bun run build