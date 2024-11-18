#!/bin/bash
echo "Building WebAssembly libraries inside Docker container"
docker run --rm -u $(id -u):$(id -g) -v `pwd`:/src emscripten/emsdk:3.1.71 /src/wasm_libs/build_libs.sh
