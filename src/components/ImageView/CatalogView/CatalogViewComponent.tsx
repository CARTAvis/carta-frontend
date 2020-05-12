import * as React from "react";
import * as Plotly from "plotly.js";
import {observer} from "mobx-react";
import {computed} from "mobx";
import Plot from "react-plotly.js";
import {Colors} from "@blueprintjs/core";
import {AppStore, CatalogStore} from "stores";
import {CatalogOverlayShape} from "stores/widgets";
import {canvasToTransformedImagePos} from "components/ImageView/RegionView/shared";
import {ImageViewLayer} from "../ImageViewComponent";
import {CursorInfo} from "models";
import "./CatalogViewComponent.css";

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

    @computed get unSelectedData(): Map<string, Plotly.Data> {
        const catalogStore = CatalogStore.Instance;
        let coordsData = new Map<string, Plotly.Data>();
        catalogStore.catalogData.forEach((catalog, key) => {
            if (!catalog.showSelectedData) {
                let unSelectedata: Plotly.Data = {};
                unSelectedata.type = "scattergl";
                unSelectedata.mode = "markers";
                unSelectedata.hoverinfo = "none";
                unSelectedata.marker = {};
                unSelectedata.marker.line = {};
                // copy data to trigger react-plotly js update. only update revision number not working, with layout["datarevision"] will slow down the plotly;
                unSelectedata.x = catalog.xImageCoords.slice(0);
                unSelectedata.y = catalog.yImageCoords.slice(0);
                unSelectedata.name = key;
                coordsData.set(key, unSelectedata);
            }
        });
        return coordsData;
    }

    @computed get selectedData(): Map<string, Plotly.Data> {
        const catalogStore = CatalogStore.Instance;
        let coordsData = new Map<string, Plotly.Data>();

        catalogStore.selectedPointIndexs.forEach((selectedPointIndexs, key) => {
            const selectedPointSize = selectedPointIndexs.length;
            let selecteData: Plotly.Data = {};
            if (selectedPointSize > 0) {
                selecteData.type = "scattergl";
                selecteData.mode = "markers";
                selecteData.hoverinfo = "none";
                const coords = catalogStore.catalogData.get(key);
                let selectedX = new Array(selectedPointSize);
                let selectedY = new Array(selectedPointSize);
                for (let index = 0; index < selectedPointSize; index++) {
                    const pointIndex = selectedPointIndexs[index];
                    selectedX.push(coords.xImageCoords[pointIndex]);
                    selectedY.push(coords.yImageCoords[pointIndex]);
                }
                selecteData.x = selectedX;
                selecteData.y = selectedY;
                selecteData.name = key + "-selected";
                selecteData.marker = {};
                selecteData.marker.line = {};
                coordsData.set(key, selecteData);
            }
        });
        return coordsData;
    }

    @computed get catalogColor() {
        const catalogStore = CatalogStore.Instance;
        let catalogColor = new Map<string, string>();
        catalogStore.catalogColor.forEach((color, key) => {
            catalogColor.set(key, color);
        });
        return catalogColor;
    }

    @computed get catalogShape() {
        const catalogStore = CatalogStore.Instance;
        let catalogShape = new Map<string, string>();
        catalogStore.catalogShape.forEach((shape, key) => {
            catalogShape.set(key, shape);
        });
        return catalogShape;
    }

    @computed get catalogSize() {
        const catalogStore = CatalogStore.Instance;
        let catalogSize = new Map<string, number>();
        catalogStore.catalogSize.forEach((size, key) => {
            catalogSize.set(key, size);
        });
        return catalogSize;
    }

    private onClick = (event: Readonly<Plotly.PlotMouseEvent>) => {
        const appStore = AppStore.Instance;
        if (event && event.points && event.points.length > 0) {
            const catalogWidgetId = event.points[0].data.name;
            const catalogWidget = appStore.widgetsStore.catalogOverlayWidgets.get(catalogWidgetId);
            if (catalogWidget) {
                let selectedPointIndex = [];
                const selectedPoint = event.points[0];
                selectedPointIndex.push(selectedPoint.pointIndex);
                catalogWidget.setselectedPointIndexs(selectedPointIndex, true);
                appStore.catalogStore.updateSelectedPoints(catalogWidgetId, selectedPointIndex);
            }
        }
    }

    private onWheelCaptured = (event: React.WheelEvent<HTMLDivElement>) => {
        if (event && event.nativeEvent && event.nativeEvent.type === "wheel") {
            const wheelEvent = event.nativeEvent;
            const frame = AppStore.Instance.activeFrame;
            const lineHeight = 15;
            const delta = wheelEvent.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? wheelEvent.deltaY : wheelEvent.deltaY * lineHeight;
            if (frame.wcsInfo && this.props.onZoomed) {
                const cursorPosImageSpace = canvasToTransformedImagePos(wheelEvent.offsetX, wheelEvent.offsetY, frame, this.props.width, this.props.height);
                this.props.onZoomed(frame.getCursorInfo(cursorPosImageSpace), -delta);
            }
        }
    }

    render() {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const width = this.props.width;
        const height = this.props.height;
        const padding = appStore.overlayStore.padding;
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
            setBackground: () => { return "transparent"; },
        };

        if (frame) {
            const border = frame.requiredFrameView;
            layout.xaxis.range =  [border.xMin, border.xMax];
            layout.yaxis.range =  [border.yMin, border.yMax];
        }
        let scatterData: Plotly.Data[] = [];
        const unSelectedData = this.unSelectedData;
        const selectedData = this.selectedData;
        const catalogColor = this.catalogColor;
        const catalogSize = this.catalogSize;
        const catalogShape = this.catalogShape;
        unSelectedData.forEach((data, widgetId) => {
            const color = catalogColor.get(widgetId);
            if (color) {
                data.marker.color = color;
                data.marker.line.color = color;
                data.marker.line.width = 2;
            }

            const size = catalogSize.get(widgetId);
            if (size) {
                data.marker.size = size * devicePixelRatio;
            }

            const shape = catalogShape.get(widgetId);
            if (shape) {
                data.marker.symbol = shape;
            }
            scatterData.push(data);
        });

        if (selectedData) {
            selectedData.forEach((data, widgetId) => {
                data.marker.color = Colors.RED2;
                data.marker.line.color = Colors.RED2;
                data.marker.line.width = 2;
    
                const size = catalogSize.get(widgetId);
                if (size) {
                    data.marker.size = size * devicePixelRatio + 4;
                }
                let outlineShape = catalogShape.get(widgetId);
                if (outlineShape) {
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
                }
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
                />
            </div>
        );
    }
}