#!/usr/bin/env bash
command -v emcc >/dev/null 2>&1 || {
  echo "Script requires emcc but it's not installed or in PATH.Aborting." >&2
  exit 1
}
cd "${0%/*}"
cd carta_computation
mkdir -p build
printf "Building carta computation code..."
npx tsc post.ts --outFile build/post.js
npx tsc pre.ts --outFile build/pre.js
cp typings.d.ts build/index.d.ts

emcc -o build/carta_computation.js carta_computation.cc Point2D.cc ../../wasm_libs/zstd/build/standalone_zstd.bc \
  --pre-js build/pre.js --post-js build/post.js -std=c++11 -g0 -O3 -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 \
  -s NO_EXIT_RUNTIME=1 -s EXPORTED_FUNCTIONS='["_ZSTD_decompress", "_decodeArray", "_generateVertexData", "_calculateCatalogMap", "_convertInt64Array", "_convertUint64Array","_malloc", "_free"]' \
  -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "calledRun"]'

printf "Checking for CARTA computation WASM..."
if [[ $(find build/carta_computation.js -type f -size +10000c 2>/dev/null) ]]; then
  echo "Found"
  # copy WASM module to public folder for serving
  cp build/carta_computation.wasm ../../public/
  # link wrapper to node modules
  mv build/carta_computation.js build/index.js
  cd ../../node_modules
  rm -f carta_computation
  ln -s ../wasm_src/carta_computation/build carta_computation
else
  echo "Not found!"
  exit
fi
