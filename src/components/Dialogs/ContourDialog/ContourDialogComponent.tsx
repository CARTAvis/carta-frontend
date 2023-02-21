import * as React from "react";
import {Alert, AnchorButton, Button, Classes, Colors, FormGroup, HTMLSelect, IDialogProps, Intent, MenuItem, NonIdealState, Tab, Tabs, TagInput} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {Select} from "@blueprintjs/select";
import {CARTA} from "carta-protobuf";
import {action, autorun, computed, makeObservable, observable, runInAction} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent, TaskProgressDialogComponent} from "components/Dialogs";
import {LinePlotComponent, LinePlotComponentProps, SafeNumericInput, SCALING_POPOVER_PROPS} from "components/Shared";
import {CustomIcon} from "icons/CustomIcons";
import {Point2D} from "models";
import {AppStore, HelpType} from "stores";
import {FrameStore} from "stores/Frame";
import {RenderConfigWidgetStore} from "stores/Widgets";
import {clamp, getColorForTheme, toExponential, toFixed} from "utilities";

import {ContourGeneratorPanelComponent} from "./ContourGeneratorPanel/ContourGeneratorPanelComponent";
import {ContourStylePanelComponent} from "./ContourStylePanel/ContourStylePanelComponent";

import "./ContourDialogComponent.scss";

enum ContourDialogTabs {
    Levels,
    Configuration,
    Styling
}

const DataSourceSelect = Select.ofType<FrameStore>();
const HistogramSelect = Select.ofType<boolean>();

@observer
export class ContourDialogComponent extends React.Component {
    @observable showCubeHistogramAlert: boolean;
    @observable currentTab: ContourDialogTabs = ContourDialogTabs.Levels;
    @observable levels: number[];
    @observable smoothingMode: CARTA.SmoothingMode;
    @observable smoothingFactor: number;

    private static readonly DefaultWidth = 600;
    private static readonly DefaultHeight = 660;

    private readonly widgetStore: RenderConfigWidgetStore;
    private cachedFrame: FrameStore;
    private cachedHistogram: CARTA.IHistogram;

