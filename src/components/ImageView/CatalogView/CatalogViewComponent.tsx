import * as React from "react";
import * as Plotly from "plotly.js";
import {observer} from "mobx-react";
import {computed} from "mobx";
import Plot from "react-plotly.js";
import {AppStore, WidgetsStore, CatalogStore} from "stores";
import {CatalogOverlayShape} from "stores/widgets";
import {canvasToTransformedImagePos} from "components/ImageView/RegionView/shared";
import {ImageViewLayer} from "../ImageViewComponent";
import {CursorInfo} from "models";
import {getColorForTheme} from "utilities";
import "./CatalogViewComponent.scss";

export interface CatalogViewComponentProps {
    docked: boolean;
    width: number;
    height: number;
    activeLayer: ImageViewLayer;
    onClicked?: (cursorInfo: CursorInfo) => void;
    onZoomed?: (cursorInfo: CursorInfo, delta: number) => void;
}

@observer
export class CatalogViewComponent extends React.Component<CatalogViewComponentProps> {

    @computed get unSelectedData(): Map<number, Plotly.Data> {
        const catalogStore = CatalogStore.Instance;
        let coordsData = new Map<number, Plotly.Data>();
        catalogStore.catalogData.forEach((catalog, key) => {
            if (!catalog.showSelectedData) {
                let unSelecteData: Partial<Plotly.PlotData> = {};
                unSelecteData.type = "scattergl";
                unSelecteData.mode = "markers";
                unSelecteData.hoverinfo = "none";
                unSelecteData.visible = catalog.displayed;
                unSelecteData.marker = {};
                unSelecteData.marker.line = {};
                // copy data to trigger react-plotly js update. only update revision number not working. with layout["datarevision"] will slow down plotly;
                unSelecteData.x = catalog.xImageCoords.slice(0);
                unSelecteData.y = catalog.yImageCoords.slice(0);
                unSelecteData.name = key.toString();
                coordsData.set(key, unSelecteData);
            }
        });
        return coordsData;
    }

    @computed get selectedData(): Map<number, Plotly.Data> {
        const catalogStore = CatalogStore.Instance;   
        let coordsData = new Map<number, Plotly.Data>(); 
        catalogStore.catalogProfileStores.forEach((profileStore) => {    
            const selectedPoints = profileStore.selectedPointIndices;
            const selectedPointSize = selectedPoints.length;
            const fileId = profileStore.catalogFileId;
            let selecteData: Partial<Plotly.PlotData> = {};
            if (selectedPointSize > 0) {
                selecteData.type = "scattergl";
                selecteData.mode = "markers";
                selecteData.hoverinfo = "none";
                const coords = catalogStore.catalogData.get(fileId);
                selecteData.visible = coords.displayed;
                if (coords?.xImageCoords?.length) {
                    selecteData.x = coords.xSelectedCoords.slice(0);
                    selecteData.y = coords.ySelectedCoords.slice(0);
                    selecteData.name = fileId.toString();
                    selecteData.marker = {};
                    selecteData.marker.line = {};
                    coordsData.set(fileId, selecteData);
                }
            }
        });
        return coordsData;
    }

    private onClick = (event: Readonly<Plotly.PlotMouseEvent>) => {
        if (event && event.points && event.points.length > 0) {
            const catalogStore = CatalogStore.Instance;
            const catalogFileId = Number(event.points[0].data.name);
            const catalogProfileStore = catalogStore.catalogProfileStores.get(catalogFileId);
            const widgetStoreId = catalogStore.catalogWidgets.get(catalogFileId);
            const catalogWidgetStore = WidgetsStore.Instance.catalogWidgets.get(widgetStoreId);

            if (catalogFileId && !catalogWidgetStore.showSelectedData) {
                catalogStore.updateCatalogProfiles(catalogFileId);
                let selectedPointIndex = [];
                const selectedPoint = event.points[0];
                selectedPointIndex.push(selectedPoint.pointIndex);
                catalogProfileStore.setSelectedPointIndices(selectedPointIndex, false);
                catalogWidgetStore.setCatalogTableAutoScroll(true);
            }
        }
    };

    private onDoubleClick() {
        const catalogStore = CatalogStore.Instance;
        if (catalogStore.catalogData.size) {   
            catalogStore.catalogProfileStores.forEach((profileStore) => {   
                const widgetStoreId = CatalogStore.Instance.catalogWidgets.get(profileStore.catalogFileId);
                profileStore.setSelectedPointIndices([], false);
                WidgetsStore.Instance.catalogWidgets.get(widgetStoreId)?.setCatalogTableAutoScroll(false);
            });
        }
    }

