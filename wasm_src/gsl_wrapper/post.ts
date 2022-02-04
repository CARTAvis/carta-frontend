declare var Module: any;
declare var addOnPostRun: any;

Module.linearRegression = Module.cwrap("linearRegression", "number", ["number", "number", "number", "number", "number", "number", "number", "number", "number"]);
Module.filterBoxcar = Module.cwrap("filterBoxcar", "number", ["number", "number", "number", "number"]);
Module.filterGaussian = Module.cwrap("filterGaussian", "number", ["number", "number", "number", "number", "number"]);
Module.filterHanning = Module.cwrap("filterHanning", "number", ["number", "number", "number", "number"]);
Module.filterDecimation = Module.cwrap("filterDecimation", "number", ["number", "number", "number", "number", "number"]);
Module.filterBinning = Module.cwrap("filterBinning", "number", ["number", "number", "number", "number"]);
Module.filterSavitzkyGolay = Module.cwrap("filterSavitzkyGolay", "number", ["number", "number", "number", "number", "number", "number"]);
Module.fittingGaussian = Module.cwrap("fitting", "string", ["number", "number", "number", "number", "number", "number", "number", "number", "number", "number", "number", "number", "number", "number"]);

Module.getFittingParameters = function (x: Float64Array, y: Float64Array) {
    const N = x.length;
    Module.xIn = Module._malloc(N * 8);
    Module.yIn = Module._malloc(N * 8);
    const c0Out = Module._malloc(8);
    const c1Out = Module._malloc(8);
    const cov00Out = Module._malloc(8);
    const cov01Out = Module._malloc(8);
    const cov11Out = Module._malloc(8);
    const sumsqOut = Module._malloc(8);

    Module.HEAPF64.set(x, Module.xIn / 8);
    Module.HEAPF64.set(y, Module.yIn / 8);
    Module.linearRegression(Module.xIn, Module.yIn, N, c0Out, c1Out, cov00Out, cov01Out, cov11Out, sumsqOut);
    

    const c0 = Module.getValue(c0Out, "double");
    const c1 = Module.getValue(c1Out, "double");
    const cov00 = Module.getValue(cov00Out, "double");
    const cov01 = Module.getValue(cov01Out, "double");
    const cov11 = Module.getValue(cov11Out, "double");
    const sumsq = Module.getValue(sumsqOut, "double");

    Module._free(c0Out);
    Module._free(c1Out);
    Module._free(cov00Out);
    Module._free(cov01Out);
    Module._free(cov11Out);
    Module._free(sumsqOut);
    Module._free(Module.xIn);
    Module._free(Module.yIn);

    // Y = c0 + c1*X  
    // c0, c1 - coefficients
    // cov00, cov01, cov11 - variance-covariance matrix of c0 and c1
    // sumsq - sum of squares of residuals 
    return {intercept: c0, slope: c1, cov00: cov00, cov01: cov01, cov11: cov11, rss:sumsq};
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

// functionType = 0, using Gaussian. functionType = 1, using Lorentzian.
// inputData stores initial guesses as [amp1, center1, fwhm1, amp2, center2, fwhm2, ...]
// lockedInputdData stores which initial guesses are locked as [1(amp1), 0(center1), 0(fwhm1), 0(amp2), 1(center2), 0(fwhm2), ...]. 1 as locked, 0 as unlocked.
// orderInputData stores initial guesses as [yIntercept, slope]
// lockedOrderInputData stores which initial guesses are locked as [0(yIntercept), 1(slope)]. 1 as locked, 0 as unlocked..
Module.fitting = function (functionType: number, xIn: Float64Array | Float32Array, yIn: Float64Array | Float32Array, inputData: number[], lockedInputData: number[], orderInputData: number[], lockedOrderInputData: number[]) {
    if (!xIn || !yIn || !inputData || !lockedInputData) {
        return null;
    }

    const dataN = xIn.length;
    Module.xIn = Module._malloc(dataN * 8);
    Module.yIn = Module._malloc(dataN * 8);
    Module.HEAPF64.set(new Float64Array(xIn), Module.xIn / 8);
    Module.HEAPF64.set(new Float64Array(yIn), Module.yIn / 8);

    const componentN = inputData.length / 3;

    Module.orderValues = Module._malloc(2 * 8);
    Module.lockedOrderValues = Module._malloc(2 * 4);
    Module.HEAPF64.set(new Float64Array(orderInputData), Module.orderValues / 8);
    Module.HEAP32.set(new Int32Array(lockedOrderInputData), Module.lockedOrderValues / 4);

    Module.inputData = Module._malloc(componentN * 3 * 8); // 2-dimensional array: double inputData[][3]
    Module.HEAPF64.set(new Float64Array(inputData), Module.inputData / 8);
    const inputArray: number[] = [];
    for (let i = 0; i < componentN; i++) {
        inputArray.push(Module.inputData + i * 3 * 8);
    }
    Module.inputArray = Module._malloc(componentN * 4);
    Module.HEAPU32.set(new Uint32Array(inputArray), Module.inputArray / 4);

    Module.lockedInputData = Module._malloc(componentN * 3 * 4); // 2-dimensional array: int lockedInputData [][3]
    Module.HEAP32.set(new Int32Array(lockedInputData), Module.lockedInputData / 4);
    const lockedInputArray: number[] = [];
    for (let i = 0; i < componentN; i++) {
        lockedInputArray.push(Module.lockedInputData + i * 3 * 4);
    }
    Module.lockedInputArray = Module._malloc(componentN * 4);
    Module.HEAPU32.set(new Uint32Array(lockedInputArray), Module.lockedInputArray / 4);

    Module.resultOrderValues = Module._malloc(4 * 8); // yIntercept, yInterceptError, slope, slopeError
    Module.resultAmp = Module._malloc(componentN * 8 * 2); // amp with error.
    Module.resultCenter = Module._malloc(componentN * 8 * 2); // center with error.
    Module.resultFwhm = Module._malloc(componentN * 8 * 2); // fwhm with error.
    Module.resultIntegral = Module._malloc(componentN * 8 * 2); // integral with error.
    Module.resultResidual = Module._malloc(dataN * 8);

    const log = Module.fittingGaussian(
        Module.xIn, Module.yIn, dataN,
        Module.inputArray, Module.lockedInputArray, componentN,
        functionType, Module.orderValues, Module.lockedOrderValues,
        Module.resultAmp, Module.resultCenter, Module.resultFwhm, Module.resultOrderValues, Module.resultIntegral, Module.resultResidual
    );

    const orderValuesOut = new Float64Array(Module.HEAPF64.buffer, Module.resultOrderValues, 4).slice(); // [yIntercept, yInterceptError, slope, slopeError]
    const centerOut = new Float64Array(Module.HEAPF64.buffer, Module.resultCenter, componentN * 2).slice(); // [amp1, amp1Error, amp2, amp2Error, ...]
    const ampOut = new Float64Array(Module.HEAPF64.buffer, Module.resultAmp, componentN * 2).slice(); // [center1, center1Error, center2, center2Error, ...]
    const fwhmOut = new Float64Array(Module.HEAPF64.buffer, Module.resultFwhm, componentN * 2).slice(); // [fwhm1, fwhm1Error, fwhm2, fwhmError2, ...]
    const integralOut = new Float64Array(Module.HEAPF64.buffer, Module.resultIntegral, componentN * 2).slice(); // [integral1, integral1Error, integral2, integral2Error, ...]
    const residualOut = new Float64Array(Module.HEAPF64.buffer, Module.resultResidual, dataN).slice();
    const result = {yIntercept: orderValuesOut[0], yInterceptError: orderValuesOut[1], slope: orderValuesOut[2], slopeError: orderValuesOut[3], center: centerOut, amp: ampOut, fwhm: fwhmOut, log: log, integral: integralOut, residual: residualOut};

    Module._free(Module.xIn);
    Module._free(Module.yIn);
    Module._free(Module.orderValues);
    Module._free(Module.lockedOrderValues);
    Module._free(Module.inputArray);
    Module._free(Module.inputData);
    Module._free(Module.lockedInputArray);
    Module._free(Module.lockedInputData);
    Module._free(Module.resultOrderValues);
    Module._free(Module.resultCenter);
    Module._free(Module.resultAmp);
    Module._free(Module.resultFwhm);
    Module._free(Module.resultIntegral);
    Module._free(Module.resultResidual);
    return result;
};

module.exports = Module;
