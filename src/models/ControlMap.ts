import * as AST from "ast_wrapper";
import {FrameStore} from "stores/Frame";
import {Point2D} from "./Point2D";
import {GL2} from "utilities";

export class ControlMap {
    readonly source: FrameStore;
    readonly destination: FrameStore;
    readonly width: number;
    readonly height: number;
    readonly minPoint: Point2D;
    readonly maxPoint: Point2D;
    private readonly grid: Float32Array;
    private texture: WebGLTexture;
    private gl: WebGL2RenderingContext;

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

        if (cleanUpTransform) {
            AST.deleteObject(astTransform);
        }
    }

    getTextureX = (gl: WebGL2RenderingContext) => {
        if (gl !== this.gl || !this.texture) {
            // Context has changed, texture needs to be regenerated
            this.gl = gl;
            this.texture = this.gl.createTexture();
            this.gl.activeTexture(GL2.TEXTURE1);
            this.gl.bindTexture(GL2.TEXTURE_2D, this.texture);
            this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MIN_FILTER, GL2.NEAREST);
            this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MAG_FILTER, GL2.NEAREST);
            this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_WRAP_S, GL2.CLAMP_TO_EDGE);
            this.gl.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_WRAP_T, GL2.CLAMP_TO_EDGE);
            this.gl.texImage2D(GL2.TEXTURE_2D, 0, GL2.RG32F, this.width, this.height, 0, GL2.RG, GL2.FLOAT, this.grid);
        }

        return this.texture;
    };

    hasTextureForContext = (gl: WebGL2RenderingContext) => {
        return gl === this.gl && this.texture && gl.isTexture(this.texture);
    };

    static IsWidthValid(width: number) {
        return width >= 128 && width <= 1024;
    }
}
