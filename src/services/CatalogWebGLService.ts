import {createTextureFromArray, getShaderProgram, GL2, initWebGL2, loadImageTexture} from "utilities";

import allMaps from "../static/allmaps.png";

import {catalogShaders} from "./GLSL";

export enum CatalogTextureType {
    Position,
    Size,
    Color,
    Orientation,
    SelectedSource,
    SizeMinor
}

interface ShaderUniforms {
    LineThickness: WebGLUniformLocation | null;
    FeatherWidth: WebGLUniformLocation | null;
    ShapeType: WebGLUniformLocation | null;
    PointColor: WebGLUniformLocation | null;
    PointSize: WebGLUniformLocation | null;
    SelectedSourceColor: WebGLUniformLocation | null;
    ShowSelectedSource: WebGLUniformLocation | null;
    RotationAngle: WebGLUniformLocation | null;
    RangeOffset: WebGLUniformLocation | null;
    RangeScale: WebGLUniformLocation | null;
    ScaleAdjustment: WebGLUniformLocation | null;
    ZoomLevel: WebGLUniformLocation | null;
    PixelRatio: WebGLUniformLocation | null;
    // spatial matching
    ControlMapEnabled: WebGLUniformLocation | null;
    ControlMapSize: WebGLUniformLocation | null;
    ControlMapTexture: WebGLUniformLocation | null;
    ControlMapMin: WebGLUniformLocation | null;
    ControlMapMax: WebGLUniformLocation | null;
    // texture
    PositionTexture: WebGLUniformLocation | null;
    SizeTexture: WebGLUniformLocation | null;
    ColorTexture: WebGLUniformLocation | null;
    OrientationTexture: WebGLUniformLocation | null;
    SelectedSourceTexture: WebGLUniformLocation | null;
    SizeMinorTexture: WebGLUniformLocation | null;
    // size
    SizeMajorMapEnabled: WebGLUniformLocation | null;
    AreaMode: WebGLUniformLocation | null;
    SizeMinorMapEnabled: WebGLUniformLocation | null;
    AreaModeMinor: WebGLUniformLocation | null;
    // color map
    CmapEnabled: WebGLUniformLocation | null;
    CmapTexture: WebGLUniformLocation | null;
    NumCmaps: WebGLUniformLocation | null;
    CmapIndex: WebGLUniformLocation | null;
    //orientation
    OmapEnabled: WebGLUniformLocation | null;
}

export class CatalogWebGLService {
    private static staticInstance: CatalogWebGLService;
    private cmapTexture: WebGLTexture;
    private positionArrays: Map<number, Float32Array>;
    private positionTextures: Map<number, WebGLTexture>;
    private sizeTextures: Map<number, WebGLTexture>;
    private colorTextures: Map<number, WebGLTexture>;
    private orientationTextures: Map<number, WebGLTexture>;
    private selectedSourceTextures: Map<number, WebGLTexture>;
    private sizeMinorTextures: Map<number, WebGLTexture>;
    readonly gl: WebGL2RenderingContext | null;
    shaderUniforms: ShaderUniforms;

    static get Instance() {
        if (!CatalogWebGLService.staticInstance) {
            CatalogWebGLService.staticInstance = new CatalogWebGLService();
        }
        return CatalogWebGLService.staticInstance;
    }

    public setCanvasSize = (width: number, height: number) => {
        if (!this.gl) {
            return;
        }
        this.gl.canvas.width = width;
        this.gl.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    };

    public updatePositionArray = (fileId: number, dataPoints: Float32Array, offset: number) => {
        const positionArray = this.positionArrays.get(fileId);
        if (positionArray) {
            const newArray = new Float32Array(positionArray.buffer, 0, offset + dataPoints.length);
            newArray.set(dataPoints, offset);
            this.positionArrays.set(fileId, newArray);
        } else {
            this.positionArrays.set(fileId, dataPoints);
        }
    };

