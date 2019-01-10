import * as React from "react";
import {observer} from "mobx-react";
import {FrameStore, OverlayStore} from "stores";
import "./RasterViewComponent.css";
import allMaps from "static/allmaps.png";

const vertShader = require("!raw-loader!./GLSL/vert.glsl");
const pixelShaderSimple = require("!raw-loader!./GLSL/pixel_simple.glsl");

export class RasterViewComponentProps {
    overlaySettings: OverlayStore;
    frame: FrameStore;
    docked: boolean;
}

@observer
export class RasterViewComponent extends React.Component<RasterViewComponentProps> {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private hasFloatExtension: boolean;
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
    private MinValUniform: WebGLUniformLocation;
    private MaxValUniform: WebGLUniformLocation;
    private BiasUniform: WebGLUniformLocation;
    private ContrastUniform: WebGLUniformLocation;
    private GammaUniform: WebGLUniformLocation;
    private AlphaUniform: WebGLUniformLocation;
    private ScaleTypeUniform: WebGLUniformLocation;
    private NaNColor: WebGLUniformLocation;
    private DataTexture: WebGLUniformLocation;
    private CmapTexture: WebGLUniformLocation;
    private NumCmaps: WebGLUniformLocation;
    private CmapIndex: WebGLUniformLocation;

