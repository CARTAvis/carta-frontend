import * as AST from "ast_wrapper";
import {CatalogStore} from "stores";
import {FrameStore} from "stores/Frame";
import {Point2D} from "./Point2D";
import {GL2} from "utilities";

export class CatalogControlMap {
    readonly source: FrameStore;
    readonly destination: FrameStore;
    readonly width: number;
    readonly height: number;
    minPoint: Point2D;
    maxPoint: Point2D;
    private texture: WebGLTexture;
    private grid: Float32Array;
    private gl: WebGL2RenderingContext;
    private boundaryUpdated: boolean;

    constructor(src: FrameStore, dst: FrameStore, astTransform: AST.FrameSet, width: number, height: number) {
        this.source = src;
        this.destination = dst;
        this.width = width;
        this.height = height;
        this.minPoint = {x: Number.MAX_VALUE, y: Number.MAX_VALUE};
        this.maxPoint = {x: -Number.MAX_VALUE, y: -Number.MAX_VALUE};
        this.boundaryUpdated = false;
    }

    updateCatalogBoundary = () => {
        const catalogStore = CatalogStore.Instance;
        const srcMinMax = catalogStore.getFrameMinMaxPoints(this.source.frameInfo.fileId);
        const dstMinMax = catalogStore.getFrameMinMaxPoints(this.destination.frameInfo.fileId);
        const minX = srcMinMax.minX < dstMinMax.minX ? srcMinMax.minX : dstMinMax.minX;
        const minY = srcMinMax.minY < dstMinMax.minY ? srcMinMax.minY : dstMinMax.minY;
        const maxX = srcMinMax.maxX > dstMinMax.maxX ? srcMinMax.maxX : dstMinMax.maxX;
        const maxY = srcMinMax.maxY > dstMinMax.maxY ? srcMinMax.maxY : dstMinMax.maxY;
        if (this.minPoint.x > minX || this.minPoint.y > minY || this.maxPoint.x < maxX || this.maxPoint.y < maxY) {
            this.setMinMaxPoint(minX, minY, maxX, maxY);
            this.boundaryUpdated = true;
            this.setGrid();
        }
    };

    setMinMaxPoint = (minX, minY, maxX, maxY) => {
        const paddingX = Math.ceil(this.source.frameInfo.fileInfoExtended.width / this.width);
        const paddingY = Math.ceil(this.source.frameInfo.fileInfoExtended.height / this.height);
        this.minPoint = {x: minX - paddingX, y: minY - paddingY};
        this.maxPoint = {x: maxX + paddingX, y: maxY + paddingY};
    };

    setGrid = (astTransform?: AST.FrameSet) => {
        let cleanUpTransform: boolean = false;

        if (!astTransform || astTransform < 0) {
            const copySrc = AST.copy(this.source.wcsInfo);
            const copyDest = AST.copy(this.destination.wcsInfo);
            AST.invert(copySrc);
            AST.invert(copyDest);
            astTransform = AST.convert(copySrc, copyDest, "");
            AST.deleteObject(copySrc);
            AST.deleteObject(copyDest);
            cleanUpTransform = true;
        }

        this.grid = AST.getTransformGrid(astTransform, this.minPoint.x, this.maxPoint.x, this.width, this.minPoint.y, this.maxPoint.y, this.height, true);

        if (cleanUpTransform) {
            AST.deleteObject(astTransform);
        }
    };

    getTextureX = (gl: WebGL2RenderingContext) => {
        if (gl !== this.gl || !this.texture || this.boundaryUpdated) {
            this.boundaryUpdated = false;
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

    static IsWidthValid(width: number) {
        return width >= 128 && width <= 1024;
    }
}
