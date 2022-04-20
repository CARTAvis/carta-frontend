import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {AppStore} from "stores";
import {FrameStore, RenderConfigStore, VectorOverlaySource} from "stores/Frame";
import {GL2, rotate2D, scale2D, subtract2D} from "utilities";
import {VectorOverlayWebGLService} from "services";
import "./VectorOverlayView.scss";

export interface VectorOverlayViewComponentProps {
    docked: boolean;
    frame: FrameStore;
    row: number;
    column: number;
}

@observer
export class VectorOverlayViewComponent extends React.Component<VectorOverlayViewComponentProps> {
    private canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext;
    private vectorOverlayWebGLService: VectorOverlayWebGLService;

    componentDidMount() {
        this.vectorOverlayWebGLService = VectorOverlayWebGLService.Instance;
        this.gl = this.vectorOverlayWebGLService.gl;
        if (this.canvas) {
            this.updateCanvas();
        }
    }

    componentDidUpdate() {
        AppStore.Instance.resetImageRatio();
        requestAnimationFrame(this.updateCanvas);
    }

    private resizeAndClearCanvas() {
        const frame = this.props.frame;
        if (!frame) {
            return;
        }

        const appStore = AppStore.Instance;
        const pixelRatio = devicePixelRatio * appStore.imageRatio;
        const requiredWidth = Math.max(1, frame.renderWidth * pixelRatio);
        const requiredHeight = Math.max(1, frame.renderHeight * pixelRatio);

        // Resize and clear the canvas if needed
        if (frame?.isRenderable && (this.canvas.width !== requiredWidth || this.canvas.height !== requiredHeight)) {
            this.canvas.width = requiredWidth;
            this.canvas.height = requiredHeight;
        }
        // Resize and clear the shared WebGL canvas if required
        this.vectorOverlayWebGLService.setCanvasSize(requiredWidth * appStore.numImageColumns, requiredHeight * appStore.numImageRows);

        // Resize canvas if necessary
        if (this.canvas.width !== requiredWidth || this.canvas.height !== requiredHeight) {
            this.canvas.width = requiredWidth;
            this.canvas.height = requiredHeight;
        }
        // Otherwise just clear it
        const xOffset = this.props.column * frame.renderWidth * pixelRatio;
        // y-axis is inverted
        const yOffset = (appStore.numImageRows - 1 - this.props.row) * frame.renderHeight * pixelRatio;
        this.gl.viewport(xOffset, yOffset, frame.renderWidth * pixelRatio, frame.renderHeight * pixelRatio);
        this.gl.clearColor(0, 0, 0, 0);
        // Clear a scissored rectangle limited to the current frame
        this.gl.enable(GL2.SCISSOR_TEST);
        this.gl.scissor(xOffset, yOffset, frame.renderWidth * pixelRatio, frame.renderHeight * pixelRatio);
        const clearMask = GL2.COLOR_BUFFER_BIT | GL2.DEPTH_BUFFER_BIT | GL2.STENCIL_BUFFER_BIT;
        this.gl.clear(clearMask);
        this.gl.disable(GL2.SCISSOR_TEST);
    }

    private updateCanvas = () => {
        const appStore = AppStore.Instance;
        const baseFrame = this.props.frame;
        if (baseFrame && this.canvas && this.gl && this.vectorOverlayWebGLService.shaderUniforms) {
            appStore.setCanvasUpdated();

            const vectorOverlayFrames = appStore.vectorOverlayFrames.get(baseFrame);
            this.resizeAndClearCanvas();
            if (vectorOverlayFrames) {
                // Render back-to-front to preserve ordering
                for (let i = vectorOverlayFrames.length - 1; i >= 0; --i) {
                    this.renderFrameVectorOverlay(vectorOverlayFrames[i], baseFrame);
                }
            }
            // draw in 2d canvas
            const ctx = this.canvas.getContext("2d");
            const w = this.canvas.width;
            const h = this.canvas.height;
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(this.gl.canvas, this.props.column * w, this.props.row * h, w, h, 0, 0, w, h);
        }
    };

