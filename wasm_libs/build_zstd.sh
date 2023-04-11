#!/usr/bin/env bash
command -v emcc >/dev/null 2>&1 || { echo "Script requires emcc but it's not installed or in PATH.Aborting." >&2; exit 1; }
cd "${0%/*}"
if ! [[ $(find zstd-1.4.4.tar.gz -type f 2>/dev/null && md5sum -c zstd.md5 &>/dev/null) ]]; then
    echo "Fetching Zstd 1.4.4"
    retry_count=0
    max_retries=3
    while (( retry_count < max_retries )); do
        wget https://github.com/facebook/zstd/releases/download/v1.4.4/zstd-1.4.4.tar.gz && break
        ((retry_count++))
        if (( retry_count == max_retries )); then
            echo "Failed to fetch Zstd 1.4.4."
            exit 1
        fi
        echo "Download failed. Trying again."
        sleep 30
    done
fi

mkdir -p zstd; tar -xf zstd-1.4.4.tar.gz --directory ./zstd --strip-components=1

echo "Creating single file decoder source"
cd zstd/contrib/single_file_decoder
./create_single_file_decoder.sh

echo "Compiling to LLVM bitcode"
cd ../../
mkdir -p build
cd build
emcc -O3 -g0 -s WASM=1 ../contrib/single_file_decoder/zstddeclib.c -c -o ./standalone_zstd.bc
echo "Checking for Zstd bitcode..."
if [[ $(find -L ./standalone_zstd.bc -type f -size +10000c 2>/dev/null) ]]; then
    echo "Found"
else
    echo "Not found!"
fi
