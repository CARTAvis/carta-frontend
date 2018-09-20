import * as React from "react";
import ReactResizeDetector from "react-resize-detector";
import {observer} from "mobx-react";
import {FormGroup, HTMLSelect, NonIdealState, NumericInput, ButtonGroup, Button, Colors, MenuItem, IOptionProps} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {ChartData, ChartOptions} from "chart.js";
import {Scatter} from "react-chartjs-2";
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
        if (!this.props.appStore.activeFrame.setPercentileRank(value)) {
            this.props.appStore.alertStore.showAlert(`Couldn't set percentile of rank ${value}%`);
            this.props.appStore.logStore.addError(`Couldn't set percentile of rank ${value}%`, ["render"]);
        }
    };

    handlePercentileRankSelectChanged = (event: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.appStore.activeFrame.setPercentileRank(+event.currentTarget.value);
    };

    setCustomPercentileRank = () => {
        this.props.appStore.activeFrame.setPercentileRank(-1);
    };

    drawVerticalLine = (chart, x, color) => {
        if (x < chart.chartArea.left || x > chart.chartArea.right) {
            return;
        }

        chart.chart.ctx.restore();
        chart.chart.ctx.beginPath();
        chart.chart.ctx.strokeStyle = color;
        chart.chart.ctx.lineWidth = 1;
        chart.chart.ctx.setLineDash([5, 5]);
        chart.chart.ctx.moveTo(x, chart.chartArea.bottom);
        chart.chart.ctx.lineTo(x, chart.chartArea.top);
        chart.chart.ctx.stroke();
    };

    annotationDraw = (chart) => {
        const appStore = this.props.appStore;
        const frame = appStore.activeFrame;
        const scale = chart.scales["x-axis-0"];
        if (scale && frame && frame.renderConfig) {
            const minVal = frame.renderConfig.scaleMin;
            const maxVal = frame.renderConfig.scaleMax;
            const minValPixSpace = Math.floor(scale.getPixelForValue(minVal)) + 0.5;
            const maxValPixSpace = Math.floor(scale.getPixelForValue(maxVal)) + 0.5;
            const color = `${appStore.darkTheme ? Colors.RED4 : Colors.RED2}`;
            this.drawVerticalLine(chart, minValPixSpace, color);
            this.drawVerticalLine(chart, maxValPixSpace, color);
        }
    };

    renderColormapBlock = (colormap: string) => {
        let className = "colormap-block";
        if (this.props.appStore.darkTheme) {
            className += " bp3-dark";
        }
        const blockHeight = 15;
        const N = FrameRenderConfig.COLOR_MAPS_ALL.length;
        const i = FrameRenderConfig.COLOR_MAPS_ALL.indexOf(colormap);
        return (
            <div
                className={className}
                style={{
                    height: `${blockHeight}px`,
                    backgroundImage: `url(${allMaps})`,
                    backgroundSize: `100% calc(300% * ${N})`,
                    backgroundPosition: `0 calc(300% * -${i} - ${blockHeight}px)`,
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
        const frame = appStore.activeFrame;

        if (!frame) {
            return (
                <div className="render-config-container">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>
                </div>
            );
        }

        let unitString = "";
        if (frame && frame.unit) {
            unitString = ` (${frame.unit})`;
        }

        // ChartJS plot
        let plotOptions: ChartOptions = {
            maintainAspectRatio: false,
            legend: {
                display: false
            },
            scales: {
                xAxes: [{
                    id: "x-axis-0",
                    scaleLabel: {
                        display: true,
                        labelString: `Value${unitString}`
                    },
                    ticks: {
                        maxRotation: 0
                    },
                    afterBuildTicks: axis => {
                        axis.ticks = axis.ticks.slice(1, -1);
                    }
                }],
                yAxes: [{
                    id: "y-axis-0",
                    scaleLabel: {
                        display: true,
                        labelString: "Count"
                    },
                    ticks: {
                        display: true,
                        min: 0.5
                    },
                    afterBuildTicks: (axis) => {
                        // Limit log axis ticks to power of 10 values
                        axis.ticks = axis.ticks.filter(v => Math.abs(Math.log10(v) % 1.0) < 0.001);
                    },
                    type: "logarithmic"
                }]
            },
            animation: {
                duration: 0
            }
        };

        let plotData: Partial<ChartData> = {
            datasets: [
                {
                    label: "Histogram",
                    data: [],
                    type: "line",
                    fill: false,
                    pointRadius: 0,
                    showLine: true,
                    steppedLine: true,
                    borderWidth: 1,
                    borderColor: `${appStore.darkTheme ? Colors.BLUE4 : Colors.BLUE2}`
                }
            ]
        };

        const plugins = [{
            afterDraw: this.annotationDraw
        }];

        if (frame && frame.channelHistogram && frame.channelHistogram.bins) {
            const histogram = frame.channelHistogram;
            let vals = new Array(histogram.bins.length);
            for (let i = 0; i < vals.length; i++) {
                vals[i] = {x: histogram.firstBinCenter + histogram.binWidth * i, y: histogram.bins[i]};
            }
            plotData.datasets[0].data = vals;
            plotOptions.scales.xAxes[0].ticks.min = vals[0].x;
            plotOptions.scales.xAxes[0].ticks.max = vals[vals.length - 1].x;
        }

        if (frame && frame.renderConfig) {
            // Dummy use of scale min/max to trigger re-render when they change
            const annotationMin = frame.renderConfig.scaleMin;
            const annotationMax = frame.renderConfig.scaleMax;
        }

        const percentileButtonCutoff = 600;
        const histogramCutoff = 430;
        const displayRankButtons = this.state.width > percentileButtonCutoff;
        const percentileRanks = [90, 95, 99, 99.5, 99.9, 99.95, 99.99, 100];

        let percentileButtonsDiv, percentileSelectDiv;
        if (displayRankButtons) {
            const percentileRankbuttons = percentileRanks.map(rank => (
                <Button small={true} key={rank} onClick={() => this.handlePercentileRankClick(rank)} active={frame.selectedPercentile === rank}>
                    {`${rank}%`}
                </Button>
            ));
            percentileRankbuttons.push(
                <Button small={true} key={-1} onClick={this.setCustomPercentileRank} active={frame.selectedPercentile === -1}>
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
                        <HTMLSelect options={percentileRankOptions} value={frame.selectedPercentile} onChange={this.handlePercentileRankSelectChanged}/>
                    </FormGroup>
                </div>
            );
        }

        return (
            <div className="render-config-container">
                {this.state.width > histogramCutoff &&
                <div className="histogram-container">
                    {displayRankButtons ? percentileButtonsDiv : percentileSelectDiv}
                    <div className="histogram-plot">
                        <Scatter data={plotData} width={this.state.width} height={this.state.height} redraw={true} options={plotOptions} plugins={plugins}/>
                    </div>
                </div>
                }
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
                            popoverProps={{minimal: true, position: "auto-end", popoverClassName: "colormap-select-popover"}}
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
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}