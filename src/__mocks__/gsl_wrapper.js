// Mock for gsl_wrapper WASM module

const mockGslWrapper = {
    onReady: Promise.resolve(),

    // Mock GSL wrapper functions
    linearRegression: jest.fn(() => 0),
    filterBoxcar: jest.fn(() => 0),
    filterGaussian: jest.fn(() => 0),
    filterHanning: jest.fn(() => 0),
    filterDecimation: jest.fn(() => 0),
    filterBinning: jest.fn(() => 0),
    filterSavitzkyGolay: jest.fn(() => 0),
    fittingGaussian: jest.fn(() => "mock"),

    // Mock analysis functions
    getFittingParameters: jest.fn(() => ({
        intercept: 0,
        slope: 1,
        cov00: 0,
        cov01: 0,
        cov11: 0,
        rss: 0
    })),
    boxcarSmooth: jest.fn(() => new Float64Array([0])),
    gaussianSmooth: jest.fn(() => new Float64Array([0])),
    hanningSmooth: jest.fn(() => new Float64Array([0])),
    decimation: jest.fn(() => ({x: new Float64Array([0]), y: new Float64Array([0])})),
    binning: jest.fn(() => new Float64Array([0])),
    savitzkyGolaySmooth: jest.fn(() => new Float64Array([0])),
    fitting: jest.fn(() => ({
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
    _malloc: jest.fn(() => 0),
    _free: jest.fn(),
    HEAPF64: {buffer: new ArrayBuffer(8), set: jest.fn()},
    HEAPF32: {buffer: new ArrayBuffer(4), set: jest.fn()},
    HEAP32: {set: jest.fn()},
    getValue: jest.fn(() => 0)
};

module.exports = mockGslWrapper;
