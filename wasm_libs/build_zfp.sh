#!/usr/bin/env bash
command -v emcc >/dev/null 2>&1 || { echo "Script requires emcc but it's not installed or in PATH.Aborting." >&2; exit 1; }

if ! [[ $(find zfp-0.5.3.tar.gz -type f -size +327000c 2>/dev/null) ]]; then
    echo "Fetching ZFP 0.5.3"
    wget https://github.com/LLNL/zfp/releases/download/0.5.3/zfp-0.5.3.tar.gz
fi

mkdir -p zfp; tar -xf zfp-0.5.3.tar.gz --directory ./zfp --strip-components=1

cd zfp
echo "Patching for static build"
patch src/CMakeLists.txt -i ../zfp_static_build.patch -N
mkdir -p build
cd build
echo "Building ZFP using Emscripten"
CC=emcc CXX=emcc cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_C_FLAGS="-s WASM=1" -DZFP_WITH_OPENMP=OFF -DBUILD_UTILITIES=OFF -DBUILD_TESTING=OFF ../
make -j4
echo "Checking for ZFP static lib..."
if [[ $(find -L ./lib/libzfp.a -type f -size +192000c 2>/dev/null) ]]; then
    echo "Found"
else
    echo "Not found!"
fi