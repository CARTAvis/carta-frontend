---
name: build
description: Build the CARTA frontend from source, including WebAssembly libraries, protocol buffers, and TypeScript compilation. Supports Docker, Singularity, and native Emscripten builds.
---

# Build CARTA Frontend

## Skill Description
Build the CARTA frontend from source, including WebAssembly libraries, protocol buffers, and TypeScript compilation. Supports Docker, Singularity, and native Emscripten builds.

## Prerequisites
- Node.js (LTS) and npm installed
- Docker/Singularity or Emscripten (recommended) 4.0.3+ for native builds
- Git with submodule access

## Core Build Tasks

### Task: Initialize Project
**When:** First time setup or after fresh clone
**Steps:**
1. Initialize submodules: `git submodule update --init --recursive`
2. Install dependencies: `npm install`

### Task: Build Production Frontend (Docker)
**When:** Creating production build with Docker available
**Steps:**
1. Build WebAssembly libraries: `npm run build-libs-docker`
2. Build complete frontend: `npm run build-docker`
**Output:** Production files in `build/` directory

### Task: Build Production Frontend (Singularity)
**When:** Creating production build in HPC environment
**Steps:**
1. Build WebAssembly libraries: `npm run build-libs-singularity`
2. Build complete frontend: `npm run build-singularity`
**Output:** Production files in `build/` directory

### Task: Build Production Frontend (Native)
**When:** Docker/Singularity unavailable, Emscripten available
**Requirements:** Emscripten compiler (`emcc`) in PATH
**Steps:**
1. Verify Emscripten: `which emcc`
2. Build WebAssembly libraries: `npm run build-libs`
3. Build complete frontend: `npm run build`
**Output:** Production files in `build/` directory

### Task: Start Development Server
**When:** Local development with hot-reload
**Command:** `npm run start`
**Result:** Dev server at `http://localhost:3000`
**Note:** Does not require full production build

### Task: Build Specific Components

#### WebAssembly Libraries Only
**Location:** `wasm_libs/` (AST, GSL, ZFP, zstd)
**Commands:**
- Docker: `npm run build-libs-docker`
- Singularity: `npm run build-libs-singularity`
- Native: `npm run build-libs`
**Note:** Recommend using Native

#### WebAssembly Wrappers Only
**Location:** `wasm_src/` (TypeScript interfaces)
**Command:** `npm run build-wrappers`

#### Protocol Buffers Only
**Location:** `protobuf/` (submodule)
**Command:** `npm run build-protobuf`

#### TypeScript Only
**Command:** `npm run build-ts`
**When:** Only source code changes, WASM unchanged

### Task: Verify Build Success
**Steps:**
1. Check build directory exists: `ls -la build/`
2. Verify key files: `ls build/index.html build/static/js/ build/static/css/`
3. Test locally: `npx serve -s build -l 5000` then open `http://localhost:5000`

## Common Issues and Resolutions

### Issue: Submodules Not Initialized
**Symptoms:** Missing protobuf/WASM source files
**Fix:** `git submodule update --init --recursive`

### Issue: npm Dependencies Outdated
**Symptoms:** Module not found errors
**Fix:** `rm -rf node_modules package-lock.json && npm install`

### Issue: Emscripten Not Found
**Symptoms:** `emcc: command not found` during native build
**Fix:** Install and activate Emscripten SDK, verify with `emcc --version`
#### How to Install Emscripten SDK
1. Clone the SDK repository:
```bash
git clone https://github.com/emscripten-core/emsdk.git
```
2. Navigate to the SDK directory:
```bash
cd emsdk
```
3. Install the latest Emscripten tools:
```bash
./emsdk install latest
```
4. Activate the latest version:
```bash
./emsdk activate latest
```
5. Source the environment variables:
```bash
source ./emsdk_env.sh
```

### Issue: Docker Permission Denied
**Symptoms:** Permission errors on Docker commands
**Fix:** Add user to docker group: `sudo usermod -aG docker $USER` (requires logout)

### Issue: WebAssembly Build Failures
**Fix:** Clean and rebuild
```bash
rm -rf wasm_libs/built wasm_src/*/build
npm run build-libs  # or appropriate build method
npm run build-wrappers
```

### Issue: TypeScript Compilation Errors
**Fix:** Clean cache and rebuild
```bash
rm -rf node_modules/.cache
npm run build-ts
```

### Issue: Port 3000 Already in Use
**Fix:** Use different port: `PORT=3001 npm run start`
**Or:** Kill process: `lsof -ti:3000 | xargs kill`

## Build Optimization Tips

### Skip Unchanged Components
If WebAssembly hasn't changed, skip and rebuild only TypeScript:
```bash
npm run build-protobuf
npm run build-ts
```

### Parallel Component Builds
For faster builds when possible:
```bash
npm run build-libs & npm run build-protobuf
wait
npm run build-wrappers
npm run build-ts
```

## Integration with Backend

### Use Custom Frontend Build
Start backend with frontend path:
```bash
./carta-backend --frontend_folder /path/to/carta-frontend/build
```

### Development Workflow
1. Backend: `./carta-backend --debug_no_auth --no_browser --port 3002`
2. Frontend: `npm run start`
3. Frontend proxies to backend on port 3002

## Expected Build Output Structure
```
build/
├── index.html           # Entry point
├── manifest.json        # PWA manifest
├── config/             # Configuration
└── static/
    ├── css/            # Stylesheets
    ├── js/             # JavaScript bundles
    └── media/          # Assets
```

## Quick Command Reference
```bash
# Development
npm run start                    # Dev server
npm test                         # Run tests

# Production (Docker)
npm run build-libs-docker        # WASM libraries
npm run build-docker             # Complete build

# Production (Native)
npm run build-libs               # WASM libraries
npm run build                    # Complete build
npm run build-ts                 # TypeScript only

# Components
npm run build-protobuf           # Protocol buffers
npm run build-wrappers           # WASM wrappers
```

## Standard Build Sequence
1. `git submodule update --init --recursive`
2. `npm install`
3. `npm run build-libs` (or appropriate method)
4. `npm run build` (or `npm run build-docker` for docker)
5. Verify `build/` directory content

---

**Critical:** Always update submodules before building, especially after branch switches or pulling changes.
