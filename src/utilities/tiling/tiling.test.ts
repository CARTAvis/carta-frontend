import {type FrameView} from "../../models/FrameView/FrameView";
import {type Point2D} from "../../models/Point2D/Point2D";
import {TileCoordinate} from "../../models/Tile/TileCoordinate";

import {GetRequiredTiles, LayerToMip, MipToLayer, TileSortEncoded} from "./tiling";

// Some default tile/image sizes
const TILE256: Point2D = {x: 256, y: 256};
const TILE512: Point2D = {x: 512, y: 512};
const TILE1024: Point2D = {x: 1024, y: 1024};
const TILE2048: Point2D = {x: 2048, y: 2048};
const TILE4096: Point2D = {x: 4096, y: 4096};
const WIDE_TILE: Point2D = {x: 1024, y: 512};

export const DEFAULT_FRAME_VIEW: FrameView = {xMin: 0, xMax: 512, yMin: 0, yMax: 512, mip: 1};

test("returns an empty array if FrameView is invalid", () => {
    expect(GetRequiredTiles(null as any, TILE256, TILE1024)).toEqual([]);
    expect(GetRequiredTiles(undefined as any, TILE256, TILE1024)).toEqual([]);
    expect(GetRequiredTiles("test_string" as any, TILE256, TILE1024)).toEqual([]);
    expect(GetRequiredTiles(1 as any, TILE256, TILE1024)).toEqual([]);
    expect(GetRequiredTiles({yMin: 0, xMax: 1024, yMax: 1024, mip: 1} as any, TILE256, TILE1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, xMax: 1024, yMax: 1024, mip: 1} as any, TILE256, TILE1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, yMin: 0, yMax: 1024, mip: 1} as any, TILE256, TILE1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, yMin: 0, xMax: 1024, mip: 1} as any, TILE256, TILE1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, yMin: 0, xMax: 1024, yMax: 1024} as any, TILE256, TILE1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, yMin: 0, xMax: 1024, yMax: 1024, mip: "bob"} as any, TILE256, TILE1024)).toEqual([]);
});

test("returns an empty array if FrameView bounds are inconsistent", () => {
    expect(GetRequiredTiles({xMin: 512, yMin: 0, xMax: 512, yMax: 1024, mip: 1}, TILE256, TILE1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 513, yMin: 0, xMax: 512, yMax: 1024, mip: 1}, TILE256, TILE1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, yMin: 513, xMax: 1024, yMax: 512, mip: 1}, TILE256, TILE1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, yMin: 512, xMax: 1024, yMax: 512, mip: 1}, TILE256, TILE1024)).toEqual([]);
});

test("returns an empty array if FrameView mip is out of bounds", () => {
    expect(GetRequiredTiles({xMin: 0, yMin: 0, xMax: 1024, yMax: 1024, mip: -1}, TILE256, TILE1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, yMin: 0, xMax: 1024, yMax: 1024, mip: 0}, TILE256, TILE1024)).toEqual([]);
});

test("returns an empty array if image size is invalid", () => {
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, null as any, TILE256)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, undefined as any, TILE256)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, 1 as any, TILE256)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, [1, 1] as any, TILE256)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, "bob" as any, TILE256)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, {w: 10, h: 10} as any, TILE256)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, {x: 10} as any, TILE256)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, {y: 10} as any, TILE256)).toEqual([]);
});

test("returns an empty array if image size is out of bounds", () => {
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, {x: TILE1024.x, y: -1}, TILE256)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, {x: TILE1024.x, y: 0}, TILE256)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, {x: -1, y: TILE1024.y}, TILE256)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, {x: 0, y: TILE1024.y}, TILE256)).toEqual([]);
});

