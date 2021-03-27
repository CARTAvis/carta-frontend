declare var Module: any;
declare var addOnPostRun: any;

Module.filterBoxcar = Module.cwrap("filterBoxcar", "number", ["number", "number", "number", "number"]);
Module.filterGaussian = Module.cwrap("filterGaussian", "number", ["number", "number", "number", "number", "number"]);
Module.filterHanning = Module.cwrap("filterHanning", "number", ["number", "number", "number", "number"]);
Module.filterDecimation = Module.cwrap("filterDecimation", "number", ["number", "number", "number", "number", "number"]);
Module.filterBinning = Module.cwrap("filterBinning", "number", ["number", "number", "number", "number"]);
Module.filterSavitzkyGolay = Module.cwrap("filterSavitzkyGolay", "number", ["number", "number", "number", "number", "number", "number"]);
Module.getMinMax = Module.cwrap("getMinMax", null, ["number", "number", "number"])

Module.minMaxArray = function (data: Float64Array): {max: number, min: number} {
    if (!data) {
        return {max: undefined, min: undefined};
    }

    const N = data.length;
    const dataOnWasmHeap = Module._malloc(N * 8);
    const maxBuf = Module._malloc(8);
    const minBuf = Module._malloc(8);
    Module.HEAPF64.set(new Float64Array(data), dataOnWasmHeap / 8);

    Module.getMinMax(dataOnWasmHeap, N, minBuf, maxBuf);

    const min = Module.getValue(minBuf, "double");
    const max = Module.getValue(maxBuf, "double");
    Module._free(dataOnWasmHeap);
    Module._free(minBuf);
    Module._free(maxBuf);
    return {max: max, min};
}

Module.boxcarSmooth = function (yIn: Float64Array | Float32Array, kernelSize: number) {
    // Return empty array if arguments are invalid
    if (!yIn) {
        return new Float64Array(1);
    }

    const N = yIn.length;
    Module.yIn = Module._malloc(N * 8);
    Module.yOut = Module._malloc(N * 8);

    Module.HEAPF64.set(new Float64Array(yIn), Module.yIn / 8);
    Module.filterBoxcar(Module.yIn, N, Module.yOut, kernelSize);
    const yOut = new Float64Array(Module.HEAPF64.buffer, Module.yOut, N).slice();

    Module._free(Module.yIn);
    Module._free(Module.yOut);
    return yOut;
};

Module.gaussianSmooth = function (yIn: Float64Array | Float32Array, kernelSize: number, alpha: number) {
    // Return empty array if arguments are invalid
    if (!yIn) {
        return new Float64Array(1);
    }

    const N = yIn.length;
    Module.yIn = Module._malloc(N * 8);
    Module.yOut = Module._malloc(N * 8);

    Module.HEAPF64.set(new Float64Array(yIn), Module.yIn / 8);
    Module.filterGaussian(Module.yIn, N, Module.yOut, kernelSize, alpha);
    const yOut = new Float64Array(Module.HEAPF64.buffer, Module.yOut, N).slice();

    Module._free(Module.yIn);
    Module._free(Module.yOut);
    return yOut;
};

Module.hanningSmooth = function (yIn: Float64Array | Float32Array, kernelSize: number) {
    if (!yIn) {
        return new Float64Array(1);
    }

    const N = yIn.length;
    Module.yIn = Module._malloc(N * 8);
    Module.yOut = Module._malloc(N * 8);

    Module.HEAPF64.set(new Float64Array(yIn), Module.yIn / 8);
    Module.filterHanning(Module.yIn, N, Module.yOut, kernelSize);
    const yOut = new Float64Array(Module.HEAPF64.buffer, Module.yOut, N).slice();

    Module._free(Module.yIn);
    Module._free(Module.yOut);
    return yOut;
};

Module.decimation = function (xIn: Float64Array | Float32Array, yIn: Float64Array | Float32Array, decimationWidth: number) {
    if (!yIn) {
        return new Float64Array(1);
    }

    const inN = yIn.length;
    Module.xIn = Module._malloc(inN * 8);
    Module.yIn = Module._malloc(inN * 8);
    const outN = (inN % decimationWidth === 1) ? 2 * Math.ceil(inN / decimationWidth) - 1 : 2 * Math.ceil(inN / decimationWidth);
    Module.xOut = Module._malloc(outN * 8);
    Module.yOut = Module._malloc(outN * 8);

    Module.HEAPF64.set(new Float64Array(xIn), Module.xIn / 8);
    Module.HEAPF64.set(new Float64Array(yIn), Module.yIn / 8);
    Module.filterDecimation(Module.xIn, Module.yIn, inN, Module.xOut, Module.yOut, outN, decimationWidth);
    const xOut = new Float64Array(Module.HEAPF64.buffer, Module.xOut, outN).slice();
    const yOut = new Float64Array(Module.HEAPF64.buffer, Module.yOut, outN).slice();

    Module._free(Module.xIn);
    Module._free(Module.yIn);
    Module._free(Module.xOut);
    Module._free(Module.yOut);
    return {x: xOut, y: yOut};
};

Module.binning = function (input: Float64Array | Float32Array, binWidth: number) {
    if (!input) {
        return new Float64Array(1);
    }

    const inN = input.length;
    Module.input = Module._malloc(inN * 8);
    const outN = Math.ceil(inN / binWidth);
    Module.output = Module._malloc(outN * 8);

    Module.HEAPF64.set(new Float64Array(input), Module.input / 8);
    Module.filterBinning(Module.input, inN, Module.output, binWidth);
    const output = new Float64Array(Module.HEAPF64.buffer, Module.output, outN).slice();

    Module._free(Module.input);
    Module._free(Module.output);
    return output;
};

Module.savitzkyGolaySmooth = function (xIn: Float64Array | Float32Array, yIn: Float64Array | Float32Array, kernelSize: number, order: number) {
    if (!xIn || !yIn || order >= kernelSize) {
        return new Float64Array(1);
    }

    const N = xIn.length;
    Module.xIn = Module._malloc(N * 8);
    Module.yIn = Module._malloc(N * 8);
    Module.yOut = Module._malloc(N * 8);

    Module.HEAPF64.set(new Float64Array(xIn), Module.xIn / 8);
    Module.HEAPF64.set(new Float64Array(yIn), Module.yIn / 8);
    Module.filterSavitzkyGolay(Module.xIn, Module.yIn, N, Module.yOut, kernelSize, order);
    const yOut = new Float64Array(Module.HEAPF64.buffer, Module.yOut, N).slice();

    Module._free(Module.xIn);
    Module._free(Module.yIn);
    Module._free(Module.yOut);
    return yOut;
};

module.exports = Module;
