import {TileCoordinate} from "./TileCoordinate";

test("returns -1 for invalid coordinates", () => {
    expect(TileCoordinate.encode(-1, 0, 3)).toBe(-1);
    expect(TileCoordinate.encode(0, -1, 3)).toBe(-1);
    expect(TileCoordinate.encode(0, 0, -1)).toBe(-1);
});

test("returns -1 for out of range coordinates", () => {
    expect(TileCoordinate.encode(1, 0, 0)).toBe(-1);
    expect(TileCoordinate.encode(0, 1, 0)).toBe(-1);
    expect(TileCoordinate.encode(4, 0, 2)).toBe(-1);
    expect(TileCoordinate.encode(0, 4, 2)).toBe(-1);
});

test("returns identical round trip coordinates", () => {
    for (let i = 0; i < 10000; i++) {
        const layer = Math.floor(Math.random() * 12);
        const layerWidth = 2 ** layer;
        const x = Math.floor(Math.random() * layerWidth);
        const y = Math.floor(Math.random() * layerWidth);
        const id = Math.floor(Math.random() * 2 ** 16);
        const channel = Math.floor(Math.random() * 2 ** 16);
        const coordinate = new TileCoordinate(x, y, layer);
        const encodedVal = coordinate.encode();
        const roundTripCoordinate = TileCoordinate.decode(encodedVal);
        expect(roundTripCoordinate).toEqual(coordinate);
        const encodedValWithId = TileCoordinate.addFileIdAndChannel(coordinate.encode(), id, channel);
        const roundTripCoordinateWithId = TileCoordinate.decode(TileCoordinate.removeFileIdAndChannel(encodedValWithId));
        const roundTripId = TileCoordinate.getFileId(encodedValWithId);
        const roundTripChannel = TileCoordinate.getChannel(encodedValWithId);
        expect(roundTripCoordinateWithId).toEqual(coordinate);
        expect(roundTripChannel).toEqual(channel);
        expect(roundTripId).toEqual(id);
    }
});

/** Timings under Jest's parallel workers are noisy in one direction only, so the fastest
 *  run of several is the stable estimate; the first runs are also JIT warm-up. */
function fastestRun(run: () => void, samples = 5): number {
    run(); // warm up
    let best = Infinity;
    for (let i = 0; i < samples; i++) {
        const tStart = performance.now();
        run();
        best = Math.min(best, performance.now() - tStart);
    }
    return best;
}

test("encodes 1M coordinates in less than 20 ms", () => {
    const layer = 12;
    let encodedVal = 0;
    const dt = fastestRun(() => {
        encodedVal = 0;
        for (let i = 0; i < 1000; i++) {
            for (let j = 0; j < 1000; j++) {
                encodedVal += TileCoordinate.encode(i, j, layer);
            }
        }
    });
    expect(encodedVal).toBe(203373043500000);
    expect(dt).toBeLessThan(20);
});

test("decodes 1M coordinates in less than 20 ms", () => {
    const layer = 12;
    const layerWidth = 2 ** layer;
    let counter = 0;
    const dt = fastestRun(() => {
        counter = 0;
        let encVal = TileCoordinate.encode(0, 0, layer);
        for (let i = 0; i < 1000; i++) {
            for (let j = 0; j < 1000; j++) {
                counter += TileCoordinate.decode(encVal).x;
                encVal++;
            }
            encVal += layerWidth;
        }
    });
    expect(counter).toBe(2046486240);
    expect(dt).toBeLessThan(20);
});
