import TypedArray = NodeJS.TypedArray;

declare var Module: any;
declare var addOnPostRun: any;

const decompress = Module.cwrap("ZSTD_decompress", "number", ["number", "number", "number", "number"]);
const decodeArray = Module.cwrap("decodeArray", "number", ["number", "number", "number"]);
const generateVertexData = Module.cwrap("generateVertexData", "number", ["number", "number", "number", "number", "number", "number"]);
const calculateCatalogSizeArea = Module.cwrap("calculateCatalogSizeArea", null, ["number", "number", "number", "number", "number", "number", "number", "number", "number", "number"]);
const calculateCatalogSizeDiameter = Module.cwrap("calculateCatalogSizeDiameter", null, ["number", "number", "number", "number", "number", "number", "number", "number", "number", "number"]);

const VertexDataElements = 8;

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

type TypedJSArray =
    | Uint8Array
    | Uint8ClampedArray
    | Uint16Array
    | Uint32Array
    | Int8Array
    | Int16Array
    | Int32Array
    | Float32Array
    | Float64Array;

function resizeAndFillBuffers(src: TypedJSArray, destSize) {
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
}

Module.Decompress = (src: Uint8Array, destSize: number): Uint8Array => {
    const srcSize = src.byteLength;
    resizeAndFillBuffers(src, destSize);

    const destHeap = new Uint8Array(Module.HEAPU8.buffer, Module.destPtr, destSize);
    const result = decompress(Module.destPtr, destSize, Module.srcPtr, srcSize);
    return destHeap.slice();
};

Module.Decode = (src: Uint8Array, destSize: number, decimationFactor: number): Float32Array => {
    const srcSize = src.byteLength;
    resizeAndFillBuffers(src, destSize);

    const result = decompress(Module.destPtr, destSize, Module.srcPtr, srcSize);
    const destHeapFloat = new Float32Array(Module.HEAPU8.buffer, Module.destPtr, destSize / 4);
    decodeArray(Module.destPtr, destSize, decimationFactor);
    return destHeapFloat.slice();
};

Module.GenerateVertexData = (sourceVertices: Float32Array, indexOffsets: Int32Array): Float32Array => {
    const numPolyLines = indexOffsets.length;
    const numVertices = sourceVertices.length / 2;
    const destSize = (numVertices + numPolyLines - 1) * VertexDataElements * 4;
    const srcBytes = new Uint8Array(sourceVertices.buffer);
    resizeAndFillBuffers(srcBytes, destSize);
    const srcIndexSize = indexOffsets.byteLength;
    const indexPtr = Module._malloc(srcIndexSize);
    const srcHeapIndex = new Int32Array(Module.HEAPU8.buffer, indexPtr, indexOffsets.length);
    srcHeapIndex.set(indexOffsets);

    const destHeapFloat = new Float32Array(Module.HEAPU8.buffer, Module.destPtr, destSize / 4);
    generateVertexData(Module.destPtr, destSize / 4, Module.srcPtr, numVertices, indexPtr, numPolyLines);
    Module._free(indexPtr);
    return destHeapFloat;
};

Module.CalculateCatalogSize = (data: Float64Array, min: number, max: number, shapeSize: number, sizeMin: number, sizeMax: number, scaling: number, sizeType: string, alpha: number = 1000, gamma: number = 1.5): number[] => {
    if (!data) {
        return [];
    }

    const N = data.length;
    const dataOnWasmHeap = Module._malloc(N * 8);
    Module.HEAPF64.set(new Float64Array(data), dataOnWasmHeap / 8);

    if (sizeType === "area") {
        calculateCatalogSizeArea(dataOnWasmHeap, N, min, max, shapeSize, sizeMin, sizeMax, scaling, alpha, gamma);
    } else if (sizeType === "diameter") {
        calculateCatalogSizeDiameter(dataOnWasmHeap, N, min, max, shapeSize, sizeMin, sizeMax, scaling, alpha, gamma);
    } else {
        Module._free(dataOnWasmHeap);
        return [];
    }

    const float64 = new Float64Array(Module.HEAPF64.buffer, dataOnWasmHeap, N);
    Module._free(dataOnWasmHeap);
    let size = Array(N);
    for (let i = 0; i < N; i++) {
        size[i] = isFinite(float64[i]) ? float64[i] : sizeMin;
    }
    return size;
}

module.exports = Module;
