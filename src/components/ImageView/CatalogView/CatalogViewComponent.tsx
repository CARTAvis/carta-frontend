import * as React from "react";
import * as Plotly from "plotly.js";
import {observer} from "mobx-react";
import {makeObservable} from "mobx";
import Plot from "react-plotly.js";
import {AppStore, CatalogStore, WidgetsStore} from "stores";
// import {CatalogOverlayShape} from "stores/widgets";
import {canvasToTransformedImagePos} from "components/ImageView/RegionView/shared";
import {ImageViewLayer} from "../ImageViewComponent";
import {CursorInfo} from "models";
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

    constructor(props: CatalogViewComponentProps) {
        super(props);
        makeObservable(this);
    }

    // @computed get unSelectedData(): Plotly.Data[] {
    //     const catalogStore = CatalogStore.Instance;
    //     let scatterData: Plotly.Data[] = [];
    //     catalogStore.catalogData.forEach((catalog, fileId) => {
    //         const catalogWidgetStore = catalogStore.getCatalogWidgetStore(fileId);
    //         if (!catalogWidgetStore.showSelectedData) {
    //             let unSelecteData: Partial<Plotly.PlotData> = {};
    //             unSelecteData.type = "scattergl";
    //             unSelecteData.mode = "markers";
    //             unSelecteData.hoverinfo = "none";
    //             unSelecteData.visible = catalog.displayed;
    //             // copy data to trigger react-plotly js update. only update revision number not working. with layout["datarevision"] will slow down plotly;
    //             unSelecteData.x = catalog.xImageCoords.slice(0);
    //             unSelecteData.y = catalog.yImageCoords.slice(0);
 
    //             unSelecteData.marker = {
    //                 symbol: catalogWidgetStore.catalogShape,
    //                 sizemode: catalogWidgetStore.sizeMapType,
    //                 line: {
    //                     width: 4
    //                 }
    //             };

    //             if (!catalogWidgetStore.disableSizeMap) {
    //                 unSelecteData.marker.size = catalogWidgetStore.sizeArray;
    //             } else {
    //                 unSelecteData.marker.size = catalogWidgetStore.catalogSize;
    //             }

    //             if (!catalogWidgetStore.disableColorMap) {
    //                 unSelecteData.marker.color = catalogWidgetStore.colorArray;
    //             } else {
    //                 unSelecteData.marker.color = catalogWidgetStore.catalogColor; 
    //             }
    //             unSelecteData.name = fileId.toString();
    //             scatterData.push(unSelecteData);
    //         }
    //     });
    //     return scatterData;
    // }

    // @computed get selectedData(): Plotly.Data[] {
    //     const catalogStore = CatalogStore.Instance;
    //     let scatterData: Plotly.Data[] = [];
    //     catalogStore.catalogProfileStores.forEach((profileStore) => {    
    //         const selectedPoints = profileStore.selectedPointIndices;
    //         const selectedPointSize = selectedPoints.length;
    //         const fileId = profileStore.catalogFileId;
    //         const selectedData = catalogStore.selectedCatalogData.get(fileId);
    //         let selecteData: Partial<Plotly.PlotData> = {};

    //         if (selectedPointSize && selectedData?.xSelectedCoords?.length) {
    //             const coords = catalogStore.catalogData.get(fileId);
    //             const catalogWidgetStore = catalogStore.getCatalogWidgetStore(fileId);
    //             selecteData.type = "scattergl";
    //             selecteData.mode = "markers";
    //             selecteData.hoverinfo = "none";
    //             selecteData.visible = coords.displayed;              
    //             selecteData.x = selectedData.xSelectedCoords.slice(0);
    //             selecteData.y = selectedData.ySelectedCoords.slice(0);
    //             selecteData.name = fileId.toString();

    //             let outlineShape = catalogWidgetStore.catalogShape;
    //             if (outlineShape === CatalogOverlayShape.FullCircle) {
    //                 outlineShape = CatalogOverlayShape.Circle;
    //             } else if (outlineShape === CatalogOverlayShape.FullStar) {
    //                 outlineShape = CatalogOverlayShape.Star;
    //             } else if (outlineShape === CatalogOverlayShape.Plus) {
    //                 outlineShape = "cross-open" as CatalogOverlayShape;
    //             } else if (outlineShape === CatalogOverlayShape.Cross) {
    //                 outlineShape = "x-open" as CatalogOverlayShape;
    //             }

    //             selecteData.marker = {
    //                 color: catalogWidgetStore.highlightColor,
    //                 symbol: outlineShape,
    //                 sizemode: catalogWidgetStore.sizeMapType,
    //                 line: {
    //                     color: catalogWidgetStore.highlightColor,
    //                     width: 4
    //                 }
    //             };

    //             if (!catalogWidgetStore.disableSizeMap) {
    //                 const sizeMap = new Array(selectedPointSize);
    //                 for (let index = 0; index < selectedPointSize; index++) {
    //                     const i = selectedPoints[index];
    //                     sizeMap[index] = catalogWidgetStore.sizeArray[i] + 5;
    //                 }
    //                 selecteData.marker.size = sizeMap;
    //             } else {
    //                 selecteData.marker.size = catalogWidgetStore.catalogSize + 5;
    //             }

    //             scatterData.push(selecteData);
                
    //         }
    //     });
    //     return scatterData;
    // }

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

    // private onDoubleClick() {
    //     const catalogStore = CatalogStore.Instance;
    //     if (catalogStore.catalogData.size) {   
    //         catalogStore.catalogProfileStores.forEach((profileStore) => {   
    //             const widgetStoreId = CatalogStore.Instance.catalogWidgets.get(profileStore.catalogFileId);
    //             profileStore.setSelectedPointIndices([], false);
    //             WidgetsStore.Instance.catalogWidgets.get(widgetStoreId)?.setCatalogTableAutoScroll(false);
    //         });
    //     }
    // }

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
        // const unSelectedData = this.unSelectedData;
        // const selectedData = this.selectedData;
        // unSelectedData.forEach((data: Plotly.PlotData) => {
        //     scatterData.push(data);   
        // });

        // if (selectedData) {
        //     selectedData.forEach((data: Plotly.PlotData) => {
        //         scatterData.push(data);
        //     });
        // }
        
        return (
            <div className={className} style={{left: padding.left, top: padding.top}} onWheelCapture={this.onWheelCaptured}>
                <Plot
                    className={"catalog-plotly"}
                    data={scatterData}
                    layout={layout}
                    config={config}
                    onClick={this.onClick}
                    // onDoubleClick={this.onDoubleClick}
                    style={{transform: `scale(${scale})`, transformOrigin: "top left"}}
                />
            </div>
        );
    }
}