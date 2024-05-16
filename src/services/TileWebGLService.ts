import allMaps from "static/allmaps.png";
import tinycolor from "tinycolor2";

import {TEXTURE_SIZE, TILE_SIZE} from "services";
import {getShaderProgram, GL2, initWebGL2, loadImageTexture} from "utilities";

import {rasterShaders} from "./GLSL";

interface ShaderUniforms {
    MinVal: WebGLUniformLocation | null;
    MaxVal: WebGLUniformLocation | null;
    PixelHighlightVal: WebGLUniformLocation | null;
    Bias: WebGLUniformLocation | null;
    Contrast: WebGLUniformLocation | null;
    UseSmoothedBiasContrast: WebGLUniformLocation | null;
    Gamma: WebGLUniformLocation | null;
    Alpha: WebGLUniformLocation | null;
    ScaleType: WebGLUniformLocation | null;
    Inverted: WebGLUniformLocation | null;
    NaNColor: WebGLUniformLocation | null;
    DataTexture: WebGLUniformLocation | null;
    CmapTexture: WebGLUniformLocation | null;
    CmapCustomGradientEnd: WebGLUniformLocation | null;
    CmapCustomGradientStart: WebGLUniformLocation | null;
    NumCmaps: WebGLUniformLocation | null;
    CmapIndex: WebGLUniformLocation | null;
    CanvasWidth: WebGLUniformLocation | null;
    CanvasHeight: WebGLUniformLocation | null;
    RotationOrigin: WebGLUniformLocation | null;
    RotationAngle: WebGLUniformLocation | null;
    ScaleAdjustment: WebGLUniformLocation | null;
    TileSize: WebGLUniformLocation | null;
    TileScaling: WebGLUniformLocation | null;
    TileOffset: WebGLUniformLocation | null;
    TileTextureOffset: WebGLUniformLocation | null;
    TileTextureSize: WebGLUniformLocation | null;
    TextureSize: WebGLUniformLocation | null;
    TileBorder: WebGLUniformLocation | null;
    PixelGridCutoff: WebGLUniformLocation | null;
    PixelGridColor: WebGLUniformLocation | null;
    PixelGridOpacity: WebGLUniformLocation | null;
    PixelAspectRatio: WebGLUniformLocation | null;
}

export class TileWebGLService {
    protected static staticInstance: TileWebGLService;

    readonly gl: WebGL2RenderingContext | null;
    cmapTexture: WebGLTexture;
    // GL buffers
    vertexPositionBuffer: WebGLBuffer | null;
    vertexUVBuffer: WebGLBuffer | null;
    // Shader attribute handles
    vertexPositionAttribute: number;
    vertexUVAttribute: number;
    // Shader uniform handles
    shaderProgram: WebGLProgram | null;
    shaderUniforms: ShaderUniforms;

