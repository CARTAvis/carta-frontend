// Mock for ast_wrapper WASM module

const {rs: RS} = require("@rstest/core");

const MOCK_AST_WRAPPER = {
    onReady: Promise.resolve(),

    // Mock AST wrapper functions
    emptyFitsChan: RS.fn(() => 1),
    putFits: RS.fn(),
    getFrameFromFitsChan: RS.fn(() => 1),
    getSpectralFrame: RS.fn(() => 1),
    getSkyFrameSet: RS.fn(() => 1),
    getSpatialMapping: RS.fn(() => 1),
    initDummyFrame: RS.fn(() => 1),
    set: RS.fn(() => 1),
    clear: RS.fn(() => 1),
    getString: RS.fn(() => "mock"),
    dump: RS.fn(),
    norm: RS.fn(() => 1),
    axDistance: RS.fn(() => 1),
    geodesicDistance: RS.fn(() => 1),
    format: RS.fn(() => "mock"),
    unformat: RS.fn(() => 1),
    transform: RS.fn(() => 1),
    transform3D: RS.fn(() => 1),
    transform3DArray: RS.fn(() => 1),
    spectralTransform: RS.fn(() => 1),
    parseDateToMJD: RS.fn(() => 0),
    convertMJD: RS.fn(mjd => mjd),
    formatMJDToDate: RS.fn(() => "2000-01-01T00:00:00.000"),
    getLastErrorMessage: RS.fn(() => ""),
    clearLastErrorMessage: RS.fn(),
    copy: RS.fn(),
    deleteObject: RS.fn(),
    invert: RS.fn(() => 1),
    convert: RS.fn(() => 1),
    shiftMap2D: RS.fn(() => 1),
    scaleMap2D: RS.fn(() => 1),
    createRestFrameMapping2D: RS.fn(() => 1),
    frame: RS.fn(() => 1),
    addFrame: RS.fn(),
    setI: RS.fn(),
    setD: RS.fn(),
    createTransformedFrameset: RS.fn(() => 1),
    createShiftmapFrameset: RS.fn(() => 1),
    createOffsetFrameset: RS.fn(() => 1),
    fillTransformGrid: RS.fn(() => 1),
    pointList: RS.fn(() => 1),
    axPointList: RS.fn(() => 1),
    makeSwappedFrameSet: RS.fn(() => 1),
    setColor: RS.fn(),

    // Mock coordinate functions
    getFormattedCoordinates: RS.fn(() => ({x: "0", y: "0"})),
    getWCSValueFromFormattedString: RS.fn(() => ({x: 0, y: 0})),
    transformPointArrays: RS.fn(() => ({x: new Float64Array([0]), y: new Float64Array([0])})),
    transform3DPointArrays: RS.fn(() => ({x: new Float64Array([0]), y: new Float64Array([0]), z: new Float64Array([0])})),
    getGeodesicPointArray: RS.fn(() => new Float64Array([0, 0])),
    getAxisPointArray: RS.fn(() => new Float64Array([0, 0])),
    transformPoint: RS.fn(() => ({x: 0, y: 0})),
    transform3DPoint: RS.fn(() => ({x: 0, y: 0, z: 0})),
    transformSpectralPoint: RS.fn(() => 0),
    transformSpectralPointArray: RS.fn((_spectralFrame, _spectralType, _spectralUnit, _spectralSystem, values) => new Float64Array(values ?? [])),
    normalizeCoordinates: RS.fn(() => ({x: 0, y: 0})),
    getTransformGrid: RS.fn(() => new Float32Array([0])),

    // Mock memory management
    _malloc: RS.fn(() => 0),
    _free: RS.fn(),
    HEAPF64: {buffer: new ArrayBuffer(8), set: RS.fn()},
    HEAPF32: {buffer: new ArrayBuffer(4), set: RS.fn()},

    // Mock constants
    LABEL_EXTERIOR: 0,
    LABEL_INTERIOR: 1,
    DEFAULT_TOLERANCE: 0.01,
    DEFAULT_COLOR: 2,
    DEFAULT_FONT: "20px Arial",
    SYS_ECLIPTIC: 0,
    SYS_FK4: 1,
    SYS_FK5: 2,
    SYS_GALACTIC: 3,
    SYS_ICRS: 4,
    SYS_J2000: 5,

    // Mock fonts array - this is what FontSelect component is looking for
    fonts: ["{size} sans-serif", "italic {size} sans-serif", "bold {size} sans-serif", "bold italic {size} sans-serif", "{size} times", "italic {size} times", "bold {size} times", "bold italic {size} times"]
};

// For ES modules compatibility (import * as AST)
module.exports = MOCK_AST_WRAPPER;
// Mark as ES module
module.exports.__esModule = true;
// Also export as default for different import styles
module.exports.default = MOCK_AST_WRAPPER;
