declare var Module: any;
declare var addOnPostRun: any;

Module.filterBoxcar = Module.cwrap("filterBoxcar", "number", ["number", "number", "number", "number"]);
Module.filterGaussian = Module.cwrap("filterGaussian", "number", ["number", "number", "number", "number", "number"]);
Module.filterHanning = Module.cwrap("filterHanning", "number", ["number", "number", "number", "number"]);
Module.filterDecimation = Module.cwrap("filterDecimation", "number", ["number", "number", "number", "number", "number"]);
Module.filterBinning = Module.cwrap("filterBinning", "number", ["number", "number", "number", "number"]);
Module.filterSavitzkyGolay = Module.cwrap("filterSavitzkyGolay", "number", ["number", "number", "number", "number", "number", "number"]);
Module.fittingGaussian = Module.cwrap("fittingGaussian", "number", ["number", "number", "number", "number", "number", "number", "number", "number", "number", "string"])

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

// inputData stores initial guesses as [amp1, center1, fwhm1, amp2, center2, fwhm2, ...]
// lockedInputdData stores which initial guesses are locked as [1(amp1), 0(center1), 0(fwhm1), 0(amp2), 1(center2), 0(fwhm2), ...]
Module.gaussianFitting = function (xIn: Float64Array | Float32Array, yIn: Float64Array | Float32Array, inputData: number[], lockedInputData: number[]) {
    if (!xIn || !yIn || !inputData) {
        return null;
    }

    const dataN = xIn.length;
    Module.xIn = Module._malloc(dataN * 8);
    Module.yIn = Module._malloc(dataN * 8);
    Module.HEAPF64.set(new Float64Array(xIn), Module.xIn / 8);
    Module.HEAPF64.set(new Float64Array(yIn), Module.yIn / 8);

    const componentN = inputData.length / 3;

    Module.inputData = Module._malloc(componentN * 3 * 8);
    Module.HEAPF64.set(new Float64Array(inputData), Module.inputData / 8);
    const inputArray: number[] = [];
    for (let i = 0 ; i < componentN; i++) {
        inputArray.push(Module.inputData + i * 3 * 8);
    }
    Module.inputArray = Module._malloc(componentN * 4);
    Module.HEAPU32.set(new Uint32Array(inputArray), Module.inputArray / 4);

    Module.lockedInputData = Module._malloc(componentN * 3 * 4);
    Module.HEAP32.set(new Int32Array(lockedInputData), Module.lockedInputData / 4);
    const lockedInputArray: number[] = [];
    for (let i = 0; i < componentN; i++) {
        lockedInputArray.push(Module.lockedInputData + i * 3 * 4)
    }
    Module.lockedInputArray = Module._malloc(componentN * 4);
    Module.HEAPU32.set(new Uint32Array(lockedInputArray), Module.lockedInputArray / 4);

    Module.resultAmp = Module._malloc(componentN * 8);
    Module.resultCenter = Module._malloc(componentN * 8);
    Module.resultFwhm = Module._malloc(componentN * 8);

    Module.logBytes = 1e6;
    Module.logPtrUint = Module._malloc(Module.logBytes);
    Module.logHeapUint = new Uint8Array(Module.HEAPU8.buffer, Module.logPtrUint, Module.logBytes); // ???

    Module.fittingGaussian(Module.xIn, Module.yIn, dataN, Module.inputArray, Module.lockedInputArray, Module.resultAmp, Module.resultCenter, Module.resultFwhm, componentN, Module.logPtrUint);

    const centerOut = new Float64Array(Module.HEAPF64.buffer, Module.resultCenter, componentN).slice();
    const ampOut = new Float64Array(Module.HEAPF64.buffer, Module.resultAmp, componentN).slice();
    const fwhmOut = new Float64Array(Module.HEAPF64.buffer, Module.resultFwhm, componentN).slice();
    const log = Module.logHeapUint.slice();

    Module._free(Module.xIn);
    Module._free(Module.yIn);

    Module._free(Module.inputArray);
    Module._free(Module.inputData);

    Module._free(Module.lockedInputArray);
    Module._free(Module.lockedInputData);

    Module._free(Module.resultCenter);
    Module._free(Module.resultAmp);
    Module._free(Module.resultFwhm);
    Module._free(Module.logPtrUint);

    return {center: centerOut, amp: ampOut, fwhm: fwhmOut, log: log};
}

module.exports = Module;
