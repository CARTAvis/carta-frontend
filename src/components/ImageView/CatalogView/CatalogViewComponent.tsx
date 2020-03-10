import {observer} from "mobx-react";
import * as React from "react";
import Plotly from "plotly.js";
import {AppStore, OverlayStore} from "stores";
import {imageToCanvasPos} from "../RegionView/shared";
import "./CatalogViewComponent.css";

export interface CatalogViewComponentProps {
    overlaySettings: OverlayStore;
    appStore: AppStore;
    docked: boolean;
}

@observer
export class CatalogViewComponent extends React.Component<CatalogViewComponentProps> {
    private scattergl: HTMLElement;

    componentDidMount() {
        this.scattergl = document.getElementById("catalog-div");
    }

    componentDidUpdate() {
        const frame = this.props.appStore.activeFrame;
        const width = frame ? frame.renderWidth || 1 : 1;
        const height = frame ? frame.renderHeight || 1 : 1;
        const dataset = this.updatePlot();

        const layout = {
            width: width, 
            height: height,
            paper_bgcolor: "rgba(255,255,255, 0)", 
            plot_bgcolor: "rgba(255,255,255, 0)",
            xaxis: {
                autorange: false,
                showgrid: false,
                zeroline: false,
                showline: false,
                showticklabels: false,
                range: [0, width]
            },
            yaxis: {
                autorange: false,
                showgrid: false,
                zeroline: false,
                showline: false,
                showticklabels: false,
                range: [height, 0]
            },
            margin: {
                l: 0,
                r: 0,
                b: 0,
                t: 0,
                pad: 0
            }
        };
        const data = [{
            x: dataset.xArray,
            y: dataset.yArray,
            type: "scattergl",
            mode: "markers",
            marker: {
                symbol: dataset.shapeArray, 
                color: dataset.colorArray,
                size: dataset.sizeArray,
                line: {
                    width: 1.5
                }
            }
        }];
        const config = {
            displayModeBar: false,
            hovermode: false
        };
        Plotly.react(this.scattergl, data, layout, config);
    }

    private updatePlot = () => {
        const catalogStore = this.props.appStore.catalogStore;
        const frame = this.props.appStore.activeFrame;
        const width = frame ? frame.renderWidth || 1 : 1;
        const height = frame ? frame.renderHeight || 1 : 1;
        const xArray = [];
        const yArray = [];
        const colorArray = [];
        const sizeArray = [];
        const shapeArray = [];
        
        catalogStore.catalogs.forEach((set, key) => {
            for (let i = 0; i < set.pixelData.length; i++) {
                const pointArray = set.pixelData[i];
                for (let j = 0; j < pointArray.length; j++) {
                    const point = pointArray[j];
                    const currentCenterPixelSpace = imageToCanvasPos(point.x - 1, point.y - 1, frame.requiredFrameView, width, height);
                    xArray.push(currentCenterPixelSpace.x);
                    yArray.push(currentCenterPixelSpace.y);
                    colorArray.push(set.color);
                    sizeArray.push(set.size);
                    shapeArray.push(set.shape);
                }
            }
        });
        return { xArray: xArray, yArray: yArray, colorArray: colorArray, sizeArray: sizeArray, shapeArray: shapeArray };
    }

    render() {
        // dummy values to trigger React's componentDidUpdate()
        const frame = this.props.appStore.activeFrame;
        const catalogStore = this.props.appStore.catalogStore;
        if (frame) {
            const catalogs = catalogStore.catalogs;
            const view = frame.requiredFrameView;
            catalogs.forEach(catalogSettings => {
                const color = catalogSettings.color;
                const size = catalogSettings.size;
                const shape = catalogSettings.shape;
                let total = 0;
                for (const arr of catalogSettings.pixelData) {
                    total += arr.length;
                }
            });
        }
        const padding = this.props.overlaySettings.padding;
        let className = "catalog-div";
        if (this.props.docked) {
            className += " docked";
        }

        return (
            <div className={className} id={"catalog-div"} style={{left: padding.left, top: padding.top}}/>
          );
    }
}