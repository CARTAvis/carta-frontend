import {FrameView, Point2D, TileCoordinate} from "models";
import {GetRequiredTiles, LayerToMip, MipToLayer, TileSortEncoded} from "utilities/tiling";

// Some default tile/image sizes
const Tile256: Point2D = {x: 256, y: 256};
const Tile512: Point2D = {x: 512, y: 512};
const Tile1024: Point2D = {x: 1024, y: 1024};
const Tile2048: Point2D = {x: 2048, y: 2048};
const Tile4096: Point2D = {x: 4096, y: 4096};
const WideTile: Point2D = {x: 1024, y: 512};
const TallTile: Point2D = {x: 512, y: 1024};

export const DefaultFrameView: FrameView = {xMin: 0, xMax: 512, yMin: 0, yMax: 512, mip: 1};

test("returns an empty array if FrameView is invalid", () => {
    expect(GetRequiredTiles(null, Tile256, Tile1024)).toEqual([]);
    expect(GetRequiredTiles(undefined, Tile256, Tile1024)).toEqual([]);
    expect(GetRequiredTiles("test_string", Tile256, Tile1024)).toEqual([]);
    expect(GetRequiredTiles(1, Tile256, Tile1024)).toEqual([]);
    expect(GetRequiredTiles({yMin: 0, xMax: 1024, yMax: 1024, mip: 1}, Tile256, Tile1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, xMax: 1024, yMax: 1024, mip: 1}, Tile256, Tile1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, yMin: 0, yMax: 1024, mip: 1}, Tile256, Tile1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, yMin: 0, xMax: 1024, mip: 1}, Tile256, Tile1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, yMin: 0, xMax: 1024, yMax: 1024}, Tile256, Tile1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, yMin: 0, xMax: 1024, yMax: 1024, mip: "bob"}, Tile256, Tile1024)).toEqual([]);
});

test("returns an empty array if FrameView bounds are inconsistent", () => {
    expect(GetRequiredTiles({xMin: 512, yMin: 0, xMax: 512, yMax: 1024, mip: 1}, Tile256, Tile1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 513, yMin: 0, xMax: 512, yMax: 1024, mip: 1}, Tile256, Tile1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, yMin: 513, xMax: 1024, yMax: 512, mip: 1}, Tile256, Tile1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, yMin: 512, xMax: 1024, yMax: 512, mip: 1}, Tile256, Tile1024)).toEqual([]);
});

test("returns an empty array if FrameView mip is out of bounds", () => {
    expect(GetRequiredTiles({xMin: 0, yMin: 0, xMax: 1024, yMax: 1024, mip: -1}, Tile256, Tile1024)).toEqual([]);
    expect(GetRequiredTiles({xMin: 0, yMin: 0, xMax: 1024, yMax: 1024, mip: 0}, Tile256, Tile1024)).toEqual([]);
});

test("returns an empty array if image size is invalid", () => {
    expect(GetRequiredTiles(DefaultFrameView, null, Tile256)).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, undefined, Tile256)).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, 1, Tile256)).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, [1, 1], Tile256)).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, "bob", Tile256)).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, {w: 10, h: 10}, Tile256)).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, {x: 10}, Tile256)).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, {y: 10}, Tile256)).toEqual([]);
});

test("returns an empty array if image size is out of bounds", () => {
    expect(GetRequiredTiles(DefaultFrameView, {x: Tile1024.x, y: -1}, Tile256)).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, {x: Tile1024.x, y: 0}, Tile256)).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, {x: -1, y: Tile1024.y}, Tile256)).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, {x: 0, y: Tile1024.y}, Tile256)).toEqual([]);
});

