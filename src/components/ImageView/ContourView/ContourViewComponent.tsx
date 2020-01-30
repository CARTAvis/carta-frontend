import {observer} from "mobx-react";
import * as React from "react";
import {AppStore, ContourDashMode, FrameStore, OverlayStore, RenderConfigStore} from "stores";
import {getShaderFromString, GL, loadImageTexture} from "utilities";
import "./ContourViewComponent.css";
import allMaps from "static/allmaps.png";

const vertexShaderLine = require("!raw-loader!./GLSL/vert_line.glsl");
const pixelShaderDashed = require("!raw-loader!./GLSL/pixel_dashed.glsl");

export interface ContourViewComponentProps {
    overlaySettings: OverlayStore;
    appStore: AppStore;
    docked: boolean;
}

interface ShaderUniforms {
    FrameMin: WebGLUniformLocation;
    FrameMax: WebGLUniformLocation;
    RotationOrigin: WebGLUniformLocation;
    RotationAngle: WebGLUniformLocation;
    ScaleAdjustment: WebGLUniformLocation;
    Offset: WebGLUniformLocation;
    DashLength: WebGLUniformLocation;
    LineColor: WebGLUniformLocation;
    LineThickness: WebGLUniformLocation;
    CmapEnabled: WebGLUniformLocation;
    CmapValue: WebGLUniformLocation;
    CmapTexture: WebGLUniformLocation;
    NumCmaps: WebGLUniformLocation;
    CmapIndex: WebGLUniformLocation;
    Bias: WebGLUniformLocation;
    Contrast: WebGLUniformLocation;
    ControlMapEnabled: WebGLUniformLocation;
    ControlMapTextureX: WebGLUniformLocation;
    ControlMapTextureY: WebGLUniformLocation;
    ControlMapMin: WebGLUniformLocation;
    ControlMapMax: WebGLUniformLocation;
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
            } catch (e) {
                console.log(e);
            }
            if (!this.gl) {
                console.log("Could not initialise WebGL");
            }

            const extTextureFloat = this.gl.getExtension("OES_texture_float");
            // TODO: manual bilinear or bicubic sampling to avoid this extension
            const extTextureFloatLinear = this.gl.getExtension("OES_texture_float_linear");

            this.initShaders();
            loadImageTexture(this.gl, allMaps, WebGLRenderingContext.TEXTURE0).then(texture => {
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

        const reqWidth = Math.max(1, frame.renderWidth * devicePixelRatio);
        const reqHeight = Math.max(1, frame.renderHeight * devicePixelRatio);
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
            this.renderFrameContours(frame, true);
            if (frame.secondaryImages) {
                for (const secondaryFrame of frame.secondaryImages) {
                    this.renderFrameContours(secondaryFrame, false);
                }
            }
        }
    };

    private renderFrameContours = (frame: FrameStore, isActive: boolean) => {
        const zoomLevel = frame.spatialReference ? frame.spatialReference.zoomLevel * frame.spatialTransform.scale : frame.zoomLevel;

        // update uniforms
        this.gl.uniform1f(this.shaderUniforms.LineThickness, devicePixelRatio * frame.contourConfig.thickness / zoomLevel);
        this.gl.uniform1i(this.shaderUniforms.CmapEnabled, frame.contourConfig.colormapEnabled ? 1 : 0);
        if (frame.contourConfig.colormapEnabled) {
            this.gl.uniform1i(this.shaderUniforms.CmapIndex, RenderConfigStore.COLOR_MAPS_ALL.indexOf(frame.contourConfig.colormap));
            this.gl.uniform1f(this.shaderUniforms.Bias, frame.contourConfig.colormapBias);
            this.gl.uniform1f(this.shaderUniforms.Contrast, frame.contourConfig.colormapContrast);
        }

        if (isActive) {
            this.gl.uniform1i(this.shaderUniforms.ControlMapEnabled, 0);
            this.gl.uniform1i(this.shaderUniforms.ControlMapTextureX, 0);
            this.gl.uniform1i(this.shaderUniforms.ControlMapTextureY, 0);

            if (frame.spatialReference) {
                let rotationOrigin = frame.spatialTransform.origin;
                this.gl.uniform2f(this.shaderUniforms.FrameMin, frame.spatialReference.requiredFrameView.xMin, frame.spatialReference.requiredFrameView.yMin);
                this.gl.uniform2f(this.shaderUniforms.FrameMax, frame.spatialReference.requiredFrameView.xMax, frame.spatialReference.requiredFrameView.yMax);
                this.gl.uniform2f(this.shaderUniforms.RotationOrigin, rotationOrigin.x, rotationOrigin.y);
                this.gl.uniform1f(this.shaderUniforms.RotationAngle, -frame.spatialTransform.rotation);
                this.gl.uniform1f(this.shaderUniforms.ScaleAdjustment, frame.spatialTransform.scale);
                this.gl.uniform2f(this.shaderUniforms.Offset, frame.spatialTransform.translation.x, frame.spatialTransform.translation.y);
            } else {
                this.gl.uniform2f(this.shaderUniforms.FrameMin, frame.requiredFrameView.xMin, frame.requiredFrameView.yMin);
                this.gl.uniform2f(this.shaderUniforms.FrameMax, frame.requiredFrameView.xMax, frame.requiredFrameView.yMax);
                this.gl.uniform1f(this.shaderUniforms.RotationAngle, 0.0);
                this.gl.uniform1f(this.shaderUniforms.ScaleAdjustment, 1.0);
                this.gl.uniform2f(this.shaderUniforms.Offset, 0, 0);
            }
        } else {
            const controlMap = frame.controlMaps.get(frame.spatialReference);
            this.gl.uniform1i(this.shaderUniforms.ControlMapEnabled, 1);
            this.gl.uniform2f(this.shaderUniforms.ControlMapMin, controlMap.minPoint.x, controlMap.minPoint.y);
            this.gl.uniform2f(this.shaderUniforms.ControlMapMax, controlMap.maxPoint.x, controlMap.maxPoint.y);
            this.gl.activeTexture(GL.TEXTURE1);
            this.gl.bindTexture(GL.TEXTURE_2D, controlMap.getTextureX(this.gl));
            this.gl.uniform1i(this.shaderUniforms.ControlMapTextureX, 1);
            this.gl.activeTexture(GL.TEXTURE2);
            this.gl.bindTexture(GL.TEXTURE_2D, controlMap.getTextureY(this.gl));
            this.gl.uniform1i(this.shaderUniforms.ControlMapTextureY, 2);

            this.gl.uniform2f(this.shaderUniforms.FrameMin, frame.spatialReference.requiredFrameView.xMin, frame.spatialReference.requiredFrameView.yMin);
            this.gl.uniform2f(this.shaderUniforms.FrameMax, frame.spatialReference.requiredFrameView.xMax, frame.spatialReference.requiredFrameView.yMax);
            this.gl.uniform1f(this.shaderUniforms.RotationAngle, 0.0);
            this.gl.uniform1f(this.shaderUniforms.ScaleAdjustment, 1.0);
            this.gl.uniform2f(this.shaderUniforms.Offset, 0, 0);
        }

        // Calculates ceiling power-of-three value as a dash factor.
        const dashFactor = Math.pow(3.0, Math.ceil(Math.log(1.0 / zoomLevel) / Math.log(3)));
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

            frame.contourStores.forEach((contourStore, level) => {
                if (frame.contourConfig.colormapEnabled) {
                    let levelFraction: number;
                    if (minVal !== maxVal) {
                        levelFraction = (level - minVal) / (maxVal - minVal);
                    } else {
                        levelFraction = 1.0;
                    }
                    this.gl.uniform1f(this.shaderUniforms.CmapValue, levelFraction);
                }

                // Dash length in canvas pixels
                const dashMode = frame.contourConfig.dashMode;
                const dashLength = (dashMode === ContourDashMode.Dashed || (dashMode === ContourDashMode.NegativeOnly && level < 0)) ? 8 : 0;
                this.gl.uniform1f(this.shaderUniforms.DashLength, devicePixelRatio * dashLength * dashFactor);

                // Update buffers
                for (let i = 0; i < contourStore.chunkCount; i++) {
                    contourStore.bindBuffer(i);
                    const numVertices = contourStore.numGeneratedVertices[i];
                    this.gl.vertexAttribPointer(this.vertexPositionAttribute, 3, WebGLRenderingContext.FLOAT, false, 16, 0);
                    this.gl.vertexAttribPointer(this.vertexNormalAttribute, 2, WebGLRenderingContext.SHORT, false, 16, 12);
                    this.gl.drawArrays(WebGLRenderingContext.TRIANGLE_STRIP, 0, numVertices);
                }
            });
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
            FrameMin: this.gl.getUniformLocation(shaderProgram, "uFrameMin"),
            FrameMax: this.gl.getUniformLocation(shaderProgram, "uFrameMax"),
            ScaleAdjustment: this.gl.getUniformLocation(shaderProgram, "uScaleAdjustment"),
            RotationOrigin: this.gl.getUniformLocation(shaderProgram, "uRotationOrigin"),
            RotationAngle: this.gl.getUniformLocation(shaderProgram, "uRotationAngle"),
            Offset: this.gl.getUniformLocation(shaderProgram, "uOffset"),
            DashLength: this.gl.getUniformLocation(shaderProgram, "uDashLength"),
            LineColor: this.gl.getUniformLocation(shaderProgram, "uLineColor"),
            LineThickness: this.gl.getUniformLocation(shaderProgram, "uLineThickness"),
            CmapEnabled: this.gl.getUniformLocation(shaderProgram, "uCmapEnabled"),
            CmapValue: this.gl.getUniformLocation(shaderProgram, "uCmapValue"),
            CmapTexture: this.gl.getUniformLocation(shaderProgram, "uCmapTexture"),
            NumCmaps: this.gl.getUniformLocation(shaderProgram, "uNumCmaps"),
            CmapIndex: this.gl.getUniformLocation(shaderProgram, "uCmapIndex"),
            Contrast: this.gl.getUniformLocation(shaderProgram, "uContrast"),
            Bias: this.gl.getUniformLocation(shaderProgram, "uBias"),
            ControlMapEnabled: this.gl.getUniformLocation(shaderProgram, "uControlMapEnabled"),
            ControlMapMin: this.gl.getUniformLocation(shaderProgram, "uControlMapMin"),
            ControlMapMax: this.gl.getUniformLocation(shaderProgram, "uControlMapMax"),
            ControlMapTextureX: this.gl.getUniformLocation(shaderProgram, "uControlMapTextureX"),
            ControlMapTextureY: this.gl.getUniformLocation(shaderProgram, "uControlMapTextureY")
        };

        this.gl.uniform1i(this.shaderUniforms.NumCmaps, 79);
        this.gl.uniform1i(this.shaderUniforms.CmapTexture, 0);
    }

    render() {
        // dummy values to trigger React's componentDidUpdate()
        const frame = this.props.appStore.activeFrame;
        if (frame) {
            const view = frame.requiredFrameView;
            const contourData = frame.contourStores;
            const config = frame.contourConfig;
            const thickness = config.thickness;
            const color = config.colormapEnabled ? config.colormap : config.color;
            const dashMode = config.dashMode;
            const bias = config.colormapBias;
            const contrast = config.colormapContrast;

            contourData.forEach(contourStore => {
                const numVertices = contourStore.vertexCount;
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
                        width: frame ? frame.renderWidth || 1 : 1,
                        height: frame ? frame.renderHeight || 1 : 1
                    }}
                />
            </div>);
    }
}