test("returns an empty array if frame view is outside of the image", () => {
    expect(GetRequiredTiles({xMin: -100, xMax: -50, yMin: 0, yMax: 256, mip: 1}, WIDE_TILE, TILE256)).toEqual([]);
    expect(GetRequiredTiles({xMin: WIDE_TILE.x + 50, xMax: WIDE_TILE.x + 100, yMin: 0, yMax: 256, mip: 1}, WIDE_TILE, TILE256)).toEqual([]);
    expect(GetRequiredTiles({xMin: WIDE_TILE.x + 50, xMax: WIDE_TILE.x + 100, yMin: 0, yMax: 256, mip: 1}, WIDE_TILE, TILE256)).toEqual([]);
    expect(GetRequiredTiles({xMin: WIDE_TILE.x + 50, xMax: WIDE_TILE.x + 100, yMin: 0, yMax: 256, mip: 1}, WIDE_TILE, TILE256)).toEqual([]);
    expect(GetRequiredTiles({xMin: -100, xMax: -50, yMin: 0, yMax: 256, mip: 1}, WIDE_TILE, TILE256)).toEqual([]);
    expect(GetRequiredTiles({xMin: -100, xMax: -50, yMin: 0, yMax: 256, mip: 1}, WIDE_TILE, TILE256)).toEqual([]);
});

test("returns an empty array if tile size is invalid", () => {
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, TILE1024, null as any)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, TILE1024, undefined as any)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, TILE1024, 1 as any)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, TILE1024, [1, 1] as any)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, TILE1024, "bob" as any)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, TILE1024, {w: 10, h: 10} as any)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, TILE1024, {x: 10} as any)).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, TILE1024, {y: 10} as any)).toEqual([]);
});

test("returns an empty array if tile size is out of bounds", () => {
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, TILE1024, {x: TILE256.x, y: -1})).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, TILE1024, {x: TILE256.x, y: 0})).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, TILE1024, {x: -1, y: TILE256.y})).toEqual([]);
    expect(GetRequiredTiles(DEFAULT_FRAME_VIEW, TILE1024, {x: 0, y: TILE256.y})).toEqual([]);
});

test("returns a single tile if tile size is equal to image size", () => {
    const result = GetRequiredTiles(DEFAULT_FRAME_VIEW, TILE256, TILE256);
    expect(result).toEqual([{x: 0, y: 0, layer: 0}]);
});

test("returns a single tile if tile size is larger than image size", () => {
    const result = GetRequiredTiles(DEFAULT_FRAME_VIEW, TILE256, TILE1024);
    expect(result).toEqual([{x: 0, y: 0, layer: 0}]);
});

