import {observer} from "mobx-react";
import * as React from "react";
import * as Plotly from "plotly.js";
import {AppStore, OverlayStore} from "stores";
import {imageToCanvasPos} from "../RegionView/shared";
import "./CatalogViewComponent.css";
import {computed} from "mobx";

export interface CatalogViewComponentProps {
    overlaySettings: OverlayStore;
    appStore: AppStore;
    docked: boolean;
}

@observer
export class CatalogViewComponent extends React.Component<CatalogViewComponentProps> {
    private scattergl: HTMLElement;
    private sctterDataset: Plotly.Data[] = [];

    componentDidMount() {
        this.scattergl = document.getElementById("catalog-div");
    }

    componentDidUpdate() {
        const frame = this.props.appStore.activeFrame;
        if (frame) {
            const width = frame ? frame.renderWidth || 1 : 1;
            const height = frame ? frame.renderHeight || 1 : 1;
            const border = frame.requiredFrameView;
            const layout: Partial<Plotly.Layout> = {
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
                    range: [border.xMin, border.xMax]
                },
                yaxis: {
                    autorange: false,
                    showgrid: false,
                    zeroline: false,
                    showline: false,
                    showticklabels: false,
                    range: [border.yMin, border.yMax]
                },
                margin: {
                    l: 0,
                    r: 0,
                    b: 0,
                    t: 0,
                    pad: 0
                },
                showlegend: false
            };

            const config: Partial<Plotly.Config> = {
                displayModeBar: false
            };
            Plotly.react(this.scattergl, this.sctterDataset, layout, config);
        }
    }

    @computed get updatePlot() {
        const catalogStore = this.props.appStore.catalogStore;
        this.sctterDataset = [];
        catalogStore.catalogs.forEach((catalog, key) => {
            let data: Plotly.Data = {};
            data.type = "scattergl";
            data.mode = "markers";
            data.marker = {
                symbol: catalog.shape, 
                color: catalog.color,
                size: catalog.size,
                line: {
                    width: 1.5
                }
            };
            let xArray = [];
            let yArray = [];
            for (let i = 0; i < catalog.xImageCoords.length; i++) {
                xArray.push(...catalog.xImageCoords[i]);
                yArray.push(...catalog.yImageCoords[i]);
            }
            data.x = xArray;
            data.y = yArray;
            this.sctterDataset.push(data);
        });
        return true;
    }

    render() {
        // dummy values to trigger React's componentDidUpdate()
        const frame = this.props.appStore.activeFrame;
        const catalogStore = this.props.appStore.catalogStore;
        if (frame && this.updatePlot) {
            const catalogs = catalogStore.catalogs;
            const view = frame.requiredFrameView;
            catalogs.forEach(catalogSettings => {
                const color = catalogSettings.color;
                const size = catalogSettings.size;
                const shape = catalogSettings.shape;
                let total = 0;
                for (const arr of catalogSettings.xImageCoords) {
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