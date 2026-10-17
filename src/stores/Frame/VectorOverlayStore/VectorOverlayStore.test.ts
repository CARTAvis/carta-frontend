import {VectorOverlayWebGLService} from "services";

import {VectorOverlayStore} from "./VectorOverlayStore";

jest.mock("services", () => ({VectorOverlayWebGLService: Object.defineProperty({}, "Instance", {configurable: true, get: () => ({gl: null})})}));
jest.mock("utilities", () => ({equalIfBothFinite: jest.requireActual("utilities/math/math").equalIfBothFinite, createTextureFromArray: jest.fn()}));

test("retains only the valid vector vertices in sparse tile buffers", () => {
    const service = jest.spyOn(VectorOverlayWebGLService, "Instance", "get").mockReturnValue({gl: null} as never);
    try {
        const store = new VectorOverlayStore({} as never);
        const values = new Float32Array([1, NaN, NaN, 4]);
        const tile = {width: 2, height: 2, x: 0, y: 0, mip: 1, imageData: new Uint8Array(values.buffer)};
        store.addData([tile], [], 1);
        expect(store.tiles).toHaveLength(1);
        expect(store.tiles[0].numVertices).toBe(2);
        expect(store.tiles[0].vertexData).toEqual(new Float32Array([0, 0, 1, 0, 1, 1, 4, 0]));
        expect(store.tiles[0].vertexData.buffer.byteLength).toBe(2 * 4 * Float32Array.BYTES_PER_ELEMENT);
        expect(store.intensityMin).toBe(1);
        expect(store.intensityMax).toBe(4);
    } finally {
        service.mockRestore();
    }
});
