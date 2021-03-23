import {observer} from "mobx-react";
import * as React from "react";
import tinycolor from "tinycolor2";
import {AppStore, FrameStore, CatalogStore, WidgetsStore} from "stores";
import {CatalogOverlayShape} from "stores/widgets";
import {GL2, closestCatalogIndexToCursor} from "utilities";
import {CatalogWebGLService} from "services";
import {canvasToTransformedImagePos} from "components/ImageView/RegionView/shared";
import {CursorInfo} from "models";
import {ImageViewLayer} from "../ImageViewComponent";
import "./CatalogViewGLComponent.scss";

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
            const numVertices = catalog.dataPoints.length;
            const numSelectedVertices = catalog.selectedDataPoints.length;
            const showSelectedData = catalog.showSelectedData;
            const displayed = catalog.displayed;
            const color = catalogWidgetStore.catalogColor;
            const selectedColor = catalogWidgetStore.highlightColor;
            const pointSize = catalogWidgetStore.catalogSize;
            const shape = catalogWidgetStore.catalogShape;
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
        // For alpha blending (soft lines)
        const catalogStore = CatalogStore.Instance;
        this.gl.enable(GL2.BLEND);
        this.gl.blendFunc(GL2.SRC_ALPHA, GL2.ONE_MINUS_SRC_ALPHA);
    
        this.gl.clear(GL2.COLOR_BUFFER_BIT | GL2.DEPTH_BUFFER_BIT);
        const lineThickness = 2.0 * devicePixelRatio;
        const featherWidth = 0.35 * devicePixelRatio;
        const frameView = baseFrame.requiredFrameView;
        this.gl.uniform2f(this.catalogWebGLService.shaderUniforms.FrameViewMin, frameView.xMin, frameView.yMin);
        this.gl.uniform2f(this.catalogWebGLService.shaderUniforms.FrameViewMax, frameView.xMax, frameView.yMax);
        this.gl.uniform1f(this.catalogWebGLService.shaderUniforms.LineThickness, lineThickness);
        this.gl.uniform1f(this.catalogWebGLService.shaderUniforms.FeatherWidth, featherWidth);
        this.gl.uniform1i(this.catalogWebGLService.shaderUniforms.CmapEnabled, 0);
        this.gl.uniform1i(this.catalogWebGLService.shaderUniforms.SmapEnabled, 0);
        const [minSize, maxSize] = this.gl.getParameter(this.gl.ALIASED_POINT_SIZE_RANGE);
        console.log(minSize, maxSize)
        catalogStore.catalogGLData.forEach((catalog, fileId) => {
            const catalogWidgetStore = catalogStore.getCatalogWidgetStore(fileId);
            let dataPoints = catalog.dataPoints;
            let color = tinycolor(catalogWidgetStore.catalogColor).toRgb();
            let pointSize = catalogWidgetStore.catalogSize;
            let selectedDataPoints = catalog.selectedDataPoints;
            if (catalog.showSelectedData) {
                dataPoints = selectedDataPoints;
            }

            if (catalog.displayed && dataPoints?.length) {
                
                this.gl.uniform3f(this.catalogWebGLService.shaderUniforms.PointColor, color.r / 255.0, color.g / 255.0, color.b / 255.0);
                this.gl.uniform1i(this.catalogWebGLService.shaderUniforms.ShapeType, catalogWidgetStore.catalogShape);
                this.gl.uniform1f(this.catalogWebGLService.shaderUniforms.PointSize, pointSize * devicePixelRatio);

                this.catalogWebGLService.updateDataTexture(dataPoints);
                
                this.gl.activeTexture(GL2.TEXTURE0);
                this.gl.bindTexture(GL2.TEXTURE_2D, this.catalogWebGLService.getDataTexture());
                this.gl.uniform1i(this.catalogWebGLService.shaderUniforms.PositionTexture, 0);
                this.gl.drawArrays(GL2.POINTS, 0, dataPoints.length / 4);
                this.gl.finish();   
            }

            if (catalog.displayed && selectedDataPoints?.length) {
                let outlineShape = catalogWidgetStore.catalogShape;
                if (outlineShape === CatalogOverlayShape.CircleFilled) {
                    outlineShape = CatalogOverlayShape.CircleLined;
                }

                let selectedColor = tinycolor(catalogWidgetStore.highlightColor).toRgb();
                this.gl.uniform3f(this.catalogWebGLService.shaderUniforms.PointColor, selectedColor.r / 255.0, selectedColor.g / 255.0, selectedColor.b / 255.0);
                this.gl.uniform1i(this.catalogWebGLService.shaderUniforms.ShapeType, outlineShape);
                this.gl.uniform1f(this.catalogWebGLService.shaderUniforms.PointSize, pointSize * devicePixelRatio + 5);

                this.catalogWebGLService.updateDataTexture(selectedDataPoints);
                
                this.gl.activeTexture(GL2.TEXTURE0);
                this.gl.bindTexture(GL2.TEXTURE_2D, this.catalogWebGLService.getDataTexture());
                this.gl.uniform1i(this.catalogWebGLService.shaderUniforms.PositionTexture, 0);
                this.gl.drawArrays(GL2.POINTS, 0, selectedDataPoints.length / 4);
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
            let dataPoints = catalog.dataPoints;
            const closestPoint = closestCatalogIndexToCursor(cursorPosImageSpace, dataPoints, dataPoints.length / 4);
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