    constructor(props: {appStore: AppStore}) {
        super(props);
        makeObservable(this);

        this.widgetStore = new RenderConfigWidgetStore();
        this.setDefaultContourParameters();

        autorun(() => {
            const appStore = AppStore.Instance;
            if (appStore.contourDataSource) {
                const newHist = appStore.contourDataSource.renderConfig.contourHistogram;
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

    @action setDefaultContourParameters() {
        const appStore = AppStore.Instance;
        const dataSource = appStore.contourDataSource;
        if (dataSource) {
            this.levels = dataSource.contourConfig.levels.slice();
            this.smoothingMode = dataSource.contourConfig.smoothingMode;
            this.smoothingFactor = dataSource.contourConfig.smoothingFactor;
        } else {
            this.levels = [];
            this.smoothingMode = appStore.preferenceStore.contourSmoothingMode;
            this.smoothingFactor = appStore.preferenceStore.contourSmoothingFactor;
        }
    }

    componentDidUpdate() {
        const appStore = AppStore.Instance;
        if (appStore.contourDataSource !== this.cachedFrame) {
            this.cachedFrame = appStore.contourDataSource;
            this.widgetStore.clearXYBounds();
            this.setDefaultContourParameters();
        }
    }

    @computed get contourConfigChanged(): boolean {
        const dataSource = AppStore.Instance.contourDataSource;
        if (dataSource) {
            const numContourLevels = this.levels.length;
            if (dataSource.contourConfig.smoothingMode !== this.smoothingMode) {
                return true;
            } else if (dataSource.contourConfig.smoothingFactor !== this.smoothingFactor) {
                return true;
            } else if (dataSource.contourConfig.levels.length !== numContourLevels) {
                return true;
            }

            for (let i = 0; i < numContourLevels; i++) {
                if (dataSource.contourConfig.levels[i] !== this.levels[i]) {
                    return true;
                }
            }
        }
        return false;
    }

    @computed get plotData(): {values: Array<Point2D>; xMin: number; xMax: number; yMin: number; yMax: number} {
        const dataSource = AppStore.Instance.contourDataSource;
        if (dataSource && dataSource.renderConfig.contourHistogram && dataSource.renderConfig.contourHistogram.bins && dataSource.renderConfig.contourHistogram.bins.length) {
            const histogram = dataSource.renderConfig.contourHistogram;
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

            let values: Array<{x: number; y: number}>;
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
        return <MenuItem text={frame.filename} onClick={handleClick} key={frame.frameInfo.fileId} />;
    };

    private renderHistogramSelectItem = (isCube: boolean, {handleClick, modifiers, query}) => {
        return <MenuItem text={isCube ? "Per-Cube" : "Per-Channel"} onClick={handleClick} key={isCube ? "cube" : "channel"} />;
    };

    private handleHistogramChange = (value: boolean) => {
        const appStore = AppStore.Instance;
        if (!appStore || !appStore.contourDataSource) {
            return;
        }
        if (value && !appStore.contourDataSource.renderConfig.cubeHistogram) {
            // skip alert and warning for HDF5 files
            if (appStore.contourDataSource.frameInfo.fileFeatureFlags & CARTA.FileFeatureFlags.CUBE_HISTOGRAMS) {
                this.handleAlertConfirm();
            } else {
                this.showCubeHistogramAlert = true;
            }
        } else {
            appStore.contourDataSource.renderConfig.setUseCubeHistogramContours(value);
        }
    };

    private handleAlertConfirm = () => {
        const appStore = AppStore.Instance;
        const dataSource = appStore.contourDataSource;
        if (dataSource && dataSource.renderConfig) {
            dataSource.renderConfig.setUseCubeHistogramContours(true);
            if (dataSource.renderConfig.cubeHistogramProgress < 1.0) {
                appStore.requestCubeHistogram(dataSource.frameInfo.fileId);
            }
        }
        this.showCubeHistogramAlert = false;
    };

    private handleAlertCancel = () => {
        this.showCubeHistogramAlert = false;
    };

    private handleCubeHistogramCancelled = () => {
        const appStore = AppStore.Instance;
        const dataSource = appStore.contourDataSource;
        if (dataSource && dataSource.renderConfig) {
            dataSource.renderConfig.setUseCubeHistogramContours(false);
        }
        appStore.cancelCubeHistogramRequest(dataSource.frameInfo.fileId);
    };

    private handleApplyContours = () => {
        const dataSource = AppStore.Instance.contourDataSource;
        if (dataSource) {
            dataSource.contourConfig.setContourConfiguration(this.levels.slice(), this.smoothingMode, this.smoothingFactor);
            dataSource.applyContours();
        }
    };

    private handleClearContours = () => {
        const appStore = AppStore.Instance;

        if (!appStore.contourDataSource) {
            return;
        }

        appStore.contourDataSource.clearContours();
    };

    private handleGraphClicked = (x: number) => {
        this.levels.push(x);
        this.levels = this.levels.sort();
    };

    private handleGraphRightClicked = (x: number) => {
        let closestIndex = -1;
        let minDistance = Number.MAX_VALUE;

        // Find closest level
        for (let i = 0; i < this.levels.length; i++) {
            const currentDist = Math.abs(x - this.levels[i]);
            if (currentDist < minDistance) {
                minDistance = currentDist;
                closestIndex = i;
            }
        }

        // remove it from the array
        if (closestIndex >= 0) {
            this.levels = this.levels.filter((v, i) => i !== closestIndex);
        }
    };

    @action private handleLevelAdded = (values: string[]) => {
        try {
            for (const valueString of values) {
                const val = parseFloat(valueString);
                if (isFinite(val)) {
                    this.levels.push(val);
                }
            }
        } catch (e) {
            console.log(e);
        }
    };

    @action private handleLevelRemoved = (value: string, index: number) => {
        this.levels = this.levels.filter((v, i) => i !== index);
    };

    @action private handleLevelDragged = (index: number) => (val: number) => {
        if (index >= 0 && index < this.levels.length) {
            this.levels[index] = val;
        }
    };

    @action private handleLevelsGenerated = (levels: number[]) => {
        this.levels = levels.slice();
    };

    public render() {
        const appStore = AppStore.Instance;

        const dialogProps: IDialogProps = {
            icon: <CustomIcon icon="contour" size={CustomIcon.SIZE_LARGE} />,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.contourDialogVisible,
            onClose: appStore.dialogStore.hideContourDialog,
            className: "contour-dialog",
            canEscapeKeyClose: true,
            title: "Contour Configuration"
        };

        if (!appStore || !appStore.contourDataSource) {
            return (
                <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.CONTOUR} defaultWidth={ContourDialogComponent.DefaultWidth} defaultHeight={ContourDialogComponent.DefaultHeight} enableResizing={true}>
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                </DraggableDialogComponent>
            );
        }

        const dataSource = appStore.contourDataSource;

        let unitString = "Value";
        if (dataSource.headerUnit) {
            unitString = `Value (${dataSource.headerUnit})`;
        }

        const linePlotProps: LinePlotComponentProps = {
            xLabel: unitString,
            darkMode: appStore.darkTheme,
            logY: this.widgetStore.logScaleY,
            plotType: this.widgetStore.plotType,
            showYAxisTicks: false,
            showYAxisLabel: false,
            graphClicked: this.handleGraphClicked,
            graphRightClicked: this.handleGraphRightClicked,
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
            let primaryLineColor = getColorForTheme(this.widgetStore.primaryLineColor);
            linePlotProps.lineColor = primaryLineColor;

            // Determine scale in X and Y directions. If auto-scaling, use the bounds of the current data
            if (this.widgetStore.isAutoScaledX) {
                const minVal = Math.min(currentPlotData.xMin, ...this.levels);
                const maxVal = Math.max(currentPlotData.xMax, ...this.levels);
                const xRange = maxVal - minVal;
                linePlotProps.xMin = minVal - 0.01 * xRange;
                linePlotProps.xMax = maxVal + 0.01 * xRange;
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

        const hasLevels = this.levels && this.levels.filter(level => isFinite(level)).length;

        if (hasLevels) {
            linePlotProps.markers = this.levels.map((level, index) => ({
                value: level,
                id: `marker-${index}`,
                draggable: true,
                dragMove: this.handleLevelDragged(index),
                horizontal: false
            }));
        } else {
            linePlotProps.markers = [];
        }

        if (this.widgetStore.meanRmsVisible && dataSource.renderConfig.contourHistogram && dataSource.renderConfig.contourHistogram.stdDev > 0) {
            linePlotProps.markers.push({
                value: dataSource.renderConfig.contourHistogram.mean,
                id: "marker-mean",
                draggable: false,
                horizontal: false,
                color: appStore.darkTheme ? Colors.GREEN4 : Colors.GREEN2,
                dash: [5]
            });

            linePlotProps.markers.push({
                value: dataSource.renderConfig.contourHistogram.mean,
                id: "marker-rms",
                draggable: false,
                horizontal: false,
                width: dataSource.renderConfig.contourHistogram.stdDev,
                opacity: 0.2,
                color: appStore.darkTheme ? Colors.GREEN4 : Colors.GREEN2
            });
        }

        let sortedLevels = this.levels
            .slice()
            .sort((a, b) => a - b)
            .map(level => (Math.abs(level) < 0.1 ? toExponential(level, 2) : toFixed(level, 2)));

        const levelPanel = (
            <div className="contour-level-panel">
                {dataSource.frameInfo.fileInfoExtended.depth > 1 && (
                    <FormGroup label={"Histogram"} inline={true}>
                        <HistogramSelect
                            activeItem={dataSource.renderConfig.useCubeHistogramContours}
                            popoverProps={SCALING_POPOVER_PROPS}
                            filterable={false}
                            items={[true, false]}
                            onItemSelect={this.handleHistogramChange}
                            itemRenderer={this.renderHistogramSelectItem}
                        >
                            <Button text={dataSource.renderConfig.useCubeHistogramContours ? "Per-Cube" : "Per-Channel"} rightIcon="double-caret-vertical" alignText={"right"} />
                        </HistogramSelect>
                    </FormGroup>
                )}
                <div className="histogram-plot">
                    <LinePlotComponent {...linePlotProps} />
                </div>
                <ContourGeneratorPanelComponent frame={dataSource} generatorType={appStore.preferenceStore.contourGeneratorType} onLevelsGenerated={this.handleLevelsGenerated} />
                <div className="contour-level-panel-levels">
                    <FormGroup label={"Levels"} inline={true}>
                        <TagInput
                            addOnBlur={true}
                            fill={true}
                            tagProps={{
                                minimal: true
                            }}
                            onAdd={this.handleLevelAdded}
                            onRemove={this.handleLevelRemoved}
                            values={sortedLevels}
                        />
                    </FormGroup>
                </div>
            </div>
        );

        const configPanel = (
            <div className="contour-config-panel">
                <FormGroup inline={true} label="Smoothing Mode">
                    <HTMLSelect value={this.smoothingMode} onChange={ev => (this.smoothingMode = Number(ev.currentTarget.value))}>
                        <option key={CARTA.SmoothingMode.NoSmoothing} value={CARTA.SmoothingMode.NoSmoothing}>
                            No Smoothing
                        </option>
                        <option key={CARTA.SmoothingMode.BlockAverage} value={CARTA.SmoothingMode.BlockAverage}>
                            Block
                        </option>
                        <option key={CARTA.SmoothingMode.GaussianBlur} value={CARTA.SmoothingMode.GaussianBlur}>
                            Gaussian
                        </option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Smoothing Factor">
                    <SafeNumericInput
                        placeholder="Smoothing Factor"
                        min={1}
                        max={33}
                        value={this.smoothingFactor}
                        majorStepSize={1}
                        stepSize={1}
                        onValueChange={val =>
                            runInAction(() => {
                                this.smoothingFactor = val;
                            })
                        }
                    />
                </FormGroup>
            </div>
        );

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.CONTOUR} defaultWidth={ContourDialogComponent.DefaultWidth} defaultHeight={ContourDialogComponent.DefaultHeight} enableResizing={true}>
                <div className={Classes.DIALOG_BODY}>
                    <FormGroup inline={true} label="Data Source">
                        <DataSourceSelect
                            activeItem={dataSource}
                            onItemSelect={appStore.setContourDataSource}
                            popoverProps={{minimal: true, position: "bottom"}}
                            filterable={false}
                            items={appStore.frames}
                            itemRenderer={this.renderDataSourceSelectItem}
                            disabled={appStore.animatorStore.animationActive}
                        >
                            <Button text={dataSource.filename} rightIcon="double-caret-vertical" alignText={"right"} disabled={appStore.animatorStore.animationActive} />
                        </DataSourceSelect>
                        <Tooltip2 content={appStore.frameLockedToContour ? "Data source is locked to active image" : "Data source is independent of active image"}>
                            <AnchorButton className="lock-button" icon={appStore.frameLockedToContour ? "lock" : "unlock"} minimal={true} onClick={appStore.toggleFrameContourLock} />
                        </Tooltip2>
                    </FormGroup>
                    <Tabs defaultSelectedTabId={ContourDialogTabs.Levels} renderActiveTabPanelOnly={false}>
                        <Tab id={ContourDialogTabs.Levels} title="Levels" panel={levelPanel} panelClassName="contour-level-panel" />
                        <Tab id={ContourDialogTabs.Configuration} title="Configuration" panel={configPanel} panelClassName="contour-config-panel" />
                        <Tab id={ContourDialogTabs.Styling} title="Styling" panel={<ContourStylePanelComponent frame={dataSource} darkTheme={appStore.darkTheme} />} />
                    </Tabs>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.WARNING} onClick={this.handleClearContours} disabled={!dataSource.contourConfig.enabled} text="Clear" />
                        <AnchorButton intent={Intent.SUCCESS} onClick={this.handleApplyContours} disabled={!hasLevels || (!this.contourConfigChanged && dataSource.contourConfig.enabled)} text="Apply" />
                        <AnchorButton intent={Intent.NONE} onClick={appStore.dialogStore.hideContourDialog} text="Close" />
                    </div>
                </div>
                <Alert className={appStore.darkTheme ? "bp3-dark" : ""} icon={"time"} isOpen={this.showCubeHistogramAlert} onCancel={this.handleAlertCancel} onConfirm={this.handleAlertConfirm} cancelButtonText={"Cancel"}>
                    <p>Calculating a cube histogram may take a long time, depending on the size of the file. Are you sure you want to continue?</p>
                </Alert>
                <TaskProgressDialogComponent
                    isOpen={dataSource.renderConfig.useCubeHistogramContours && dataSource.renderConfig.cubeHistogramProgress < 1.0}
                    progress={dataSource.renderConfig.cubeHistogramProgress}
                    timeRemaining={appStore.estimatedTaskRemainingTime}
                    cancellable={true}
                    onCancel={this.handleCubeHistogramCancelled}
                    text={"Calculating cube histogram"}
                />
            </DraggableDialogComponent>
        );
    }
}
