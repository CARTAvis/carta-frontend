import * as React from "react";
import * as _ from "lodash";
import ReactResizeDetector from "react-resize-detector";
import {action, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Chart} from "chart.js";
import {Button, ButtonGroup, FormGroup, HTMLSelect, IOptionProps, NonIdealState, NumericInput} from "@blueprintjs/core";
import {ColormapConfigComponent} from "./ColormapConfigComponent/ColormapConfigComponent";
import {RenderConfigSettingsPanelComponent} from "./RenderConfigSettingsPanelComponent/RenderConfigSettingsPanelComponent";
import {PopoverSettingsComponent, LinePlotComponent, LinePlotComponentProps, PlotType} from "components/Shared";
import {TaskProgressDialogComponent} from "components/Dialogs";
import {RenderConfigWidgetStore} from "stores/widgets";
import {AnimationState, FrameStore, FrameScaling, WidgetConfig, WidgetProps} from "stores";
import {clamp} from "utilities";
import {Point2D} from "models";
import "./RenderConfigComponent.css";

// The fixed size of the settings panel popover (excluding the show/hide button)
const PANEL_CONTENT_WIDTH = 160;

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
            isCloseable: true
        };
    }

    private cachedFrame: FrameStore;

    @observable width: number;
    @observable height: number;

    @computed get widgetStore(): RenderConfigWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.renderConfigWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.renderConfigWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.error("can't find store for widget");
        return new RenderConfigWidgetStore();
    }

    @computed get settingsPanelWidth(): number {
        return 20 + (this.widgetStore.settingsPanelVisible ? PANEL_CONTENT_WIDTH : 0);
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
        if (!props.docked && props.id === RenderConfigComponent.WIDGET_CONFIG.id) {
            // Assign the next unique ID
            const id = props.appStore.widgetsStore.addNewRenderConfigWidget();
            props.appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!this.props.appStore.widgetsStore.renderConfigWidgets.has(this.props.id)) {
                console.error(`can't find store for widget with id=${this.props.id}`);
                this.props.appStore.widgetsStore.renderConfigWidgets.set(this.props.id, new RenderConfigWidgetStore());
            }
        }
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

    onGraphCursorMoved = _.throttle((x) => {
        this.widgetStore.setCursor(x);
    }, 100);

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
            yLabel: "Count",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: plotName,
            logY: this.widgetStore.logScaleY,
            usePointSymbols: this.widgetStore.plotType === PlotType.POINTS,
            interpolateLines: this.widgetStore.plotType === PlotType.LINES,
            forceScientificNotationTicksY: true,
            graphClicked: this.onMinMoved,
            graphRightClicked: this.onMaxMoved,
            graphZoomedX: this.widgetStore.setXBounds,
            graphZoomedY: this.widgetStore.setYBounds,
            graphZoomedXY: this.widgetStore.setXYBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true
        };

        if (frame.renderConfig.histogram && frame.renderConfig.histogram.bins && frame.renderConfig.histogram.bins.length) {
            const currentPlotData = this.plotData;
            if (currentPlotData) {
                linePlotProps.data = currentPlotData.values;
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
                value: frame.renderConfig.scaleMin,
                id: "marker-min",
                label: this.widgetStore.markerTextVisible ? "Min" : undefined,
                draggable: true,
                dragMove: this.onMinMoved,
                horizontal: false,
            }, {
                value: frame.renderConfig.scaleMax,
                id: "marker-max",
                label: this.widgetStore.markerTextVisible ? "Max" : undefined,
                draggable: true,
                dragMove: this.onMaxMoved,
                horizontal: false,
            }];
        }

        const percentileButtonCutoff = 600 + this.settingsPanelWidth;
        const histogramCutoff = 430 + this.settingsPanelWidth;
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
        } else {
            const percentileRankOptions: IOptionProps [] = percentileRanks.map(rank => ({label: `${rank}%`, value: rank}));
            percentileRankOptions.push({label: "Custom", value: -1});
            percentileSelectDiv = (
                <div className="percentile-select">
                    <FormGroup label="Clip Percentile" inline={true}>
                        <HTMLSelect options={percentileRankOptions} value={frame.renderConfig.selectedPercentile} onChange={this.handlePercentileRankSelectChanged}/>
                    </FormGroup>
                </div>
            );
        }

        let cursorInfoDiv;
        if (this.width >= histogramCutoff && this.widgetStore.cursorX !== undefined) {
            let numberString;
            // Switch between standard and scientific notation
            if (this.widgetStore.cursorX < 1e-2) {
                numberString = this.widgetStore.cursorX.toExponential(2);
            } else {
                numberString = this.widgetStore.cursorX.toFixed(2);
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
                    <ColormapConfigComponent
                        darkTheme={appStore.darkTheme}
                        renderConfig={frame.renderConfig}
                        onCubeHistogramSelected={this.handleCubeHistogramSelected}
                        showHistogramSelect={frame.frameInfo.fileInfoExtended.depth > 1}
                        disableHistogramSelect={appStore.animatorStore.animationState === AnimationState.PLAYING}
                    />
                    <FormGroup label={"Clip Min"} inline={true}>
                        <NumericInput
                            value={frame.renderConfig.scaleMin}
                            selectAllOnFocus={true}
                            buttonPosition={"none"}
                            allowNumericCharactersOnly={false}
                            onValueChange={this.handleScaleMinChange}
                        />
                    </FormGroup>
                    <FormGroup label={"Clip Max"} inline={true}>
                        <NumericInput
                            value={frame.renderConfig.scaleMax}
                            selectAllOnFocus={true}
                            buttonPosition={"none"}
                            onValueChange={this.handleScaleMaxChange}
                        />
                    </FormGroup>
                    {this.width < histogramCutoff ? percentileSelectDiv : cursorInfoDiv}
                </div>
                <TaskProgressDialogComponent
                    isOpen={frame.renderConfig.useCubeHistogram && frame.renderConfig.cubeHistogramProgress < 1.0}
                    progress={frame.renderConfig.cubeHistogramProgress}
                    timeRemaining={appStore.estimatedTaskRemainingTime}
                    cancellable={true}
                    onCancel={this.handleCubeHistogramCancelled}
                    text={"Calculating cube histogram"}
                />
                <PopoverSettingsComponent
                    isOpen={this.widgetStore.settingsPanelVisible}
                    onShowClicked={this.widgetStore.showSettingsPanel}
                    onHideClicked={this.widgetStore.hideSettingsPanel}
                    contentWidth={PANEL_CONTENT_WIDTH}
                >
                    <RenderConfigSettingsPanelComponent widgetStore={this.widgetStore}/>
                </PopoverSettingsComponent>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"}/>
            </div>
        );
    }
}
