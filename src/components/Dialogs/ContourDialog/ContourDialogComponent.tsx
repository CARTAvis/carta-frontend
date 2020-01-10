import * as React from "react";
import {autorun, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Alert, AnchorButton, Button, Classes, Colors, FormGroup, HTMLSelect, IDialogProps, Intent, MenuItem, NonIdealState, NumericInput, Tab, Tabs} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {ColorResult} from "react-color";
import {CARTA} from "carta-protobuf";
import {DraggableDialogComponent, TaskProgressDialogComponent} from "components/Dialogs";
import {ColormapComponent, ColorPickerComponent, LinePlotComponent, LinePlotComponentProps, PlotType} from "components/Shared";
import {AppStore, ContourDashMode, FrameStore} from "stores";
import {RenderConfigWidgetStore} from "stores/widgets";
import {Point2D} from "models";
import {clamp, SWATCH_COLORS} from "utilities";
import {SCALING_POPOVER_PROPS} from "../../RenderConfig/ColormapConfigComponent/ColormapConfigComponent";
import "./ContourDialogComponent.css";

const DataSourceSelect = Select.ofType<FrameStore>();
const DashModeSelect = Select.ofType<ContourDashMode>();
const HistogramSelect = Select.ofType<boolean>();

enum ContourDialogTabs {
    Levels,
    Styling
}

@observer
export class ContourDialogComponent extends React.Component<{ appStore: AppStore }> {
    @observable showCubeHistogramAlert: boolean;
    @observable currentTab: ContourDialogTabs = ContourDialogTabs.Levels;

    private readonly widgetStore: RenderConfigWidgetStore;
    private cachedFrame: FrameStore;
    private cachedHistogram: CARTA.IHistogram;

