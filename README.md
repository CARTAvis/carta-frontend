# CARTA Frontend
The carta-frontend is used in conjunction with the [carta-backend](https://github.com/CARTAvis/carta-backend) and for general use, a pre-built production carta-frontend is usually installed alongside the carta-backend automatically. 
However, a user may wish to install the carta-frontend component separately in order to test beta versions, for example, or to develop it.

## Pre-built production packages
The simplest way to install the carta-frontend component is to use the pre-built production packages from NPM (any OS with Node.js installed), our PPA (Debian packages for Ubuntu), our RPM repository (for RHEL based systems), or Homebrew (for MacOS).

### NPM

Pre-built production carta-frontends can be obtained from the [npmjs.com carta-frontend repository](https://www.npmjs.com/package/carta-frontend?activeTab=explore).

If you have Node.js and `npm` already installed on your system, a production carta-frontend can be installed using the following command:

```
npm i carta-frontend

```

The files will be installed to your `node-modules` directory.
Specific carta-frontend versions can be installed by appending `@` and the version number. For example,
```
npm i carta-frontend@1.4.0
npm i carta-frontend@2.0.0-beta.0
```
The available versions are listed in the [npmjs.com carta-frontend versions tab](https://www.npmjs.com/package/carta-frontend?activeTab=versions).

Alternatively, the pre-built production carta-frontend can be downloaded directly without npm. For example,
```
wget https://registry.npmjs.org/carta-frontend/-/carta-frontend-2.0.0.tgz
```
The `tgz` extracts to `package/build`. 

The carta-backend can be started up to use any non-default carta-frontend by specifying its location with the `--frontend_folder` flag. e.g.
```
./carta-backend --frontend_folder $HOME/package/build
```

### PPA

A Personal Package Archive (PPA) is a third-party package repository for Ubuntu. We supply pre-built production carta-frontends at the [CARTAvis-team PPA on the Ubuntu Lauchpad](https://launchpad.net/~cartavis-team/+archive/ubuntu/carta).

To install the latest release version:
```
sudo add-apt-repository ppa:cartavis-team/carta
sudo apt-get update
sudo apt-get install carta-frontend
```

The default install location for the carta-frontend is `/usr/local/share/carta/frontend/`

### RPM

RPMs are for users of Red Hat Enterprise Linux (RHEL) and other Red Hat-based Linux distributions, i.e. CentOS. 
To install the latest release version, add the appropriate repository file depending on whether you are using RHEL7 (**el7**) or RHEL8 (**el8**):

```
sudo curl https://packages.cartavis.org/cartavis-el7.repo --output /etc/yum.repos.d/cartavis.repo
```
or
```
sudo curl https://packages.cartavis.org/cartavis-el8.repo --output /etc/yum.repos.d/cartavis.repo
```
Then the carta-frontend component can be installed using `yum` or `dnf` :
```
sudo yum install carta-frontend
```
The default install location for the carta-frontend RPM is `/usr/local/share/carta/frontend/`

### Homebrew
MacOS users can install the carta-frontend component using [Homebrew](https://brew.sh/) from the [CARTAvis Homebrew Tap](https://github.com/CARTAvis/homebrew-tap). 
```
brew install cartavis/tap/carta-frontend
```
The default install location for the carta-frontend is `/usr/local/share/carta/frontend/`


## Development

If you wish to modify or develop the carta-frontend, you need to build non-production carta-frontend from source. Here are the instructions to do so:

### Prerequisites

The build process relies heavily on `npm` and `nodejs`, so make sure they are installed and accessible.

We recommend using [Docker](https://www.docker.com) or [Singularity](https://singularity.lbl.gov/index.html) to perform WebAssembly compilation. If neither is available, the Emscripten compiler (`emcc` version 2.0.14 recommended) needs to be available in the build environment. Installation instructions are available on the [Emscripten homepage](https://emscripten.org/docs/getting_started/downloads.html).

### Build process (using Docker/Singularity)
Initialise submodules and install package dependencies:
```
git submodule update --init --recursive
npm install
```
WebAssembly libraries can be built with `npm run build-libs-docker` or `npm run build-libs-singularity`.
Additional build steps (building WebAssembly wrappers, protocol buffer modules and compiling the Typescript code) are performed by `npm run build-docker` or `npm run build-singularity`. This produces a production build in the `build` folder.

To run a development build server, simply run `npm run start`. 

## Build process (without Docker/Singularity)
If your build environment does not have access to Docker or Singularity, WebAssembly compilation must be performed in an environment with access to the Emscripten compiler. 

Initialise submodules and install package dependencies:
```
git submodule update --init --recursive
npm install
```

WebAssembly libraries can be built with `npm run build-libs`.
Additional build steps (building WebAssembly wrappers, protocol buffer modules and compiling the Typescript code) are performed by `npm run build`. This produces a production build in the `build` folder.

To run a development build server, simply run `npm run start`. 

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.3377984.svg)](https://doi.org/10.5281/zenodo.3377984)


