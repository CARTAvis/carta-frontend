import * as AST from "ast_wrapper";
import {FrameStore, CatalogStore} from "stores";
import {Point2D} from "./Point2D";
import {GL2} from "utilities";

export class CatalogControlMap {
    readonly source: FrameStore;
    readonly destination: FrameStore;
    readonly width: number;
    readonly height: number;
    minPoint: Point2D;
    maxPoint: Point2D;
    private gl2: WebGL2RenderingContext;
    private texture: WebGLTexture;
    private grid: Float32Array;
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

        this.minPoint = {x: Number.MAX_VALUE, y: Number.MAX_VALUE};
        this.maxPoint = {x: -Number.MAX_VALUE, y: -Number.MAX_VALUE};
        this.boundaryUpdated = false;

        if (cleanUpTransform) {
            AST.deleteObject(astTransform);
        }
    }

    hasTextureForContext = (gl2: WebGL2RenderingContext) => {
        return gl2 === this.gl2 && this.texture && gl2.isTexture(this.texture);
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
        if (this.minPoint.x > minX || this.minPoint.y > minY || this.maxPoint.x < maxX || this.maxPoint.y < maxY) {
            this.minPoint = {x: minX - paddingX, y: minY - paddingY};
            this.maxPoint = {x: maxX + paddingX, y: maxY + paddingY};
            this.boundaryUpdated = true;

            const copySrc = AST.copy(this.source.wcsInfo);
            const copyDest = AST.copy(this.destination.wcsInfo);
            AST.invert(copySrc);
            AST.invert(copyDest);
            const astTransform = AST.convert(copySrc, copyDest, "");
            AST.deleteObject(copySrc);
            AST.deleteObject(copyDest);

            this.minPoint = {x: minX - paddingX, y: minY - paddingY};
            this.maxPoint = {x: maxX + paddingX, y: maxY + paddingY};
            this.grid = AST.getTransformGrid(astTransform, this.minPoint.x, this.maxPoint.x, this.width, this.minPoint.y, this.maxPoint.y, this.height, true);

            AST.deleteObject(astTransform);
        }
    };

    getTextureX = (gl2: WebGL2RenderingContext) => {
        if (gl2 !== this.gl2 || !this.texture || this.boundaryUpdated) {
            this.boundaryUpdated = false;
            // Context has changed, texture needs to be regenerated
            this.gl2 = gl2;
            this.texture = this.gl2.createTexture();
            this.gl2.activeTexture(GL2.TEXTURE1);
            this.gl2.bindTexture(GL2.TEXTURE_2D, this.texture);
            this.gl2.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MIN_FILTER, GL2.NEAREST);
            this.gl2.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MAG_FILTER, GL2.NEAREST);
            this.gl2.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_WRAP_S, GL2.CLAMP_TO_EDGE);
            this.gl2.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_WRAP_T, GL2.CLAMP_TO_EDGE);
            this.gl2.texImage2D(GL2.TEXTURE_2D, 0, GL2.RG32F, this.width, this.height, 0, GL2.RG, GL2.FLOAT, this.grid);
        }
        return this.texture;
    };

    static IsWidthValid(width: number) {
        return width >= 128 && width <= 1024;
    }
}
