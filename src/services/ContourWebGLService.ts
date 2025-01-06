import {getShaderProgram, GL2, initWebGL2, loadImageTexture} from "utilities";

import allMaps from "../static/allmaps.png";

import {contourShaders} from "./GLSL";

interface ShaderUniforms {
    RangeScale: WebGLUniformLocation | null;
    RangeOffset: WebGLUniformLocation | null;
    RotationAngle: WebGLUniformLocation | null;
    ScaleAdjustment: WebGLUniformLocation | null;
    DashLength: WebGLUniformLocation | null;
    LineColor: WebGLUniformLocation | null;
    LineThickness: WebGLUniformLocation | null;
    PixelRatio: WebGLUniformLocation | null;
    CmapEnabled: WebGLUniformLocation | null;
    CmapValue: WebGLUniformLocation | null;
    CmapTexture: WebGLUniformLocation | null;
    NumCmaps: WebGLUniformLocation | null;
    CmapIndex: WebGLUniformLocation | null;
    Bias: WebGLUniformLocation | null;
    Contrast: WebGLUniformLocation | null;
    ControlMapEnabled: WebGLUniformLocation | null;
    ControlMapSize: WebGLUniformLocation | null;
    ControlMapTexture: WebGLUniformLocation | null;
    ControlMapMin: WebGLUniformLocation | null;
    ControlMapMax: WebGLUniformLocation | null;
}

export class ContourWebGLService {
    private static staticInstance: ContourWebGLService;

    private cmapTexture: WebGLTexture;
    readonly gl: WebGL2RenderingContext | null;
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
        // Skip if no update needed
        if (!this.gl || (this.gl.canvas.width === width && this.gl.canvas.height === height)) {
            return;
        }
        this.gl.canvas.width = width;
        this.gl.canvas.height = height;
    };

    private initShaders() {
        if (!this.gl) {
            return;
        }
        const shaderProgram = getShaderProgram(this.gl, contourShaders.vertexShader, contourShaders.fragmentShader);
        this.gl.useProgram(shaderProgram);

        if (shaderProgram) {
            this.vertexPositionAttribute = this.gl.getAttribLocation(shaderProgram, "aVertexPosition");
            this.gl.enableVertexAttribArray(this.vertexPositionAttribute);
            this.vertexNormalAttribute = this.gl.getAttribLocation(shaderProgram, "aVertexNormal");
            this.gl.enableVertexAttribArray(this.vertexNormalAttribute);

            this.shaderUniforms = {
                RangeScale: this.gl.getUniformLocation(shaderProgram, "uRangeScale"),
                RangeOffset: this.gl.getUniformLocation(shaderProgram, "uRangeOffset"),
                ScaleAdjustment: this.gl.getUniformLocation(shaderProgram, "uScaleAdjustment"),
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
        }

        this.gl.uniform1i(this.shaderUniforms.NumCmaps, 79);
        this.gl.uniform1i(this.shaderUniforms.CmapTexture, 0);
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
