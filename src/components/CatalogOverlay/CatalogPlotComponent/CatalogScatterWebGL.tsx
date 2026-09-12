import * as React from "react";
import {Colors} from "@blueprintjs/core";
import {type ChartArea} from "chart.js";

import {getShaderProgram, GL2} from "utilities";

const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 aPosition;
in float aSelected;

uniform vec4 uViewport;
uniform vec4 uDataViewport;
uniform vec2 uCanvasSize;
uniform float uPointSize;

out float vSelected;

void main() {
    vSelected = aSelected;
    vec2 normalized;
    normalized.x = (aPosition.x - uDataViewport.x) / uDataViewport.z;
    normalized.y = (aPosition.y - uDataViewport.y) / uDataViewport.w;
    vec2 pixel;
    pixel.x = uViewport.x + normalized.x * uViewport.z;
    pixel.y = uViewport.y + (1.0 - normalized.y) * uViewport.w;
    pixel.y = uCanvasSize.y - pixel.y;
    vec2 clip = (pixel / uCanvasSize) * 2.0 - 1.0;
    gl_Position = vec4(clip, aSelected > 0.5 ? -1.0 : 0.0, 1.0);
    gl_PointSize = uPointSize;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec4 uColor;
uniform vec4 uSelectedColor;

in float vSelected;
out vec4 fragColor;

void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;
    fragColor = vSelected > 0.5 ? uSelectedColor : uColor;
}`;

interface CatalogScatterWebGLProps {
    width: number;
    height: number;
    chartArea: ChartArea | undefined;
    xData: ArrayLike<number>;
    yData: ArrayLike<number>;
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    selectedIndices: Set<number>;
    hasSelection: boolean;
    pointSize?: number;
    onRef?: (ref: CatalogScatterWebGL | null) => void;
}

function parseColor(hex: string): [number, number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, 1.0];
}

export class CatalogScatterWebGL extends React.Component<CatalogScatterWebGLProps> {
    public canvasRef = React.createRef<HTMLCanvasElement>();
    public gl: WebGL2RenderingContext | null = null;
    private shaderProgram: WebGLProgram | null = null;
    private positionBuffer: WebGLBuffer | null = null;
    private selectedBuffer: WebGLBuffer | null = null;
    private uniforms: Record<string, WebGLUniformLocation | null> = {};
    private positionData: Float32Array = new Float32Array(0);
    private selectedData: Float32Array = new Float32Array(0);
    private previousXData: ArrayLike<number> | undefined;
    private previousYData: ArrayLike<number> | undefined;
    private positionOriginX = 0;
    private positionOriginY = 0;
    private previousSelectedIndices: Set<number> | undefined;

    componentDidMount() {
        const canvas = this.canvasRef.current;
        if (canvas) {
            canvas.addEventListener("webglcontextlost", this.onContextLost);
            canvas.addEventListener("webglcontextrestored", this.onContextRestored);
        }
        this.initGL();
        this.draw();
        this.props.onRef?.(this);
    }

    shouldComponentUpdate(nextProps: CatalogScatterWebGLProps) {
        return (
            this.props.width !== nextProps.width ||
            this.props.height !== nextProps.height ||
            this.props.chartArea !== nextProps.chartArea ||
            this.props.xData !== nextProps.xData ||
            this.props.yData !== nextProps.yData ||
            this.props.xMin !== nextProps.xMin ||
            this.props.xMax !== nextProps.xMax ||
            this.props.yMin !== nextProps.yMin ||
            this.props.yMax !== nextProps.yMax ||
            this.props.hasSelection !== nextProps.hasSelection ||
            this.props.pointSize !== nextProps.pointSize ||
            !this.hasSameSelectedIndices(nextProps.selectedIndices)
        );
    }

    componentDidUpdate() {
        this.draw();
    }

    componentWillUnmount() {
        this.props.onRef?.(null);
        const canvas = this.canvasRef.current;
        if (canvas) {
            canvas.removeEventListener("webglcontextlost", this.onContextLost);
            canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
        }
        const gl = this.gl;
        if (gl) {
            if (this.positionBuffer) {
                gl.deleteBuffer(this.positionBuffer);
            }
            if (this.selectedBuffer) {
                gl.deleteBuffer(this.selectedBuffer);
            }
            if (this.shaderProgram) {
                gl.deleteProgram(this.shaderProgram);
            }
        }
    }

    private onContextLost = (event: Event) => {
        event.preventDefault();
        this.gl = null;
        this.shaderProgram = null;
        this.positionBuffer = null;
        this.selectedBuffer = null;
    };

    private onContextRestored = () => {
        this.initGL();
        this.draw();
    };

    private initGL() {
        const canvas = this.canvasRef.current;
        if (!canvas) {
            return;
        }

        const gl = canvas.getContext("webgl2", {alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true});
        if (!gl) {
            console.error("WebGL2 not available for catalog scatter");
            return;
        }

        this.gl = gl;
        this.shaderProgram = getShaderProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
        if (!this.shaderProgram) {
            return;
        }

        gl.useProgram(this.shaderProgram);

        this.uniforms = {
            uViewport: gl.getUniformLocation(this.shaderProgram, "uViewport"),
            uDataViewport: gl.getUniformLocation(this.shaderProgram, "uDataViewport"),
            uCanvasSize: gl.getUniformLocation(this.shaderProgram, "uCanvasSize"),
            uPointSize: gl.getUniformLocation(this.shaderProgram, "uPointSize"),
            uColor: gl.getUniformLocation(this.shaderProgram, "uColor"),
            uSelectedColor: gl.getUniformLocation(this.shaderProgram, "uSelectedColor")
        };

        this.positionBuffer = gl.createBuffer();
        this.selectedBuffer = gl.createBuffer();
        this.positionData = new Float32Array(0);
        this.selectedData = new Float32Array(0);
        this.previousXData = undefined;
        this.previousYData = undefined;
        this.positionOriginX = 0;
        this.positionOriginY = 0;
        this.previousSelectedIndices = undefined;
    }

    private hasSameSelectedIndices = (selectedIndices: Set<number>) => {
        const previous = this.previousSelectedIndices;
        if (!previous || previous.size !== selectedIndices.size) {
            return false;
        }
        for (const index of selectedIndices) {
            if (!previous.has(index)) {
                return false;
            }
        }
        return true;
    };

    public draw() {
        const {gl, shaderProgram} = this;
        const {width, height, chartArea, xData, yData, xMin, xMax, yMin, yMax, selectedIndices, pointSize} = this.props;

        if (!gl || !shaderProgram || !chartArea || !xData?.length || !yData?.length) {
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const canvas = this.canvasRef.current;
        if (!canvas) {
            return;
        }

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(GL2.COLOR_BUFFER_BIT | GL2.DEPTH_BUFFER_BIT);
        gl.useProgram(shaderProgram);

        gl.enable(GL2.BLEND);
        gl.blendFunc(GL2.SRC_ALPHA, GL2.ONE_MINUS_SRC_ALPHA);
        gl.enable(GL2.DEPTH_TEST);
        gl.depthFunc(GL2.LEQUAL);

        const xRange = xMax - xMin;
        const yRange = yMax - yMin;
        if (!Number.isFinite(xRange) || !Number.isFinite(yRange) || xRange <= 0 || yRange <= 0) {
            return;
        }

        const numPoints = Math.min(xData.length, yData.length);
        const isPositionChanged = this.previousXData !== xData || this.previousYData !== yData || this.positionData.length !== numPoints * 2;
        if (isPositionChanged) {
            let hasXOrigin = false;
            let hasYOrigin = false;
            this.positionOriginX = 0;
            this.positionOriginY = 0;
            for (let i = 0; i < numPoints; i++) {
                if (!hasXOrigin && Number.isFinite(xData[i])) {
                    this.positionOriginX = xData[i];
                    hasXOrigin = true;
                }
                if (!hasYOrigin && Number.isFinite(yData[i])) {
                    this.positionOriginY = yData[i];
                    hasYOrigin = true;
                }
                if (hasXOrigin && hasYOrigin) {
                    break;
                }
            }
            this.positionData = new Float32Array(numPoints * 2);
            for (let i = 0; i < numPoints; i++) {
                this.positionData[i * 2] = xData[i] - this.positionOriginX;
                this.positionData[i * 2 + 1] = yData[i] - this.positionOriginY;
            }
            this.previousXData = xData;
            this.previousYData = yData;
        }

        gl.bindBuffer(GL2.ARRAY_BUFFER, this.positionBuffer);
        if (isPositionChanged) {
            gl.bufferData(GL2.ARRAY_BUFFER, this.positionData, GL2.DYNAMIC_DRAW);
        }
        const posLoc = gl.getAttribLocation(shaderProgram, "aPosition");
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, GL2.FLOAT, false, 0, 0);

        const isSelectionChanged = !this.hasSameSelectedIndices(selectedIndices) || this.selectedData.length !== numPoints;
        if (isSelectionChanged) {
            this.selectedData = new Float32Array(numPoints);
            for (let i = 0; i < numPoints; i++) {
                this.selectedData[i] = selectedIndices.has(i) ? 1.0 : 0.0;
            }
            this.previousSelectedIndices = new Set(selectedIndices);
        }
        gl.bindBuffer(GL2.ARRAY_BUFFER, this.selectedBuffer);
        if (isSelectionChanged) {
            gl.bufferData(GL2.ARRAY_BUFFER, this.selectedData, GL2.DYNAMIC_DRAW);
        }
        const selLoc = gl.getAttribLocation(shaderProgram, "aSelected");
        gl.enableVertexAttribArray(selLoc);
        gl.vertexAttribPointer(selLoc, 1, GL2.FLOAT, false, 0, 0);

        const viewLeft = chartArea.left * dpr;
        const viewTop = chartArea.top * dpr;
        const viewWidth = (chartArea.right - chartArea.left) * dpr;
        const viewHeight = (chartArea.bottom - chartArea.top) * dpr;
        gl.uniform4f(this.uniforms.uViewport, viewLeft, viewTop, viewWidth, viewHeight);
        gl.uniform4f(this.uniforms.uDataViewport, xMin - this.positionOriginX, yMin - this.positionOriginY, xRange, yRange);
        gl.uniform2f(this.uniforms.uCanvasSize, canvas.width, canvas.height);
        gl.uniform1f(this.uniforms.uPointSize, (pointSize ?? 5) * dpr);

        const blueColor = parseColor(Colors.BLUE2);
        const redColor = parseColor(Colors.RED2);
        if (this.props.hasSelection) {
            blueColor[3] = 0.7;
        }
        gl.uniform4fv(this.uniforms.uColor, blueColor);
        gl.uniform4fv(this.uniforms.uSelectedColor, redColor);

        gl.enable(GL2.SCISSOR_TEST);
        gl.scissor(Math.floor(viewLeft), Math.floor(canvas.height - viewTop - viewHeight), Math.ceil(viewWidth), Math.ceil(viewHeight));

        gl.drawArrays(GL2.POINTS, 0, numPoints);

        gl.disable(GL2.SCISSOR_TEST);
        gl.disable(GL2.BLEND);
        gl.disable(GL2.DEPTH_TEST);
    }

    render() {
        const {width, height} = this.props;
        return (
            <canvas
                ref={this.canvasRef}
                data-overlay="true"
                width={width * (window.devicePixelRatio || 1)}
                height={height * (window.devicePixelRatio || 1)}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    zIndex: 0,
                    width,
                    height,
                    pointerEvents: "none"
                }}
            />
        );
    }
}
