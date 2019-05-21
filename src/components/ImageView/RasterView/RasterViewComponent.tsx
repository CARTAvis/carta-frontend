import * as React from "react";
import {observer} from "mobx-react";
import {FrameStore, OverlayStore} from "stores";
import {FrameView, TileCoordinate} from "models";
import {RasterTile, TileService} from "services/TileService";
import {GetRequiredTiles, LayerToMip} from "utilities";
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
    TileWidthCutoff: WebGLUniformLocation;
    TileHeightCutoff: WebGLUniformLocation;
}

@observer
export class RasterViewComponent extends React.Component<RasterViewComponentProps> {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private hasFloatExtension: boolean;
    private hasFloatLinearExtension: boolean;
    // GL buffers
    private rasterDataBuffer: ArrayBufferLike;
    private overviewRasterDataBuffer: ArrayBufferLike;
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
            try {
                this.gl = this.canvas.getContext("webgl", {preserveDrawingBuffer: true});
                if (!this.gl) {
                    return;
                }
                this.props.tileService.setContext(this.gl);
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

            this.initShaders();
            this.initBuffers();
            this.loadImageTexture(allMaps, WebGLRenderingContext.TEXTURE1).then(texture => {
                this.cmapTexture = texture;
                this.updateCanvas();
            });
        }
        this.props.tileService.GetTileStream().subscribe(tileCount => {
            requestAnimationFrame(this.updateCanvas);
        });
    }

    componentDidUpdate() {
        requestAnimationFrame(this.updateCanvas);
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
            //     if (frame.overviewRasterData && frame.overviewRasterData.buffer !== this.overviewRasterDataBuffer) {
            //         this.updateOverviewTexture();
            //     }
            //     this.updateUniforms();
            //     this.renderCanvas();
            // }
        }
    };

    private loadImageTexture(url: string, texIndex: number): Promise<WebGLTexture> {
        return new Promise<WebGLTexture>((resolve, reject) => {
            const image = new Image();
            // Replace the existing texture with the real one once loaded
            image.onload = () => {
                const imageTexture = this.gl.createTexture();
                this.gl.activeTexture(texIndex);
                this.gl.bindTexture(WebGLRenderingContext.TEXTURE_2D, imageTexture);
                this.gl.texImage2D(WebGLRenderingContext.TEXTURE_2D, 0, WebGLRenderingContext.RGB, WebGLRenderingContext.RGB, WebGLRenderingContext.UNSIGNED_BYTE, image);
                this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_WRAP_S, WebGLRenderingContext.CLAMP_TO_EDGE);
                this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_WRAP_T, WebGLRenderingContext.CLAMP_TO_EDGE);
                this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_MIN_FILTER, WebGLRenderingContext.NEAREST);
                this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_MAG_FILTER, WebGLRenderingContext.NEAREST);
                resolve(imageTexture);
            };
            image.onerror = () => reject(`Error loading image ${url}`);
            image.src = url;
        });
    }

    private updateTexture() {
        const frame = this.props.frame;
        const w = Math.floor((frame.currentFrameView.xMax - frame.currentFrameView.xMin) / frame.currentFrameView.mip);
        const h = Math.floor((frame.currentFrameView.yMax - frame.currentFrameView.yMin) / frame.currentFrameView.mip);
        if (!frame.rasterData || frame.rasterData.length !== w * h) {
            console.log(`Data mismatch! L=${frame.rasterData ? frame.rasterData.length : "null"}, WxH = ${w}x${h}=${w * h}`);
            return;
        } else {
            this.loadFP32Texture(frame.rasterData, w, h, w, h, WebGLRenderingContext.TEXTURE0);
            this.rasterDataBuffer = frame.rasterData.buffer;
        }
    }

    private updateOverviewTexture() {
        const frame = this.props.frame;
        if (frame.overviewRasterData) {
            const overviewW = Math.floor((frame.overviewRasterView.xMax - frame.overviewRasterView.xMin) / frame.overviewRasterView.mip);
            const overviewH = Math.floor((frame.overviewRasterView.yMax - frame.overviewRasterView.yMin) / frame.overviewRasterView.mip);
            this.loadFP32Texture(frame.overviewRasterData, overviewW, overviewH, overviewW, overviewH, WebGLRenderingContext.TEXTURE2);
            this.overviewRasterDataBuffer = frame.overviewRasterData.buffer;
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

        this.gl.viewport(viewportMin.x, viewportMin.y, viewportSize.x, viewportSize.y);

        this.gl.enable(WebGLRenderingContext.DEPTH_TEST);
        this.gl.clear(WebGLRenderingContext.COLOR_BUFFER_BIT | WebGLRenderingContext.DEPTH_BUFFER_BIT);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexUVBuffer);
        this.gl.vertexAttribPointer(this.vertexUVAttribute, 2, WebGLRenderingContext.FLOAT, false, 0, 0);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexPositionBuffer);
        this.gl.vertexAttribPointer(this.vertexPositionAttribute, 3, WebGLRenderingContext.FLOAT, false, 0, 0);

        // if (frame.overviewRasterData) {
        //     const adjustedWidth = Math.floor(frame.frameInfo.fileInfoExtended.width / frame.overviewRasterView.mip) * frame.overviewRasterView.mip;
        //     const adjustedHeight = Math.floor(frame.frameInfo.fileInfoExtended.height / frame.overviewRasterView.mip) * frame.overviewRasterView.mip;
        //     const overviewLT = {x: (0.5 - full.xMin) / fullWidth, y: (0.5 - full.yMin) / fullHeight};
        //     const overviewRB = {x: (0.5 + adjustedWidth - full.xMin) / fullWidth, y: (0.5 + adjustedHeight - full.yMin) / fullHeight};
        //
        //     const overviewVertices = new Float32Array([
        //         overviewLT.x, overviewLT.y, 0.5,
        //         overviewRB.x, overviewLT.y, 0.5,
        //         overviewLT.x, overviewRB.y, 0.5,
        //         overviewRB.x, overviewRB.y, 0.5
        //     ].map(v => -1 + 2 * v));
        //
        //     // Switch to TEXTURE2 for overview render
        //     this.gl.uniform1i(this.DataTexture, 2);
        //     this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, new Float32Array(overviewVertices), WebGLRenderingContext.STATIC_DRAW);
        //     this.gl.drawArrays(WebGLRenderingContext.TRIANGLE_STRIP, 0, 4);
        //     // Switch back to TEXTURE0 for overview main render
        //     this.gl.uniform1i(this.DataTexture, 0);
        // }
        // this.gl.uniform1f(this.shaderUniforms.TileWidthCutoff, 1);
        // this.gl.uniform1f(this.shaderUniforms.TileHeightCutoff, 1);
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
        const requiredTiles = GetRequiredTiles(boundedView, imageSize, {x: TILE_SIZE, y: TILE_SIZE});
        this.renderTiles(requiredTiles, boundedView.mip);
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

        let texture = rasterTile.texture;

        if (!texture) {
            texture = this.gl.createTexture();
            rasterTile.texture = texture;
            this.gl.bindTexture(WebGLRenderingContext.TEXTURE_2D, texture);

            const textureMip = LayerToMip(tile.layer, {x: frame.frameInfo.fileInfoExtended.width, y: frame.frameInfo.fileInfoExtended.height}, {x: TILE_SIZE, y: TILE_SIZE});
            this.loadFP32Texture(rasterTile.data, TILE_SIZE, TILE_SIZE, rasterTile.width, rasterTile.height, WebGLRenderingContext.TEXTURE0, textureMip <= 1 ? WebGLRenderingContext.NEAREST : WebGLRenderingContext.LINEAR);
            delete rasterTile.data;
        } else {
            this.gl.bindTexture(WebGLRenderingContext.TEXTURE_2D, texture);
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

        const LT = {x: (0.5 + tileImageView.xMin - full.xMin) / fullWidth, y: (0.5 + tileImageView.yMin - full.yMin) / fullHeight};
        const RB = {x: (0.5 + tileImageView.xMax - full.xMin) / fullWidth, y: (0.5 + tileImageView.yMax - full.yMin) / fullHeight};

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

        this.gl.uniform1f(this.shaderUniforms.TileWidthCutoff, rasterTile.width / TILE_SIZE);
        this.gl.uniform1f(this.shaderUniforms.TileHeightCutoff, rasterTile.height / TILE_SIZE);

        this.gl.viewport(viewportMin.x, viewportMin.y, viewportSize.x, viewportSize.y);
        this.gl.drawArrays(WebGLRenderingContext.TRIANGLE_STRIP, 0, 4);
    }

    private getShaderFromString(shaderScript: string, type: number) {
        if (!shaderScript || !(type === WebGLRenderingContext.VERTEX_SHADER || type === WebGLRenderingContext.FRAGMENT_SHADER)) {
            return null;
        }

        let shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, shaderScript);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, WebGLRenderingContext.COMPILE_STATUS)) {
            console.log(this.gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    private initShaders() {
        let vertexShader = this.getShaderFromString(vertShader, WebGLRenderingContext.VERTEX_SHADER);
        let fragmentShader = this.getShaderFromString(pixelShaderSimple, WebGLRenderingContext.FRAGMENT_SHADER);

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

        this.vertexUVAttribute = this.gl.getAttribLocation(shaderProgram, "aVertexUV");
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
            TileWidthCutoff: this.gl.getUniformLocation(shaderProgram, "uTileWidthCutoff"),
            TileHeightCutoff: this.gl.getUniformLocation(shaderProgram, "uTileHeightCutoff"),
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
        this.gl.uniform1f(this.shaderUniforms.TileWidthCutoff, 1);
        this.gl.uniform1f(this.shaderUniforms.TileHeightCutoff, 1);
        this.gl.uniform4f(this.shaderUniforms.NaNColor, 0, 0, 1, 1);

    }

    private initBuffers() {
        this.vertexPositionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexPositionBuffer);
        const vertices = new Float32Array([
            -1, -1, 0,
            1, -1, 0,
            -1, 1, 0,
            1, 1, 0
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

        // Create a texture.
        const textureOverview = this.gl.createTexture();
        this.gl.activeTexture(WebGLRenderingContext.TEXTURE2);
        this.gl.bindTexture(WebGLRenderingContext.TEXTURE_2D, textureOverview);
    }

    private loadFP32Texture(data: Float32Array, width: number, height: number, dataWidth: number, dataHeight: number, texIndex: number, filtering: number = WebGLRenderingContext.LINEAR) {
        this.gl.activeTexture(texIndex);
        if (dataWidth === width && dataHeight === height) {
            this.gl.texImage2D(WebGLRenderingContext.TEXTURE_2D, 0, WebGLRenderingContext.LUMINANCE, width, height, 0, WebGLRenderingContext.LUMINANCE, WebGLRenderingContext.FLOAT, data);
        } else {
            this.gl.texImage2D(WebGLRenderingContext.TEXTURE_2D, 0, WebGLRenderingContext.LUMINANCE, width, height, 0, WebGLRenderingContext.LUMINANCE, WebGLRenderingContext.FLOAT, null);
            this.gl.texSubImage2D(WebGLRenderingContext.TEXTURE_2D, 0, 0, 0, dataWidth, dataHeight, WebGLRenderingContext.LUMINANCE, WebGLRenderingContext.FLOAT, data);
        }
        if (!this.hasFloatLinearExtension) {
            filtering = WebGLRenderingContext.NEAREST;
        }

        // set the filtering so we don't need mips and it's not filtered
        this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_MIN_FILTER, filtering);
        this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_MAG_FILTER, filtering);
        this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_WRAP_S, WebGLRenderingContext.CLAMP_TO_EDGE);
        this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_WRAP_T, WebGLRenderingContext.CLAMP_TO_EDGE);
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
