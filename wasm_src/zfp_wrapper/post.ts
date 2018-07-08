declare var Module: any;
declare var addOnPostRun: any;
const ctx: Worker = self as any;

// Allocate a 4 MB uncompressed buffer and 1 MB uncompressed buffer
let nDataBytes = 4e6;
let nDataBytesCompressed = 1e6;
let dataPtr: number = null;
let dataHeap: Uint8Array = null;
let resultFloat: Float32Array = null;
let dataPtrUint: number = null;
let dataHeapUint: Uint8Array = null;
let debugOutput = false;
let id = -1;

const zfpDecompress = Module.cwrap("zfpDecompress", "number", ["number", "number", "number", "number", "number", "number"]);

addOnPostRun(() => {
    // Allocate a 4 MB uncompressed buffer and 1 MB uncompressed buffer
    nDataBytes = 4e6;
    nDataBytesCompressed = 1e6;
    dataPtr = Module._malloc(nDataBytes);
    dataHeap = new Uint8Array(Module.HEAPU8.buffer, dataPtr, nDataBytes);
    resultFloat = new Float32Array(dataHeap.buffer, dataHeap.byteOffset, nDataBytes / 4);
    dataPtrUint = Module._malloc(nDataBytesCompressed);
    dataHeapUint = new Uint8Array(Module.HEAPU8.buffer, dataPtrUint, nDataBytesCompressed);

    ctx.postMessage(["ready"]);
});

function zfpDecompressUint8WASM(u8: Uint8Array, compressedSize: number, nx: number, ny: number, precision: number) {
    let newNumDataBytes = nx * ny * 4;
    if (!dataPtr || newNumDataBytes > nDataBytes) {
        if (dataHeap) {
            Module._free(dataHeap.byteOffset);
        }
        nDataBytes = newNumDataBytes;
        dataPtr = Module._malloc(nDataBytes);
        dataHeap = new Uint8Array(Module.HEAPU8.buffer, dataPtr, nDataBytes);
        if (debugOutput) {
            console.log(`ZFP Worker ${id} allocating new uncompressed buffer (${nDataBytes / 1000} KB)`);
        }
        resultFloat = new Float32Array(dataHeap.buffer, dataHeap.byteOffset, nx * ny);
    }

    let newNumDataBytesCompressed = u8.length;
    if (!dataPtrUint || newNumDataBytesCompressed > nDataBytesCompressed) {
        if (dataHeapUint) {
            Module._free(dataHeapUint.byteOffset);
        }
        nDataBytesCompressed = newNumDataBytesCompressed;
        dataPtrUint = Module._malloc(nDataBytesCompressed);
        dataHeapUint = new Uint8Array(Module.HEAPU8.buffer, dataPtrUint, nDataBytesCompressed);
        if (debugOutput) {
            console.log(`ZFP Worker ${id} allocating new compressed buffer (${nDataBytesCompressed / 1000} KB)`);
        }
    }

    dataHeapUint.set(new Uint8Array(u8.buffer, 0, compressedSize));
    // Call function and get result
    zfpDecompress(Math.floor(precision), dataHeap.byteOffset, nx, ny, dataHeapUint.byteOffset, compressedSize);

    // Free memory
    return new Float32Array(resultFloat.buffer, resultFloat.byteOffset, nx * ny);
    // END WASM
}

ctx.onmessage = (event => {
    if (event.data && Array.isArray(event.data) && event.data.length > 1) {
        let eventName = event.data[0];

        if (eventName === "debug") {
            debugOutput = event.data[1];
        }
        if (eventName === "setid") {
            id = event.data[1];
        }
        else if (eventName === "decompress") {
            const eventArgs = event.data[2];
            const compressedView = new Uint8Array(event.data[1], 0, eventArgs.subsetLength);
            if (debugOutput) {
                performance.mark("decompressStart");
            }
            let imageData = zfpDecompressUint8WASM(compressedView, eventArgs.subsetLength, eventArgs.width, eventArgs.subsetHeight, eventArgs.compression);
            if (debugOutput) {
                performance.mark("decompressEnd");
            }
            let outputView = new Float32Array(event.data[1], 0, eventArgs.width * eventArgs.subsetHeight);
            outputView.set(imageData);

            // put NaNs back into data
            let decodedIndex = 0;
            let fillVal = false;

            for (let L of eventArgs.nanEncodings) {
                if (fillVal) {
                    outputView.fill(NaN, decodedIndex, decodedIndex + L);
                }
                fillVal = !fillVal;
                decodedIndex += L;
            }

            ctx.postMessage(["decompress", event.data[1], {
                width: eventArgs.width,
                subsetHeight: eventArgs.subsetHeight,
                subsetLength: eventArgs.subsetLength
            }], [event.data[1]]);

            if (debugOutput) {
                performance.measure("dtDecompress", "decompressStart", "decompressEnd");
                const dt = performance.getEntriesByName("dtDecompress")[0].duration;
                performance.clearMarks();
                performance.clearMeasures();
                const eventSize = (4e-6 * eventArgs.width * eventArgs.subsetHeight);
                setTimeout(() => {
                    console.log(`ZFP Worker ${id} decompressed ${eventSize.toFixed(2)} MB in ${dt.toFixed(2)} ms at ${(1e3 * eventSize / dt).toFixed(2)} MB/s (${(1e3 * eventSize / dt / 4).toFixed(2)} Mpix/s)`);
                }, 100);
            }
        }
    }

});