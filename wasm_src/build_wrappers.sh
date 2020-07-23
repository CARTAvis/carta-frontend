#!/usr/bin/env bash
cd "${0%/*}"
# Build AST and ZFP wrappers
bash ./build_ast_wrapper.sh
bash ./build_zfp_wrapper.sh
# Build custom computation code
bash ./build_carta_computation.sh

