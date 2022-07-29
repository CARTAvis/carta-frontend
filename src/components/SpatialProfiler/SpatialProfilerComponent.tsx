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
import {AppStore, ASTSettingsString, DefaultWidgetConfig, HelpType, OverlayStore, SpatialProfileStore, WidgetProps, WidgetsStore, NumberFormatType} from "stores";
import {FrameStore} from "stores/Frame";
import {RegionId, SpatialProfileWidgetStore} from "stores/widgets";
import {Point2D, POLARIZATIONS} from "models";
import {binarySearchByX, clamp, formattedExponential, transformPoint, toFixed, getColorForTheme, getPixelValueFromWCS, getFormattedWCSPoint} from "utilities";
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

    @computed get plotData(): {values: Array<Point2D>; fullResolutionValues: Array<Point2D>; smoothingValues: Array<Point2D>; xMin: number; xMax: number; yMin: number; yMax: number; yMean: number; yRms: number} {
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
            if (this.lineAxis) {
                if (this.widgetStore.isAutoScaledX) {
                    xMin = this.autoScaleHorizontalMin;
                    xMax = this.autoScaleHorizontalMax;
                } else {
                    xMin = clamp(this.widgetStore.minX, this.lineAxis.min, this.lineAxis.max);
                    xMax = clamp(this.widgetStore.maxX, this.lineAxis.min, this.lineAxis.max);
                }
            } else {
                if (this.widgetStore.isAutoScaledX) {
                    xMin = this.autoScaleHorizontalMin;
                    xMax = this.autoScaleHorizontalMax;
                } else {
                    xMin = clamp(this.widgetStore.minX, 0, this.frame.frameInfo.fileInfoExtended.width);
                    xMax = clamp(this.widgetStore.maxX, 0, this.widgetStore.isXProfile ? this.frame.frameInfo.fileInfoExtended.width : this.frame.frameInfo.fileInfoExtended.height);
                }
                xMin = Math.floor(xMin);
                xMax = Math.floor(xMax);
            }

            let yMin = Number.MAX_VALUE;
            let yMax = -Number.MAX_VALUE;
            let yMean;
            let yRms;

            // Variables for mean and RMS calculations
            let ySum = 0;
            let ySum2 = 0;
            let yCount = 0;

            let values: Array<Point2D>;
            let fullResolutionValues: Array<Point2D>;
            let smoothingValues: Array<{x: number; y: number}>;
            let N: number;

            if (this.lineAxis) {
                N = coordinateData.values.length;
                values = new Array(N);
                fullResolutionValues = new Array(N);
                let xArray: number[] = new Array(N);
                const numPixels = this.width;
                const decimationFactor = Math.round(N / numPixels);
                let startIndex: number;
                let endIndex: number;
                for (let i = 0; i < N; i++) {
                    const y = coordinateData.values[i];
                    const x = this.widgetStore.effectiveRegion?.regionType === CARTA.RegionType.LINE ? (i - coordinateData.lineAxis.crpix) * coordinateData.lineAxis.cdelt : i * coordinateData.lineAxis.cdelt;
                    if (x >= xMin && x <= xMax && isFinite(y)) {
                        yMin = Math.min(yMin, y);
                        yMax = Math.max(yMax, y);
                        yCount++;
                        ySum += y;
                        ySum2 += y * y;
                        if (startIndex === undefined) {
                            startIndex = i;
                        }
                        endIndex = i;
                    }
                    xArray[i] = x;
                    if (decimationFactor <= 1) {
                        values[i] = {x, y};
                    } else {
                        fullResolutionValues[i] = {x, y};
                    }
                }
                if (decimationFactor > 1) {
                    values = this.widgetStore.smoothingStore.getDecimatedPoint2DArray(xArray, coordinateData.values, decimationFactor, startIndex, endIndex);
                }
                smoothingValues = this.widgetStore.smoothingStore.getSmoothingPoint2DArray(xArray, coordinateData.values);
            } else if (coordinateData.mip > 1 || coordinateData.start > 0 || coordinateData.end < xMax) {
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
                        fullResolutionValues = new Array(N);
                        for (let i = 0; i < N; i++) {
                            const val = coordinateData.values[i + xMin];
                            const x = coordinateData.start + i + xMin;
                            if (isFinite(val)) {
                                yMin = Math.min(yMin, val);
                                yMax = Math.max(yMax, val);
                                yCount++;
                                ySum += val;
                                ySum2 += val * val;
                            }
                            fullResolutionValues[i] = {x, y: val};
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

            return {values: values, fullResolutionValues, smoothingValues, xMin, xMax, yMin, yMax, yMean, yRms};
        }
    }

    @computed get exportHeader(): string[] {
        const headerString: string[] = [];
        if (this.widgetStore.effectiveRegion) {
            headerString.push(...this.widgetStore.effectiveFrame.getRegionProperties(this.widgetStore.effectiveRegionId));
        }
        return headerString;
    }

    // displaying offset/distance in the x axis for line and polyline regions
    @computed get lineAxis(): {label: string; min: number; max: number; unit: string} {
        const coordinateData = this.profileStore?.getProfile(this.widgetStore.fullCoordinate);
        if (coordinateData?.lineAxis && this.widgetStore.isLineOrPolyline) {
            const lineAxis = coordinateData.lineAxis;
            const min = lineAxis.axisType === CARTA.ProfileAxisType.Offset ? (0 - lineAxis.crpix) * lineAxis.cdelt : 0;
            const max = lineAxis.axisType === CARTA.ProfileAxisType.Offset ? (coordinateData.end - lineAxis.crpix) * lineAxis.cdelt : coordinateData.end * lineAxis.cdelt;
            return {label: lineAxis.axisType === CARTA.ProfileAxisType.Offset ? "Offset" : "Distance", min, max, unit: lineAxis.unit};
        }
        return null;
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
                    const coordinateString = this.widgetStore.isLineOrPolyline ? "" : coordinate.toUpperCase();
                    const regionString = this.widgetStore.effectiveRegionId === RegionId.CURSOR ? "Cursor" : `Region #${this.widgetStore.effectiveRegionId}`;
                    appStore.widgetsStore.setWidgetTitle(this.props.id, `${coordinateString} Profile: ${regionString}`);
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
                if (this.lineAxis) {
                    this.setAutoScaleBounds(this.lineAxis.min, this.lineAxis.max);
                } else if (this.widgetStore.isXProfile) {
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

    private formatBlank = (v: number, i: number, values: Tick[]) => {
        return "";
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
                    const wcsLabel = cursorInfo?.infoWCS && !this.lineAxis ? `WCS: ${isXCoordinate ? cursorInfo.infoWCS.x : cursorInfo.infoWCS.y}, ` : "";
                    const xLabel = this.lineAxis ? `${this.lineAxis.label}: ${formattedExponential(nearest.point.x, 5)} ${this.lineAxis.unit ?? ""}, ` : `Image: ${nearest.point.x} px, `;
                    const valueLabel = `${nearest.point.y !== undefined ? formattedExponential(nearest.point.y, 5) : ""}`;
                    profilerInfo.push("Cursor: (" + wcsLabel + xLabel + valueLabel + ")");
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

    @computed private get wcsGrid(): {wcs: string; pixel: number}[] {
        const grids = [];
        const isXProfile = this.widgetStore.isXProfile;
        if (this.plotData?.values && this.widgetStore.effectiveRegion.regionType === CARTA.RegionType.POINT) {
            const wcsInfo = this.frame.wcsInfoForTransformation;
            const pointRegionWcs = getFormattedWCSPoint(wcsInfo, this.widgetStore.effectiveRegion.center);
            const pointRegionPixel = this.widgetStore.effectiveRegion.center;

            let initialPixel:Point2D, finalPixel:Point2D, initialWcs, finalWcs;
            if (isXProfile) {
                initialPixel = {x: this.widgetStore.isAutoScaledX ? this.plotData.xMin : this.widgetStore.minX, y: pointRegionPixel.y};
                finalPixel = {x: this.widgetStore.isAutoScaledX ? this.plotData.xMax : this.widgetStore.maxX, y: pointRegionPixel.y};
                initialWcs = getFormattedWCSPoint(wcsInfo, initialPixel).x;
                finalWcs = getFormattedWCSPoint(wcsInfo, finalPixel).x;
            } else {
                initialPixel = {x: pointRegionPixel.x, y: this.widgetStore.isAutoScaledX ? this.plotData.xMin : this.widgetStore.minX};
                finalPixel = {x: pointRegionPixel.x, y: this.widgetStore.isAutoScaledX ? this.plotData.xMax : this.widgetStore.maxX};
                initialWcs = getFormattedWCSPoint(wcsInfo, initialPixel).y;
                finalWcs = getFormattedWCSPoint(wcsInfo, finalPixel).y;
            }

            if (!initialWcs || !finalWcs || initialWcs === "<bad>" || finalWcs === "<bad>") {
                return null;
            }

            const format = isXProfile ? AppStore.Instance.overlayStore.numbers.formatX : AppStore.Instance.overlayStore.numbers.formatY;
            let minWcs: string, maxWcs: string;
            if (format === NumberFormatType.Degrees) {
                const initialIsMin = parseFloat(initialWcs) < parseFloat(finalWcs);
                minWcs = initialIsMin ? initialWcs : finalWcs;
                maxWcs = initialIsMin ? finalWcs : initialWcs;
            } else {
                const initialIsMin = this.totalSeconds(initialWcs) < this.totalSeconds(finalWcs);
                minWcs = initialIsMin ? initialWcs : finalWcs;
                maxWcs = initialIsMin ? finalWcs : initialWcs;
            }

            if (isXProfile) {
                let originPixel;
                if (format === NumberFormatType.Degrees) {
                    originPixel = getPixelValueFromWCS(wcsInfo, {x: "0", y: pointRegionWcs.y}).x;
                } else {
                    originPixel = getPixelValueFromWCS(wcsInfo, {x: "0:00:00", y: pointRegionWcs.y}).x;
                }
                const hasXOrigin = originPixel > initialPixel.x && originPixel < finalPixel.x;

                const deltaWcs = this.getInterWcsDist(initialWcs, finalWcs, format, hasXOrigin);
                if (!deltaWcs) {
                    return null;
                }

                if (hasXOrigin) {
                    if (format === NumberFormatType.HMS) {
                        grids.push(...this.getGrids(maxWcs, "24:00:00", wcsInfo, isXProfile, deltaWcs, pointRegionWcs, format));
                        grids.push(...this.getGrids("0:00:00", minWcs, wcsInfo, isXProfile, deltaWcs, pointRegionWcs, format));
                    } else if (format === NumberFormatType.DMS) {
                        grids.push(...this.getGrids(maxWcs, "360:00:00", wcsInfo, isXProfile, deltaWcs, pointRegionWcs, format));
                        grids.push(...this.getGrids("0:00:00", minWcs, wcsInfo, isXProfile, deltaWcs, pointRegionWcs, format));
                    } else {
                        grids.push(...this.getGrids(maxWcs, "360", wcsInfo, isXProfile, deltaWcs, pointRegionWcs, format));
                        grids.push(...this.getGrids("0", minWcs, wcsInfo, isXProfile, deltaWcs, pointRegionWcs, format));
                    }
                } else {
                    grids.push(...this.getGrids(minWcs, maxWcs, wcsInfo, isXProfile, deltaWcs, pointRegionWcs, format));
                }
            } else {
                const deltaWcs = this.getInterWcsDist(initialWcs, finalWcs, format);
                if (!deltaWcs) {
                    return null;
                }
                grids.push(...this.getGrids(minWcs, maxWcs, wcsInfo, isXProfile, deltaWcs, pointRegionWcs, format));
            }
        }
        return grids;
    }

    private getGrids = (startWcs: string, endWcs: string, wcsInfo: AST.FrameSet, isXProfile: boolean, interDist: string, pointRegionWcs: {x: string; y: string}, format: NumberFormatType): {wcs: string; pixel: number}[] => {
        const grids = [];
        if (format === NumberFormatType.HMS || format === NumberFormatType.DMS) {
            const hdms = this.getWcsHDMS(interDist);
            const startSeconds = this.totalSeconds(startWcs);
            const endSeconds = this.totalSeconds(endWcs);

            if (hdms.hd !== 0) {
                const firstWcsHD = Math.ceil(startSeconds / (hdms.hd * 3600)) * hdms.hd;
                for (var i = 0; ; i++) {
                    const wcsHD = firstWcsHD + i * hdms.hd;
                    if (wcsHD * 3600 > endSeconds || wcsHD === (format === NumberFormatType.HMS ? 24 : 360)) {
                        break;
                    }

                    const wcs = `${wcsHD}:00:00`;
                    const pixel = isXProfile ? getPixelValueFromWCS(wcsInfo, {x: wcs, y: pointRegionWcs.y}).x : getPixelValueFromWCS(wcsInfo, {x: pointRegionWcs.x, y: wcs}).y;
                    grids.push({wcs, pixel});
                }
            } else if (hdms.m !== 0) {
                const firstWcsM = Math.ceil(startSeconds / (hdms.m * 60)) * hdms.m;
                for (var j = 0; ; j++) {
                    const wcsM = firstWcsM + j * hdms.m;
                    if (wcsM * 60 > endSeconds || wcsM === (format === NumberFormatType.HMS ? 24 : 360) * 60) {
                        break;
                    }

                    const h = Math.floor(wcsM / 60);
                    const m = wcsM - h * 60;
                    const wcs = `${h}:${m < 10 ? "0" : ""}${m}:00`;
                    const pixel = isXProfile ? getPixelValueFromWCS(wcsInfo, {x: wcs, y: pointRegionWcs.y}).x : getPixelValueFromWCS(wcsInfo, {x: pointRegionWcs.x, y: wcs}).y;
                    grids.push({wcs, pixel});
                }
            } else if (hdms.s !== 0) {
                // Round second.
                let roundingDecimalDigits = 0;
                if (hdms.s < 1) {
                    roundingDecimalDigits = Math.abs(Math.floor(Math.log10(hdms.s)));
                }
                const interDistS = Number(hdms.s.toFixed(roundingDecimalDigits));

                const firstWcsS = Math.ceil(startSeconds / interDistS) * interDistS;
                for (var k = 0; ; k++) {
                    const wcsS = Number((firstWcsS + k * interDistS).toFixed(roundingDecimalDigits));
                    if (wcsS > endSeconds || wcsS === (format === NumberFormatType.HMS ? 24 : 360) * 3600) {
                        break;
                    }

                    const h = Math.floor(wcsS / 3600);
                    const m = Math.floor((wcsS - h * 3600) / 60);
                    const s = wcsS - h * 3600 - m * 60;
                    const wcs = `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${Number(s.toFixed(roundingDecimalDigits))}`;
                    const pixel = isXProfile ? getPixelValueFromWCS(wcsInfo, {x: wcs, y: pointRegionWcs.y}).x : getPixelValueFromWCS(wcsInfo, {x: pointRegionWcs.x, y: wcs}).y;
                    grids.push({wcs, pixel});
                }
            }
        } else if (format === NumberFormatType.Degrees) {
            // round degrees
            const interDistVal = parseFloat(interDist);
            let roundingDecimalDigits = 0;
            if (interDistVal < 1) {
                roundingDecimalDigits = Math.abs(Math.floor(Math.log10(interDistVal)));
            }
            const interDistDegree = Number(interDistVal.toFixed(roundingDecimalDigits));

            const firstWcsDegree = Math.ceil(parseFloat(startWcs) / interDistDegree) * interDistDegree;
            for (var m = 0; ; m++) {
                const wcsDegree = firstWcsDegree + m * interDistDegree;
                if (wcsDegree > parseFloat(endWcs) || wcsDegree === 360) {
                    break;
                }
                const wcs = `${Number(wcsDegree.toFixed(roundingDecimalDigits))}°`;
                const pixel = isXProfile ? getPixelValueFromWCS(wcsInfo, {x: wcs.toString(), y: pointRegionWcs.y}).x : getPixelValueFromWCS(wcsInfo, {x: pointRegionWcs.x, y: wcs.toString()}).y;
                grids.push({wcs, pixel});
            }
        }
        return grids;
    };

    private getInterWcsDist = (wcs1: string, wcs2: string, format: NumberFormatType, hasXOrigin?: boolean): string => {
        if (format === NumberFormatType.HMS || format === NumberFormatType.DMS) {
            const totalSeconds1 = this.totalSeconds(wcs1);
            const totalSeconds2 = this.totalSeconds(wcs2);
            const min = Math.min(totalSeconds1, totalSeconds2);
            const max = Math.max(totalSeconds1, totalSeconds2);
            const deltaSeconds = hasXOrigin ? min + (format === NumberFormatType.HMS ? 24 * 3600 : 360 * 3600) - max : max - min;

            if (deltaSeconds > 3 * 3600) {
                return `${this.getDeltaNumber(deltaSeconds / 3600)}:00:00`;
            } else if (deltaSeconds <= 3 * 3600 && deltaSeconds > 2 * 3600) {
                return "0:30:00";
            } else if (deltaSeconds <= 2 * 3600 && deltaSeconds > 3600) {
                return "0:20:00";
            } else if (deltaSeconds <= 60 * 60 && deltaSeconds > 3 * 60) {
                return `0:${this.getDeltaNumber(deltaSeconds / 60)}:00`;
            } else if (deltaSeconds <= 3 * 60 && deltaSeconds > 2 * 60) {
                return "0:00:30";
            } else if (deltaSeconds <= 2 * 60 && deltaSeconds > 60) {
                return "0:00:20";
            } else {
                return `0:00:${this.getDeltaNumber(deltaSeconds)}`;
            }
        } else {
            const degree1 = parseFloat(wcs1);
            const degree2 = parseFloat(wcs2);
            const min = Math.min(degree1, degree2);
            const max = Math.max(degree1, degree2);
            const deltaDegree = hasXOrigin ? min + 360 - max : max - min;
            return this.getDeltaNumber(deltaDegree).toString();
        }
    };

    private totalSeconds(wcs: string) {
        const hdms = this.getWcsHDMS(wcs);
        return hdms.hd * 60 * 60 + hdms.m * 60 + hdms.s;
    }

    private getWcsHDMS(wcs: string): {hd: number; m: number; s: number} {
        const hd = parseInt(wcs.substring(0, wcs.indexOf(":")));
        const mStr = wcs.substring(wcs.indexOf(":") + 1, wcs.lastIndexOf(":"));
        const m = mStr.startsWith("0") ? parseInt(mStr.substring(1)) : parseInt(mStr);
        const sStr = wcs.substring(wcs.lastIndexOf(":") + 1);
        const s = sStr.startsWith("0") ? parseFloat(sStr.substring(1)) : parseFloat(sStr);
        return {hd, m, s};
    }

    private getDeltaNumber(val: number): number {
        const wcsDistLog = Math.log10(val);
        const wcsDistLogHead = Math.floor(wcsDistLog);
        const wcsDistLogFraction = wcsDistLog - wcsDistLogHead;
        let interWcsDist: number;
        if (wcsDistLogFraction >= Math.log10(6) && wcsDistLogFraction < 1) {
            interWcsDist = 2 * Math.pow(10, wcsDistLogHead);
        } else if (wcsDistLogFraction >= Math.log10(3) && wcsDistLogFraction < Math.log10(6)) {
            interWcsDist = Math.pow(10, wcsDistLogHead);
        } else if (wcsDistLogFraction >= Math.log10(1.5) && wcsDistLogFraction < Math.log10(3)) {
            interWcsDist = 5 * Math.pow(10, wcsDistLogHead - 1);
        } else {
            interWcsDist = 2 * Math.pow(10, wcsDistLogHead - 1);
        }
        return interWcsDist;
    }

    onGraphCursorMoved = _.throttle(x => {
        this.widgetStore.setCursor(x);
    }, 33);

    render() {
        // dummy variables related to wcs to trigger re-render
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const system = AppStore.Instance.overlayStore.global.explicitSystem;
        const appStore = AppStore.Instance;
        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return <NonIdealState icon={"error"} title={"Missing profile"} description={"Profile not found"} />;
        }

        const isXProfile = widgetStore.isXProfile;
        const xLabel = this.lineAxis ? `${this.lineAxis.label} (${this.lineAxis.unit ?? ""})` : `${isXProfile ? "X" : "Y"} coordinate`;
        const imageName = appStore.activeFrame ? appStore.activeFrame.filename : undefined;
        const plotName = `${this.lineAxis ? "" : isXProfile ? "X " : "Y "}profile`;
        let linePlotProps: LinePlotComponentProps = {
            xLabel: xLabel,
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
                if (this.frame.headerUnit) {
                    let unit: string;
                    if ([POLARIZATIONS.PFtotal, POLARIZATIONS.PFlinear].includes(this.widgetStore.effectivePolarization)) {
                        unit = "%";
                    } else if (this.widgetStore.effectivePolarization === POLARIZATIONS.Pangle) {
                        unit = "degree";
                    } else {
                        unit = this.frame.headerUnit;
                    }
                    linePlotProps.yLabel = `Value (${unit})`;
                }

                const currentPlotData = this.plotData;
                if (currentPlotData) {
                    linePlotProps.data = currentPlotData.values;
                    linePlotProps.fullResolutionData = currentPlotData.fullResolutionValues;

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
                        opacity: this.widgetStore.isLineOrPolyline ? 0.1 : 1
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

                if (!this.widgetStore.isLineOrPolyline) {
                    if (this.frame.validWcs && widgetStore.wcsAxisVisible) {
                        linePlotProps.showTopAxis = true;
                        linePlotProps.topAxisTickFormatter = this.formatBlank;
                        if (this.wcsGrid?.length) {
                            for (var i = 0; i < this.wcsGrid.length; i++) {
                                linePlotProps.markers.push({
                                    value: this.wcsGrid[i].pixel,
                                    topLabel: this.wcsGrid[i].wcs,
                                    id: `marker-wcs-grid-${i}`,
                                    draggable: false,
                                    horizontal: false,
                                    color: getColorForTheme(widgetStore.wcsAxisColor),
                                    opacity: 0.6
                                });
                            }
                        }
                    } else {
                        linePlotProps.showTopAxis = true;
                    }
                }

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
