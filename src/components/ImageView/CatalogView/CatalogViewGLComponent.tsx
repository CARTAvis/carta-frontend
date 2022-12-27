import {observer} from "mobx-react";
import * as React from "react";
import tinycolor from "tinycolor2";
import classNames from "classnames";
import {AppStore, CatalogStore, WidgetsStore} from "stores";
import {FrameStore, RenderConfigStore} from "stores/Frame";
import {CatalogTextureType, CatalogWebGLService} from "services";
import {canvasToTransformedImagePos} from "components/ImageView/RegionView/shared";
import {ImageViewLayer} from "../ImageViewComponent";
import {CatalogOverlayShape} from "stores/widgets";
import {closestCatalogIndexToCursor, GL2, rotate2D, scale2D, subtract2D} from "utilities";
import "./CatalogViewGLComponent.scss";

export interface CatalogViewGLComponentProps {
    docked: boolean;
    frame: FrameStore;
}

@observer
export class CatalogViewGLComponent extends React.Component<CatalogViewGLComponentProps> {
    private canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext;
    private catalogWebGLService: CatalogWebGLService;

    componentDidMount() {
        this.catalogWebGLService = CatalogWebGLService.Instance;
        this.gl = this.catalogWebGLService.gl;
        if (this.canvas) {
            this.updateCanvas();
        }
    }

    componentDidUpdate() {
        AppStore.Instance.resetImageRatio();
        requestAnimationFrame(this.updateCanvas);
    }

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

        const catalogStore = appStore.catalogStore;
        const catalogFileIds = catalogStore.visibleCatalogFiles.get(baseFrame);
        catalogStore.catalogGLData.forEach((catalog, fileId) => {
            const catalogWidgetStore = catalogStore.getCatalogWidgetStore(fileId);
            const numVertices = catalogStore.catalogCounts.get(fileId);
            const numSelectedVertices = catalogStore.catalogProfileStores.get(fileId)?.selectedPointIndices.length;
            const showSelectedData = catalogWidgetStore.showSelectedData;
            const color = catalogWidgetStore.catalogColor;
            const selectedColor = catalogWidgetStore.highlightColor;
            const pointSize = catalogWidgetStore.catalogSize;
            const shape = catalogWidgetStore.catalogShape;
            const thickness = catalogWidgetStore.thickness;
            // size
            const sizeMapColumn = catalogWidgetStore.sizeMapColumn;
            const sizeMaxArea = catalogWidgetStore.sizeMax.area;
            const sizeMinArea = catalogWidgetStore.sizeMin.area;
            const sizeMaxDiameter = catalogWidgetStore.sizeMax.diameter;
            const sizeMinDiameter = catalogWidgetStore.sizeMin.diameter;
            const sizeColumnMaxClipd = catalogWidgetStore.sizeColumnMax.clipd;
            const sizeColumnMinClipd = catalogWidgetStore.sizeColumnMin.clipd;
            const sizeArea = catalogWidgetStore.sizeArea;
            const sizeScalingType = catalogWidgetStore.sizeScalingType;
            // size minor
            const sizeMinorMapColumn = catalogWidgetStore.sizeMinorMapColumn;
            const sizeMinorColumnMaxClipd = catalogWidgetStore.sizeMinorColumnMax.clipd;
            const sizeMinorColumnMinClipd = catalogWidgetStore.sizeMinorColumnMin.clipd;
            const sizeMinorArea = catalogWidgetStore.sizeMinorArea;
            const sizeMinorScalingType = catalogWidgetStore.sizeMinorScalingType;
            // color
            const colorMapColumn = catalogWidgetStore.colorMapColumn;
            const colorMap = catalogWidgetStore.colorMap;
            const colorScalingType = catalogWidgetStore.colorScalingType;
            const invertedColorMap = catalogWidgetStore.invertedColorMap;
            const colorColumnMaxClipd = catalogWidgetStore.colorColumnMax.clipd;
            const colorColumnMinClipd = catalogWidgetStore.colorColumnMin.clipd;
            // orientation
            const orientationMapColumn = catalogWidgetStore.orientationMapColumn;
            const orientationScalingType = catalogWidgetStore.orientationScalingType;
            const angleMax = catalogWidgetStore.angleMax;
            const angleMin = catalogWidgetStore.angleMin;
            const orientationMaxClipd = catalogWidgetStore.orientationMax.clipd;
            const orientationMinClipd = catalogWidgetStore.orientationMin.clipd;
        });
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const padding = appStore.overlayStore.padding;
        const className = classNames("catalog-div", {docked: this.props.docked, active: appStore.activeLayer === ImageViewLayer.Catalog});

