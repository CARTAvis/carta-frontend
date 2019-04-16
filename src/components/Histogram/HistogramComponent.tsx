import * as React from "react";
import * as _ from "lodash";
import ReactResizeDetector from "react-resize-detector";
import {action, autorun, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Chart} from "chart.js";
import {NonIdealState} from "@blueprintjs/core";
import {HistogramSettingsPanelComponent} from "./HistogramSettingsPanelComponent/HistogramSettingsPanelComponent";
import {PopoverSettingsComponent, LinePlotComponent, LinePlotComponentProps, PlotType} from "components/Shared";
import {HistogramWidgetStore} from "stores/widgets";
import {FrameStore, WidgetConfig, WidgetProps} from "stores";
import {clamp} from "utilities";
import {Point2D} from "models";
import "./HistogramComponent.css";
import {CARTA} from "../../../protobuf/build";
import {HistogramToolbarComponent} from "./HistogramToolbarComponent/HistogramToolbarComponent";

// The fixed size of the settings panel popover (excluding the show/hide button)
const PANEL_CONTENT_WIDTH = 180;

@observer
export class HistogramComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "histogram",
            type: "histogram",
            minWidth: 400,
            minHeight: 225,
            defaultWidth: 650,
            defaultHeight: 225,
            title: "Histogram",
            isCloseable: true
        };
    }

    private cachedFrame: FrameStore;

    @observable width: number;
    @observable height: number;

    @computed get widgetStore(): HistogramWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.histogramWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.histogramWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new HistogramWidgetStore();
    }

    @computed get settingsPanelWidth(): number {
        return 20 + (this.widgetStore.settingsPanelVisible ? PANEL_CONTENT_WIDTH : 0);
    }

    @computed get histogramData(): CARTA.IHistogram {
        const appStore = this.props.appStore;

        if (appStore.activeFrame) {
            let fileId = appStore.activeFrame.frameInfo.fileId;
            let regionId = this.widgetStore.regionIdMap.get(fileId) || -1;

            // // Image histograms handled slightly differently
            // if (regionId === -1) {
            //     const frame = appStore.getFrame(fileId);
            //     if (frame && frame.renderConfig && frame.renderConfig.channelHistogram) {
            //
            //     }
            // }

            const frameMap = appStore.regionHistograms.get(fileId);
            if (!frameMap) {
                return null;
            }
            const data = frameMap.get(regionId);
            if (data && data.histograms && data.histograms.length) {
                return data.histograms[0];
            }
        }
        return null;
    }

    @computed get plotData(): { values: Array<Point2D>, xMin: number, xMax: number, yMin: number, yMax: number } {
        const histogram = this.histogramData;
        if (histogram) {
            let minIndex = 0;
            let maxIndex = histogram.bins.length - 1;

            // Truncate array if zoomed in (sidestepping ChartJS bug with off-canvas rendering and speeding up layout)
            if (!this.widgetStore.isAutoScaledX) {
                minIndex = Math.floor((this.widgetStore.minX - histogram.firstBinCenter) / histogram.binWidth);
                minIndex = clamp(minIndex, 0, histogram.bins.length - 1);
                maxIndex = Math.ceil((this.widgetStore.maxX - histogram.firstBinCenter) / histogram.binWidth);
                maxIndex = clamp(maxIndex, 0, histogram.bins.length - 1);
            }

            let xMin = histogram.firstBinCenter + histogram.binWidth * minIndex;
            let xMax = histogram.firstBinCenter + histogram.binWidth * maxIndex;
            let yMin = histogram.bins[minIndex];
            let yMax = yMin;

            let values: Array<{ x: number, y: number }>;
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

    constructor(props: WidgetProps) {
        super(props);
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === HistogramComponent.WIDGET_CONFIG.type) {
            // Assign the next unique ID
            const id = props.appStore.widgetsStore.addHistogramWidget();
            props.appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!this.props.appStore.widgetsStore.histogramWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                this.props.appStore.widgetsStore.histogramWidgets.set(this.props.id, new HistogramWidgetStore());
            }
        }
        // Update widget title when region or coordinate changes
        autorun(() => {
            const appStore = this.props.appStore;
            if (this.widgetStore && appStore.activeFrame) {
                let regionString = "Unknown";
                const regionId = this.widgetStore.regionIdMap.get(appStore.activeFrame.frameInfo.fileId) || -1;

                if (regionId === -1) {
                    regionString = "Image";
                } else if (appStore.activeFrame.regionSet) {
                    const region = appStore.activeFrame.regionSet.regions.find(r => r.regionId === regionId);
                    if (region) {
                        regionString = region.nameString;
                    }
                }
                appStore.widgetsStore.setWidgetTitle(this.props.id, `Histogram: ${regionString}`);
            } else {
                appStore.widgetsStore.setWidgetTitle(this.props.id, `Histogram`);
            }
        });
    }

    componentDidUpdate() {
        const frame = this.props.appStore.activeFrame;

        if (frame !== this.cachedFrame) {
            this.cachedFrame = frame;
            this.widgetStore.clearXYBounds();
        }
    }

    @action onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    onGraphCursorMoved = _.throttle((x) => {
        this.widgetStore.setCursor(x);
    }, 100);

    render() {
        const appStore = this.props.appStore;
        const frame = appStore.activeFrame;

        if (!frame || !this.widgetStore) {
            return (
                <div className="histogram-widget">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>
                </div>
            );
        }

        let unitString = "Value";
        if (frame && frame.unit) {
            unitString = `Value (${frame.unit})`;
        }

        const imageName = frame.frameInfo.fileInfo.name;
        const plotName = `channel ${frame.channel} histogram`;
        let linePlotProps: LinePlotComponentProps = {
            xLabel: unitString,
            yLabel: "Count",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: plotName,
            logY: this.widgetStore.logScaleY,
            usePointSymbols: this.widgetStore.plotType === PlotType.POINTS,
            interpolateLines: this.widgetStore.plotType === PlotType.LINES,
            forceScientificNotationTicksY: true,
            graphZoomedX: this.widgetStore.setXBounds,
            graphZoomedY: this.widgetStore.setYBounds,
            graphZoomedXY: this.widgetStore.setXYBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true
        };

        if (frame.renderConfig.histogram && frame.renderConfig.histogram.bins && frame.renderConfig.histogram.bins.length) {
            const currentPlotData = this.plotData;
            if (currentPlotData) {
                linePlotProps.data = currentPlotData.values;
                // Determine scale in X and Y directions. If auto-scaling, use the bounds of the current data
                if (this.widgetStore.isAutoScaledX) {
                    linePlotProps.xMin = currentPlotData.xMin;
                    linePlotProps.xMax = currentPlotData.xMax;
                } else {
                    linePlotProps.xMin = this.widgetStore.minX;
                    linePlotProps.xMax = this.widgetStore.maxX;
                }

                if (this.widgetStore.isAutoScaledY) {
                    linePlotProps.yMin = currentPlotData.yMin;
                    linePlotProps.yMax = currentPlotData.yMax;
                } else {
                    linePlotProps.yMin = this.widgetStore.minY;
                    linePlotProps.yMax = this.widgetStore.maxY;
                }
                // Fix log plot min bounds for entries with zeros in them
                if (this.widgetStore.logScaleY && linePlotProps.yMin <= 0) {
                    linePlotProps.yMin = 0.5;
                }
            }
        }

        return (
            <div className="histogram-widget">
                <div className="histogram-container">
                    <HistogramToolbarComponent widgetStore={this.widgetStore} appStore={appStore}/>
                    <div className="histogram-plot">
                        <LinePlotComponent {...linePlotProps}/>
                    </div>
                </div>
                <PopoverSettingsComponent
                    isOpen={this.widgetStore.settingsPanelVisible}
                    onShowClicked={this.widgetStore.showSettingsPanel}
                    onHideClicked={this.widgetStore.hideSettingsPanel}
                    contentWidth={PANEL_CONTENT_WIDTH}
                >
                    <HistogramSettingsPanelComponent widgetStore={this.widgetStore}/>
                </PopoverSettingsComponent>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"}/>
            </div>
        );
    }
}
