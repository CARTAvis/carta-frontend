import * as AST from "ast_wrapper";
import {FrameStore} from "stores";
import {Point2D} from "./Point2D";
import {GL, subtract2D} from "utilities";

export class ControlMap {
    readonly source: FrameStore;
    readonly destination: FrameStore;
    readonly width: number;
    readonly height: number;
    readonly minPoint: Point2D;
    readonly maxPoint: Point2D;
    private readonly grid: Float32Array;
    private readonly gridX: Float32Array;
    private readonly gridY: Float32Array;
    private textureX: WebGLTexture;
    private textureY: WebGLTexture;
    private gl: WebGLRenderingContext;

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
        this.gridX = new Float32Array(this.grid.buffer, 0, this.width * this.height);
        this.gridY = new Float32Array(this.grid.buffer, this.width * this.height * 4, this.width * this.height);
    }

    getTextureX = (gl: WebGLRenderingContext) => {
        if (gl !== this.gl || !this.textureX) {
            // Context has changed, texture needs to be regenerated
            this.gl = gl;
            this.textureX = this.gl.createTexture();
            this.gl.activeTexture(GL.TEXTURE1);
            this.gl.bindTexture(GL.TEXTURE_2D, this.textureX);
            this.gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
            this.gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
            this.gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
            this.gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
            this.gl.texImage2D(GL.TEXTURE_2D, 0, GL.LUMINANCE, this.width, this.height, 0, GL.LUMINANCE, GL.FLOAT, this.gridX);
        }

        return this.textureX;
    };

    getTextureY = (gl: WebGLRenderingContext) => {
        if (gl !== this.gl || !this.textureY) {
            // Context has changed, texture needs to be regenerated
            this.gl = gl;
            this.textureY = this.gl.createTexture();
            this.gl.activeTexture(GL.TEXTURE2);
            this.gl.bindTexture(GL.TEXTURE_2D, this.textureY);
            this.gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
            this.gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
            this.gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
            this.gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
            this.gl.texImage2D(GL.TEXTURE_2D, 0, GL.LUMINANCE, this.width, this.height, 0, GL.LUMINANCE, GL.FLOAT, this.gridY);
        }
        return this.textureY;
    };

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
        const f00 = {x: this.gridX[index00], y: this.gridY[index00]};
        const f01 = {x: this.gridX[index01], y: this.gridY[index01]};
        const f10 = {x: this.gridX[index10], y: this.gridY[index10]};
        const f11 = {x: this.gridX[index11], y: this.gridY[index11]};

        return {
            x: f00.x * (1 - step.x) * (1 - step.y) + f10.x * step.x * (1 - step.y) + f01.x * (1 - step.x) * step.y + f11.x * step.x * step.y,
            y: f00.y * (1 - step.x) * (1 - step.y) + f10.y * step.x * (1 - step.y) + f01.y * (1 - step.x) * step.y + f11.y * step.x * step.y
        };
    }
}