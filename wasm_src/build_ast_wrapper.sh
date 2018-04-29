#!/usr/bin/env bash
command -v emcc >/dev/null 2>&1 || { echo "Script requires emcc but it's not installed or in PATH.Aborting." >&2; exit 1; }
cd ast_wrapper
mkdir -p build
rm -f build/*
emcc -std=c++11 -o build/ast_wrapper.js ast_wrapper.cc grf_debug.cc --post-js post.js \
    -I../../wasm_libs/ast -L../../wasm_libs/ast/.libs -last -last_pal -lm -g0 -O3 \
    -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s NO_EXIT_RUNTIME=1 -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "UTF8ToString"]' \
    -s EXPORTED_FUNCTIONS='["_plotGrid", "_initFrame"]'

printf "Checking for AST wrapper WASM..."
if [[ $(find build/ast_wrapper.js -type f -size +1000c 2>/dev/null) ]]; then
    echo "Found"
else
    echo "Not found!"
    exit
fi
mv build/ast_wrapper.wasm ../../public/
mv build/ast_wrapper.js ../../src/wrappers/