test("returns an empty array if frame view is outside of the image", () => {
    expect(GetRequiredTiles({xMin: -100, xMax: -50, yMin: 0, yMax: 256, mip: 1}, WideTile, Tile256)).toEqual([]);
    expect(GetRequiredTiles({xMin: WideTile.x + 50, xMax: WideTile.x + 100, yMin: 0, yMax: 256, mip: 1}, WideTile, Tile256)).toEqual([]);
    expect(GetRequiredTiles({xMin: WideTile.x + 50, xMax: WideTile.x + 100, yMin: 0, yMax: 256, mip: 1}, WideTile, Tile256)).toEqual([]);
    expect(GetRequiredTiles({xMin: WideTile.x + 50, xMax: WideTile.x + 100, yMin: 0, yMax: 256, mip: 1}, WideTile, Tile256)).toEqual([]);
    expect(GetRequiredTiles({xMin: -100, xMax: -50, yMin: 0, yMax: 256, mip: 1}, WideTile, Tile256)).toEqual([]);
    expect(GetRequiredTiles({xMin: -100, xMax: -50, yMin: 0, yMax: 256, mip: 1}, WideTile, Tile256)).toEqual([]);
});

test("returns an empty array if tile size is invalid", () => {
    expect(GetRequiredTiles(DefaultFrameView, Tile1024, null)).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, Tile1024, undefined)).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, Tile1024, 1)).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, Tile1024, [1, 1])).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, Tile1024, "bob")).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, Tile1024, {w: 10, h: 10})).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, Tile1024, {x: 10})).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, Tile1024, {y: 10})).toEqual([]);
});

test("returns an empty array if tile size is out of bounds", () => {
    expect(GetRequiredTiles(DefaultFrameView, Tile1024, {x: Tile256.x, y: -1})).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, Tile1024, {x: Tile256.x, y: 0})).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, Tile1024, {x: -1, y: Tile256.y})).toEqual([]);
    expect(GetRequiredTiles(DefaultFrameView, Tile1024, {x: 0, y: Tile256.y})).toEqual([]);
});

test("returns a single tile if tile size is equal to image size", () => {
    const result = GetRequiredTiles(DefaultFrameView, Tile256, Tile256);
    expect(result).toEqual([{x: 0, y: 0, layer: 0}]);
});

test("returns a single tile if tile size is larger than image size", () => {
    const result = GetRequiredTiles(DefaultFrameView, Tile256, Tile1024);
    expect(result).toEqual([{x: 0, y: 0, layer: 0}]);
});

