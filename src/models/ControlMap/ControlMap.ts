import * as AST from "ast_wrapper";

import {type Point2D} from "models";
import {type FrameStore} from "stores/Frame";
import {GL2} from "utilities";

export class ControlMap {
    readonly source: FrameStore;
    readonly destination: FrameStore;
    readonly width: number;
    readonly height: number;
    minPoint: Point2D;
    maxPoint: Point2D;
    texture: WebGLTexture | null;
    gl: WebGL2RenderingContext;
    private grid: Float32Array;

    constructor(src: FrameStore, dst: FrameStore, astTransform: AST.Mapping, width: number, height: number, shouldUpdateBoundary: boolean = true) {
        this.source = src;
        this.destination = dst;
        this.width = width;
        this.height = height;
        if (shouldUpdateBoundary) {
            this.setMinMaxPoint(0, 0, this.source.frameInfo.fileInfoExtended.width - 1, this.source.frameInfo.fileInfoExtended.height - 1);
            this.setGrid(astTransform);
        }
    }

    setMinMaxPoint = (minX, minY, maxX, maxY) => {
        const deltaX = (maxX - minX) / (this.width - 3);
        const deltaY = (maxY - minY) / (this.height - 3);
        this.minPoint = {x: minX - deltaX, y: minY - deltaY};
        this.maxPoint = {x: maxX + deltaX * 2, y: maxY + deltaY * 2};
    };

    setGrid = (astTransform?: AST.Mapping) => {
        let shouldCleanUpTransform: boolean = false;

        if (!astTransform || (astTransform as number) < 0) {
            astTransform = AST.getSpatialMapping(this.source.wcsInfo, this.destination.wcsInfo);
            shouldCleanUpTransform = true;
        }

        this.grid = AST.getTransformGrid(astTransform, this.minPoint.x, this.maxPoint.x, this.width, this.minPoint.y, this.maxPoint.y, this.height, true);

        if (shouldCleanUpTransform) {
            AST.deleteObject(astTransform);
        }
    };

    getTextureX = (gl: WebGL2RenderingContext) => {
        if (gl !== this.gl || !this.texture) {
            // Context has changed, texture needs to be regenerated
            this.createTexture(gl);
        }
        return this.texture;
    };

    createTexture = (gl: WebGL2RenderingContext) => {
        this.gl = gl;
        this.texture = this.gl.createTexture();
        this.gl.activeTexture(GL2.TEXTURE1);
        this.gl.bindTexture(GL2.TEXTURE_2D, this.texture);
        this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MIN_FILTER, GL2.NEAREST);
        this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MAG_FILTER, GL2.NEAREST);
        this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_WRAP_S, GL2.CLAMP_TO_EDGE);
        this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_WRAP_T, GL2.CLAMP_TO_EDGE);
        this.gl.texImage2D(GL2.TEXTURE_2D, 0, GL2.RG32F, this.width, this.height, 0, GL2.RG, GL2.FLOAT, this.grid);
    };

    hasTextureForContext = (gl: WebGL2RenderingContext) => {
        return gl === this.gl && this.texture && gl.isTexture(this.texture);
    };

    transformPoint = (point: Point2D): Point2D | null => {
        if (!this.grid?.length) {
            return null;
        }

        const widthRange = this.maxPoint.x - this.minPoint.x;
        const heightRange = this.maxPoint.y - this.minPoint.y;
        if (!isFinite(widthRange) || !isFinite(heightRange) || widthRange === 0 || heightRange === 0) {
            return null;
        }

        const normalizedX = ((point.x - this.minPoint.x) / widthRange) * (this.width - 1);
        const normalizedY = ((point.y - this.minPoint.y) / heightRange) * (this.height - 1);
        if (!isFinite(normalizedX) || !isFinite(normalizedY)) {
            return null;
        }

        const sampleX = Math.min(Math.max(normalizedX, 0), this.width - 1);
        const sampleY = Math.min(Math.max(normalizedY, 0), this.height - 1);
        const x0 = Math.floor(sampleX);
        const y0 = Math.floor(sampleY);
        const x1 = Math.min(x0 + 1, this.width - 1);
        const y1 = Math.min(y0 + 1, this.height - 1);
        const tx = sampleX - x0;
        const ty = sampleY - y0;

        const p00 = this.getGridPoint(x0, y0);
        const p10 = this.getGridPoint(x1, y0);
        const p01 = this.getGridPoint(x0, y1);
        const p11 = this.getGridPoint(x1, y1);
        if (!p00 || !p10 || !p01 || !p11) {
            return null;
        }

        const top = {
            x: p00.x + (p10.x - p00.x) * tx,
            y: p00.y + (p10.y - p00.y) * tx
        };
        const bottom = {
            x: p01.x + (p11.x - p01.x) * tx,
            y: p01.y + (p11.y - p01.y) * tx
        };

        return {
            x: top.x + (bottom.x - top.x) * ty,
            y: top.y + (bottom.y - top.y) * ty
        };
    };

    private getGridPoint = (xIndex: number, yIndex: number): Point2D | null => {
        const offset = (yIndex * this.width + xIndex) * 2;
        const x = this.grid[offset];
        const y = this.grid[offset + 1];
        if (!isFinite(x) || !isFinite(y)) {
            return null;
        }

        return {x, y};
    };
}
