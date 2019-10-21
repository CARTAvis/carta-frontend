export as namespace CARTACompute;
export const ZstdReady: boolean;
export const onReady: Promise<void>;
export const Decompress: (src: Uint8Array, destSize: number) => Uint8Array;
export const Decode: (src: Uint8Array, destSize: number, decimationFactor: number) => Float32Array;
export const GenerateVertexData: (sourceVertices: Float32Array, indexOffsets: Int32Array) => Float32Array;