    static get Instance() {
        if (!TileWebGLService.staticInstance) {
            TileWebGLService.staticInstance = new TileWebGLService();
        }
        return TileWebGLService.staticInstance;
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
        this.shaderProgram = getShaderProgram(this.gl, rasterShaders.vertexShader, rasterShaders.fragmentShader);
        if (this.shaderProgram) {
            this.gl.useProgram(this.shaderProgram);

            this.vertexPositionAttribute = this.gl.getAttribLocation(this.shaderProgram, "aVertexPosition");
            this.vertexUVAttribute = this.gl.getAttribLocation(this.shaderProgram, "aVertexUV");
            this.gl.enableVertexAttribArray(this.vertexPositionAttribute);
            this.gl.enableVertexAttribArray(this.vertexUVAttribute);

            this.shaderUniforms = {
                MinVal: this.gl.getUniformLocation(this.shaderProgram, "uMinVal"),
                MaxVal: this.gl.getUniformLocation(this.shaderProgram, "uMaxVal"),
                PixelHighlightVal: this.gl.getUniformLocation(this.shaderProgram, "uPixelHighlightVal"),
                NaNColor: this.gl.getUniformLocation(this.shaderProgram, "uNaNColor"),
                Bias: this.gl.getUniformLocation(this.shaderProgram, "uBias"),
                Contrast: this.gl.getUniformLocation(this.shaderProgram, "uContrast"),
                UseSmoothedBiasContrast: this.gl.getUniformLocation(this.shaderProgram, "uUseSmoothedBiasContrast"),
                Gamma: this.gl.getUniformLocation(this.shaderProgram, "uGamma"),
                Alpha: this.gl.getUniformLocation(this.shaderProgram, "uAlpha"),
                ScaleType: this.gl.getUniformLocation(this.shaderProgram, "uScaleType"),
                Inverted: this.gl.getUniformLocation(this.shaderProgram, "uInverted"),
                DataTexture: this.gl.getUniformLocation(this.shaderProgram, "uDataTexture"),
                CmapTexture: this.gl.getUniformLocation(this.shaderProgram, "uCmapTexture"),
                CmapCustomGradientEnd: this.gl.getUniformLocation(this.shaderProgram, "uCmapCustomGradientEnd"),
                CmapCustomGradientStart: this.gl.getUniformLocation(this.shaderProgram, "uCmapCustomGradientStart"),
                NumCmaps: this.gl.getUniformLocation(this.shaderProgram, "uNumCmaps"),
                CmapIndex: this.gl.getUniformLocation(this.shaderProgram, "uCmapIndex"),
                CanvasWidth: this.gl.getUniformLocation(this.shaderProgram, "uCanvasWidth"),
                CanvasHeight: this.gl.getUniformLocation(this.shaderProgram, "uCanvasHeight"),
                ScaleAdjustment: this.gl.getUniformLocation(this.shaderProgram, "uScaleAdjustment"),
                RotationOrigin: this.gl.getUniformLocation(this.shaderProgram, "uRotationOrigin"),
                RotationAngle: this.gl.getUniformLocation(this.shaderProgram, "uRotationAngle"),
                TileSize: this.gl.getUniformLocation(this.shaderProgram, "uTileSize"),
                TileScaling: this.gl.getUniformLocation(this.shaderProgram, "uTileScaling"),
                TileOffset: this.gl.getUniformLocation(this.shaderProgram, "uTileOffset"),
                TileTextureOffset: this.gl.getUniformLocation(this.shaderProgram, "uTileTextureOffset"),
                TextureSize: this.gl.getUniformLocation(this.shaderProgram, "uTextureSize"),
                TileTextureSize: this.gl.getUniformLocation(this.shaderProgram, "uTileTextureSize"),
                TileBorder: this.gl.getUniformLocation(this.shaderProgram, "uTileBorder"),
                PixelGridCutoff: this.gl.getUniformLocation(this.shaderProgram, "uPixelGridCutoff"),
                PixelGridColor: this.gl.getUniformLocation(this.shaderProgram, "uPixelGridColor"),
                PixelGridOpacity: this.gl.getUniformLocation(this.shaderProgram, "uPixelGridOpacity"),
                PixelAspectRatio: this.gl.getUniformLocation(this.shaderProgram, "uPixelAspectRatio")
            };
        }

        this.gl.uniform1i(this.shaderUniforms.DataTexture, 0);
        this.gl.uniform1i(this.shaderUniforms.CmapTexture, 1);
        this.gl.uniform3f(this.shaderUniforms.CmapCustomGradientEnd, 0, 0, 0);
        this.gl.uniform3f(this.shaderUniforms.CmapCustomGradientStart, 1, 1, 1);
        this.gl.uniform1i(this.shaderUniforms.NumCmaps, 79);
        this.gl.uniform1i(this.shaderUniforms.CmapIndex, 2);
        this.gl.uniform1f(this.shaderUniforms.MinVal, 3.4);
        this.gl.uniform1f(this.shaderUniforms.MaxVal, 5.5);
        this.gl.uniform1f(this.shaderUniforms.Bias, 0);
        this.gl.uniform1f(this.shaderUniforms.Contrast, 1);
        this.gl.uniform1i(this.shaderUniforms.UseSmoothedBiasContrast, 1);
        this.gl.uniform1f(this.shaderUniforms.Gamma, 1);
        this.gl.uniform1f(this.shaderUniforms.Alpha, 1000);
        this.gl.uniform1i(this.shaderUniforms.Inverted, 0);
        this.gl.uniform1f(this.shaderUniforms.TileBorder, 0 / TILE_SIZE);
        this.gl.uniform2f(this.shaderUniforms.TileSize, 1, 1);
        this.gl.uniform2f(this.shaderUniforms.TileScaling, 1, 1);
        this.gl.uniform2f(this.shaderUniforms.TileOffset, 0, 0);
        this.gl.uniform2f(this.shaderUniforms.TileTextureOffset, 0, 0);
        this.gl.uniform2f(this.shaderUniforms.TextureSize, TEXTURE_SIZE, TEXTURE_SIZE);
        this.gl.uniform2f(this.shaderUniforms.TileTextureSize, TILE_SIZE, TILE_SIZE);
        this.gl.uniform4f(this.shaderUniforms.NaNColor, 0, 0, 1, 1);
        this.gl.uniform1f(this.shaderUniforms.PixelGridCutoff, 0);
        this.gl.uniform4f(this.shaderUniforms.PixelGridColor, 1, 1, 1, 1);
        this.gl.uniform1f(this.shaderUniforms.PixelGridOpacity, 0);
        this.gl.uniform1f(this.shaderUniforms.PixelAspectRatio, 1);
    }

