import * as AST from "ast_wrapper";

import {Point2D} from "models";
import {FrameStore} from "stores/Frame";
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

    constructor(src: FrameStore, dst: FrameStore, astTransform: AST.Mapping, width: number, height: number, updateBoudary: boolean = true) {
        this.source = src;
        this.destination = dst;
        this.width = width;
        this.height = height;
        if (updateBoudary) {
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
        let cleanUpTransform: boolean = false;

        if (!astTransform || astTransform < 0) {
            astTransform = AST.getSpatialMapping(this.source.wcsInfo, this.destination.wcsInfo);
            cleanUpTransform = true;
        }

        this.grid = AST.getTransformGrid(astTransform, this.minPoint.x, this.maxPoint.x, this.width, this.minPoint.y, this.maxPoint.y, this.height, true);

        if (cleanUpTransform) {
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
}
