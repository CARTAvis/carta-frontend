import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";

import {ContourWebGLService} from "services";
import {AnimatorStore, AppStore} from "stores";
import {ContourDashMode, FrameStore, RenderConfigStore} from "stores/Frame";
import {ceilToPower, GL2, rotate2D, scale2D, subtract2D} from "utilities";

import "./ContourViewComponent.scss";

export interface ContourViewComponentProps {
    docked: boolean;
    frame: FrameStore;
    row: number;
    column: number;
}

@observer
export class ContourViewComponent extends React.Component<ContourViewComponentProps> {
    private canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext;
    private contourWebGLService: ContourWebGLService;

    componentDidMount() {
        this.contourWebGLService = ContourWebGLService.Instance;
        this.gl = this.contourWebGLService.gl;
        const contourStream = AppStore.Instance.backendService.contourStream;
        if (this.canvas) {
            contourStream.subscribe(() => {
                const animatorStore = AnimatorStore.Instance;
                const receivedContourStores = Array.from(this.props.frame.contourStores.values());
                if (receivedContourStores.every(contourImageData => contourImageData.progress === 1) && receivedContourStores.length === this.props.frame.contourConfig.levels.length && animatorStore.serverAnimationActive) {
                    requestAnimationFrame(this.updateCanvas);
                } else if (!animatorStore.serverAnimationActive) {
                    requestAnimationFrame(this.updateCanvas);
                }
            });
        }
    }

    componentDidUpdate() {
        AppStore.Instance.resetImageRatio();
        const animatorStore = AnimatorStore.Instance;
        const receivedContourStores = Array.from(this.props.frame.contourStores.values());
        if (receivedContourStores.every(contourImageData => contourImageData.progress === 1) && receivedContourStores.length === this.props.frame.contourConfig.levels.length && animatorStore.serverAnimationActive) {
            requestAnimationFrame(this.updateCanvas);
        } else if (!animatorStore.serverAnimationActive) {
            requestAnimationFrame(this.updateCanvas);
        }
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
        this.contourWebGLService.setCanvasSize(requiredWidth * appStore.numImageColumns, requiredHeight * appStore.numImageRows);

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
        if (baseFrame && this.canvas && this.gl && this.contourWebGLService.shaderUniforms) {
            appStore.setCanvasUpdated();

            const contourFrames = appStore.contourFrames.get(baseFrame);
            this.resizeAndClearCanvas();
            if (contourFrames) {
                // Render back-to-front to preserve ordering
                for (let i = contourFrames.length - 1; i >= 0; --i) {
                    this.renderFrameContours(contourFrames[i], baseFrame);
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

    private renderFrameContours = (frame: FrameStore, baseFrame: FrameStore) => {
        const pixelRatio = devicePixelRatio * AppStore.Instance.imageRatio;
        const isActive = frame === baseFrame;
        let lineThickness: number;
        let dashFactor: number;

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

            this.gl.uniform2f(this.contourWebGLService.shaderUniforms.RangeScale, rangeScale.x, rangeScale.y);
            this.gl.uniform2f(this.contourWebGLService.shaderUniforms.RangeOffset, rangeOffset.x, rangeOffset.y);
            this.gl.uniform1f(this.contourWebGLService.shaderUniforms.RotationAngle, -baseFrame.spatialTransform.rotation);
            this.gl.uniform1f(this.contourWebGLService.shaderUniforms.ScaleAdjustment, baseFrame.spatialTransform.scale);

            lineThickness = (pixelRatio * frame.contourConfig.thickness) / (baseFrame.spatialReference.zoomLevel * baseFrame.spatialTransform.scale);
            dashFactor = ceilToPower(1.0 / baseFrame.spatialReference.zoomLevel, 3.0);
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

            this.gl.uniform2f(this.contourWebGLService.shaderUniforms.RangeOffset, rangeOffset.x, rangeOffset.y);
            this.gl.uniform2f(this.contourWebGLService.shaderUniforms.RangeScale, rangeScale.x, rangeScale.y);
            this.gl.uniform1f(this.contourWebGLService.shaderUniforms.RotationAngle, 0.0);
            this.gl.uniform1f(this.contourWebGLService.shaderUniforms.ScaleAdjustment, 1.0);

            lineThickness = (pixelRatio * frame.contourConfig.thickness) / baseFrame.zoomLevel;
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
            this.gl.activeTexture(GL2.TEXTURE1);
            this.gl.bindTexture(GL2.TEXTURE_2D, controlMap.getTextureX(this.gl));
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
                const dashLength = dashMode === ContourDashMode.Dashed || (dashMode === ContourDashMode.NegativeOnly && level < 0) ? 8 : 0;
                this.gl.uniform1f(this.contourWebGLService.shaderUniforms.DashLength, pixelRatio * dashLength * dashFactor);

                // Update buffers
                for (let i = 0; i < contourStore.chunkCount; i++) {
                    contourStore.bindBuffer(i);
                    const numVertices = contourStore.numGeneratedVertices[i];
                    this.gl.vertexAttribPointer(this.contourWebGLService.vertexPositionAttribute, 3, GL2.FLOAT, false, 16, 0);
                    this.gl.vertexAttribPointer(this.contourWebGLService.vertexNormalAttribute, 2, GL2.SHORT, false, 16, 12);
                    this.gl.drawArrays(GL2.TRIANGLE_STRIP, 0, numVertices);
                }
            });
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

        const contourFrames = appStore.contourFrames.get(baseFrame);
        if (contourFrames) {
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
        }
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const padding = appStore.overlayStore.padding;
        const className = classNames("contour-div", {docked: this.props.docked});

        return (
            <div className={className}>
                <canvas
                    id="contour-canvas"
                    className="contour-canvas"
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
