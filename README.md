# CARTA Frontend

## Prerequisites
The build process relies heavily on `npm` and `nodejs`, so make sure they are installed and accesible.
WebAssembly compilation is performed using a [docker](https://www.docker.com) container ([trzeci/emscripten](https://hub.docker.com/r/trzeci/emscripten), currently version 1.39.18). The protocol buffer definitions reside in a git submodule that must be initialised as follows:
```
cd protobuf
git submodule init
git submodule update
# use git checkout release/1.x when using the release/1.x branch of carta-frontend
git checkout dev 
```
Prerequisite `npm` packages can be installed using `npm install`.

## Build process:
There are four steps in the build process. Some are more automated than others. Steps 2-4 are automatically run when calling `npm run build`, which produces a distributable build in the `build` folder.

1. **Building statically linked WebAssembly libraries of dependencies**, such as [AST](https://github.com/Starlink/ast), [ZFP](https://github.com/LLNL/zfp) and [Zstd](https://github.com/facebook/zstd). The `build_wasm_libs_docker.sh` script builds the required WebAssembly libraries using a `docker` container. There are no plans to further automate this process, as the libs are unlikely to require recompilation on a regular basis.
2. **Building WebAssembly wrapper modules**, which either correspond directly to a dependency mentioned above, or are based on custom code (such as converting floating point (FP32) values to RGBA values).
These modules can be built using the `build_wasm_wrappers_docker.sh` script.
Currently, each build script symlinks the JavaScript portion of the wrapper to a subdirectory of `node_modules`, and copies the WebAssembly binary to `public`.
3. **Building static protocol buffer code** is done using the `build_proto.sh` script in the `protobuf` folder, which builds the static JavaScript code, as well as the TypeScript definitions, and symlinks to the `node_modules/carta-protobuf` directory.
4. **Webpack** is used to build and bundle all the JavaScript, Sass and HTML code elegantly. You can run `npm start` to run a live dev server, while the build process watches for any changes to source files.

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.3377984.svg)](https://doi.org/10.5281/zenodo.3377984)
