declare var Module: any;
declare var addOnPostRun: any;

const decompress = Module.cwrap("ZSTD_decompress", "number", ["number", "number", "number", "number"]);

Module.srcAllocated = 0;
Module.srcPtr = 0;
Module.destAllocated = 0;
Module.destPtr = 0;

addOnPostRun(function () {
    console.log("Zstd WebAssembly module loaded");
});

Module.ZstdReady = false;

Module.onReady = new Promise(function (func) {
    if (Module["calledRun"]) {
        func(Module);
    } else {
        const old = Module["onRuntimeInitialized"];
        Module["onRuntimeInitialized"] = function () {
            if (old) {
                old();
            }
            func(Module);
        };
    }
    Module.ZstdReady = true;
});

Module.Decompress = (src: Uint8Array, destSize: number): Uint8Array => {
    const srcSize = src.byteLength;

    // resize src if buffer is not big enough
    if (srcSize > Module.srcAllocated) {
        Module._free(Module.srcPtr);
        Module.srcPtr = Module._malloc(srcSize);
        Module.srcAllocated = srcSize;
    }

    // resize dest if it is not big enough
    if (destSize > Module.destAllocated) {
        Module._free(Module.destPtr);
        Module.destPtr = Module._malloc(destSize);
        Module.destAllocated = destSize;
    }

    const srcHeap = new Uint8Array(Module.HEAPU8.buffer, Module.srcPtr, srcSize);
    srcHeap.set(src);
    const destHeap = new Uint8Array(Module.HEAPU8.buffer, Module.destPtr, destSize);
    const result = decompress(Module.destPtr, destSize, Module.srcPtr, srcSize);
    return destHeap.slice();
};

module.exports = Module;
