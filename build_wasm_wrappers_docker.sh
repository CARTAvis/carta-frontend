#!/bin/bash
docker run --rm -u $(id -u):$(id -g) -v `pwd`:/src trzeci/emscripten:1.39.18-upstream /src/wasm_src/build_wrappers.sh