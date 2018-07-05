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
    private canvasTemp: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private canvasContext: CanvasRenderingContext2D;

    // GL buffers
    private vertexPositionBuffer: WebGLBuffer;
    private vertexUVBuffer: WebGLBuffer;
    // Shader attribute handles
    private vertexPositionAttribute: number;
    private vertexUVAttribute: number;
    // Shader uniform handles
    private pMatrixUniform: WebGLUniformLocation;
    private mvMatrixUniform: WebGLUniformLocation;
    private MinValUniform: WebGLUniformLocation;
    private MaxValUniform: WebGLUniformLocation;
    private BiasUniform: WebGLUniformLocation;
    private ContrastUniform: WebGLUniformLocation;
    private ScaleTypeUniform: WebGLUniformLocation;
    private ViewportSizeUniform: WebGLUniformLocation;
    private DataTexture: WebGLUniformLocation;
    private CmapTexture: WebGLUniformLocation;
    private NumCmaps: WebGLUniformLocation;
    private CmapIndex: WebGLUniformLocation;

    componentDidMount() {
        if (this.canvas) {
            this.gl = this.canvas.getContext("webgl");
            this.initShaders();
            this.initBuffers();
            this.canvasContext = this.canvasTemp.getContext("2d");
            this.updateCanvas();
        }
    }

    componentDidUpdate() {
        if (this.canvas) {
            this.updateCanvas();
        }
    }

    private updateCanvas = () => {
        const frame = this.props.frame;
        const current = frame.currentFrameView;
        const full = frame.requiredFrameView;
        const fullWidth = full.xMax - full.xMin;
        const fullHeight = full.yMax - full.yMin;

        const LT = {x: (current.xMin - full.xMin) / fullWidth, y: (current.yMin - full.yMin) / fullHeight};
        const RB = {x: (current.xMax - full.xMin) / fullWidth, y: (current.yMax - full.yMin) / fullHeight};

        // Vertices are mapped from [0-1] -> [-1, 1]
        const vertices = new Float32Array([
            LT.x, LT.y, 0,
            RB.x, LT.y, 0,
            LT.x, RB.y, 0,
            RB.x, RB.y, 0
        ].map(v => -1 + 2* v));

        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexPositionBuffer);
        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, new Float32Array(vertices), WebGLRenderingContext.STATIC_DRAW);
        this.gl.viewport(0, 0, frame.renderWidth, frame.renderHeight);
        this.gl.clear(WebGLRenderingContext.COLOR_BUFFER_BIT | WebGLRenderingContext.DEPTH_BUFFER_BIT);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexPositionBuffer);
        this.gl.vertexAttribPointer(this.vertexPositionAttribute, 3, WebGLRenderingContext.FLOAT, false, 0, 0);
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexUVBuffer);
        this.gl.vertexAttribPointer(this.vertexUVAttribute, 2, WebGLRenderingContext.FLOAT, false, 0, 0);
        this.gl.drawArrays(WebGLRenderingContext.TRIANGLE_STRIP, 0, 4);

        this.canvas.width = frame.renderWidth;
        this.canvas.height = frame.renderHeight;
        this.canvasContext.save();
        this.canvasContext.scale(1, -1);
        this.canvasContext.translate(0, -this.canvas.height);
        this.canvasContext.fillStyle = "blue";
        this.canvasContext.fillRect(LT.x * frame.renderWidth, LT.y * frame.renderHeight, (RB.x - LT.x) * frame.renderWidth, (RB.y - LT.y) * frame.renderHeight);
        this.canvasContext.restore();
    };

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

        // this.pMatrixUniform = this.gl.getUniformLocation(shaderProgram, "uPMatrix");
        // this.mvMatrixUniform = this.gl.getUniformLocation(shaderProgram, "uMVMatrix");
        //
        // this.MinValUniform = this.gl.getUniformLocation(shaderProgram, "uMinVal");
        // this.MaxValUniform = this.gl.getUniformLocation(shaderProgram, "uMaxVal");
        // this.BiasUniform = this.gl.getUniformLocation(shaderProgram, "uBias");
        // this.ContrastUniform = this.gl.getUniformLocation(shaderProgram, "uContrast");
        // this.ScaleTypeUniform = this.gl.getUniformLocation(shaderProgram, "uScaleType");
        //
        // this.ViewportSizeUniform = this.gl.getUniformLocation(shaderProgram, "uViewportSize");
        //
        // this.DataTexture = this.gl.getUniformLocation(shaderProgram, "uDataTexture");
        // this.CmapTexture = this.gl.getUniformLocation(shaderProgram, "uCmapTexture");
        // this.NumCmaps = this.gl.getUniformLocation(shaderProgram, "uNumCmaps");
        // this.CmapIndex = this.gl.getUniformLocation(shaderProgram, "uCmapIndex");
        // this.gl.uniform1i(this.DataTexture, 0);
        // this.gl.uniform1i(this.CmapTexture, 1);
        // this.gl.uniform1i(this.NumCmaps, 79);
        // this.gl.uniform1i(this.CmapIndex, 41);
    }

    private initBuffers() {
        //Create Square Position Buffer
        this.vertexPositionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexPositionBuffer);
        const vertices = new Float32Array([
            -1.0, -1.0, 0.0,
            1.0, -1.0, 0.0,
            -1.0, 1.0, 0.0,
            1.0, 1.0, 0.0
        ]);

        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, vertices, WebGLRenderingContext.STATIC_DRAW);
        //this.vertexPositionBuffer..itemSize = 3;
        //squareVertexPositionBuffer.numItems = 4;

        //Create Square UV Buffer
        this.vertexUVBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexUVBuffer);
        const uvs = new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            1.0, 1.0
        ]);

        this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, uvs, WebGLRenderingContext.STATIC_DRAW);
        //squareVertexUVBuffer.itemSize = 2;
        //squareVertexUVBuffer.numItems = 4;
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
                <canvas
                    className="temp-canvas"
                    ref={(ref) => this.canvasTemp = ref}
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