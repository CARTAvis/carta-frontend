import * as React from "react";
import * as _ from "lodash";
import ReactResizeDetector from "react-resize-detector";
import {observer} from "mobx-react";
import {FormGroup, HTMLSelect, NonIdealState, ButtonGroup, Button, Colors, IOptionProps} from "@blueprintjs/core";
import {Chart, ChartArea} from "chart.js";
import {LinePlotComponent, LinePlotComponentProps} from "../Shared/LinePlot/LinePlotComponent";
import {AppStore} from "../../stores/AppStore";
import {FrameStore} from "../../stores/FrameStore";
import {FrameScaling} from "../../stores/RenderConfigStore";
import {WidgetConfig} from "../../stores/FloatingWidgetStore";
import "./RenderConfigComponent.css";
import {ColormapConfigComponent} from "./ColormapConfigComponent/ColormapConfigComponent";

class RenderConfigComponentProps {
    appStore: AppStore;
    id: string;
    docked: boolean;
}

class RenderConfigComponentState {
    width: number;
    height: number;
    xMin: number;
    xMax: number;
    yRange: number[];
    chartArea: ChartArea;
    cursorX: number;
}

@observer
export class RenderConfigComponent extends React.Component<RenderConfigComponentProps, RenderConfigComponentState> {
    private cachedFrame: FrameStore;
    private cachedData: number[];

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
        this.state = {width: 0, height: 0, xMin: undefined, xMax: undefined, yRange: undefined, chartArea: undefined, cursorX: undefined};
    }

    componentDidUpdate() {
        const frame = this.props.appStore.activeFrame;
        if (frame !== this.cachedFrame) {
            this.cachedFrame = frame;
            this.setState({xMin: undefined, xMax: undefined, yRange: undefined});
        }
    }

    handleColorMapChange = (newColorMap: string) => {
        this.props.appStore.activeFrame.renderConfig.setColorMap(newColorMap);
    };

    handleScalingChange = (scaling: FrameScaling) => {
        this.props.appStore.activeFrame.renderConfig.setScaling(scaling);
    };

    handleBiasChange = (value: number) => {
        this.props.appStore.activeFrame.renderConfig.bias = value;
    };

    handleContrastChange = (value: number) => {
        this.props.appStore.activeFrame.renderConfig.contrast = value;
    };

    handleGammaChange = (value: number) => {
        this.props.appStore.activeFrame.renderConfig.gamma = value;
    };

    onResize = (width: number, height: number) => {
        this.setState({width, height});
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
        this.setState({xMin, xMax});
    };

    onGraphZoomReset = () => {
        this.setState({xMin: undefined, xMax: undefined});
    };

    onGraphCursorMoved = (x) => {
        this.setState({cursorX: x});
    };

    render() {
        const appStore = this.props.appStore;
        const frame = appStore.activeFrame;

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
            lineColor: `${appStore.darkTheme ? Colors.BLUE4 : Colors.BLUE2}`,
            logY: true,
            graphClicked: this.onMinMoved,
            graphRightClicked: this.onMaxMoved,
            graphZoomed: this.onGraphZoomed,
            graphZoomReset: this.onGraphZoomReset,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true
        };

        if (frame && frame.renderConfig.channelHistogram && frame.renderConfig.channelHistogram.bins && frame.renderConfig.channelHistogram.bins.length) {
            const histogram = frame.renderConfig.channelHistogram;
            let minIndex = 0;
            let maxIndex = histogram.bins.length - 1;

            // Truncate array if zoomed in (sidestepping ChartJS bug with off-canvas rendering and speeding up layout)
            if (this.state.xMin !== undefined && this.state.xMax !== undefined) {
                minIndex = Math.floor((this.state.xMin - histogram.firstBinCenter) / histogram.binWidth);
                minIndex = Math.max(0, Math.min(histogram.bins.length, minIndex));
                maxIndex = Math.ceil((this.state.xMax - histogram.firstBinCenter) / histogram.binWidth);
                maxIndex = Math.max(0, Math.min(histogram.bins.length, maxIndex));
            }
            const N = maxIndex - minIndex;
            if (N > 0 && !isNaN(N)) {
                const plotVals = new Array(maxIndex - minIndex);

                for (let i = minIndex; i <= maxIndex; i++) {
                    plotVals[i - minIndex] = {x: histogram.firstBinCenter + histogram.binWidth * i, y: histogram.bins[i]};
                    // Sanitize zero values to prevent scaling issues with log graphs
                    if (plotVals[i - minIndex].y < 0.1) {
                        plotVals[i - minIndex].y = undefined;
                    }
                }
                linePlotProps.data = plotVals;
                if (this.state.xMin === undefined && this.state.xMax === undefined) {
                    linePlotProps.xMin = plotVals[0].x;
                    linePlotProps.xMax = plotVals[plotVals.length - 1].x;
                }
                else {
                    linePlotProps.xMin = this.state.xMin;
                    linePlotProps.xMax = this.state.xMax;
                }
            }
        }

        if (frame && frame.renderConfig) {
            linePlotProps.markers = [{
                value: frame.renderConfig.scaleMin,
                id: "marker-min",
                draggable: true,
                dragMove: this.onMinMoved,
                color: "red",
            }, {
                value: frame.renderConfig.scaleMax,
                id: "marker-max",
                draggable: true,
                dragMove: this.onMaxMoved,
                color: "red"
            }];
        }

        const percentileButtonCutoff = 600;
        const histogramCutoff = 430;
        const displayRankButtons = this.state.width > percentileButtonCutoff;
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
        if (this.state.width >= histogramCutoff && this.state.cursorX !== undefined) {
            let numberString;
            // Switch between standard and scientific notation
            if (this.state.cursorX < 1e-2) {
                numberString = this.state.cursorX.toExponential(2);
            }
            else {
                numberString = this.state.cursorX.toFixed(2);
            }

            cursorInfoDiv = (
                <div className="cursor-display">
                    <pre>{`Cursor: ${numberString} ${frame.unit}`}</pre>
                </div>
            );
        }

        return (
            <div className="render-config-container">
                {this.state.width > histogramCutoff &&
                <div className="histogram-container">
                    {displayRankButtons ? percentileButtonsDiv : percentileSelectDiv}
                    <div className="histogram-plot">
                        <LinePlotComponent {...linePlotProps}/>
                    </div>
                </div>
                }
                <div className="colormap-config">
                    <ColormapConfigComponent darkTheme={appStore.darkTheme} renderConfig={frame.renderConfig}/>
                    {this.state.width < histogramCutoff ? percentileSelectDiv : cursorInfoDiv}
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}