    public updatePositionTexture = (fileId: number): boolean => {
        const positionArray = this.positionArrays.get(fileId);
        if (positionArray?.length) {
            this.updateDataTexture(fileId, positionArray, CatalogTextureType.Position);
            return true;
        }
        return false;
    };

    public updateDataTexture = (fileId: number, dataPoints: Float32Array | Uint8Array, textureType: CatalogTextureType) => {
        if (!this.gl) {
            return;
        }
        // colorMap is texture0, controlMap is texture1
        let texture: WebGLTexture | null;
        switch (textureType) {
            case CatalogTextureType.Position:
                texture = createTextureFromArray(this.gl, dataPoints, GL2.TEXTURE2, 2);
                if (texture) {
                    this.positionTextures.set(fileId, texture);
                }
                break;
            case CatalogTextureType.Size:
                texture = createTextureFromArray(this.gl, dataPoints, GL2.TEXTURE3, 1);
                if (texture) {
                    this.sizeTextures.set(fileId, texture);
                }
                break;
            case CatalogTextureType.Color:
                texture = createTextureFromArray(this.gl, dataPoints, GL2.TEXTURE4, 1);
                if (texture) {
                    this.colorTextures.set(fileId, texture);
                }
                break;
            case CatalogTextureType.Orientation:
                texture = createTextureFromArray(this.gl, dataPoints, GL2.TEXTURE5, 1);
                if (texture) {
                    this.orientationTextures.set(fileId, texture);
                }
                break;
            case CatalogTextureType.SelectedSource:
                texture = createTextureFromArray(this.gl, dataPoints, GL2.TEXTURE6, 1);
                if (texture) {
                    this.selectedSourceTextures.set(fileId, texture);
                }
                break;
            case CatalogTextureType.SizeMinor:
                texture = createTextureFromArray(this.gl, dataPoints, GL2.TEXTURE7, 1);
                if (texture) {
                    this.sizeMinorTextures.set(fileId, texture);
                }
                break;
            default:
                break;
        }
    };

    public getDataTexture = (fileId: number, textureType: CatalogTextureType): WebGLTexture | undefined => {
        switch (textureType) {
            case CatalogTextureType.Position:
                return this.positionTextures.get(fileId);
            case CatalogTextureType.Size:
                return this.sizeTextures.get(fileId);
            case CatalogTextureType.Color:
                return this.colorTextures.get(fileId);
            case CatalogTextureType.Orientation:
                return this.orientationTextures.get(fileId);
            case CatalogTextureType.SelectedSource:
                return this.selectedSourceTextures.get(fileId);
            case CatalogTextureType.SizeMinor:
                return this.sizeMinorTextures.get(fileId);
            default:
                return undefined;
        }
    };

    public clearTexture = (fileId: number) => {
        this.positionTextures.delete(fileId);
        this.sizeTextures.delete(fileId);
        this.colorTextures.delete(fileId);
        this.orientationTextures.delete(fileId);
        this.selectedSourceTextures.delete(fileId);
        this.sizeMinorTextures.delete(fileId);
        this.positionArrays.delete(fileId);
    };

