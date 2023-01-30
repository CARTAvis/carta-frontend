import allMaps from "static/allmaps.png";

import {getShaderProgram, GL2, initWebGL2, loadImageTexture} from "utilities";

import {rasterShaders} from "./GLSL";
import {TEXTURE_SIZE, TILE_SIZE} from "./TileService";

interface ShaderUniforms {
    MinVal: WebGLUniformLocation;
    MaxVal: WebGLUniformLocation;
    PixelHighlightVal: WebGLUniformLocation;
    Bias: WebGLUniformLocation;
    Contrast: WebGLUniformLocation;
    UseSmoothedBiasContrast: WebGLUniformLocation;
    Gamma: WebGLUniformLocation;
    Alpha: WebGLUniformLocation;
    ScaleType: WebGLUniformLocation;
    Inverted: WebGLUniformLocation;
    NaNColor: WebGLUniformLocation;
    DataTexture: WebGLUniformLocation;
    CmapTexture: WebGLUniformLocation;
    NumCmaps: WebGLUniformLocation;
    CmapIndex: WebGLUniformLocation;
    CanvasWidth: WebGLUniformLocation;
    CanvasHeight: WebGLUniformLocation;
    RotationOrigin: WebGLUniformLocation;
    RotationAngle: WebGLUniformLocation;
    ScaleAdjustment: WebGLUniformLocation;
    TileSize: WebGLUniformLocation;
    TileScaling: WebGLUniformLocation;
    TileOffset: WebGLUniformLocation;
    TileTextureOffset: WebGLUniformLocation;
    TileTextureSize: WebGLUniformLocation;
    TextureSize: WebGLUniformLocation;
    TileBorder: WebGLUniformLocation;
    PixelGridCutoff: WebGLUniformLocation;
    PixelGridColor: WebGLUniformLocation;
    PixelGridOpacity: WebGLUniformLocation;
    PixelAspectRatio: WebGLUniformLocation;
}

export class TileWebGLService {
    private static staticInstance: TileWebGLService;

    readonly gl: WebGL2RenderingContext;
    cmapTexture: WebGLTexture;
    // GL buffers
    vertexPositionBuffer: WebGLBuffer;
    vertexUVBuffer: WebGLBuffer;
    // Shader attribute handles
    vertexPositionAttribute: number;
    vertexUVAttribute: number;
    // Shader uniform handles
    shaderProgram: WebGLProgram;
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

        this.gl.uniform1i(this.shaderUniforms.DataTexture, 0);
        this.gl.uniform1i(this.shaderUniforms.CmapTexture, 1);
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
        this.gl.uniform1f(this.shaderUniforms.TextureSize, TEXTURE_SIZE);
        this.gl.uniform1f(this.shaderUniforms.TileTextureSize, TILE_SIZE);
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
        const vertices = new Float32Array([0.0, 0.0, 0, 1.0, 0.0, 0, 0.0, 1.0, 0, 1.0, 1.0, 0]);
        this.gl.bufferData(GL2.ARRAY_BUFFER, vertices, GL2.STATIC_DRAW);

        this.vertexUVBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(GL2.ARRAY_BUFFER, this.vertexUVBuffer);
        const uvs = new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0]);
        this.gl.bufferData(GL2.ARRAY_BUFFER, uvs, GL2.STATIC_DRAW);
    }

    private constructor() {
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
