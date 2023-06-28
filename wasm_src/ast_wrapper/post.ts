declare var Module: any;
declare var addOnPostRun: any;
declare var Promise: PromiseConstructor;

addOnPostRun(function () {
    Module.numArrayCoordinates = 1;
    Module.xIn = Module._malloc(Module.numArrayCoordinates * 8);
    Module.yIn = Module._malloc(Module.numArrayCoordinates * 8);
    Module.xOut = Module._malloc(Module.numArrayCoordinates * 8);
    Module.yOut = Module._malloc(Module.numArrayCoordinates * 8);
    Module.zIn = Module._malloc(Module.numArrayCoordinates * 8);
    Module.zOut = Module._malloc(Module.numArrayCoordinates * 8);

    console.log("AST WebAssembly module loaded");
});

Module.LABEL_EXTERIOR = 0;
Module.LABEL_INTERIOR = 1;
Module.DEFAULT_TOLERANCE = 0.01;
Module.DEFAULT_COLOR = 2;
Module.DEFAULT_FONT = "20px Arial";
Module.SYS_ECLIPTIC = 0;
Module.SYS_FK4 = 1;
Module.SYS_FK5 = 2;
Module.SYS_GALACTIC = 3;
Module.SYS_ICRS = 4;
Module.SYS_J2000 = 5;

Module.fonts = [
    "{size} sans-serif",
    "italic {size} sans-serif",
    "bold {size} sans-serif",
    "bold italic {size} sans-serif",
    "{size} times",
    "italic {size} times",
    "bold {size} times",
    "bold italic {size} times",
    "{size} arial",
    "bold {size} arial",
    "italic {size} arial",
    "bold italic {size} arial",
    "{size} palatino",
    "italic {size} palatino",
    "bold {size} palatino",
    "bold italic {size} palatino",
    "{size} courier new",
    "italic {size} courier new",
    "bold {size} courier new",
    "bold italic {size} courier new"
];

Module.colors = [
    "blue", // global
    "blue", // title
    "blue", // grid
    "blue", // border
    "blue", // tick
    "blue", // axe
    "blue", // number
    "blue", // label
    "#62D96B"
];
Module.shapes = [
    "\u25A1", // Square
    "\u25E6", // Little circle
    "\u002B", // Cross
    "\u26B9", // Sextile (star)
    "\u25CB", // Larger circle
    "\u2A09", // Cross
    "\u25A1", // Square (repeat)
    "\u25BD", // Triangle
    "\u2295", // Circled plus
    "\u25A1", // Square (repeat)
    "\u25C7", // Diamond
    "\u2606" // White star
];

Module.setColors = function (colors) {
    Module.colors = colors;
};

Module.setColor = function (color, index) {
    Module.colors[index] = color;
};

Module.setFontList = function (fonts) {
    Module.fonts = fonts;
};

Module.setCanvas = function (canvas) {
    Module.gridContext = canvas.getContext("2d");
    Module.gridContext.imageSmoothingEnabled = false;
    Module.gridContext.scale(1, -1);
    Module.gridContext.translate(0, -canvas.height);
    Module.gridContext.font = Module.font;
};

