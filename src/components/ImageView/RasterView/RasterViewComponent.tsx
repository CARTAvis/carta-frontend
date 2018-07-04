import {FrameState} from "../../../states/FrameState";
import * as React from "react";
import {observer} from "mobx-react";
import {OverlayState} from "../../../states/OverlayState";
import "./RasterViewComponent.css";

const vertShader = require("!raw-loader!./GLSL/vert.glsl");
const pixelShader = require("!raw-loader!./GLSL/pixel_float.glsl");

export class RasterViewComponentProps {
    overlaySettings: OverlayState;
    frame: FrameState;
}

@observer
export class RasterViewComponent extends React.Component<RasterViewComponentProps> {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private canvasContext: CanvasRenderingContext2D;

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
            // this.gl = this.canvas.getContext("webgl");
            // this.initShaders();
            this.canvasContext = this.canvas.getContext("2d");
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
        this.canvas.width = frame.renderWidth;
        this.canvas.height = frame.renderHeight;
        this.canvasContext.save();
        this.canvasContext.scale(1, -1);
        this.canvasContext.translate(0, -this.canvas.height);
        const current = frame.currentFrameView;
        const full = frame.requiredFrameView;
        const fullWidth = full.xMax - full.xMin;
        const fullHeight = full.yMax - full.yMin;

        const LT = {x: (current.xMin - full.xMin) / fullWidth, y: (current.yMin - full.yMin) / fullHeight};
        const RB = {x: (current.xMax - full.xMin) / fullWidth, y: (current.yMax - full.yMin) / fullHeight};
        this.canvasContext.fillStyle = "red";
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
        let fragmentShader = this.getShaderFromString(pixelShader, WebGLRenderingContext.FRAGMENT_SHADER);

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

        this.pMatrixUniform = this.gl.getUniformLocation(shaderProgram, "uPMatrix");
        this.mvMatrixUniform = this.gl.getUniformLocation(shaderProgram, "uMVMatrix");

        this.MinValUniform = this.gl.getUniformLocation(shaderProgram, "uMinVal");
        this.MaxValUniform = this.gl.getUniformLocation(shaderProgram, "uMaxVal");
        this.BiasUniform = this.gl.getUniformLocation(shaderProgram, "uBias");
        this.ContrastUniform = this.gl.getUniformLocation(shaderProgram, "uContrast");
        this.ScaleTypeUniform = this.gl.getUniformLocation(shaderProgram, "uScaleType");

        this.ViewportSizeUniform = this.gl.getUniformLocation(shaderProgram, "uViewportSize");

        this.DataTexture = this.gl.getUniformLocation(shaderProgram, "uDataTexture");
        this.CmapTexture = this.gl.getUniformLocation(shaderProgram, "uCmapTexture");
        this.NumCmaps = this.gl.getUniformLocation(shaderProgram, "uNumCmaps");
        this.CmapIndex = this.gl.getUniformLocation(shaderProgram, "uCmapIndex");
        this.gl.uniform1i(this.DataTexture, 0);
        this.gl.uniform1i(this.CmapTexture, 1);
        this.gl.uniform1i(this.NumCmaps, 79);
        this.gl.uniform1i(this.CmapIndex, 41);
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