import * as React from "react";
import {observer} from "mobx-react";
import {AppStore} from "../../stores/AppStore";
import * as Plotly from "plotly.js/dist/plotly-cartesian";
import createPlotlyComponent from "react-plotly.js/factory";
import ReactResizeDetector from "react-resize-detector";
import {Config, Data, Layout} from "plotly.js";
import "./ColormapComponent.css";
import {FrameScaling, FrameStore} from "../../stores/FrameStore";
import {FormGroup, HTMLSelect, NonIdealState, NumericInput, Tooltip, Position} from "@blueprintjs/core";

// This allows us to use a minimal Plotly.js bundle with React-Plotly.js (900k compared to 2.7 MB)
const Plot = createPlotlyComponent(Plotly);

const COLOR_MAPS_ALL = ["accent", "afmhot", "autumn", "binary", "Blues", "bone", "BrBG", "brg", "BuGn", "BuPu", "bwr", "CMRmap", "cool", "coolwarm",
    "copper", "cubehelix", "dark2", "flag", "gist_earth", "gist_gray", "gist_heat", "gist_ncar", "gist_rainbow", "gist_stern", "gist_yarg",
    "GnBu", "gnuplot", "gnuplot2", "gray", "greens", "greys", "hot", "hsv", "inferno", "jet", "magma", "nipy_spectral", "ocean", "oranges",
    "OrRd", "paired", "pastel1", "pastel2", "pink", "PiYG", "plasma", "PRGn", "prism", "PuBu", "PuBuGn", "PuOr", "PuRd", "purples", "rainbow",
    "RdBu", "RdGy", "RdPu", "RdYlBu", "RdYlGn", "reds", "seismic", "set1", "set2", "set3", "spectral", "spring", "summer", "tab10", "tab20",
    "tab20b", "tab20c", "terrain", "viridis", "winter", "Wistia", "YlGn", "YlGnBu", "YlOrBr", "YlOrRd"];

class ColormapComponentProps {
    appStore: AppStore;
}

class ColormapComponentState {
    width: number;
    height: number;
    hoveringScaleMin: boolean;
    hoveringScaleMax: boolean;
    xRange: number[];
    yRange: number[];
}

@observer
export class ColormapComponent extends React.Component<ColormapComponentProps, ColormapComponentState> {

    private plotRef: any;
    private movingScaleMax: boolean;
    private movingScaleMin: boolean;
    private cachedFrame: FrameStore;

    constructor(props: ColormapComponentProps) {
        super(props);
        this.state = {width: 0, height: 0, hoveringScaleMin: false, hoveringScaleMax: false, xRange: undefined, yRange: undefined};
    }

    componentDidUpdate() {
        if (this.props.appStore.activeFrame !== this.cachedFrame) {
            this.cachedFrame = this.props.appStore.activeFrame;
            this.setState({xRange: undefined, yRange: undefined});
        }
    }

    onResize = (width: number, height: number) => {
        this.setState({width, height});
    };

    handleMouseClick = (ev: React.MouseEvent<HTMLDivElement>) => {
        if (this.movingScaleMin || this.movingScaleMax) {
            this.movingScaleMax = false;
            this.movingScaleMin = false;
            return;
        }

        const frame = this.props.appStore.activeFrame;
        const pixelThreshold = 5;
        if (this.plotRef && frame) {
            const xAxis = this.plotRef.el._fullLayout.xaxis;
            if (xAxis && xAxis.p2c) {
                const leftMargin = this.plotRef.el._fullLayout.margin.l;
                const posScaleMin = xAxis.c2p(frame.renderConfig.scaleMin) + leftMargin;
                const posScaleMax = xAxis.c2p(frame.renderConfig.scaleMax) + leftMargin;
                if (Math.abs(ev.nativeEvent.offsetX - posScaleMin) < pixelThreshold) {
                    this.movingScaleMin = true;
                    ev.preventDefault();
                }
                else if (Math.abs(ev.nativeEvent.offsetX - posScaleMax) < pixelThreshold) {
                    this.movingScaleMax = true;
                    ev.preventDefault();
                }
            }
        }
    };

