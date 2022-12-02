import {TileCoordinate} from "./TileCoordinate";

test("returns -1 for invalid coordinates", () => {
    expect(TileCoordinate.Encode(-1, 0, 3)).toBe(-1);
    expect(TileCoordinate.Encode(0, -1, 3)).toBe(-1);
    expect(TileCoordinate.Encode(0, 0, -1)).toBe(-1);
});

test("returns -1 for out of range coordinates", () => {
    expect(TileCoordinate.Encode(1, 0, 0)).toBe(-1);
    expect(TileCoordinate.Encode(0, 1, 0)).toBe(-1);
    expect(TileCoordinate.Encode(4, 0, 2)).toBe(-1);
    expect(TileCoordinate.Encode(0, 4, 2)).toBe(-1);
});

test("returns identical round trip coordinates", () => {
    for (let i = 0; i < 10000; i++) {
        const layer = Math.floor(Math.random() * 12);
        const layerWidth = 2 ** layer;
        const x = Math.floor(Math.random() * layerWidth);
        const y = Math.floor(Math.random() * layerWidth);
        const id = Math.floor(Math.random() * 2 ** 16);
        const coordinate = new TileCoordinate(x, y, layer);
        const encodedVal = coordinate.encode();
        const roundTripCoordinate = TileCoordinate.Decode(encodedVal);
        expect(roundTripCoordinate).toEqual(coordinate);
        const encodedValWithId = TileCoordinate.AddFileId(coordinate.encode(), id);
        const roundTripCoordinateWithId = TileCoordinate.Decode(encodedValWithId);
        const roundTripId = TileCoordinate.GetFileId(encodedValWithId);
        expect(roundTripCoordinateWithId).toEqual(coordinate);
        expect(roundTripId).toEqual(id);
    }
});

test("encodes 10000 coordinates in less than 5 ms", () => {
    const layer = 12;
    let encodedVal = 0;
    const tStart = performance.now();
    for (let i = 0; i < 1000; i++) {
        for (let j = 0; j < 1000; j++) {
            encodedVal += TileCoordinate.Encode(i, j, layer);
        }
    }
    const tEnd = performance.now();
    const dt = tEnd - tStart;
    expect(encodedVal).toBe(203373043500000);
    expect(dt).toBeLessThan(20);
});

test("decodes 1M coordinates in less than 20 ms", () => {
    const layer = 12;
    const layerWidth = 2 ** layer;
    let counter = 0;
    const tStart = performance.now();

    let encVal = TileCoordinate.Encode(0, 0, layer);
    for (let i = 0; i < 1000; i++) {
        for (let j = 0; j < 1000; j++) {
            counter += TileCoordinate.Decode(encVal).x;
            encVal++;
        }
        encVal += layerWidth;
    }
    const tEnd = performance.now();
    const dt = tEnd - tStart;
    expect(counter).toBe(2046486240);
    expect(dt).toBeLessThan(20);
});
