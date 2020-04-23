declare var Module: any;
declare var addOnPostRun: any;

// Allocate a 4 MB uncompressed buffer and 1 MB uncompressed buffer
Module.nDataBytes = 4e6;
Module.dataPtr = null;
Module.dataHeap = null;
Module.resultFloat = null;
Module.dataPtrUint = null;
Module.dataHeapUint = null;
Module.debugOutput = false;
Module.id = -1;

addOnPostRun(() => {
    Module.numArrayCoordinates = 1;
    Module.xIn = Module._malloc(Module.numArrayCoordinates * 8);
    Module.yIn = Module._malloc(Module.numArrayCoordinates * 8);
    Module.xOut = Module._malloc(Module.numArrayCoordinates * 8);
    Module.yOut = Module._malloc(Module.numArrayCoordinates * 8);
});

Module.filterGaussian = Module.cwrap("filterGaussian", "number", ["number", "number", "number", "number"] )

Module.gaussianSmooth = function (xIn: Float64Array, kernelSize: number) {
    console.log("xIn", xIn);
    // Return empty array if arguments are invalid
    if (!(xIn instanceof Float64Array) || !xIn) {
        return new Float64Array(1);
    }

    const N = xIn.length;
    // Return
    if (N > Module.numArrayCoordinates) {
        Module._free(Module.xIn);
        Module._free(Module.xOut);
        Module.xIn = Module._malloc(N * 16);
        Module.xOut = Module._malloc(N * 16);
    }

    const xxIn = [1,2,3,4,2,3,55,23,11,21];
    console.log("Module.xIn", Module.xIn);
    Module.HEAPF64.set(new Float64Array(xIn), Module.xIn / 8);
    console.log("Module.HEAPF64", Module.HEAPF64);
    Module.filterGaussian(Module.xIn, N, Module.xOut, 3);
    const xOut = new Float64Array(Module.HEAPF64.buffer, Module.xOut, N);
    //const xOut = new Float64Array(1000);
    console.log(xOut);

    Module._free(Module.xIn);
    Module._free(Module.xOut);
    return xOut;
};

module.exports = Module;
