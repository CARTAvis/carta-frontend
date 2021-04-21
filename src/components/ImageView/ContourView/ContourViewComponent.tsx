import {observer} from "mobx-react";
import * as React from "react";
import {AppStore, ContourDashMode, FrameStore, RenderConfigStore} from "stores";
import {ceilToPower, GL, rotate2D, scale2D, subtract2D} from "utilities";
import {ContourWebGLService} from "services";
import "./ContourViewComponent.scss";

export interface ContourViewComponentProps {
    docked: boolean;
}

@observer
export class ContourViewComponent extends React.Component<ContourViewComponentProps> {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private contourWebGLService: ContourWebGLService;

    componentDidMount() {
        this.contourWebGLService = ContourWebGLService.Instance;
        this.gl = this.contourWebGLService.gl;
        if (this.canvas) {
            this.updateCanvas();
        }
    }

    componentDidUpdate() {
        requestAnimationFrame(this.updateCanvas);
    }

    private resizeAndClearCanvas() {
        const frame = AppStore.Instance.activeFrame;
        if (!frame) {
            return;
        }

        const reqWidth = Math.round(Math.max(1, frame.renderWidth * devicePixelRatio));
        const reqHeight = Math.round(Math.max(1, frame.renderHeight * devicePixelRatio));
        // Resize canvas if necessary
        if (this.canvas.width !== reqWidth || this.canvas.height !== reqHeight) {
            this.canvas.width = reqWidth;
            this.canvas.height = reqHeight;
            this.contourWebGLService.setCanvasSize(reqWidth, reqHeight);
        }
        // Otherwise just clear it
        this.gl.clearColor(0, 0, 0, 0);
        const clearMask = WebGLRenderingContext.COLOR_BUFFER_BIT | WebGLRenderingContext.DEPTH_BUFFER_BIT | WebGLRenderingContext.STENCIL_BUFFER_BIT;
        this.gl.clear(clearMask);
    }