    constructor(props: { appStore: AppStore }) {
        super(props);

        this.widgetStore = new RenderConfigWidgetStore();

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

    @computed get plotData(): { values: Array<Point2D>, xMin: number, xMax: number, yMin: number, yMax: number } {
        const frame = this.props.appStore.activeFrame;
        if (frame && frame.renderConfig.contourHistogram && frame.renderConfig.contourHistogram.bins && frame.renderConfig.contourHistogram.bins.length) {
            const histogram = frame.renderConfig.contourHistogram;
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

    private renderDataSourceSelectItem = (frame: FrameStore, {handleClick, modifiers, query}) => {
        if (!frame) {
            return null;
        }
        return <MenuItem text={frame.frameInfo.fileInfo.name} onClick={handleClick} key={frame.frameInfo.fileId}/>;
    };

    private renderDashModeSelectItem = (mode: ContourDashMode, {handleClick, modifiers, query}) => {
        return <MenuItem text={ContourDashMode[mode]} onClick={handleClick} key={mode}/>;
    };

    private handleDataSourceSelected = (frame: FrameStore) => {
        this.props.appStore.setActiveFrame(frame.frameInfo.fileId);
    };

    renderHistogramSelectItem = (isCube: boolean, {handleClick, modifiers, query}) => {
        return <MenuItem text={isCube ? "Per-Cube" : "Per-Channel"} onClick={handleClick} key={isCube ? "cube" : "channel"}/>;
    };

    private handleHistogramChange = (value: boolean) => {
        const appStore = this.props.appStore;
        if (!appStore || !appStore.activeFrame) {
            return;
        }
        if (value && !appStore.activeFrame.renderConfig.cubeHistogram) {
            this.showCubeHistogramAlert = true;
        } else {
            appStore.activeFrame.renderConfig.setUseCubeHistogramContours(value);
        }
    };

    private handleAlertConfirm = () => {
        const frame = this.props.appStore.activeFrame;
        if (frame && frame.renderConfig) {
            frame.renderConfig.setUseCubeHistogramContours(true);
            if (frame.renderConfig.cubeHistogramProgress < 1.0) {
                this.props.appStore.requestCubeHistogram();
            }
        }
        this.showCubeHistogramAlert = false;
    };

    private handleAlertCancel = () => {
        this.showCubeHistogramAlert = false;
    };

    private handleCubeHistogramCancelled = () => {
        const frame = this.props.appStore.activeFrame;
        if (frame && frame.renderConfig) {
            frame.renderConfig.setUseCubeHistogramContours(false);
        }
        this.props.appStore.cancelCubeHistogramRequest();
    };

    private handleApplyContours = () => {
        const appStore = this.props.appStore;
        if (!appStore || !appStore.activeFrame) {
            return;
        }

        appStore.activeFrame.applyContours();
    };

    private handleClearContours = () => {
        const appStore = this.props.appStore;
        if (!appStore || !appStore.activeFrame) {
            return;
        }

        appStore.activeFrame.clearContours();
    };

    public render() {
        const appStore = this.props.appStore;

        const dialogProps: IDialogProps = {
            icon: "heatmap",
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.contourDialogVisible,
            onClose: appStore.dialogStore.hideContourDialog,
            className: "contour-dialog",
            canEscapeKeyClose: false,
            title: "Contour Configuration",
        };

        if (!appStore || !appStore.activeFrame) {
            return (
                <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={520} defaultHeight={620} enableResizing={true}>
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>
                </DraggableDialogComponent>
            );
        }

        const frame = appStore.activeFrame;

        let unitString = "Value";
        if (frame && frame.unit) {
            unitString = `Value (${frame.unit})`;
        }

        const linePlotProps: LinePlotComponentProps = {
            xLabel: unitString,
            darkMode: appStore.darkTheme,
            logY: this.widgetStore.logScaleY,
            usePointSymbols: this.widgetStore.plotType === PlotType.POINTS,
            interpolateLines: this.widgetStore.plotType === PlotType.LINES,
            showYAxisTicks: false,
            showYAxisLabel: false,
            // graphClicked: this.onMinMoved,
            // graphRightClicked: this.onMaxMoved,
            graphZoomedX: this.widgetStore.setXBounds,
            graphZoomedY: this.widgetStore.setYBounds,
            graphZoomedXY: this.widgetStore.setXYBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            scrollZoom: true,
            borderWidth: this.widgetStore.lineWidth,
            pointRadius: this.widgetStore.linePlotPointSize,
            zeroLineWidth: 2
        };

        const currentPlotData = this.plotData;
        if (currentPlotData) {
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
                const xRange = currentPlotData.xMax - currentPlotData.xMin;
                linePlotProps.xMin = currentPlotData.xMin - 0.01 * xRange;
                linePlotProps.xMax = currentPlotData.xMax + 0.01 * xRange;
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

            linePlotProps.data = currentPlotData.values;
        }

        if (frame.contourConfig.levels && frame.contourConfig.levels.length) {
            linePlotProps.markers = frame.contourConfig.levels.map(level => ({
                value: level,
                id: `marker-${level}`,
                draggable: false,
                horizontal: false,
            }));
        }

        const levelPanel = (
            <div className="contour-level-panel">
                <FormGroup label={"Histogram"} inline={true}>
                    <HistogramSelect
                        activeItem={frame.renderConfig.useCubeHistogramContours}
                        popoverProps={SCALING_POPOVER_PROPS}
                        filterable={false}
                        items={[true, false]}
                        onItemSelect={this.handleHistogramChange}
                        itemRenderer={this.renderHistogramSelectItem}
                    >
                        <Button text={frame.renderConfig.useCubeHistogramContours ? "Per-Cube" : "Per-Channel"} rightIcon="double-caret-vertical" alignText={"right"}/>
                    </HistogramSelect>
                </FormGroup>
                <div className="histogram-plot">
                    <LinePlotComponent {...linePlotProps}/>
                </div>
                <p>Placeholder</p>
            </div>
        );

        const stylePanel = (
            <div className="contour-style-panel">
                <FormGroup inline={true} label="Thickness">
                    <NumericInput
                        placeholder="Thickness"
                        min={0.5}
                        max={10}
                        value={frame.contourConfig.thickness}
                        majorStepSize={0.5}
                        stepSize={0.5}
                        onValueChange={frame.contourConfig.setThickness}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Dashes">
                    <DashModeSelect
                        activeItem={frame.contourConfig.dashMode}
                        onItemSelect={frame.contourConfig.setDashMode}
                        popoverProps={{minimal: true, position: "bottom"}}
                        filterable={false}
                        items={[ContourDashMode.None, ContourDashMode.Dashed, ContourDashMode.NegativeOnly]}
                        itemRenderer={this.renderDashModeSelectItem}
                    >
                        <Button text={ContourDashMode[frame.contourConfig.dashMode]} rightIcon="double-caret-vertical" alignText={"right"}/>
                    </DashModeSelect>
                </FormGroup>
                <FormGroup inline={true} label="Color Mode">
                    <HTMLSelect value={frame.contourConfig.colormapEnabled ? 1 : 0} onChange={(ev) => frame.contourConfig.setColormapEnabled(parseInt(ev.currentTarget.value) > 0)}>
                        <option key={0} value={0}>Constant Color</option>
                        <option key={1} value={1}>Color-mapped</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Color Map" disabled={!frame.contourConfig.colormapEnabled}>
                    <ColormapComponent
                        inverted={false}
                        disabled={!frame.contourConfig.colormapEnabled}
                        selectedItem={frame.contourConfig.colormap}
                        onItemSelect={frame.contourConfig.setColormap}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Bias" disabled={!frame.contourConfig.colormapEnabled}>
                    <NumericInput
                        disabled={!frame.contourConfig.colormapEnabled}
                        placeholder="Bias"
                        min={-1.0}
                        max={1.0}
                        value={frame.contourConfig.colormapBias}
                        majorStepSize={0.1}
                        stepSize={0.1}
                        onValueChange={frame.contourConfig.setColormapBias}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Contrast" disabled={!frame.contourConfig.colormapEnabled}>
                    <NumericInput
                        disabled={!frame.contourConfig.colormapEnabled}
                        placeholder="Contrast"
                        min={0.0}
                        max={3.0}
                        value={frame.contourConfig.colormapContrast}
                        majorStepSize={0.1}
                        stepSize={0.1}
                        onValueChange={frame.contourConfig.setColormapContrast}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Color" disabled={frame.contourConfig.colormapEnabled}>
                    <ColorPickerComponent
                        color={frame.contourConfig.color}
                        presetColors={SWATCH_COLORS}
                        setColor={(color: ColorResult) => frame.contourConfig.setColor(color.rgb)}
                        disableAlpha={true}
                        disabled={frame.contourConfig.colormapEnabled}
                        darkTheme={appStore.darkTheme}
                    />
                </FormGroup>
            </div>
        );

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={520} defaultHeight={620} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup inline={true} label="Data Source">
                        <DataSourceSelect
                            activeItem={frame}
                            onItemSelect={this.handleDataSourceSelected}
                            popoverProps={{minimal: true, position: "bottom"}}
                            filterable={false}
                            items={appStore.frames}
                            itemRenderer={this.renderDataSourceSelectItem}
                        >
                            <Button text={frame.frameInfo.fileInfo.name} rightIcon="double-caret-vertical" alignText={"right"}/>
                        </DataSourceSelect>
                    </FormGroup>
                    <Tabs defaultSelectedTabId={ContourDialogTabs.Levels} renderActiveTabPanelOnly={true}>
                        <Tab id={ContourDialogTabs.Levels} title="Levels" panel={levelPanel}/>
                        <Tab id={ContourDialogTabs.Styling} title="Styling" panel={stylePanel}/>
                    </Tabs>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.WARNING} onClick={this.handleClearContours} text="Clear"/>
                        <AnchorButton intent={Intent.SUCCESS} onClick={this.handleApplyContours} text="Apply"/>
                        <AnchorButton intent={Intent.NONE} onClick={appStore.dialogStore.hideContourDialog} text="Close"/>
                    </div>
                </div>
                <Alert icon={"time"} isOpen={this.showCubeHistogramAlert} onCancel={this.handleAlertCancel} onConfirm={this.handleAlertConfirm} cancelButtonText={"Cancel"}>
                    <p>
                        Calculating a cube histogram may take a long time, depending on the size of the file. Are you sure you want to continue?
                    </p>
                </Alert>
                <TaskProgressDialogComponent
                    isOpen={frame.renderConfig.useCubeHistogramContours && frame.renderConfig.cubeHistogramProgress < 1.0}
                    progress={frame.renderConfig.cubeHistogramProgress}
                    timeRemaining={appStore.estimatedTaskRemainingTime}
                    cancellable={true}
                    onCancel={this.handleCubeHistogramCancelled}
                    text={"Calculating cube histogram"}
                />
            </DraggableDialogComponent>
        );
    }
}
