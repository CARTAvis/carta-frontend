import {observer} from "mobx-react";
import * as React from "react";
import {FrameStore, OverlayStore, PreferenceStore} from "stores";
import {getShaderFromString, hexStringToRgba} from "utilities";
import "./ContourViewComponent.css";

const vertexShaderLine = require("!raw-loader!./GLSL/vert_line.glsl");
const pixelShaderDashed = require("!raw-loader!./GLSL/pixel_dashed.glsl");

export interface ContourViewComponentProps {
    overlaySettings: OverlayStore;
    preference: PreferenceStore;
    frame: FrameStore;
    docked: boolean;
}

@observer
export class ContourViewComponent extends React.Component<ContourViewComponentProps> {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    // GL buffers
    private vertexDataBuffer: WebGLBuffer;
    // Shader attribute handles
    private vertexPositionAttribute: number;
    // private vertexLengthAttribute: number;

    // Shader uniform handles
    private ScaleUniform: WebGLUniformLocation;
    private OffsetUniform: WebGLUniformLocation;
    private DashLengthUniform: WebGLUniformLocation;
    private LineColorUniform: WebGLUniformLocation;

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

            this.initShaders();
            this.initBuffers();
        }
    }

    componentDidUpdate() {
        requestAnimationFrame(this.updateCanvas);
    }

    private resizeAndClearCanvas() {
        const frame = this.props.frame;
        const reqWidth = frame.renderWidth * devicePixelRatio;
        const reqHeight = frame.renderHeight * devicePixelRatio;
        // Resize canvas if necessary
        if (this.canvas.width !== reqWidth || this.canvas.height !== reqHeight) {
            this.canvas.width = reqWidth;
            this.canvas.height = reqHeight;
            this.gl.viewport(0, 0, reqWidth, reqHeight);
        } else {
            // Otherwise just clear it
            this.gl.clear(WebGLRenderingContext.COLOR_BUFFER_BIT);
        }
    }

    private updateCanvas = () => {
        const frame = this.props.frame;
        if (frame && this.canvas && this.gl) {
            this.resizeAndClearCanvas();

            const fullWidth = frame.requiredFrameView.xMax - frame.requiredFrameView.xMin;
            const fullHeight = frame.requiredFrameView.yMax - frame.requiredFrameView.yMin;
            const scale = {x: 2.0 / fullWidth, y: 2.0 / fullHeight};
            const offset = {x: -1.0 - frame.requiredFrameView.xMin * scale.x, y: -1.0 - frame.requiredFrameView.yMin * scale.y};
            // update uniforms
            this.gl.uniform2f(this.ScaleUniform, scale.x, scale.y);
            this.gl.uniform2f(this.OffsetUniform, offset.x, offset.y);
            const color = frame.contourConfig.color;
            if (color) {
                this.gl.uniform4f(this.LineColorUniform, color.r / 255.0, color.g / 255.0, color.b / 255.0, color.a || 1.0);
            } else {
                this.gl.uniform4f(this.LineColorUniform, 1, 1, 1, 1);
            }

            if (frame.contourStores) {
                frame.contourStores.forEach((contourStore, level) => {

                    // Dash length in canvas pixels
                    const dashLength = 0;
                    const indices = contourStore.indices;
                    const vertexData = contourStore.vertexData;
                    const numIndices = indices.length;
                    // each vertex has x, y and length values
                    const numVertices = vertexData.length / 2;

                    this.gl.uniform1f(this.DashLengthUniform, dashLength);

                    // // Update buffer
                    this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexDataBuffer);
                    this.gl.bufferData(WebGLRenderingContext.ARRAY_BUFFER, vertexData, WebGLRenderingContext.STATIC_DRAW);

                    // render
                    for (let i = 0; i < numIndices; i++) {
                        const startIndex = indices[i] / 2;
                        let endIndex;
                        if (i === numIndices - 1) {
                            endIndex = numVertices;
                        } else {
                            endIndex = indices[i + 1] / 2;
                        }
                        const traceVertices = endIndex - startIndex;
                        this.gl.drawArrays(WebGLRenderingContext.LINE_STRIP, startIndex, traceVertices);
                    }
                });
            }
        }
    };

    private initShaders() {
        let vertexShader = getShaderFromString(this.gl, vertexShaderLine, WebGLRenderingContext.VERTEX_SHADER);
        let fragmentShader = getShaderFromString(this.gl, pixelShaderDashed, WebGLRenderingContext.FRAGMENT_SHADER);

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
        // this.vertexLengthAttribute = this.gl.getAttribLocation(shaderProgram, "aVertexLength");
        // this.gl.enableVertexAttribArray(this.vertexLengthAttribute);

        this.DashLengthUniform = this.gl.getUniformLocation(shaderProgram, "uDashLength");
        this.LineColorUniform = this.gl.getUniformLocation(shaderProgram, "uLineColor");
        this.ScaleUniform = this.gl.getUniformLocation(shaderProgram, "uScale");
        this.OffsetUniform = this.gl.getUniformLocation(shaderProgram, "uOffset");
    }

    private initBuffers() {
        this.vertexDataBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(WebGLRenderingContext.ARRAY_BUFFER, this.vertexDataBuffer);
        // First two floats of the array represent x and y positions. Last float represents cumulative length in the current line
        this.gl.vertexAttribPointer(this.vertexPositionAttribute, 2, WebGLRenderingContext.FLOAT, false, 0, 0);
        // this.gl.vertexAttribPointer(this.vertexLengthAttribute, 1, WebGLRenderingContext.FLOAT, false, 3 * 4, 2 * 4);
    }

    render() {
        // dummy values to trigger React's componentDidUpdate()
        const frame = this.props.frame;
        if (frame) {
            const view = frame.requiredFrameView;
            const contourData = frame.contourStores;
            contourData.forEach(contourStore => {
                const indices = contourStore.indices;
                const vertexData = contourStore.vertexData;
            });
        }
        const padding = this.props.overlaySettings.padding;
        let className = "contour-div";
        if (this.props.docked) {
            className += " docked";
        }
        return (
            <div className={className}>
                <canvas
                    className="contour-canvas"
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