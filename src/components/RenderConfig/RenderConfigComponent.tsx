import * as React from "react";
import * as _ from "lodash";
import ReactResizeDetector from "react-resize-detector";
import {observer} from "mobx-react";
import {FormGroup, HTMLSelect, NonIdealState, NumericInput, ButtonGroup, Button, Colors, MenuItem, IOptionProps} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {ChartData, ChartOptions, Chart, ChartArea} from "chart.js";
import {Scatter} from "react-chartjs-2";
import {AppStore} from "../../stores/AppStore";
import {FrameStore} from "../../stores/FrameStore";
import {RenderConfigStore, FrameScaling} from "../../stores/RenderConfigStore";
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
import {LinePlotComponent, LinePlotComponentProps} from "../Shared/LinePlot/LinePlotComponent";

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
    chartArea: ChartArea;
}

@observer
export class RenderConfigComponent extends React.Component<RenderConfigComponentProps, RenderConfigComponentState> {
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
        this.state = {width: 0, height: 0, hoveringScaleMin: false, hoveringScaleMax: false, xRange: undefined, yRange: undefined, chartArea: undefined};
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

    // handleRightClick = (ev: React.MouseEvent<HTMLDivElement>) => {
    //     ev.preventDefault();
    //     this.handleMouseClick(ev);
    // };
    //
    // handleMouseClick = (ev: React.MouseEvent<HTMLDivElement>) => {
    //     if (this.movingScaleMin || this.movingScaleMax) {
    //         this.movingScaleMax = false;
    //         this.movingScaleMin = false;
    //         return;
    //     }
    //
    //     const frame = this.props.appStore.activeFrame;
    //     const pixelThreshold = 5;
    //     if (this.plotRef && frame) {
    //         const xAxis = this.plotRef.el._fullLayout.xaxis;
    //         if (xAxis && xAxis.p2c) {
    //             const leftMargin = this.plotRef.el._fullLayout.margin.l;
    //             const posScaleMin = xAxis.c2p(frame.renderConfig.scaleMin) + leftMargin;
    //             const posScaleMax = xAxis.c2p(frame.renderConfig.scaleMax) + leftMargin;
    //             if (Math.abs(ev.nativeEvent.offsetX - posScaleMin) < pixelThreshold) {
    //                 this.movingScaleMin = true;
    //                 ev.preventDefault();
    //             }
    //             else if (Math.abs(ev.nativeEvent.offsetX - posScaleMax) < pixelThreshold) {
    //                 this.movingScaleMax = true;
    //                 ev.preventDefault();
    //             }
    //         }
    //     }
    // };
    //
    // handleMouseMove = (ev: React.MouseEvent<HTMLDivElement>) => {
    //     const frame = this.props.appStore.activeFrame;
    //     const pixelThreshold = 5;
    //     if (this.plotRef && frame) {
    //         const xAxis = this.plotRef.el._fullLayout.xaxis;
    //         if (xAxis && xAxis.p2c) {
    //             const leftMargin = this.plotRef.el._fullLayout.margin.l;
    //             const cursorVal = xAxis.p2c(ev.nativeEvent.offsetX - leftMargin);
    //             const posScaleMin = xAxis.c2p(frame.renderConfig.scaleMin) + leftMargin;
    //             const posScaleMax = xAxis.c2p(frame.renderConfig.scaleMax) + leftMargin;
    //
    //             if (this.movingScaleMin) {
    //                 // Handle switchover (from moving min to moving max)
    //                 if (cursorVal >= frame.renderConfig.scaleMax) {
    //                     this.movingScaleMin = false;
    //                     this.movingScaleMax = true;
    //                     this.setState({hoveringScaleMax: true, hoveringScaleMin: false});
    //                 }
    //                 else {
    //                     frame.renderConfig.scaleMin = Math.max(cursorVal, frame.renderConfig.histogramMin);
    //                 }
    //             }
    //             else if (this.movingScaleMax) {
    //                 // Handle switchover (from moving max to moving min)
    //                 if (cursorVal <= frame.renderConfig.scaleMin) {
    //                     this.movingScaleMax = false;
    //                     this.movingScaleMin = true;
    //                     this.setState({hoveringScaleMin: true, hoveringScaleMax: false});
    //                 }
    //                 else {
    //                     frame.renderConfig.scaleMax = Math.min(cursorVal, frame.renderConfig.histogramMax);
    //                 }
    //             }
    //             else if (Math.abs(ev.nativeEvent.offsetX - posScaleMin) < pixelThreshold) {
    //                 this.setState({hoveringScaleMin: true, hoveringScaleMax: false});
    //             }
    //             else if (Math.abs(ev.nativeEvent.offsetX - posScaleMax) < pixelThreshold) {
    //                 this.setState({hoveringScaleMax: true, hoveringScaleMin: false});
    //             }
    //             else if (this.state.hoveringScaleMin || this.state.hoveringScaleMax) {
    //                 this.setState({hoveringScaleMax: false, hoveringScaleMin: false});
    //             }
    //         }
    //     }
    // };
    //
    // handleMouseUp = (ev: React.MouseEvent<HTMLDivElement>) => {
    //     this.movingScaleMin = false;
    //     this.movingScaleMax = false;
    // };
    //
    // handlePlotRelayout = (ev) => {
    //     if (ev["xaxis.range[0]"] !== undefined) {
    //         this.setState({xRange: [ev["xaxis.range[0]"], ev["xaxis.range[1]"]]});
    //     }
    //     else if (ev["xaxis.autorange"]) {
    //         this.setState({xRange: undefined});
    //     }
    //
    //     if (ev["yaxis.range[0]"] !== undefined) {
    //         this.setState({yRange: [ev["yaxis.range[0]"], ev["yaxis.range[1]"]]});
    //     }
    //     else if (ev["yaxis.autorange"]) {
    //         this.setState({yRange: undefined});
    //     }
    // };

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

