#!/usr/bin/env bash
command -v emcc >/dev/null 2>&1 || { echo "Script requires emcc but it's not installed or in PATH.Aborting." >&2; exit 1; }
cd "${0%/*}"
if ! [[ $(find gsl-2.6.tar.gz -type f 2>/dev/null && md5sum -c gsl.md5 &>/dev/null) ]]; then
    echo "Fetching GSL 2.6"
    gsl_tar="gsl-2.6.tar.gz"
    gsl_urls=(
        "https://ftpmirror.gnu.org/gsl/${gsl_tar}"
        "https://mirror.ossplanet.net/gnu/gsl/${gsl_tar}"
        "https://ftp.jaist.ac.jp/pub/GNU/gsl/${gsl_tar}"
        "https://mirrors.ocf.berkeley.edu/gnu/gsl/${gsl_tar}"
        "https://mirror.dogado.de/gnu/gsl/${gsl_tar}"
    )
    max_retries=2
    downloaded=false

    rm -f "${gsl_tar}"
    for gsl_url in "${gsl_urls[@]}"; do
        if wget --tries="${max_retries}" --waitretry=10 -O "${gsl_tar}" "${gsl_url}" && md5sum -c gsl.md5 &>/dev/null; then
            downloaded=true
            break
        fi

        rm -f "${gsl_tar}"
        echo "Failed to fetch GSL 2.6 from ${gsl_url}"
    done

    if [[ "${downloaded}" != true ]]; then
        echo "Failed to fetch GSL 2.6."
        exit 1
    fi
fi

mkdir -p gsl; tar -xf gsl-2.6.tar.gz --directory ./gsl --strip-components=1

cd gsl
echo "Building GSL using Emscripten"
CFLAGS="-msimd128 -g0 -O3" emconfigure ./configure --enable-shared=no --prefix=${PWD}/../built

emmake make -j4
emmake make install
echo "Checking for GSL static lib..."
if [[ $(find -L ../built/lib/libgsl.a -type f -size +192000c 2>/dev/null) ]]; then
    echo "Found"
else
    echo "Not found!"
    exit 1
fi
