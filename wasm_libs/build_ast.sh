#!/usr/bin/env bash
command -v emcc >/dev/null 2>&1 || { echo "Script requires emcc but it's not installed or in PATH.Aborting." >&2; exit 1; }

if ! [[ $(find ast-8.7.1.tar.gz -type f 2>/dev/null && md5sum -c ast.md5 &>/dev/null) ]]; then
    echo "Fetching AST 8.7.1"
    wget https://github.com/Starlink/ast/releases/download/v8.7.1/ast-8.7.1.tar.gz
fi

mkdir -p ast; tar -xf ast-8.7.1.tar.gz --directory ./ast --strip-components=1

cd ast

echo "Building AST using Emscripten"
CFLAGS="-g0 -O3 -s WASM=1" CC=emcc ./configure --without-pthreads --without-fortran --without-stardocs --enable-shared=no
make -j4
echo "Checking for AST static lib..."
if [[ $(find .libs/libast.a -type f -size +1000000c 2>/dev/null) ]]; then
    echo "Found"
else
    echo "Not found!"
fi