    handleMouseMove = (ev: React.MouseEvent<HTMLDivElement>) => {
        const frame = this.props.appStore.activeFrame;
        const pixelThreshold = 5;
        if (this.plotRef && frame) {
            const xAxis = this.plotRef.el._fullLayout.xaxis;
            if (xAxis && xAxis.p2c) {
                const leftMargin = this.plotRef.el._fullLayout.margin.l;
                const cursorVal = xAxis.p2c(ev.nativeEvent.offsetX - leftMargin);
                const posScaleMin = xAxis.c2p(frame.renderConfig.scaleMin) + leftMargin;
                const posScaleMax = xAxis.c2p(frame.renderConfig.scaleMax) + leftMargin;

                if (this.movingScaleMin) {
                    // Handle switchover (from moving min to moving max)
                    if (cursorVal >= frame.renderConfig.scaleMax) {
                        this.movingScaleMin = false;
                        this.movingScaleMax = true;
                        this.setState({hoveringScaleMax: true, hoveringScaleMin: false});
                    }
                    else {
                        frame.renderConfig.scaleMin = cursorVal;
                    }
                }
                else if (this.movingScaleMax) {
                    // Handle switchover (from moving max to moving min)
                    if (cursorVal <= frame.renderConfig.scaleMin) {
                        this.movingScaleMax = false;
                        this.movingScaleMin = true;
                        this.setState({hoveringScaleMin: true, hoveringScaleMax: false});
                    }
                    else {
                        frame.renderConfig.scaleMax = cursorVal;
                    }
                }
                else if (Math.abs(ev.nativeEvent.offsetX - posScaleMin) < pixelThreshold) {
                    this.setState({hoveringScaleMin: true, hoveringScaleMax: false});
                }
                else if (Math.abs(ev.nativeEvent.offsetX - posScaleMax) < pixelThreshold) {
                    this.setState({hoveringScaleMax: true, hoveringScaleMin: false});
                }
                else if (this.state.hoveringScaleMin || this.state.hoveringScaleMax) {
                    this.setState({hoveringScaleMax: false, hoveringScaleMin: false});
                }
            }
        }
    };

    handleMouseUp = (ev: React.MouseEvent<HTMLDivElement>) => {
        this.movingScaleMin = false;
        this.movingScaleMax = false;
    };

    handlePlotRelayout = (ev) => {
        if (ev["xaxis.range[0]"] !== undefined) {
            this.setState({xRange: [ev["xaxis.range[0]"], ev["xaxis.range[1]"]]});
        }
        else if (ev["xaxis.autorange"]) {
            this.setState({xRange: undefined});
        }

        if (ev["yaxis.range[0]"] !== undefined) {
            this.setState({yRange: [ev["yaxis.range[0]"], ev["yaxis.range[1]"]]});
        }
        else if (ev["yaxis.autorange"]) {
            this.setState({yRange: undefined});
        }
    };

    handleColorMapChange = (ev: React.ChangeEvent<HTMLSelectElement>) => {
        const newColorMap = parseInt(ev.target.value);
        this.props.appStore.activeFrame.renderConfig.colorMap = newColorMap;
    };

