import {TileCoordinate} from "../models";

test("returns -1 for malformed tileCoordinates", () => {
    expect(TileCoordinate.EncodeCoordinate(null)).toBe(-1);
});

test("returns -1 for malformed coordinates", () => {
    expect(TileCoordinate.Encode(undefined, undefined, undefined)).toBe(-1);
});

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

test("returns correct encoding for layer 0", () => {
    expect(TileCoordinate.Encode(0, 0, 0)).toBe(1);
});

test("returns correct encoding for layer 1", () => {
    expect(TileCoordinate.Encode(0, 0, 1)).toBe(4);
    expect(TileCoordinate.Encode(1, 0, 1)).toBe(5);
    expect(TileCoordinate.Encode(0, 1, 1)).toBe(6);
    expect(TileCoordinate.Encode(1, 1, 1)).toBe(7);
});

test("returns correct encoding for layer 2", () => {
    expect(TileCoordinate.Encode(0, 0, 2)).toBe(16);
    expect(TileCoordinate.Encode(1, 0, 2)).toBe(17);
    expect(TileCoordinate.Encode(2, 0, 2)).toBe(18);
    expect(TileCoordinate.Encode(3, 0, 2)).toBe(19);
    expect(TileCoordinate.Encode(0, 1, 2)).toBe(20);
    expect(TileCoordinate.Encode(1, 1, 2)).toBe(21);
    expect(TileCoordinate.Encode(2, 1, 2)).toBe(22);
    expect(TileCoordinate.Encode(3, 1, 2)).toBe(23);
    expect(TileCoordinate.Encode(0, 2, 2)).toBe(24);
    expect(TileCoordinate.Encode(1, 2, 2)).toBe(25);
    expect(TileCoordinate.Encode(2, 2, 2)).toBe(26);
    expect(TileCoordinate.Encode(3, 2, 2)).toBe(27);
    expect(TileCoordinate.Encode(0, 3, 2)).toBe(28);
    expect(TileCoordinate.Encode(1, 3, 2)).toBe(29);
    expect(TileCoordinate.Encode(2, 3, 2)).toBe(30);
    expect(TileCoordinate.Encode(3, 3, 2)).toBe(31);
});

test("returns null for invalid encoding", () => {
    expect(TileCoordinate.Decode(-1)).toBe(null);
    expect(TileCoordinate.Decode(0)).toBe(null);
    expect(TileCoordinate.Decode(2)).toBe(null);
    expect(TileCoordinate.Decode(3)).toBe(null);
    expect(TileCoordinate.Decode(8)).toBe(null);
    expect(TileCoordinate.Decode(32)).toBe(null);
});

test("returns identical round trip coordinates", () => {
    for (let i = 0; i < 10000; i++) {
        const layer = Math.floor(Math.random() * 16);
        const layerWidth = 2 ** layer;
        const x = Math.floor(Math.random() * layerWidth);
        const y = Math.floor(Math.random() * layerWidth);

        const coordinate = new TileCoordinate(x, y, layer);
        const encodedVal = coordinate.encode();
        const roundTripCoordinate = TileCoordinate.Decode(encodedVal);

        expect(roundTripCoordinate).toEqual(coordinate);
    }
});

test("encodes 10000 coordinates in less than 20 ms", () => {
    const layer = 12;
    let encodedVal = 0;
    const tStart = performance.now();
    for (let i = 0; i < 100; i++) {
        for (let j = 0; j < 100; j++) {
            encodedVal += TileCoordinate.Encode(i, j, layer);
        }
    }
    const tEnd = performance.now();
    const dt = tEnd - tStart;
    expect(dt).toBeLessThan(20);
});

test("encodes 10000 coordinates in less than 20 ms", () => {
    const layer = 12;
    const layerWidth = 2 ** layer;
    let counter = 0;
    const tStart = performance.now();

    let encVal = layerWidth * layerWidth;
    for (let i = 0; i < 100; i++) {
        for (let j = 0; j < 100; j++) {
            counter += TileCoordinate.Decode(encVal).x;
            encVal++;
        }
        encVal += layerWidth;
    }
    const tEnd = performance.now();
    const dt = tEnd - tStart;
    expect(dt).toBeLessThan(20);
});