FROM emscripten/emsdk:4.0.3

ENV DEBIAN_FRONTEND=noninteractive

# Install build dependencies and update TLS certificates
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        bash curl wget git python3 make cmake \
        gcc g++ pkg-config ca-certificates openssl && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js 22 and 24
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get update && \
    apt-get install -y nodejs && \
    npm install -g n && \
    n 22 && \
    n 24 && \
    rm -rf /var/lib/apt/lists/*

ENV PATH="/usr/local/bin:${PATH}"

# Copy CARTA WASM library sources and build scripts
WORKDIR /opt/carta

COPY wasm_libs/ ./wasm_libs/

# Build AST, ZFP, Zstandard and GSL
RUN bash -c 'set -e; \
    source /emsdk/emsdk_env.sh; \
    cd /opt/carta; \
    bash ./wasm_libs/build_libs.sh'

# Keep the precompiled libraries in the image
WORKDIR /src

CMD ["/bin/bash"]
