import * as React from "react";
import {observer} from "mobx-react";
import {FrameStore, OverlayStore} from "stores";
import {FrameView, TileCoordinate} from "models";
import {RasterTile, TileService} from "services/TileService";
import {GetRequiredTiles, getShaderProgram, LayerToMip, loadFP32Texture, loadImageTexture} from "utilities";
import "./RasterViewComponent.css";
import allMaps from "static/allmaps.png";

const vertShader = require("!raw-loader!./GLSL/vert.glsl");
const pixelShaderSimple = require("!raw-loader!./GLSL/pixel_simple.glsl");

export class RasterViewComponentProps {
    overlaySettings: OverlayStore;
    frame: FrameStore;
    tileService: TileService;
    docked: boolean;
}

const TILE_SIZE = 256;

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
    TileSize: WebGLUniformLocation;
    TileScaling: WebGLUniformLocation;
    TileOffset: WebGLUniformLocation;
    TextureOffset: WebGLUniformLocation;
    TextureScaling: WebGLUniformLocation;
    TileBorder: WebGLUniformLocation;
}

@observer
export class RasterViewComponent extends React.Component<RasterViewComponentProps> {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private hasFloatExtension: boolean;
    private hasFloatLinearExtension: boolean;
    // GL buffers
    private rasterDataBuffer: ArrayBufferLike;
    private cmapTexture: WebGLTexture;
    private vertexPositionBuffer: WebGLBuffer;
    private vertexUVBuffer: WebGLBuffer;
    // Shader attribute handles
    private vertexPositionAttribute: number;
    private vertexUVAttribute: number;
    // Shader uniform handles
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
        if (this.props.tileService) {
            this.props.tileService.clearTextures();
        }
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
            const extTextureFloatLinear = this.gl.getExtension("OES_texture_float_linear");
            if (!extTextureFloatLinear) {
                console.log("Could not initialise WebGL linear float extension");
                this.hasFloatLinearExtension = false;
            } else {
                this.hasFloatExtension = true;
            }
        }
        this.props.tileService.setContext(this.gl);
    }

    private updateCanvas = () => {
        const frame = this.props.frame;
        if (frame && this.canvas && this.gl && this.cmapTexture) {
            this.clearCanvas();
            this.updateUniforms();
            this.renderCanvas();

            // if (frame.rasterData) {
            //     // Only update texture if the buffer has changed
            //     if (frame.rasterData.buffer !== this.rasterDataBuffer) {
            //         this.updateTexture();
            //     }
            //     this.updateUniforms();
            //     this.renderCanvas();
            // }
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

        const current = frame.currentFrameView;
        const full = frame.requiredFrameView;
        const fullWidth = full.xMax - full.xMin;
        const fullHeight = full.yMax - full.yMin;

        // Bounds need to be adjusted because of MIP level
        const adjustedXMax = current.xMin + Math.floor((current.xMax - current.xMin) / current.mip) * current.mip;
        const adjustedYMax = current.yMin + Math.floor((current.yMax - current.yMin) / current.mip) * current.mip;

        const LT = {x: (0.5 + current.xMin - full.xMin) / fullWidth, y: (0.5 + current.yMin - full.yMin) / fullHeight};
        const RB = {x: (0.5 + adjustedXMax - full.xMin) / fullWidth, y: (0.5 + adjustedYMax - full.yMin) / fullHeight};

        const viewportMin = {
            x: Math.floor(LT.x * frame.renderWidth * devicePixelRatio),
            y: Math.floor(LT.y * frame.renderHeight * devicePixelRatio)
        };

        const viewportMax = {
            x: Math.floor(RB.x * frame.renderWidth * devicePixelRatio),
            y: Math.floor(RB.y * frame.renderHeight * devicePixelRatio)
        };
        const viewportSize = {
            x: viewportMax.x - viewportMin.x,
            y: viewportMax.y - viewportMin.y
        };

        this.gl.enable(WebGLRenderingContext.DEPTH_TEST);
        this.gl.clear(WebGLRenderingContext.COLOR_BUFFER_BIT | WebGLRenderingContext.DEPTH_BUFFER_BIT);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexUVBuffer);
        this.gl.vertexAttribPointer(this.vertexUVAttribute, 2, WebGLRenderingContext.FLOAT, false, 0, 0);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexPositionBuffer);
        this.gl.vertexAttribPointer(this.vertexPositionAttribute, 3, WebGLRenderingContext.FLOAT, false, 0, 0);

        // this.gl.uniform1f(this.shaderUniforms.TileWidthCutoff, 1);
        // this.gl.uniform1f(this.shaderUniforms.TileHeightCutoff, 1);
        // TODO: render raster image data properly again using new scaling uniforms
        // this.gl.viewport(viewportMin.x, viewportMin.y, viewportSize.x, viewportSize.y);
        // this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, new Float32Array(vertices), WebGLRenderingContext.STATIC_DRAW);
        // this.gl.drawArrays(WebGLRenderingContext.TRIANGLE_STRIP, 0, 4);

        const imageSize = {x: frame.frameInfo.fileInfoExtended.width, y: frame.frameInfo.fileInfoExtended.height};
        const boundedView: FrameView = {
            xMin: Math.max(0, frame.requiredFrameView.xMin),
            xMax: Math.min(frame.requiredFrameView.xMax, imageSize.x),
            yMin: Math.max(0, frame.requiredFrameView.yMin),
            yMax: Math.min(frame.requiredFrameView.yMax, imageSize.y),
            mip: frame.requiredFrameView.mip
        };

        this.gl.activeTexture(WebGLRenderingContext.TEXTURE0);
        this.gl.viewport(0, 0, frame.renderWidth * devicePixelRatio, frame.renderHeight * devicePixelRatio);
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

        // let texture = rasterTile.texture;
        //
        // if (!texture) {
        //
        //     this.props.tileService.uploadTileToGPU(rasterTile);
        //
        //     texture = this.gl.createTexture();
        //     rasterTile.texture = texture;
        //     this.gl.bindTexture(WebGLRenderingContext.TEXTURE_2D, texture);
        //
        //     const textureMip = LayerToMip(tile.layer, {x: frame.frameInfo.fileInfoExtended.width, y: frame.frameInfo.fileInfoExtended.height}, {x: TILE_SIZE, y: TILE_SIZE});
        //     let filterType = textureMip <= 1 ? WebGLRenderingContext.NEAREST : WebGLRenderingContext.LINEAR;
        //     if (!this.hasFloatLinearExtension) {
        //         filterType = WebGLRenderingContext.NEAREST;
        //     }
        //     loadFP32Texture(this.gl, rasterTile.data, TILE_SIZE, TILE_SIZE, rasterTile.width, rasterTile.height, WebGLRenderingContext.TEXTURE0, filterType);
        //     delete rasterTile.data;
        // } else {
        //     this.gl.bindTexture(WebGLRenderingContext.TEXTURE_2D, texture);
        // }

        const textureParameters = this.props.tileService.getTileTextureParameters(rasterTile);
        if (textureParameters) {
            this.gl.bindTexture(WebGLRenderingContext.TEXTURE_2D, textureParameters.texture);
            this.gl.uniform2f(this.shaderUniforms.TextureOffset, textureParameters.xOffset, textureParameters.yOffset);
            this.gl.uniform2f(this.shaderUniforms.TextureScaling, textureParameters.xScaling, textureParameters.yScaling);
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
        const shaderProgram = getShaderProgram(this.gl, vertShader, pixelShaderSimple);
        this.gl.useProgram(shaderProgram);

        this.vertexPositionAttribute = this.gl.getAttribLocation(shaderProgram, "aVertexPosition");
        this.vertexUVAttribute = this.gl.getAttribLocation(shaderProgram, "aVertexUV");
        this.gl.enableVertexAttribArray(this.vertexPositionAttribute);
        this.gl.enableVertexAttribArray(this.vertexUVAttribute);

        this.shaderUniforms = {
            MinVal: this.gl.getUniformLocation(shaderProgram, "uMinVal"),
            MaxVal: this.gl.getUniformLocation(shaderProgram, "uMaxVal"),
            NaNColor: this.gl.getUniformLocation(shaderProgram, "uNaNColor"),
            Bias: this.gl.getUniformLocation(shaderProgram, "uBias"),
            Contrast: this.gl.getUniformLocation(shaderProgram, "uContrast"),
            Gamma: this.gl.getUniformLocation(shaderProgram, "uGamma"),
            Alpha: this.gl.getUniformLocation(shaderProgram, "uAlpha"),
            ScaleType: this.gl.getUniformLocation(shaderProgram, "uScaleType"),
            DataTexture: this.gl.getUniformLocation(shaderProgram, "uDataTexture"),
            CmapTexture: this.gl.getUniformLocation(shaderProgram, "uCmapTexture"),
            NumCmaps: this.gl.getUniformLocation(shaderProgram, "uNumCmaps"),
            CmapIndex: this.gl.getUniformLocation(shaderProgram, "uCmapIndex"),
            TileSize: this.gl.getUniformLocation(shaderProgram, "uTileSize"),
            TileScaling: this.gl.getUniformLocation(shaderProgram, "uTileScaling"),
            TileOffset: this.gl.getUniformLocation(shaderProgram, "uTileOffset"),
            TextureOffset: this.gl.getUniformLocation(shaderProgram, "uTextureOffset"),
            TextureScaling: this.gl.getUniformLocation(shaderProgram, "uTextureScaling"),
            TileBorder: this.gl.getUniformLocation(shaderProgram, "uTileBorder")
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
        this.gl.uniform1f(this.shaderUniforms.TileBorder, 0 / TILE_SIZE);
        this.gl.uniform2f(this.shaderUniforms.TileSize, 1, 1);
        this.gl.uniform2f(this.shaderUniforms.TileScaling, 1, 1);
        this.gl.uniform2f(this.shaderUniforms.TileOffset, 0, 0);
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

        // Create a texture.
        const texture = this.gl.createTexture();
        this.gl.activeTexture(WebGLRenderingContext.TEXTURE0);
        this.gl.bindTexture(WebGLRenderingContext.TEXTURE_2D, texture);
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
