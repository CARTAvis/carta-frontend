#!/bin/bash
echo "Building WebAssembly wrappers inside Docker container"
docker run --rm -u $(id -u):$(id -g) -v `pwd`:/src emscripten/emsdk:4.0.3 /src/wasm_src/build_wrappers.sh
