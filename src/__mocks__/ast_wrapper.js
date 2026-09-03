// Mock for ast_wrapper WASM module

const MOCK_AST_WRAPPER = {
    onReady: Promise.resolve(),

    // Mock AST wrapper functions
    emptyFitsChan: jest.fn(() => 1),
    putFits: jest.fn(),
    getFrameFromFitsChan: jest.fn(() => 1),
    getSpectralFrame: jest.fn(() => 1),
    getSkyFrameSet: jest.fn(() => 1),
    getSpatialMapping: jest.fn(() => 1),
    initDummyFrame: jest.fn(() => 1),
    set: jest.fn(() => 1),
    clear: jest.fn(() => 1),
    getString: jest.fn(() => "mock"),
    dump: jest.fn(),
    norm: jest.fn(() => 1),
    axDistance: jest.fn(() => 1),
    geodesicDistance: jest.fn(() => 1),
    format: jest.fn(() => "mock"),
    unformat: jest.fn(() => 1),
    transform: jest.fn(() => 1),
    transform3D: jest.fn(() => 1),
    transform3DArray: jest.fn(() => 1),
    spectralTransform: jest.fn(() => 1),
    parseDateToMJD: jest.fn(() => 0),
    convertMJD: jest.fn(mjd => mjd),
    formatMJDToDate: jest.fn(() => "2000-01-01T00:00:00.000"),
    getLastErrorMessage: jest.fn(() => ""),
    clearLastErrorMessage: jest.fn(),
    copy: jest.fn(),
    deleteObject: jest.fn(),
    invert: jest.fn(() => 1),
    convert: jest.fn(() => 1),
    shiftMap2D: jest.fn(() => 1),
    scaleMap2D: jest.fn(() => 1),
    frame: jest.fn(() => 1),
    addFrame: jest.fn(),
    setI: jest.fn(),
    setD: jest.fn(),
    createTransformedFrameset: jest.fn(() => 1),
    createShiftmapFrameset: jest.fn(() => 1),
    createOffsetFrameset: jest.fn(() => 1),
    fillTransformGrid: jest.fn(() => 1),
    pointList: jest.fn(() => 1),
    axPointList: jest.fn(() => 1),
    makeSwappedFrameSet: jest.fn(() => 1),
    setColor: jest.fn(),

    // Mock coordinate functions
    getFormattedCoordinates: jest.fn(() => ({x: "0", y: "0"})),
    getWCSValueFromFormattedString: jest.fn(() => ({x: 0, y: 0})),
    transformPointArrays: jest.fn(() => ({x: new Float64Array([0]), y: new Float64Array([0])})),
    transform3DPointArrays: jest.fn(() => ({x: new Float64Array([0]), y: new Float64Array([0]), z: new Float64Array([0])})),
    getGeodesicPointArray: jest.fn(() => new Float64Array([0, 0])),
    getAxisPointArray: jest.fn(() => new Float64Array([0, 0])),
    transformPoint: jest.fn(() => ({x: 0, y: 0})),
    transform3DPoint: jest.fn(() => ({x: 0, y: 0, z: 0})),
    transformSpectralPoint: jest.fn(() => 0),
    transformSpectralPointArray: jest.fn(() => new Float64Array([0])),
    normalizeCoordinates: jest.fn(() => ({x: 0, y: 0})),
    getTransformGrid: jest.fn(() => new Float32Array([0])),

    // Mock memory management
    _malloc: jest.fn(() => 0),
    _free: jest.fn(),
    HEAPF64: {buffer: new ArrayBuffer(8), set: jest.fn()},
    HEAPF32: {buffer: new ArrayBuffer(4), set: jest.fn()},

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
