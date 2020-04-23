declare var Module: any;
declare var addOnPostRun: any;

Module.filterGaussian = Module.cwrap("filterGaussian", "number", ["number", "number", "number", "number"]);

Module.gaussianSmooth = function (xIn: Float64Array | Float32Array, kernelSize: number) {
    // Return empty array if arguments are invalid
    if (!xIn) {
        return new Float64Array(1);
    }

    const N = xIn.length;
    Module.xIn = Module._malloc(N * 8);
    Module.xOut = Module._malloc(N * 8);

    Module.HEAPF64.set(new Float64Array(xIn), Module.xIn / 8);
    Module.filterGaussian(Module.xIn, N, Module.xOut, kernelSize);
    const xOut = new Float64Array(Module.HEAPF64.buffer, Module.xOut, N);

    Module._free(Module.xIn);
    Module._free(Module.xOut);
    return xOut;
};

module.exports = Module;