    renderColormapBlock = (colormap: string) => {
        let className = "colormap-block";
        if (this.props.appStore.darkTheme) {
            className += " bp3-dark";
        }
        const blockHeight = 15;
        const N = RenderConfigStore.COLOR_MAPS_ALL.length;
        const i = RenderConfigStore.COLOR_MAPS_ALL.indexOf(colormap);
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
        if (!modifiers.matchesPredicate || !RenderConfigStore.SCALING_TYPES.has(scaling)) {
            return null;
        }
        const scalingName = RenderConfigStore.SCALING_TYPES.get(scaling);

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

        let unitString = "Value";
        if (frame && frame.unit) {
            unitString = `Value (${frame.unit})`;
        }

        let linePlotProps: LinePlotComponentProps = {
            xLabel: unitString,
            yLabel: "Count",
            lineColor: `${appStore.darkTheme ? Colors.BLUE4 : Colors.BLUE2}`,
            logY: true
        };

        if (frame && frame.renderConfig.channelHistogram && frame.renderConfig.channelHistogram.bins) {
            const histogram = frame.renderConfig.channelHistogram;
            let vals = new Array(histogram.bins.length);
            for (let i = 0; i < vals.length; i++) {
                vals[i] = {x: histogram.firstBinCenter + histogram.binWidth * i, y: histogram.bins[i]};
            }
            linePlotProps.data = vals;
            linePlotProps.xMin = vals[0].x;
            linePlotProps.xMax = vals[vals.length - 1].x;
        }

        if (frame && frame.renderConfig) {
            linePlotProps.markers = [{
                value: frame.renderConfig.scaleMin,
                color: "red",
            }, {
                value: frame.renderConfig.scaleMax,
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
                    <FormGroup label={"Scaling type"} inline={true}>
                        <ScalingSelect
                            activeItem={frame.renderConfig.scaling}
                            popoverProps={{minimal: true, position: "auto-end"}}
                            filterable={false}
                            items={Array.from(RenderConfigStore.SCALING_TYPES.keys())}
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
                            items={RenderConfigStore.COLOR_MAPS_ALL}
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