    componentDidMount() {
        if (this.canvas) {
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
                console.log("Could not initialise WebGL extensions");
                this.hasFloatExtension = false;
            }
            else {
                this.hasFloatExtension = true;
            }
            this.initShaders();
            this.initBuffers();
            this.loadImageTexture(allMaps, WebGLRenderingContext.TEXTURE1).then(texture => {
                this.cmapTexture = texture;
                this.updateCanvas();
            });
        }
    }

    componentDidUpdate() {
        requestAnimationFrame(this.updateCanvas);
    }

    private updateCanvas = () => {
        const frame = this.props.frame;
        if (frame && this.canvas && this.gl && this.cmapTexture) {
            this.clearCanvas();
            if (frame.rasterData) {
                // Only update texture if the buffer has changed
                if (frame.rasterData.buffer !== this.rasterDataBuffer) {
                    this.updateTexture();
                }
                if (frame.overviewRasterData && frame.overviewRasterData.buffer !== this.overviewRasterDataBuffer) {
                    this.updateOverviewTexture();
                }
                this.updateUniforms();
                this.renderCanvas();
            }
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
        }
        else {
            this.loadFP32Texture(frame.rasterData, w, h, WebGLRenderingContext.TEXTURE0);
            this.rasterDataBuffer = frame.rasterData.buffer;
        }
    }

    private updateOverviewTexture() {
        const frame = this.props.frame;
        if (frame.overviewRasterData) {
            const overviewW = Math.floor((frame.overviewRasterView.xMax - frame.overviewRasterView.xMin) / frame.overviewRasterView.mip);
            const overviewH = Math.floor((frame.overviewRasterView.yMax - frame.overviewRasterView.yMin) / frame.overviewRasterView.mip);
            this.loadFP32Texture(frame.overviewRasterData, overviewW, overviewH, WebGLRenderingContext.TEXTURE2);
            this.overviewRasterDataBuffer = frame.overviewRasterData.buffer;
        }
    }

    private updateUniforms() {
        const frame = this.props.frame;
        this.gl.uniform1f(this.MinValUniform, frame.renderConfig.scaleMin);
        this.gl.uniform1f(this.MaxValUniform, frame.renderConfig.scaleMax);
        this.gl.uniform1i(this.CmapIndex, frame.renderConfig.colorMap);
        this.gl.uniform1i(this.ScaleTypeUniform, frame.renderConfig.scaling);
        this.gl.uniform1f(this.BiasUniform, frame.renderConfig.bias);
        this.gl.uniform1f(this.ContrastUniform, frame.renderConfig.contrast);
        this.gl.uniform1f(this.GammaUniform, frame.renderConfig.gamma);
        this.gl.uniform1f(this.AlphaUniform, frame.renderConfig.alpha);
    }

    private clearCanvas() {
        const frame = this.props.frame;
        // Resize and/or clear the canvas
        this.canvas.width = frame.renderWidth;
        this.canvas.height = frame.renderHeight;
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

        // Vertices are mapped from [0-1] -> [-1, 1]
        const vertices = new Float32Array([
            LT.x, LT.y, 0,
            RB.x, LT.y, 0,
            LT.x, RB.y, 0,
            RB.x, RB.y, 0
        ].map(v => -1 + 2 * v));

        this.gl.viewport(0, 0, frame.renderWidth, frame.renderHeight);
        this.gl.enable(WebGLRenderingContext.DEPTH_TEST);
        this.gl.clear(WebGLRenderingContext.COLOR_BUFFER_BIT | WebGLRenderingContext.DEPTH_BUFFER_BIT);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexUVBuffer);
        this.gl.vertexAttribPointer(this.vertexUVAttribute, 2, WebGLRenderingContext.FLOAT, false, 0, 0);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexPositionBuffer);
        this.gl.vertexAttribPointer(this.vertexPositionAttribute, 3, WebGLRenderingContext.FLOAT, false, 0, 0);

        if (frame.overviewRasterData) {
            const adjustedWidth = Math.floor(frame.frameInfo.fileInfoExtended.width / frame.overviewRasterView.mip) * frame.overviewRasterView.mip;
            const adjustedHeight = Math.floor(frame.frameInfo.fileInfoExtended.height / frame.overviewRasterView.mip) * frame.overviewRasterView.mip;
            const overviewLT = {x: (0.5 - full.xMin) / fullWidth, y: (0.5 - full.yMin) / fullHeight};
            const overviewRB = {x: (0.5 + adjustedWidth - full.xMin) / fullWidth, y: (0.5 + adjustedHeight - full.yMin) / fullHeight};

            const overviewVertices = new Float32Array([
                overviewLT.x, overviewLT.y, 0.5,
                overviewRB.x, overviewLT.y, 0.5,
                overviewLT.x, overviewRB.y, 0.5,
                overviewRB.x, overviewRB.y, 0.5
            ].map(v => -1 + 2 * v));

            // Switch to TEXTURE2 for overview render
            this.gl.uniform1i(this.DataTexture, 2);
            this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, new Float32Array(overviewVertices), WebGLRenderingContext.STATIC_DRAW);
            this.gl.drawArrays(WebGLRenderingContext.TRIANGLE_STRIP, 0, 4);
            // Switch back to TEXTURE0 for overview main render
            this.gl.uniform1i(this.DataTexture, 0);
        }
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, new Float32Array(vertices), WebGLRenderingContext.STATIC_DRAW);
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

        this.MinValUniform = this.gl.getUniformLocation(shaderProgram, "uMinVal");
        this.MaxValUniform = this.gl.getUniformLocation(shaderProgram, "uMaxVal");
        this.NaNColor = this.gl.getUniformLocation(shaderProgram, "uNaNColor");
        this.BiasUniform = this.gl.getUniformLocation(shaderProgram, "uBias");
        this.ContrastUniform = this.gl.getUniformLocation(shaderProgram, "uContrast");
        this.GammaUniform = this.gl.getUniformLocation(shaderProgram, "uGamma");
        this.AlphaUniform = this.gl.getUniformLocation(shaderProgram, "uAlpha");
        this.ScaleTypeUniform = this.gl.getUniformLocation(shaderProgram, "uScaleType");
        this.DataTexture = this.gl.getUniformLocation(shaderProgram, "uDataTexture");
        this.CmapTexture = this.gl.getUniformLocation(shaderProgram, "uCmapTexture");
        this.NumCmaps = this.gl.getUniformLocation(shaderProgram, "uNumCmaps");
        this.CmapIndex = this.gl.getUniformLocation(shaderProgram, "uCmapIndex");
        this.gl.uniform1i(this.DataTexture, 0);
        this.gl.uniform1i(this.CmapTexture, 1);
        this.gl.uniform1i(this.NumCmaps, 79);
        this.gl.uniform1i(this.CmapIndex, 2);
        this.gl.uniform1f(this.MinValUniform, 3.4);
        this.gl.uniform1f(this.MaxValUniform, 5.50);
        this.gl.uniform1f(this.BiasUniform, 0);
        this.gl.uniform1f(this.ContrastUniform, 1);
        this.gl.uniform1f(this.GammaUniform, 1);
        this.gl.uniform1f(this.AlphaUniform, 1000);
        this.gl.uniform4f(this.NaNColor, 0, 0, 1, 1);
    }

    private initBuffers() {
        this.vertexPositionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexPositionBuffer);
        const vertices = new Float32Array([
            -1.0, -1.0, 0.0,
            1.0, -1.0, 0.0,
            -1.0, 1.0, 0.0,
            1.0, 1.0, 0.0
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

    private loadFP32Texture(data: Float32Array, width: number, height: number, texIndex: number) {
        this.gl.activeTexture(texIndex);
        this.gl.pixelStorei(WebGLRenderingContext.UNPACK_ALIGNMENT, 1);
        this.gl.texImage2D(WebGLRenderingContext.TEXTURE_2D, 0, WebGLRenderingContext.LUMINANCE, width, height, 0, WebGLRenderingContext.LUMINANCE, WebGLRenderingContext.FLOAT, data);

        // set the filtering so we don't need mips and it's not filtered
        this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_MIN_FILTER, WebGLRenderingContext.NEAREST);
        this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_MAG_FILTER, WebGLRenderingContext.NEAREST);
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
                min: frame.renderConfig.scaleMin,
                max: frame.renderConfig.scaleMax,
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
