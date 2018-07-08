import {FrameState} from "../../../states/FrameState";
import * as React from "react";
import {observer} from "mobx-react";
import {OverlayState} from "../../../states/OverlayState";
import "./RasterViewComponent.css";

const vertShader = require("!raw-loader!./GLSL/vert.glsl");
const pixelShader = require("!raw-loader!./GLSL/pixel_float.glsl");
const pixelShaderSimple = require("!raw-loader!./GLSL/pixel_simple.glsl");

export class RasterViewComponentProps {
    overlaySettings: OverlayState;
    frame: FrameState;
}

@observer
export class RasterViewComponent extends React.Component<RasterViewComponentProps> {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private hasFloatExtension: boolean;
    // GL buffers
    private rasterDataBuffer: ArrayBufferLike;
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
    private ScaleTypeUniform: WebGLUniformLocation;
    private NaNColor: WebGLUniformLocation;
    private DataTexture: WebGLUniformLocation;
    private CmapTexture: WebGLUniformLocation;
    private NumCmaps: WebGLUniformLocation;
    private CmapIndex: WebGLUniformLocation;

    componentDidMount() {
        if (this.canvas) {
            try {
                this.gl = this.canvas.getContext("webgl");
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
            this.cmapTexture = this.loadImageTexture("allmaps.png", WebGLRenderingContext.TEXTURE1);
            this.initShaders();
            this.initBuffers();
            this.updateUniforms();
            this.renderCanvas();
        }
    }

    componentDidUpdate() {
        const frame = this.props.frame;
        if (frame && this.canvas && this.gl) {
            this.clearCanvas();
            if (frame.rasterData) {
                // Only update texture if the buffer has changed
                if (frame.rasterData.buffer !== this.rasterDataBuffer) {
                    this.updateTexture();
                }
                this.updateUniforms();
                this.renderCanvas();
            }
        }
    }

    private loadImageTexture(url: string, texIndex: number): WebGLTexture {
        const imageTexture = this.gl.createTexture();
        this.gl.activeTexture(texIndex);
        this.gl.bindTexture(WebGLRenderingContext.TEXTURE_2D, imageTexture);

        // Placeholder texture
        const pixel = new Uint8Array([0, 0, 255]);
        this.gl.texImage2D(WebGLRenderingContext.TEXTURE_2D, 0, WebGLRenderingContext.RGB, 1, 1, 0, WebGLRenderingContext.RGB, WebGLRenderingContext.UNSIGNED_BYTE, pixel);

        const image = new Image();
        // Replace the existing texture with the real one once loaded
        image.onload = () => {
            this.gl.activeTexture(texIndex);
            this.gl.bindTexture(WebGLRenderingContext.TEXTURE_2D, imageTexture);
            this.gl.texImage2D(WebGLRenderingContext.TEXTURE_2D, 0, WebGLRenderingContext.RGB, WebGLRenderingContext.RGB, WebGLRenderingContext.UNSIGNED_BYTE, image);
            this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_WRAP_S, WebGLRenderingContext.CLAMP_TO_EDGE);
            this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_WRAP_T, WebGLRenderingContext.CLAMP_TO_EDGE);
            this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_MIN_FILTER, WebGLRenderingContext.NEAREST);
            this.gl.texParameteri(WebGLRenderingContext.TEXTURE_2D, WebGLRenderingContext.TEXTURE_MAG_FILTER, WebGLRenderingContext.NEAREST);
        };
        image.src = url;
        return imageTexture;
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

    private updateUniforms() {
        const frame = this.props.frame;
        this.gl.uniform1f(this.MinValUniform, frame.scaleMin);
        this.gl.uniform1f(this.MaxValUniform, frame.scaleMax);
        this.gl.uniform1i(this.CmapIndex, frame.colorMap);
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

        const LT = {x: (current.xMin - full.xMin) / fullWidth, y: (current.yMin - full.yMin) / fullHeight};
        const RB = {x: (adjustedXMax - full.xMin) / fullWidth, y: (adjustedYMax - full.yMin) / fullHeight};

        // Vertices are mapped from [0-1] -> [-1, 1]
        const vertices = new Float32Array([
            LT.x, LT.y, 0,
            RB.x, LT.y, 0,
            LT.x, RB.y, 0,
            RB.x, RB.y, 0
        ].map(v => -1 + 2 * v));

        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexPositionBuffer);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, new Float32Array(vertices), WebGLRenderingContext.STATIC_DRAW);
        this.gl.viewport(0, 0, frame.renderWidth, frame.renderHeight);
        this.gl.clear(WebGLRenderingContext.COLOR_BUFFER_BIT | WebGLRenderingContext.DEPTH_BUFFER_BIT);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexPositionBuffer);
        this.gl.vertexAttribPointer(this.vertexPositionAttribute, 3, WebGLRenderingContext.FLOAT, false, 0, 0);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexUVBuffer);
        this.gl.vertexAttribPointer(this.vertexUVAttribute, 2, WebGLRenderingContext.FLOAT, false, 0, 0);
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
        // this.BiasUniform = this.gl.getUniformLocation(shaderProgram, "uBias");
        // this.ContrastUniform = this.gl.getUniformLocation(shaderProgram, "uContrast");
        // this.ScaleTypeUniform = this.gl.getUniformLocation(shaderProgram, "uScaleType");
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
        const frame = this.props.frame;
        const frameView = frame.requiredFrameView;
        const currentView = frame.currentFrameView;
        const padding = this.props.overlaySettings.padding;
        return (
            <div className="raster-div">
                <canvas
                    className="raster-canvas"
                    ref={(ref) => this.canvas = ref}
                    style={{
                        top: padding.top,
                        left: padding.left,
                        width: frame.renderWidth,
                        height: frame.renderHeight
                    }}
                />
            </div>);
    }
}