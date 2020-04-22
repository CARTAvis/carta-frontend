import * as React from "react";
import * as Plotly from "plotly.js";
import {observer} from "mobx-react";
import {computed} from "mobx";
import Plot from "react-plotly.js";
import {AppStore, CatalogStore, OverlayStore, FrameStore} from "stores";
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

    @computed get scatterDatasets() {
        const catalogStore = CatalogStore.Instance;
        let scatterDatasets: Plotly.Data[] = [];

        catalogStore.catalogs.forEach((catalog, key) => {
            const selectedPointIndexs = catalog.selectedPointIndexs;
            let data: Plotly.Data = {};
            let xArray = [];
            let yArray = [];

            data.type = "scattergl";
            data.mode = "markers";
            data.hoverinfo = "none";
            data.marker = {
                symbol: catalog.shape, 
                color: catalog.color,
                size: catalog.size,
                line: {
                    width: 1.5
                }
            };

            for (let i = 0; i < catalog.xImageCoords.length; i++) {
                xArray.push(...catalog.xImageCoords[i]);
                yArray.push(...catalog.yImageCoords[i]);
            }

            data.x = xArray;
            data.y = yArray;
            data.name = key;
            if (selectedPointIndexs.length > 0) {
                data["selectedpoints"] = selectedPointIndexs;
                let opacity = 0.2;
                if (catalog.showSelectedData) {
                    opacity = 0;
                }
                data["unselected"] = {"marker": {"opacity": opacity}};
            } else {
                data["selectedpoints"] = [];
                data["unselected"] = {"marker": {"opacity": 1}};
            }

            scatterDatasets.push(data);
        });
        return scatterDatasets;
    }

    private onClick = (event: Readonly<Plotly.PlotMouseEvent>) => {
        const appStore = AppStore.Instance
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
        const width = frame ? frame.renderWidth || 1 : 1;
        const height = frame ? frame.renderHeight || 1 : 1;
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
                showticklabels: false
            },
            yaxis: {
                autorange: false,
                showgrid: false,
                zeroline: false,
                showline: false,
                showticklabels: false
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

        return (
            <div className={className} style={{left: padding.left, top: padding.top}} onWheelCapture={this.onWheelCaptured}>
                <Plot
                    className={"catalog-plotly"}
                    data={this.scatterDatasets}
                    layout={layout}
                    config={config}
                    onClick={this.onClick}
                />
            </div>
        );
    }
}