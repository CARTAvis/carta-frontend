import * as React from "react";
// import ReactResizeDetector from "react-resize-detector";
import {AnchorButton, Colors, Divider, FormGroup,  NonIdealState, Position, Tab, Tabs, TagInput, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as _ from "lodash";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react"; 

// import {TaskProgressDialogComponent} from "components/Dialogs";
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

        const appStore = AppStore.Instance;
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
    }

    @computed get plotData(): {values: Array<Point2D>; xMin: number; xMax: number; yMin: number; yMax: number} {
        const widgetStore = this.widgetStore;
        const frame = widgetStore.effectiveFrame;
        const appStore = AppStore.Instance;
        // const fileId = this.widgetStore.effectiveFrame.frameInfo.fileId;
        // const regionId = this.widgetStore.effectiveRegionId;
        if (frame && frame.renderConfig) {
            frame.renderConfig.setUseCubeHistogram(true);
            if (frame.renderConfig.cubeHistogramProgress < 1.0) {
                appStore.requestCubeHistogram();
                // if (fileId && regionId) {
                //     appStore.requestCubeHistogram(fileId, regionId);
                // } else {
                //     appStore.requestCubeHistogram();
                // }
                // maybe the else is not necessary, seems to work with regionId=-1
                // Appstore setHistogramRequirements
            }
        }

        if (frame && frame.renderConfig.histogram && frame.renderConfig.histogram.bins && frame.renderConfig.histogram.bins.length) {    
            const histogram = frame.renderConfig.histogram;
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
        const dataSource = appStore.contourDataSource;
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

    private onVisualizeButtonClicked = () => {
        this.widgetStore.requestRender3D(this.props.id);
    }

    private handleSpectralRangeChanged = (value: number, max: boolean) => {
        //TODO
        // if (max) {
        //     this.widgetStore.setSpectralRange({min: this.widgetStore.range?.min, max: value ?? null});
        // } else {
        //     this.widgetStore.setSpectralRange({min: value ?? null, max: this.widgetStore.range?.max});
        // }

        // const frame = this.widgetStore.effectiveFrame;
        // let channelIndexMin = frame.findChannelIndexByValue(this.widgetStore.range?.min);
        // let channelIndexMax = frame.findChannelIndexByValue(this.widgetStore.range?.max);

        // if (channelIndexMin > channelIndexMax) {
        //     const holder = channelIndexMax;
        //     channelIndexMax = channelIndexMin;
        //     channelIndexMin = holder;
        // }

        // if (isFinite(this.widgetStore.range?.min) && isFinite(this.widgetStore.range?.max) && channelIndexMin < channelIndexMax && channelIndexMax < frame.numChannels) {
        //     this.setisValidSpectralRange(true);
        // } else {
        //     this.setisValidSpectralRange(false);
        // }
    };

    render() {
        const appStore = AppStore.Instance;
        const frame = this.widgetStore.effectiveFrame;
        // const fileInfo = frame ? `${appStore.getFrameIndex(frame.frameInfo.fileId)}: ${frame.filename}` : undefined;
        // const regionInfo = this.widgetStore.effectiveRegionInfo;

        // let selectedValue = RegionId.ACTIVE;
        // if (this.widgetStore.effectiveFrame?.regionSet) {
        //     selectedValue = this.widgetStore.regionIdMap.get(this.widgetStore.effectiveFrame.frameInfo.fileId);
        // }

        if (!frame || !this.widgetStore) {
            return (
                <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
            );
        }

        let unit = "";
        if (frame && frame.headerUnit) {
            unit = frame.headerUnit;
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

        if (frame.renderConfig.histogram && frame.renderConfig.histogram.bins && frame.renderConfig.histogram.bins.length) {
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

        if (this.widgetStore.meanRmsVisible && frame.renderConfig.contourHistogram && frame.renderConfig.contourHistogram.stdDev > 0) {
            linePlotProps.markers.push({
                value: frame.renderConfig.contourHistogram.mean,
                id: "marker-mean",
                draggable: false,
                horizontal: false,
                color: appStore.darkTheme ? Colors.GREEN4 : Colors.GREEN2,
                dash: [5]
            });

            linePlotProps.markers.push({
                value: frame.renderConfig.contourHistogram.mean,
                id: "marker-rms",
                draggable: false,
                horizontal: false,
                width: frame.renderConfig.contourHistogram.stdDev,
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

            const isAbleToVisualize = this.levels.length > 0;
            // const isAbleToVisualize = this.levels.length > 0 && this.isRegionIntersectedWithImage && !this.isRegionInOnePixel && isValidSpectralRange && this.isCubeBelowLimit;

        // RENDERING PANELS

        const isoSurfaceLevelsPanel = (
            <div className="isosurface-level-panel">
                <div className="histogram-plot">
                    <LinePlotComponent {...linePlotProps} />
                </div>
                <IsoSurfaceGeneratorPanelComponent frame={frame} generatorType={appStore.preferenceStore.contourGeneratorType} onLevelsGenerated={this.handleLevelsGenerated} />
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
            </div>
        );

        const volumePanel = (
            <div>volume</div>
        );

        return (
            <div className="render-3d-widget">
                <div className="render-3d-panel">
                    <div className="spectral-profiler-toolbar">
                        <RegionSelectorComponent widgetStore={this.widgetStore} />
                    </div>
                    {frame && frame.numChannels > 1 && (
                        <FormGroup label="Range" inline={true} labelInfo={`(${frame.spectralUnit})`}>
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
                <Divider />
                <Tabs defaultSelectedTabId={Render3DTabs.IsoSurfaces} renderActiveTabPanelOnly={false}>
                        <Tab id={Render3DTabs.IsoSurfaces} title="Iso-surfaces" panel={isoSurfacesPanel} panelClassName="render-3d-isosurfaces-panel" data-testid="render-3d-isosurfaces-tab-title" />
                        <Tab id={Render3DTabs.Volume} title="Volume rendering" panel={volumePanel} panelClassName="render-3d-volume-panel" data-testid="render-3d-volume-tab-title" />
                    </Tabs>
                </div>
                <div className="generate-button">
                    <Tooltip disabled={isAbleToVisualize} content={hint} position={Position.BOTTOM}>
                        <AnchorButton intent="success" disabled={!isAbleToVisualize} text="Visualize" onClick={this.onVisualizeButtonClicked} />
                    </Tooltip>
                </div>
            </div>
        );
    }

} // end class Render3DComponent
