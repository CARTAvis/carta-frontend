#!/usr/bin/env bash
command -v emcc >/dev/null 2>&1 || { echo "Script requires emcc but it's not installed or in PATH.Aborting." >&2; exit 1; }
cd ast_wrapper
mkdir -p build
printf "Building AST wrapper..."
npx tsc pre.ts --outFile build/pre.js
npx tsc post.ts --outFile build/post.js
emcc -std=c++11 -o build/ast_wrapper.js ast_wrapper.cc grf_debug.cc --pre-js build/pre.js --post-js build/post.js \
    -I../../wasm_libs/ast -L../../wasm_libs/ast/.libs -last -last_pal -lm -g0 -O2 \
    -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s NO_EXIT_RUNTIME=1 -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "UTF8ToString"]' \
    -s EXPORTED_FUNCTIONS='["_plotGrid", "_initFrame", "_initDummyFrame", "_format", "_set", "_transform", "_getString", "_norm", "_axDistance"]'

printf "Checking for AST wrapper WASM..."
if [[ $(find build/ast_wrapper.js -type f -size +1000c 2>/dev/null) ]]; then
    echo "Found"
    # copy WASM module to public folder for serving
    cp build/ast_wrapper.wasm ../../public/
    # link wrapper to node modules
    mv build/ast_wrapper.js build/index.js
    cd ../../node_modules
    rm -f ast_wrapper
    ln -s ../wasm_src/ast_wrapper/build ast_wrapper
else
    echo "Not found!"
    exit
fi