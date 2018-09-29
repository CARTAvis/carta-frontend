import * as React from "react";
import * as _ from "lodash";
import ReactResizeDetector from "react-resize-detector";
import {observer} from "mobx-react";
import {FormGroup, HTMLSelect, NonIdealState, ButtonGroup, Button, Colors, IOptionProps, NumericInput} from "@blueprintjs/core";
import {Chart, ChartArea} from "chart.js";
import {LinePlotComponent, LinePlotComponentProps} from "../Shared/LinePlot/LinePlotComponent";
import {AppStore} from "../../stores/AppStore";
import {FrameStore} from "../../stores/FrameStore";
import {FrameScaling} from "../../stores/RenderConfigStore";
import {WidgetConfig} from "../../stores/widgets/FloatingWidgetStore";
import {ColormapConfigComponent} from "./ColormapConfigComponent/ColormapConfigComponent";
import {clamp} from "../../util/math";
import "./RenderConfigComponent.css";
import {computed, observable} from "mobx";
import {Point2D} from "../../models/Point2D";

class RenderConfigComponentProps {
    appStore: AppStore;
    id: string;
    docked: boolean;
}

@observer
export class RenderConfigComponent extends React.Component<RenderConfigComponentProps> {
    private cachedFrame: FrameStore;

    @observable width: number;
    @observable height: number;
    @observable chartArea: ChartArea;

