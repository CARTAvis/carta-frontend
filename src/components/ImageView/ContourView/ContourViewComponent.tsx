import {observer} from "mobx-react";
import * as React from "react";
import {AppStore, FrameStore, OverlayStore, PreferenceStore, RenderConfigStore} from "stores";
import {getShaderFromString, loadImageTexture} from "utilities";
import "./ContourViewComponent.css";
import allMaps from "static/allmaps.png";

const vertexShaderLine = require("!raw-loader!./GLSL/vert_line.glsl");
const pixelShaderDashed = require("!raw-loader!./GLSL/pixel_dashed.glsl");

export interface ContourViewComponentProps {
    overlaySettings: OverlayStore;
    preference: PreferenceStore;
    appStore: AppStore;
    docked: boolean;
}

interface ShaderUniforms {
    Scale: WebGLUniformLocation;
    Offset: WebGLUniformLocation;
    DashLength: WebGLUniformLocation;
    LineColor: WebGLUniformLocation;
    LineThickness: WebGLUniformLocation;
    CmapEnabled: WebGLUniformLocation;
    CmapValue: WebGLUniformLocation;
    CmapTexture: WebGLUniformLocation;
    NumCmaps: WebGLUniformLocation;
    CmapIndex: WebGLUniformLocation;
}

@observer
export class ContourViewComponent extends React.Component<ContourViewComponentProps> {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private cmapTexture: WebGLTexture;

    // Shader attribute handles
    private vertexPositionAttribute: number;
    private vertexNormalAttribute: number;
    private shaderUniforms: ShaderUniforms;

    componentDidMount() {
        if (this.canvas) {
            try {
                this.gl = this.canvas.getContext("webgl");
                if (!this.gl) {
                    return;
                }
                this.props.appStore.ContourContext = this.gl;
                this.gl.getExtension("OES_element_index_uint");
            } catch (e) {
                console.log(e);
            }
            if (!this.gl) {
                console.log("Could not initialise WebGL");
            }

            this.initShaders();
            loadImageTexture(this.gl, allMaps, WebGLRenderingContext.TEXTURE1).then(texture => {
                this.cmapTexture = texture;
                this.updateCanvas();
            });
        }
    }

    componentDidUpdate() {
        requestAnimationFrame(this.updateCanvas);
    }