    handleScalingChange = (ev: React.ChangeEvent<HTMLSelectElement>) => {
        const newScaling = parseInt(ev.target.value);
        this.props.appStore.activeFrame.renderConfig.scaling = newScaling;
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

    private getScaleMarkers(position: number, hovering: boolean, moving: boolean) {
        // By default, a single horizontal line marker is returned
        let markers: any[] = [{
            type: "line",
            yref: "paper",
            y0: 0,
            y1: 1,
            x0: position,
            x1: position,
            line: {
                color: "red",
                width: 1
            }
        }];

        // If the marker is being hovered over, then we add a rectangle as well
        if (hovering) {
            // split the line into two lines above and below the rectangle, so that the line doesn't show through the semi-transparent rectangle
            markers.push({...markers[0]});
            markers[0].y1 = 0.33;
            markers[1].y0 = 0.66;
            // add the rectangle
            markers.push({
                type: "rect",
                yref: "paper",
                y0: 0.33,
                y1: 0.66,
                xsizemode: "pixel",
                xanchor: position,
                x0: -3,
                x1: +3,
                fillcolor: `rgba(255, 0, 0, ${moving ? 0.7 : 0.5})`,
                line: {
                    width: 1,
                    color: "red"
                }
            });
        }
        return markers;
    }

    private getTooltipText(scalingMode: FrameScaling) {
        switch (scalingMode) {
            case FrameScaling.LINEAR:
                return "y=x";
            case FrameScaling.SQUARE:
                return "y=x\u00b2";
            case FrameScaling.SQRT:
                return "y=\u221ax";
            case FrameScaling.GAMMA:
                return "y=x^\u03B3";
            case FrameScaling.LOG:
                return "y=log(x)";
            default:
                return "Unknown";
        }
    }

    render() {
        const appStore = this.props.appStore;
        const backgroundColor = "#F2F2F2";
        const frame = appStore.activeFrame;
        let scaleMarkers = [];
        if (frame) {
            scaleMarkers = this.getScaleMarkers(frame.renderConfig.scaleMin, this.state.hoveringScaleMin, this.movingScaleMin);
            scaleMarkers = scaleMarkers.concat(this.getScaleMarkers(frame.renderConfig.scaleMax, this.state.hoveringScaleMax, this.movingScaleMax));
        }

        let unitString;
        if (frame && frame.unit) {
            unitString = ` (${frame.unit})`;
        }
        let plotLayout: Partial<Layout> = {
            autosize: true,
            paper_bgcolor: backgroundColor,
            plot_bgcolor: backgroundColor,
            xaxis: {
                title: `Value ${unitString}`,
                range: this.state.xRange
            },
            yaxis: {
                type: "log",
                showticklabels: false,
                range: this.state.yRange
            },
            margin: {
                t: 10,
                r: 10,
                l: 10,
                b: 35,
            },
            shapes: scaleMarkers
        };

        let plotData: Partial<Data[]> = [];
        let plotConfig: Partial<Config> = {
            displaylogo: false,
            modeBarButtonsToRemove: ["toImage", "sendDataToCloud", "toggleHover", "toggleSpikelines", "hoverClosestCartesian", "hoverCompareCartesian"],
            setBackground: "transparent",
            doubleClick: false,
        };

        if (frame && frame.channelHistogram && frame.channelHistogram.bins) {
            const histogram = frame.channelHistogram;
            let xVals = new Array(histogram.bins.length);
            for (let i = 0; i < xVals.length; i++) {
                xVals[i] = histogram.firstBinCenter + histogram.binWidth * i;
            }

            plotData.push({
                x: xVals,
                y: histogram.bins,
                type: "scatter",
                hoverinfo: "x",
                mode: "lines",
                line: {
                    width: 1.0,
                    shape: "hv"
                }
            });
        }

        return (
            <div className="colormap-container">
                {!frame &&
                <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>
                }
                {frame &&
                <div className="histogram-plot" onClick={this.handleMouseClick} onMouseMove={this.handleMouseMove}>
                    <Plot layout={plotLayout} data={plotData} config={plotConfig} ref={ref => this.plotRef = ref} onRelayout={this.handlePlotRelayout} useResizeHandler={true} style={{width: "100%", height: "100%"}}/>
                </div>
                }
                {frame &&
                <div className="colormap-config">

                    <FormGroup label={"Scaling type"} inline={true}>
                        <Tooltip content={this.getTooltipText(frame.renderConfig.scaling)} position={Position.BOTTOM} autoFocus={false}>
                            <HTMLSelect value={frame.renderConfig.scaling} onChange={this.handleScalingChange}>
                                <option value={FrameScaling.LINEAR}>Linear</option>
                                <option value={FrameScaling.LOG}>Logarithmic</option>
                                <option value={FrameScaling.SQRT}>Square root</option>
                                <option value={FrameScaling.SQUARE}>Squared</option>
                                <option value={FrameScaling.POWER}>Power</option>
                                <option value={FrameScaling.GAMMA}>Gamma</option>
                            </HTMLSelect>
                        </Tooltip>
                    </FormGroup>

                    <FormGroup label={"Color map"} inline={true}>
                        <HTMLSelect value={frame.renderConfig.colorMap} onChange={this.handleColorMapChange}>
                            {COLOR_MAPS_ALL.map((name, index) => <option key={index} value={index}>{name}</option>)}
                        </HTMLSelect>
                    </FormGroup>
                    <FormGroup label={"Bias"} inline={true}>
                        <NumericInput
                            style={{width: "60px"}}
                            min={-1}
                            max={1}
                            stepSize={0.1}
                            minorStepSize={0.01}
                            majorStepSize={0.5}
                            value={frame.renderConfig.bias}
                            onValueChange={this.handleBiasChange}
                        />
                    </FormGroup>
                    <FormGroup label={"Contrast"} inline={true}>
                        <NumericInput
                            style={{width: "60px"}}
                            min={0}
                            max={5}
                            stepSize={0.1}
                            minorStepSize={0.01}
                            majorStepSize={0.5}
                            value={frame.renderConfig.contrast}
                            onValueChange={this.handleContrastChange}
                        />
                    </FormGroup>
                    <FormGroup label={"Gamma"} inline={true}>
                        <NumericInput
                            style={{width: "60px"}}
                            min={0}
                            max={2}
                            stepSize={0.1}
                            minorStepSize={0.01}
                            majorStepSize={0.5}
                            value={frame.renderConfig.gamma}
                            disabled={frame.renderConfig.scaling !== FrameScaling.GAMMA}
                            onValueChange={this.handleGammaChange}
                        />
                    </FormGroup>
                </div>
                }
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}