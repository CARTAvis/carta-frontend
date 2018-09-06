import * as React from "react";
import ReactResizeDetector from "react-resize-detector";
import {observer} from "mobx-react";
import * as Plotly from "plotly.js/dist/plotly-cartesian";
import createPlotlyComponent from "react-plotly.js/factory";
import {Config, Data, Layout} from "plotly.js";
import {FormGroup, HTMLSelect, NonIdealState, NumericInput, ButtonGroup, Button, Colors, MenuItem} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {AppStore} from "../../stores/AppStore";
import {FrameRenderConfig, FrameScaling, FrameStore} from "../../stores/FrameStore";
import {WidgetConfig} from "../../stores/FloatingWidgetStore";
import "./RenderConfigComponent.css";

// Static assets
import allMaps from "../../static/allmaps.png";
// Equation SVG images
import linearSvg from "../../static/equations/linear.svg";
import logSvg from "../../static/equations/log.svg";
import sqrtSvg from "../../static/equations/sqrt.svg";
import squaredSvg from "../../static/equations/squared.svg";
import gammaSvg from "../../static/equations/gamma.svg";

const equationSVGMap = new Map([
    [FrameScaling.LINEAR, linearSvg],
    [FrameScaling.LOG, logSvg],
    [FrameScaling.SQRT, sqrtSvg],
    [FrameScaling.SQUARE, squaredSvg],
    [FrameScaling.GAMMA, gammaSvg]
]);

// This allows us to use a minimal Plotly.js bundle with React-Plotly.js (900k compared to 2.7 MB)
const Plot = createPlotlyComponent(Plotly);

const ColorMapSelect = Select.ofType<string>();
const ScalingSelect = Select.ofType<FrameScaling>();

class RenderConfigComponentProps {
    appStore: AppStore;
    id: string;
    docked: boolean;
}

class RenderConfigComponentState {
    width: number;
    height: number;
    hoveringScaleMin: boolean;
    hoveringScaleMax: boolean;
    xRange: number[];
    yRange: number[];
}

@observer
export class RenderConfigComponent extends React.Component<RenderConfigComponentProps, RenderConfigComponentState> {
    private plotRef: any;
    private movingScaleMax: boolean;
    private movingScaleMin: boolean;
    private cachedFrame: FrameStore;

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