    @computed get plotData(): { values: Array<Point2D>, xMin: number, xMax: number, yMin: number, yMax: number } {
        const frame = this.props.appStore.activeFrame;
        const widgetStore = this.props.appStore.renderConfigWidgetStore;
        if (frame && frame.renderConfig.channelHistogram && frame.renderConfig.channelHistogram.bins && frame.renderConfig.channelHistogram.bins.length) {
            const histogram = frame.renderConfig.channelHistogram;
            let minIndex = 0;
            let maxIndex = histogram.bins.length - 1;

            // Truncate array if zoomed in (sidestepping ChartJS bug with off-canvas rendering and speeding up layout)
            if (!widgetStore.isAutoScaled) {
                minIndex = Math.floor((widgetStore.minX - histogram.firstBinCenter) / histogram.binWidth);
                minIndex = clamp(minIndex, 0, histogram.bins.length - 1);
                maxIndex = Math.ceil((widgetStore.maxX - histogram.firstBinCenter) / histogram.binWidth);
                maxIndex = clamp(maxIndex, 0, histogram.bins.length - 1);
            }

            let xMin = histogram.firstBinCenter + histogram.binWidth * minIndex;
            let xMax = histogram.firstBinCenter + histogram.binWidth * maxIndex;
            let yMin = histogram.bins[minIndex];
            let yMax = yMin;

            const N = maxIndex - minIndex;
            if (N > 0 && !isNaN(N)) {
                const plotVals = new Array(maxIndex - minIndex);

                for (let i = minIndex; i <= maxIndex; i++) {
                    plotVals[i - minIndex] = {x: histogram.firstBinCenter + histogram.binWidth * i, y: histogram.bins[i]};
                    yMin = Math.min(yMin, histogram.bins[i]);
                    yMax = Math.max(yMax, histogram.bins[i]);
                    // Sanitize zero values to prevent scaling issues with log graphs
                    if (plotVals[i - minIndex].y < 0.1) {
                        plotVals[i - minIndex].y = undefined;
                    }
                }
                return {values: plotVals, xMin, xMax, yMin, yMax};
            }
        }

        return null;

    }

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "render-config",
            type: "render-config",
            minWidth: 250,
            minHeight: 225,
            defaultWidth: 650,
            defaultHeight: 225,
            title: "Render Configuration",
            isCloseable: true
        };
    }

    constructor(props: RenderConfigComponentProps) {
        super(props);
    }

    componentDidUpdate() {
        const frame = this.props.appStore.activeFrame;
        const widgetStore = this.props.appStore.renderConfigWidgetStore;

        if (frame !== this.cachedFrame) {
            this.cachedFrame = frame;
            widgetStore.clearBounds();
        }
    }

    handleColorMapChange = (newColorMap: string) => {
        this.props.appStore.activeFrame.renderConfig.setColorMap(newColorMap);
    };

    handleScalingChange = (scaling: FrameScaling) => {
        this.props.appStore.activeFrame.renderConfig.setScaling(scaling);
    };

    handleScaleMinChange = (val: number) => {
        if (isFinite(val)) {
            this.props.appStore.activeFrame.renderConfig.setCustomScale(val, this.props.appStore.activeFrame.renderConfig.scaleMax);
        }
    };

    handleScaleMaxChange = (val: number) => {
        if (isFinite(val)) {
            this.props.appStore.activeFrame.renderConfig.setCustomScale(this.props.appStore.activeFrame.renderConfig.scaleMin, val);
        }
    };

    onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    handlePercentileRankClick = (value: number) => {
        if (!this.props.appStore.activeFrame.renderConfig.setPercentileRank(value)) {
            this.props.appStore.alertStore.showAlert(`Couldn't set percentile of rank ${value}%`);
            this.props.appStore.logStore.addError(`Couldn't set percentile of rank ${value}%`, ["render"]);
        }
    };

    handlePercentileRankSelectChanged = (event: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.appStore.activeFrame.renderConfig.setPercentileRank(+event.currentTarget.value);
    };

    setCustomPercentileRank = () => {
        this.props.appStore.activeFrame.renderConfig.setPercentileRank(-1);
    };

    onMinMoved = (x: number) => {
        const frame = this.props.appStore.activeFrame;
        // Check bounds first, to make sure the max isn't being moved below the min
        if (frame && frame.renderConfig && x < frame.renderConfig.scaleMax) {
            frame.renderConfig.setCustomScale(x, frame.renderConfig.scaleMax);
            frame.renderConfig.scaleMin = x;
        }
    };

    onMaxMoved = (x: number) => {
        const frame = this.props.appStore.activeFrame;
        // Check bounds first, to make sure the max isn't being moved below the min
        if (frame && frame.renderConfig && x > frame.renderConfig.scaleMin) {
            frame.renderConfig.setCustomScale(frame.renderConfig.scaleMin, x);
        }
    };

    onGraphZoomed = (xMin: number, xMax: number) => {
        this.props.appStore.renderConfigWidgetStore.setBounds(xMin, xMax);
    };

    onGraphZoomReset = () => {
        this.props.appStore.renderConfigWidgetStore.clearBounds();
    };

    onGraphCursorMoved = _.throttle((x) => {
        this.props.appStore.renderConfigWidgetStore.setCursor(x);
    }, 100);

    render() {
        const appStore = this.props.appStore;
        const frame = appStore.activeFrame;
        const widgetStore = appStore.renderConfigWidgetStore;

        if (!frame) {
            return (
                <div className="render-config-container">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>
                </div>
            );
        }

        let unitString = "Value";
        if (frame && frame.unit) {
            unitString = `Value (${frame.unit})`;
        }

        let linePlotProps: LinePlotComponentProps = {
            xLabel: unitString,
            yLabel: "Count",
            darkMode: appStore.darkTheme,
            logY: widgetStore.logScaleY,
            usePointSymbols: widgetStore.usePoints,
            graphClicked: this.onMinMoved,
            graphRightClicked: this.onMaxMoved,
            graphZoomed: this.onGraphZoomed,
            graphZoomReset: this.onGraphZoomReset,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true
        };

        if (frame && frame.renderConfig.channelHistogram && frame.renderConfig.channelHistogram.bins && frame.renderConfig.channelHistogram.bins.length) {
            const currentPlotData = this.plotData;
            if (currentPlotData && currentPlotData.values && currentPlotData.values.length) {
                linePlotProps.data = currentPlotData.values;
                if (widgetStore.isAutoScaled) {
                    linePlotProps.xMin = currentPlotData.xMin;
                    linePlotProps.xMax = currentPlotData.xMax;
                    linePlotProps.yMin = currentPlotData.yMin;
                    linePlotProps.yMax = currentPlotData.yMax;
                }
                else {
                    linePlotProps.xMin = widgetStore.minX;
                    linePlotProps.xMax = widgetStore.maxX;
                    linePlotProps.yMin = currentPlotData.yMin;
                    linePlotProps.yMax = currentPlotData.yMax;
                }
                // Fix log plot min bounds for entries with zeros in them
                if (widgetStore.logScaleY) {
                    linePlotProps.yMin = Math.max(linePlotProps.yMin, 0.5);
                }
            }
        }

        if (frame && frame.renderConfig) {
            linePlotProps.markers = [{
                value: frame.renderConfig.scaleMin,
                id: "marker-min",
                label: widgetStore.markerTextVisible ? "Min" : undefined,
                draggable: true,
                dragMove: this.onMinMoved,
                horizontal: false,
            }, {
                value: frame.renderConfig.scaleMax,
                id: "marker-max",
                label: widgetStore.markerTextVisible ? "Max" : undefined,
                draggable: true,
                dragMove: this.onMaxMoved,
                horizontal: false,
            }];
        }

        const percentileButtonCutoff = 600;
        const histogramCutoff = 430;
        const displayRankButtons = this.width > percentileButtonCutoff;
        const percentileRanks = [90, 95, 99, 99.5, 99.9, 99.95, 99.99, 100];

        let percentileButtonsDiv, percentileSelectDiv;
        if (displayRankButtons) {
            const percentileRankbuttons = percentileRanks.map(rank => (
                <Button small={true} key={rank} onClick={() => this.handlePercentileRankClick(rank)} active={frame.renderConfig.selectedPercentile === rank}>
                    {`${rank}%`}
                </Button>
            ));
            percentileRankbuttons.push(
                <Button small={true} key={-1} onClick={this.setCustomPercentileRank} active={frame.renderConfig.selectedPercentile === -1}>
                    Custom
                </Button>
            );
            percentileButtonsDiv = (
                <div className="percentile-buttons">
                    <ButtonGroup fill={true}>
                        {percentileRankbuttons}
                    </ButtonGroup>
                </div>
            );
        }
        else {
            const percentileRankOptions: IOptionProps [] = percentileRanks.map(rank => ({label: `${rank}%`, value: rank}));
            percentileRankOptions.push({label: "Custom", value: -1});
            percentileSelectDiv = (
                <div className="percentile-select">
                    <FormGroup label="Limits" inline={true}>
                        <HTMLSelect options={percentileRankOptions} value={frame.renderConfig.selectedPercentile} onChange={this.handlePercentileRankSelectChanged}/>
                    </FormGroup>
                </div>
            );
        }

        let cursorInfoDiv;
        if (this.width >= histogramCutoff && widgetStore.cursorX !== undefined) {
            let numberString;
            // Switch between standard and scientific notation
            if (widgetStore.cursorX < 1e-2) {
                numberString = widgetStore.cursorX.toExponential(2);
            }
            else {
                numberString = widgetStore.cursorX.toFixed(2);
            }

            if (frame.unit) {
                numberString += ` ${frame.unit}`;
            }

            cursorInfoDiv = (
                <div className="cursor-display">
                    <pre>{`Cursor: ${numberString}`}</pre>
                </div>
            );
        }

        return (
            <div className="render-config-container">
                {this.width > histogramCutoff &&
                <div className="histogram-container">
                    {displayRankButtons ? percentileButtonsDiv : percentileSelectDiv}
                    <div className="histogram-plot">
                        <LinePlotComponent {...linePlotProps}/>
                    </div>
                </div>
                }
                <div className="colormap-config">
                    <ColormapConfigComponent darkTheme={appStore.darkTheme} renderConfig={frame.renderConfig}/>
                    <FormGroup label={"Min"} inline={true}>
                        <NumericInput
                            value={frame.renderConfig.scaleMin}
                            selectAllOnFocus={true}
                            buttonPosition={"none"}
                            allowNumericCharactersOnly={false}
                            onValueChange={this.handleScaleMinChange}
                        />
                    </FormGroup>
                    <FormGroup label={"Max"} inline={true}>
                        <NumericInput
                            value={frame.renderConfig.scaleMax}
                            selectAllOnFocus={true}
                            buttonPosition={"none"}
                            onValueChange={this.handleScaleMaxChange}
                        />
                    </FormGroup>
                    {this.width < histogramCutoff ? percentileSelectDiv : cursorInfoDiv}
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}