    private renderFrameVectorOverlay = (frame: FrameStore, baseFrame: FrameStore) => {
        const shaderUniforms = this.vectorOverlayWebGLService.shaderUniforms;
        const pixelRatio = devicePixelRatio * AppStore.Instance.imageRatio;
        const isActive = frame === baseFrame;
        let lineThickness: number;

        if (baseFrame.spatialReference) {
            const baseRequiredView = baseFrame.spatialReference.requiredFrameView;

            const rangeScale = {
                x: 1.0 / (baseRequiredView.xMax - baseRequiredView.xMin),
                y: 1.0 / (baseRequiredView.yMax - baseRequiredView.yMin)
            };

            // Instead of rotating and scaling about an origin on the GPU (float32), we take this out of the shader, and perform beforehand (float64, and consistent)
            const originAdjustedOffset = subtract2D(baseFrame.spatialTransform.origin, scale2D(rotate2D(baseFrame.spatialTransform.origin, baseFrame.spatialTransform.rotation), baseFrame.spatialTransform.scale));

            const rangeOffset = {
                x: (baseFrame.spatialTransform.translation.x - baseRequiredView.xMin + originAdjustedOffset.x) * rangeScale.x,
                y: (baseFrame.spatialTransform.translation.y - baseRequiredView.yMin + originAdjustedOffset.y) * rangeScale.y
            };

            this.gl.uniform2f(shaderUniforms.RangeScale, rangeScale.x, rangeScale.y);
            this.gl.uniform2f(shaderUniforms.RangeOffset, rangeOffset.x, rangeOffset.y);
            this.gl.uniform1f(shaderUniforms.RotationAngle, -baseFrame.spatialTransform.rotation);
            this.gl.uniform1f(shaderUniforms.ScaleAdjustment, baseFrame.spatialTransform.scale);

            lineThickness = pixelRatio * frame.vectorOverlayConfig.thickness;
            this.gl.uniform1f(shaderUniforms.ZoomLevel, frame.zoomLevel);
        } else {
            const baseRequiredView = baseFrame.requiredFrameView;
            const rangeScale = {
                x: 1.0 / (baseRequiredView.xMax - baseRequiredView.xMin),
                y: 1.0 / (baseRequiredView.yMax - baseRequiredView.yMin)
            };

            const rangeOffset = {
                x: -baseRequiredView.xMin * rangeScale.x,
                y: -baseRequiredView.yMin * rangeScale.y
            };

            this.gl.uniform2f(shaderUniforms.RangeOffset, rangeOffset.x, rangeOffset.y);
            this.gl.uniform2f(shaderUniforms.RangeScale, rangeScale.x, rangeScale.y);
            this.gl.uniform1f(shaderUniforms.RotationAngle, 0.0);
            this.gl.uniform1f(shaderUniforms.ScaleAdjustment, 1.0);

            lineThickness = pixelRatio * frame.vectorOverlayConfig.thickness;
            this.gl.uniform1f(shaderUniforms.ZoomLevel, baseFrame.zoomLevel);
        }

        if (isActive) {
            this.gl.uniform1i(shaderUniforms.ControlMapEnabled, 0);
            this.gl.uniform1i(shaderUniforms.ControlMapTexture, 0);
        } else {
            const controlMap = frame.getControlMap(baseFrame);
            if (controlMap) {
                this.gl.uniform1i(shaderUniforms.ControlMapEnabled, 1);
                this.gl.uniform2f(shaderUniforms.ControlMapMin, controlMap.minPoint.x, controlMap.minPoint.y);
                this.gl.uniform2f(shaderUniforms.ControlMapMax, controlMap.maxPoint.x, controlMap.maxPoint.y);
                this.gl.uniform2f(shaderUniforms.ControlMapSize, controlMap.width, controlMap.height);
            } else {
                console.error("Could not generate control map for vector overlay");
            }
            this.gl.activeTexture(GL2.TEXTURE1);
            this.gl.bindTexture(GL2.TEXTURE_2D, controlMap.getTextureX(this.gl));
            this.gl.uniform1i(shaderUniforms.ControlMapTexture, 1);
        }

        this.gl.uniform1i(shaderUniforms.DataTexture, 0);
        this.gl.uniform1f(shaderUniforms.CanvasSpaceLineWidth, lineThickness);
        this.gl.uniform1f(shaderUniforms.FeatherWidth, pixelRatio);
        if (isFinite(frame.vectorOverlayConfig.rotationOffset)) {
            this.gl.uniform1f(shaderUniforms.RotationOffset, (frame.vectorOverlayConfig.rotationOffset * Math.PI) / 180.0);
        } else {
            this.gl.uniform1f(shaderUniforms.RotationOffset, 0);
        }

        const intensityMin = isFinite(frame.vectorOverlayConfig.intensityMin) ? frame.vectorOverlayConfig.intensityMin : frame.vectorOverlayStore.intensityMin;
        const intensityMax = isFinite(frame.vectorOverlayConfig.intensityMax) ? frame.vectorOverlayConfig.intensityMax : frame.vectorOverlayStore.intensityMax;

        if (frame.vectorOverlayConfig.angularSource === VectorOverlaySource.None) {
            this.gl.uniform1f(shaderUniforms.IntensityMin, intensityMin);
            this.gl.uniform1f(shaderUniforms.IntensityMax, intensityMax);
            this.gl.uniform1f(shaderUniforms.LengthMin, frame.vectorOverlayConfig.lengthMin * pixelRatio);
            this.gl.uniform1f(shaderUniforms.LengthMax, frame.vectorOverlayConfig.lengthMax * pixelRatio);
            this.gl.uniform1i(shaderUniforms.IntensityPlot, 1);
        } else if (frame.vectorOverlayConfig.intensitySource === VectorOverlaySource.None) {
            this.gl.uniform1f(shaderUniforms.IntensityMin, 0);
            this.gl.uniform1f(shaderUniforms.IntensityMax, 1);
            this.gl.uniform1f(shaderUniforms.LengthMin, frame.vectorOverlayConfig.lengthMax * pixelRatio);
            this.gl.uniform1f(shaderUniforms.LengthMax, frame.vectorOverlayConfig.lengthMax * pixelRatio);
            this.gl.uniform1i(shaderUniforms.IntensityPlot, 0);
        } else {
            this.gl.uniform1f(shaderUniforms.IntensityMin, intensityMin);
            this.gl.uniform1f(shaderUniforms.IntensityMax, intensityMax);
            this.gl.uniform1f(shaderUniforms.LengthMin, frame.vectorOverlayConfig.lengthMin * pixelRatio);
            this.gl.uniform1f(shaderUniforms.LengthMax, frame.vectorOverlayConfig.lengthMax * pixelRatio);
            this.gl.uniform1i(shaderUniforms.IntensityPlot, 0);
        }

        // TODO: support non-uniform pixel ratios
        // this.gl.uniform1f(shaderUniforms.PixelRatio, frame.aspectRatio);
        this.gl.uniform1i(shaderUniforms.CmapEnabled, frame.vectorOverlayConfig.colormapEnabled ? 1 : 0);
        if (frame.vectorOverlayConfig.colormapEnabled) {
            this.gl.uniform1i(shaderUniforms.CmapIndex, RenderConfigStore.COLOR_MAPS_ALL.indexOf(frame.vectorOverlayConfig.colormap));
            this.gl.uniform1f(shaderUniforms.Bias, frame.vectorOverlayConfig.colormapBias);
            this.gl.uniform1f(shaderUniforms.Contrast, frame.vectorOverlayConfig.colormapContrast);
        } else {
            const color = frame.vectorOverlayConfig.color;
            if (color) {
                this.gl.uniform4f(shaderUniforms.LineColor, color.r / 255.0, color.g / 255.0, color.b / 255.0, color.a || 1.0);
            } else {
                this.gl.uniform4f(shaderUniforms.LineColor, 1, 1, 1, 1);
            }
        }

        if (frame.vectorOverlayStore?.tiles) {
            for (const tile of frame.vectorOverlayStore.tiles) {
                this.gl.activeTexture(GL2.TEXTURE0);
                this.gl.bindTexture(GL2.TEXTURE_2D, tile.texture);
                this.gl.drawArrays(GL2.TRIANGLES, 0, tile.numVertices * 6);
            }
        }
    };

