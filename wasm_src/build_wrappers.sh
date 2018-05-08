#!/usr/bin/env bash

# try source emsdk variables
if [ -f ~/emsdk-portable/emsdk_env.sh ]; then
    source ~/emsdk-portable/emsdk_env.sh
fi

cd "$(dirname "$0")"

if [[ "$@" == "--watch" ]]
then
    # Watch AST
    npx chokidar --initial -d 4000 './ast_wrapper/**/*.cc' './ast_wrapper/**/*.c' './ast_wrapper/**/post.js' -c './build_ast_wrapper.sh'
else
    # Build AST
    bash ./build_ast_wrapper.sh
fi

