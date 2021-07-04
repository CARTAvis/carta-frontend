import {getShaderFromString, initWebGL, loadImageTexture} from "utilities";

import allMaps from "../static/allmaps.png";
import vertexShaderLine from "!raw-loader!./GLSL/vertex_shader_contours.glsl";
import pixelShaderDashed from "!raw-loader!./GLSL/pixel_shader_contours.glsl";

interface ShaderUniforms {
    RangeScale: WebGLUniformLocation;
    RangeOffset: WebGLUniformLocation;
    RotationOrigin: WebGLUniformLocation;
    RotationAngle: WebGLUniformLocation;
    ScaleAdjustment: WebGLUniformLocation;
    DashLength: WebGLUniformLocation;
    LineColor: WebGLUniformLocation;
    LineThickness: WebGLUniformLocation;
    PixelRatio: WebGLUniformLocation;
    CmapEnabled: WebGLUniformLocation;
    CmapValue: WebGLUniformLocation;
    CmapTexture: WebGLUniformLocation;
    NumCmaps: WebGLUniformLocation;
    CmapIndex: WebGLUniformLocation;
    Bias: WebGLUniformLocation;
    Contrast: WebGLUniformLocation;
    ControlMapEnabled: WebGLUniformLocation;
    ControlMapSize: WebGLUniformLocation;
    ControlMapTexture: WebGLUniformLocation;
    ControlMapMin: WebGLUniformLocation;
    ControlMapMax: WebGLUniformLocation;
}

export class ContourWebGLService {
    private static staticInstance: ContourWebGLService;

    private cmapTexture: WebGLTexture;
    readonly gl: WebGLRenderingContext;
    shaderUniforms: ShaderUniforms;
    // Shader attribute handles
    vertexPositionAttribute: number;
    vertexNormalAttribute: number;

    static get Instance() {
        if (!ContourWebGLService.staticInstance) {
            ContourWebGLService.staticInstance = new ContourWebGLService();
        }
        return ContourWebGLService.staticInstance;
    }

    public setCanvasSize = (width: number, height: number) => {
        if (!this.gl) {
            return;
        }
        this.gl.canvas.width = width;
        this.gl.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    };

    private initShaders() {
        if (!this.gl) {
            return;
        }
        let vertexShader = getShaderFromString(this.gl, vertexShaderLine, WebGLRenderingContext.VERTEX_SHADER);
        let fragmentShader = getShaderFromString(this.gl, pixelShaderDashed, WebGLRenderingContext.FRAGMENT_SHADER);

        let shaderProgram = this.gl.createProgram();
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);

        if (!this.gl.getProgramParameter(shaderProgram, WebGLRenderingContext.LINK_STATUS)) {
            console.log("Could not initialise shaders");
        }

        this.gl.useProgram(shaderProgram);

        this.vertexPositionAttribute = this.gl.getAttribLocation(shaderProgram, "aVertexPosition");
        this.gl.enableVertexAttribArray(this.vertexPositionAttribute);
        this.vertexNormalAttribute = this.gl.getAttribLocation(shaderProgram, "aVertexNormal");
        this.gl.enableVertexAttribArray(this.vertexNormalAttribute);

        this.shaderUniforms = {
            RangeScale: this.gl.getUniformLocation(shaderProgram, "uRangeScale"),
            RangeOffset: this.gl.getUniformLocation(shaderProgram, "uRangeOffset"),
            ScaleAdjustment: this.gl.getUniformLocation(shaderProgram, "uScaleAdjustment"),
            RotationOrigin: this.gl.getUniformLocation(shaderProgram, "uRotationOrigin"),
            RotationAngle: this.gl.getUniformLocation(shaderProgram, "uRotationAngle"),
            DashLength: this.gl.getUniformLocation(shaderProgram, "uDashLength"),
            LineColor: this.gl.getUniformLocation(shaderProgram, "uLineColor"),
            LineThickness: this.gl.getUniformLocation(shaderProgram, "uLineThickness"),
            PixelRatio: this.gl.getUniformLocation(shaderProgram, "uPixelRatio"),
            CmapEnabled: this.gl.getUniformLocation(shaderProgram, "uCmapEnabled"),
            CmapValue: this.gl.getUniformLocation(shaderProgram, "uCmapValue"),
            CmapTexture: this.gl.getUniformLocation(shaderProgram, "uCmapTexture"),
            NumCmaps: this.gl.getUniformLocation(shaderProgram, "uNumCmaps"),
            CmapIndex: this.gl.getUniformLocation(shaderProgram, "uCmapIndex"),
            Contrast: this.gl.getUniformLocation(shaderProgram, "uContrast"),
            Bias: this.gl.getUniformLocation(shaderProgram, "uBias"),
            ControlMapEnabled: this.gl.getUniformLocation(shaderProgram, "uControlMapEnabled"),
            ControlMapSize: this.gl.getUniformLocation(shaderProgram, "uControlMapSize"),
            ControlMapMin: this.gl.getUniformLocation(shaderProgram, "uControlMapMin"),
            ControlMapMax: this.gl.getUniformLocation(shaderProgram, "uControlMapMax"),
            ControlMapTexture: this.gl.getUniformLocation(shaderProgram, "uControlMapTexture")
        };

        this.gl.uniform1i(this.shaderUniforms.NumCmaps, 79);
        this.gl.uniform1i(this.shaderUniforms.CmapTexture, 0);
    }

    private constructor() {
        this.gl = initWebGL();
        if (!this.gl) {
            return;
        }

        this.initShaders();
        loadImageTexture(this.gl, allMaps, WebGLRenderingContext.TEXTURE0).then(texture => {
            this.cmapTexture = texture;
        });
    }
}
