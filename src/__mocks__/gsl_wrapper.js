// Mock for gsl_wrapper WASM module

const {rs: RS} = require("@rstest/core");

const MOCK_GSL_WRAPPER = {
    onReady: Promise.resolve(),

    // Mock GSL wrapper functions
    linearRegression: RS.fn(() => 0),
    filterBoxcar: RS.fn(() => 0),
    filterGaussian: RS.fn(() => 0),
    filterHanning: RS.fn(() => 0),
    filterDecimation: RS.fn(() => 0),
    filterBinning: RS.fn(() => 0),
    filterSavitzkyGolay: RS.fn(() => 0),
    fittingGaussian: RS.fn(() => "mock"),

    // Mock analysis functions
    getFittingParameters: RS.fn(() => ({
        intercept: 0,
        slope: 1,
        cov00: 0,
        cov01: 0,
        cov11: 0,
        rss: 0
    })),
    boxcarSmooth: RS.fn(() => new Float64Array([0])),
    gaussianSmooth: RS.fn(() => new Float64Array([0])),
    hanningSmooth: RS.fn(() => new Float64Array([0])),
    decimation: RS.fn(() => ({x: new Float64Array([0]), y: new Float64Array([0])})),
    binning: RS.fn(() => new Float64Array([0])),
    savitzkyGolaySmooth: RS.fn(() => new Float64Array([0])),
    fitting: RS.fn(() => ({
        yIntercept: 0,
        yInterceptError: 0,
        slope: 1,
        slopeError: 0,
        center: new Float64Array([0]),
        amp: new Float64Array([1]),
        fwhm: new Float64Array([1]),
        log: "mock",
        integral: new Float64Array([1]),
        residual: new Float64Array([0])
    })),

    // Mock memory management
    _malloc: RS.fn(() => 0),
    _free: RS.fn(),
    HEAPF64: {buffer: new ArrayBuffer(8), set: RS.fn()},
    HEAPF32: {buffer: new ArrayBuffer(4), set: RS.fn()},
    HEAP32: {set: RS.fn()},
    getValue: RS.fn(() => 0)
};

module.exports = MOCK_GSL_WRAPPER;