    private initShaders() {
        if (!this.gl) {
            return;
        }
        const shaderProgram = getShaderProgram(this.gl, catalogShaders.vertexShader, catalogShaders.fragmentShader);
        this.gl.useProgram(shaderProgram);

        if (shaderProgram) {
            this.shaderUniforms = {
                LineThickness: this.gl.getUniformLocation(shaderProgram, "uLineThickness"),
                FeatherWidth: this.gl.getUniformLocation(shaderProgram, "uFeatherWidth"),
                ShapeType: this.gl.getUniformLocation(shaderProgram, "uShapeType"),
                SelectedSourceColor: this.gl.getUniformLocation(shaderProgram, "uSelectedSourceColor"),
                ShowSelectedSource: this.gl.getUniformLocation(shaderProgram, "uShowSelectedSource"),
                PointColor: this.gl.getUniformLocation(shaderProgram, "uPointColor"),
                PointSize: this.gl.getUniformLocation(shaderProgram, "uPointSize"),
                CmapIndex: this.gl.getUniformLocation(shaderProgram, "uCmapIndex"),
                NumCmaps: this.gl.getUniformLocation(shaderProgram, "uNumCmaps"),
                AreaMode: this.gl.getUniformLocation(shaderProgram, "uAreaMode"),
                AreaModeMinor: this.gl.getUniformLocation(shaderProgram, "uAreaModeMinor"),
                SizeMajorMapEnabled: this.gl.getUniformLocation(shaderProgram, "uSizeMajorMapEnabled"),
                SizeMinorMapEnabled: this.gl.getUniformLocation(shaderProgram, "uSizeMinorMapEnabled"),
                OmapEnabled: this.gl.getUniformLocation(shaderProgram, "uOmapEnabled"),
                CmapEnabled: this.gl.getUniformLocation(shaderProgram, "uCmapEnabled"),
                RotationAngle: this.gl.getUniformLocation(shaderProgram, "uRotationAngle"),
                RangeOffset: this.gl.getUniformLocation(shaderProgram, "uRangeOffset"),
                RangeScale: this.gl.getUniformLocation(shaderProgram, "uRangeScale"),
                ScaleAdjustment: this.gl.getUniformLocation(shaderProgram, "uScaleAdjustment"),
                ZoomLevel: this.gl.getUniformLocation(shaderProgram, "uZoomLevel"),
                PixelRatio: this.gl.getUniformLocation(shaderProgram, "uPixelRatio"),
                // spatial matching
                ControlMapEnabled: this.gl.getUniformLocation(shaderProgram, "uControlMapEnabled"),
                ControlMapSize: this.gl.getUniformLocation(shaderProgram, "uControlMapSize"),
                ControlMapMin: this.gl.getUniformLocation(shaderProgram, "uControlMapMin"),
                ControlMapMax: this.gl.getUniformLocation(shaderProgram, "uControlMapMax"),
                // texture 1
                ControlMapTexture: this.gl.getUniformLocation(shaderProgram, "uControlMapTexture"),
                // texture 0 2 3 4 5 6 7
                CmapTexture: this.gl.getUniformLocation(shaderProgram, "uCmapTexture"),
                PositionTexture: this.gl.getUniformLocation(shaderProgram, "uPositionTexture"),
                SizeTexture: this.gl.getUniformLocation(shaderProgram, "uSizeTexture"),
                ColorTexture: this.gl.getUniformLocation(shaderProgram, "uColorTexture"),
                OrientationTexture: this.gl.getUniformLocation(shaderProgram, "uOrientationTexture"),
                SelectedSourceTexture: this.gl.getUniformLocation(shaderProgram, "uSelectedSourceTexture"),
                SizeMinorTexture: this.gl.getUniformLocation(shaderProgram, "uSizeMinorTexture")
            };
        }

        this.positionArrays = new Map<number, Float32Array>();
        this.gl.uniform1i(this.shaderUniforms.NumCmaps, 79);
        this.gl.uniform1i(this.shaderUniforms.CmapTexture, 0);
        this.positionTextures = new Map<number, WebGLTexture>();
        this.sizeTextures = new Map<number, WebGLTexture>();
        this.colorTextures = new Map<number, WebGLTexture>();
        this.orientationTextures = new Map<number, WebGLTexture>();
        this.selectedSourceTextures = new Map<number, WebGLTexture>();
        this.sizeMinorTextures = new Map<number, WebGLTexture>();
    }

    private constructor() {
        this.gl = initWebGL2();
        if (!this.gl) {
            return;
        }

        this.initShaders();
        loadImageTexture(this.gl, allMaps, GL2.TEXTURE0).then(texture => {
            this.cmapTexture = texture;
        });
    }
}