    private initBuffers() {
        if (!this.gl) {
            return;
        }
        this.vertexPositionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(GL2.ARRAY_BUFFER, this.vertexPositionBuffer);
        this.gl.vertexAttribPointer(this.vertexPositionAttribute, 3, GL2.FLOAT, false, 0, 0);
        const vertices = new Float32Array([0.0, 0.0, 0, 1.0, 0.0, 0, 0.0, 1.0, 0, 1.0, 1.0, 0]);
        this.gl.bufferData(GL2.ARRAY_BUFFER, vertices, GL2.STATIC_DRAW);

        this.vertexUVBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(GL2.ARRAY_BUFFER, this.vertexUVBuffer);
        this.gl.vertexAttribPointer(this.vertexUVAttribute, 2, GL2.FLOAT, false, 0, 0);
        const uvs = new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0]);
        this.gl.bufferData(GL2.ARRAY_BUFFER, uvs, GL2.STATIC_DRAW);
    }

    setCustomGradientUniforms(hex: string, startHex?: string) {
        if (tinycolor(hex).getFormat() === "hex" && this.gl) {
            const rgb = tinycolor(hex).toRgb();
            this.gl.uniform3f(this.shaderUniforms.CmapCustomGradientEnd, rgb.r / 255, rgb.g / 255, rgb.b / 255);
            const CmapCustomGradientStart = tinycolor(startHex).getFormat() === "hex" ? tinycolor(startHex).toRgb() : tinycolor("#000000").toRgb();
            this.gl.uniform3f(this.shaderUniforms.CmapCustomGradientStart, CmapCustomGradientStart.r / 255, CmapCustomGradientStart.g / 255, CmapCustomGradientStart.b / 255);
        }
    }

    protected constructor() {
        this.gl = initWebGL2();
        if (!this.gl) {
            return;
        }
        this.initShaders();
        this.initBuffers();
        loadImageTexture(this.gl, allMaps, GL2.TEXTURE1).then(texture => {
            this.cmapTexture = texture;
        });
    }
}

export class PreviewWebGLService extends TileWebGLService {
    protected static staticInstance: PreviewWebGLService;

    static get Instance() {
        if (!PreviewWebGLService.staticInstance) {
            PreviewWebGLService.staticInstance = new PreviewWebGLService();
        }
        return PreviewWebGLService.staticInstance;
    }

    private constructor() {
        super();
    }
}
