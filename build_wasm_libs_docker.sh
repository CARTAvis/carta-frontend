#!/bin/bash
echo "Building WebAssembly libraries inside Docker container"
if [ -t 0 ] && [ -t 1 ]; then
  docker run -it --rm -u $(id -u):$(id -g) -v `pwd`:/src emscripten/emsdk:2.0.14 /src/wasm_libs/build_libs.sh
else
  # Non interactive version needed by Jenkins as no TTY is available 
  docker run --rm -u $(id -u):$(id -g) -v `pwd`:/src emscripten/emsdk:2.0.14 /src/wasm_libs/build_libs.sh
fi
