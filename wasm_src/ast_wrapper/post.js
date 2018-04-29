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

Module.font = "20px Arial";
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

Module.setPalette = function (colors) {
    Module.colors = colors;
};

Module.setFont = function (font) {
    Module.font = font;
    if (Module.gridContext) {
        Module.gridContext.font = font;
    }
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