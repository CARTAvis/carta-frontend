import {createTextureFromArray, getShaderFromString, initWebGL2, loadImageTexture} from "utilities";
import allMaps from "../static/allmaps.png";
import catalogVertexShader from "!raw-loader!./GLSL/vertex_shader_catalog.glsl";
import catalogPixelShader from "!raw-loader!./GLSL/pixel_shader_catalog.glsl";

export enum CatalogTextureType {
    Size,
    Color,
    Orientation,
    X,
    Y,
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
    // texture
    XTexture: WebGLUniformLocation;
    YTexture: WebGLUniformLocation;
    OrientationTexture: WebGLUniformLocation;
    ColorTexture: WebGLUniformLocation;
    SizeTexture: WebGLUniformLocation;
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
    private spatialMatchedDataTextures: Map<string, Map<number, {x: WebGLTexture; y: WebGLTexture}>>;
    private xTextures: Map<number, WebGLTexture>;
    private yTextures: Map<number, WebGLTexture>;
    private sizeTextures: Map<number, WebGLTexture>;
    private colorTextures: Map<number, WebGLTexture>;
    private orientationTextures: Map<number, WebGLTexture>;
    private selectedSourceTextures: Map<number, WebGLTexture>;
    private sizeMinorTextures: Map<number, WebGLTexture>;
    readonly gl: WebGL2RenderingContext;
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

    public updateDataTexture = (fileId: number, dataPoints: Float32Array | Uint8Array, textureType: CatalogTextureType) => {
        if (!this.gl) {
            return;
        }
        switch (textureType) {
            case CatalogTextureType.X:
                this.xTextures.set(fileId, createTextureFromArray(this.gl, dataPoints, WebGL2RenderingContext.TEXTURE1, 1));
                break;
            case CatalogTextureType.Y:
                this.yTextures.set(fileId, createTextureFromArray(this.gl, dataPoints, WebGL2RenderingContext.TEXTURE2, 1));
                break;
            case CatalogTextureType.Size:
                this.sizeTextures.set(fileId, createTextureFromArray(this.gl, dataPoints, WebGL2RenderingContext.TEXTURE3, 1));
                break;
            case CatalogTextureType.Color:
                this.colorTextures.set(fileId, createTextureFromArray(this.gl, dataPoints, WebGL2RenderingContext.TEXTURE4, 1));
                break;
            case CatalogTextureType.Orientation:
                this.orientationTextures.set(fileId, createTextureFromArray(this.gl, dataPoints, WebGL2RenderingContext.TEXTURE5, 1));
                break;
            case CatalogTextureType.SelectedSource:
                this.selectedSourceTextures.set(fileId, createTextureFromArray(this.gl, dataPoints, WebGL2RenderingContext.TEXTURE6, 1));
                break;
            case CatalogTextureType.SizeMinor:
                this.sizeMinorTextures.set(fileId, createTextureFromArray(this.gl, dataPoints, WebGL2RenderingContext.TEXTURE7, 1));
                break;
            default:
                break;
        }
    };

    public getDataTexture = (fileId: number, textureType: CatalogTextureType): WebGLTexture => {
        switch (textureType) {
            case CatalogTextureType.X:
                return this.xTextures.get(fileId);
            case CatalogTextureType.Y:
                return this.yTextures.get(fileId);
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

    public updateSpatialMatchedTexture = (imageMapId: string, catalogFileId: number, x: Float32Array, y: Float32Array) => {
        const textures = this.spatialMatchedDataTextures.get(imageMapId);
        const xTexture = createTextureFromArray(this.gl, x, WebGL2RenderingContext.TEXTURE8, 1);
        const yTexture = createTextureFromArray(this.gl, y, WebGL2RenderingContext.TEXTURE9, 1);
        if (textures) {
            this.spatialMatchedDataTextures.get(imageMapId).set(catalogFileId, {x: xTexture, y: yTexture});
        } else {
            const destinationTextures = new Map<number, {x: WebGLTexture; y: WebGLTexture}>();
            destinationTextures.set(catalogFileId, {x: xTexture, y: yTexture});
            this.spatialMatchedDataTextures.set(imageMapId, destinationTextures);
        }
    };

    public getSpatialMatchedTexture = (imageMapId: string, catalogFileId: number) => {
        return this.spatialMatchedDataTextures.get(imageMapId)?.get(catalogFileId);
    };

    public clearTexture = (fileId: number) => {
        this.xTextures.delete(fileId);
        this.yTextures.delete(fileId);
        this.selectedSourceTextures.delete(fileId);
        this.sizeTextures.delete(fileId);
        this.colorTextures.delete(fileId);
        this.orientationTextures.delete(fileId);
        this.sizeMinorTextures.delete(fileId);
        this.clearSpatialMatchedTexture(fileId);
    };

    private clearSpatialMatchedTexture = (catalogFileId: number) => {
        this.spatialMatchedDataTextures.forEach(catalogs => {
            catalogs.delete(catalogFileId);
        });
    };

    private initShaders() {
        if (!this.gl) {
            return;
        }

        let vertexShader = getShaderFromString(this.gl, catalogVertexShader, WebGL2RenderingContext.VERTEX_SHADER);
        let fragmentShader = getShaderFromString(this.gl, catalogPixelShader, WebGL2RenderingContext.FRAGMENT_SHADER);

        let shaderProgram = this.gl.createProgram();
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);

        if (!this.gl.getProgramParameter(shaderProgram, WebGL2RenderingContext.LINK_STATUS)) {
            console.log("Could not initialise shaders");
        }

        this.gl.useProgram(shaderProgram);

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
            // texture 0 1 2 3 4 5 6 7
            CmapTexture: this.gl.getUniformLocation(shaderProgram, "uCmapTexture"),
            XTexture: this.gl.getUniformLocation(shaderProgram, "uXTexture"),
            YTexture: this.gl.getUniformLocation(shaderProgram, "uYTexture"),
            OrientationTexture: this.gl.getUniformLocation(shaderProgram, "uOrientationTexture"),
            SizeTexture: this.gl.getUniformLocation(shaderProgram, "uSizeTexture"),
            ColorTexture: this.gl.getUniformLocation(shaderProgram, "uColorTexture"),
            SelectedSourceTexture: this.gl.getUniformLocation(shaderProgram, "uSelectedSourceTexture"),
            SizeMinorTexture: this.gl.getUniformLocation(shaderProgram, "uSizeMinorTexture")
        };

        this.gl.uniform1i(this.shaderUniforms.NumCmaps, 79);
        this.gl.uniform1i(this.shaderUniforms.CmapTexture, 0);
        this.xTextures = new Map<number, WebGLTexture>();
        this.yTextures = new Map<number, WebGLTexture>();
        this.selectedSourceTextures = new Map<number, WebGLTexture>();
        this.orientationTextures = new Map<number, WebGLTexture>();
        this.sizeTextures = new Map<number, WebGLTexture>();
        this.colorTextures = new Map<number, WebGLTexture>();
        this.sizeMinorTextures = new Map<number, WebGLTexture>();
        this.spatialMatchedDataTextures = new Map<string, Map<number, {x: WebGLTexture; y: WebGLTexture}>>();
    }

    private constructor() {
        this.gl = initWebGL2();
        if (!this.gl) {
            return;
        }

        this.initShaders();
        loadImageTexture(this.gl, allMaps, WebGL2RenderingContext.TEXTURE0).then(texture => {
            this.cmapTexture = texture;
        });
    }
}
