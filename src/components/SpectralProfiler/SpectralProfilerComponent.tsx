import * as React from "react";
import * as _ from "lodash";
import {action, autorun, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {Colors, NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {LineMarker, LinePlotComponent, LinePlotComponentProps, LinePlotSelectingMode, ProfilerInfoComponent, VERTICAL_RANGE_PADDING, SmoothingType, PlotType} from "components/Shared";
import {TickType, MultiPlotProps} from "../Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {SpectralProfilerToolbarComponent} from "./SpectralProfilerToolbarComponent/SpectralProfilerToolbarComponent";
import {SpectralProfileStore, WidgetProps, HelpType, AnimatorStore, WidgetsStore, AppStore, DefaultWidgetConfig, RegionStore} from "stores";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {Point2D, ProcessedSpectralProfile} from "models";
import {binarySearchByX, clamp, formattedExponential, formattedNotation, toExponential, toFixed, getColorForTheme} from "utilities";
import "./SpectralProfilerComponent.scss";

type PlotData = { values: Point2D[], smoothingValues: Point2D[], fittingValues: Point2D[], xMin: number, xMax: number, yMin: number, yMax: number, yMean: number, yRms: number, progress: number };

@observer
export class SpectralProfilerComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "spectral-profiler",
            type: "spectral-profiler",
            minWidth: 250,
            minHeight: 225,
            defaultWidth: 720,
            defaultHeight: 275,
            title: "Z Profile: Cursor",
            isCloseable: true,
            helpType: HelpType.SPECTRAL_PROFILER
        };
    }

    @observable width: number;
    @observable height: number;

    @computed get widgetStore(): SpectralProfileWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.spectralProfileWidgets) {
            const widgetStore = widgetsStore.spectralProfileWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new SpectralProfileWidgetStore();
    }

    @computed get profileStore(): SpectralProfileStore {
        if (this.widgetStore.effectiveFrame) {
            let fileId = this.widgetStore.effectiveFrame.frameInfo.fileId;
            const regionId = this.widgetStore.effectiveRegionId;
            const frameMap = AppStore.Instance.spectralProfiles.get(fileId);
            if (frameMap) {
                return frameMap.get(regionId);
            }
        }
        return null;
    }

    @computed get plotData(): PlotData {
        const frame = this.widgetStore.effectiveFrame;
        if (!frame) {
            return null;
        }

        let coordinateData: ProcessedSpectralProfile;
        let regionId = this.widgetStore.effectiveRegionId;
        if (frame.regionSet) {
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);
            if (region && this.profileStore) {
                coordinateData = this.profileStore.getProfile(this.widgetStore.coordinate, region.isClosedRegion ? this.widgetStore.statsType : CARTA.StatsType.Sum);
            }
        }

        if (coordinateData && coordinateData.values && coordinateData.values.length &&
            frame.channelValues && frame.channelValues.length &&
            coordinateData.values.length === frame.channelValues.length) {
            const channelValues = frame.channelValues;
            let xMin = Math.min(channelValues[0], channelValues[channelValues.length - 1]);
            let xMax = Math.max(channelValues[0], channelValues[channelValues.length - 1]);

            if (!this.widgetStore.isAutoScaledX) {
                const localXMin = clamp(this.widgetStore.minX, xMin, xMax);
                const localXMax = clamp(this.widgetStore.maxX, xMin, xMax);
                xMin = localXMin;
                xMax = localXMax;
            }

            let yMin = Number.MAX_VALUE;
            let yMax = -Number.MAX_VALUE;
            let yMean;
            let yRms;
            // Variables for mean and RMS calculations
            let ySum = 0;
            let ySum2 = 0;
            let yCount = 0;

            let values: Array<{ x: number, y: number }> = [];
            for (let i = 0; i < channelValues.length; i++) {
                const x = channelValues[i];
                const y = coordinateData.values[i];

                // Skip values outside of range. If array already contains elements, we've reached the end of the range, and can break
                if (x < xMin || x > xMax) {
                    if (values.length) {
                        break;
                    } else {
                        continue;
                    }
                }
                values.push({x, y});
                // Mean/RMS calculations
                if (!isNaN(y)) {
                    yMin = Math.min(yMin, y);
                    yMax = Math.max(yMax, y);
                    yCount++;
                    ySum += y;
                    ySum2 += y * y;
                }
            }

            let smoothingValues: Point2D[] = this.widgetStore.smoothingStore.getSmoothingPoint2DArray(channelValues, coordinateData.values);
            let fittingValues: Point2D[] = this.widgetStore.fittingStore.getFittingPoint2DArray(channelValues);

            if (yCount > 0) {
                yMean = ySum / yCount;
                yRms = Math.sqrt((ySum2 / yCount) - yMean * yMean);
            }

            if (yMin === Number.MAX_VALUE) {
                yMin = undefined;
                yMax = undefined;
            } else {
                // extend y range a bit
                const range = yMax - yMin;
                yMin -= range * VERTICAL_RANGE_PADDING;
                yMax += range * VERTICAL_RANGE_PADDING;
            }
            return {values, smoothingValues, fittingValues, xMin, xMax, yMin, yMax, yMean, yRms, progress: coordinateData.progress};
        }
        return null;
    }

    @computed get exportHeaders(): string[] {
        let headerString = [];
        const frame = this.widgetStore.effectiveFrame;
        if (frame && frame.frameInfo && frame.regionSet) {
            const regionId = this.widgetStore.effectiveRegionId;
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);

            // statistic type, ignore when region == cursor
            if (regionId !== 0) {
                headerString.push(`statistic: ${SpectralProfileWidgetStore.StatsTypeString(this.widgetStore.statsType)}`);
            }
            // region info
            if (region) {
                headerString.push(region.regionProperties);
                if (frame.validWcs) {
                    headerString.push(frame.getRegionWcsProperties(region));
                }
            }
        }
        return headerString;
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        const appStore = AppStore.Instance;
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === SpectralProfilerComponent.WIDGET_CONFIG.type) {
            // Assign the next unique ID
            const id = appStore.widgetsStore.addSpectralProfileWidget();
            appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!appStore.widgetsStore.spectralProfileWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                appStore.widgetsStore.addSpectralProfileWidget(this.props.id);
            }
        }
        // Update widget title when region or coordinate changes
        autorun(() => {
            if (this.widgetStore && this.widgetStore.effectiveFrame) {
                const coordinate = this.widgetStore.coordinate;
                const frame = this.widgetStore.effectiveFrame;
                let progressString = "";
                const currentData = this.plotData;
                if (currentData && isFinite(currentData.progress)) {
                    if (currentData.progress < 1.0) {
                        progressString = `[${toFixed(currentData.progress * 100)}% complete]`;
                        this.widgetStore.updateStreamingDataStatus(true);
                    } else {
                        this.widgetStore.updateStreamingDataStatus(false);
                    }
                }
                if (frame && coordinate) {
                    let coordinateString: string;
                    if (coordinate.length === 2) {
                        coordinateString = `Z Profile (Stokes ${coordinate[0]})`;
                    } else {
                        coordinateString = `Z Profile`;
                    }
                    const regionId = this.widgetStore.effectiveRegionId;
                    const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
                    const selectedString = this.widgetStore.matchesSelectedRegion ? "(Active)" : "";
                    appStore.widgetsStore.setWidgetTitle(this.props.id, `${coordinateString}: ${regionString} ${selectedString} ${progressString}`);
                }
                if (currentData) {
                    this.widgetStore.initXYBoundaries(currentData.xMin, currentData.xMax, currentData.yMin, currentData.yMax);
                }
            } else {
                appStore.widgetsStore.setWidgetTitle(this.props.id, `Z Profile: Cursor`);
            }
        });
    }

    @action private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    onChannelChanged = (x: number) => {
        const frame = this.widgetStore.effectiveFrame;
        if (x === null || x === undefined || !isFinite(x) || AnimatorStore.Instance.animationActive) {
            return;
        }
        const nearestIndex = frame.findChannelIndexByValue(x);
        if (frame && isFinite(nearestIndex) && nearestIndex >= 0 && nearestIndex < frame.numChannels) {
            frame.setChannels(nearestIndex, frame.requiredStokes, true);
        }
    };

    @computed get currentChannelValue(): number {
        const frame = this.widgetStore.effectiveFrame;
        if (!frame || !frame.channelValues) {
            return null;
        }
        const channel = frame.channel;
        if (channel < 0 || channel >= frame.channelValues.length) {
            return null;
        }
        return frame.isCoordChannel ? channel : frame.channelValues[channel];
    }

    @computed get requiredChannelValue(): number {
        const frame = this.widgetStore.effectiveFrame;
        if (!frame || !frame.channelValues) {
            return null;
        }
        const channel = frame.requiredChannel;
        if (channel < 0 || channel >= frame.channelValues.length) {
            return null;
        }
        return frame.isCoordChannel ? channel : frame.channelValues[channel];
    }

    @computed get linePlotSelectingMode(): LinePlotSelectingMode {
        if (this.widgetStore.isSelectingMomentChannelRange) {
            return LinePlotSelectingMode.HORIZONTAL;
        } else if (this.widgetStore.isSelectingMomentMaskRange) {
            return LinePlotSelectingMode.VERTICAL;
        } else if (this.widgetStore.fittingStore.isCursorSelectionOn) {
            return LinePlotSelectingMode.BOX;
        }
        return LinePlotSelectingMode.BOX;
    }

    onGraphCursorMoved = _.throttle((x) => {
        this.widgetStore.setCursor(x);
    }, 33);

    private genProfilerInfo = (): string[] => {
        let profilerInfo: string[] = [];
        const frame = this.widgetStore.effectiveFrame;
        if (frame && this.plotData) {
            const cursorX = {
                profiler: this.widgetStore.cursorX,
                image: this.currentChannelValue,
                unit: frame.spectralUnitStr
            };
            const data = this.plotData.values;
            const nearest = binarySearchByX(data, this.widgetStore.isMouseMoveIntoLinePlots ? cursorX.profiler : cursorX.image);
            let cursorString = "";
            if (nearest && nearest.point && nearest.index >= 0 && nearest.index < data.length) {
                let floatXStr = "";
                const diffLeft = nearest.index - 1 >= 0 ? Math.abs(nearest.point.x - data[nearest.index - 1].x) : 0;
                if (diffLeft > 0 && diffLeft < 1e-6) {
                    floatXStr = formattedNotation(nearest.point.x);
                } else if (diffLeft >= 1e-6  && diffLeft < 1e-3) {
                    floatXStr = toFixed(nearest.point.x, 6);
                } else {
                    floatXStr = toFixed(nearest.point.x, 3);
                }
                const xLabel = cursorX.unit === "Channel" ? "Channel " + toFixed(nearest.point.x) : floatXStr + " " + cursorX.unit;
                cursorString =  "(" + xLabel + ", " + toExponential(nearest.point.y, 2) + ")";
            }

            profilerInfo.push(`${this.widgetStore.isMouseMoveIntoLinePlots ? "Cursor:" : "Data:"} ${cursorString}`);
            if (this.widgetStore.meanRmsVisible) {
                profilerInfo.push(`Mean/RMS: ${formattedExponential(this.plotData.yMean, 2) + " / " + formattedExponential(this.plotData.yRms, 2)}`);
            }
        }
        return profilerInfo;
    };

    private setSelectedRange = (min: number, max: number) => {
        if (isFinite(min) && isFinite(max)) {
            if (this.widgetStore.isSelectingMomentChannelRange) {
                this.widgetStore.setSelectedChannelRange(min, max);
            } else if (this.widgetStore.isSelectingMomentMaskRange) {
                this.widgetStore.setSelectedMaskRange(min, max);
            }
        }
    };

    private setSelectedBox = (xMin: number, xMax: number, yMin: number, yMax: number) => {
        if (isFinite(xMin) && isFinite(xMax) && isFinite(yMin) && isFinite(yMax)) {
            this.widgetStore.fittingStore.setComponentByCursor(xMin, xMax, yMin, yMax);
        }
    }

    private fillVisibleSpectralLines = (): LineMarker[] => {
        let spectralLineMarkers: LineMarker[] = [];
        const spectralLines = this.widgetStore.transformedSpectralLines;
        if (spectralLines?.length > 0) {
            // find x range
            let xMin, xMax;
            if (this.plotData) {
                xMin = this.widgetStore.isAutoScaledX ? this.plotData.xMin : this.widgetStore.minX;
                xMax = this.widgetStore.isAutoScaledX ? this.plotData.xMax : this.widgetStore.maxX;
            }
            // only keep visible lines within x range
            for (let lineIndex = 0; lineIndex < spectralLines.length; lineIndex++) {
                const line = spectralLines[lineIndex];
                if (isFinite(xMin) && isFinite(xMax) && line && isFinite(line.value) && line.value >= xMin && line.value <= xMax) {
                    spectralLineMarkers.push({
                        value: line.value,
                        id: `spectral-line-${lineIndex}`,
                        label: `${line.species} ${line.qn}`,
                        draggable: false,
                        horizontal: false,
                        color: AppStore.Instance.darkTheme ? Colors.GREEN4 : Colors.GREEN2
                    });
                }
            }
        }
        return spectralLineMarkers;
    };

    render() {
        const appStore = AppStore.Instance;
        if (!this.widgetStore) {
            return <NonIdealState icon={"error"} title={"Missing profile"} description={"Profile not found"}/>;
        }

        const frame = this.widgetStore.effectiveFrame;
        const imageName = (frame ? frame.filename : undefined);

        let linePlotProps: LinePlotComponentProps = {
            xLabel: "Channel",
            yLabel: "Value",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: `Z profile`,
            plotType: this.widgetStore.plotType,
            tickTypeY: TickType.Scientific,
            graphClicked: this.onChannelChanged,
            graphZoomedX: this.widgetStore.setXBounds,
            graphZoomedY: this.widgetStore.setYBounds,
            graphZoomedXY: this.widgetStore.setXYBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true,
            markers: this.fillVisibleSpectralLines(),
            mouseEntered: this.widgetStore.setMouseMoveIntoLinePlots,
            borderWidth: this.widgetStore.lineWidth,
            pointRadius: this.widgetStore.linePlotPointSize,
            selectingMode: this.linePlotSelectingMode,
            setSelectedRange: this.setSelectedRange,
            isSelectingInsideBox: this.widgetStore.fittingStore.isCursorSelectionOn,
            setSelectedInsideBox: this.setSelectedBox,
            insideBoxs: this.widgetStore.fittingStore.componentPlottingBoxs,
            zeroLineWidth: 2,
            order: 1,
            multiPlotPropsMap: new Map()
        };

        if (this.profileStore && frame) {
            if (frame.spectralAxis && !frame.isCoordChannel) {
                linePlotProps.xLabel = frame.spectralLabel;
            }
            if (frame.unit) {
                let yLabelName = "Value";
                let yLabelUnit = `(${frame.unit})`;
                let region: RegionStore;
                if (frame.regionSet) {
                    region = frame.regionSet.regions.find(r => r.regionId === this.widgetStore.effectiveRegionId);
                    if (region && region.regionType !== CARTA.RegionType.POINT) {
                        yLabelName = SpectralProfileWidgetStore.StatsTypeString(this.widgetStore.statsType);
                        if (this.widgetStore.statsType === CARTA.StatsType.FluxDensity) {
                            yLabelUnit =  "(Jy)";
                        } else if (this.widgetStore.statsType === CARTA.StatsType.SumSq) {
                            yLabelUnit = `(${frame.unit})^2`;
                        }
                    }
                }
                linePlotProps.yLabel = `${yLabelName} ${yLabelUnit}`;
            }

            const currentPlotData = this.plotData;
            if (currentPlotData) {
                linePlotProps.data = currentPlotData.values;
                // Opacity ranges from 0.15 to 0.40 when data is in progress, and is 1.0 when finished
                linePlotProps.opacity = currentPlotData.progress < 1.0 ? 0.15 + currentPlotData.progress / 4.0 : 1.0;
                
                // set line color
                let primaryLineColor = getColorForTheme(this.widgetStore.primaryLineColor);
                linePlotProps.lineColor = primaryLineColor;
                const smoothingStore = this.widgetStore.smoothingStore;
                if (smoothingStore.type !== SmoothingType.NONE) {
                    if (!smoothingStore.isOverlayOn) {
                        linePlotProps.lineColor = "#00000000";
                    }

                    let smoothingPlotProps: MultiPlotProps = {
                        data: currentPlotData.smoothingValues,
                        type: smoothingStore.lineType,
                        borderColor: getColorForTheme(smoothingStore.lineColor),
                        borderWidth: smoothingStore.lineWidth,
                        pointRadius: smoothingStore.pointRadius,
                        order: 0,
                        exportData: smoothingStore.exportData
                    };
                    linePlotProps.multiPlotPropsMap.set("smoothed", smoothingPlotProps);
                }

                const fittingStore = this.widgetStore.fittingStore;
                if (fittingStore.hasResult) {
                    let fittingPlotProps: MultiPlotProps = {
                        data: currentPlotData.fittingValues,
                        type: PlotType.LINES,
                        borderColor: getColorForTheme("auto-orange"),
                        borderWidth: smoothingStore.lineWidth,
                        pointRadius: smoothingStore.pointRadius,
                        order: 0
                    }
                    linePlotProps.multiPlotPropsMap.set("fitting", fittingPlotProps);
                }

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
            }

            if (!isNaN(this.widgetStore.cursorX)) {
                linePlotProps.markers.push({
                    value: this.widgetStore.cursorX,
                    id: "marker-profiler-cursor",
                    draggable: false,
                    horizontal: false,
                    color: appStore.darkTheme ? Colors.GRAY4 : Colors.GRAY2,
                    opacity: 0.8,
                    isMouseMove: true,
                });
            }
            if (!isNaN(this.currentChannelValue)) {
                linePlotProps.markers.push({
                    value: this.currentChannelValue,
                    id: "marker-channel-current",
                    opacity: 0.4,
                    draggable: false,
                    horizontal: false,
                });
            }
            if (!isNaN(this.requiredChannelValue)) {
                linePlotProps.markers.push({
                    value: this.requiredChannelValue,
                    id: "marker-channel-required",
                    draggable: !AnimatorStore.Instance.animationActive,
                    dragMove: this.onChannelChanged,
                    horizontal: false,
                });
            }

            if (this.widgetStore.meanRmsVisible && currentPlotData && isFinite(currentPlotData.yMean) && isFinite(currentPlotData.yRms)) {
                linePlotProps.markers.push({
                    value: currentPlotData.yMean,
                    id: "marker-mean",
                    draggable: false,
                    horizontal: true,
                    color: appStore.darkTheme ? Colors.GREEN4 : Colors.GREEN2,
                    dash: [5]
                });

                linePlotProps.markers.push({
                    value: currentPlotData.yMean,
                    id: "marker-rms",
                    draggable: false,
                    horizontal: true,
                    width: currentPlotData.yRms,
                    opacity: 0.2,
                    color: appStore.darkTheme ? Colors.GREEN4 : Colors.GREEN2
                });
            }

            const selectedRange = this.widgetStore.selectedRange;
            if (selectedRange && isFinite(selectedRange.center) && isFinite(selectedRange.width)) {
                linePlotProps.markers.push({
                    value: selectedRange.center,
                    id: "marker-range",
                    draggable: false,
                    horizontal: selectedRange.isHorizontal,
                    width: selectedRange.width / 2,
                    opacity: 0.2,
                    color: appStore.darkTheme ? Colors.GRAY4 : Colors.GRAY2
                });
            }

            linePlotProps.comments = this.exportHeaders;
        }

        let className = "spectral-profiler-widget";
        if (this.widgetStore.isHighlighted) {
            className += " linked-to-widget-highlighted";
        }

        if (appStore.darkTheme) {
            className += " dark-theme";
        }

        return (
            <div className={className}>
                <div className="profile-container">
                    <div className="profile-toolbar">
                        <SpectralProfilerToolbarComponent widgetStore={this.widgetStore} id={this.props.id}/>
                    </div>
                    <div className="profile-plot">
                        <LinePlotComponent {...linePlotProps}/>
                    </div>
                    <ProfilerInfoComponent info={this.genProfilerInfo()}/>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}>
                </ReactResizeDetector>
            </div>
        );
    }
}
