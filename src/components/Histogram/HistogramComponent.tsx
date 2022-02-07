import * as React from "react";
import * as _ from "lodash";
import ReactResizeDetector from "react-resize-detector";
import classNames from "classnames";
import {action, autorun, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {NonIdealState} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {HistogramToolbarComponent} from "./HistogramToolbarComponent/HistogramToolbarComponent";
import {LinePlotComponent, LinePlotComponentProps, ProfilerInfoComponent} from "components/Shared";
import {TickType} from "../Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {HistogramWidgetStore} from "stores/widgets";
import {FrameStore, WidgetProps, HelpType, WidgetsStore, AppStore, DefaultWidgetConfig} from "stores";
import {clamp, getColorForTheme, toExponential, toFixed, formattedExponential} from "utilities";
import {Point2D} from "models";
import "./HistogramComponent.scss";

@observer
export class HistogramComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "histogram",
            type: "histogram",
            minWidth: 400,
            minHeight: 225,
            defaultWidth: 650,
            defaultHeight: 225,
            title: "Histogram",
            isCloseable: true,
            helpType: HelpType.HISTOGRAM
        };
    }

    private cachedFrame: FrameStore;

    @observable width: number;
    @observable height: number;

    @computed get widgetStore(): HistogramWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.histogramWidgets) {
            const widgetStore = widgetsStore.histogramWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new HistogramWidgetStore();
    }

    @computed get histogramData(): CARTA.IHistogram {
        const appStore = AppStore.Instance;

        if (this.widgetStore.effectiveFrame) {
            let fileId = this.widgetStore.effectiveFrame.frameInfo.fileId;
            let regionId = this.widgetStore.effectiveRegionId;
            let coordinate = this.widgetStore.coordinate;

            const frameMap = appStore.regionHistograms.get(fileId);
            if (!frameMap) {
                return null;
            }
            const regionMap = frameMap.get(regionId);
            if (!regionMap) {
                return null;
            }
            const stokes = this.widgetStore.effectiveFrame.stokesInfo.findIndex(stokes => stokes.replace("Stokes ", "") === coordinate.slice(0, coordinate.length - 1));
            const regionHistogramData = regionMap.get(stokes === -1 ? this.widgetStore.effectiveFrame.requiredStokes : stokes);
            if (!regionHistogramData) {
                return null;
            }
            return regionHistogramData.histograms;
        }
        return null;
    }

    @computed get plotData(): {values: Array<Point2D>; xMin: number; xMax: number; yMin: number; yMax: number} {
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

    @computed get exportHeaders(): string[] {
        let headerString = [];

        // region info
        const frame = this.widgetStore.effectiveFrame;
        if (frame && frame.frameInfo && frame.regionSet) {
            const regionId = this.widgetStore.effectiveRegionId;
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);
            if (region) {
                headerString.push(region.regionProperties);
            }
        }

        return headerString;
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        const appStore = AppStore.Instance;
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === HistogramComponent.WIDGET_CONFIG.type) {
            // Assign the next unique ID
            const id = appStore.widgetsStore.addHistogramWidget();
            appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!appStore.widgetsStore.histogramWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                appStore.widgetsStore.histogramWidgets.set(this.props.id, new HistogramWidgetStore());
            }
        }
        // Update widget title when region or coordinate changes
        autorun(() => {
            if (this.widgetStore && this.widgetStore.effectiveFrame) {
                let regionString = "Unknown";
                const regionId = this.widgetStore.effectiveRegionId;

                if (regionId === -1) {
                    regionString = "Image";
                } else if (this.widgetStore.effectiveFrame.regionSet) {
                    const region = this.widgetStore.effectiveFrame.regionSet.regions.find(r => r.regionId === regionId);
                    if (region) {
                        regionString = region.nameString;
                    }
                }
                const selectedString = this.widgetStore.matchesSelectedRegion ? "(Active)" : "";
                appStore.widgetsStore.setWidgetTitle(this.props.id, `Histogram: ${regionString} ${selectedString}`);
            } else {
                appStore.widgetsStore.setWidgetTitle(this.props.id, `Histogram`);
            }
            const widgetStore = this.widgetStore;
            if (widgetStore) {
                const currentData = this.plotData;
                if (currentData) {
                    widgetStore.initXYBoundaries(currentData.xMin, currentData.xMax, currentData.yMin, currentData.yMax);
                }
            }
        });
    }

    componentDidUpdate() {
        const frame = this.widgetStore.effectiveFrame;

        if (frame !== this.cachedFrame) {
            this.cachedFrame = frame;
            this.widgetStore.clearXYBounds();
        }
    }

    @action onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    onGraphCursorMoved = _.throttle(x => {
        this.widgetStore.setCursor(x);
    }, 100);

    private genProfilerInfo = (): string[] => {
        let profilerInfo: string[] = [];
        if (this.widgetStore.isMouseMoveIntoLinePlots) {
            let numberString;
            // Switch between standard and scientific notation
            if (this.widgetStore.cursorX < 1e-2) {
                numberString = toExponential(this.widgetStore.cursorX, 2);
            } else {
                numberString = toFixed(this.widgetStore.cursorX, 2);
            }

            const frame = AppStore.Instance.activeFrame;
            if (frame.unit) {
                numberString += ` ${frame.unit}`;
            }
            profilerInfo.push(`Cursor: ${numberString}`);
        } else {
            // get value directly from cursor Value
            const frame = AppStore.Instance.activeFrame;
            const cursorX = `${frame.cursorValue.position.x} px`;
            const cursorY = `${frame.cursorValue.position.y} px`;
            const cursorValue = `${formattedExponential(frame.cursorValue.value, 5)}`;
            profilerInfo.push("Data: (" + cursorX + ", " + cursorY + ", " + cursorValue + ")");
        }
        return profilerInfo;
    };

    render() {
        const appStore = AppStore.Instance;
        const frame = this.widgetStore.effectiveFrame;

        if (!frame || !this.widgetStore) {
            return (
                <div className="histogram-widget">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </div>
            );
        }

        let unitString = "Value";
        if (frame && frame.unit) {
            unitString = `Value (${frame.unit})`;
        }

        const imageName = frame.filename;
        const plotName = `channel ${frame.channel} histogram`;
        let linePlotProps: LinePlotComponentProps = {
            xLabel: unitString,
            yLabel: "Count",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: plotName,
            logY: this.widgetStore.logScaleY,
            plotType: this.widgetStore.plotType,
            tickTypeY: TickType.Scientific,
            graphZoomedX: this.widgetStore.setXBounds,
            graphZoomedY: this.widgetStore.setYBounds,
            graphZoomedXY: this.widgetStore.setXYBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true,
            mouseEntered: this.widgetStore.setMouseMoveIntoLinePlots,
            borderWidth: this.widgetStore.lineWidth,
            pointRadius: this.widgetStore.linePlotPointSize,
            zeroLineWidth: 2
        };

        if (frame.renderConfig.histogram && frame.renderConfig.histogram.bins && frame.renderConfig.histogram.bins.length) {
            const currentPlotData = this.plotData;
            if (currentPlotData) {
                linePlotProps.data = currentPlotData.values;

                // set line color
                let primaryLineColor = getColorForTheme(this.widgetStore.primaryLineColor);
                linePlotProps.lineColor = primaryLineColor;

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

            linePlotProps.comments = this.exportHeaders;
        }

        const className = classNames("histogram-widget", {"bp3-dark": appStore.darkTheme});

        return (
            <div className={className}>
                <div className="histogram-container">
                    <HistogramToolbarComponent widgetStore={this.widgetStore} />
                    <div className="histogram-plot">
                        <LinePlotComponent {...linePlotProps} />
                    </div>
                    <div>
                        <ProfilerInfoComponent info={this.genProfilerInfo()} />
                    </div>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"}></ReactResizeDetector>
            </div>
        );
    }
}
