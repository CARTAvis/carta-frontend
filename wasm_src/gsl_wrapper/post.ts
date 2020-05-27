declare var Module: any;
declare var addOnPostRun: any;

Module.filterBoxcar = Module.cwrap("filterBoxcar", "number", ["number", "number", "number", "number"]);
Module.filterGaussian = Module.cwrap("filterGaussian", "number", ["number", "number", "number", "number", "number"]);
Module.filterHanning = Module.cwrap("filterHanning", "number", ["number", "number", "number", "number"]);
Module.filterDecimation = Module.cwrap("filterDecimation", "number", ["number", "number", "number", "number", "number"]);

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

Module.decimationSmooth = function (xIn: Float64Array | Float32Array, decimationValue: number) {
    if (!xIn) {
        return new Float64Array(1);
    }

    let N: number;
    if (xIn.length % decimationValue !== 0) {
        N = Math.floor(xIn.length / decimationValue) + 1;
    } else {
        N = xIn.length / decimationValue;
    }

    const xOut = new Float64Array(N);
    let i;
    for (i = 0; i < N; i++) {
        xOut[i] = xIn[i * decimationValue];
    }
    if ( (xIn.length - 1) % decimationValue !== 0) {
        xOut[N - 1] = xIn[xIn.length - 1];
    }
    return xOut;
};

module.exports = Module;
