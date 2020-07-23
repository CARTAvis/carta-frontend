#!/bin/bash

if singularity check emscripten-1.39.18-upstream.simg ; then
    echo "Using existing singularity container"
else
    singularity pull docker://trzeci/emscripten:1.39.18-upstream
fi
echo "Building WebAssembly libraries using singularity"
singularity exec emscripten-1.39.18-upstream.simg npm run build-libs

