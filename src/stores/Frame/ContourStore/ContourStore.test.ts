import * as CARTACompute from "carta_computation";

import {ContourWebGLService} from "services";

import {ContourStore} from "./ContourStore";

jest.mock("services", () => ({ContourWebGLService: Object.defineProperty({}, "Instance", {configurable: true, get: () => ({gl: null})})}));
jest.mock("utilities", () => ({GL2: {ARRAY_BUFFER: 34962, STATIC_DRAW: 35044}}));

test("retains raw contour chunks while uploading reusable WASM views synchronously", () => {
    const heap = new Float32Array(16);
    const uploads: Float32Array[] = [];
    const gl = {createBuffer: jest.fn(() => ({})), bindBuffer: jest.fn(), bufferData: jest.fn((_target, data: Float32Array) => uploads.push(data.slice()))};
    const service = jest.spyOn(ContourWebGLService, "Instance", "get").mockReturnValue({gl} as never);
    const generate = jest.mocked(CARTACompute.GenerateVertexData).mockImplementation(() => {
        heap.fill(uploads.length + 1);
        return heap;
    });
    try {
        const store = new ContourStore();
        const vertices = new Float32Array([1, 2, 3, 4]);
        const offsets = new Int32Array([0]);
        store.addContourData(offsets, vertices, 0.5);
        vertices.fill(99);
        offsets.fill(99);
        store.addContourData(new Int32Array([0]), new Float32Array([5, 6, 7, 8]), 1);
        const chunks = store.exportChunks;
        expect(chunks[0].vertices).toEqual(new Float32Array([1, 2, 3, 4]));
        expect(chunks[0].indexOffsets).toEqual(new Int32Array([0]));
        expect(chunks[1].vertices).toEqual(new Float32Array([5, 6, 7, 8]));
        expect(generate).toHaveBeenCalledTimes(2);
        expect(gl.bufferData.mock.calls[0][1]).toBe(heap);
        expect(uploads[0][0]).toBe(1);
        expect(uploads[1][0]).toBe(2);
    } finally {
        service.mockRestore();
        generate.mockReset();
    }
});
