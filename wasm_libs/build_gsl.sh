#!/usr/bin/env bash
command -v emcc >/dev/null 2>&1 || { echo "Script requires emcc but it's not installed or in PATH.Aborting." >&2; exit 1; }
cd "${0%/*}"
if ! [[ $(find gsl-2.6.tar.gz -type f 2>/dev/null && md5sum -c gsl.md5 &>/dev/null) ]]; then
    echo "Fetching GSL 2.6"
    retry_count=0
    max_retries=2
    while (( retry_count < max_retries )); do
        wget http://ftpmirror.gnu.org/gsl/gsl-2.6.tar.gz && break
        ((retry_count++))
        echo "Download failed. Trying again."
        sleep 10
    done
    if (( retry_count == max_retries )); then
        echo "Failed to fetch GSL 2.6 from http://ftpmirror.gnu.org"
        if ! wget https://mirror.ossplanet.net/gnu/gsl/gsl-2.6.tar.gz; then
            echo "Failed to fetch GSL 2.6 from https://mirror.ossplanet.net"
            if ! wget https://ftp.jaist.ac.jp/pub/GNU/gsl/gsl-2.6.tar.gz; then
                echo "Failed to fetch GSL 2.6 from https://ftp.jaist.ac.jp" 
                if ! wget https://mirrors.ocf.berkeley.edu/gnu/gsl/gsl-2.6.tar.gz; then
                    echo "Failed to fetch GSL 2.6 from https://mirrors.ocf.berkeley.edu"
                     if ! wget https://mirror.dogado.de/gnu/gsl/gsl-2.6.tar.gz; then
                         echo "Failed to fetch GSL 2.6 from https://mirror.dogado.de"
                         exit 1
                     fi
                fi
            fi
        fi
    fi
fi

mkdir -p gsl; tar -xf gsl-2.6.tar.gz --directory ./gsl --strip-components=1

cd gsl
echo "Building GSL using Emscripten"
CFLAGS="-g0 -O3 -s WASM=1" emconfigure ./configure --enable-shared=no --prefix=${PWD}/../built

emmake make -j4
emmake make install
echo "Checking for GSL static lib..."
if [[ $(find -L ../built/lib/libgsl.a -type f -size +192000c 2>/dev/null) ]]; then
    echo "Found"
else
    echo "Not found!"
    exit 1
fi
