import * as React from "react";
import * as _ from "lodash";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {action, autorun, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {Colors, FormGroup, HTMLSelect, NonIdealState} from "@blueprintjs/core";
import {Tick} from "chart.js";
import ReactResizeDetector from "react-resize-detector";
import {LinePlotComponent, LinePlotComponentProps, PlotType, ProfilerInfoComponent, RegionSelectorComponent, VERTICAL_RANGE_PADDING, SmoothingType} from "components/Shared";
import {TickType, MultiPlotProps} from "../Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {AppStore, ASTSettingsString, DefaultWidgetConfig, HelpType, OverlayStore, SpatialProfileStore, WidgetProps, WidgetsStore} from "stores";
import {FrameStore} from "stores/Frame";
import {RegionId, SpatialProfileWidgetStore} from "stores/widgets";
import {Point2D} from "models";
import {binarySearchByX, clamp, formattedExponential, transformPoint, toFixed, getColorForTheme} from "utilities";
import "./SpatialProfilerComponent.scss";

// The fixed size of the settings panel popover (excluding the show/hide button)
const AUTOSCALE_THROTTLE_TIME = 100;

@observer
export class SpatialProfilerComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "spatial-profiler",
            type: "spatial-profiler",
            minWidth: 250,
            minHeight: 250,
            defaultWidth: 650,
            defaultHeight: 250,
            title: "X Profile: Cursor",
            isCloseable: true,
            helpType: HelpType.SPATIAL_PROFILER
        };
    }

    private cachedFormattedCoordinates: string[];

    @observable width: number;
    @observable height: number;

    // auto-scaling range
    @observable autoScaleHorizontalMin: number;
    @observable autoScaleHorizontalMax: number;

    @computed get widgetStore(): SpatialProfileWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.spatialProfileWidgets) {
            const widgetStore = widgetsStore.spatialProfileWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new SpatialProfileWidgetStore();
    }

    @computed get profileStore(): SpatialProfileStore {
        const widgetStore = this.widgetStore;
        if (widgetStore.effectiveFrame) {
            const profileKey = `${widgetStore.effectiveFrame.frameInfo.fileId}-${widgetStore.effectiveRegionId}`;
            return AppStore.Instance.spatialProfiles.get(profileKey);
        }
        return undefined;
    }

    @computed get frame(): FrameStore {
        if (this.widgetStore) {
            return AppStore.Instance.getFrame(this.widgetStore.fileId);
        } else {
            return undefined;
        }
    }

    @computed get plotData(): {values: Array<Point2D>; smoothingValues: Array<Point2D>; xMin: number; xMax: number; yMin: number; yMax: number; yMean: number; yRms: number} {
        if (!this.frame || !this.width || !this.profileStore) {
            return null;
        }

        // Use accurate profiles from server-sent data
        const coordinateData = this.profileStore.getProfile(this.widgetStore.fullCoordinate);
        if (!(coordinateData && coordinateData.values && coordinateData.values.length)) {
            return null;
        } else {
            let xMin: number;
            let xMax: number;

            if (this.widgetStore.effectiveRegion?.regionType === CARTA.RegionType.LINE || this.widgetStore.effectiveRegion?.regionType === CARTA.RegionType.POLYLINE) {
                xMin = 0;
                xMax = coordinateData.values.length;
            } else {
                if (this.widgetStore.isAutoScaledX) {
                    xMin = this.autoScaleHorizontalMin;
                    xMax = this.autoScaleHorizontalMax;
                } else {
                    xMin = clamp(this.widgetStore.minX, 0, this.frame.frameInfo.fileInfoExtended.width);
                    xMax = clamp(this.widgetStore.maxX, 0, this.widgetStore.isXProfile ? this.frame.frameInfo.fileInfoExtended.width : this.frame.frameInfo.fileInfoExtended.height);
                }
            }

            xMin = Math.floor(xMin);
            xMax = Math.floor(xMax);
            let yMin = Number.MAX_VALUE;
            let yMax = -Number.MAX_VALUE;
            let yMean;
            let yRms;

            // Variables for mean and RMS calculations
            let ySum = 0;
            let ySum2 = 0;
            let yCount = 0;

            let values: Array<{x: number; y: number}>;
            let smoothingValues: Array<{x: number; y: number}>;
            let N: number;

            if (coordinateData.mip > 1 || coordinateData.start > 0 || coordinateData.end < xMax) {
                N = coordinateData.values.length;
                values = new Array(N);
                for (let i = 0; i < N; i++) {
                    const y = coordinateData.values[i];
                    const x = coordinateData.start + i * coordinateData.mip;
                    if (x >= xMin && x <= xMax && isFinite(y)) {
                        yMin = Math.min(yMin, y);
                        yMax = Math.max(yMax, y);
                        yCount++;
                        ySum += y;
                        ySum2 += y * y;
                    }
                    values[i] = {x, y};
                }
            } else {
                N = Math.floor(Math.min(xMax - xMin + 1, coordinateData.values.length));
                if (N > 0) {
                    let xArray: number[] = new Array(coordinateData.values.length);
                    for (let i = 0; i < coordinateData.values.length; i++) {
                        xArray[i] = i;
                    }
                    const numPixels = this.width;
                    const decimationFactor = Math.round(N / numPixels);

                    if (decimationFactor <= 1 || this.widgetStore.plotType === PlotType.POINTS) {
                        // full resolution data
                        values = new Array(N);
                        for (let i = 0; i < N; i++) {
                            const y = coordinateData.values[i + xMin];
                            const x = coordinateData.start + i + xMin;
                            if (x >= xMin && x <= xMax && isFinite(y)) {
                                yMin = Math.min(yMin, y);
                                yMax = Math.max(yMax, y);
                                yCount++;
                                ySum += y;
                                ySum2 += y * y;
                            }
                            values[i] = {x, y};
                        }
                    } else {
                        // Decimated data
                        for (let i = 0; i < N; i++) {
                            const val = coordinateData.values[i + xMin];
                            if (isFinite(val)) {
                                yMin = Math.min(yMin, val);
                                yMax = Math.max(yMax, val);
                                yCount++;
                                ySum += val;
                                ySum2 += val * val;
                            }
                        }
                        values = this.widgetStore.smoothingStore.getDecimatedPoint2DArray(xArray, coordinateData.values, decimationFactor, xMin, xMax);
                    }
                    smoothingValues = this.widgetStore.smoothingStore.getSmoothingPoint2DArray(xArray, coordinateData.values, xMin, xMax);
                }
            }

            if (yCount > 0) {
                yMean = ySum / yCount;
                yRms = Math.sqrt(ySum2 / yCount - yMean * yMean);
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

            // redefine if the region is line and polyline
            let xArray: number[] = new Array(coordinateData.values.length);
            if (this.widgetStore.effectiveRegion?.regionType === CARTA.RegionType.LINE) {
                yMean = 0;
                yRms = 0;
                let ySum = 0;
                let ySum2 = 0;
                let yCount = 0;
                for (let i = 0; i < N; i++) {
                    const y = coordinateData.values[i + xMin];
                    const x = (i - coordinateData.lineAxis.crpix) * coordinateData.lineAxis.cdelt;
                    yCount++;
                    ySum += y;
                    ySum2 += y * y;
                    values[i] = {x, y};
                    xArray[i] = x;
                }
                xMax = (coordinateData.end - coordinateData.lineAxis.crpix) * coordinateData.lineAxis.cdelt;
                xMin = (0 - coordinateData.lineAxis.crpix) * coordinateData.lineAxis.cdelt;

                if (yCount > 0) {
                    yMean = ySum / yCount;
                    yRms = Math.sqrt(ySum2 / yCount - yMean * yMean);
                }
            } else if (this.widgetStore.effectiveRegion?.regionType === CARTA.RegionType.POLYLINE) {
                yMean = 0;
                yRms = 0;
                let ySum = 0;
                let ySum2 = 0;
                let yCount = 0;
                for (let i = 0; i < N; i++) {
                    const y = coordinateData.values[i + xMin];
                    const x = i * coordinateData.lineAxis.cdelt;
                    yCount++;
                    ySum += y;
                    ySum2 += y * y;
                    values[i] = {x, y};
                    xArray[i] = x;
                }
                xMax = coordinateData.end * coordinateData.lineAxis.cdelt;
                xMin = 0;

                if (yCount > 0) {
                    yMean = ySum / yCount;
                    yRms = Math.sqrt(ySum2 / yCount - yMean * yMean);
                }
            }

            if (this.widgetStore.effectiveRegion?.regionType === CARTA.RegionType.LINE || this.widgetStore.effectiveRegion?.regionType === CARTA.RegionType.POLYLINE) {
                smoothingValues = this.widgetStore.smoothingStore.getSmoothingPoint2DArray(xArray, coordinateData.values);
            }

            return {values: values, smoothingValues, xMin, xMax, yMin, yMax, yMean, yRms};
        }
    }

    @computed get exportHeader(): string[] {
        const headerString: string[] = [];
        const frame = this.widgetStore.effectiveFrame;
        const region = this.widgetStore.effectiveRegion;
        if (frame && region) {
            headerString.push(...frame.getRegionProperties(region.regionId));
        }
        return headerString;
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        const appStore = AppStore.Instance;
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === SpatialProfilerComponent.WIDGET_CONFIG.type) {
            // Assign the next unique ID
            const id = appStore.widgetsStore.addSpatialProfileWidget();
            appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!appStore.widgetsStore.spatialProfileWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                appStore.widgetsStore.spatialProfileWidgets.set(this.props.id, new SpatialProfileWidgetStore());
            }
        }
        // Update widget title when region or coordinate changes
        autorun(() => {
            if (this.widgetStore) {
                const coordinate = this.widgetStore.coordinate;
                const currentData = this.plotData;
                if (appStore && coordinate) {
                    const coordinateString =
                        this.widgetStore.effectiveRegion?.regionType !== CARTA.RegionType.LINE && this.widgetStore.effectiveRegion?.regionType !== CARTA.RegionType.POLYLINE ? `${coordinate.toUpperCase()} Profile` : `Profile`;
                    const regionString = this.widgetStore.effectiveRegionId === RegionId.CURSOR ? "Cursor" : `Region #${this.widgetStore.effectiveRegionId}`;
                    appStore.widgetsStore.setWidgetTitle(this.props.id, `${coordinateString}: ${regionString}`);
                }
                if (currentData) {
                    this.widgetStore.initXYBoundaries(currentData.xMin, currentData.xMax, currentData.yMin, currentData.yMax);
                }
            } else {
                appStore.widgetsStore.setWidgetTitle(this.props.id, `X Profile: Cursor`);
            }
        });

        autorun(
            () => {
                if (!this.frame || !this.width) {
                    return null;
                }
                if (this.widgetStore.isXProfile) {
                    this.setAutoScaleBounds(clamp(this.frame.requiredFrameView.xMin, 0, this.frame.frameInfo.fileInfoExtended.width), clamp(this.frame.requiredFrameView.xMax, 0, this.frame.frameInfo.fileInfoExtended.width));
                } else {
                    this.setAutoScaleBounds(clamp(this.frame.requiredFrameView.yMin, 0, this.frame.frameInfo.fileInfoExtended.height), clamp(this.frame.requiredFrameView.yMax, 0, this.frame.frameInfo.fileInfoExtended.height));
                }
            },
            {delay: AUTOSCALE_THROTTLE_TIME}
        );
    }

    @action private setAutoScaleBounds = (min: number, max: number) => {
        this.autoScaleHorizontalMin = min;
        this.autoScaleHorizontalMax = max;
    };

    @action private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    private calculateFormattedValues(ticks: Tick[]) {
        if (!this.cachedFormattedCoordinates || this.cachedFormattedCoordinates.length !== ticks.length) {
            this.cachedFormattedCoordinates = new Array(ticks.length);
        }
        if (!this.frame || !this.profileStore || !this.widgetStore) {
            return;
        }

        let astString = new ASTSettingsString();
        astString.add("System", OverlayStore.Instance.global.explicitSystem);

        if (this.widgetStore.isXProfile) {
            for (let i = 0; i < ticks.length; i++) {
                const pointWCS = transformPoint(this.frame.wcsInfo, {x: ticks[i].value, y: this.profileStore.y});
                const normVals = AST.normalizeCoordinates(this.frame.wcsInfo, pointWCS.x, pointWCS.y);
                this.cachedFormattedCoordinates[i] = AST.getFormattedCoordinates(this.frame.wcsInfo, normVals.x, undefined, astString.toString(), true).x;
            }
        } else {
            for (let i = 0; i < ticks.length; i++) {
                const pointWCS = transformPoint(this.frame.wcsInfo, {x: this.profileStore.x, y: ticks[i].value});
                const normVals = AST.normalizeCoordinates(this.frame.wcsInfo, pointWCS.x, pointWCS.y);
                this.cachedFormattedCoordinates[i] = AST.getFormattedCoordinates(this.frame.wcsInfo, undefined, normVals.y, astString.toString(), true).y;
            }
        }
        this.trimDecimals();
    }

    // Trims unnecessary decimals from the list of formatted coordinates
    private trimDecimals() {
        if (!this.cachedFormattedCoordinates || !this.cachedFormattedCoordinates.length) {
            return;
        }
        // If the existing tick list has repeats, don't trim
        if (SpatialProfilerComponent.hasRepeats(this.cachedFormattedCoordinates)) {
            return;
        }
        const decimalIndex = this.cachedFormattedCoordinates[0].indexOf(".");
        // Skip lists without decimals. This assumes that all ticks have the same number of decimals
        if (decimalIndex === -1) {
            return;
        }
        const initialTrimLength = this.cachedFormattedCoordinates[0].length - decimalIndex;
        for (let trim = initialTrimLength; trim > 0; trim--) {
            let trimmedArray = this.cachedFormattedCoordinates.slice();
            for (let i = 0; i < trimmedArray.length; i++) {
                trimmedArray[i] = trimmedArray[i].slice(0, -trim);
            }
            if (!SpatialProfilerComponent.hasRepeats(trimmedArray)) {
                this.cachedFormattedCoordinates = trimmedArray;
                return;
            }
            // Skip an extra character after the first check, because of the decimal indicator
            if (trim === initialTrimLength) {
                trim--;
            }
        }
    }

    private static hasRepeats(ticks: string[]): boolean {
        if (!ticks || ticks.length < 2) {
            return false;
        }
        let prevTick = ticks[0];
        for (let i = 1; i < ticks.length; i++) {
            const nextTick = ticks[i];
            if (prevTick === nextTick) {
                return true;
            }
            prevTick = nextTick;
        }
        return false;
    }

    private formatProfileAst = (v: number, i: number, values: Tick[]) => {
        if (!this.frame || !this.profileStore) {
            return v;
        }

        // Cache all formatted values
        if (i === 0) {
            this.calculateFormattedValues(values);
        }
        return this.cachedFormattedCoordinates[i];
    };

    private genProfilerInfo = (): string[] => {
        let profilerInfo: string[] = [];
        if (this.plotData) {
            const isXCoordinate = this.widgetStore.coordinate.indexOf("x") >= 0;
            if (this.widgetStore.isMouseMoveIntoLinePlots) {
                // handle the value when cursor is in profiler
                const nearest = binarySearchByX(this.plotData.values, this.widgetStore.cursorX);
                if (nearest?.point) {
                    const pixelPoint = isXCoordinate ? {x: nearest.point.x, y: this.profileStore.y} : {x: this.profileStore.x, y: nearest.point.x};
                    const cursorInfo = this.frame.getCursorInfo(pixelPoint);
                    const wcsLabel = cursorInfo?.infoWCS ? `WCS: ${isXCoordinate ? cursorInfo.infoWCS.x : cursorInfo.infoWCS.y}, ` : "";
                    let imageUnit: string;
                    const coordinateData = this.profileStore?.getProfile(this.widgetStore.fullCoordinate);
                    if (this.widgetStore.effectiveRegion?.regionType === CARTA.RegionType.LINE || this.widgetStore.effectiveRegion?.regionType === CARTA.RegionType.POLYLINE) {
                        imageUnit = `${coordinateData?.lineAxis.unit}`;
                    } else {
                        imageUnit = `px`;
                    }
                    const imageLabel = `Image: ${nearest.point.x} ${imageUnit}, `;
                    const valueLabel = `${nearest.point.y !== undefined ? formattedExponential(nearest.point.y, 5) : ""}`;
                    profilerInfo.push("Cursor: (" + wcsLabel + imageLabel + valueLabel + ")");
                }
            } else if (this.widgetStore.effectiveRegion?.regionType === CARTA.RegionType.POINT) {
                // get value directly from point region
                const pointRegionInfo = this.frame.getCursorInfo(this.widgetStore.effectiveRegion.center);
                if (pointRegionInfo?.posImageSpace) {
                    const wcsLabel = pointRegionInfo?.infoWCS ? `WCS: ${isXCoordinate ? pointRegionInfo.infoWCS.x : pointRegionInfo.infoWCS.y}, ` : "";
                    const imageLabel = `Image: ${toFixed(isXCoordinate ? pointRegionInfo.posImageSpace.x : pointRegionInfo.posImageSpace.y)} px, `;
                    const valueLabel = `${this.profileStore?.value !== undefined ? formattedExponential(this.profileStore.value, 5) : ""}`;
                    profilerInfo.push("Data: (" + wcsLabel + imageLabel + valueLabel + ")");
                }
            }
            if (this.widgetStore.meanRmsVisible) {
                profilerInfo.push(`Mean/RMS: ${formattedExponential(this.plotData.yMean, 2) + " / " + formattedExponential(this.plotData.yRms, 2)}`);
            }
        }
        return profilerInfo;
    };

    onGraphCursorMoved = _.throttle(x => {
        this.widgetStore.setCursor(x);
    }, 33);

    render() {
        const appStore = AppStore.Instance;
        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return <NonIdealState icon={"error"} title={"Missing profile"} description={"Profile not found"} />;
        }

        const isXProfile = widgetStore.isXProfile;
        const imageName = appStore.activeFrame ? appStore.activeFrame.filename : undefined;
        const plotName = `${isXProfile ? "X" : "Y"} profile`;
        const coordinateData = this.profileStore?.getProfile(this.widgetStore.fullCoordinate);
        let setxLabel: string;
        if (this.widgetStore.effectiveRegion?.regionType === CARTA.RegionType.LINE) {
            setxLabel = `Offset (${coordinateData?.lineAxis.unit})`;
        } else if (this.widgetStore.effectiveRegion?.regionType === CARTA.RegionType.POLYLINE) {
            setxLabel = `Distance (${coordinateData?.lineAxis.unit})`;
        } else {
            setxLabel = `${isXProfile ? "X" : "Y"} coordinate`;
        }
        let linePlotProps: LinePlotComponentProps = {
            xLabel: setxLabel,
            yLabel: "Value",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: plotName,
            plotType: widgetStore.plotType,
            tickTypeY: TickType.Scientific,
            graphZoomedX: widgetStore.setXBounds,
            graphZoomedY: widgetStore.setYBounds,
            graphZoomedXY: widgetStore.setXYBounds,
            graphZoomReset: widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true,
            mouseEntered: widgetStore.setMouseMoveIntoLinePlots,
            zeroLineWidth: 2,
            borderWidth: widgetStore.lineWidth,
            pointRadius: widgetStore.linePlotPointSize,
            multiPlotPropsMap: new Map<string, MultiPlotProps>(),
            order: 1
        };

        if (appStore.activeFrame) {
            if (this.profileStore && this.frame) {
                if (this.frame.unit) {
                    linePlotProps.yLabel = `Value (${this.frame.unit})`;
                }

                if (this.widgetStore.effectiveRegion?.regionType !== CARTA.RegionType.LINE && this.widgetStore.effectiveRegion?.regionType !== CARTA.RegionType.POLYLINE) {
                    if (this.frame.validWcs && widgetStore.wcsAxisVisible) {
                        linePlotProps.showTopAxis = true;
                        linePlotProps.topAxisTickFormatter = this.formatProfileAst;
                    } else {
                        linePlotProps.showTopAxis = false;
                    }
                }

                const currentPlotData = this.plotData;
                if (currentPlotData) {
                    linePlotProps.data = currentPlotData.values;

                    // set line color
                    let primaryLineColor = getColorForTheme(widgetStore.primaryLineColor);
                    linePlotProps.lineColor = primaryLineColor;
                    const smoothingStore = widgetStore.smoothingStore;
                    if (smoothingStore.type !== SmoothingType.NONE && currentPlotData?.smoothingValues) {
                        if (!smoothingStore.isOverlayOn) {
                            linePlotProps.lineColor = "#00000000";
                        }

                        let smoothingPlotProps: MultiPlotProps = {
                            imageName: imageName,
                            plotName: `${plotName}-smoothed`,
                            data: currentPlotData.smoothingValues,
                            type: smoothingStore.lineType,
                            borderColor: getColorForTheme(smoothingStore.lineColor),
                            borderWidth: smoothingStore.lineWidth,
                            pointRadius: smoothingStore.pointRadius,
                            order: 0,
                            comments: smoothingStore.comments
                        };
                        linePlotProps.multiPlotPropsMap.set("smoothed", smoothingPlotProps);
                    }

                    // Determine scale in X and Y directions. If auto-scaling, use the bounds of the current data
                    if (widgetStore.isAutoScaledX) {
                        linePlotProps.xMin = currentPlotData.xMin;
                        linePlotProps.xMax = currentPlotData.xMax;
                    } else {
                        linePlotProps.xMin = widgetStore.minX;
                        linePlotProps.xMax = widgetStore.maxX;
                    }

                    if (widgetStore.isAutoScaledY) {
                        linePlotProps.yMin = currentPlotData.yMin;
                        linePlotProps.yMax = currentPlotData.yMax;
                    } else {
                        linePlotProps.yMin = widgetStore.minY;
                        linePlotProps.yMax = widgetStore.maxY;
                    }

                    // Use interpolated lines when decimating data to speed up rendering
                    if (currentPlotData.values && currentPlotData.values.length > this.width * 1.5) {
                        linePlotProps.plotType = PlotType.LINES;
                    }
                }

                const cursorX = {
                    profiler: widgetStore.cursorX,
                    image: isXProfile ? this.profileStore.x : this.profileStore.y,
                    unit: "px"
                };
                linePlotProps.markers = [
                    {
                        value: cursorX.image,
                        id: "marker-image-cursor",
                        draggable: false,
                        horizontal: false,
                        opacity: this.widgetStore.effectiveRegion?.regionType !== CARTA.RegionType.LINE && this.widgetStore.effectiveRegion?.regionType !== CARTA.RegionType.POLYLINE ? 1 : 0.1
                    }
                ];
                linePlotProps.markers.push({
                    value: cursorX.profiler,
                    id: "marker-profiler-cursor",
                    draggable: false,
                    horizontal: false,
                    color: appStore.darkTheme ? Colors.GRAY4 : Colors.GRAY2,
                    opacity: 0.8,
                    isMouseMove: true
                });

                if (widgetStore.meanRmsVisible && currentPlotData && isFinite(currentPlotData.yMean) && isFinite(currentPlotData.yRms)) {
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

                // TODO: Get comments from region info, rather than directly from cursor position
                if (appStore.activeFrame.cursorInfo) {
                    linePlotProps.comments = this.exportHeader;
                }
            }
        }

        return (
            <div className={"spatial-profiler-widget"}>
                <div className="profile-container">
                    <div className="profile-toolbar">
                        <RegionSelectorComponent widgetStore={widgetStore} />
                        {widgetStore.effectiveFrame?.hasStokes && (
                            <FormGroup label={"Polarization"} inline={true}>
                                <HTMLSelect value={widgetStore.selectedStokes} options={widgetStore.stokesOptions} onChange={ev => widgetStore.setSelectedStokes(ev.currentTarget.value)} />
                            </FormGroup>
                        )}
                    </div>
                    <div className="profile-plot">
                        <LinePlotComponent {...linePlotProps} />
                    </div>
                    <div className="profile-info">
                        <ProfilerInfoComponent info={this.genProfilerInfo()} />
                    </div>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}></ReactResizeDetector>
            </div>
        );
    }
}
