#!/bin/bash
echo "Building WebAssembly libraries inside Docker container"
docker run -it --rm -u $(id -u):$(id -g) -v `pwd`:/src emscripten/emsdk:2.0.14 /src/wasm_libs/build_libs.sh
