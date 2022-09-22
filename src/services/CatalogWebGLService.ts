import {createTextureFromArray, getShaderProgram, initWebGL2, loadImageTexture, makeBuffer, GL2} from "utilities";
import {catalogShaders} from "./GLSL";
import allMaps from "../static/allmaps.png";

export enum CatalogTextureType {
    Position,
    Size,
    Color,
    Orientation,
    SelectedSource,
    SizeMinor
}

interface ShaderUniforms {
    LineThickness: WebGLUniformLocation;
    FeatherWidth: WebGLUniformLocation;
    ShapeType: WebGLUniformLocation;
    PointColor: WebGLUniformLocation;
    PointSize: WebGLUniformLocation;
    SelectedSourceColor: WebGLUniformLocation;
    ShowSelectedSource: WebGLUniformLocation;
    RotationAngle: WebGLUniformLocation;
    RangeOffset: WebGLUniformLocation;
    RangeScale: WebGLUniformLocation;
    ScaleAdjustment: WebGLUniformLocation;
    // spatial matching
    ControlMapEnabled: WebGLUniformLocation;
    ControlMapSize: WebGLUniformLocation;
    ControlMapTexture: WebGLUniformLocation;
    ControlMapMin: WebGLUniformLocation;
    ControlMapMax: WebGLUniformLocation;
    // texture
    PositionTexture: WebGLUniformLocation;
    SizeTexture: WebGLUniformLocation;
    ColorTexture: WebGLUniformLocation;
    OrientationTexture: WebGLUniformLocation;
    SelectedSourceTexture: WebGLUniformLocation;
    SizeMinorTexture: WebGLUniformLocation;
    // size
    SizeMajorMapEnabled: WebGLUniformLocation;
    AreaMode: WebGLUniformLocation;
    SizeMinorMapEnabled: WebGLUniformLocation;
    AreaModeMinor: WebGLUniformLocation;
    // color map
    CmapEnabled: WebGLUniformLocation;
    CmapTexture: WebGLUniformLocation;
    NumCmaps: WebGLUniformLocation;
    CmapIndex: WebGLUniformLocation;
    //orientation
    OmapEnabled: WebGLUniformLocation;
}

export class CatalogWebGLService {
    private static staticInstance: CatalogWebGLService;
    private cmapTexture: WebGLTexture;
    private vertexBuffers: Map<number, WebGLBuffer>;
    private positionArrays: Map<number, Float32Array>;
    private positionTextures: Map<number, WebGLTexture>;
    private sizeTextures: Map<number, WebGLTexture>;
    private colorTextures: Map<number, WebGLTexture>;
    private orientationTextures: Map<number, WebGLTexture>;
    private selectedSourceTextures: Map<number, WebGLTexture>;
    private sizeMinorTextures: Map<number, WebGLTexture>;
    readonly gl: WebGL2RenderingContext;
    shaderUniforms: ShaderUniforms;
    vertexPositionAttribute: GLint;

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

    public updateBuffer = (fileId: number, dataPoints: Float32Array, offset: number) => {
        const positionArray = this.positionArrays.get(fileId);
        if (positionArray) {
            const newArray = new Float32Array(offset + dataPoints.length);
            newArray.set(positionArray.slice(0, offset));
            newArray.set(dataPoints, offset);
            this.positionArrays.set(fileId, newArray);
        } else {
            this.positionArrays.set(fileId, dataPoints);
        }

        const buffer = this.vertexBuffers.get(fileId);
        if (buffer) {
            // Fill data, 10 times faster than bufferData since do not need to allocate memory
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
            this.gl.bufferSubData(this.gl.ARRAY_BUFFER, offset * 4, dataPoints);
        } else {
            // allocates a new buffer
            this.vertexBuffers.set(fileId, makeBuffer(this.gl, dataPoints, this.gl.STATIC_DRAW));
        }
    };

    public bindBuffer = (fileId: number): boolean => {
        const positionArray = this.positionArrays.get(fileId);
        this.updateDataTexture(fileId, positionArray, CatalogTextureType.Position);

        const buffer = this.vertexBuffers.get(fileId);
        if (!this.vertexBuffers || !buffer) {
            return false;
        } else {
            this.gl.bindBuffer(GL2.ARRAY_BUFFER, buffer);
            return true;
        }
    };

    public updateDataTexture = (fileId: number, dataPoints: Float32Array | Uint8Array, textureType: CatalogTextureType) => {
        if (!this.gl) {
            return;
        }
        // colorMap is texture0, controlMap is texture1
        switch (textureType) {
            case CatalogTextureType.Position:
                this.positionTextures.set(fileId, createTextureFromArray(this.gl, dataPoints, GL2.TEXTURE2, 2));
                break;
            case CatalogTextureType.Size:
                this.sizeTextures.set(fileId, createTextureFromArray(this.gl, dataPoints, GL2.TEXTURE3, 1));
                break;
            case CatalogTextureType.Color:
                this.colorTextures.set(fileId, createTextureFromArray(this.gl, dataPoints, GL2.TEXTURE4, 1));
                break;
            case CatalogTextureType.Orientation:
                this.orientationTextures.set(fileId, createTextureFromArray(this.gl, dataPoints, GL2.TEXTURE5, 1));
                break;
            case CatalogTextureType.SelectedSource:
                this.selectedSourceTextures.set(fileId, createTextureFromArray(this.gl, dataPoints, GL2.TEXTURE6, 1));
                break;
            case CatalogTextureType.SizeMinor:
                this.sizeMinorTextures.set(fileId, createTextureFromArray(this.gl, dataPoints, GL2.TEXTURE7, 1));
                break;
            default:
                break;
        }
    };

    public getDataTexture = (fileId: number, textureType: CatalogTextureType): WebGLTexture => {
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
        this.vertexBuffers.delete(fileId);
        this.positionArrays.delete(fileId);
    };

    private initShaders() {
        if (!this.gl) {
            return;
        }
        const shaderProgram = getShaderProgram(this.gl, catalogShaders.vertexShader, catalogShaders.fragmentShader);
        this.gl.useProgram(shaderProgram);

        this.vertexPositionAttribute = this.gl.getAttribLocation(shaderProgram, "a_position");
        this.gl.enableVertexAttribArray(this.vertexPositionAttribute);

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
            SizeMinorTexture: this.gl.getUniformLocation(shaderProgram, "uSizeMinorTexture"),
        };

        this.vertexBuffers = new Map<number, WebGLBuffer>();
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
