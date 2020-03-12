import {observer} from "mobx-react";
import * as React from "react";
import * as Plotly from "plotly.js";
import Plot from "react-plotly.js";
import {AppStore, OverlayStore} from "stores";
import "./CatalogViewComponent.css";
import {computed} from "mobx";

export interface CatalogViewComponentProps {
    overlaySettings: OverlayStore;
    appStore: AppStore;
    docked: boolean;
}

@observer
export class CatalogViewComponent extends React.Component<CatalogViewComponentProps> {

    @computed get scatterDatasets() {
        const catalogStore = this.props.appStore.catalogStore;
        let scatterDatasets: Plotly.Data[] = [];
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
            scatterDatasets.push(data);
        });
        return scatterDatasets;
    }

    render() {
        const frame = this.props.appStore.activeFrame;
        const width = frame ? frame.renderWidth || 1 : 1;
        const height = frame ? frame.renderHeight || 1 : 1;
        const padding = this.props.overlaySettings.padding;
        let className = "catalog-div";
        if (this.props.docked) {
            className += " docked";
        }

        let layout: Partial<Plotly.Layout> = {
            width: width, 
            height: height,
            paper_bgcolor: "rgba(255,255,255, 0)", 
            plot_bgcolor: "rgba(255,255,255, 0)",
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
            showlegend: false
        };
        const config: Partial<Plotly.Config> = {
            displayModeBar: false
        };

        if (frame) {
            const border = frame.requiredFrameView;
            layout.xaxis.range =  [border.xMin, border.xMax];
            layout.yaxis.range =  [border.yMin, border.yMax];
        }

        return (
            <div className={className} style={{left: padding.left, top: padding.top}}>
                <Plot
                    data={this.scatterDatasets}
                    layout={layout}
                    config={config}
                />
            </div>
        );
    }
}