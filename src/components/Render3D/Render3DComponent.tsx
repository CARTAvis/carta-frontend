import * as React from "react";
import {Alert, AnchorButton, Classes, Colors, Divider, FormGroup,  NonIdealState, Position, Tab, Tabs, TagInput, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import * as _ from "lodash";
import {action, autorun, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react"; 

import {TaskProgressDialogComponent} from "components/Dialogs";
import {LinePlotComponent, LinePlotComponentProps, RegionSelectorComponent, SafeNumericInput} from "components/Shared";
import {Point2D} from "models";
import {AppStore, DefaultWidgetConfig, HelpType, WidgetProps, WidgetsStore} from "stores";
// import {FrameStore} from "stores/Frame";
import {Render3DWidgetStore} from "stores/Widgets";
import {clamp, getColorForTheme, toExponential, toFixed} from "utilities";

import {IsoSurfaceGeneratorPanelComponent} from "./IsoSurfaceComponent/IsoSurfaceGeneratorPanelComponent";

// import {MultiPlotProps, TickType} from "../Shared/LinePlot/PlotContainer/PlotContainerComponent";
import "./Render3DComponent.scss";

enum Render3DTabs {
    IsoSurfaces,
    Volume
}

enum IsoSurfaceTabs {
    Levels = "levels",
    Configuration = "configuration",
    Styling = "styling"
}

@observer
export class Render3DComponent extends React.Component<WidgetProps> {

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "render-3d",
            type: "render-3d",
            minWidth: 550,
            minHeight: 450,
            defaultWidth: 550,
            defaultHeight: 700,
            title: "3D Rendering",
            isCloseable: true,
            helpType: HelpType.RENDER_3D
        };
    }

    private cachedHistogram: CARTA.IHistogram;

    @observable width: number;
    @observable height: number;
    @observable isValidSpectralRange: boolean = true;
    @observable showCubeHistogramAlert: boolean;

    // Generate levels
    @observable levels: number[];

    // find widgetStore for render 3d
    @computed get widgetStore(): Render3DWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.render3DWidgets) {
            const widgetStore = widgetsStore.render3DWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new Render3DWidgetStore();
    }
    
    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);
        this.showCubeHistogramAlert = true;

        autorun(() => {
            const appStore = AppStore.Instance;
            // // check if histogram is cached
            // const dataSource = appStore.render3DDataSource;
            // if (dataSource) {
            //     const newHist = dataSource.renderConfig.isoSurfaceHistogram;
            //     if (newHist !== this.cachedHistogram) {
            //         this.cachedHistogram = newHist;
            //         this.widgetStore.clearXYBounds();
            //     }
            // }
            // Check if this widget hasn't been assigned an ID yet
            if (!props.docked && props.id === Render3DComponent.WIDGET_CONFIG.type) {
                // Assign the next unique ID
                const id = appStore.widgetsStore.addRender3DWidget();
                appStore.widgetsStore.changeWidgetId(props.id, id);
            } else {
                if (!appStore.widgetsStore.render3DWidgets.has(this.props.id)) {
                    console.log(`can't find store for widget with id=${this.props.id}`);
                    appStore.widgetsStore.render3DWidgets.set(this.props.id, new Render3DWidgetStore());
                }
            }

            // Generate levels
            this.setDefaultContourParameters();
        });
    }

    @computed get plotData(): {values: Array<Point2D>; xMin: number; xMax: number; yMin: number; yMax: number} {
        const widgetStore = this.widgetStore;
        const dataSource = AppStore.Instance.render3DDataSource;
        if (dataSource && dataSource.renderConfig.isoSurfaceHistogram && dataSource.renderConfig.isoSurfaceHistogram.bins && dataSource.renderConfig.isoSurfaceHistogram.bins.length) {
            
            const histogram = dataSource.renderConfig.isoSurfaceHistogram;
            let minIndex = 0;
            let maxIndex = histogram.bins.length - 1;

            // Truncate array if zoomed in (sidestepping ChartJS bug with off-canvas rendering and speeding up layout)
            if (!widgetStore.isAutoScaledX) {
                minIndex = Math.floor((widgetStore.minX - histogram.firstBinCenter) / histogram.binWidth);
                minIndex = clamp(minIndex, 0, histogram.bins.length - 1);
                maxIndex = Math.ceil((widgetStore.maxX - histogram.firstBinCenter) / histogram.binWidth);
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

    @action onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    onGraphCursorMoved = _.throttle(x => {
        this.widgetStore.setCursor(x);
    }, 100);

    // Generate levels
    @action setDefaultContourParameters() {
        const appStore = AppStore.Instance;
        const dataSource = appStore.render3DDataSource;
        if (dataSource) {
            this.levels = dataSource.contourConfig.levels.slice();
            // this.smoothingMode = dataSource.contourConfig.smoothingMode;
            // this.smoothingFactor = dataSource.contourConfig.smoothingFactor;
        } else {
            this.levels = [];
            // this.smoothingMode = appStore.preferenceStore.contourSmoothingMode;
            // this.smoothingFactor = appStore.preferenceStore.contourSmoothingFactor;
        }
    }

    private handleAlertConfirm = () => {
        const appStore = AppStore.Instance;
        const dataSource = appStore.render3DDataSource;
        if (dataSource && dataSource.renderConfig) {
            dataSource.renderConfig.setUseCubeHistogramRender3D(true);
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
        const dataSource = appStore.render3DDataSource;
        // remove content of this IF
        if (dataSource && dataSource.renderConfig) {
            dataSource.renderConfig.setUseCubeHistogramRender3D(false);
        }
        appStore.cancelCubeHistogramRequest(dataSource.frameInfo.fileId);
    };

    @action private handleLevelAdded = (values: string[]) => {
        try {
            for (const valueString of values) {
                const val = parseFloat(valueString);
                if (isFinite(val)) {
                    this.levels.push(val);
                    this.levels.sort((a, b) => a - b);
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

    private onVisualizeIsoSurfaceButtonClicked = () => {
        this.widgetStore.requestRender3D(this.props.id);
    };
    private onVisualizeVolumeButtonClicked = () => {
        this.widgetStore.requestRender3D(this.props.id);
    };

    @action setisValidSpectralRange = (bool: boolean) => {
        this.isValidSpectralRange = bool;
    };

    private handleSpectralRangeChanged = (value: number, max: boolean) => {
        if (max) {
            this.widgetStore.setSpectralRange({min: this.widgetStore.range?.min, max: value ?? null});
        } else {
            this.widgetStore.setSpectralRange({min: value ?? null, max: this.widgetStore.range?.max});
        }

        const frame = this.widgetStore.effectiveFrame;
        let channelIndexMin = frame.findChannelIndexByValue(this.widgetStore.range?.min);
        let channelIndexMax = frame.findChannelIndexByValue(this.widgetStore.range?.max);

        if (channelIndexMin > channelIndexMax) {
            const holder = channelIndexMax;
            channelIndexMax = channelIndexMin;
            channelIndexMin = holder;
        }

        if (isFinite(this.widgetStore.range?.min) && isFinite(this.widgetStore.range?.max) && channelIndexMin < channelIndexMax && channelIndexMax < frame.numChannels) {
            this.setisValidSpectralRange(true);
        } else {
            this.setisValidSpectralRange(false);
        }
    };

    render() {
        const appStore = AppStore.Instance;
        const dataSource = appStore.render3DDataSource;
        // const fileInfo = frame ? `${appStore.getFrameIndex(frame.frameInfo.fileId)}: ${frame.filename}` : undefined;
        // const regionInfo = this.widgetStore.effectiveRegionInfo;

        // let selectedValue = RegionId.ACTIVE;
        // if (this.widgetStore.effectiveFrame?.regionSet) {
        //     selectedValue = this.widgetStore.regionIdMap.get(this.widgetStore.effectiveFrame.frameInfo.fileId);
        // }

        if (!dataSource || !this.widgetStore) {
            return (
                <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
            );
        }

        let unit = "";
        if (dataSource && dataSource.headerUnit) {
            unit = dataSource.headerUnit;
        }

        let linePlotProps: LinePlotComponentProps = {
            width: 200,
            height:100,
            xLabel: unit ? `Value (${unit})` : "Value",
            darkMode: appStore.darkTheme,
            logY: this.widgetStore.logScaleY,
            plotType: this.widgetStore.plotType,
            showYAxisTicks: false,
            showYAxisLabel: false,
            // graphClicked: this.handleGraphClicked,
            // graphRightClicked: this.handleGraphRightClicked,
            graphZoomedX: this.widgetStore.setXBounds,
            graphZoomedY: this.widgetStore.setYBounds,
            graphZoomedXY: this.widgetStore.setXYBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true,
            borderWidth: this.widgetStore.lineWidth,
            pointRadius: this.widgetStore.linePlotPointSize,
            zeroLineWidth: 2
        }

        const currentPlotData = this.plotData;
        if (currentPlotData) {
            linePlotProps.data = currentPlotData.values;

            // set line color
            linePlotProps.lineColor = getColorForTheme(this.widgetStore.primaryLineColor);

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

        // Generate Levels
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

        if (this.widgetStore.meanRmsVisible && dataSource.renderConfig.isoSurfaceHistogram && dataSource.renderConfig.isoSurfaceHistogram.stdDev > 0) {
            linePlotProps.markers.push({
                value: dataSource.renderConfig.isoSurfaceHistogram.mean,
                id: "marker-mean",
                draggable: false,
                horizontal: false,
                color: appStore.darkTheme ? Colors.GREEN4 : Colors.GREEN2,
                dash: [5]
            });

            linePlotProps.markers.push({
                value: dataSource.renderConfig.isoSurfaceHistogram.mean,
                id: "marker-rms",
                draggable: false,
                horizontal: false,
                width: dataSource.renderConfig.isoSurfaceHistogram.stdDev,
                opacity: 0.2,
                color: appStore.darkTheme ? Colors.GREEN4 : Colors.GREEN2
            });
        }

        let sortedLevels = this.levels
            .slice()
            .sort((a, b) => a - b)
            .map(level => (Math.abs(level) < 0.1 ? toExponential(level, 2) : toFixed(level, 2)));

            const hint = (
                <span>
                    <i>
                        <small>
                            Please ensure:
                            <br />
                            1. Image/Region is not too large.
                            <br />
                            2. Region is not in one pixel.
                            <br />
                            3. Levels have been set.
                        </small>
                    </i>
                </span>
            );

            const isAbleToVisualizeIsoSurface = this.levels.length > 0;
            // const isAbleToVisualize = this.levels.length > 0 && this.isRegionIntersectedWithImage && !this.isRegionInOnePixel && isValidSpectralRange && this.isCubeBelowLimit;
            const isAbleToVisualizeVolume = true;
            // make it so there is a limit on the size of the cube to be visualized. Around 500 000 000 voxels should be fine.
            // const isCubeBelowLimit = dataSource ? (dataSource.frameInfo.fileInfoExtended.width / this.widgetStore.xyRebin) * (dataSource.frameInfo.fileInfoExtended.height / this.widgetStore.xyRebin) * (dataSource.frameInfo.fileInfoExtended.depth / this.widgetStore.zRebin) < 500000000 : false;


        // RENDERING PANELS

        const isoSurfaceLevelsPanel = (
            <div className="isosurface-level-panel">
                <div className="histogram-plot">
                    <LinePlotComponent {...linePlotProps} />
                </div>
                <IsoSurfaceGeneratorPanelComponent frame={dataSource} generatorType={appStore.preferenceStore.contourGeneratorType} onLevelsGenerated={this.handleLevelsGenerated} />
                <div className="contour-level-panel-levels" data-testid="contour-config-level-input-form">
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
                <Alert className={classNames({[Classes.DARK]: appStore.darkTheme})} icon={"time"} isOpen={this.showCubeHistogramAlert} onCancel={this.handleAlertCancel} onConfirm={this.handleAlertConfirm} cancelButtonText={"Cancel"}>
                    <p>Calculating a cube histogram may take a long time, depending on the size of the file. Are you sure you want to continue?</p>
                </Alert>
                <TaskProgressDialogComponent
                    isOpen={dataSource.renderConfig.useCubeHistogramRender3D && dataSource.renderConfig.cubeHistogramProgress < 1.0}
                    progress={dataSource.renderConfig.cubeHistogramProgress}
                    timeRemaining={appStore.estimatedTaskRemainingTime}
                    cancellable={true}
                    onCancel={this.handleCubeHistogramCancelled}
                    text={"Calculating cube histogram"}
                />
            </div>
        );

        const isoSurfaceConfigurationPanel = (
            <div>configuration</div>
        );

        const isoSurfaceStylingPanel = (
            <div>styling</div>
        );

        const isoSurfacesPanel = (
            <div>
                <Tabs defaultSelectedTabId={IsoSurfaceTabs.Levels} renderActiveTabPanelOnly={false}>
                    <Tab id={IsoSurfaceTabs.Levels} title="Levels" panel={isoSurfaceLevelsPanel} panelClassName="isosurface-level-panel" data-testid="isosurface-level-tab-title" />
                    <Tab id={IsoSurfaceTabs.Configuration} title="Configuration" panel={isoSurfaceConfigurationPanel} panelClassName="isosurfaces-configuration-panel" data-testid="isosurfaces-configuration-tab-title" />
                    <Tab id={IsoSurfaceTabs.Styling} title="Styling" panel={isoSurfaceStylingPanel} panelClassName="isosurfaces-styling-panel" data-testid="isosurfaces-styling-tab-title" />
                </Tabs>
                <div className="generate-button">
                    <Tooltip disabled={isAbleToVisualizeIsoSurface} content={hint} position={Position.BOTTOM}>
                        <AnchorButton intent="success" disabled={!isAbleToVisualizeIsoSurface} text="Visualize" onClick={this.onVisualizeIsoSurfaceButtonClicked} />
                    </Tooltip>
                </div>
            </div>
        );

        const volumePanel = (
            <div>volume
                <div className="generate-button">
                    <Tooltip disabled={isAbleToVisualizeVolume} content={hint} position={Position.BOTTOM}>
                        <AnchorButton intent="success" disabled={!isAbleToVisualizeVolume} text="Visualize" onClick={this.onVisualizeVolumeButtonClicked} />
                    </Tooltip>
                </div>
            </div>
        );

        return (
            <div className="render-3d-widget">
                <div className="render-3d-panel">
                    <div className="spectral-profiler-toolbar">
                        <RegionSelectorComponent widgetStore={this.widgetStore} />
                    </div>
                    {dataSource && dataSource.numChannels > 1 && (
                        <FormGroup label="Range" inline={true} labelInfo={`(${dataSource.spectralUnit})`}>
                            <div className="range-select">
                                <FormGroup label="From" inline={true}>
                                    <SafeNumericInput value={this.widgetStore.range?.min} buttonPosition="none" onValueChange={value => this.handleSpectralRangeChanged(value, false)} data-testid="render-3d-spectral-range-from-input" />
                                </FormGroup>
                                <FormGroup label="To" inline={true}>
                                    <SafeNumericInput value={this.widgetStore.range?.max} buttonPosition="none" onValueChange={value => this.handleSpectralRangeChanged(value, true)} data-testid="render-3d-spectral-range-to-input" />
                                </FormGroup>
                            </div>
                        </FormGroup>
                    )}
                    <FormGroup className="label-info-group" inline={true} label="Rebin" labelInfo={`(px)`}>
                        <div className="rebin-select">
                            <FormGroup inline={true} label={"XY"}>
                                <SafeNumericInput
                                    min={1}
                                    max={Math.ceil(Math.max(this.widgetStore.effectiveFrame?.frameInfo.fileInfoExtended.height, this.widgetStore.effectiveFrame?.frameInfo.fileInfoExtended.width) / 2) || 1}
                                    stepSize={1}
                                    value={this.widgetStore.xyRebin}
                                    onValueChange={value => this.widgetStore.setXYRebin(value)}
                                    data-testid="render-3d-rebin-xy-input"
                                />
                            </FormGroup>
                            <FormGroup inline={true} label={"Z"}>
                                <SafeNumericInput
                                    min={1}
                                    max={Math.ceil(this.widgetStore.effectiveFrame?.frameInfo.fileInfoExtended.depth / 2) || 1}
                                    stepSize={1}
                                    value={this.widgetStore.zRebin}
                                    onValueChange={value => this.widgetStore.setZRebin(value)}
                                    data-testid="render-3d-rebin-z-input"
                                />
                            </FormGroup>
                        </div>
                    </FormGroup>
                <Divider />
                <Tabs defaultSelectedTabId={Render3DTabs.Volume} renderActiveTabPanelOnly={false}>
                        <Tab id={Render3DTabs.Volume} title="Volume rendering" panel={volumePanel} panelClassName="render-3d-volume-panel" data-testid="render-3d-volume-tab-title" />
                        <Tab id={Render3DTabs.IsoSurfaces} title="Iso-surfaces" panel={isoSurfacesPanel} panelClassName="render-3d-isosurfaces-panel" data-testid="render-3d-isosurfaces-tab-title" />
                    </Tabs>
                </div>
            </div>
        );
    }

} // end class Render3DComponent