test("returns the correct list of tiles when viewing a 1024x1024 image at full resolution using 512x512 tiles", () => {
    // Full resolution 1024x1024 image using 512x512 tiles
    const result = GetRequiredTiles({xMin: 0, xMax: 1024, yMin: 0, yMax: 1024, mip: 1}, TILE1024, TILE512);
    // Full resolution: 2x2 tiles => layer = 1. Tile coordinates start at one
    const expected: TileCoordinate[] = [];
    [0, 1].forEach(x => {
        [0, 1].forEach(y => {
            expected.push(new TileCoordinate(x, y, 1));
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(4);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
    // TODO: introduce checks to ensure optimal tile ordering
});

test("returns the correct list of tiles when viewing a 1024x1024 image at full resolution using 256x256 tiles", () => {
    // Full resolution 1024x1024 image using 512x512 tiles
    const result = GetRequiredTiles({xMin: 0, xMax: 1024, yMin: 0, yMax: 1024, mip: 1}, TILE1024, TILE256);
    // Full resolution: 4x4 tiles => layer = 2. Tile coordinates start at one
    const expected: TileCoordinate[] = [];
    [0, 1, 2, 3].forEach(x => {
        [0, 1, 2, 3].forEach(y => {
            expected.push(new TileCoordinate(x, y, 2));
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(16);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a tall section of a 1024x1024 image at full resolution using 256x256 tiles", () => {
    const result = GetRequiredTiles({xMin: 100, xMax: 300, yMin: 100, yMax: 600, mip: 1}, TILE1024, TILE256);
    const expected: TileCoordinate[] = [];
    [0, 1].forEach(x => {
        [0, 1, 2].forEach(y => {
            expected.push(new TileCoordinate(x, y, 2));
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(6);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a wide section of a 1024x1024 image at full resolution using 256x256 tiles", () => {
    const result = GetRequiredTiles({xMin: -100, xMax: 1000, yMin: 800, yMax: 900, mip: 1}, TILE1024, TILE256);
    const expected: TileCoordinate[] = [];
    [0, 1, 2, 3].forEach(x => {
        [3].forEach(y => {
            expected.push(new TileCoordinate(x, y, 2));
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(4);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a tall section of a 1024x1024 image at half resolution using 256x256 tiles", () => {
    const result = GetRequiredTiles({xMin: 100, xMax: 300, yMin: 100, yMax: 600, mip: 2}, TILE1024, TILE256);
    const expected: TileCoordinate[] = [];
    [0].forEach(x => {
        [0, 1].forEach(y => {
            expected.push(new TileCoordinate(x, y, 1));
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a wide section of a 1024x1024 image at half resolution using 256x256 tiles", () => {
    const result = GetRequiredTiles({xMin: -100, xMax: 1000, yMin: 800, yMax: 900, mip: 2}, TILE1024, TILE256);
    const expected: TileCoordinate[] = [];
    [0, 1].forEach(x => {
        [1].forEach(y => {
            expected.push(new TileCoordinate(x, y, 1));
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a wide section partially above image", () => {
    const result = GetRequiredTiles({xMin: 100, xMax: 1000, yMin: 900, yMax: 1100, mip: 2}, TILE1024, TILE256);
    const expected: TileCoordinate[] = [];
    [0, 1].forEach(x => {
        [1].forEach(y => {
            expected.push(new TileCoordinate(x, y, 1));
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a wide section partially below image", () => {
    const result = GetRequiredTiles({xMin: 100, xMax: 1000, yMin: -100, yMax: 100, mip: 2}, TILE1024, TILE256);
    const expected: TileCoordinate[] = [];
    [0, 1].forEach(x => {
        [0].forEach(y => {
            expected.push(new TileCoordinate(x, y, 1));
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a tall section partially left of image", () => {
    const result = GetRequiredTiles({xMin: -100, xMax: 50, yMin: 100, yMax: 1000, mip: 2}, TILE1024, TILE256);
    const expected: TileCoordinate[] = [];
    [0].forEach(x => {
        [0, 1].forEach(y => {
            expected.push(new TileCoordinate(x, y, 1));
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a tall section partially right of image", () => {
    const result = GetRequiredTiles({xMin: 900, xMax: 1100, yMin: 100, yMax: 1000, mip: 2}, TILE1024, TILE256);
    const expected: TileCoordinate[] = [];
    [1].forEach(x => {
        [0, 1].forEach(y => {
            expected.push(new TileCoordinate(x, y, 1));
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("give correct result when generating tiles for a 16K image at full resolution using 256x256 tiles", () => {
    const result = GetRequiredTiles({xMin: 0, xMax: 16384, yMin: 0, yMax: 16384, mip: 1}, {x: 16384, y: 16384}, TILE256);

    const xRange = Array.from({length: 64}, (v, k) => k);
    const yRange = Array.from({length: 64}, (v, k) => k);

    const expected: TileCoordinate[] = [];
    xRange.forEach(x => {
        yRange.forEach(y => {
            expected.push(new TileCoordinate(x, y, 6));
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(64 * 64);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

describe("tiling performance", () => {
    jest.retryTimes(3);

    test("take less than 2 ms when generating tiles for a 16K image at full resolution using 256x256 tiles", () => {
        const frameView = {xMin: 0, xMax: 16384, yMin: 0, yMax: 16384, mip: 1};
        const imageSize = {x: 16384, y: 16384};

        GetRequiredTiles(frameView, imageSize, TILE256);

        const tStart = performance.now();
        const result = GetRequiredTiles(frameView, imageSize, TILE256);
        const tEnd = performance.now();

        const runTime = tEnd - tStart;

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(64 * 64);
        expect(runTime).toBeLessThan(2);
    });
});

test("round trip mip -> layer -> mip", () => {
    expect(MipToLayer(8, TILE2048, TILE256)).toBe(0);
    expect(MipToLayer(4, TILE2048, TILE256)).toBe(1);
    expect(MipToLayer(2, TILE2048, TILE256)).toBe(2);
    expect(MipToLayer(1, TILE2048, TILE256)).toBe(3);

    expect(LayerToMip(MipToLayer(8, TILE2048, TILE256), TILE2048, TILE256)).toBe(8);
    expect(LayerToMip(MipToLayer(4, TILE2048, TILE256), TILE2048, TILE256)).toBe(4);
    expect(LayerToMip(MipToLayer(2, TILE2048, TILE256), TILE2048, TILE256)).toBe(2);
    expect(LayerToMip(MipToLayer(1, TILE2048, TILE256), TILE2048, TILE256)).toBe(1);

    expect(MipToLayer(16, TILE4096, TILE256)).toBe(0);
    expect(MipToLayer(8, TILE4096, TILE256)).toBe(1);
    expect(MipToLayer(4, TILE4096, TILE256)).toBe(2);
    expect(MipToLayer(2, TILE4096, TILE256)).toBe(3);
    expect(MipToLayer(1, TILE4096, TILE256)).toBe(4);

    expect(LayerToMip(MipToLayer(16, TILE4096, TILE256), TILE4096, TILE256)).toBe(16);
    expect(LayerToMip(MipToLayer(8, TILE4096, TILE256), TILE4096, TILE256)).toBe(8);
    expect(LayerToMip(MipToLayer(4, TILE4096, TILE256), TILE4096, TILE256)).toBe(4);
    expect(LayerToMip(MipToLayer(2, TILE4096, TILE256), TILE4096, TILE256)).toBe(2);
    expect(LayerToMip(MipToLayer(1, TILE4096, TILE256), TILE4096, TILE256)).toBe(1);
});

test("round trip layer -> mip -> layer", () => {
    expect(LayerToMip(0, TILE2048, TILE256)).toBe(8);
    expect(LayerToMip(1, TILE2048, TILE256)).toBe(4);
    expect(LayerToMip(2, TILE2048, TILE256)).toBe(2);
    expect(LayerToMip(3, TILE2048, TILE256)).toBe(1);

    expect(MipToLayer(LayerToMip(0, TILE2048, TILE256), TILE2048, TILE256)).toBe(0);
    expect(MipToLayer(LayerToMip(1, TILE2048, TILE256), TILE2048, TILE256)).toBe(1);
    expect(MipToLayer(LayerToMip(2, TILE2048, TILE256), TILE2048, TILE256)).toBe(2);
    expect(MipToLayer(LayerToMip(3, TILE2048, TILE256), TILE2048, TILE256)).toBe(3);

    expect(LayerToMip(0, TILE4096, TILE256)).toBe(16);
    expect(LayerToMip(1, TILE4096, TILE256)).toBe(8);
    expect(LayerToMip(2, TILE4096, TILE256)).toBe(4);
    expect(LayerToMip(3, TILE4096, TILE256)).toBe(2);
    expect(LayerToMip(4, TILE4096, TILE256)).toBe(1);

    expect(MipToLayer(LayerToMip(0, TILE4096, TILE256), TILE4096, TILE256)).toBe(0);
    expect(MipToLayer(LayerToMip(1, TILE4096, TILE256), TILE4096, TILE256)).toBe(1);
    expect(MipToLayer(LayerToMip(2, TILE4096, TILE256), TILE4096, TILE256)).toBe(2);
    expect(MipToLayer(LayerToMip(3, TILE4096, TILE256), TILE4096, TILE256)).toBe(3);
    expect(MipToLayer(LayerToMip(4, TILE4096, TILE256), TILE4096, TILE256)).toBe(4);
});