Module.plot = Module.cwrap("plotGrid", "number", ["number", "number", "number", "number", "number", "number", "number", "number", "number", "number", "number", "string", "boolean", "boolean", "number", "number", "number", "number"]);
Module.emptyFitsChan = Module.cwrap("emptyFitsChan", "number");
Module.putFits = Module.cwrap("putFits", null, ["number", "string"]);
Module.getFrameFromFitsChan = Module.cwrap("getFrameFromFitsChan", "number", ["number", "number"]);
Module.getSpectralFrame = Module.cwrap("getSpectralFrame", "number", ["number"]);
Module.getSkyFrameSet = Module.cwrap("getSkyFrameSet", "number", ["number"]);
Module.getSpatialMapping = Module.cwrap("getSpatialMapping", "number", ["number", "number"]);
Module.initDummyFrame = Module.cwrap("initDummyFrame", "number", []);
Module.set = Module.cwrap("set", "number", ["number", "string"]);
Module.clear = Module.cwrap("clear", "number", ["number", "string"]);
Module.getString = Module.cwrap("getString", "string", ["number", "string"]);
Module.dump = Module.cwrap("dump", null, ["number"]);
Module.norm = Module.cwrap("norm", "number", ["number", "number"]);
Module.axDistance = Module.cwrap("axDistance", "number", ["number", "number", "number", "number"]);
Module.geodesicDistance = Module.cwrap("geodesicDistance", "number", ["number", "number", "number", "number", "number"]);
Module.format = Module.cwrap("format", "string", ["number", "number", "number"]);
Module.unformat = Module.cwrap("unformat", "number", ["number", "number", "string", "number"]);
Module.transform = Module.cwrap("transform", "number", ["number", "number", "number", "number", "number", "number", "number"]);
Module.transform3D = Module.cwrap("transform3D", "number", ["number", "number", "number", "number", "number", "number"]);
Module.transform3DArray = Module.cwrap("transform3DArray", "number", ["number", "number", "number", "number", "number"]);
Module.spectralTransform = Module.cwrap("spectralTransform", "number", ["number", "string", "string", "string", "number", "number", "number", "number"]);
Module.getLastErrorMessage = Module.cwrap("getLastErrorMessage", "string");
Module.clearLastErrorMessage = Module.cwrap("clearLastErrorMessage", null);
Module.copy = Module.cwrap("copy", null, ["number"]);
Module.deleteObject = Module.cwrap("deleteObject", null, ["number"]);
Module.invert = Module.cwrap("invert", "number", ["number"]);
Module.convert = Module.cwrap("convert", "number", ["number", "number", "string"]);
Module.shiftMap2D = Module.cwrap("shiftMap2D", "number", ["number", "number"]);
Module.scaleMap2D = Module.cwrap("scaleMap2D", "number", ["number", "number"]);
Module.frame = Module.cwrap("frame", "number", ["number", "string"]);
Module.addFrame = Module.cwrap("addFrame", null, ["number", "number", "number", "number"]);
Module.setI = Module.cwrap("setI", null, ["number", "string", "number"]);
Module.setD = Module.cwrap("setD", null, ["number", "string", "number"]);
Module.createTransformedFrameset = Module.cwrap("createTransformedFrameset", "number", ["number", "number", "number", "number", "number", "number", "number", "number"]);
Module.fillTransformGrid = Module.cwrap("fillTransformGrid", "number", ["number", "number", "number", "number", "number", "number", "number", "number"]);
Module.pointList = Module.cwrap("pointList", "number", ["number", "number", "number", "number", "number"]);
Module.axPointList = Module.cwrap("axPointList", "number", ["number", "number", "number", "number", "number", "number", "number"]);
Module.makeSwappedFrameSet = Module.cwrap("makeSwappedFrameSet", "number", ["number", "number", "number", "number", "number"]);

Module.currentFormatStrings = [];

Module.getFormattedCoordinates = function (wcsInfo: number, x: number, y: number, formatString: string, tempFormat: boolean) {
    let prevString;
    if (tempFormat) {
        prevString = Module.currentFormatStrings[wcsInfo];
        Module.set(wcsInfo, formatString);
    } else if (formatString && Module.currentFormatStrings[wcsInfo] !== formatString) {
        Module.set(wcsInfo, formatString);
        Module.currentFormatStrings[wcsInfo] = formatString;
    }

    let xFormat, yFormat;
    if (x !== undefined) {
        xFormat = Module.format(wcsInfo, 1, x);
    }
    if (y !== undefined) {
        yFormat = Module.format(wcsInfo, 2, y);
    }
    if (tempFormat) {
        Module.set(wcsInfo, prevString);
    }
    return {x: xFormat, y: yFormat};
};

Module.getWCSValueFromFormattedString = function (wcsInfo: number, formatString: {x: string; y: string}) {
    const N = 1;
    Module.unformat(wcsInfo, 1, formatString.x, Module.xOut);
    Module.unformat(wcsInfo, 2, formatString.y, Module.yOut);
    const xOut = new Float64Array(Module.HEAPF64.buffer, Module.xOut, N);
    const yOut = new Float64Array(Module.HEAPF64.buffer, Module.yOut, N);
    return {x: xOut[0], y: yOut[0]};
};

