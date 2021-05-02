import {observer} from "mobx-react";
import * as React from "react";
import tinycolor from "tinycolor2";
import {AppStore, CatalogStore, FrameStore, RenderConfigStore, WidgetsStore} from "stores";
import {CatalogTextureType, CatalogWebGLService} from "services";
import {canvasToTransformedImagePos} from "components/ImageView/RegionView/shared";
import {CursorInfo} from "models";
import {closestCatalogIndexToCursor} from "utilities";
import {ImageViewLayer} from "../ImageViewComponent";
import "./CatalogViewGLComponent.scss";
import {CatalogOverlayShape} from "stores/widgets";

export interface CatalogViewGLComponentProps {
    docked: boolean;
    onZoomed?: (cursorInfo: CursorInfo, delta: number) => void;
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
        requestAnimationFrame(this.updateCanvas);
    }

    render() {
        // dummy values to trigger React's componentDidUpdate()
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const appStore = AppStore.Instance;
        const baseFrame = appStore.activeFrame;
        if (baseFrame) {
            const view = baseFrame.requiredFrameView;
        }

        const catalogStore = appStore.catalogStore;
        catalogStore.catalogGLData.forEach((catalog, fileId) => {
            const catalogWidgetStore = catalogStore.getCatalogWidgetStore(fileId);
            const numVertices = catalog.x.length;
            const numSelectedVertices = catalogStore.catalogProfileStores.get(fileId)?.selectedPointIndices.length;
            const showSelectedData = catalogWidgetStore.showSelectedData;
            const displayed = catalog.displayed;
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
        // console.log(this.props.docked, appStore.activeLayer)
        let className = "catalog-div";
        if (this.props.docked) {
            className += " docked";
        }

        if (appStore.activeLayer === ImageViewLayer.Catalog) {
            className += " actived";
        }
        return (
            <div className={className}>
                <canvas
                    id="catalog-canvas"
                    className="catalog-canvas"
                    ref={(ref) => this.canvas = ref}
                    onClick={(evn) => this.onClick(evn)}
                    onDoubleClick={this.onDoubleClick}
                    onWheel={this.onWheelCaptured}
                    style={{
                        top: padding.top,
                        left: padding.left,
                        width: baseFrame ? baseFrame.renderWidth || 1 : 1,
                        height: baseFrame ? baseFrame.renderHeight || 1 : 1
                    }}
                />
            </div>);
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
            this.catalogWebGLService.setCanvasSize(reqWidth, reqHeight);
        }
        // Otherwise just clear it
        this.gl.clearColor(0, 0, 0, 0);
        const clearMask = WebGLRenderingContext.COLOR_BUFFER_BIT | WebGLRenderingContext.DEPTH_BUFFER_BIT | WebGLRenderingContext.STENCIL_BUFFER_BIT;
        this.gl.clear(clearMask);
    }

    private updateCanvas = () => {
        const appStore = AppStore.Instance;
        const baseFrame = appStore.activeFrame;

        if (baseFrame && this.canvas && this.gl && this.catalogWebGLService.shaderUniforms) {
            this.resizeAndClearCanvas();
            this.renderCatalog(baseFrame);
            // draw in 2d canvas
            const ctx = this.canvas.getContext("2d");
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.drawImage(this.gl.canvas, 0, 0, this.canvas.width, this.canvas.height);
        }
    };

    private renderCatalog(baseFrame: FrameStore) {
        const catalogStore = CatalogStore.Instance;
        const GL2 = WebGL2RenderingContext;
        // For alpha blending (soft lines)
        this.gl.enable(GL2.BLEND);
        this.gl.blendFunc(GL2.SRC_ALPHA, GL2.ONE_MINUS_SRC_ALPHA);
        // depth test
        this.gl.enable(GL2.DEPTH_TEST);
        this.gl.depthFunc(GL2.LEQUAL);
        this.gl.clear(GL2.COLOR_BUFFER_BIT | GL2.DEPTH_BUFFER_BIT);
        const frameView = baseFrame.requiredFrameView;
        const shaderUniforms = this.catalogWebGLService.shaderUniforms;
        this.gl.uniform2f(shaderUniforms.FrameViewMin, frameView.xMin, frameView.yMin);
        this.gl.uniform2f(shaderUniforms.FrameViewMax, frameView.xMax, frameView.yMax);
        
        catalogStore.catalogGLData.forEach((catalog, fileId) => {
            const catalogWidgetStore = catalogStore.getCatalogWidgetStore(fileId);
            const shape = catalogWidgetStore.shapeSettings;
            const featherWidth = shape.featherWidth * devicePixelRatio;
            const lineThickness = (catalogWidgetStore.thickness * shape.thicknessBase) * devicePixelRatio;
            let color = tinycolor(catalogWidgetStore.catalogColor).toRgb();
            let selectedSourceColor = tinycolor(catalogWidgetStore.highlightColor).toRgb();
            let pointSize = catalogWidgetStore.catalogSize + shape.diameterBase;
            this.gl.uniform1f(shaderUniforms.LineThickness, lineThickness);
            this.gl.uniform1i(shaderUniforms.ShowSelectedSource, catalogWidgetStore.showSelectedData? 1.0 : 0.0);
            // size
            this.gl.uniform1i(shaderUniforms.SizeMajorMapEnabled, 0);
            this.gl.uniform1i(shaderUniforms.AreaMode, catalogWidgetStore.sizeArea? 1 : 0);
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
            if (!catalogWidgetStore.disableColorMap && colorTexture){
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
            this.gl.uniform1i(shaderUniforms.AreaModeMinor, catalogWidgetStore.sizeMinorArea? 1 : 0);
            const sizeMinorTexture = this.catalogWebGLService.getDataTexture(fileId, CatalogTextureType.SizeMinor);
            if (!catalogWidgetStore.disableSizeMinorMap && sizeMinorTexture && catalogWidgetStore.catalogShape === CatalogOverlayShape.ELLIPSE_LINED) {
                this.gl.uniform1i(shaderUniforms.SizeMinorMapEnabled, 1);
                this.gl.activeTexture(GL2.TEXTURE7);
                this.gl.bindTexture(GL2.TEXTURE_2D, sizeMinorTexture);
                this.gl.uniform1i(shaderUniforms.SizeMinorTexture, 7);
            }

            // position 
            const x = this.catalogWebGLService.getDataTexture(fileId, CatalogTextureType.X);
            const y = this.catalogWebGLService.getDataTexture(fileId, CatalogTextureType.Y);
            if (catalog.displayed && catalog.x?.length && catalog?.y.length && x && y) {
                this.gl.uniform3f(shaderUniforms.PointColor, color.r / 255.0, color.g / 255.0, color.b / 255.0);
                this.gl.uniform3f(shaderUniforms.SelectedSourceColor, selectedSourceColor.r / 255.0, selectedSourceColor.g / 255.0, selectedSourceColor.b / 255.0);
                this.gl.uniform1i(shaderUniforms.ShapeType, catalogWidgetStore.catalogShape);
                this.gl.uniform1f(shaderUniforms.PointSize, pointSize * devicePixelRatio);
                
                this.gl.activeTexture(GL2.TEXTURE1);
                this.gl.bindTexture(GL2.TEXTURE_2D, x);
                this.gl.uniform1i(shaderUniforms.XTexture, 1);

                this.gl.activeTexture(GL2.TEXTURE2);
                this.gl.bindTexture(GL2.TEXTURE_2D, y);
                this.gl.uniform1i(shaderUniforms.YTexture, 2);

                this.gl.drawArrays(GL2.POINTS, 0, catalog.x.length);
                this.gl.finish();
            }
        });
    }

    private onWheelCaptured = (event) => {
        if (event && event.nativeEvent && event.nativeEvent.type === "wheel") {
            const wheelEvent = event.nativeEvent;
            const frame = AppStore.Instance.activeFrame;
            const lineHeight = 15;
            const delta = wheelEvent.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? wheelEvent.deltaY : wheelEvent.deltaY * lineHeight;
            if (frame.wcsInfo && this.props.onZoomed) {
                const cursorPosImageSpace = canvasToTransformedImagePos(wheelEvent.offsetX, wheelEvent.offsetY, frame, frame.renderWidth, frame.renderHeight);
                this.props.onZoomed(frame.getCursorInfo(cursorPosImageSpace), -delta);
            }
        }
    };

    private onClick = (event) => {
        const clickEvent = event.nativeEvent;
        const catalogStore = CatalogStore.Instance;
        const frame = AppStore.Instance.activeFrame;
        const cursorPosImageSpace = canvasToTransformedImagePos(clickEvent.offsetX, clickEvent.offsetY, frame, frame.renderWidth, frame.renderHeight);

        let selectedPoint = {fileId: undefined, minIndex: undefined, minDistanceSquared: Number.MAX_VALUE};
        catalogStore.catalogGLData.forEach((catalog, fileId) => {
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
            catalogProfileStore.setSelectedPointIndices([selectedPoint.minIndex], false);
            catalogWidgetStore.setCatalogTableAutoScroll(true);
        }
    }

    private onDoubleClick() {
        const catalogStore = CatalogStore.Instance;
        if (catalogStore?.catalogGLData?.size) {   
            catalogStore.catalogProfileStores.forEach((profileStore) => {   
                const widgetStoreId = CatalogStore.Instance.catalogWidgets.get(profileStore.catalogFileId);
                profileStore.setSelectedPointIndices([], false);
                WidgetsStore.Instance.catalogWidgets.get(widgetStoreId)?.setCatalogTableAutoScroll(false);
            });
        }
    }
}