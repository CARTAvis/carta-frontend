import * as React from "react";
import {Colors} from "@blueprintjs/core";
import {type ChartArea} from "chart.js";

import {getShaderProgram, GL2} from "utilities";

const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 aPosition;
in float aSelected;

uniform vec2 uRangeMin;
uniform vec2 uRangeMax;
uniform vec4 uViewport;
uniform vec2 uCanvasSize;
uniform float uPointSize;

out float vSelected;

void main() {
    vSelected = aSelected;
    vec2 normalized = (aPosition - uRangeMin) / (uRangeMax - uRangeMin);
    vec2 pixel;
    pixel.x = uViewport.x + normalized.x * uViewport.z;
    pixel.y = uViewport.y + (1.0 - normalized.y) * uViewport.w;
    pixel.y = uCanvasSize.y - pixel.y;
    vec2 clip = (pixel / uCanvasSize) * 2.0 - 1.0;
    gl_Position = vec4(clip, 0.0, 1.0);
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
    xData: number[];
    yData: number[];
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    selectedIndices: Set<number>;
    hasSelection: boolean;
    pointSize?: number;
    darkMode?: boolean;
}

function parseColor(hex: string): [number, number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, 1.0];
}

export class CatalogScatterWebGL extends React.Component<CatalogScatterWebGLProps> {
    private canvasRef = React.createRef<HTMLCanvasElement>();
    private gl: WebGL2RenderingContext | null = null;
    private shaderProgram: WebGLProgram | null = null;
    private positionBuffer: WebGLBuffer | null = null;
    private selectedBuffer: WebGLBuffer | null = null;
    private uniforms: Record<string, WebGLUniformLocation | null> = {};

    componentDidMount() {
        this.initGL();
        this.draw();
    }

    componentDidUpdate() {
        this.draw();
    }

    componentWillUnmount() {
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

    private initGL() {
        const canvas = this.canvasRef.current;
        if (!canvas) {
            return;
        }

        const gl = canvas.getContext("webgl2", {alpha: true, premultipliedAlpha: false});
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
            uRangeMin: gl.getUniformLocation(this.shaderProgram, "uRangeMin"),
            uRangeMax: gl.getUniformLocation(this.shaderProgram, "uRangeMax"),
            uViewport: gl.getUniformLocation(this.shaderProgram, "uViewport"),
            uCanvasSize: gl.getUniformLocation(this.shaderProgram, "uCanvasSize"),
            uPointSize: gl.getUniformLocation(this.shaderProgram, "uPointSize"),
            uColor: gl.getUniformLocation(this.shaderProgram, "uColor"),
            uSelectedColor: gl.getUniformLocation(this.shaderProgram, "uSelectedColor")
        };

        this.positionBuffer = gl.createBuffer();
        this.selectedBuffer = gl.createBuffer();
    }

    private draw() {
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
        gl.clear(GL2.COLOR_BUFFER_BIT);
        gl.useProgram(shaderProgram);

        gl.enable(GL2.BLEND);
        gl.blendFunc(GL2.SRC_ALPHA, GL2.ONE_MINUS_SRC_ALPHA);

        // Upload position data (interleaved x, y)
        const numPoints = Math.min(xData.length, yData.length);
        const positionData = new Float32Array(numPoints * 2);
        const selectedData = new Float32Array(numPoints);
        for (let i = 0; i < numPoints; i++) {
            positionData[i * 2] = xData[i];
            positionData[i * 2 + 1] = yData[i];
            selectedData[i] = selectedIndices.has(i) ? 1.0 : 0.0;
        }

        // Position attribute
        gl.bindBuffer(GL2.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(GL2.ARRAY_BUFFER, positionData, GL2.DYNAMIC_DRAW);
        const posLoc = gl.getAttribLocation(shaderProgram, "aPosition");
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, GL2.FLOAT, false, 0, 0);

        // Selected attribute
        gl.bindBuffer(GL2.ARRAY_BUFFER, this.selectedBuffer);
        gl.bufferData(GL2.ARRAY_BUFFER, selectedData, GL2.DYNAMIC_DRAW);
        const selLoc = gl.getAttribLocation(shaderProgram, "aSelected");
        gl.enableVertexAttribArray(selLoc);
        gl.vertexAttribPointer(selLoc, 1, GL2.FLOAT, false, 0, 0);

        // Uniforms
        gl.uniform2f(this.uniforms.uRangeMin, xMin, yMin);
        gl.uniform2f(this.uniforms.uRangeMax, xMax, yMax);

        // Viewport in CSS-pixel coordinates, scaled by DPR
        const viewLeft = chartArea.left * dpr;
        const viewTop = chartArea.top * dpr;
        const viewWidth = (chartArea.right - chartArea.left) * dpr;
        const viewHeight = (chartArea.bottom - chartArea.top) * dpr;
        gl.uniform4f(this.uniforms.uViewport, viewLeft, viewTop, viewWidth, viewHeight);
        gl.uniform2f(this.uniforms.uCanvasSize, canvas.width, canvas.height);
        gl.uniform1f(this.uniforms.uPointSize, (pointSize ?? 5) * dpr);

        const blueColor = parseColor(Colors.BLUE2);
        const redColor = parseColor(Colors.RED2);
        if (this.props.hasSelection) {
            blueColor[3] = 0.9;
        }
        gl.uniform4fv(this.uniforms.uColor, blueColor);
        gl.uniform4fv(this.uniforms.uSelectedColor, redColor);

        // Enable scissor test to clip to chart area
        gl.enable(GL2.SCISSOR_TEST);
        gl.scissor(Math.floor(viewLeft), Math.floor(canvas.height - viewTop - viewHeight), Math.ceil(viewWidth), Math.ceil(viewHeight));

        gl.drawArrays(GL2.POINTS, 0, numPoints);

        gl.disable(GL2.SCISSOR_TEST);
        gl.disable(GL2.BLEND);
    }

    render() {
        const {width, height} = this.props;
        return (
            <canvas
                ref={this.canvasRef}
                width={width * (window.devicePixelRatio || 1)}
                height={height * (window.devicePixelRatio || 1)}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width,
                    height,
                    pointerEvents: "none"
                }}
            />
        );
    }
}