Module.transformPointArrays = function (wcsInfo: number, xIn: Float64Array, yIn: Float64Array, forward: boolean = true) {
    // Return empty array if arguments are invalid
    if (!(xIn instanceof Float64Array) || !(yIn instanceof Float64Array) || xIn.length !== yIn.length) {
        return {x: new Float64Array(1), y: new Float64Array(1)};
    }

    // Allocate and assign WASM memory
    const N = xIn.length;
    const xInPtr = Module._malloc(N * 8);
    const yInPtr = Module._malloc(N * 8);
    const xOutPtr = Module._malloc(N * 8);
    const yOutPtr = Module._malloc(N * 8);
    Module.HEAPF64.set(xIn, xInPtr / 8);
    Module.HEAPF64.set(yIn, yInPtr / 8);

    // Perform the AST transform
    Module.transform(wcsInfo, N, xInPtr, yInPtr, forward, xOutPtr, yOutPtr);

    // Copy result out to an object
    const xOut = new Float64Array(Module.HEAPF64.buffer, xOutPtr, N);
    const yOut = new Float64Array(Module.HEAPF64.buffer, yOutPtr, N);
    const result = {x: xOut.slice(0), y: yOut.slice(0)};

    // Free WASM memory
    Module._free(xInPtr);
    Module._free(yInPtr);
    Module._free(xOutPtr);
    Module._free(yOutPtr);
    return result;
};

Module.transform3DPointArrays = function (wcsInfo: number, xIn: Float64Array, yIn: Float64Array, zIn: Float64Array, forward: boolean = true) {
    // Return empty array if arguments are invalid
    if (!(xIn instanceof Float64Array) || !(yIn instanceof Float64Array) || !(zIn instanceof Float64Array) || xIn.length !== yIn.length || yIn.length !== zIn.length) {
        return {x: new Float64Array(1), y: new Float64Array(1), z: new Float64Array(1)};
    }

    // Allocate and assign WASM memory
    const N = xIn.length;
    const inPtr = Module._malloc(N * 8 * 3);
    const xInPtr = inPtr;
    const yInPtr = xInPtr + 8 * N;
    const zInPtr = yInPtr + 8 * N;
    const outPtr = Module._malloc(N * 8 * 3);
    Module.HEAPF64.set(xIn, xInPtr / 8);
    Module.HEAPF64.set(yIn, yInPtr / 8);
    Module.HEAPF64.set(zIn, zInPtr / 8);

    // Perform the AST transform
    Module.transform3DArray(wcsInfo, N, inPtr, forward, outPtr);

    // Copy result out to an object
    const out = new Float64Array(Module.HEAPF64.buffer, outPtr, N * 3);
    const result = {x: out.slice(0, N), y: out.slice(N, 2 * N), z: out.slice(2 * N, 3 * N)};

    // Free WASM memory
    Module._free(inPtr);
    Module._free(outPtr);
    return result;
};

Module.getGeodesicPointArray = function (wcsInfo: number, npoint: number, start: {x: number, y: number}, finish: {x: number, y: number}) {
    // Return empty array if arguments are invalid
    const yIn = new Float64Array([start.y, finish.y]);
    const xIn = new Float64Array([start.x, finish.x]);

    if (!(xIn instanceof Float64Array) || !(yIn instanceof Float64Array) || xIn.length !== yIn.length) {
        return new Float64Array(1);
    }

    // Allocate and assign WASM memory
    const N = xIn.length;
    const xInPtr = Module._malloc(N * 8);
    const yInPtr = Module._malloc(N * 8);
    const outPtr = Module._malloc(npoint * 2 * 8);
    Module.HEAPF64.set(xIn, xInPtr / 8);
    Module.HEAPF64.set(yIn, yInPtr / 8);
    // Perform the AST transform
    Module.pointList(wcsInfo, npoint, xInPtr, yInPtr, outPtr);

    // Copy result out to an object
    const out = new Float64Array(Module.HEAPF64.buffer, outPtr, npoint * 2);
    const result = out.slice(0);
    
    // Free WASM memory
    Module._free(xInPtr);
    Module._free(yInPtr);
    Module._free(outPtr);
    return result;
};

