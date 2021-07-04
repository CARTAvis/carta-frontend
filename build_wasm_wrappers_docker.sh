#!/bin/bash
echo "Building WebAssembly wrappers inside Docker container"
docker run -it --rm -u $(id -u):$(id -g) -v `pwd`:/src emscripten/emsdk:2.0.14 /src/wasm_src/build_wrappers.sh
