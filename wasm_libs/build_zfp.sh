#!/usr/bin/env bash
command -v emcc >/dev/null 2>&1 || { echo "Script requires emcc but it's not installed or in PATH.Aborting." >&2; exit 1; }
cd "${0%/*}"

zfp_version="1.0.1"
zfp_tar="zfp-${zfp_version}.tar.gz"
zfp_url="https://github.com/LLNL/zfp/releases/download/${zfp_version}/${zfp_tar}"

if ! [[ $(find "${zfp_tar}" -type f 2>/dev/null && md5sum -c zfp.md5 &>/dev/null) ]]; then
    echo "Fetching ZFP ${zfp_version}."
    retry_count=0
    max_retries=2
    while (( retry_count < max_retries )); do
        wget "${zfp_url}" && break
        ((retry_count++))
        if (( retry_count == max_retries )); then
            echo "Failed to fetch ZFP ${zfp_version}."
            exit 1
        fi
        echo "Download failed. Trying again."
        sleep 10
    done
fi

mkdir -p zfp; tar -xf "${zfp_tar}" --directory ./zfp --strip-components=1

cd zfp
mkdir -p build
cd build
echo "Building ZFP using Emscripten"
emcmake cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_C_FLAGS="-msimd128" -DZFP_WITH_OPENMP=OFF -DBUILD_UTILITIES=OFF -DBUILD_TESTING=OFF -DBUILD_SHARED_LIBS=OFF -DZFP_ENABLE_PIC=OFF -DCMAKE_INSTALL_PREFIX=${PWD}/../../built ../
emmake make -j4
emmake make install
echo "Checking for ZFP static lib..."
if [[ $(find -L ../../built/lib/libzfp.a -type f -size +192000c 2>/dev/null) ]]; then
    echo "Found"
else
    echo "Not found!"
    exit 1  
fi
