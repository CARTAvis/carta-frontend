import {observer} from "mobx-react";
import * as React from "react";
import * as Plotly from "plotly.js";
import Plot from "react-plotly.js";
import {AppStore, CatalogStore, OverlayStore} from "stores";
import "./CatalogViewComponent.css";
import {computed} from "mobx";

export interface CatalogViewComponentProps {
    docked: boolean;
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
            paper_bgcolor: "rgba(255,255,255, 0)", 
            plot_bgcolor: "rgba(255,255,255, 0)",
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