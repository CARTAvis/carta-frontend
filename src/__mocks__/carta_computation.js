// Mock for carta_computation WASM module

const mockCartaComputation = {
    onReady: Promise.resolve(),
    ZstdReady: true,
    runtimeInit: true,

    // Mock computation functions
    Decompress: typeof jest !== "undefined" ? jest.fn(() => new Uint8Array([0])) : () => new Uint8Array([0]),
    Decode: typeof jest !== "undefined" ? jest.fn(() => new Float32Array([0])) : () => new Float32Array([0]),
    GenerateVertexData: typeof jest !== "undefined" ? jest.fn(() => new Float32Array([0])) : () => new Float32Array([0]),
    CalculateCatalogSize: typeof jest !== "undefined" ? jest.fn(() => new Float32Array([0])) : () => new Float32Array([0]),
    CalculateCatalogColor: typeof jest !== "undefined" ? jest.fn(() => new Float32Array([0])) : () => new Float32Array([0]),
    CalculateCatalogOrientation: typeof jest !== "undefined" ? jest.fn(() => new Float32Array([0])) : () => new Float32Array([0]),
    ConvertInt64Array: typeof jest !== "undefined" ? jest.fn(() => new Float64Array([0])) : () => new Float64Array([0]),

    // Mock WASM functions
    _malloc: typeof jest !== "undefined" ? jest.fn(() => 0) : () => 0,
    _free: typeof jest !== "undefined" ? jest.fn() : () => {},
    HEAPU8: {buffer: new ArrayBuffer(8), set: typeof jest !== "undefined" ? jest.fn() : () => {}},
    HEAPF32: {buffer: new ArrayBuffer(4), set: typeof jest !== "undefined" ? jest.fn() : () => {}},
    HEAPF64: {buffer: new ArrayBuffer(8), set: typeof jest !== "undefined" ? jest.fn() : () => {}},

    // Mock internal properties
    srcAllocated: 0,
    srcPtr: 0,
    destAllocated: 0,
    destPtr: 0
};

module.exports = mockCartaComputation;
// Mark as ES module
module.exports.__esModule = true;
// Also export as default for different import styles
module.exports.default = mockCartaComputation;
