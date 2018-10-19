declare var Module: any;
declare var addOnPostRun: any;
declare var Promise: any;

addOnPostRun(function () {
    Module.numArrayCoordinates = 1;
    Module.xIn = Module._malloc(Module.numArrayCoordinates * 8);
    Module.yIn = Module._malloc(Module.numArrayCoordinates * 8);
    Module.xOut = Module._malloc(Module.numArrayCoordinates * 8);
    Module.yOut = Module._malloc(Module.numArrayCoordinates * 8);

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

Module.set = Module.cwrap("set", "number", ["number", "string"]);
Module.getString = Module.cwrap("getString", "string", ["number", "string"]);
Module.dump = Module.cwrap("dump", null, ["number"]);
Module.norm = Module.cwrap("norm", "number", ["number", "number"]);
Module.format = Module.cwrap("format", "string", ["number", "number", "number"]);
Module.transform = Module.cwrap("transform", "number", ["number", "number", "number", "number", "number", "number", "number"]);
Module.getLastErrorMessage = Module.cwrap("getLastErrorMessage", "string");
Module.clearLastErrorMessage = Module.cwrap("clearLastErrorMessage", null);

Module.currentFormatStrings = [];

Module.getFormattedCoordinates = function (wcsInfo: number, x: number, y: number, formatString: string) {
    if (formatString && Module.currentFormatStrings[wcsInfo] !== formatString) {
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
    return {x: xFormat, y: yFormat};
};

Module.pixToWCSVector = function (wcsInfo, xIn, yIn) {
    // Return empty array if arguments are invalid
    if (!(xIn instanceof Float64Array) || !(yIn instanceof Float64Array) || xIn.length !== yIn.length) {
        return {x: new Float64Array(1), y: new Float64Array(1)};
    }

    const N = xIn.length;
    // Return
    if (N > Module.numArrayCoordinates) {
        Module._free(Module.xIn);
        Module._free(Module.yIn);
        Module._free(Module.xOut);
        Module._free(Module.yOut);
        Module.numArrayCoordinates = N;
        Module.xIn = Module._malloc(Module.numArrayCoordinates * 8);
        Module.yIn = Module._malloc(Module.numArrayCoordinates * 8);
        Module.xOut = Module._malloc(Module.numArrayCoordinates * 8);
        Module.yOut = Module._malloc(Module.numArrayCoordinates * 8);
    }

    Module.HEAPF64.set(xIn, Module.xIn / 8);
    Module.HEAPF64.set(yIn, Module.yIn / 8);
    Module.transform(wcsInfo, N, Module.xIn, Module.yIn, 1, Module.xOut, Module.yOut);
    const xOut = new Float64Array(Module.HEAPF64.buffer, Module.xOut, N);
    const yOut = new Float64Array(Module.HEAPF64.buffer, Module.yOut, N);
    return {x: xOut.slice(0), y: yOut.slice(0)};
};

Module.pixToWCS = function (wcsInfo, xIn, yIn) {
    // Return empty array if arguments are invalid
    const N = 1;
    Module.HEAPF64.set(new Float64Array([xIn]), Module.xIn / 8);
    Module.HEAPF64.set(new Float64Array([yIn]), Module.yIn / 8);
    Module.transform(wcsInfo, N, Module.xIn, Module.yIn, 1, Module.xOut, Module.yOut);
    const xOut = new Float64Array(Module.HEAPF64.buffer, Module.xOut, N);
    const yOut = new Float64Array(Module.HEAPF64.buffer, Module.yOut, N);
    return {x: xOut[0], y: yOut[0]};
};

Module.normalizeCoordinates = function (wcsInfo, xIn, yIn) {
    Module.HEAPF64.set(new Float64Array([xIn, yIn]), Module.xIn / 8);
    Module.norm(wcsInfo, Module.xIn);
    const xOut = new Float64Array(Module.HEAPF64.buffer, Module.xIn, 2);
    return {x: xOut[0], y: xOut[1]};
};

Module.plot = Module.cwrap("plotGrid", "number", ["number", "number", "number", "number", "number", "number", "number", "number", "number", "number", "number", "string"]);

Module.initFrame = Module.cwrap("initFrame", "number", ["string"]);
Module.initDummyFrame = Module.cwrap("initDummyFrame", "number", []);

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