test("returns the correct list of tiles when viewing a 1024x1024 image at full resolution using 512x512 tiles", () => {
    // Full resolution 1024x1024 image using 512x512 tiles
    const result = GetRequiredTiles({xMin: 0, xMax: 1024, yMin: 0, yMax: 1024, mip: 1}, Tile1024, Tile512);
    // Full resolution: 2x2 tiles => layer = 1. Tile coordinates start at one
    const expected: TileCoordinate[] = [];
    [0, 1].forEach(x => {
        [0, 1].forEach(y => {
            expected.push({x, y, layer: 1});
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(4);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
    // TODO: introduce checks to ensure optimal tile ordering
});

test("returns the correct list of tiles when viewing a 1024x1024 image at full resolution using 256x256 tiles", () => {
    // Full resolution 1024x1024 image using 512x512 tiles
    const result = GetRequiredTiles({xMin: 0, xMax: 1024, yMin: 0, yMax: 1024, mip: 1}, Tile1024, Tile256);
    // Full resolution: 4x4 tiles => layer = 2. Tile coordinates start at one
    const expected: TileCoordinate[] = [];
    [0, 1, 2, 3].forEach(x => {
        [0, 1, 2, 3].forEach(y => {
            expected.push({x, y, layer: 2});
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(16);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a tall section of a 1024x1024 image at full resolution using 256x256 tiles", () => {
    const result = GetRequiredTiles({xMin: 100, xMax: 300, yMin: 100, yMax: 600, mip: 1}, Tile1024, Tile256);
    const expected: TileCoordinate[] = [];
    [0, 1].forEach(x => {
        [0, 1, 2].forEach(y => {
            expected.push({x, y, layer: 2});
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(6);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a wide section of a 1024x1024 image at full resolution using 256x256 tiles", () => {
    const result = GetRequiredTiles({xMin: -100, xMax: 1000, yMin: 800, yMax: 900, mip: 1}, Tile1024, Tile256);
    const expected: TileCoordinate[] = [];
    [0, 1, 2, 3].forEach(x => {
        [3].forEach(y => {
            expected.push({x, y, layer: 2});
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(4);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a tall section of a 1024x1024 image at half resolution using 256x256 tiles", () => {
    const result = GetRequiredTiles({xMin: 100, xMax: 300, yMin: 100, yMax: 600, mip: 2}, Tile1024, Tile256);
    const expected: TileCoordinate[] = [];
    [0].forEach(x => {
        [0, 1].forEach(y => {
            expected.push({x, y, layer: 1});
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a wide section of a 1024x1024 image at half resolution using 256x256 tiles", () => {
    const result = GetRequiredTiles({xMin: -100, xMax: 1000, yMin: 800, yMax: 900, mip: 2}, Tile1024, Tile256);
    const expected: TileCoordinate[] = [];
    [0, 1].forEach(x => {
        [1].forEach(y => {
            expected.push({x, y, layer: 1});
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a wide section partially above image", () => {
    const result = GetRequiredTiles({xMin: 100, xMax: 1000, yMin: 900, yMax: 1100, mip: 2}, Tile1024, Tile256);
    const expected: TileCoordinate[] = [];
    [0, 1].forEach(x => {
        [1].forEach(y => {
            expected.push({x, y, layer: 1});
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a wide section partially below image", () => {
    const result = GetRequiredTiles({xMin: 100, xMax: 1000, yMin: -100, yMax: 100, mip: 2}, Tile1024, Tile256);
    const expected: TileCoordinate[] = [];
    [0, 1].forEach(x => {
        [0].forEach(y => {
            expected.push({x, y, layer: 1});
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a tall section partially left of image", () => {
    const result = GetRequiredTiles({xMin: -100, xMax: 50, yMin: 100, yMax: 1000, mip: 2}, Tile1024, Tile256);
    const expected: TileCoordinate[] = [];
    [0].forEach(x => {
        [0, 1].forEach(y => {
            expected.push({x, y, layer: 1});
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("returns the correct list of tiles when viewing a tall section partially right of image", () => {
    const result = GetRequiredTiles({xMin: 900, xMax: 1100, yMin: 100, yMax: 1000, mip: 2}, Tile1024, Tile256);
    const expected: TileCoordinate[] = [];
    [1].forEach(x => {
        [0, 1].forEach(y => {
            expected.push({x, y, layer: 1});
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("give correct result when generating tiles for a 16K image at full resolution using 256x256 tiles", () => {
    const result = GetRequiredTiles({xMin: 0, xMax: 16384, yMin: 0, yMax: 16384, mip: 1}, {x: 16384, y: 16384}, Tile256);

    let xRange = Array.from({length: 64}, (v, k) => k);
    let yRange = Array.from({length: 64}, (v, k) => k);

    const expected: TileCoordinate[] = [];
    xRange.forEach(x => {
        yRange.forEach(y => {
            expected.push({x, y, layer: 6});
        });
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(64 * 64);
    expect(result.sort(TileSortEncoded)).toEqual(expected.sort(TileSortEncoded));
});

test("take less than 2 ms when generating tiles for a 16K image at full resolution using 256x256 tiles", () => {
    const tStart = performance.now();
    const result = GetRequiredTiles({xMin: 0, xMax: 16384, yMin: 0, yMax: 16384, mip: 1}, {x: 16384, y: 16384}, Tile256);
    const tEnd = performance.now();

    const runTime = tEnd - tStart;

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(64 * 64);
    expect(runTime).toBeLessThan(2);
});

test("round trip mip -> layer -> mip", () => {
    expect(MipToLayer(8, Tile2048, Tile256)).toBe(0);
    expect(MipToLayer(4, Tile2048, Tile256)).toBe(1);
    expect(MipToLayer(2, Tile2048, Tile256)).toBe(2);
    expect(MipToLayer(1, Tile2048, Tile256)).toBe(3);

    expect(LayerToMip(MipToLayer(8, Tile2048, Tile256), Tile2048, Tile256)).toBe(8);
    expect(LayerToMip(MipToLayer(4, Tile2048, Tile256), Tile2048, Tile256)).toBe(4);
    expect(LayerToMip(MipToLayer(2, Tile2048, Tile256), Tile2048, Tile256)).toBe(2);
    expect(LayerToMip(MipToLayer(1, Tile2048, Tile256), Tile2048, Tile256)).toBe(1);

    expect(MipToLayer(16, Tile4096, Tile256)).toBe(0);
    expect(MipToLayer(8, Tile4096, Tile256)).toBe(1);
    expect(MipToLayer(4, Tile4096, Tile256)).toBe(2);
    expect(MipToLayer(2, Tile4096, Tile256)).toBe(3);
    expect(MipToLayer(1, Tile4096, Tile256)).toBe(4);

    expect(LayerToMip(MipToLayer(16, Tile4096, Tile256), Tile4096, Tile256)).toBe(16);
    expect(LayerToMip(MipToLayer(8, Tile4096, Tile256), Tile4096, Tile256)).toBe(8);
    expect(LayerToMip(MipToLayer(4, Tile4096, Tile256), Tile4096, Tile256)).toBe(4);
    expect(LayerToMip(MipToLayer(2, Tile4096, Tile256), Tile4096, Tile256)).toBe(2);
    expect(LayerToMip(MipToLayer(1, Tile4096, Tile256), Tile4096, Tile256)).toBe(1);
});

test("round trip layer -> mip -> layer", () => {
    expect(LayerToMip(0, Tile2048, Tile256)).toBe(8);
    expect(LayerToMip(1, Tile2048, Tile256)).toBe(4);
    expect(LayerToMip(2, Tile2048, Tile256)).toBe(2);
    expect(LayerToMip(3, Tile2048, Tile256)).toBe(1);

    expect(MipToLayer(LayerToMip(0, Tile2048, Tile256), Tile2048, Tile256)).toBe(0);
    expect(MipToLayer(LayerToMip(1, Tile2048, Tile256), Tile2048, Tile256)).toBe(1);
    expect(MipToLayer(LayerToMip(2, Tile2048, Tile256), Tile2048, Tile256)).toBe(2);
    expect(MipToLayer(LayerToMip(3, Tile2048, Tile256), Tile2048, Tile256)).toBe(3);

    expect(LayerToMip(0, Tile4096, Tile256)).toBe(16);
    expect(LayerToMip(1, Tile4096, Tile256)).toBe(8);
    expect(LayerToMip(2, Tile4096, Tile256)).toBe(4);
    expect(LayerToMip(3, Tile4096, Tile256)).toBe(2);
    expect(LayerToMip(4, Tile4096, Tile256)).toBe(1);

    expect(MipToLayer(LayerToMip(0, Tile4096, Tile256), Tile4096, Tile256)).toBe(0);
    expect(MipToLayer(LayerToMip(1, Tile4096, Tile256), Tile4096, Tile256)).toBe(1);
    expect(MipToLayer(LayerToMip(2, Tile4096, Tile256), Tile4096, Tile256)).toBe(2);
    expect(MipToLayer(LayerToMip(3, Tile4096, Tile256), Tile4096, Tile256)).toBe(3);
    expect(MipToLayer(LayerToMip(4, Tile4096, Tile256), Tile4096, Tile256)).toBe(4);
});
