import * as AST from "ast_wrapper";
import {FrameStore} from "stores";
import {Point2D} from "./Point2D";
import {subtract2D} from "utilities";

export class ControlMap {
    readonly source: FrameStore;
    readonly destination: FrameStore;
    texture: WebGLTexture;
    readonly width: number;
    readonly height: number;
    readonly minPoint: Point2D;
    readonly maxPoint: Point2D;
    readonly grid: Float32Array;

    constructor(src: FrameStore, dst: FrameStore, astTransform: number, width: number, height: number) {
        this.source = src;
        this.destination = dst;
        this.width = width;
        this.height = height;

        const paddingX = Math.ceil(src.frameInfo.fileInfoExtended.width / width);
        const paddingY = Math.ceil(src.frameInfo.fileInfoExtended.height / height);
        this.minPoint = {x: -paddingX, y: -paddingY};
        this.maxPoint = {x: paddingX + src.frameInfo.fileInfoExtended.width, y: paddingY + src.frameInfo.fileInfoExtended.height};
        this.grid = AST.getTransformGrid(astTransform, this.minPoint.x, this.maxPoint.x, width, this.minPoint.y, this.maxPoint.y, height, 1);
    }

    getTransformedCoordinate(point: Point2D) {
        const range = subtract2D(this.maxPoint, this.minPoint);
        const shiftedPoint = subtract2D(point, this.minPoint);
        const index2D: Point2D = {
            x: this.width * shiftedPoint.x / range.x,
            y: this.height * shiftedPoint.y / range.y,
        };

        const indexFloor = {x: Math.floor(index2D.x), y: Math.floor(index2D.y)};
        const step = {x: index2D.x - indexFloor.x, y: index2D.y - indexFloor.y};

        // Get the four samples for bilinear interpolation
        const index00 = indexFloor.y * this.width + indexFloor.x;
        const index01 = (indexFloor.y + 1) * this.width + indexFloor.x;
        const index10 = indexFloor.y * this.width + indexFloor.x + 1;
        const index11 = (indexFloor.y + 1) * this.width + indexFloor.x + 1;
        const f00 = {x: this.grid[2 * index00], y: this.grid[2 * index00 + 1]};
        const f01 = {x: this.grid[2 * index01], y: this.grid[2 * index01 + 1]};
        const f10 = {x: this.grid[2 * index10], y: this.grid[2 * index10 + 1]};
        const f11 = {x: this.grid[2 * index11], y: this.grid[2 * index11 + 1]};

        return {
            x: f00.x * (1 - step.x) * (1 - step.y) + f10.x * step.x * (1 - step.y) + f01.x * (1 - step.x) * step.y + f11.x * step.x * step.y,
            y: f00.y * (1 - step.x) * (1 - step.y) + f10.y * step.x * (1 - step.y) + f01.y * (1 - step.x) * step.y + f11.y * step.x * step.y
        };
    }
}