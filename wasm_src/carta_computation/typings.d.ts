export as namespace CARTACompute;
export const ZstdReady: boolean;
export const onReady: Promise<void>;
export const Decompress: (src: Uint8Array, destSize: number) => Uint8Array;