    private getRef = ref => {
        this.canvas = ref;
    };

    render() {
        // dummy values to trigger React's componentDidUpdate()
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const appStore = AppStore.Instance;
        const baseFrame = this.props.frame;
        if (baseFrame) {
            const view = baseFrame.requiredFrameView;
        }

        const overlayFrames = appStore.vectorOverlayFrames.get(baseFrame);
        if (overlayFrames) {
            for (const frame of overlayFrames) {
                let {angularSource, intensitySource, thickness, rotationOffset, color, colormapBias, colormapContrast, colormapEnabled, colormap, intensityMin, intensityMax, lengthMin, lengthMax} = frame.vectorOverlayConfig;
                const config = frame.vectorOverlayConfig;
                intensityMin = isFinite(intensityMin) ? intensityMin : frame.vectorOverlayStore.intensityMin;
                intensityMax = isFinite(intensityMax) ? intensityMax : frame.vectorOverlayStore.intensityMax;

                frame.vectorOverlayStore.tiles?.forEach(t => {
                    const numVertices = t.numVertices;
                });
            }
        }
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const padding = appStore.overlayStore.padding;
        const className = classNames("vector-overlay-div", {docked: this.props.docked});

        return (
            <div className={className}>
                <canvas
                    id="vector-overlay-canvas"
                    className="vector-overlay-canvas"
                    ref={this.getRef}
                    style={{
                        top: padding.top,
                        left: padding.left,
                        width: baseFrame ? baseFrame.renderWidth || 1 : 1,
                        height: baseFrame ? baseFrame.renderHeight || 1 : 1
                    }}
                />
            </div>
        );
    }
}
