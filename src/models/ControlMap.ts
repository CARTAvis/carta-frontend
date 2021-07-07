import * as AST from "ast_wrapper";
import {FrameStore, CatalogStore} from "stores";
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
    private texture: WebGLTexture;
    private gl: WebGLRenderingContext;
    // catalog spatial matching for webgl2
    minPoint2: Point2D;
    maxPoint2: Point2D;
    private gl2: WebGL2RenderingContext;
    private texture2: WebGLTexture;
    private grid2: Float32Array;
    private boundaryUpdated: boolean;

    constructor(src: FrameStore, dst: FrameStore, astTransform: AST.FrameSet, width: number, height: number) {
        this.source = src;
        this.destination = dst;
        this.width = width;
        this.height = height;

        let cleanUpTransform: boolean = false;

        if (astTransform < 0) {
            const copySrc = AST.copy(src.wcsInfo);
            const copyDest = AST.copy(dst.wcsInfo);
            AST.invert(copySrc);
            AST.invert(copyDest);
            astTransform = AST.convert(copySrc, copyDest, "");
            AST.deleteObject(copySrc);
            AST.deleteObject(copyDest);
            cleanUpTransform = true;
        }

        const paddingX = Math.ceil(src.frameInfo.fileInfoExtended.width / width);
        const paddingY = Math.ceil(src.frameInfo.fileInfoExtended.height / height);
        this.minPoint = {x: -paddingX, y: -paddingY};
        this.maxPoint = {x: paddingX + src.frameInfo.fileInfoExtended.width, y: paddingY + src.frameInfo.fileInfoExtended.height};
        this.grid = AST.getTransformGrid(astTransform, this.minPoint.x, this.maxPoint.x, width, this.minPoint.y, this.maxPoint.y, height, true);

        this.minPoint2 = {x: Number.MAX_VALUE, y: Number.MAX_VALUE};
        this.maxPoint2 = {x: -Number.MAX_VALUE, y: -Number.MAX_VALUE};
        this.boundaryUpdated = false;

        if (cleanUpTransform) {
            AST.deleteObject(astTransform);
        }
    }

    getTextureX = (gl: WebGLRenderingContext) => {
        if (gl !== this.gl || !this.texture) {
            // Context has changed, texture needs to be regenerated
            this.gl = gl;
            this.texture = this.gl.createTexture();
            this.gl.activeTexture(GL.TEXTURE1);
            this.gl.bindTexture(GL.TEXTURE_2D, this.texture);
            this.gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
            this.gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
            this.gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
            this.gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
            this.gl.texImage2D(GL.TEXTURE_2D, 0, GL.LUMINANCE_ALPHA, this.width, this.height, 0, GL.LUMINANCE_ALPHA, GL.FLOAT, this.grid);
        }

        return this.texture;
    };

    hasTextureForContext = (gl: WebGLRenderingContext) => {
        return gl === this.gl && this.texture && gl.isTexture(this.texture);
    };

    updateCatalogBoundary = () => {
        const catalogStore = CatalogStore.Instance;
        const paddingX = Math.ceil(this.source.frameInfo.fileInfoExtended.width / this.width);
        const paddingY = Math.ceil(this.destination.frameInfo.fileInfoExtended.height / this.height);
        const srcMinMax = catalogStore.getFrameMinMaxPoints(this.source.frameInfo.fileId);
        const dstMinMax = catalogStore.getFrameMinMaxPoints(this.destination.frameInfo.fileId);
        const minX = srcMinMax.minX < dstMinMax.minX ? srcMinMax.minX : dstMinMax.minX;
        const minY = srcMinMax.minY < dstMinMax.minY ? srcMinMax.minY : dstMinMax.minY;
        const maxX = srcMinMax.maxX > dstMinMax.maxX ? srcMinMax.maxX : dstMinMax.maxX;
        const maxY = srcMinMax.maxY > dstMinMax.maxY ? srcMinMax.maxY : dstMinMax.maxY;
        if (this.minPoint2.x > minX || this.minPoint2.y > minY || this.maxPoint2.x < maxX || this.maxPoint2.y < maxY) {
            this.minPoint2 = {x: minX - paddingX, y: minY - paddingY};
            this.maxPoint2 = {x: maxX + paddingX, y: maxY + paddingY};
            this.boundaryUpdated = true;

            const copySrc = AST.copy(this.source.wcsInfo);
            const copyDest = AST.copy(this.destination.wcsInfo);
            AST.invert(copySrc);
            AST.invert(copyDest);
            const astTransform = AST.convert(copySrc, copyDest, "");
            AST.deleteObject(copySrc);
            AST.deleteObject(copyDest);

            this.minPoint2 = {x: minX - paddingX, y: minY - paddingY};
            this.maxPoint2 = {x: maxX + paddingX, y: maxY + paddingY};
            this.grid2 = AST.getTransformGrid(astTransform, this.minPoint2.x, this.maxPoint2.x, this.width, this.minPoint2.y, this.maxPoint2.y, this.height, true);
            
            AST.deleteObject(astTransform);
        }
    }

    getTextureX2 = (gl2: WebGL2RenderingContext) => {
        if (gl2 !== this.gl2 || !this.texture2 || this.boundaryUpdated) {
            this.boundaryUpdated = false;
            // Context has changed, texture needs to be regenerated
            const GL2 = WebGL2RenderingContext;
            this.gl2 = gl2;
            this.texture2 = this.gl2.createTexture();
            this.gl2.activeTexture(GL2.TEXTURE1);
            this.gl2.bindTexture(GL2.TEXTURE_2D, this.texture2);
            this.gl2.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MIN_FILTER, GL2.NEAREST);
            this.gl2.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MAG_FILTER, GL2.NEAREST);
            this.gl2.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_WRAP_S, GL2.CLAMP_TO_EDGE);
            this.gl2.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_WRAP_T, GL2.CLAMP_TO_EDGE);
            this.gl2.texImage2D(GL2.TEXTURE_2D, 0, GL2.RG32F, this.width, this.height, 0, GL2.RG, GL2.FLOAT, this.grid2);
        }
        return this.texture2;
    };

    getTransformedCoordinate(point: Point2D) {
        const range = subtract2D(this.maxPoint, this.minPoint);
        const shiftedPoint = subtract2D(point, this.minPoint);
        const index2D: Point2D = {
            x: (this.width * shiftedPoint.x) / range.x,
            y: (this.height * shiftedPoint.y) / range.y
        };

        const indexFloor = {x: Math.floor(index2D.x), y: Math.floor(index2D.y)};
        const step = {x: index2D.x - indexFloor.x, y: index2D.y - indexFloor.y};

        // Get the four samples for bilinear interpolation
        const index00 = indexFloor.y * this.width + indexFloor.x;
        const index01 = (indexFloor.y + 1) * this.width + indexFloor.x;
        const index10 = indexFloor.y * this.width + indexFloor.x + 1;
        const index11 = (indexFloor.y + 1) * this.width + indexFloor.x + 1;
        const f00 = {x: this.grid[index00 * 2], y: this.grid[index00 * 2 + 1]};
        const f01 = {x: this.grid[index01 * 2], y: this.grid[index01 * 2 + 1]};
        const f10 = {x: this.grid[index10 * 2], y: this.grid[index10 * 2 + 1]};
        const f11 = {x: this.grid[index11 * 2], y: this.grid[index11 * 2 + 1]};

        return {
            x: f00.x * (1 - step.x) * (1 - step.y) + f10.x * step.x * (1 - step.y) + f01.x * (1 - step.x) * step.y + f11.x * step.x * step.y,
            y: f00.y * (1 - step.x) * (1 - step.y) + f10.y * step.x * (1 - step.y) + f01.y * (1 - step.x) * step.y + f11.y * step.x * step.y
        };
    }

    static IsWidthValid(width: number) {
        return width >= 128 && width <= 1024;
    }
}
