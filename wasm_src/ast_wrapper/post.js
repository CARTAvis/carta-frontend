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

Module.setFont = function(font) {
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

Module.plot = function (settings) {
    var defaultColor = (settings.color === undefined) ? Module.DEFAULT_COLOR : settings.color;
    var defaultPadding = (settings.padding === undefined) ? 100 : settings.padding;
    Module._plotCustomGrid(
        (settings.imageX1 === undefined) ? 0 : settings.imageX1,
        (settings.imageX2 === undefined) ? 500 : settings.imageX2,
        (settings.imageY1 === undefined) ? 0 : settings.imageY1,
        (settings.imageY2 === undefined) ? 500 : settings.imageY2,
        (settings.width === undefined) ? 500 : settings.width,
        (settings.height === undefined) ? 500 : settings.height,
        (settings.paddingLeft === undefined) ? defaultPadding : settings.paddingLeft,
        (settings.paddingRight === undefined) ? defaultPadding : settings.paddingRight,
        (settings.paddingTop === undefined) ? defaultPadding : settings.paddingTop,
        (settings.paddingBottom === undefined) ? defaultPadding : settings.paddingBottom,
        (settings.gridColor === undefined) ? defaultColor : settings.gridColor,
        (settings.tickColor === undefined) ? defaultColor : settings.tickColor,
        (settings.axesColor === undefined) ? defaultColor : settings.axesColor,
        (settings.borderColor === undefined) ? defaultColor : settings.borderColor,
        (settings.titleColor === undefined) ? defaultColor : settings.titleColor,
        (settings.numLabColor === undefined) ? defaultColor : settings.numLabColor,
        (settings.textLabColor === undefined) ? defaultColor : settings.textLabColor,
        (settings.labelType === undefined) ? Module.LABEL_EXTERIOR : settings.labelType,
        (settings.tol === undefined) ? Module.DEFAULT_TOLERANCE : settings.tol,
        (settings.gapAxis1 === undefined) ? -1 : settings.gapAxis1,
        (settings.gapAxis2 === undefined) ? -1 : settings.gapAxis2,
        (settings.sys === undefined) ? -1 : settings.sys);
};

//Module.plot = Module.cwrap('plotCustomGrid', 'number', Array(19).fill("number"));
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