        return (
            <div className={className}>
                <canvas
                    id="catalog-canvas"
                    className="catalog-canvas"
                    ref={this.getRef}
                    onClick={evn => this.onClick(evn)}
                    onDoubleClick={this.onDoubleClick}
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

    private resizeAndClearCanvas() {
        const frame = this.props.frame;
        if (!frame) {
            return;
        }

        const reqWidth = Math.round(Math.max(1, frame.renderWidth * devicePixelRatio * AppStore.Instance.imageRatio));
        const reqHeight = Math.round(Math.max(1, frame.renderHeight * devicePixelRatio * AppStore.Instance.imageRatio));
        // Resize canvas if necessary
        if (this.canvas.width !== reqWidth || this.canvas.height !== reqHeight) {
            this.canvas.width = reqWidth;
            this.canvas.height = reqHeight;
            this.catalogWebGLService.setCanvasSize(reqWidth, reqHeight);
        }
        // Otherwise just clear it
        this.gl.clearColor(0, 0, 0, 0);
        const clearMask = GL2.COLOR_BUFFER_BIT | GL2.DEPTH_BUFFER_BIT | GL2.STENCIL_BUFFER_BIT;
        this.gl.clear(clearMask);
    }

    private updateCanvas = () => {
        const baseFrame = this.props.frame;

        if (baseFrame && this.canvas && this.gl && this.catalogWebGLService.shaderUniforms) {
            this.resizeAndClearCanvas();
            this.renderCatalog();
            // draw in 2d canvas
            const ctx = this.canvas.getContext("2d");
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.drawImage(this.gl.canvas, 0, 0, this.canvas.width, this.canvas.height);
        }
    };

    private renderCatalog() {
        const appStore = AppStore.Instance;
        const catalogStore = CatalogStore.Instance;
        // For alpha blending (soft lines)
        this.gl.enable(GL2.BLEND);
        this.gl.blendFunc(GL2.SRC_ALPHA, GL2.ONE_MINUS_SRC_ALPHA);
        // depth test
        this.gl.enable(GL2.DEPTH_TEST);
        this.gl.depthFunc(GL2.LEQUAL);
        this.gl.clear(GL2.COLOR_BUFFER_BIT | GL2.DEPTH_BUFFER_BIT);
        const shaderUniforms = this.catalogWebGLService.shaderUniforms;
        let rangeScale = {x: 1.0, y: 1.0};
        let rangeOffset = {x: 0.0, y: 0.0};
        let rotationAngle = 0.0;
        let scaleAdjustment = 1.0;
        const destinationFrame = this.props.frame;
        catalogStore.visibleCatalogFiles.get(destinationFrame)?.forEach(fileId => {
            const catalog = catalogStore.catalogGLData.get(fileId);
            const catalogWidgetStore = catalogStore.getCatalogWidgetStore(fileId);
            const count = catalogStore.catalogCounts.get(fileId);
            if (catalog && catalogWidgetStore && count > 0) {
                const frame = appStore.getFrame(catalogStore.getFrameIdByCatalogId(fileId));
                const isActive = frame === destinationFrame;

                const shape = catalogWidgetStore.shapeSettings;
                const featherWidth = shape.featherWidth * devicePixelRatio * AppStore.Instance.imageRatio;
                const lineThickness = catalogWidgetStore.thickness * shape.thicknessBase * devicePixelRatio * AppStore.Instance.imageRatio;
                let color = tinycolor(catalogWidgetStore.catalogColor).toRgb();
                let selectedSourceColor = tinycolor(catalogWidgetStore.highlightColor).toRgb();
                let pointSize = catalogWidgetStore.catalogSize + shape.diameterBase;
                this.gl.uniform1f(shaderUniforms.LineThickness, lineThickness);
                this.gl.uniform1i(shaderUniforms.ShowSelectedSource, catalogWidgetStore.showSelectedData ? 1.0 : 0.0);
                // frameView
                let sourceFrame = frame;
                if (!isActive) {
                    sourceFrame = destinationFrame;
                }
                if (sourceFrame.spatialReference) {
                    const baseRequiredView = sourceFrame.spatialReference.requiredFrameView;
                    const originAdjustedOffset = subtract2D(sourceFrame.spatialTransform.origin, scale2D(rotate2D(sourceFrame.spatialTransform.origin, sourceFrame.spatialTransform.rotation), sourceFrame.spatialTransform.scale));

                    rangeScale = {
                        x: 1.0 / (baseRequiredView.xMax - baseRequiredView.xMin),
                        y: 1.0 / (baseRequiredView.yMax - baseRequiredView.yMin)
                    };

                    rangeOffset = {
                        x: (sourceFrame.spatialTransform.translation.x - baseRequiredView.xMin + originAdjustedOffset.x) * rangeScale.x,
                        y: (sourceFrame.spatialTransform.translation.y - baseRequiredView.yMin + originAdjustedOffset.y) * rangeScale.y
                    };
                    rotationAngle = -sourceFrame.spatialTransform.rotation;
                    scaleAdjustment = sourceFrame.spatialTransform.scale;
                } else {
                    let baseRequiredView = sourceFrame.requiredFrameView;
                    rangeScale = {
                        x: 1.0 / (baseRequiredView.xMax - baseRequiredView.xMin),
                        y: 1.0 / (baseRequiredView.yMax - baseRequiredView.yMin)
                    };

                    rangeOffset = {
                        x: -baseRequiredView.xMin * rangeScale.x,
                        y: -baseRequiredView.yMin * rangeScale.y
                    };
                    rotationAngle = 0.0;
                    scaleAdjustment = 1.0;
                }

                this.gl.uniform2f(shaderUniforms.RangeOffset, rangeOffset.x, rangeOffset.y);
                this.gl.uniform2f(shaderUniforms.RangeScale, rangeScale.x, rangeScale.y);
                this.gl.uniform1f(shaderUniforms.ScaleAdjustment, scaleAdjustment);
                this.gl.uniform1f(shaderUniforms.RotationAngle, rotationAngle);
                this.gl.uniform1f(shaderUniforms.ZoomLevel, sourceFrame?.spatialReference?.zoomLevel ?? sourceFrame?.zoomLevel);

                // size
                this.gl.uniform1i(shaderUniforms.SizeMajorMapEnabled, 0);
                this.gl.uniform1i(shaderUniforms.AreaMode, catalogWidgetStore.sizeArea ? 1 : 0);
                const sizeTexture = this.catalogWebGLService.getDataTexture(fileId, CatalogTextureType.Size);
                if (!catalogWidgetStore.disableSizeMap && sizeTexture) {
                    this.gl.uniform1i(shaderUniforms.SizeMajorMapEnabled, 1);
                    this.gl.activeTexture(GL2.TEXTURE3);
                    this.gl.bindTexture(GL2.TEXTURE_2D, sizeTexture);
                    this.gl.uniform1i(shaderUniforms.SizeTexture, 3);
                }

                // color
                this.gl.uniform1i(shaderUniforms.CmapEnabled, 0);
                const colorTexture = this.catalogWebGLService.getDataTexture(fileId, CatalogTextureType.Color);
                if (!catalogWidgetStore.disableColorMap && colorTexture) {
                    this.gl.uniform1i(shaderUniforms.CmapEnabled, 1);
                    this.gl.uniform1i(shaderUniforms.CmapIndex, RenderConfigStore.COLOR_MAPS_ALL.indexOf(catalogWidgetStore.colorMap));
                    this.gl.activeTexture(GL2.TEXTURE4);
                    this.gl.bindTexture(GL2.TEXTURE_2D, colorTexture);
                    this.gl.uniform1i(shaderUniforms.ColorTexture, 4);
                }

                this.gl.uniform1f(shaderUniforms.FeatherWidth, featherWidth);

                // orientation
                this.gl.uniform1i(shaderUniforms.OmapEnabled, 0);
                const orientationTexture = this.catalogWebGLService.getDataTexture(fileId, CatalogTextureType.Orientation);
                if (!catalogWidgetStore.disableOrientationMap && orientationTexture) {
                    this.gl.uniform1i(shaderUniforms.OmapEnabled, 1);
                    this.gl.activeTexture(GL2.TEXTURE5);
                    this.gl.bindTexture(GL2.TEXTURE_2D, orientationTexture);
                    this.gl.uniform1i(shaderUniforms.OrientationTexture, 5);
                }

                // selected source
                const selectedSource = this.catalogWebGLService.getDataTexture(fileId, CatalogTextureType.SelectedSource);
                if (selectedSource) {
                    this.gl.activeTexture(GL2.TEXTURE6);
                    this.gl.bindTexture(GL2.TEXTURE_2D, selectedSource);
                    this.gl.uniform1i(shaderUniforms.SelectedSourceTexture, 6);
                }

                // size minor
                this.gl.uniform1i(shaderUniforms.SizeMinorMapEnabled, 0);
                this.gl.uniform1i(shaderUniforms.AreaModeMinor, catalogWidgetStore.sizeMinorArea ? 1 : 0);
                const sizeMinorTexture = this.catalogWebGLService.getDataTexture(fileId, CatalogTextureType.SizeMinor);
                if (!catalogWidgetStore.disableSizeMinorMap && sizeMinorTexture && catalogWidgetStore.catalogShape === CatalogOverlayShape.ELLIPSE_LINED) {
                    this.gl.uniform1i(shaderUniforms.SizeMinorMapEnabled, 1);
                    this.gl.activeTexture(GL2.TEXTURE7);
                    this.gl.bindTexture(GL2.TEXTURE_2D, sizeMinorTexture);
                    this.gl.uniform1i(shaderUniforms.SizeMinorTexture, 7);
                }

                // position
                if (isActive) {
                    this.gl.uniform1i(shaderUniforms.ControlMapEnabled, 0);
                    this.gl.uniform1i(shaderUniforms.ControlMapTexture, 0);
                } else {
                    const controlMap = frame.getCatalogControlMap(destinationFrame);
                    if (controlMap) {
                        controlMap.updateCatalogBoundary();
                        this.gl.uniform1i(shaderUniforms.ControlMapEnabled, 1);
                        this.gl.uniform2f(shaderUniforms.ControlMapMin, controlMap.minPoint.x, controlMap.minPoint.y);
                        this.gl.uniform2f(shaderUniforms.ControlMapMax, controlMap.maxPoint.x, controlMap.maxPoint.y);
                        this.gl.uniform2f(shaderUniforms.ControlMapSize, controlMap.width, controlMap.height);
                    } else {
                        console.error("Could not generate control map for catalog overlays");
                    }
                    this.gl.activeTexture(GL2.TEXTURE1);
                    this.gl.bindTexture(GL2.TEXTURE_2D, controlMap.getTextureX(this.gl));
                    this.gl.uniform1i(shaderUniforms.ControlMapTexture, 1);
                }

                const hasSources = this.catalogWebGLService.updatePositionTexture(fileId);
                const positionTexture = this.catalogWebGLService.getDataTexture(fileId, CatalogTextureType.Position);
                if (positionTexture) {
                    this.gl.activeTexture(GL2.TEXTURE2);
                    this.gl.bindTexture(GL2.TEXTURE_2D, positionTexture);
                    this.gl.uniform1i(shaderUniforms.PositionTexture, 2);
                }

                if (hasSources) {
                    this.gl.uniform3f(shaderUniforms.PointColor, color.r / 255.0, color.g / 255.0, color.b / 255.0);
                    this.gl.uniform3f(shaderUniforms.SelectedSourceColor, selectedSourceColor.r / 255.0, selectedSourceColor.g / 255.0, selectedSourceColor.b / 255.0);
                    this.gl.uniform1i(shaderUniforms.ShapeType, catalogWidgetStore.catalogShape);
                    this.gl.uniform1f(shaderUniforms.PointSize, pointSize * devicePixelRatio * AppStore.Instance.imageRatio);

                    this.gl.drawArrays(GL2.TRIANGLES, 0, count * 6);
                    this.gl.finish();
                }
            }
        });
    }

    private onClick = event => {
        const clickEvent = event.nativeEvent;
        const catalogStore = CatalogStore.Instance;

        let selectedPoint = {fileId: undefined, minIndex: undefined, minDistanceSquared: Number.MAX_VALUE};
        catalogStore.catalogGLData?.forEach((catalog, fileId) => {
            const frame = AppStore.Instance.getFrame(catalogStore.getFrameIdByCatalogId(fileId));
            const cursorPosImageSpace = canvasToTransformedImagePos(clickEvent.offsetX, clickEvent.offsetY, frame, frame.renderWidth, frame.renderHeight);
            const closestPoint = closestCatalogIndexToCursor(cursorPosImageSpace, catalog.x, catalog.y);
            if (closestPoint.minDistanceSquared < selectedPoint.minDistanceSquared) {
                selectedPoint.minIndex = closestPoint.minIndex;
                selectedPoint.minDistanceSquared = closestPoint.minDistanceSquared;
                selectedPoint.fileId = fileId;
            }
        });

        if (selectedPoint.fileId !== undefined && selectedPoint.minIndex !== undefined) {
            const catalogProfileStore = catalogStore.catalogProfileStores.get(selectedPoint.fileId);
            const widgetStoreId = catalogStore.catalogWidgets.get(selectedPoint.fileId);
            const catalogWidgetStore = WidgetsStore.Instance.catalogWidgets.get(widgetStoreId);
            catalogStore.updateCatalogProfiles(selectedPoint.fileId);
            const matched = catalogProfileStore.getOriginIndices([selectedPoint.minIndex]);
            catalogProfileStore.setSelectedPointIndices(matched, false);
            catalogWidgetStore.setCatalogTableAutoScroll(true);
        }
    };

    private onDoubleClick() {
        const catalogStore = CatalogStore.Instance;
        if (catalogStore?.catalogGLData?.size) {
            catalogStore.catalogProfileStores?.forEach(profileStore => {
                profileStore.setSelectedPointIndices([], false);
            });
        }
    }
}
