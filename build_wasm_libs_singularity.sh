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
        singularity build --sandbox emscripten.simg docker://emscripten/emsdk:2.0.14
    fi
    singularity exec --writable emscripten.simg npm run build-libs
else
    if singularity check emsdk-2.0.14.simg ; then
        echo "Using existing singularity container"
    else
        singularity pull docker://emscripten/emsdk:2.0.14
    fi
    echo "Building WebAssembly libraries using singularity"
    singularity exec emsdk-2.0.14.simg npm run build-libs
fi

