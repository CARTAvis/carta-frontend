import {createTextureFromArray, getShaderFromString, initWebGL2, loadImageTexture} from "utilities";
import allMaps from "../static/allmaps.png";
import vertexShaderLine from "!raw-loader!./GLSL/vertex_shader_catalog.glsl";
import pixelShaderDashed from "!raw-loader!./GLSL/pixel_shader_catalog.glsl";

interface ShaderUniforms {
    LineThickness: WebGLUniformLocation,
    FeatherWidth: WebGLUniformLocation,
    ShapeType: WebGLUniformLocation,
    FrameViewMin: WebGLUniformLocation,
    FrameViewMax: WebGLUniformLocation,
    PositionTexture: WebGLUniformLocation,
    PointColor: WebGLUniformLocation,
    CmapEnabled: WebGLUniformLocation,
    PointSize: WebGLUniformLocation,
    SmapEnabled: WebGLUniformLocation,
    AreaMode: WebGLUniformLocation,
    SelectedSizeOffset: WebGLUniformLocation,
    CmapTexture: WebGLUniformLocation,
    NumCmaps: WebGLUniformLocation,
    CmapIndex: WebGLUniformLocation
}

export class CatalogWebGLService {
    private static staticInstance: CatalogWebGLService;
    private cmapTexture: WebGLTexture;
    private dataTexture: WebGLTexture; 
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

    public updateDataTexture = (dataPoints: Float32Array) => {
        this.dataTexture = createTextureFromArray(this.gl, dataPoints, WebGL2RenderingContext.TEXTURE0, 4);
    }

    public getDataTexture = () => {
        return this.dataTexture;
    }

    private initShaders() {
        if (!this.gl) {
            return;
        }

        let vertexShader = getShaderFromString(this.gl, vertexShaderLine, WebGL2RenderingContext.VERTEX_SHADER);
        let fragmentShader = getShaderFromString(this.gl, pixelShaderDashed, WebGL2RenderingContext.FRAGMENT_SHADER);

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
            FrameViewMin: this.gl.getUniformLocation(shaderProgram, "uFrameViewMin"),
            FrameViewMax: this.gl.getUniformLocation(shaderProgram, "uFrameViewMax"),
            PositionTexture: this.gl.getUniformLocation(shaderProgram, "uPositionTexture"),
            PointColor: this.gl.getUniformLocation(shaderProgram, "uPointColor"),
            PointSize: this.gl.getUniformLocation(shaderProgram, "uPointSize"),
            SmapEnabled: this.gl.getUniformLocation(shaderProgram, "uSmapEnabled"),
            AreaMode: this.gl.getUniformLocation(shaderProgram, "uAreaMode"),
            SelectedSizeOffset: this.gl.getUniformLocation(shaderProgram, "uSelectedSizeOffset"),
            CmapEnabled: this.gl.getUniformLocation(shaderProgram, "uCmapEnabled"),
            CmapTexture: this.gl.getUniformLocation(shaderProgram, "uCmapTexture"),
            NumCmaps: this.gl.getUniformLocation(shaderProgram, "uNumCmaps"),
            CmapIndex: this.gl.getUniformLocation(shaderProgram, "uCmapIndex")
        };

        this.gl.uniform1i(this.shaderUniforms.NumCmaps, 79);
        this.gl.uniform1i(this.shaderUniforms.CmapTexture, 1);
    }

    private constructor() {
        this.gl = initWebGL2();
        if (!this.gl) {
            return;
        }

        this.initShaders();
        loadImageTexture(this.gl, allMaps, WebGL2RenderingContext.TEXTURE1).then(texture => {
            this.cmapTexture = texture;
        });
    }
}