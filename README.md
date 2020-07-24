# CARTA Frontend

## Prerequisites
The build process relies heavily on `npm` and `nodejs`, so make sure they are installed and accessible.
We recommend using [Docker](https://www.docker.com) to perform WebAssembly compilation. If Docker is unavailable, the Emscripten compiler (`emcc` version 1.39.18 recommended) needs to be available in the build environment. Installation instructions are available on the [Emscripten homepage](https://emscripten.org/docs/getting_started/downloads.html).

## Build process (using Docker)
Initialise submodules and install package dependncies:
```
git submodule init
git submodule update
npm install
```

WebAssembly libraries can be built with `npm run build-libs-docker`.
Additional build steps (building WebAssembly wrappers, protocol buffer modules and compiling the Typescript code) are performed by `npm run build-docker`. This produces a production build in the `build` folder.

To run a development build server, simply run `npm run start`. 

## Build process (without Docker)
If your build environment does not have access to Docker, WebAssembly compilation must be performed in an environment with access to the Emscripten compiler. 

Initialise submodules and install package dependencies:
```
git submodule init
git submodule update
npm install
```

WebAssembly libraries can be built with `npm run build-libs`.
Additional build steps (building WebAssembly wrappers, protocol buffer modules and compiling the Typescript code) are performed by `npm run build`. This produces a production build in the `build` folder.

To run a development build server, simply run `npm run start`. 


[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.3377984.svg)](https://doi.org/10.5281/zenodo.3377984)

