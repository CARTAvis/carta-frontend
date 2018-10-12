import * as React from "react";
import * as _ from "lodash";
import ReactResizeDetector from "react-resize-detector";
import {computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Chart} from "chart.js";
import {FormGroup, HTMLSelect, NonIdealState, ButtonGroup, Button, IOptionProps, NumericInput} from "@blueprintjs/core";
import {LinePlotComponent, LinePlotComponentProps} from "../Shared/LinePlot/LinePlotComponent";
import {AppStore} from "../../stores/AppStore";
import {FrameStore} from "../../stores/FrameStore";
import {FrameScaling} from "../../stores/RenderConfigStore";
import {WidgetConfig} from "../../stores/widgets/FloatingWidgetStore";
import {ColormapConfigComponent} from "./ColormapConfigComponent/ColormapConfigComponent";
import {clamp} from "../../util/math";
import {Point2D} from "../../models/Point2D";
import {PopoverSettingsComponent} from "../Shared/PopoverSettings/PopoverSettingsComponent";
import {RenderConfigSettingsPanelComponent} from "./RenderConfigSettingsPanelComponent/RenderConfigSettingsPanelComponent";
import {RenderConfigWidgetStore} from "../../stores/widgets/RenderConfigWidgetStore";
import "./RenderConfigComponent.css";

class RenderConfigComponentProps {
    appStore: AppStore;
    id: string;
    docked: boolean;
}

// The fixed size of the settings panel popover (excluding the show/hide button)
const PANEL_CONTENT_WIDTH = 140;

@observer
export class RenderConfigComponent extends React.Component<RenderConfigComponentProps> {
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
        if (frame && frame.renderConfig.channelHistogram && frame.renderConfig.channelHistogram.bins && frame.renderConfig.channelHistogram.bins.length) {
            const histogram = frame.renderConfig.channelHistogram;
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

            const N = maxIndex - minIndex;
            if (N > 0 && !isNaN(N)) {
                const values = new Array(maxIndex - minIndex);

                for (let i = minIndex; i <= maxIndex; i++) {
                    values[i - minIndex] = {x: histogram.firstBinCenter + histogram.binWidth * i, y: histogram.bins[i]};
                    yMin = Math.min(yMin, histogram.bins[i]);
                    yMax = Math.max(yMax, histogram.bins[i]);
                }
                return {values, xMin, xMax, yMin, yMax};
            }
        }
        return null;
    }

    constructor(props: RenderConfigComponentProps) {
        super(props);
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === RenderConfigComponent.WIDGET_CONFIG.id) {
            // Assign the next unique ID
            const id = props.appStore.widgetsStore.addNewRenderConfigWidget();
            props.appStore.widgetsStore.floatingWidgetStore.changeWidgetId(props.id, id);
        }
        else {
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

        let linePlotProps: LinePlotComponentProps = {
            xLabel: unitString,
            yLabel: "Count",
            darkMode: appStore.darkTheme,
            logY: this.widgetStore.logScaleY,
            usePointSymbols: this.widgetStore.usePoints,
            interpolateLines: this.widgetStore.interpolateLines,
            graphClicked: this.onMinMoved,
            graphRightClicked: this.onMaxMoved,
            graphZoomedX: this.widgetStore.setXBounds,
            graphZoomedY: this.widgetStore.setYBounds,
            graphZoomedXY: this.widgetStore.setXYBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true
        };

        if (frame && frame.renderConfig.channelHistogram && frame.renderConfig.channelHistogram.bins && frame.renderConfig.channelHistogram.bins.length) {
            const currentPlotData = this.plotData;
            if (currentPlotData && currentPlotData.values && currentPlotData.values.length) {
                linePlotProps.data = currentPlotData.values;
                // Determine scale in X and Y directions. If auto-scaling, use the bounds of the current data
                if (this.widgetStore.isAutoScaledX) {
                    linePlotProps.xMin = currentPlotData.xMin;
                    linePlotProps.xMax = currentPlotData.xMax;
                }
                else {
                    linePlotProps.xMin = this.widgetStore.minX;
                    linePlotProps.xMax = this.widgetStore.maxX;
                }

                if (this.widgetStore.isAutoScaledY) {
                    linePlotProps.yMin = currentPlotData.yMin;
                    linePlotProps.yMax = currentPlotData.yMax;
                }
                else {
                    linePlotProps.yMin = this.widgetStore.minY;
                    linePlotProps.yMax = this.widgetStore.maxY;
                }
                // Fix log plot min bounds for entries with zeros in them
                if (this.widgetStore.logScaleY && linePlotProps.yMin <= 0) {
                    linePlotProps.yMin = 0.5;
                }
            }
        }

        if (frame && frame.renderConfig) {
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
        if (this.width >= histogramCutoff && this.widgetStore.cursorX !== undefined) {
            let numberString;
            // Switch between standard and scientific notation
            if (this.widgetStore.cursorX < 1e-2) {
                numberString = this.widgetStore.cursorX.toExponential(2);
            }
            else {
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