    handleRightClick = (ev: React.MouseEvent<HTMLDivElement>) => {
        ev.preventDefault();
        this.handleMouseClick(ev);
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
                        frame.renderConfig.scaleMin = Math.max(cursorVal, frame.histogramMin);
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
                        frame.renderConfig.scaleMax = Math.min(cursorVal, frame.histogramMax);
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

    handlePercentileRankClick = (value: number) => {
        if (!this.props.appStore.activeFrame.setFromPercentileRank(value)) {
            this.props.appStore.alertStore.showAlert(`Couldn't set percentile of rank ${value}%`);
            this.props.appStore.logStore.addError(`Couldn't set percentile of rank ${value}%`, ["render"]);
        }
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
                color: Colors.RED2,
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
                // Using bp3 RED2 but applying opacity
                fillcolor: `rgba(194, 48, 48, ${moving ? 0.7 : 0.5})`,
                line: {
                    width: 1,
                    color: Colors.RED2
                }
            });
        }
        return markers;
    }

    renderColormapBlock = (colormap: string) => {
        let className = "colormap-block";
        if (this.props.appStore.darkTheme) {
            className += " bp3-dark";
        }
        return (
            <div
                className={className}
                style={{
                    backgroundImage: `url(${allMaps})`,
                    backgroundSize: `100% calc(100% * ${FrameRenderConfig.COLOR_MAPS_ALL.length})`,
                    backgroundPosition: `0 calc(100% * -${FrameRenderConfig.COLOR_MAPS_ALL.indexOf(colormap)})`,
                }}
            />

        );
    };

    renderColormapSelectItem = (colormap: string, {handleClick, modifiers, query}) => {
        if (!modifiers.matchesPredicate) {
            return null;
        }
        return (
            <MenuItem
                active={modifiers.active}
                disabled={modifiers.disabled}
                label={colormap}
                key={colormap}
                onClick={handleClick}
                text={this.renderColormapBlock(colormap)}
            />
        );
    };

    renderScalingSelectItem = (scaling: FrameScaling, {handleClick, modifiers, query}) => {
        if (!modifiers.matchesPredicate || !FrameRenderConfig.SCALING_TYPES.has(scaling)) {
            return null;
        }
        const scalingName = FrameRenderConfig.SCALING_TYPES.get(scaling);

        const equationDiv = (
            <div className="equation-div">
                <img src={equationSVGMap.get(scaling)}/>
            </div>
        );
        return (
            <MenuItem
                active={modifiers.active}
                disabled={modifiers.disabled}
                label={scalingName}
                key={scaling}
                onClick={handleClick}
                text={equationDiv}
            />
        );
    };

    render() {
        const appStore = this.props.appStore;
        const backgroundColor = appStore.darkTheme ? Colors.DARK_GRAY3 : Colors.LIGHT_GRAY5;
        const frame = appStore.activeFrame;
        let scaleMarkers = [];
        if (frame) {
            scaleMarkers = this.getScaleMarkers(frame.renderConfig.scaleMin, this.state.hoveringScaleMin, this.movingScaleMin);
            scaleMarkers = scaleMarkers.concat(this.getScaleMarkers(frame.renderConfig.scaleMax, this.state.hoveringScaleMax, this.movingScaleMax));
        }

        let unitString = "";
        if (frame && frame.unit) {
            unitString = ` (${frame.unit})`;
        }

        let plotLayout: Partial<Layout> = {
            autosize: true,
            paper_bgcolor: backgroundColor,
            plot_bgcolor: backgroundColor,
            xaxis: {
                title: `Value${unitString}`,
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
            font: {
                color: appStore.darkTheme ? Colors.LIGHT_GRAY3 : Colors.DARK_GRAY4
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
                    shape: "hv",
                    color: Colors.BLUE2
                }
            });
        }
        const percentileRanks = [90, 95, 99, 99.5, 99.9, 99.95, 99.99, 100];
        const percentileRankbuttons = percentileRanks.map(rank => <Button small={true} key={rank} onClick={() => this.handlePercentileRankClick(rank)}>{`${rank}%`}</Button>);
        const percentileRankOptions = percentileRanks.map(rank => <option key={rank} value={rank}>{`${rank}%`}</option>);

        const percentileButtonsDiv = (
            <div className="percentile-buttons">
                <ButtonGroup fill={true}>
                    {percentileRankbuttons}
                </ButtonGroup>
            </div>
        );

        const percentileSelectDiv = (
            <div className="percentile-select">
                <FormGroup label="Limits" inline={true}>
                    <HTMLSelect>
                        {percentileRankOptions}
                    </HTMLSelect>
                    <Button>Apply</Button>
                </FormGroup>
            </div>
        );

        const percentileButtonCutoff = 600;
        const histogramCutoff = 430;

        return (
            <div className="render-config-container">
                {!frame &&
                <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>
                }
                {frame && this.state.width > histogramCutoff &&
                <div className="histogram-container">
                    {this.state.width > percentileButtonCutoff && percentileButtonsDiv}
                    {this.state.width <= percentileButtonCutoff && percentileSelectDiv}
                    <div className="histogram-plot" onClick={this.handleMouseClick} onMouseMove={this.handleMouseMove} onContextMenu={this.handleRightClick}>
                        <Plot
                            layout={plotLayout}
                            data={plotData}
                            config={plotConfig}
                            ref={ref => this.plotRef = ref}
                            onRelayout={this.handlePlotRelayout}
                            useResizeHandler={true}
                            style={{width: "100%", height: "100%"}}
                        />
                    </div>
                </div>
                }
                {frame &&
                <div className="colormap-config">
                    <FormGroup label={"Scaling type"} inline={true}>
                        <ScalingSelect
                            activeItem={frame.renderConfig.scaling}
                            popoverProps={{minimal: true, position: "auto-end"}}
                            filterable={false}
                            items={Array.from(FrameRenderConfig.SCALING_TYPES.keys())}
                            onItemSelect={this.handleScalingChange}
                            itemRenderer={this.renderScalingSelectItem}
                        >
                            <Button text={frame.renderConfig.scalingName} rightIcon="double-caret-vertical"/>
                        </ScalingSelect>
                    </FormGroup>

                    <FormGroup label={"Color map"} inline={true}>
                        <ColorMapSelect
                            activeItem={frame.renderConfig.colorMapName}
                            popoverProps={{minimal: true, position: "auto-end"}}
                            filterable={false}
                            items={FrameRenderConfig.COLOR_MAPS_ALL}
                            onItemSelect={this.handleColorMapChange}
                            itemRenderer={this.renderColormapSelectItem}
                        >
                            <Button text={this.renderColormapBlock(frame.renderConfig.colorMapName)} rightIcon="double-caret-vertical"/>
                        </ColorMapSelect>
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
                    {this.state.width < histogramCutoff && percentileSelectDiv}
                </div>
                }
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}