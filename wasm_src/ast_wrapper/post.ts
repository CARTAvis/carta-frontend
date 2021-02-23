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
    "black",
    "white",
    "red",
    "green",
    "blue",
    "cyan",
    "magenta",
    "yellow",
    "grey"
];
Module.shapes = [
    "\u25A1", // Square
    "\u25E6",  // Little circle
    "\u002B",  // Cross
    "\u26B9",  // Sextile (star)
    "\u25CB",  // Larger circle
    "\u2A09",  // Cross
    "\u25A1", // Square (repeat)
    "\u25BD", // Triangle
    "\u2295", // Circled plus
    "\u25A1", // Square (repeat)
    "\u25C7", // Diamond
    "\u2606", // White star
];

Module.setPalette = function (colors) {
    Module.colors = colors;
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

Module.plot = Module.cwrap("plotGrid", "number", ["number", "number", "number", "number", "number", "number", "number", "number", "number", "number", "number", "string"]);
Module.initFrame = Module.cwrap("initFrame", "number", ["string"]);
Module.getSpectralFrame = Module.cwrap("getSpectralFrame", "number", ["number"]);
Module.getSkyFrameSet = Module.cwrap("getSkyFrameSet", "number", ["number"]);
Module.initDummyFrame = Module.cwrap("initDummyFrame", "number", []);
Module.set = Module.cwrap("set", "number", ["number", "string"]);
Module.clear = Module.cwrap("clear", "number", ["number", "string"]);
Module.getString = Module.cwrap("getString", "string", ["number", "string"]);
Module.dump = Module.cwrap("dump", null, ["number"]);
Module.norm = Module.cwrap("norm", "number", ["number", "number"]);
Module.axDistance = Module.cwrap("axDistance", "number", ["number", "number", "number", "number"]);
Module.format = Module.cwrap("format", "string", ["number", "number", "number"]);
Module.unformat = Module.cwrap("unformat", "number", ["number", "number", "string", "number"]);
Module.transform = Module.cwrap("transform", "number", ["number", "number", "number", "number", "number", "number", "number"]);
Module.transform3D = Module.cwrap("transform3D", "number", ["number", "number", "number", "number", "number", "number"]);
Module.spectralTransform = Module.cwrap("spectralTransform", "number", ["number", "string", "string", "string", "number", "number", "number", "number"]);
Module.getLastErrorMessage = Module.cwrap("getLastErrorMessage", "string");
Module.clearLastErrorMessage = Module.cwrap("clearLastErrorMessage", null);
Module.copy = Module.cwrap("copy", null, ["number"]);
Module.delete = Module.cwrap("deleteObject", null, ["number"]);
Module.invert = Module.cwrap("invert", "number", ["number"]);
Module.convert = Module.cwrap("convert", "number", ["number", "number", "string"]);
Module.shiftMap2D = Module.cwrap("shiftMap2D", "number", ["number", "number"]);
Module.createTransformedFrameset = Module.cwrap("createTransformedFrameset", "number", ["number", "number", "number", "number", "number", "number", "number", "number"]);
Module.fillTransformGrid = Module.cwrap("fillTransformGrid", "number", ["number", "number", "number", "number", "number", "number", "number", "number"]);

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

Module.getWCSValueFromFormattedString = function (wcsInfo: number, formatString: {x: string, y: string}) {
    const N = 1;
    Module.unformat(wcsInfo, 1, formatString.x, Module.xOut);
    Module.unformat(wcsInfo, 2, formatString.y, Module.yOut);
    const xOut = new Float64Array(Module.HEAPF64.buffer, Module.xOut, N);
    const yOut = new Float64Array(Module.HEAPF64.buffer, Module.yOut, N);
    return {x: xOut[0], y: yOut[0]};
}

Module.transformPointArrays = function (wcsInfo: number, xIn: Float64Array, yIn: Float64Array, forward: number) {
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
