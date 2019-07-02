import * as React from "react";
import {observer} from "mobx-react";
import {FrameStore, OverlayStore} from "stores";
import {FrameView, TileCoordinate} from "models";
import {RasterTile, TEXTURE_SIZE, TILE_SIZE, TileService} from "services/TileService";
import {GetRequiredTiles, getShaderProgram, GL, LayerToMip, loadFP32Texture, loadImageTexture} from "utilities";
import "./RasterViewComponent.css";
import allMaps from "static/allmaps.png";

const vertexShader = require("!raw-loader!./GLSL/vertex_shader.glsl");
const pixelShader = require("!raw-loader!./GLSL/pixel_shader_float_rgb.glsl");

export class RasterViewComponentProps {
    overlaySettings: OverlayStore;
    frame: FrameStore;
    tiledRendering: boolean;
    tileService: TileService;
    docked: boolean;
}

interface ShaderUniforms {
    MinVal: WebGLUniformLocation;
    MaxVal: WebGLUniformLocation;
    Bias: WebGLUniformLocation;
    Contrast: WebGLUniformLocation;
    Gamma: WebGLUniformLocation;
    Alpha: WebGLUniformLocation;
    ScaleType: WebGLUniformLocation;
    NaNColor: WebGLUniformLocation;
    DataTexture: WebGLUniformLocation;
    CmapTexture: WebGLUniformLocation;
    NumCmaps: WebGLUniformLocation;
    CmapIndex: WebGLUniformLocation;
    TiledRendering: WebGLUniformLocation;
    TileSize: WebGLUniformLocation;
    TileScaling: WebGLUniformLocation;
    TileOffset: WebGLUniformLocation;
    TileTextureOffset: WebGLUniformLocation;
    TileTextureSize: WebGLUniformLocation;
    TextureSize: WebGLUniformLocation;
    TileBorder: WebGLUniformLocation;
}

@observer
export class RasterViewComponent extends React.Component<RasterViewComponentProps> {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private hasFloatExtension: boolean;
    // GL buffers
    private rasterDataBuffer: ArrayBufferLike;
    private cmapTexture: WebGLTexture;
    private animationDataTexture: WebGLTexture;
    private vertexPositionBuffer: WebGLBuffer;
    private animationVertexPositionBuffer: WebGLBuffer;
    private vertexUVBuffer: WebGLBuffer;
    // Shader attribute handles
    private vertexPositionAttribute: number;
    private vertexUVAttribute: number;
    // Shader uniform handles
    private shaderProgram: WebGLProgram;
    private shaderUniforms: ShaderUniforms;

    componentDidMount() {
        if (this.canvas) {
            this.initWebGL();
            this.initShaders();
            this.initBuffers();
            loadImageTexture(this.gl, allMaps, WebGLRenderingContext.TEXTURE1).then(texture => {
                this.cmapTexture = texture;
                this.updateCanvas();
            });
        }
        this.props.tileService.GetTileStream().subscribe(tileCount => {
            requestAnimationFrame(this.updateCanvas);
        });
    }

    componentWillUnmount() {
        // Attempt to clean up WebGL resources
        const numTextureUnits = this.gl.getParameter(WebGLRenderingContext.MAX_TEXTURE_IMAGE_UNITS);
        for (let unit = 0; unit < numTextureUnits; ++unit) {
            this.gl.activeTexture(WebGLRenderingContext.TEXTURE0 + unit);
            this.gl.bindTexture(WebGLRenderingContext.TEXTURE_2D, null);
            this.gl.bindTexture(WebGLRenderingContext.TEXTURE_CUBE_MAP, null);
        }
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, null);
        this.gl.bindBuffer(WebGLRenderingContext.ELEMENT_ARRAY_BUFFER, null);
        this.gl.bindRenderbuffer(WebGLRenderingContext.RENDERBUFFER, null);
        this.gl.bindFramebuffer(WebGLRenderingContext.FRAMEBUFFER, null);

        if (this.props.tileService) {
            this.props.tileService.clearTextures();
        }

        this.gl.deleteTexture(this.cmapTexture);
        this.gl.deleteTexture(this.animationDataTexture);
        this.gl.deleteBuffer(this.vertexPositionBuffer);
        this.gl.deleteBuffer(this.animationVertexPositionBuffer);
        this.gl.deleteBuffer(this.vertexUVBuffer);
        this.gl.deleteProgram(this.shaderProgram);

