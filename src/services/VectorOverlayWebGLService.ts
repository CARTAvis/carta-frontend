import {getShaderProgram, initWebGL2, loadImageTexture, GL2} from "utilities";
import {vectorOverlayShaders} from "./GLSL";
import allMaps from "../static/allmaps.png";

interface ShaderUniforms {
    DataTexture: WebGLUniformLocation;
    FrameViewMin: WebGLUniformLocation;
    FrameViewMax: WebGLUniformLocation;
    ZoomLevel: WebGLUniformLocation;
    CanvasSpaceLineWidth: WebGLUniformLocation;
    FeatherWidth: WebGLUniformLocation;
    LengthMin: WebGLUniformLocation;
    LengthMax: WebGLUniformLocation;
    IntensityMin: WebGLUniformLocation;
    IntensityMax: WebGLUniformLocation;
    IntensityPlot: WebGLUniformLocation;
    // TODO: Support color maps
    // CmapEnabled: WebGLUniformLocation;
    // CmapValue: WebGLUniformLocation;
    // CmapTexture: WebGLUniformLocation;
    // NumCmaps: WebGLUniformLocation;
    // CmapIndex: WebGLUniformLocation;
    // Bias: WebGLUniformLocation;
    // Contrast: WebGLUniformLocation;
    ControlMapEnabled: WebGLUniformLocation;
    ControlMapSize: WebGLUniformLocation;
    ControlMapTexture: WebGLUniformLocation;
    ControlMapMin: WebGLUniformLocation;
    ControlMapMax: WebGLUniformLocation;
}

export class VectorOverlayWebGLService {
    private static staticInstance: VectorOverlayWebGLService;

    readonly gl: WebGL2RenderingContext;
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
        this.gl.useProgram(shaderProgram);

        this.shaderUniforms = {
            DataTexture: this.gl.getUniformLocation(shaderProgram, "uDataTexture"),
            FrameViewMin: this.gl.getUniformLocation(shaderProgram, "uFrameViewMin"),
            FrameViewMax: this.gl.getUniformLocation(shaderProgram, "uFrameViewMax"),
            ZoomLevel: this.gl.getUniformLocation(shaderProgram, "uZoomLevel"),
            CanvasSpaceLineWidth: this.gl.getUniformLocation(shaderProgram, "uCanvasSpaceLineWidth"),
            FeatherWidth: this.gl.getUniformLocation(shaderProgram, "uFeatherWidth"),
            LengthMin: this.gl.getUniformLocation(shaderProgram, "uLengthMin"),
            LengthMax: this.gl.getUniformLocation(shaderProgram, "uLengthMax"),
            IntensityMin: this.gl.getUniformLocation(shaderProgram, "uIntensityMin"),
            IntensityMax: this.gl.getUniformLocation(shaderProgram, "uIntensityMax"),
            IntensityPlot: this.gl.getUniformLocation(shaderProgram, "uIntensityPlot"),
            // CmapEnabled: this.gl.getUniformLocation(shaderProgram, "uCmapEnabled"),
            // CmapValue: this.gl.getUniformLocation(shaderProgram, "uCmapValue"),
            // CmapTexture: this.gl.getUniformLocation(shaderProgram, "uCmapTexture"),
            // NumCmaps: this.gl.getUniformLocation(shaderProgram, "uNumCmaps"),
            // CmapIndex: this.gl.getUniformLocation(shaderProgram, "uCmapIndex"),
            // Contrast: this.gl.getUniformLocation(shaderProgram, "uContrast"),
            // Bias: this.gl.getUniformLocation(shaderProgram, "uBias"),
            ControlMapEnabled: this.gl.getUniformLocation(shaderProgram, "uControlMapEnabled"),
            ControlMapSize: this.gl.getUniformLocation(shaderProgram, "uControlMapSize"),
            ControlMapMin: this.gl.getUniformLocation(shaderProgram, "uControlMapMin"),
            ControlMapMax: this.gl.getUniformLocation(shaderProgram, "uControlMapMax"),
            ControlMapTexture: this.gl.getUniformLocation(shaderProgram, "uControlMapTexture")
        };

        this.gl.uniform1i(this.shaderUniforms.DataTexture, 0);
        // this.gl.uniform1i(this.shaderUniforms.NumCmaps, 79);
        // this.gl.uniform1i(this.shaderUniforms.CmapTexture, 1);
    }

    private constructor() {
        this.gl = initWebGL2();
        if (!this.gl) {
            return;
        }

        this.initShaders();
        loadImageTexture(this.gl, allMaps, GL2.TEXTURE1).then(texture => {
            this.cmapTexture = texture;
        });
    }
}
