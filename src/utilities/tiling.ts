import {TileCoordinate} from "models/TileCoordinate";
import {Point2D} from "models/Point2D";
import {FrameView} from "models/FrameView";

export function TileSort(a: TileCoordinate, b: TileCoordinate) {
    if (a.layer !== b.layer) {
        return a.layer - b.layer;
    } else if (a.x !== b.x) {
        return a.x - b.x;
    } else {
        return a.y - b.y;
    }
}

// Comparison function which compares tile coordinates based on their encoded coordinate.
// This is equivalent to sorting first by layer, then by y coordinate, and finally by x
export function TileSortEncoded(a: TileCoordinate, b: TileCoordinate) {
    return TileCoordinate.EncodeCoordinate(a) - TileCoordinate.EncodeCoordinate(b);
}

// Converts from downsampling factor (MIP) to the tile layer using conventional tiling coordinates
export function MipToLayer(mip: number, imageSize: Point2D, tileSize: Point2D): number {
    const totalTilesX = Math.ceil(imageSize.x / tileSize.x);
    const totalTilesY = Math.ceil(imageSize.y / tileSize.y);
    const maxMip = Math.max(totalTilesX, totalTilesY);
    const totalLayers = Math.ceil(Math.log2(maxMip));
    return totalLayers - Math.ceil(Math.log2(mip));
}

// Converts from tile layer using conventional tiling coordinates to the appropriate downsampling factor (MIP)
export function LayerToMip(layer: number, imageSize: Point2D, tileSize: Point2D): number {
    const totalTilesX = Math.ceil(imageSize.x / tileSize.x);
    const totalTilesY = Math.ceil(imageSize.y / tileSize.y);
    const maxMip = Math.max(totalTilesX, totalTilesY);
    const totalLayers = Math.ceil(Math.log2(maxMip));
    return Math.pow(2.0, totalLayers - layer);
}

export function GetRequiredTiles(frameView: FrameView, imageSize: Point2D, tileSize: Point2D): TileCoordinate[] {
    // Validate FrameView object
    if (!frameView || !isFinite(frameView.xMin) || !isFinite(frameView.xMax) || !isFinite(frameView.yMin) || !isFinite(frameView.yMax) || !isFinite(frameView.mip)) {
        return [];
    }

    // Validate FrameView contents
    if (frameView.xMin >= frameView.xMax || frameView.yMin >= frameView.yMax || frameView.mip <= 0) {
        return [];
    }

    // Validate image and tile size objects
    if (!imageSize || !tileSize || !isFinite(imageSize.x) || !isFinite(imageSize.y) || !isFinite(tileSize.x) || !isFinite(tileSize.y)) {
        return [];
    }

    // Validate image and tile sizes
    if (tileSize.x <= 0 || tileSize.y <= 0 || imageSize.x <= 0 || imageSize.y <= 0) {
        return [];
    }

    // Check if view is out of image range
    if (frameView.xMax < 0 || frameView.xMin > imageSize.x || frameView.yMax < 0 || frameView.yMin > imageSize.y) {
        return [];
    }

    const layer = MipToLayer(frameView.mip, imageSize, tileSize);
    if (layer < 0) {
        return [new TileCoordinate(0, 0, 0)];
    }

    const boundedFrameView: FrameView = {
        xMin: Math.max(0, frameView.xMin),
        xMax: Math.min(frameView.xMax, imageSize.x),
        yMin: Math.max(0, frameView.yMin),
        yMax: Math.min(frameView.yMax, imageSize.y),
        mip: frameView.mip
    };

    const adjustedTileSize: Point2D = {
        x: frameView.mip * tileSize.x,
        y: frameView.mip * tileSize.y
    };

    const xStart = Math.floor(boundedFrameView.xMin / adjustedTileSize.x);
    const xEnd = Math.ceil(boundedFrameView.xMax / adjustedTileSize.x);
    const yStart = Math.floor(boundedFrameView.yMin / adjustedTileSize.y);
    const yEnd = Math.ceil(boundedFrameView.yMax / adjustedTileSize.y);

    const numTilesX = xEnd - xStart;
    const numTilesY = yEnd - yStart;
    const tileSet: TileCoordinate[] = new Array<TileCoordinate>(numTilesX * numTilesY);
    for (let x = xStart, i = 0; x < xEnd; x++) {
        for (let y = yStart; y < yEnd; y++, i++) {
            tileSet[i] = new TileCoordinate(x, y, layer);
        }
    }
    return tileSet;
}
