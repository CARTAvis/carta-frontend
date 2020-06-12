declare var Module: any;
declare var addOnPostRun: any;

Module.filterBoxcar = Module.cwrap("filterBoxcar", "number", ["number", "number", "number", "number"]);
Module.filterGaussian = Module.cwrap("filterGaussian", "number", ["number", "number", "number", "number", "number"]);
Module.filterHanning = Module.cwrap("filterHanning", "number", ["number", "number", "number", "number"]);
Module.filterDecimation = Module.cwrap("filterDecimation", "number", ["number", "number", "number", "number", "number"]);
Module.filterBinning = Module.cwrap("filterBinning", "number", ["number", "number", "number", "number"]);
Module.filterSavitzkyGolay = Module.cwrap("filterSavitzkyGolay", "number", ["number", "number", "number", "number", "number"]);

Module.boxcarSmooth = function (xIn: Float64Array | Float32Array, kernelSize: number) {
    // Return empty array if arguments are invalid
    if (!xIn) {
        return new Float64Array(1);
    }

    const N = xIn.length;
    Module.xIn = Module._malloc(N * 8);
    Module.xOut = Module._malloc(N * 8);

    Module.HEAPF64.set(new Float64Array(xIn), Module.xIn / 8);
    Module.filterBoxcar(Module.xIn, N, Module.xOut, kernelSize);
    const xOut = new Float64Array(Module.HEAPF64.buffer, Module.xOut, N).slice();

    Module._free(Module.xIn);
    Module._free(Module.xOut);
    return xOut;
};

Module.gaussianSmooth = function (xIn: Float64Array | Float32Array, kernelSize: number, alpha: number) {
    // Return empty array if arguments are invalid
    if (!xIn) {
        return new Float64Array(1);
    }

    const N = xIn.length;
    Module.xIn = Module._malloc(N * 8);
    Module.xOut = Module._malloc(N * 8);

    Module.HEAPF64.set(new Float64Array(xIn), Module.xIn / 8);
    Module.filterGaussian(Module.xIn, N, Module.xOut, kernelSize, alpha);
    const xOut = new Float64Array(Module.HEAPF64.buffer, Module.xOut, N).slice();

    Module._free(Module.xIn);
    Module._free(Module.xOut);
    return xOut;
};

Module.hanningSmooth = function (xIn: Float64Array | Float32Array, kernelSize: number) {
    if (!xIn) {
        return new Float64Array(1);
    }

    const N = xIn.length;
    Module.xIn = Module._malloc(N * 8);
    Module.xOut = Module._malloc(N * 8);

    Module.HEAPF64.set(new Float64Array(xIn), Module.xIn / 8);
    Module.filterHanning(Module.xIn, N, Module.xOut, kernelSize);
    const xOut = new Float64Array(Module.HEAPF64.buffer, Module.xOut, N).slice();

    Module._free(Module.xIn);
    Module._free(Module.xOut);
    return xOut;
};

Module.decimation = function (xIn: Float64Array | Float32Array, decimationFactor: number) {
    if (!xIn) {
        return new Float64Array(1);
    }

    const inN = xIn.length;
    Module.xIn = Module._malloc(inN * 8);
    const outN = 2 * Math.ceil(xIn.length / decimationFactor);
    Module.xOut = Module._malloc(outN * 4);

    Module.HEAPF64.set(new Float64Array(xIn), Module.xIn / 8);
    Module.filterDecimation(Module.xIn, inN, Module.xOut, outN, decimationFactor);
    const xOut = new Int32Array(Module.HEAPF64.buffer, Module.xOut, outN).slice();

    Module._free(Module.xIn);
    Module._free(Module.xOut);
    return xOut;
};

Module.binning = function (xIn: Float64Array | Float32Array, binWidth: number) {
    if (!xIn) {
        return new Float64Array(1);
    }

    const inN = xIn.length;
    Module.xIn = Module._malloc(inN * 8);
    const outN = Math.ceil(xIn.length / binWidth);
    Module.xOut = Module._malloc(outN * 8);

    Module.HEAPF64.set(new Float64Array(xIn), Module.xIn / 8);
    Module.filterBinning(Module.xIn, inN, Module.xOut, binWidth);
    const xOut = new Float64Array(Module.HEAPF64.buffer, Module.xOut, outN).slice();

    Module._free(Module.xIn);
    Module._free(Module.xOut);
    return xOut;
};

Module.savitzkyGolaySmooth = function (xIn: Float64Array | Float32Array, kernelSize: number, order: number) {
    if (!xIn) {
        return new Float64Array(1);
    }

    const N = xIn.length;
    Module.xIn = Module._malloc(N * 8);
    Module.xOut = Module._malloc(N * 8);
    // Module.horizontalIn = Module._malloc(N * 8);

    Module.HEAPF64.set(new Float64Array(xIn), Module.xIn / 8);
    // Module.HEAPF64.set(new Float64Array(horizontalIn), Module.horizontalIn / 8);
    Module.filterSavitzkyGolay(Module.xIn, N, Module.xOut, kernelSize, order);
    const xOut = new Float64Array(Module.HEAPF64.buffer, Module.xOut, N).slice();

    Module._free(Module.xIn);
    Module._free(Module.xOut);
    return xOut;
};

module.exports = Module;
