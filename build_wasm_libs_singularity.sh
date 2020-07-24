#!/bin/bash
cd "${0%/*}"

VERSION=2

if singularity version ; then
    echo "Using singularity V3.x"
    VERSION=3
else
    echo "Using singularity V2.x"
fi

if [ $VERSION == "3" ]; then
    if [ -d "./emscripten.simg" ]; then
        echo "Using existing singularity container"
    else
        singularity build --sandbox emscripten.simg docker://trzeci/emscripten:1.39.18-upstream
    fi
    singularity exec --writable emscripten.simg npm run build-libs
else
    if singularity check emscripten-1.39.18-upstream.simg ; then
        echo "Using existing singularity container"
    else
        singularity pull docker://trzeci/emscripten:1.39.18-upstream
    fi
    echo "Building WebAssembly libraries using singularity"
    singularity exec emscripten-1.39.18-upstream.simg npm run build-libs
fi

