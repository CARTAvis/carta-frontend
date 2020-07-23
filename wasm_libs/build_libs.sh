#!/usr/bin/env bash
cd "${0%/*}"
bash ./build_ast.sh
bash ./build_zfp.sh
bash ./build_zstd.sh
bash ./build_gsl.sh