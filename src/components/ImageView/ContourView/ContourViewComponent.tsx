import {observer} from "mobx-react";
import * as React from "react";
import {AppStore, ContourDashMode, FrameStore, OverlayStore, RenderConfigStore} from "stores";
import {ceilToPower, getShaderFromString, GL, loadImageTexture, rotate2D, scale2D, subtract2D} from "utilities";
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
    RangeScale: WebGLUniformLocation;
    RangeOffset: WebGLUniformLocation;
    RotationOrigin: WebGLUniformLocation;
    RotationAngle: WebGLUniformLocation;
    ScaleAdjustment: WebGLUniformLocation;
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
    ControlMapSize: WebGLUniformLocation;
    ControlMapTexture: WebGLUniformLocation;
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
                this.gl = this.canvas.getContext("webgl", {preserveDrawingBuffer: true});
                if (!this.gl) {
                    return;
                }
                this.props.appStore.ContourContext = this.gl;
            } catch (e) {
                console.log(e);
            }

            const extTextureFloat = this.gl.getExtension("OES_texture_float");

            if (!this.gl || !extTextureFloat) {
                console.error("Could not initialise WebGL");
            }

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

        const reqWidth = Math.round(Math.max(1, frame.renderWidth * devicePixelRatio));
        const reqHeight = Math.round(Math.max(1, frame.renderHeight * devicePixelRatio));
        // Resize canvas if necessary
        if (this.canvas.width !== reqWidth || this.canvas.height !== reqHeight) {
            this.canvas.width = reqWidth;
            this.canvas.height = reqHeight;
            this.gl.viewport(0, 0, reqWidth, reqHeight);
        }
        // Otherwise just clear it
        this.gl.clearColor(0, 0, 0, 0);
        const clearMask = WebGLRenderingContext.COLOR_BUFFER_BIT | WebGLRenderingContext.DEPTH_BUFFER_BIT | WebGLRenderingContext.STENCIL_BUFFER_BIT;
        this.gl.clear(clearMask);
    }

    private updateCanvas = () => {
        const baseFrame = this.props.appStore.activeFrame;
        const contourFrames = this.props.appStore.contourFrames;
        if (baseFrame && this.canvas && this.gl && this.shaderUniforms) {
            this.resizeAndClearCanvas();

            // Render back-to-front to preserve ordering
            for (let i = contourFrames.length - 1; i >= 0; --i) {
                this.renderFrameContours(contourFrames[i], baseFrame);
            }
        }
    };

    private renderFrameContours = (frame: FrameStore, baseFrame: FrameStore) => {
        const isActive = frame === baseFrame;
        let lineThickness: number;
        let dashFactor: number;

        if (baseFrame.spatialReference) {
            let rotationOrigin = baseFrame.spatialTransform.origin;
            const baseRequiredView = baseFrame.spatialReference.requiredFrameView;

            const rangeScale = {
                x: 1.0 / (baseRequiredView.xMax - baseRequiredView.xMin),
                y: 1.0 / (baseRequiredView.yMax - baseRequiredView.yMin),
            };

            // Instead of rotating and scaling about an origin on the GPU (float32), we take this out of the shader, and perform beforehand (float64, and consistent)
            const originAdjustedOffset = subtract2D(baseFrame.spatialTransform.origin, scale2D(rotate2D(baseFrame.spatialTransform.origin, baseFrame.spatialTransform.rotation), baseFrame.spatialTransform.scale));

            const rangeOffset = {
                x: (baseFrame.spatialTransform.translation.x - baseRequiredView.xMin + originAdjustedOffset.x) * rangeScale.x,
                y: (baseFrame.spatialTransform.translation.y - baseRequiredView.yMin + originAdjustedOffset.y) * rangeScale.y
            };

            this.gl.uniform2f(this.shaderUniforms.RangeScale, rangeScale.x, rangeScale.y);
            this.gl.uniform2f(this.shaderUniforms.RangeOffset, rangeOffset.x, rangeOffset.y);
            this.gl.uniform2f(this.shaderUniforms.RotationOrigin, rotationOrigin.x, rotationOrigin.y);
            this.gl.uniform1f(this.shaderUniforms.RotationAngle, -baseFrame.spatialTransform.rotation);
            this.gl.uniform1f(this.shaderUniforms.ScaleAdjustment, baseFrame.spatialTransform.scale);

            lineThickness = devicePixelRatio * frame.contourConfig.thickness / (baseFrame.spatialReference.zoomLevel * baseFrame.spatialTransform.scale);
            dashFactor = ceilToPower(1.0 / baseFrame.spatialReference.zoomLevel, 3.0);
        } else {
            const baseRequiredView = baseFrame.requiredFrameView;
            const rangeScale = {
                x: 1.0 / (baseRequiredView.xMax - baseRequiredView.xMin),
                y: 1.0 / (baseRequiredView.yMax - baseRequiredView.yMin),
            };

            const rangeOffset = {
                x: -baseRequiredView.xMin * rangeScale.x,
                y: -baseRequiredView.yMin * rangeScale.y
            };

            this.gl.uniform2f(this.shaderUniforms.RangeOffset, rangeOffset.x, rangeOffset.y);
            this.gl.uniform2f(this.shaderUniforms.RangeScale, rangeScale.x, rangeScale.y);
            this.gl.uniform1f(this.shaderUniforms.RotationAngle, 0.0);
            this.gl.uniform1f(this.shaderUniforms.ScaleAdjustment, 1.0);

            lineThickness = devicePixelRatio * frame.contourConfig.thickness / baseFrame.zoomLevel;
            dashFactor = ceilToPower(1.0 / baseFrame.zoomLevel, 3.0);
        }

        if (isActive) {
            this.gl.uniform1i(this.shaderUniforms.ControlMapEnabled, 0);
            this.gl.uniform1i(this.shaderUniforms.ControlMapTexture, 0);
        } else {
            const controlMap = frame.getControlMap(baseFrame);
            if (controlMap) {
                this.gl.uniform1i(this.shaderUniforms.ControlMapEnabled, 1);
                this.gl.uniform2f(this.shaderUniforms.ControlMapMin, controlMap.minPoint.x, controlMap.minPoint.y);
                this.gl.uniform2f(this.shaderUniforms.ControlMapMax, controlMap.maxPoint.x, controlMap.maxPoint.y);
                this.gl.uniform2f(this.shaderUniforms.ControlMapSize, controlMap.width, controlMap.height);
            } else {
                console.error("Could not generate control map for contours");
            }
            this.gl.activeTexture(GL.TEXTURE1);
            this.gl.bindTexture(GL.TEXTURE_2D, controlMap.getTextureX(this.gl));
            this.gl.uniform1i(this.shaderUniforms.ControlMapTexture, 1);
        }

        this.gl.uniform1f(this.shaderUniforms.LineThickness, lineThickness);
        this.gl.uniform1i(this.shaderUniforms.CmapEnabled, frame.contourConfig.colormapEnabled ? 1 : 0);
        if (frame.contourConfig.colormapEnabled) {
            this.gl.uniform1i(this.shaderUniforms.CmapIndex, RenderConfigStore.COLOR_MAPS_ALL.indexOf(frame.contourConfig.colormap));
            this.gl.uniform1f(this.shaderUniforms.Bias, frame.contourConfig.colormapBias);
            this.gl.uniform1f(this.shaderUniforms.Contrast, frame.contourConfig.colormapContrast);
        }

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
            RangeScale: this.gl.getUniformLocation(shaderProgram, "uRangeScale"),
            RangeOffset: this.gl.getUniformLocation(shaderProgram, "uRangeOffset"),
            ScaleAdjustment: this.gl.getUniformLocation(shaderProgram, "uScaleAdjustment"),
            RotationOrigin: this.gl.getUniformLocation(shaderProgram, "uRotationOrigin"),
            RotationAngle: this.gl.getUniformLocation(shaderProgram, "uRotationAngle"),
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
            ControlMapSize: this.gl.getUniformLocation(shaderProgram, "uControlMapSize"),
            ControlMapMin: this.gl.getUniformLocation(shaderProgram, "uControlMapMin"),
            ControlMapMax: this.gl.getUniformLocation(shaderProgram, "uControlMapMax"),
            ControlMapTexture: this.gl.getUniformLocation(shaderProgram, "uControlMapTexture"),
        };

        this.gl.uniform1i(this.shaderUniforms.NumCmaps, 79);
        this.gl.uniform1i(this.shaderUniforms.CmapTexture, 0);
    }

    render() {
        // dummy values to trigger React's componentDidUpdate()
        const baseFrame = this.props.appStore.activeFrame;
        if (baseFrame) {
            const view = baseFrame.requiredFrameView;
        }

        const contourFrames = this.props.appStore.contourFrames;
        for (const frame of contourFrames) {
            const config = frame.contourConfig;
            const thickness = config.thickness;
            const color = config.colormapEnabled ? config.colormap : config.color;
            const dashMode = config.dashMode;
            const bias = config.colormapBias;
            const contrast = config.colormapContrast;
            frame.contourStores.forEach(contourStore => {
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
                    id="contour-canvas"
                    className="contour-canvas"
                    ref={(ref) => this.canvas = ref}
                    style={{
                        top: padding.top,
                        left: padding.left,
                        width: baseFrame ? baseFrame.renderWidth || 1 : 1,
                        height: baseFrame ? baseFrame.renderHeight || 1 : 1
                    }}
                />
            </div>);
    }
}