        this.gl.canvas.width = 1;
        this.gl.canvas.height = 1;
    }

    componentDidUpdate() {
        requestAnimationFrame(this.updateCanvas);
    }

    private initWebGL() {
        try {
            this.gl = this.canvas.getContext("webgl", {preserveDrawingBuffer: true});
            if (!this.gl) {
                return;
            }
        } catch (e) {
            console.log(e);
        }
        if (!this.gl) {
            console.log("Could not initialise WebGL");
        }

        const extTextureFloat = this.gl.getExtension("OES_texture_float");

        if (!extTextureFloat) {
            console.log("Could not initialise WebGL float texture extension");
            this.hasFloatExtension = false;
        } else {
            this.hasFloatExtension = true;
        }
        this.props.tileService.setContext(this.gl);
    }

    private updateCanvas = () => {
        const frame = this.props.frame;
        if (frame && this.canvas && this.gl && this.cmapTexture) {
            this.clearCanvas();
            this.updateUniforms();
            this.renderCanvas();

            if (!this.props.tiledRendering && frame.rasterData) {
                // Only update texture if the buffer has changed
                if (frame.rasterData.buffer !== this.rasterDataBuffer) {
                    this.updateTexture();
                }
                this.updateUniforms();
                this.renderCanvas();
            }
        }
    };

    private updateTexture() {
        const frame = this.props.frame;
        const w = Math.floor((frame.currentFrameView.xMax - frame.currentFrameView.xMin) / frame.currentFrameView.mip);
        const h = Math.floor((frame.currentFrameView.yMax - frame.currentFrameView.yMin) / frame.currentFrameView.mip);
        if (!frame.rasterData || frame.rasterData.length !== w * h) {
            console.log(`Data mismatch! L=${frame.rasterData ? frame.rasterData.length : "null"}, WxH = ${w}x${h}=${w * h}`);
            return;
        } else {
            this.gl.bindTexture(WebGLRenderingContext.TEXTURE_2D, this.animationDataTexture);
            loadFP32Texture(this.gl, frame.rasterData, w, h, w, h, WebGLRenderingContext.TEXTURE0);
            this.rasterDataBuffer = frame.rasterData.buffer;
        }
    }

    private updateUniforms() {
        const renderConfig = this.props.frame.renderConfig;
        if (renderConfig && this.shaderUniforms) {
            this.gl.uniform1f(this.shaderUniforms.MinVal, renderConfig.scaleMinVal);
            this.gl.uniform1f(this.shaderUniforms.MaxVal, renderConfig.scaleMaxVal);
            this.gl.uniform1i(this.shaderUniforms.CmapIndex, renderConfig.colorMap);
            this.gl.uniform1i(this.shaderUniforms.ScaleType, renderConfig.scaling);
            this.gl.uniform1f(this.shaderUniforms.Bias, renderConfig.bias);
            this.gl.uniform1f(this.shaderUniforms.Contrast, renderConfig.contrast);
            this.gl.uniform1f(this.shaderUniforms.Gamma, renderConfig.gamma);
            this.gl.uniform1f(this.shaderUniforms.Alpha, renderConfig.alpha);
        }
    }

    private clearCanvas() {
        const frame = this.props.frame;
        // Resize and/or clear the canvas
        this.canvas.width = frame.renderWidth * devicePixelRatio;
        this.canvas.height = frame.renderHeight * devicePixelRatio;
    }

    private renderCanvas() {
        const frame = this.props.frame;
        this.gl.viewport(0, 0, frame.renderWidth * devicePixelRatio, frame.renderHeight * devicePixelRatio);
        this.gl.enable(WebGLRenderingContext.DEPTH_TEST);
        this.gl.clear(WebGLRenderingContext.COLOR_BUFFER_BIT | WebGLRenderingContext.DEPTH_BUFFER_BIT);

        if (this.props.tiledRendering) {
            this.renderTiledCanvas();
        } else if (this.rasterDataBuffer) {
            this.renderAnimationCanvas();
        }
    }

    private renderAnimationCanvas() {
        const frame = this.props.frame;

        const current = frame.currentFrameView;
        const full = frame.requiredFrameView;
        const fullWidth = full.xMax - full.xMin;
        const fullHeight = full.yMax - full.yMin;

        // Bounds need to be adjusted because of MIP level
        const adjustedXMax = current.xMin + Math.floor((current.xMax - current.xMin) / current.mip) * current.mip;
        const adjustedYMax = current.yMin + Math.floor((current.yMax - current.yMin) / current.mip) * current.mip;

        const LT = {x: (0.5 + current.xMin - full.xMin) / fullWidth, y: (0.5 + current.yMin - full.yMin) / fullHeight};
        const RB = {x: (0.5 + adjustedXMax - full.xMin) / fullWidth, y: (0.5 + adjustedYMax - full.yMin) / fullHeight};

        // Vertices are mapped from [0-1] -> [-1, 1]
        const vertices = new Float32Array([
            LT.x, LT.y, 0,
            RB.x, LT.y, 0,
            LT.x, RB.y, 0,
            RB.x, RB.y, 0
        ].map(v => -1 + 2 * v));

        this.gl.activeTexture(WebGLRenderingContext.TEXTURE0);
        this.gl.bindTexture(WebGLRenderingContext.TEXTURE_2D, this.animationDataTexture);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexUVBuffer);
        this.gl.vertexAttribPointer(this.vertexUVAttribute, 2, WebGLRenderingContext.FLOAT, false, 0, 0);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.animationVertexPositionBuffer);
        this.gl.vertexAttribPointer(this.vertexPositionAttribute, 3, WebGLRenderingContext.FLOAT, false, 0, 0);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, new Float32Array(vertices), WebGLRenderingContext.DYNAMIC_DRAW);
        this.gl.uniform1i(this.shaderUniforms.TiledRendering, 0);
        this.gl.drawArrays(WebGLRenderingContext.TRIANGLE_STRIP, 0, 4);
    }

    private renderTiledCanvas() {
        const frame = this.props.frame;

        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexUVBuffer);
        this.gl.vertexAttribPointer(this.vertexUVAttribute, 2, WebGLRenderingContext.FLOAT, false, 0, 0);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexPositionBuffer);
        this.gl.vertexAttribPointer(this.vertexPositionAttribute, 3, WebGLRenderingContext.FLOAT, false, 0, 0);
        this.gl.uniform1i(this.shaderUniforms.TiledRendering, 1);

        const imageSize = {x: frame.frameInfo.fileInfoExtended.width, y: frame.frameInfo.fileInfoExtended.height};
        const boundedView: FrameView = {
            xMin: Math.max(0, frame.requiredFrameView.xMin),
            xMax: Math.min(frame.requiredFrameView.xMax, imageSize.x),
            yMin: Math.max(0, frame.requiredFrameView.yMin),
            yMax: Math.min(frame.requiredFrameView.yMax, imageSize.y),
            mip: frame.requiredFrameView.mip
        };

        this.gl.activeTexture(WebGLRenderingContext.TEXTURE0);
        const requiredTiles = GetRequiredTiles(boundedView, imageSize, {x: TILE_SIZE, y: TILE_SIZE});
        // Special case when zoomed out
        if (requiredTiles.length === 1 && requiredTiles[0].layer === 0) {
            const mip = LayerToMip(0, imageSize, {x: TILE_SIZE, y: TILE_SIZE});
            this.renderTiles(requiredTiles, mip);
            console.log(boundedView.mip);
        } else {
            this.renderTiles(requiredTiles, boundedView.mip);
        }
    }

    private renderTiles(tiles: TileCoordinate[], mip: number, peek: boolean = false) {
        const tileService = this.props.tileService;
        const frame = this.props.frame;

        if (!tileService) {
            return;
        }

        const placeholderTileMap = new Map<number, boolean>();

        for (const tile of tiles) {
            const encodedCoordinate = TileCoordinate.EncodeCoordinate(tile);
            const rasterTile = tileService.getTile(encodedCoordinate, frame.frameInfo.fileId, frame.channel, frame.stokes, peek);
            if (rasterTile) {
                this.renderTile(tile, rasterTile, mip);
            } else if (tile.layer > 0) {
                const lowResTile = {
                    layer: tile.layer - 1,
                    x: Math.floor(tile.x / 2.0),
                    y: Math.floor(tile.y / 2.0),
                };
                placeholderTileMap.set(TileCoordinate.EncodeCoordinate(lowResTile), true);
            }
        }
        const placeholderTileList: TileCoordinate[] = [];
        placeholderTileMap.forEach((val, encodedTile) => placeholderTileList.push(TileCoordinate.Decode(encodedTile)));
        if (placeholderTileList.length) {
            this.renderTiles(placeholderTileList, mip * 2, true);
        }
    }

    private renderTile(tile: TileCoordinate, rasterTile: RasterTile, mip: number) {
        const frame = this.props.frame;

        if (!rasterTile) {
            return;
        }

        if (rasterTile.data) {
            this.props.tileService.uploadTileToGPU(rasterTile);
            delete rasterTile.data;
        }

        const textureParameters = this.props.tileService.getTileTextureParameters(rasterTile);
        if (textureParameters) {
            this.gl.bindTexture(WebGLRenderingContext.TEXTURE_2D, textureParameters.texture);
            this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_MIN_FILTER, GL.NEAREST);
            this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_MAG_FILTER, GL.NEAREST);
            this.gl.uniform2f(this.shaderUniforms.TileTextureOffset, textureParameters.offset.x, textureParameters.offset.y);
        }

        const full = frame.requiredFrameView;

        const fullWidth = full.xMax - full.xMin;
        const fullHeight = full.yMax - full.yMin;

        const tileSizeAdjusted = mip * TILE_SIZE;
        const tileImageView: FrameView = {
            xMin: tile.x * tileSizeAdjusted,
            yMin: tile.y * tileSizeAdjusted,
            xMax: (tile.x + 1) * tileSizeAdjusted,
            yMax: (tile.y + 1) * tileSizeAdjusted,
            mip: 1
        };

        const bottomLeft = {x: (0.5 + tileImageView.xMin - full.xMin) / fullWidth, y: (0.5 + tileImageView.yMin - full.yMin) / fullHeight};

        this.gl.uniform2f(this.shaderUniforms.TileSize, rasterTile.width / TILE_SIZE, rasterTile.height / TILE_SIZE);
        this.gl.uniform2f(this.shaderUniforms.TileOffset, bottomLeft.x, bottomLeft.y);
        this.gl.uniform2f(this.shaderUniforms.TileScaling, (mip * TILE_SIZE * frame.zoomLevel) / (frame.renderWidth * devicePixelRatio), (mip * TILE_SIZE * frame.zoomLevel) / (frame.renderHeight * devicePixelRatio));
        this.gl.drawArrays(WebGLRenderingContext.TRIANGLE_STRIP, 0, 4);
    }

    private initShaders() {
        this.shaderProgram = getShaderProgram(this.gl, vertexShader, pixelShader);
        this.gl.useProgram(this.shaderProgram);

        this.vertexPositionAttribute = this.gl.getAttribLocation(this.shaderProgram, "aVertexPosition");
        this.vertexUVAttribute = this.gl.getAttribLocation(this.shaderProgram, "aVertexUV");
        this.gl.enableVertexAttribArray(this.vertexPositionAttribute);
        this.gl.enableVertexAttribArray(this.vertexUVAttribute);

        this.shaderUniforms = {
            MinVal: this.gl.getUniformLocation(this.shaderProgram, "uMinVal"),
            MaxVal: this.gl.getUniformLocation(this.shaderProgram, "uMaxVal"),
            NaNColor: this.gl.getUniformLocation(this.shaderProgram, "uNaNColor"),
            Bias: this.gl.getUniformLocation(this.shaderProgram, "uBias"),
            Contrast: this.gl.getUniformLocation(this.shaderProgram, "uContrast"),
            Gamma: this.gl.getUniformLocation(this.shaderProgram, "uGamma"),
            Alpha: this.gl.getUniformLocation(this.shaderProgram, "uAlpha"),
            ScaleType: this.gl.getUniformLocation(this.shaderProgram, "uScaleType"),
            DataTexture: this.gl.getUniformLocation(this.shaderProgram, "uDataTexture"),
            CmapTexture: this.gl.getUniformLocation(this.shaderProgram, "uCmapTexture"),
            NumCmaps: this.gl.getUniformLocation(this.shaderProgram, "uNumCmaps"),
            CmapIndex: this.gl.getUniformLocation(this.shaderProgram, "uCmapIndex"),
            TiledRendering: this.gl.getUniformLocation(this.shaderProgram, "uTiledRendering"),
            TileSize: this.gl.getUniformLocation(this.shaderProgram, "uTileSize"),
            TileScaling: this.gl.getUniformLocation(this.shaderProgram, "uTileScaling"),
            TileOffset: this.gl.getUniformLocation(this.shaderProgram, "uTileOffset"),
            TileTextureOffset: this.gl.getUniformLocation(this.shaderProgram, "uTileTextureOffset"),
            TextureSize: this.gl.getUniformLocation(this.shaderProgram, "uTextureSize"),
            TileTextureSize: this.gl.getUniformLocation(this.shaderProgram, "uTileTextureSize"),
            TileBorder: this.gl.getUniformLocation(this.shaderProgram, "uTileBorder")
        };

        this.gl.uniform1i(this.shaderUniforms.DataTexture, 0);
        this.gl.uniform1i(this.shaderUniforms.CmapTexture, 1);
        this.gl.uniform1i(this.shaderUniforms.NumCmaps, 79);
        this.gl.uniform1i(this.shaderUniforms.CmapIndex, 2);
        this.gl.uniform1f(this.shaderUniforms.MinVal, 3.4);
        this.gl.uniform1f(this.shaderUniforms.MaxVal, 5.50);
        this.gl.uniform1f(this.shaderUniforms.Bias, 0);
        this.gl.uniform1f(this.shaderUniforms.Contrast, 1);
        this.gl.uniform1f(this.shaderUniforms.Gamma, 1);
        this.gl.uniform1f(this.shaderUniforms.Alpha, 1000);
        this.gl.uniform1i(this.shaderUniforms.TiledRendering, 1);
        this.gl.uniform1f(this.shaderUniforms.TileBorder, 0 / TILE_SIZE);
        this.gl.uniform2f(this.shaderUniforms.TileSize, 1, 1);
        this.gl.uniform2f(this.shaderUniforms.TileScaling, 1, 1);
        this.gl.uniform2f(this.shaderUniforms.TileOffset, 0, 0);
        this.gl.uniform2f(this.shaderUniforms.TileTextureOffset, 0, 0);
        this.gl.uniform1f(this.shaderUniforms.TextureSize, TEXTURE_SIZE);
        this.gl.uniform1f(this.shaderUniforms.TileTextureSize, TILE_SIZE);
        this.gl.uniform4f(this.shaderUniforms.NaNColor, 0, 0, 1, 1);
    }

    private initBuffers() {
        this.vertexPositionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexPositionBuffer);
        const vertices = new Float32Array([
            0.0, 0.0, 0,
            1.0, 0.0, 0,
            0.0, 1.0, 0,
            1.0, 1.0, 0
        ]);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, vertices, WebGLRenderingContext.STATIC_DRAW);

        this.vertexUVBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexUVBuffer);
        const uvs = new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            1.0, 1.0
        ]);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, uvs, WebGLRenderingContext.STATIC_DRAW);

        this.animationVertexPositionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.animationVertexPositionBuffer);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, vertices, WebGLRenderingContext.DYNAMIC_DRAW);
        this.animationDataTexture = this.gl.createTexture();
    }

    render() {
        // dummy values to trigger React's componentDidUpdate()
        const frame = this.props.frame;
        const frameView = frame ? frame.requiredFrameView : null;
        const currentView = frame ? frame.currentFrameView : null;
        if (frame) {
            const colorMapping = {
                min: frame.renderConfig.scaleMinVal,
                max: frame.renderConfig.scaleMaxVal,
                colorMap: frame.renderConfig.colorMap,
                contrast: frame.renderConfig.contrast,
                bias: frame.renderConfig.bias,
                scaling: frame.renderConfig.scaling,
                gamma: frame.renderConfig.gamma,
                alpha: frame.renderConfig.alpha
            };
        }
        const tiledRendering = this.props.tiledRendering;
        const padding = this.props.overlaySettings.padding;
        let className = "raster-div";
        if (this.props.docked) {
            className += " docked";
        }
        return (
            <div className={className}>
                <canvas
                    className="raster-canvas"
                    id="raster-canvas"
                    ref={(ref) => this.canvas = ref}
                    style={{
                        top: padding.top,
                        left: padding.left,
                        width: frame ? frame.renderWidth : 1,
                        height: frame ? frame.renderHeight : 1
                    }}
                />
            </div>);
    }
}
