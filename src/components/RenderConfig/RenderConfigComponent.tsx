import * as React from "react";
import {Button, ButtonGroup, Colors, FormGroup, HTMLSelect, NonIdealState, type OptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as _ from "lodash";
import {action, autorun, type IReactionDisposer, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {TaskProgressDialogComponent} from "components/Dialogs";
import {LinePlotComponent, type LinePlotComponentProps, ProfilerInfoComponent, ResizeDetector, SafeNumericInput, ScrollShadow} from "components/Shared";
import {HelpType, ImageType, PlotType} from "enums";
import {type Point2D} from "models";
import {AppStore, type DefaultWidgetConfig, type WidgetProps, WidgetsStore} from "stores";
import {type FrameStore, RenderConfigStore} from "stores/Frame";
import {RenderConfigWidgetStore} from "stores/Widgets";
import {clamp, getColorForTheme, scaleValue, toExponential, toFixed} from "utilities";

import {type MultiPlotProps} from "../Shared/LinePlot/PlotContainer/PlotContainerComponent";

import {ColorBlendingConfigComponent} from "./ColorBlendingConfigComponent/ColorBlendingConfigComponent";
import {ColormapConfigComponent} from "./ColormapConfigComponent/ColormapConfigComponent";
import {HistogramConfigComponent} from "./HistogramConfigComponent/HistogramConfigComponent";

import "./RenderConfigComponent.scss";

const COLORSCALE_LENGTH = 2048;

@observer
export class RenderConfigComponent extends React.Component<WidgetProps> {
    private readonly disposers: IReactionDisposer[] = [];

    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "render-config",
            type: "render-config",
            minWidth: 350,
            minHeight: 225,
            defaultWidth: 650,
            defaultHeight: 225,
            title: "Render Configuration",
            isCloseable: true,
            helpType: [HelpType.RENDER_CONFIG, HelpType.RENDER_CONFIG_COLOR_BLENDING]
        };
    }

    private cachedFrame: FrameStore;
    private cachedHistogram: CARTA.Histogram.$Properties | undefined;
    private widgetId: string;

    @observable width: number = 650;
    @observable height: number = 225;

    get widgetStore(): RenderConfigWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.renderConfigWidgets) {
            const widgetStore = widgetsStore.renderConfigWidgets.get(this.widgetId);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new RenderConfigWidgetStore();
    }

    get plotData(): {values: Array<Point2D>; xMin: number; xMax: number; yMin: number; yMax: number} | null {
        const frame = AppStore.Instance.activeFrame;
        if (frame) {
            const histogram = frame.renderConfig.histogram;
            if (!histogram) {
                return null;
            }
            const bins = histogram.bins;
            const firstBinCenter = histogram.firstBinCenter;
            const binWidth = histogram.binWidth;

            if (!bins || bins.length === 0 || !firstBinCenter || !binWidth) {
                return null;
            }

            let minIndex = 0;
            let maxIndex = bins.length - 1;

            // Truncate array if zoomed in (sidestepping ChartJS bug with off-canvas rendering and speeding up layout)
            if (!this.widgetStore.isAutoScaledX && this.widgetStore.minX !== undefined && this.widgetStore.maxX !== undefined) {
                minIndex = Math.floor((this.widgetStore.minX - firstBinCenter) / binWidth);
                minIndex = clamp(minIndex, 0, bins.length - 1);
                maxIndex = Math.ceil((this.widgetStore.maxX - firstBinCenter) / binWidth);
                maxIndex = clamp(maxIndex, 0, bins.length - 1);
            }

            const xMin = firstBinCenter + binWidth * minIndex;
            const xMax = firstBinCenter + binWidth * maxIndex;
            let yMin = bins[minIndex];
            let yMax = yMin;

            let values: Array<{x: number; y: number}> = [];
            const N = maxIndex - minIndex;
            if (N > 0 && !isNaN(N)) {
                values = new Array(maxIndex - minIndex);

                for (let i = minIndex; i <= maxIndex; i++) {
                    values[i - minIndex] = {x: firstBinCenter + binWidth * i, y: bins[i]};
                    yMin = Math.min(yMin, bins[i]);
                    yMax = Math.max(yMax, bins[i]);
                }
            }
            return {values, xMin, xMax, yMin, yMax};
        }
        return null;
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        this.widgetId = props.id;
        const appStore = AppStore.Instance;
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === RenderConfigComponent.WidgetConfig.type) {
            // Assign the next unique ID
            const id = appStore.widgetsStore.addRenderConfigWidget();
            if (id) {
                appStore.widgetsStore.changeWidgetId(props.id, id);
                this.widgetId = id;
            }
        } else {
            if (!appStore.widgetsStore.renderConfigWidgets.has(this.widgetId)) {
                console.log(`can't find store for widget with id=${this.widgetId}`);
                appStore.widgetsStore.renderConfigWidgets.set(this.widgetId, new RenderConfigWidgetStore());
            }
        }

        this.disposers.push(
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
            })
        );
    }

    componentWillUnmount() {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    }

    componentDidUpdate() {
        const frame = AppStore.Instance.activeFrame;

        if (frame !== this.cachedFrame) {
            this.cachedFrame = frame as FrameStore;
            this.widgetStore.clearXYBounds();
        }
    }

    handleScaleMinChange = ev => {
        if (ev.type === "keydown" && ev.key !== "Enter") {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const frame = AppStore.Instance.activeFrame;
        if (frame && isFinite(val) && val !== frame.renderConfig.scaleMinVal) {
            frame.renderConfig.setCustomScale(val, frame.renderConfig.scaleMaxVal);
        }
    };

    handleScaleMaxChange = ev => {
        if (ev.type === "keydown" && ev.key !== "Enter") {
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
        if (appStore.activeFrame && !appStore.activeFrame.renderConfig.setPercentileRank(value)) {
            appStore.alertStore.showAlert(`Couldn't set percentile of rank ${value}%`);
            appStore.logStore.addError(`Couldn't set percentile of rank ${value}%`, ["render"]);
        }
    };

    handlePercentileRankSelectChanged = (event: React.ChangeEvent<HTMLSelectElement>) => {
        AppStore.Instance.activeFrame?.renderConfig.setPercentileRank(+event.currentTarget.value);
    };

    setCustomPercentileRank = () => {
        AppStore.Instance.activeFrame?.renderConfig.setPercentileRank(-1);
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

    onGraphCursorMoved = _.throttle(x => {
        this.widgetStore.setCursor(x);
    }, 100);

    private genProfilerInfo = (): string[] => {
        const profilerInfo: string[] = [];
        if (this.widgetStore.cursorX !== undefined) {
            let numberString;
            // Switch between standard and scientific notation
            if (this.widgetStore.cursorX < 1e-2) {
                numberString = toExponential(this.widgetStore.cursorX, 2);
            } else {
                numberString = toFixed(this.widgetStore.cursorX, 2);
            }

            const frame = AppStore.Instance.activeFrame;
            if (frame?.requiredUnit) {
                numberString += ` ${frame.requiredUnit}`;
            }

            profilerInfo.push(`Cursor: ${numberString}`);
        }
        return profilerInfo;
    };

    render() {
        const appStore = AppStore.Instance;
        const image = appStore.activeImage;

        if (!image || !this.widgetStore) {
            return (
                <div className="render-config-container">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </div>
            );
        }

        if (image.type === ImageType.COLOR_BLENDING) {
            return (
                <ResizeDetector onResize={this.onResize} throttleTime={1000}>
                    <div className="render-config-container">
                        <ColorBlendingConfigComponent widgetWidth={this.width} />
                    </div>
                </ResizeDetector>
            );
        }

        const frame = image.store;

        let unitString = "Value";
        if (frame && frame.requiredUnit) {
            unitString = `Value (${frame.requiredUnit})`;
        }

        const imageName = frame.filename;
        const plotName = `channel ${frame.channel} histogram`;
        const linePlotProps: LinePlotComponentProps = {
            xLabel: unitString,
            isDarkMode: appStore.isDarkTheme,
            imageName: imageName,
            plotName: plotName,
            isLogY: this.widgetStore.isLogScaleY,
            plotType: this.widgetStore.plotType,
            shouldShowYAxisTicks: false,
            shouldShowYAxisLabel: false,
            graphClicked: this.onMinMoved,
            graphRightClicked: this.onMaxMoved,
            graphZoomedX: this.widgetStore.setXBounds,
            graphZoomedY: this.widgetStore.setYBounds,
            graphZoomedXY: this.widgetStore.setXYBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            shouldScrollZoom: true,
            borderWidth: this.widgetStore.lineWidth,
            pointRadius: this.widgetStore.linePlotPointSize,
            zeroLineWidth: 2,
            multiPlotPropsMap: new Map(),
            testId: this.widgetId + "-histogram"
        };

        const scaleMinVal = frame.renderConfig.scaleMinVal;
        const scaleMaxVal = frame.renderConfig.scaleMaxVal;
        const primaryLineColor = getColorForTheme(this.widgetStore.primaryLineColor);
        const histogram = frame.renderConfig.histogram;

        if (histogram && histogram.bins && histogram.bins.length) {
            const currentPlotData = this.plotData;
            if (currentPlotData) {
                const histogramProps: MultiPlotProps = {
                    imageName: imageName,
                    plotName: plotName,
                    data: currentPlotData.values,
                    type: this.widgetStore.plotType,
                    borderColor: primaryLineColor
                };
                linePlotProps.multiPlotPropsMap?.set("histogram", histogramProps);

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
                if (this.widgetStore.isLogScaleY && linePlotProps.yMin !== undefined && linePlotProps.yMin <= 0) {
                    linePlotProps.yMin = 0.5;
                }
            }
        }

        if (frame.renderConfig) {
            linePlotProps.markers = [
                {
                    value: scaleMinVal,
                    id: "marker-min",
                    label: this.widgetStore.isMarkerTextVisible ? "Min" : undefined,
                    draggable: true,
                    dragCustomBoundary: {xMax: scaleMaxVal},
                    dragMove: this.onMinMoved,
                    horizontal: false
                },
                {
                    value: scaleMaxVal,
                    id: "marker-max",
                    label: this.widgetStore.isMarkerTextVisible ? "Max" : undefined,
                    draggable: true,
                    dragCustomBoundary: {xMin: scaleMinVal},
                    dragMove: this.onMaxMoved,
                    horizontal: false
                }
            ];

            if (this.widgetStore.isMeanRmsVisible && histogram && histogram.stdDev != null && histogram.stdDev > 0 && histogram.mean != null) {
                linePlotProps.markers.push({
                    value: histogram.mean,
                    id: "marker-mean",
                    draggable: false,
                    horizontal: false,
                    color: appStore.isDarkTheme ? Colors.GREEN4 : Colors.GREEN2,
                    dash: [5]
                });

                linePlotProps.markers.push({
                    value: histogram.mean,
                    id: "marker-rms",
                    draggable: false,
                    horizontal: false,
                    width: histogram.stdDev,
                    opacity: 0.2,
                    color: appStore.isDarkTheme ? Colors.GREEN4 : Colors.GREEN2
                });
            }

            if (isFinite(scaleMinVal) && isFinite(scaleMaxVal) && scaleMinVal < scaleMaxVal) {
                const colormapScalingX = Array.from(Array(COLORSCALE_LENGTH).keys()).map(x => scaleMinVal + (x / (COLORSCALE_LENGTH - 1)) * (scaleMaxVal - scaleMinVal));
                let colormapScalingY = Array.from(Array(COLORSCALE_LENGTH).keys()).map(x => x / (COLORSCALE_LENGTH - 1));
                colormapScalingY = colormapScalingY.map(x =>
                    scaleValue(x, frame.renderConfig.scaling, frame.renderConfig.alpha, frame.renderConfig.gamma, frame.renderConfig.bias, frame.renderConfig.contrast, appStore.preferenceStore?.shouldUseSmoothedBiasContrast)
                );
                // fit to the histogram y axis
                if (linePlotProps.isLogY) {
                    colormapScalingY = colormapScalingY.map(x => Math.pow(10, Math.log10(linePlotProps.yMin!) + x * (Math.log10(linePlotProps.yMax!) - Math.log10(linePlotProps.yMin!))));
                } else {
                    colormapScalingY = colormapScalingY.map(x => linePlotProps.yMin! + x * (linePlotProps.yMax! - linePlotProps.yMin!));
                }

                const colormapScalingData: {x: number; y: number}[] = [];
                for (let i = 0; i < COLORSCALE_LENGTH; i++) {
                    colormapScalingData.push({x: colormapScalingX[i], y: colormapScalingY[i]});
                }
                const colormapScalingProps: MultiPlotProps = {
                    imageName: imageName,
                    plotName: plotName,
                    data: colormapScalingData,
                    type: PlotType.LINES,
                    borderColor: appStore.isDarkTheme ? Colors.GRAY5 : Colors.GRAY1,
                    borderWidth: 0.5,
                    opacity: 0.5,
                    shouldNotExport: true
                };
                linePlotProps.multiPlotPropsMap?.set("colormapScaling", colormapScalingProps);
            }
        }

        const percentileButtonCutoff = 600;
        const histogramCutoff = 430;
        const shouldDisplayRankButtons = this.width > percentileButtonCutoff;
        let percentileButtonsDiv, percentileSelectDiv;
        if (shouldDisplayRankButtons) {
            const percentileRankButtons = RenderConfigStore.PERCENTILE_RANKS.map(rank => (
                <Button size="small" key={rank} onClick={() => this.handlePercentileRankClick(rank)} active={frame.renderConfig.selectedPercentileVal === rank} data-testid={"clip-button-" + rank}>
                    {`${rank}%`}
                </Button>
            ));
            percentileRankButtons.push(
                <Button size="small" key={-1} onClick={this.setCustomPercentileRank} active={frame.renderConfig.selectedPercentileVal === -1}>
                    Custom
                </Button>
            );
            percentileButtonsDiv = (
                <div className="percentile-buttons">
                    <ButtonGroup fill={true}>{percentileRankButtons}</ButtonGroup>
                </div>
            );
        } else {
            const percentileRankOptions: OptionProps[] = RenderConfigStore.PERCENTILE_RANKS.map(rank => ({label: `${rank}%`, value: rank}));
            percentileRankOptions.push({label: "Custom", value: -1});
            percentileSelectDiv = (
                <div className="percentile-select">
                    <FormGroup label="Clip Percentile" inline={true}>
                        <HTMLSelect options={percentileRankOptions} value={frame.renderConfig.selectedPercentileVal} onChange={this.handlePercentileRankSelectChanged} />
                    </FormGroup>
                </div>
            );
        }

        return (
            <ResizeDetector onResize={this.onResize} throttleTime={1000}>
                <div className="render-config-container">
                    {this.width > histogramCutoff && (
                        <div className="histogram-container">
                            {shouldDisplayRankButtons ? percentileButtonsDiv : percentileSelectDiv}
                            <div className="histogram-plot">
                                <LinePlotComponent {...linePlotProps} />
                                {this.width >= histogramCutoff && <ProfilerInfoComponent info={this.genProfilerInfo()} />}
                            </div>
                        </div>
                    )}
                    <div className="options-container">
                        <ScrollShadow>
                            <div className="options-form">
                                <HistogramConfigComponent
                                    darkTheme={appStore.isDarkTheme}
                                    renderConfig={frame.renderConfig}
                                    onCubeHistogramSelected={this.handleCubeHistogramSelected}
                                    showHistogramSelect={frame.frameInfo.fileInfoExtended.depth > 1}
                                    disableHistogramSelect={appStore.animatorStore.isAnimationActive}
                                    warnOnCubeHistogram={(frame.frameInfo.fileFeatureFlags & CARTA.FileFeatureFlags.CUBE_HISTOGRAMS) === 0}
                                />
                                <FormGroup label={"Clip min"} inline={true}>
                                    <SafeNumericInput
                                        value={frame.renderConfig.scaleMinVal}
                                        selectAllOnFocus={true}
                                        buttonPosition={"none"}
                                        onBlur={this.handleScaleMinChange}
                                        onKeyDown={this.handleScaleMinChange}
                                        data-testid="clip-min-input"
                                    />
                                </FormGroup>
                                <FormGroup label={"Clip max"} inline={true}>
                                    <SafeNumericInput
                                        value={frame.renderConfig.scaleMaxVal}
                                        selectAllOnFocus={true}
                                        buttonPosition={"none"}
                                        onBlur={this.handleScaleMaxChange}
                                        onKeyDown={this.handleScaleMaxChange}
                                        data-testid="clip-max-input"
                                    />
                                </FormGroup>
                                <ColormapConfigComponent renderConfig={frame.renderConfig} />
                                {this.width < histogramCutoff && percentileSelectDiv}
                            </div>
                        </ScrollShadow>
                    </div>
                    <TaskProgressDialogComponent
                        isOpen={frame.renderConfig.isUsingCubeHistogram && frame.renderConfig.cubeHistogramProgress < 1.0}
                        progress={frame.renderConfig.cubeHistogramProgress}
                        timeRemaining={appStore.estimatedTaskRemainingTime || 0}
                        cancellable={true}
                        onCancel={this.handleCubeHistogramCancelled}
                        text={"Calculating cube histogram"}
                    />
                </div>
            </ResizeDetector>
        );
    }
}