    private resizeAndClearCanvas() {
        const frame = this.props.appStore.activeFrame;
        if (!frame) {
            return;
        }

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
        const frame = this.props.appStore.activeFrame;
        if (frame && this.canvas && this.gl && this.shaderUniforms) {
            this.resizeAndClearCanvas();

            const fullWidth = frame.requiredFrameView.xMax - frame.requiredFrameView.xMin;
            const fullHeight = frame.requiredFrameView.yMax - frame.requiredFrameView.yMin;
            const scale = {x: 2.0 / fullWidth, y: 2.0 / fullHeight};
            const offset = {x: -1.0 - frame.requiredFrameView.xMin * scale.x, y: -1.0 - frame.requiredFrameView.yMin * scale.y};
            // update uniforms
            this.gl.uniform2f(this.shaderUniforms.Scale, scale.x, scale.y);
            this.gl.uniform2f(this.shaderUniforms.Offset, offset.x, offset.y);
            this.gl.uniform1f(this.shaderUniforms.LineThickness, devicePixelRatio * this.props.preference.contourThickness / frame.zoomLevel);
            this.gl.uniform1i(this.shaderUniforms.CmapIndex, RenderConfigStore.COLOR_MAPS_ALL.indexOf(this.props.preference.contourColormap));

            // Calculates ceiling power-of-three value as a dash factor. Not sure if this is needed
            const dashFactor = Math.pow(3.0, Math.ceil(Math.log(1.0 / frame.zoomLevel) / Math.log(3)));
            if (frame.contourStores) {
                const levels = [];
                frame.contourStores.forEach((v, level) => levels.push(level));
                const minVal = Math.min(...levels);
                const maxVal = Math.max(...levels);

                const color = frame.contourConfig.color;
                if (color) {
                    this.gl.uniform4f(this.shaderUniforms.LineColor, color.r / 255.0, color.g / 255.0, color.b / 255.0, color.a || 1.0);
                } else {
                    this.gl.uniform4f(this.shaderUniforms.LineColor, 1, 1, 1, 1);
                }
                this.gl.uniform1i(this.shaderUniforms.CmapEnabled, frame.contourConfig.colormapEnabled ? 1 : 0);

                // Dash length in canvas pixels
                // const dashLength = level <= 0 ? 5 : 0;
                const dashLength = 0;
                this.gl.uniform1f(this.shaderUniforms.DashLength, devicePixelRatio * dashLength);

                frame.contourStores.forEach((contourStore, level) => {
                    let levelFraction: number;
                    if (minVal !== maxVal) {
                        levelFraction = (level - minVal) / (maxVal - minVal);
                    } else {
                        levelFraction = 1.0;
                    }

                    this.gl.uniform1f(this.shaderUniforms.CmapValue, levelFraction);
                    // Update buffers
                    for (let i = 0; i < contourStore.chunkCount; i++) {
                        contourStore.generateBuffers(i);
                        const numIndices = contourStore.numIndices[i];

                        this.gl.vertexAttribPointer(this.vertexPositionAttribute, 3, WebGLRenderingContext.FLOAT, false, 16, 0);
                        this.gl.vertexAttribPointer(this.vertexNormalAttribute, 2, WebGLRenderingContext.SHORT, false, 16, 12);

                        // Render all poly-lines in this chunk using the vertex buffer and index buffer
                        // If the number of indices is stored as a -ve, use UNSIGNED_SHORT instead of UNSIGNED_INT
                        if (numIndices < 0) {
                            this.gl.drawElements(WebGLRenderingContext.TRIANGLES, -numIndices, WebGLRenderingContext.UNSIGNED_SHORT, 0);
                        } else {
                            this.gl.drawElements(WebGLRenderingContext.TRIANGLES, numIndices, WebGLRenderingContext.UNSIGNED_INT, 0);
                        }
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
        this.vertexNormalAttribute = this.gl.getAttribLocation(shaderProgram, "aVertexNormal");
        this.gl.enableVertexAttribArray(this.vertexNormalAttribute);

        this.shaderUniforms = {
            Scale: this.gl.getUniformLocation(shaderProgram, "uScale"),
            Offset: this.gl.getUniformLocation(shaderProgram, "uOffset"),
            DashLength: this.gl.getUniformLocation(shaderProgram, "uDashLength"),
            LineColor: this.gl.getUniformLocation(shaderProgram, "uLineColor"),
            LineThickness: this.gl.getUniformLocation(shaderProgram, "uLineThickness"),
            CmapEnabled: this.gl.getUniformLocation(shaderProgram, "uCmapEnabled"),
            CmapValue: this.gl.getUniformLocation(shaderProgram, "uCmapValue"),
            CmapTexture: this.gl.getUniformLocation(shaderProgram, "uCmapTexture"),
            NumCmaps: this.gl.getUniformLocation(shaderProgram, "uNumCmaps"),
            CmapIndex: this.gl.getUniformLocation(shaderProgram, "uCmapIndex"),
        };

        this.gl.uniform1i(this.shaderUniforms.NumCmaps, 79);
        this.gl.uniform1i(this.shaderUniforms.CmapTexture, 1);
    }

    render() {
        // dummy values to trigger React's componentDidUpdate()
        const frame = this.props.appStore.activeFrame;
        if (frame) {
            const view = frame.requiredFrameView;
            const contourData = frame.contourStores;
            const config = frame.contourConfig;
            contourData.forEach(contourStore => {
                const numVertices = contourStore.vertexCount;
            });
            const thickness = this.props.preference.contourThickness;
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