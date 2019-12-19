#!/usr/bin/env bash
command -v emcc >/dev/null 2>&1 || { echo "Script requires emcc but it's not installed or in PATH.Aborting." >&2; exit 1; }

if ! [[ $(find ast-8.6.3.tar.gz -type f 2>/dev/null && md5sum -c ast.md5 &>/dev/null) ]]; then
    echo "Fetching AST 8.6.3"
    wget https://github.com/Starlink/ast/releases/download/v8.6.3/ast-8.6.3.tar.gz
fi

mkdir -p ast; tar -xf ast-8.6.3.tar.gz --directory ./ast --strip-components=1

cd ast

# This is a nasty hack which we only need until the next release comes out
patch -i ../0001-New-attribute-TextGapType-for-the-plot-class.patch

echo "Building AST using Emscripten"
CFLAGS="-g0 -O3 -s WASM=1" emconfigure ./configure --without-pthreads --without-fortran --without-stardocs --enable-shared=no
emmake make -j 4
echo "Checking for AST static lib..."
if [[ $(find .libs/libast.a -type f -size +1000000c 2>/dev/null) ]]; then
    echo "Found"
else
    echo "Not found!"
fi
