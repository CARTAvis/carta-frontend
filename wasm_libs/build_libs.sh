#!/usr/bin/env bash
cd "$(dirname "$0")"
bash ./build_ast.sh
bash ./build_zfp.sh