import * as React from "react";
import * as _ from "lodash";
import ReactResizeDetector from "react-resize-detector";
import {action, autorun, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Button, ButtonGroup, FormGroup, HTMLSelect, IOptionProps, NonIdealState, NumericInput, Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {ColormapConfigComponent} from "./ColormapConfigComponent/ColormapConfigComponent";
import {LinePlotComponent, LinePlotComponentProps, PlotType, ProfilerInfoComponent} from "components/Shared";
import {TaskProgressDialogComponent} from "components/Dialogs";
import {RenderConfigWidgetStore} from "stores/widgets";
import {AnimationState, FrameScaling, FrameStore, RenderConfigStore, WidgetConfig, WidgetProps, HelpType} from "stores";
import {Point2D} from "models";
import {clamp, toExponential, toFixed} from "utilities";
import "./RenderConfigComponent.css";

const KEYCODE_ENTER = 13;

@observer
export class RenderConfigComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "render-config",
            type: "render-config",
            minWidth: 250,
            minHeight: 225,
            defaultWidth: 650,
            defaultHeight: 225,
            title: "Render Configuration",
            isCloseable: true,
            helpType: HelpType.RENDER_CONFIG
        };
    }

    private cachedFrame: FrameStore;
    private cachedHistogram: CARTA.IHistogram;

    @observable width: number;
    @observable height: number;

    @computed get widgetStore(): RenderConfigWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.renderConfigWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.renderConfigWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new RenderConfigWidgetStore();
    }

    @computed get plotData(): { values: Array<Point2D>, xMin: number, xMax: number, yMin: number, yMax: number } {
        const frame = this.props.appStore.activeFrame;
        if (frame && frame.renderConfig.histogram && frame.renderConfig.histogram.bins && frame.renderConfig.histogram.bins.length) {
            const histogram = frame.renderConfig.histogram;
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
        if (!props.docked && props.id === RenderConfigComponent.WIDGET_CONFIG.type) {
            // Assign the next unique ID
            const id = props.appStore.widgetsStore.addRenderConfigWidget();
            props.appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!this.props.appStore.widgetsStore.renderConfigWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                this.props.appStore.widgetsStore.renderConfigWidgets.set(this.props.id, new RenderConfigWidgetStore());
            }
        }

        autorun(() => {
            if (this.props.appStore.activeFrame) {
                const newHist = this.props.appStore.activeFrame.renderConfig.histogram;
                if (newHist !== this.cachedHistogram) {
                    this.cachedHistogram = newHist;
                    this.widgetStore.clearXYBounds();
                }
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
        const frame = this.props.appStore.activeFrame;

        if (frame !== this.cachedFrame) {
            this.cachedFrame = frame;
            this.widgetStore.clearXYBounds();
        }
    }

    handleColorMapChange = (newColorMap: string) => {
        this.props.appStore.activeFrame.renderConfig.setColorMap(newColorMap);
    };

    handleScalingChange = (scaling: FrameScaling) => {
        this.props.appStore.activeFrame.renderConfig.setScaling(scaling);
    };

    handleScaleMinChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        if (isFinite(val) && val !== this.props.appStore.activeFrame.renderConfig.scaleMinVal) {
            this.props.appStore.activeFrame.renderConfig.setCustomScale(val, this.props.appStore.activeFrame.renderConfig.scaleMaxVal);
        }
    };

    handleScaleMaxChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        if (isFinite(val) && val !== this.props.appStore.activeFrame.renderConfig.scaleMaxVal) {
            this.props.appStore.activeFrame.renderConfig.setCustomScale(this.props.appStore.activeFrame.renderConfig.scaleMinVal, val);
        }
    };

    @action onResize = (width: number, height: number) => {
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

    handleCubeHistogramSelected = () => {
        const frame = this.props.appStore.activeFrame;
        if (frame && frame.renderConfig) {
            frame.renderConfig.setUseCubeHistogram(true);
            if (frame.renderConfig.cubeHistogramProgress < 1.0) {
                this.props.appStore.requestCubeHistogram();
            }
        }
    };

    handleCubeHistogramCancelled = () => {
        const frame = this.props.appStore.activeFrame;
        if (frame && frame.renderConfig) {
            frame.renderConfig.setUseCubeHistogram(false);
        }
        this.props.appStore.cancelCubeHistogramRequest();
    };

    onMinMoved = (x: number) => {
        const frame = this.props.appStore.activeFrame;
        // Check bounds first, to make sure the max isn't being moved below the min
        if (frame && frame.renderConfig && x < frame.renderConfig.scaleMaxVal) {
            this.props.appStore.activeFrame.renderConfig.setCustomScale(x, this.props.appStore.activeFrame.renderConfig.scaleMaxVal);
        }
    };

    onMaxMoved = (x: number) => {
        const frame = this.props.appStore.activeFrame;
        // Check bounds first, to make sure the max isn't being moved below the min
        if (frame && frame.renderConfig && x > frame.renderConfig.scaleMinVal) {
            this.props.appStore.activeFrame.renderConfig.setCustomScale(this.props.appStore.activeFrame.renderConfig.scaleMinVal, x);
        }
    };

    onGraphCursorMoved = _.throttle((x) => {
        this.widgetStore.setCursor(x);
    }, 100);

    private genProfilerInfo = (): string[] => {
        let profilerInfo: string[] = [];
        if (this.widgetStore.cursorX !== undefined) {
            let numberString;
            // Switch between standard and scientific notation
            if (this.widgetStore.cursorX < 1e-2) {
                numberString = toExponential(this.widgetStore.cursorX, 2);
            } else {
                numberString = toFixed(this.widgetStore.cursorX, 2);
            }

            const frame = this.props.appStore.activeFrame;
            if (frame.unit) {
                numberString += ` ${frame.unit}`;
            }

            profilerInfo.push(`Cursor: ${numberString}`);
        }
        return profilerInfo;
    };

    render() {
        const appStore = this.props.appStore;
        const frame = appStore.activeFrame;

        if (!frame || !this.widgetStore) {
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

        const imageName = frame.frameInfo.fileInfo.name;
        const plotName = `channel ${frame.channel} histogram`;
        let linePlotProps: LinePlotComponentProps = {
            xLabel: unitString,
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: plotName,
            logY: this.widgetStore.logScaleY,
            usePointSymbols: this.widgetStore.plotType === PlotType.POINTS,
            interpolateLines: this.widgetStore.plotType === PlotType.LINES,
            showYAxisTicks: false,
            showYAxisLabel: false,
            graphClicked: this.onMinMoved,
            graphRightClicked: this.onMaxMoved,
            graphZoomedX: this.widgetStore.setXBounds,
            graphZoomedY: this.widgetStore.setYBounds,
            graphZoomedXY: this.widgetStore.setXYBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true,
            borderWidth: this.widgetStore.lineWidth,
            pointRadius: this.widgetStore.linePlotPointSize,
            zeroLineWidth: 2
        };

        if (frame.renderConfig.histogram && frame.renderConfig.histogram.bins && frame.renderConfig.histogram.bins.length) {
            const currentPlotData = this.plotData;
            if (currentPlotData) {
                linePlotProps.data = currentPlotData.values;

                // set line color
                let primaryLineColor = this.widgetStore.primaryLineColor.colorHex;
                if (appStore.darkTheme) {
                    if (!this.widgetStore.primaryLineColor.fixed) {
                        primaryLineColor = Colors.BLUE4;
                    }
                }
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
        }

        if (frame.renderConfig) {
            linePlotProps.markers = [{
                value: frame.renderConfig.scaleMinVal,
                id: "marker-min",
                label: this.widgetStore.markerTextVisible ? "Min" : undefined,
                draggable: true,
                dragCustomBoundary: {xMax: frame.renderConfig.scaleMaxVal},
                dragMove: this.onMinMoved,
                horizontal: false,
            }, {
                value: frame.renderConfig.scaleMaxVal,
                id: "marker-max",
                label: this.widgetStore.markerTextVisible ? "Max" : undefined,
                draggable: true,
                dragCustomBoundary: {xMin: frame.renderConfig.scaleMinVal},
                dragMove: this.onMaxMoved,
                horizontal: false,
            }];

            if (this.widgetStore.meanRmsVisible && frame.renderConfig.histogram && frame.renderConfig.histogram.stdDev > 0) {
                linePlotProps.markers.push({
                    value: frame.renderConfig.histogram.mean,
                    id: "marker-mean",
                    draggable: false,
                    horizontal: false,
                    color: appStore.darkTheme ? Colors.GREEN4 : Colors.GREEN2,
                    dash: [5]
                });

                linePlotProps.markers.push({
                    value: frame.renderConfig.histogram.mean,
                    id: "marker-rms",
                    draggable: false,
                    horizontal: false,
                    width: frame.renderConfig.histogram.stdDev,
                    opacity: 0.2,
                    color: appStore.darkTheme ? Colors.GREEN4 : Colors.GREEN2
                });
            }
        }

        const percentileButtonCutoff = 600;
        const histogramCutoff = 430;
        const displayRankButtons = this.width > percentileButtonCutoff;
        const stokes = frame.renderConfig.stokes;
        let percentileButtonsDiv, percentileSelectDiv;
        if (displayRankButtons) {
            const percentileRankButtons = RenderConfigStore.PERCENTILE_RANKS.map(rank => (
                <Button small={true} key={rank} onClick={() => this.handlePercentileRankClick(rank)} active={frame.renderConfig.selectedPercentileVal === rank}>
                    {`${rank}%`}
                </Button>
            ));
            percentileRankButtons.push(
                <Button small={true} key={-1} onClick={this.setCustomPercentileRank} active={frame.renderConfig.selectedPercentileVal === -1}>
                    Custom
                </Button>
            );
            percentileButtonsDiv = (
                <div className="percentile-buttons">
                    <ButtonGroup fill={true}>
                        {percentileRankButtons}
                    </ButtonGroup>
                </div>
            );
        } else {
            const percentileRankOptions: IOptionProps [] = RenderConfigStore.PERCENTILE_RANKS.map(rank => ({label: `${rank}%`, value: rank}));
            percentileRankOptions.push({label: "Custom", value: -1});
            percentileSelectDiv = (
                <div className="percentile-select">
                    <FormGroup label="Clip Percentile" inline={true}>
                        <HTMLSelect options={percentileRankOptions} value={frame.renderConfig.selectedPercentileVal} onChange={this.handlePercentileRankSelectChanged}/>
                    </FormGroup>
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
                        {this.width >= histogramCutoff && <ProfilerInfoComponent info={this.genProfilerInfo()}/>}
                    </div>
                </div>
                }
                <div className="colormap-config">
                    <ColormapConfigComponent
                        darkTheme={appStore.darkTheme}
                        renderConfig={frame.renderConfig}
                        onCubeHistogramSelected={this.handleCubeHistogramSelected}
                        showHistogramSelect={frame.frameInfo.fileInfoExtended.depth > 1}
                        disableHistogramSelect={appStore.animatorStore.animationState === AnimationState.PLAYING}
                        warnOnCubeHistogram={(frame.frameInfo.fileFeatureFlags & CARTA.FileFeatureFlags.CUBE_HISTOGRAMS) === 0}
                    />
                    <FormGroup label={"Clip Min"} inline={true}>
                        <NumericInput
                            value={frame.renderConfig.scaleMinVal}
                            selectAllOnFocus={true}
                            buttonPosition={"none"}
                            allowNumericCharactersOnly={false}
                            onBlur={this.handleScaleMinChange}
                            onKeyDown={this.handleScaleMinChange}
                        />
                    </FormGroup>
                    <FormGroup label={"Clip Max"} inline={true}>
                        <NumericInput
                            value={frame.renderConfig.scaleMaxVal}
                            selectAllOnFocus={true}
                            buttonPosition={"none"}
                            onBlur={this.handleScaleMaxChange}
                            onKeyDown={this.handleScaleMaxChange}
                        />
                    </FormGroup>
                    {this.width < histogramCutoff && percentileSelectDiv}
                </div>
                <TaskProgressDialogComponent
                    isOpen={frame.renderConfig.useCubeHistogram && frame.renderConfig.cubeHistogramProgress < 1.0}
                    progress={frame.renderConfig.cubeHistogramProgress}
                    timeRemaining={appStore.estimatedTaskRemainingTime}
                    cancellable={true}
                    onCancel={this.handleCubeHistogramCancelled}
                    text={"Calculating cube histogram"}
                />
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"}/>
            </div>
        );
    }
}
