#!/usr/bin/env bash
command -v emcc >/dev/null 2>&1 || { echo "Script requires emcc but it's not installed or in PATH.Aborting." >&2; exit 1; }
cd zfp_wrapper
mkdir -p build
printf "Building ZFP wrapper..."
npx tsc pre.ts --outFile build/pre.js
npx tsc post.ts --outFile build/post.js
emcc -o build/zfp_wrapper.js zfp_wrapper.c --pre-js build/pre.js --post-js build/post.js -I ../../wasm_libs/built/include \
    -L../../wasm_libs/built/lib -lm -lzfp -g0 -O2 -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 \
    -s NO_EXIT_RUNTIME=1 -s EXPORTED_FUNCTIONS='["_zfpDecompress", "_malloc", "_free"]' \
    -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]'

printf "Checking for ZFP wrapper WASM..."
if [[ $(find build/zfp_wrapper.js -type f -size +10000c 2>/dev/null) ]]; then
    echo "Found"
    # copy WASM module to public folder for serving
    cp build/zfp_wrapper.wasm ../../public/
    # link wrapper to node modules
    mv build/zfp_wrapper.js build/index.js
    cd ../../node_modules
    rm -f zfp_wrapper
    ln -s ../wasm_src/zfp_wrapper/build zfp_wrapper
else
    echo "Not found!"
    exit
fi