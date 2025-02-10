#!/bin/bash
echo "Building WebAssembly libraries inside Docker container"

arch_tag=""
if [ "$(uname -m)" == "arm64" ] || [ "$(uname -m)" == "aarch64" ]; then
    arch_tag="-arm64"
    echo "ARM host detected, using arm64 docker images"
fi

docker run --rm -u $(id -u):$(id -g) -v `pwd`:/src emscripten/emsdk:4.0.3${arch_tag} /src/wasm_libs/build_libs.sh
