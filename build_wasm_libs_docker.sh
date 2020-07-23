#!/bin/bash
echo "Building WebAssembly libraries inside Docker container"
docker run -it --rm -u $(id -u):$(id -g) -v `pwd`:/src trzeci/emscripten:1.39.18-upstream /src/wasm_libs/build_libs.sh
