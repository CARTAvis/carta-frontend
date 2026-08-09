# CARTA: 3D rendering widget - Frontend
This branch (`ixaka/render3d`) contains the source code for the CARTA frontend including a prototype of a 3D visulisation widget. The widget allows volumetric rendering of spectral cubes within CARTA.

The CARTA frontend is used in conjunction with the [`ixaka\render3d` CARTA backend](https://github.com/CARTAvis/carta-backend/tree/render3d-v0.1), and both must be installed separately in order to test and develop the 3D rendering widget.

## Development

If you wish to modify or develop the CARTA frontend, you may build a production or non-production frontend from source. Here are the instructions to do so:

### Prerequisites

The build process relies heavily on `npm` and `nodejs`, so make sure they are installed and accessible.

We recommend using [Docker](https://www.docker.com) or [Singularity](https://apptainer.org/docs/) to perform WebAssembly compilation. If neither is available, the Emscripten compiler (`emcc` version 4.0.3 recommended) needs to be available in the build environment. Installation instructions are available on the [Emscripten homepage](https://emscripten.org/docs/getting_started/downloads.html).

### Build process (using Docker/Singularity)
Initialise submodules and install package dependencies:
```
git submodule update --init --recursive
npm install
```
WebAssembly libraries can be built with `npm run build-libs-docker` or `npm run build-libs-singularity`.
Additional build steps (building WebAssembly wrappers, protocol buffer modules and compiling the Typescript code) are performed by `npm run build-docker` or `npm run build-singularity`. This produces a production build in the `build` folder.

To run a development build server, simply run `npm run start`. 

### Build process (without Docker/Singularity)
If your build environment does not have access to Docker or Singularity, WebAssembly compilation must be performed in an environment with access to the Emscripten compiler. 

Initialise submodules and install package dependencies:
```
git submodule update --init --recursive
npm install
```

WebAssembly libraries can be built with `npm run build-libs`.
Additional build steps (building WebAssembly wrappers, protocol buffer modules and compiling the Typescript code) are performed by `npm run build`. This produces a production build in the `build` folder.

To run a development build server, simply run `npm run start`.

## Developer documentation

Automatically generated documentation can be found at [cartavis.org/carta-frontend](https://cartavis.org/carta-frontend/).

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.3377984.svg)](https://doi.org/10.5281/zenodo.3377984)
