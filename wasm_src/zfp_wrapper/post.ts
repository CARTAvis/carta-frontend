declare var Module: any;
declare var addOnPostRun: any;
const ctx: Worker = self as any;
const FLT_MAX = 3.402823466e+38;
// Allocate a 4 MB uncompressed buffer and 1 MB uncompressed buffer
Module.nDataBytes = 4e6;
Module.nDataBytesCompressed = 1e6;
Module.dataPtr = null;
Module.dataHeap = null;
Module.resultFloat = null;
Module.dataPtrUint = null;
Module.dataHeapUint = null;
Module.debugOutput = false;
Module.id = -1;

const zfpDecompress = Module.cwrap("zfpDecompress", "number", ["number", "number", "number", "number", "number", "number"]);

addOnPostRun(() => {
    // Allocate a 4 MB uncompressed buffer and 1 MB uncompressed buffer
    Module.nDataBytes = 4e6;
    Module.nDataBytesCompressed = 1e6;
    Module.dataPtr = Module._malloc(Module.nDataBytes);
    Module.dataHeap = new Uint8Array(Module.HEAPU8.buffer, Module.dataPtr, Module.nDataBytes);
    Module.resultFloat = new Float32Array(Module.dataHeap.buffer, Module.dataHeap.byteOffset, Module.nDataBytes / 4);
    Module.dataPtrUint = Module._malloc(Module.nDataBytesCompressed);
    Module.dataHeapUint = new Uint8Array(Module.HEAPU8.buffer, Module.dataPtrUint, Module.nDataBytesCompressed);

    ctx.postMessage(["ready"]);
});

Module.zfpDecompressUint8WASM = function (u8: Uint8Array, compressedSize: number, nx: number, ny: number, precision: number) {
    let newNumDataBytes = nx * ny * 4;
    if (!Module.dataPtr || newNumDataBytes > Module.nDataBytes) {
        if (Module.dataHeap) {
            Module._free(Module.dataHeap.byteOffset);
        }
        Module.nDataBytes = newNumDataBytes;
        Module.dataPtr = Module._malloc(Module.nDataBytes);
        Module.dataHeap = new Uint8Array(Module.HEAPU8.buffer, Module.dataPtr, Module.nDataBytes);
        if (Module.debugOutput) {
            console.log(`ZFP Worker ${Module.id} allocating new uncompressed buffer (${Module.nDataBytes / 1000} KB)`);
        }
        Module.resultFloat = new Float32Array(Module.dataHeap.buffer, Module.dataHeap.byteOffset, nx * ny);
    }

    let newNumDataBytesCompressed = u8.length;
    if (!Module.dataPtrUint || newNumDataBytesCompressed > Module.nDataBytesCompressed) {
        if (Module.dataHeapUint) {
            Module._free(Module.dataHeapUint.byteOffset);
        }
        Module.nDataBytesCompressed = newNumDataBytesCompressed;
        Module.dataPtrUint = Module._malloc(Module.nDataBytesCompressed);
        Module.dataHeapUint = new Uint8Array(Module.HEAPU8.buffer, Module.dataPtrUint, Module.nDataBytesCompressed);
        if (Module.debugOutput) {
            console.log(`ZFP Worker ${Module.id} allocating new compressed buffer (${Module.nDataBytesCompressed / 1000} KB)`);
        }
    }

    Module.dataHeapUint.set(new Uint8Array(u8.buffer, u8.byteOffset, compressedSize));
    // Call function and get result
    zfpDecompress(Math.floor(precision), Module.dataHeap.byteOffset, nx, ny, Module.dataHeapUint.byteOffset, compressedSize);

    // Free memory
    return new Float32Array(Module.resultFloat.buffer, Module.resultFloat.byteOffset, nx * ny);
    // END WASM
};

ctx.onmessage = (event => {
    if (event.data && Array.isArray(event.data) && event.data.length > 1) {
        let eventName = event.data[0];

        if (eventName === "debug") {
            Module.debugOutput = event.data[1];
        }
        if (eventName === "setid") {
            Module.id = event.data[1];
        } else if (eventName === "decompress") {
            const eventArgs = event.data[2];
            const compressedView = new Uint8Array(event.data[1], 0, eventArgs.subsetLength);
            if (Module.debugOutput) {
                performance.mark("decompressStart");
            }
            let imageData = Module.zfpDecompressUint8WASM(compressedView, eventArgs.subsetLength, eventArgs.width, eventArgs.subsetHeight, eventArgs.compression);
            if (Module.debugOutput) {
                performance.mark("decompressEnd");
            }
            let outputView = new Float32Array(event.data[1], 0, eventArgs.width * eventArgs.subsetHeight);
            outputView.set(imageData);

            // put NaNs back into data
            let decodedIndex = 0;
            let fillVal = false;

            for (let L of eventArgs.nanEncodings) {
                if (fillVal) {
                    // Some shader compilers have trouble with NaN checks, so we instead use a dummy value of -FLT_MAX
                    outputView.fill(-FLT_MAX, decodedIndex, decodedIndex + L);
                }
                fillVal = !fillVal;
                decodedIndex += L;
            }

            const range = eventArgs.maxVal - eventArgs.minVal;
            if (isFinite(range) && range > 0.0) {
                for (let i = 0; i < outputView.length; i++) {
                    const v = outputView[i];
                    if (v> -FLT_MAX) {
                        outputView[i] = v * range + eventArgs.minVal;
                    }
                }
            }

            ctx.postMessage(["decompress", event.data[1], {
                width: eventArgs.width,
                subsetHeight: eventArgs.subsetHeight,
                subsetLength: eventArgs.subsetLength,
                requestId: eventArgs.requestId,
                tileCoordinate: eventArgs.tileCoordinate,
                layer: eventArgs.layer,
                fileId: eventArgs.fileId,
                channel: eventArgs.channel,
                stokes: eventArgs.stokes,
            }], [event.data[1]]);

            if (Module.debugOutput) {
                performance.measure("dtDecompress", "decompressStart", "decompressEnd");
                const dt = performance.getEntriesByName("dtDecompress")[0].duration;
                performance.clearMarks();
                performance.clearMeasures();
                const eventSize = (4e-6 * eventArgs.width * eventArgs.subsetHeight);
                setTimeout(() => {
                    console.log(`ZFP Worker ${Module.id} decompressed ${eventSize.toFixed(2)} MB in ${dt.toFixed(2)} ms at ${(1e3 * eventSize / dt).toFixed(2)} MB/s (${(1e3 * eventSize / dt / 4).toFixed(2)} Mpix/s)`);
                }, 100);
            }
        }
    }

});

module.exports = Module;