    private onWheelCaptured = (event: React.WheelEvent<HTMLDivElement>) => {
        if (event && event.nativeEvent && event.nativeEvent.type === "wheel") {
            const wheelEvent = event.nativeEvent;
            const frame = AppStore.Instance.activeFrame;
            const lineHeight = 15;
            const delta = wheelEvent.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? wheelEvent.deltaY : wheelEvent.deltaY * lineHeight;
            if (frame.wcsInfo && this.props.onZoomed) {
                const cursorPosImageSpace = canvasToTransformedImagePos(wheelEvent.offsetX, wheelEvent.offsetY, frame, this.props.width * 2, this.props.height * 2);
                this.props.onZoomed(frame.getCursorInfo(cursorPosImageSpace), -delta);
            }
        }
    };

    render() {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const width = this.props.width * 2;
        const height = this.props.height * 2;
        // fixed devicePixelRatio 2, 1 / devicePixelRatio will cause point selection bug
        // when user swith devices from devicePixelRatio = 1 to 2
        const scale = 1 / 2;
        const padding = appStore.overlayStore.padding;
        const catalogStore = CatalogStore.Instance;
        let className = "catalog-div";
        if (this.props.docked) {
            className += " docked";
        }

        let layout: Partial<Plotly.Layout> = {
            width: width,
            height: height,
            hovermode: "closest",
            xaxis: {
                autorange: false,
                showgrid: false,
                zeroline: false,
                showline: false,
                showticklabels: false,
            },
            yaxis: {
                autorange: false,
                showgrid: false,
                zeroline: false,
                showline: false,
                showticklabels: false,
            },
            margin: {
                l: 0,
                r: 0,
                b: 0,
                t: 0,
                pad: 0
            },
            showlegend: false,
            dragmode: false,
        };
        const config: Partial<Plotly.Config> = {
            displayModeBar: false,
            showTips: false,
            doubleClick: false,
            displaylogo: false,
            scrollZoom: false,
            showAxisDragHandles: false,
            setBackground: () => {
                return "transparent";
            },
        };

        if (frame) {
            const border = frame.requiredFrameView;
            layout.xaxis.range = [border.xMin, border.xMax];
            layout.yaxis.range = [border.yMin, border.yMax];
        }
        let scatterData: Plotly.Data[] = [];
        const unSelectedData = this.unSelectedData;
        const selectedData = this.selectedData;
        unSelectedData.forEach((data: Plotly.PlotData, fileId) => {
            const catalogWidgetStore = catalogStore.getCatalogWidgetStore(fileId);
            const color = getColorForTheme(catalogWidgetStore.catalogColor);
            data.marker.color = color;
            data.marker.line.color = color;
            data.marker.line.width = 4;
            data.marker.size = catalogWidgetStore.catalogSize * 2;
            data.marker.symbol = catalogWidgetStore.catalogShape;
            scatterData.push(data);   
        });

        if (selectedData) {
            selectedData.forEach((data: Plotly.PlotData, fileId) => {
                const catalogWidgetStore = catalogStore.getCatalogWidgetStore(fileId);
                const highlightColor = getColorForTheme(catalogWidgetStore.highlightColor);
                data.marker.color = highlightColor;
                data.marker.line.color = highlightColor;
                data.marker.line.width = 4;
                data.marker.size = catalogWidgetStore.catalogSize * 2 + 5;

                let outlineShape = catalogWidgetStore.catalogShape;
                if (outlineShape === CatalogOverlayShape.FullCircle) {
                    outlineShape = CatalogOverlayShape.Circle;
                } else if (outlineShape === CatalogOverlayShape.FullStar) {
                    outlineShape = CatalogOverlayShape.Star;
                } else if (outlineShape === CatalogOverlayShape.Plus) {
                    outlineShape = "cross-open" as CatalogOverlayShape;
                } else if (outlineShape === CatalogOverlayShape.Cross) {
                    outlineShape = "x-open" as CatalogOverlayShape;
                }
                data.marker.symbol = outlineShape;

                scatterData.push(data);
            });
        }
        
        return (
            <div className={className} style={{left: padding.left, top: padding.top}} onWheelCapture={this.onWheelCaptured}>
                <Plot
                    className={"catalog-plotly"}
                    data={scatterData}
                    layout={layout}
                    config={config}
                    onClick={this.onClick}
                    onDoubleClick={this.onDoubleClick}
                    style={{transform: `scale(${scale})`, transformOrigin: "top left"}}
                />
            </div>
        );
    }
}