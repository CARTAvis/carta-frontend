// Mock for carta_computation WASM module

const {rs: RS} = require("@rstest/core");

const MOCK_CARTA_COMPUTATION = {
    onReady: Promise.resolve(),
    ZstdReady: true,
    runtimeInit: true,

    // Mock computation functions
    Decompress: typeof RS !== "undefined" ? RS.fn(() => new Uint8Array([0])) : () => new Uint8Array([0]),
    Decode: typeof RS !== "undefined" ? RS.fn(() => new Float32Array([0])) : () => new Float32Array([0]),
    GenerateVertexData: typeof RS !== "undefined" ? RS.fn(() => new Float32Array([0])) : () => new Float32Array([0]),
    CalculateCatalogSize: typeof RS !== "undefined" ? RS.fn(() => new Float32Array([0])) : () => new Float32Array([0]),
    CalculateCatalogColor: typeof RS !== "undefined" ? RS.fn(() => new Float32Array([0])) : () => new Float32Array([0]),
    CalculateCatalogOrientation: typeof RS !== "undefined" ? RS.fn(() => new Float32Array([0])) : () => new Float32Array([0]),
    ConvertInt64Array: typeof RS !== "undefined" ? RS.fn(() => new Float64Array([0])) : () => new Float64Array([0]),

    // Mock WASM functions
    _malloc: typeof RS !== "undefined" ? RS.fn(() => 0) : () => 0,
    _free: typeof RS !== "undefined" ? RS.fn() : () => {},
    HEAPU8: {buffer: new ArrayBuffer(8), set: typeof RS !== "undefined" ? RS.fn() : () => {}},
    HEAPF32: {buffer: new ArrayBuffer(4), set: typeof RS !== "undefined" ? RS.fn() : () => {}},
    HEAPF64: {buffer: new ArrayBuffer(8), set: typeof RS !== "undefined" ? RS.fn() : () => {}},

    // Mock internal properties
    srcAllocated: 0,
    srcPtr: 0,
    destAllocated: 0,
    destPtr: 0
};

module.exports = MOCK_CARTA_COMPUTATION;
// Mark as ES module
module.exports.__esModule = true;
// Also export as default for different import styles
module.exports.default = MOCK_CARTA_COMPUTATION;
