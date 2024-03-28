import {getShaderProgram, GL2, initWebGL2, loadImageTexture} from "utilities";

import allMaps from "../static/allmaps.png";

import {vectorOverlayShaders} from "./GLSL";

interface ShaderUniforms {
    DataTexture: WebGLUniformLocation | null;
    RangeScale: WebGLUniformLocation | null;
    RangeOffset: WebGLUniformLocation | null;
    RotationOffset: WebGLUniformLocation | null;
    RotationAngle: WebGLUniformLocation | null;
    ScaleAdjustment: WebGLUniformLocation | null;
    ZoomLevel: WebGLUniformLocation | null;
    CanvasSpaceLineWidth: WebGLUniformLocation | null;
    FeatherWidth: WebGLUniformLocation | null;
    LengthMin: WebGLUniformLocation | null;
    LengthMax: WebGLUniformLocation | null;
    IntensityMin: WebGLUniformLocation | null;
    IntensityMax: WebGLUniformLocation | null;
    IntensityPlot: WebGLUniformLocation | null;
    CmapEnabled: WebGLUniformLocation | null;
    CmapTexture: WebGLUniformLocation | null;
    NumCmaps: WebGLUniformLocation | null;
    CmapIndex: WebGLUniformLocation | null;
    Bias: WebGLUniformLocation | null;
    Contrast: WebGLUniformLocation | null;
    LineColor: WebGLUniformLocation | null;
    ControlMapEnabled: WebGLUniformLocation | null;
    ControlMapSize: WebGLUniformLocation | null;
    ControlMapTexture: WebGLUniformLocation | null;
    ControlMapMin: WebGLUniformLocation | null;
    ControlMapMax: WebGLUniformLocation | null;
}

export class VectorOverlayWebGLService {
    private static staticInstance: VectorOverlayWebGLService;

    readonly gl: WebGL2RenderingContext | null;
    private cmapTexture: WebGLTexture;
    shaderUniforms: ShaderUniforms;

    static get Instance() {
        if (!VectorOverlayWebGLService.staticInstance) {
            VectorOverlayWebGLService.staticInstance = new VectorOverlayWebGLService();
        }
        return VectorOverlayWebGLService.staticInstance;
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
        const shaderProgram = getShaderProgram(this.gl, vectorOverlayShaders.vertexShader, vectorOverlayShaders.fragmentShader);

        if (shaderProgram) {
            this.gl.useProgram(shaderProgram);

            this.shaderUniforms = {
                DataTexture: this.gl.getUniformLocation(shaderProgram, "uDataTexture"),
                RangeScale: this.gl.getUniformLocation(shaderProgram, "uRangeScale"),
                RangeOffset: this.gl.getUniformLocation(shaderProgram, "uRangeOffset"),
                RotationOffset: this.gl.getUniformLocation(shaderProgram, "uRotationOffset"),
                ScaleAdjustment: this.gl.getUniformLocation(shaderProgram, "uScaleAdjustment"),
                RotationAngle: this.gl.getUniformLocation(shaderProgram, "uRotationAngle"),
                ZoomLevel: this.gl.getUniformLocation(shaderProgram, "uZoomLevel"),
                CanvasSpaceLineWidth: this.gl.getUniformLocation(shaderProgram, "uCanvasSpaceLineWidth"),
                FeatherWidth: this.gl.getUniformLocation(shaderProgram, "uFeatherWidth"),
                LengthMin: this.gl.getUniformLocation(shaderProgram, "uLengthMin"),
                LengthMax: this.gl.getUniformLocation(shaderProgram, "uLengthMax"),
                IntensityMin: this.gl.getUniformLocation(shaderProgram, "uIntensityMin"),
                IntensityMax: this.gl.getUniformLocation(shaderProgram, "uIntensityMax"),
                IntensityPlot: this.gl.getUniformLocation(shaderProgram, "uIntensityPlot"),
                CmapEnabled: this.gl.getUniformLocation(shaderProgram, "uCmapEnabled"),
                CmapTexture: this.gl.getUniformLocation(shaderProgram, "uCmapTexture"),
                NumCmaps: this.gl.getUniformLocation(shaderProgram, "uNumCmaps"),
                CmapIndex: this.gl.getUniformLocation(shaderProgram, "uCmapIndex"),
                Contrast: this.gl.getUniformLocation(shaderProgram, "uContrast"),
                Bias: this.gl.getUniformLocation(shaderProgram, "uBias"),
                LineColor: this.gl.getUniformLocation(shaderProgram, "uLineColor"),
                ControlMapEnabled: this.gl.getUniformLocation(shaderProgram, "uControlMapEnabled"),
                ControlMapSize: this.gl.getUniformLocation(shaderProgram, "uControlMapSize"),
                ControlMapMin: this.gl.getUniformLocation(shaderProgram, "uControlMapMin"),
                ControlMapMax: this.gl.getUniformLocation(shaderProgram, "uControlMapMax"),
                ControlMapTexture: this.gl.getUniformLocation(shaderProgram, "uControlMapTexture")
            };
        }

        this.gl.uniform1i(this.shaderUniforms.DataTexture, 0);
        this.gl.uniform1i(this.shaderUniforms.NumCmaps, 79);
        this.gl.uniform1i(this.shaderUniforms.CmapTexture, 2);
    }

    private constructor() {
        this.gl = initWebGL2();
        if (!this.gl) {
            return;
        }

        this.initShaders();
        loadImageTexture(this.gl, allMaps, GL2.TEXTURE2).then(texture => {
            this.cmapTexture = texture;
        });
    }
}
