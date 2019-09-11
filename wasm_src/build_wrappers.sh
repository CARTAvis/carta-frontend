#!/usr/bin/env bash
cd "$(dirname "$0")"
bash ./build_ast_wrapper.sh
bash ./build_zfp_wrapper.sh