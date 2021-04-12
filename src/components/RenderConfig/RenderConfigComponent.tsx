import * as React from "react";
import * as _ from "lodash";
import ReactResizeDetector from "react-resize-detector";
import {action, autorun, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {Button, ButtonGroup, FormGroup, HTMLSelect, IOptionProps, NonIdealState, Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {HistogramConfigComponent} from "./HistogramConfigComponent/HistogramConfigComponent";
import {ColormapConfigComponent} from "./ColormapConfigComponent/ColormapConfigComponent";
import {MultiPlotProps} from "../Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {LinePlotComponent, LinePlotComponentProps, PlotType, ProfilerInfoComponent, SafeNumericInput} from "components/Shared";
import {TaskProgressDialogComponent} from "components/Dialogs";
import {RenderConfigWidgetStore} from "stores/widgets";
import {FrameStore, RenderConfigStore, DefaultWidgetConfig, WidgetProps, HelpType, AppStore, WidgetsStore} from "stores";
import {Point2D} from "models";
import {clamp, toExponential, toFixed, getColorForTheme, scaleValue} from "utilities";
import "./RenderConfigComponent.scss";

const KEYCODE_ENTER = 13;
const COLORSCALE_LENGTH = 2048;

@observer
export class RenderConfigComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
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
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.renderConfigWidgets) {
            const widgetStore = widgetsStore.renderConfigWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new RenderConfigWidgetStore();
    }

    @computed get plotData(): { values: Array<Point2D>, xMin: number, xMax: number, yMin: number, yMax: number } {
        const frame = AppStore.Instance.activeFrame;
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
        makeObservable(this);

        const appStore = AppStore.Instance;
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === RenderConfigComponent.WIDGET_CONFIG.type) {
            // Assign the next unique ID
            const id = appStore.widgetsStore.addRenderConfigWidget();
            appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!appStore.widgetsStore.renderConfigWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                appStore.widgetsStore.renderConfigWidgets.set(this.props.id, new RenderConfigWidgetStore());
            }
        }

        autorun(() => {
            if (appStore.activeFrame) {
                const newHist = appStore.activeFrame.renderConfig.histogram;
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
        const frame = AppStore.Instance.activeFrame;

        if (frame !== this.cachedFrame) {
            this.cachedFrame = frame;
            this.widgetStore.clearXYBounds();
        }
    }

    handleScaleMinChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const frame = AppStore.Instance.activeFrame;
        if (frame && isFinite(val) && val !== frame.renderConfig.scaleMinVal) {
            frame.renderConfig.setCustomScale(val, frame.renderConfig.scaleMaxVal);
        }
    };

    handleScaleMaxChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const frame = AppStore.Instance.activeFrame;
        if (frame && isFinite(val) && val !== frame.renderConfig.scaleMaxVal) {
            frame.renderConfig.setCustomScale(frame.renderConfig.scaleMinVal, val);
        }
    };

    @action onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    handlePercentileRankClick = (value: number) => {
        const appStore = AppStore.Instance;
        if (!appStore.activeFrame.renderConfig.setPercentileRank(value)) {
            appStore.alertStore.showAlert(`Couldn't set percentile of rank ${value}%`);
            appStore.logStore.addError(`Couldn't set percentile of rank ${value}%`, ["render"]);
        }
    };

    handlePercentileRankSelectChanged = (event: React.ChangeEvent<HTMLSelectElement>) => {
        AppStore.Instance.activeFrame.renderConfig.setPercentileRank(+event.currentTarget.value);
    };

    setCustomPercentileRank = () => {
        AppStore.Instance.activeFrame.renderConfig.setPercentileRank(-1);
    };

    handleCubeHistogramSelected = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        if (frame && frame.renderConfig) {
            frame.renderConfig.setUseCubeHistogram(true);
            if (frame.renderConfig.cubeHistogramProgress < 1.0) {
                appStore.requestCubeHistogram();
            }
        }
    };

    handleCubeHistogramCancelled = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        if (frame && frame.renderConfig) {
            frame.renderConfig.setUseCubeHistogram(false);
        }
        appStore.cancelCubeHistogramRequest();
    };

    onMinMoved = (x: number) => {
        const frame = AppStore.Instance.activeFrame;
        // Check bounds first, to make sure the max isn't being moved below the min
        if (frame && frame.renderConfig && x < frame.renderConfig.scaleMaxVal) {
            frame.renderConfig.setCustomScale(x, frame.renderConfig.scaleMaxVal);
        }
    };

    onMaxMoved = (x: number) => {
        const frame = AppStore.Instance.activeFrame;
        // Check bounds first, to make sure the max isn't being moved below the min
        if (frame && frame.renderConfig && x > frame.renderConfig.scaleMinVal) {
            frame.renderConfig.setCustomScale(frame.renderConfig.scaleMinVal, x);
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

            const frame = AppStore.Instance.activeFrame;
            if (frame.unit) {
                numberString += ` ${frame.unit}`;
            }

            profilerInfo.push(`Cursor: ${numberString}`);
        }
        return profilerInfo;
    };

    render() {
        const appStore = AppStore.Instance;
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

        const imageName = frame.filename;
        const plotName = `channel ${frame.channel} histogram`;
        let linePlotProps: LinePlotComponentProps = {
            xLabel: unitString,
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: plotName,
            logY: this.widgetStore.logScaleY,
            plotType: this.widgetStore.plotType,
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
            zeroLineWidth: 2,
            multiPlotPropsMap: new Map(),
            showColormapScaling: this.widgetStore.showColormapScaling,
            isAutoScaledX: this.widgetStore.isAutoScaledX
        };

        const scaleMinVal = frame.renderConfig?.scaleMinVal;
        const scaleMaxVal = frame.renderConfig?.scaleMaxVal;
        if (frame.renderConfig.histogram && frame.renderConfig.histogram.bins && frame.renderConfig.histogram.bins.length) {
            const currentPlotData = this.plotData;
            if (currentPlotData) {
                // set line color
                let primaryLineColor = getColorForTheme(this.widgetStore.primaryLineColor);

                let histogramProps: MultiPlotProps = {
                    data: currentPlotData.values,
                    type: this.widgetStore.plotType,
                    borderColor: primaryLineColor
                };
                linePlotProps.multiPlotPropsMap.set("histogram", histogramProps);

                // Determine scale in X and Y directions. If auto-scaling, use the bounds of the current data
                if (this.widgetStore.isAutoScaledX && this.widgetStore.showColormapScaling && isFinite(scaleMinVal) && isFinite(scaleMaxVal) && (scaleMinVal < scaleMaxVal)) {
                    linePlotProps.xMin = scaleMinVal - 0.02 * (scaleMaxVal - scaleMinVal);
                    linePlotProps.xMax = scaleMaxVal + 0.02 * (scaleMaxVal - scaleMinVal);
                } else if (this.widgetStore.isAutoScaledX) {
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
                value: scaleMinVal,
                id: "marker-min",
                label: this.widgetStore.markerTextVisible ? "Min" : undefined,
                draggable: true,
                dragCustomBoundary: {xMax: scaleMaxVal},
                dragMove: this.onMinMoved,
                horizontal: false,
            }, {
                value: scaleMaxVal,
                id: "marker-max",
                label: this.widgetStore.markerTextVisible ? "Max" : undefined,
                draggable: true,
                dragCustomBoundary: {xMin: scaleMinVal},
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

            if (this.widgetStore.showColormapScaling && isFinite(scaleMinVal) && isFinite(scaleMaxVal) && (scaleMinVal < scaleMaxVal)) {
                const colormapScalingX = Array.from(Array(COLORSCALE_LENGTH).keys()).map(x => scaleMinVal + x / (COLORSCALE_LENGTH - 1) * (scaleMaxVal - scaleMinVal));
                let colormapScalingY = Array.from(Array(COLORSCALE_LENGTH).keys()).map(x => x / (COLORSCALE_LENGTH - 1));
                colormapScalingY = colormapScalingY.map(x => scaleValue(x, frame.renderConfig.scaling, frame.renderConfig.alpha, frame.renderConfig.gamma, frame.renderConfig.bias, frame.renderConfig.contrast, frame.renderConfig.useSmoothedBiasContrast));
                // fit to the histogram y axis
                if (linePlotProps.logY) {
                    colormapScalingY = colormapScalingY.map(x => Math.pow(10, Math.log10(linePlotProps.yMin) + x * (Math.log10(linePlotProps.yMax) - Math.log10(linePlotProps.yMin))));
                } else {
                    colormapScalingY = colormapScalingY.map(x => linePlotProps.yMin + x * (linePlotProps.yMax - linePlotProps.yMin));
                }

                let colormapScalingData = [];
                for (let i = 0; i < COLORSCALE_LENGTH; i++) {
                    colormapScalingData.push({x: colormapScalingX[i], y: colormapScalingY[i]});
                }
                const colormapScalingProps: MultiPlotProps = {
                    data: colormapScalingData,
                    type: PlotType.LINES,
                    borderColor: appStore.darkTheme ? Colors.GRAY5 : Colors.GRAY1,
                    borderWidth: 0.5
                };
                linePlotProps.multiPlotPropsMap.set("colormapScaling", colormapScalingProps);
            }
        }

        const percentileButtonCutoff = 600;
        const histogramCutoff = 430;
        const displayRankButtons = this.width > percentileButtonCutoff;
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
                <div className="options-container">
                    <HistogramConfigComponent
                        darkTheme={appStore.darkTheme}
                        renderConfig={frame.renderConfig}
                        onCubeHistogramSelected={this.handleCubeHistogramSelected}
                        showHistogramSelect={frame.frameInfo.fileInfoExtended.depth > 1}
                        disableHistogramSelect={appStore.animatorStore.animationActive}
                        warnOnCubeHistogram={(frame.frameInfo.fileFeatureFlags & CARTA.FileFeatureFlags.CUBE_HISTOGRAMS) === 0}
                    />
                    <FormGroup label={"Clip Min"} inline={true}>
                        <SafeNumericInput
                            value={frame.renderConfig.scaleMinVal}
                            selectAllOnFocus={true}
                            buttonPosition={"none"}
                            onBlur={this.handleScaleMinChange}
                            onKeyDown={this.handleScaleMinChange}
                        />
                    </FormGroup>
                    <FormGroup label={"Clip Max"} inline={true}>
                        <SafeNumericInput
                            value={frame.renderConfig.scaleMaxVal}
                            selectAllOnFocus={true}
                            buttonPosition={"none"}
                            onBlur={this.handleScaleMaxChange}
                            onKeyDown={this.handleScaleMaxChange}
                        />
                    </FormGroup>
                    <ColormapConfigComponent
                        renderConfig={frame.renderConfig}
                    />
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
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"}>
                </ReactResizeDetector>
            </div>
        );
    }
}
