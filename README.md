# CARTA Frontend

## Prerequisites
The build process relies heavily on `npm` and `nodejs`, so make sure they are installed and accesible.
WebAssembly compilation requires the Emscripten compiler (`emcc` version 1.39.0 or later) to be in the path. Details can be found [here](http://kripken.github.io/emscripten-site/docs/getting_started/downloads.html). The protocol buffer definitions reside in a git submodule that must be initialised as follows:
```
cd protobuf
git submodule init
git submodule update
# use git checkout dev when using the dev branch of carta-frontend
git checkout master 
```
Prerequisite `npm` packages can be installed using `npm install`. The WebAssembly library build process requires `wget`. Some WebAssembly libraries require `cmake` as well.

## Build process:
There are four steps in the build process. Some are more automated than others.
* **Building statically linked WebAssembly libraries of dependencies**, such as [AST](https://github.com/Starlink/ast), [ZFP](https://github.com/LLNL/zfp) and [SZ](https://github.com/disheng222/SZ).
Each dependecy can be built using the individual build scripts in the `wasm_libs` subdirectory, or using the `build_libs.sh` script.
There are no plans to further automate this process, as the libs are unlikely to require recompilation on a regular basis.
* **Building WebAssembly wrapper modules**, which either correspond directly to a dependency mentioned above, or are based on custom code (such as converting floating point (FP32) values to RGBA values).
These modules can be built using the individual build scripts in `wasm_src` subdirectory, or using the `build_wrappers.sh` script.
Currently, each build script symlinks the JavaScript portion of the wrapper to a subdirectory of `node_modules`, and copies the WebAssembly binary to `public`.
* **Building static protocol buffer code** is done using the `build_proto.sh` script in the `protobuf` folder, which builds the static JavaScript code, as well as the TypeScript definitions, and symlinks to the `node_modules/carta-protobuf` directory.
* **Webpack** is used to build and bundle all the JavaScript, Sass and HTML code elegantly. You can run `npm start` to run a live dev server, while the build process watches for any changes to source files.
Standalone versions can be built with `npm run build`, which produces a distributable build in the `build` folder.

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.3377984.svg)](https://doi.org/10.5281/zenodo.3377984)
