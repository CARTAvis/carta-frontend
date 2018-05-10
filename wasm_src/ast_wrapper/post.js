addOnPostRun(function () {
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
Module.SYS_J200 = 5;

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

Module.plot = Module.cwrap('plotGrid', 'number', ["number", "number", "number", "number", "number", "number", "number", "number", "number", "number", "string"]);

Module.initFrame = Module.cwrap('initFrame', 'number', ['string']);

Module.onReady = new Promise(function (func) {
    if (Module['calledRun']) {
        func(Module);
    } else {
        const old = Module['onRuntimeInitialized'];
        Module['onRuntimeInitialized'] = function () {
            if (old) {
                old();
            }
            func(Module);
        };
    }
});

module.exports = Module;