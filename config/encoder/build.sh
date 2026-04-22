#!/usr/bin/env bash
set -e

export PATH="$(pwd):$PATH"

em++ -O3 -std=c++20 \
  src/xor_encoder.cpp \
  src/bindings.cpp \
  --bind \
  -sMODULARIZE \
  -sEXPORT_ES6 \
  -sENVIRONMENT=web,node,worker \
  -sEXPORT_NAME=XOREncoder \
  -sALLOW_MEMORY_GROWTH \
  -sEXPORTED_RUNTIME_METHODS=HEAPU8 \
  --emit-tsd xor_encoder.d.ts \
  -o xor_encoder.js