    private updateCanvas = () => {
        const appStore = AppStore.Instance;
        const baseFrame = appStore.activeFrame;
        const contourFrames = appStore.contourFrames;
        if (baseFrame && this.canvas && this.gl && this.contourWebGLService.shaderUniforms) {
            this.resizeAndClearCanvas();

            // Render back-to-front to preserve ordering
            for (let i = contourFrames.length - 1; i >= 0; --i) {
                this.renderFrameContours(contourFrames[i], baseFrame);
            }
            // draw in 2d canvas
            const ctx = this.canvas.getContext("2d");
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.drawImage(this.gl.canvas, 0, 0, this.canvas.width, this.canvas.height);
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

            this.gl.uniform2f(this.contourWebGLService.shaderUniforms.RangeScale, rangeScale.x, rangeScale.y);
            this.gl.uniform2f(this.contourWebGLService.shaderUniforms.RangeOffset, rangeOffset.x, rangeOffset.y);
            this.gl.uniform2f(this.contourWebGLService.shaderUniforms.RotationOrigin, rotationOrigin.x, rotationOrigin.y);
            this.gl.uniform1f(this.contourWebGLService.shaderUniforms.RotationAngle, -baseFrame.spatialTransform.rotation);
            this.gl.uniform1f(this.contourWebGLService.shaderUniforms.ScaleAdjustment, baseFrame.spatialTransform.scale);

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

            this.gl.uniform2f(this.contourWebGLService.shaderUniforms.RangeOffset, rangeOffset.x, rangeOffset.y);
            this.gl.uniform2f(this.contourWebGLService.shaderUniforms.RangeScale, rangeScale.x, rangeScale.y);
            this.gl.uniform1f(this.contourWebGLService.shaderUniforms.RotationAngle, 0.0);
            this.gl.uniform1f(this.contourWebGLService.shaderUniforms.ScaleAdjustment, 1.0);

            lineThickness = devicePixelRatio * frame.contourConfig.thickness / baseFrame.zoomLevel;
            dashFactor = ceilToPower(1.0 / baseFrame.zoomLevel, 3.0);
        }

        if (isActive) {
            this.gl.uniform1i(this.contourWebGLService.shaderUniforms.ControlMapEnabled, 0);
            this.gl.uniform1i(this.contourWebGLService.shaderUniforms.ControlMapTexture, 0);
        } else {
            const controlMap = frame.getControlMap(baseFrame);
            if (controlMap) {
                this.gl.uniform1i(this.contourWebGLService.shaderUniforms.ControlMapEnabled, 1);
                this.gl.uniform2f(this.contourWebGLService.shaderUniforms.ControlMapMin, controlMap.minPoint.x, controlMap.minPoint.y);
                this.gl.uniform2f(this.contourWebGLService.shaderUniforms.ControlMapMax, controlMap.maxPoint.x, controlMap.maxPoint.y);
                this.gl.uniform2f(this.contourWebGLService.shaderUniforms.ControlMapSize, controlMap.width, controlMap.height);
            } else {
                console.error("Could not generate control map for contours");
            }
            this.gl.activeTexture(GL.TEXTURE1);
            this.gl.bindTexture(GL.TEXTURE_2D, controlMap.getTextureX(this.gl));
            this.gl.uniform1i(this.contourWebGLService.shaderUniforms.ControlMapTexture, 1);
        }

        this.gl.uniform1f(this.contourWebGLService.shaderUniforms.LineThickness, lineThickness);
        this.gl.uniform1f(this.contourWebGLService.shaderUniforms.PixelRatio, frame.aspectRatio);
        this.gl.uniform1i(this.contourWebGLService.shaderUniforms.CmapEnabled, frame.contourConfig.colormapEnabled ? 1 : 0);
        if (frame.contourConfig.colormapEnabled) {
            this.gl.uniform1i(this.contourWebGLService.shaderUniforms.CmapIndex, RenderConfigStore.COLOR_MAPS_ALL.indexOf(frame.contourConfig.colormap));
            this.gl.uniform1f(this.contourWebGLService.shaderUniforms.Bias, frame.contourConfig.colormapBias);
            this.gl.uniform1f(this.contourWebGLService.shaderUniforms.Contrast, frame.contourConfig.colormapContrast);
        }

        if (frame.contourStores) {
            const levels = [];
            frame.contourStores.forEach((v, level) => levels.push(level));
            const minVal = Math.min(...levels);
            const maxVal = Math.max(...levels);

            const color = frame.contourConfig.color;
            if (color) {
                this.gl.uniform4f(this.contourWebGLService.shaderUniforms.LineColor, color.r / 255.0, color.g / 255.0, color.b / 255.0, color.a || 1.0);
            } else {
                this.gl.uniform4f(this.contourWebGLService.shaderUniforms.LineColor, 1, 1, 1, 1);
            }

            frame.contourStores.forEach((contourStore, level) => {
                if (frame.contourConfig.colormapEnabled) {
                    let levelFraction: number;
                    if (minVal !== maxVal) {
                        levelFraction = (level - minVal) / (maxVal - minVal);
                    } else {
                        levelFraction = 1.0;
                    }
                    this.gl.uniform1f(this.contourWebGLService.shaderUniforms.CmapValue, levelFraction);
                }

                // Dash length in canvas pixels
                const dashMode = frame.contourConfig.dashMode;
                const dashLength = (dashMode === ContourDashMode.Dashed || (dashMode === ContourDashMode.NegativeOnly && level < 0)) ? 8 : 0;
                this.gl.uniform1f(this.contourWebGLService.shaderUniforms.DashLength, devicePixelRatio * dashLength * dashFactor);

                // Update buffers
                for (let i = 0; i < contourStore.chunkCount; i++) {
                    contourStore.bindBuffer(i);
                    const numVertices = contourStore.numGeneratedVertices[i];
                    this.gl.vertexAttribPointer(this.contourWebGLService.vertexPositionAttribute, 3, WebGLRenderingContext.FLOAT, false, 16, 0);
                    this.gl.vertexAttribPointer(this.contourWebGLService.vertexNormalAttribute, 2, WebGLRenderingContext.SHORT, false, 16, 12);
                    this.gl.drawArrays(WebGLRenderingContext.TRIANGLE_STRIP, 0, numVertices);
                }
            });
        }
    };

    render() {
        // dummy values to trigger React's componentDidUpdate()
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const appStore = AppStore.Instance;
        const baseFrame = appStore.activeFrame;
        if (baseFrame) {
            const view = baseFrame.requiredFrameView;
        }

        const contourFrames = appStore.contourFrames;
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
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const padding = appStore.overlayStore.padding;
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