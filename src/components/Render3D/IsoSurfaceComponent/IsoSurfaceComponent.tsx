import * as React from "react";
import {NonIdealState} from "@blueprintjs/core";
import * as _ from "lodash";
import {action, computed, observable} from "mobx";
import {observer} from "mobx-react";

import {LinePlotComponent, LinePlotComponentProps, ResizeDetector} from "components/Shared";
// import {ResizeDetector} from "components/Shared/ResizeDetector/ResizeDetector";
import {Point2D} from "models";
import {AppStore} from "stores";
import {Render3DWidgetStore} from "stores/Widgets";
import {clamp, getColorForTheme} from "utilities";

// import {ContourGeneratorPanelComponent} from "../../Dialogs/ContourDialog/ContourGeneratorPanel/ContourGeneratorPanelComponent";
import "./IsoSurfaceComponent.scss";

@observer
export class IsoSurfaceComponent extends React.Component<{widgetStore: Render3DWidgetStore}> {

    @observable width: number;
    @observable height: number;

    @computed get widgetStore(): Render3DWidgetStore {
        const widgetStore = this.props.widgetStore;
        return widgetStore;
    }

    @computed get plotData(): {values: Array<Point2D>; xMin: number; xMax: number; yMin: number; yMax: number} {
        const widgetStore = this.widgetStore;
        const frame = widgetStore.effectiveFrame;
        if (frame && frame.renderConfig.histogram && frame.renderConfig.histogram.bins && frame.renderConfig.histogram.bins.length) {
            const histogram = frame.renderConfig.histogram;
            alert("histogram: " + histogram);
            let minIndex = 0;
            let maxIndex = histogram.bins.length - 1;

            // Truncate array if zoomed in (sidestepping ChartJS bug with off-canvas rendering and speeding up layout)
            if (!widgetStore.isAutoScaledX) {
                minIndex = Math.floor((widgetStore.minX - histogram.firstBinCenter) / histogram.binWidth);
                minIndex = clamp(minIndex, 0, histogram.bins.length - 1);
                maxIndex = Math.ceil((widgetStore.maxX - histogram.firstBinCenter) / histogram.binWidth);
                maxIndex = clamp(maxIndex, 0, histogram.bins.length - 1);
            }

            let xMin = histogram.firstBinCenter + histogram.binWidth * minIndex;
            let xMax = histogram.firstBinCenter + histogram.binWidth * maxIndex;
            let yMin = histogram.bins[minIndex];
            let yMax = yMin;

            let values: Array<{x: number; y: number}>;
            const N = maxIndex - minIndex;
            if (N > 0 && !isNaN(N)) {
                values = new Array(maxIndex - minIndex);

                for (let i = minIndex; i <= maxIndex; i++) {
                    values[i - minIndex] = {x: histogram.firstBinCenter + histogram.binWidth * i, y: histogram.bins[i]};
                    yMin = Math.min(yMin, histogram.bins[i]);
                    yMax = Math.max(yMax, histogram.bins[i]);
                }
            }
            return {values, xMin, xMax, yMin, yMax};
        }
        return null;
    }

    @action onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    onGraphCursorMoved = _.throttle(x => {
        this.widgetStore.setCursor(x);
    }, 100);
    
    public render() {

        const appStore = AppStore.Instance;
        const widgetStore = this.widgetStore;
        const frame = widgetStore.effectiveFrame;

        if (!frame || !widgetStore) {
            return (
                <div className="isosurface-panel">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </div>
            );
        }

        let unit = "";
        if (frame && frame.headerUnit) {
            unit = frame.headerUnit;
        }

        let linePlotProps: LinePlotComponentProps = {
            xLabel: unit ? `Value (${unit})` : "Value",
            darkMode: appStore.darkTheme,
            logY: widgetStore.logScaleY,
            plotType: widgetStore.plotType,
            showYAxisTicks: false,
            showYAxisLabel: false,
            // graphClicked: this.handleGraphClicked,
            // graphRightClicked: this.handleGraphRightClicked,
            graphZoomedX: widgetStore.setXBounds,
            graphZoomedY: widgetStore.setYBounds,
            graphZoomedXY: widgetStore.setXYBounds,
            graphZoomReset: widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true,
            borderWidth: widgetStore.lineWidth,
            pointRadius: widgetStore.linePlotPointSize,
            zeroLineWidth: 2
        }

        if (frame.renderConfig.histogram && frame.renderConfig.histogram.bins && frame.renderConfig.histogram.bins.length) {
            const currentPlotData = this.plotData;
            if (currentPlotData) {
                linePlotProps.data = currentPlotData.values;
                alert(currentPlotData.values);

                // set line color
                linePlotProps.lineColor = getColorForTheme(widgetStore.primaryLineColor);

                // Determine scale in X and Y directions. If auto-scaling, use the bounds of the current data
                if (widgetStore.isAutoScaledX) {
                    linePlotProps.xMin = currentPlotData.xMin;
                    linePlotProps.xMax = currentPlotData.xMax;
                } else {
                    linePlotProps.xMin = widgetStore.minX;
                    linePlotProps.xMax = widgetStore.maxX;
                }

                if (widgetStore.isAutoScaledY) {
                    linePlotProps.yMin = currentPlotData.yMin;
                    linePlotProps.yMax = currentPlotData.yMax;
                } else {
                    linePlotProps.yMin = widgetStore.minY;
                    linePlotProps.yMax = widgetStore.maxY;
                }
                // Fix log plot min bounds for entries with zeros in them
                if (widgetStore.logScaleY && linePlotProps.yMin <= 0) {
                    linePlotProps.yMin = 0.5;
                }
            }
        }        

        return (
            <div className="isosurface-levels-panel">
                <div className="histogram-plot">
                    <ResizeDetector onResize={this.onResize} throttleTime={33}>
                        <LinePlotComponent {...linePlotProps} />
                    </ResizeDetector>
                </div>
            </div>            
        );
    }
}