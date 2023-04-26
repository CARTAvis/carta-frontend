#!/usr/bin/env bash
command -v emcc >/dev/null 2>&1 || { echo "Script requires emcc but it's not installed or in PATH.Aborting." >&2; exit 1; }
cd "${0%/*}"
if ! [[ $(find ast-9.1.1.tar.gz -type f 2>/dev/null && md5sum -c ast.md5 &>/dev/null) ]]; then
    echo "Fetching AST 9.1.1"
    retry_count=0
    max_retries=2
    while (( retry_count < max_retries )); do
        wget https://github.com/Starlink/ast/releases/download/v9.1.1/ast-9.1.1.tar.gz && break
        ((retry_count++))
        if (( retry_count == max_retries )); then
            echo "Failed to fetch AST 9.1.1."
            exit 1
        fi
        echo "Download failed. Trying again."
        sleep 10
    done
fi

mkdir -p ast; tar -xf ast-9.1.1.tar.gz --directory ./ast --strip-components=1

cd ast

echo "Building AST using Emscripten"
CFLAGS="-g0 -O3 -s WASM=1" emconfigure ./configure --without-pthreads --without-fortran --without-stardocs --enable-shared=no --host=wasm32 --prefix=${PWD}/../built
emmake make -j 4
emmake make install
echo "Checking for AST static lib..."
if [[ $(find ../built/lib/libast.a -type f -size +1000000c 2>/dev/null) ]]; then
    echo "Found"
else
    echo "Not found!"
    exit 1
fi