Module.getAxisPointArray = function (wcsInfo: number, npoint: number, axis: number, x: number, y: number, dist: number) {

    // Allocate and assign WASM memory
    const N = npoint;
    const outPtr = Module._malloc(npoint * 2 * 8);

    // Perform the AST transform
    Module.axPointList(wcsInfo, N, axis, x, y, dist, outPtr);

    // Copy result out to an object
    const out = new Float64Array(Module.HEAPF64.buffer, outPtr, npoint * 2);
    const result = out.slice(0);
    
    // Free WASM memory
    Module._free(outPtr);
    return result;
};

Module.transformPoint = function (transformFrameSet: number, xIn: number, yIn: number, forward: boolean = true) {
    const N = 1;
    Module.HEAPF64.set(new Float64Array([xIn]), Module.xIn / 8);
    Module.HEAPF64.set(new Float64Array([yIn]), Module.yIn / 8);
    Module.transform(transformFrameSet, N, Module.xIn, Module.yIn, forward, Module.xOut, Module.yOut);
    const xOut = new Float64Array(Module.HEAPF64.buffer, Module.xOut, N);
    const yOut = new Float64Array(Module.HEAPF64.buffer, Module.yOut, N);
    return {x: xOut[0], y: yOut[0]};
};

Module.transform3DPoint = function (transformFrameSet: number, xIn: number, yIn: number, zIn: number, forward: boolean = true) {
    const N = 1;
    const outPtr = Module._malloc(24);
    Module.transform3D(transformFrameSet, xIn, yIn, zIn, forward, outPtr);
    const out = new Float64Array(Module.HEAPF64.buffer, outPtr, 3);
    const res = {x: out[0], y: out[1], z: out[2]};
    Module._free(outPtr);
    return res;
};

Module.transformSpectralPoint = function (spectralFrameFrom: number, specType: string, specUnit: string, specSys: string, zIn: number, forward: boolean = true) {
    // Return empty array if arguments are invalid
    const N = 1;
    Module.HEAPF64.set(new Float64Array([zIn]), Module.zIn / 8);
    Module.spectralTransform(spectralFrameFrom, specType, specUnit, specSys, N, Module.zIn, forward, Module.zOut);
    const zOut = new Float64Array(Module.HEAPF64.buffer, Module.zOut, N);
    return zOut[0];
};

Module.transformSpectralPointArray = function (spectralFrameFrom: number, specType: string, specUnit: string, specSys: string, zIn: Float64Array | Array<number>, forward: boolean = true) {
    // Allocate and assign WASM memory
    const N = zIn?.length;

    if (!N) {
        return new Float64Array([]);
    }

    const zInPtr = Module._malloc(N * 8);
    const zOutPtr = Module._malloc(N * 8);
    Module.HEAPF64.set(zIn, zInPtr / 8);

    // Perform the AST transform
    Module.spectralTransform(spectralFrameFrom, specType, specUnit, specSys, N, zInPtr, forward, zOutPtr);

    // Copy result out to an object
    const zOut = new Float64Array(Module.HEAPF64.buffer, zOutPtr, N);
    const result = zOut.slice(0);

    // Free WASM memory
    Module._free(zInPtr);
    Module._free(zOutPtr);
    return result;
};

Module.normalizeCoordinates = function (wcsInfo, xIn, yIn) {
    Module.HEAPF64.set(new Float64Array([xIn, yIn]), Module.xIn / 8);
    Module.norm(wcsInfo, Module.xIn);
    const xOut = new Float64Array(Module.HEAPF64.buffer, Module.xIn, 2);
    return {x: xOut[0], y: xOut[1]};
};

Module.getTransformGrid = function (transformFrameSet: number, xMin: number, xMax: number, nx: number, yMin: number, yMax: number, ny: number, forward: number) {
    const out = Module.fillTransformGrid(transformFrameSet, xMin, xMax, nx, yMin, yMax, ny, forward);
    if (out) {
        const outArray = new Float32Array(Module.HEAPF32.buffer, out, nx * ny * 2).slice();
        Module._free(out);
        return outArray;
    } else {
        return null;
    }
};

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
});

module.exports = Module;
