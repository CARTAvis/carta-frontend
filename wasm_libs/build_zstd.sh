#!/usr/bin/env bash
command -v emcc >/dev/null 2>&1 || { echo "Script requires emcc but it's not installed or in PATH.Aborting." >&2; exit 1; }

wget -O zstd-dev.tar.gz https://github.com/facebook/zstd/tarball/dev
mkdir -p zstd; tar -xf zstd-dev.tar.gz --directory ./zstd --strip-components=1

echo "Creating single file decoder source"
cd zstd/contrib/single_file_decoder
./create_single_file_decoder.sh

echo "Compiling to LLVM bitcode"
cd ../../
mkdir -p build
cd build
emcc -O3 -g0 -s WASM=1 ../contrib/single_file_decoder/zstddeclib.c -o ./standalone_zstd.bc
echo "Checking for Zstd bitcode..."
if [[ $(find -L ./standalone_zstd.bc -type f -size +177000c 2>/dev/null) ]]; then
    echo "Found"
else
    echo "Not found!"
fi
