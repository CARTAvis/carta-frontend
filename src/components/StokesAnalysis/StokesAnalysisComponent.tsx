import * as React from "react";
import * as _ from "lodash";
import {action, autorun, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {Colors, NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {ChartArea} from "chart.js";
import {CARTA} from "carta-protobuf";
import {LinePlotComponent, LinePlotComponentProps, ProfilerInfoComponent, ScatterPlotComponent, ScatterPlotComponentProps, VERTICAL_RANGE_PADDING, PlotType, SmoothingType} from "components/Shared";
import {StokesAnalysisToolbarComponent} from "./StokesAnalysisToolbarComponent/StokesAnalysisToolbarComponent";
import {TickType, MultiPlotProps} from "../Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {AppStore, AnimatorStore, DefaultWidgetConfig, HelpType, WidgetsStore, WidgetProps, SpectralProfileStore} from "stores";
import {FrameStore} from "stores/Frame";
import {StokesAnalysisWidgetStore, StokesCoordinate} from "stores/widgets";
import {Point2D, SpectralColorMap, SpectralType} from "models";
import {clamp, normalising, polarizationAngle, polarizedIntensity, binarySearchByX, closestPointIndexToCursor, toFixed, toExponential, minMaxPointArrayZ, formattedNotation, minMaxArray, getColorForTheme} from "utilities";
import "./StokesAnalysisComponent.scss";

type Border = {xMin: number; xMax: number; yMin: number; yMax: number};
type Point3D = {x: number; y: number; z?: number};

@observer
export class StokesAnalysisComponent extends React.Component<WidgetProps> {
    private pointDefaultColor = Colors.GRAY2;
    private opacityOutRange = 0.1;
    private channelBorder: {xMin: number; xMax: number};
    private minProgress = 0;
    private cursorInfo: {isMouseEntered: boolean; quValue: Point2D; channel: number; pi: number; pa: number; xUnit: string};
    private static layoutRatioCutoffs = {
        vertical: 0.5,
        horizontal: 2
    };
    private multicolorLineColorOutRange = "hsla(0, 0%, 50%, 0.5)";

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "stokes",
            type: "stokes",
            minWidth: 320,
            minHeight: 400,
            defaultWidth: 520,
            defaultHeight: 650,
            title: "Stokes Analysis",
            isCloseable: true,
            helpType: HelpType.STOKES_ANALYSIS
        };
    }

    @observable width: number;
    @observable height: number;

    @computed get widgetStore(): StokesAnalysisWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.stokesAnalysisWidgets) {
            const widgetStore = widgetsStore.stokesAnalysisWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new StokesAnalysisWidgetStore();
    }

    @computed get profileStore(): SpectralProfileStore {
        const appStore = AppStore.Instance;
        if (this.widgetStore.effectiveFrame) {
            let fileId = this.widgetStore.effectiveFrame.frameInfo.fileId;
            const regionId = this.widgetStore.effectiveRegionId;
            const frameMap = appStore.spectralProfiles.get(fileId);
            if (frameMap) {
                return frameMap.get(regionId);
            }
        }
        return null;
    }

    @computed get exportHeaders(): string[] {
        let headerString = [];
        const regionProperties = this.widgetStore.effectiveFrame?.getRegionProperties(this.widgetStore.effectiveRegionId);
        regionProperties?.forEach(regionProperty => headerString.push(regionProperty));
        return headerString;
    }

    @computed get exportQUScatterHeaders(): string[] {
        return this.widgetStore.smoothingStore.type === SmoothingType.NONE ? this.exportHeaders : this.exportHeaders.concat(this.widgetStore.smoothingStore.comments);
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        const appStore = AppStore.Instance;
        if (!props.docked && props.id === StokesAnalysisComponent.WIDGET_CONFIG.type) {
            const id = appStore.widgetsStore.addStokesWidget();
            appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!appStore.widgetsStore.stokesAnalysisWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                appStore.widgetsStore.stokesAnalysisWidgets.set(this.props.id, new StokesAnalysisWidgetStore());
            }
        }

        autorun(() => {
            if (this.widgetStore) {
                const frame = this.widgetStore.effectiveFrame;
                let progressString = "";
                const currentData = this.plotData;
                if (currentData && isFinite(currentData.qProgress) && isFinite(currentData.uProgress)) {
                    const minProgress = Math.min(currentData.qProgress, currentData.uProgress, currentData.iProgress);
                    if (minProgress < 1) {
                        progressString = `[${toFixed(minProgress * 100)}% complete]`;
                    }
                    this.minProgress = minProgress;
                }
                if (frame) {
                    const regionId = this.widgetStore.effectiveRegionId;
                    const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
                    const selectedString = this.widgetStore.matchesSelectedRegion ? "(Active)" : "";
                    appStore.widgetsStore.setWidgetTitle(this.props.id, `Stokes Analysis : ${regionString} ${selectedString} ${progressString}`);
                }
            } else {
                appStore.widgetsStore.setWidgetTitle(this.props.id, `Stokes Analysis: Cursor`);
            }
        });
    }

    @action private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
        this.widgetStore.clearScatterPlotXYBounds();
    };

    // true: red->blue, false: blue->red. chartjs plot tick lables with increasing order by default, no need to check for CDELT
    private getColorMapOrder(frame: FrameStore): boolean {
        const defaultType = frame?.spectralAxis?.type.code;
        let CTYPE = frame?.spectralType ?? defaultType;
        if (CTYPE === SpectralType.CHANNEL) {
            CTYPE = defaultType;
        }

        switch (CTYPE) {
            case SpectralColorMap.FREQ:
            case SpectralColorMap.ENER:
            case SpectralColorMap.WAVE:
                return true;
            default:
                return false;
        }
    }

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

    onChannelChanged = (x: number) => {
        const frame = this.widgetStore.effectiveFrame;
        if (AnimatorStore.Instance.animationActive) {
            return;
        }

        if (frame && frame.channelInfo) {
            let channelInfo = frame.channelInfo;
            let nearestIndex;
            if (frame.isCoordChannel) {
                nearestIndex = channelInfo.getChannelIndexSimple(x);
            } else {
                if ((frame.spectralAxis && !frame.spectralAxis.valid) || frame.isSpectralPropsEqual) {
                    nearestIndex = channelInfo.getChannelIndexWCS(x);
                } else {
                    // invert x in selected widget wcs to frame's default wcs
                    const nativeX = frame.convertToNativeWCS(x);
                    if (isFinite(nativeX)) {
                        nearestIndex = channelInfo.getChannelIndexWCS(nativeX);
                    }
                }
            }
            if (nearestIndex !== null && nearestIndex !== undefined) {
                frame.setChannels(nearestIndex, frame.requiredStokes, true);
            }
        }
    };

    onScatterChannelChanged = (x: number, y: number, data: Point3D[]) => {
        const frame = this.widgetStore.effectiveFrame;
        if (AnimatorStore.Instance.animationActive) {
            return;
        }
        if (data.length > 0 && frame && frame.channelInfo) {
            let channelInfo = frame.channelInfo;
            const zIndex = this.matchZindex(x, y, data);
            let nearestIndex;
            if (frame.isCoordChannel) {
                nearestIndex = channelInfo.getChannelIndexSimple(zIndex);
            } else {
                if ((frame.spectralAxis && !frame.spectralAxis.valid) || frame.isSpectralPropsEqual) {
                    nearestIndex = channelInfo.getChannelIndexWCS(zIndex);
                } else {
                    // invert x in selected widget wcs to frame's default wcs
                    const nativeX = frame.convertToNativeWCS(x);
                    if (isFinite(nativeX)) {
                        nearestIndex = channelInfo.getChannelIndexWCS(nativeX);
                    }
                }
            }
            if (nearestIndex !== null && nearestIndex !== undefined) {
                frame.setChannels(nearestIndex, frame.requiredStokes, true);
            }
        }
    };

    private matchZindex(x: number, y: number, data: Point3D[]): number {
        let channel = 0;
        for (let index = 0; index < data.length; index++) {
            const element = data[index];
            if (element.x === x && element.y === y) {
                channel = element.z;
                break;
            }
        }
        return channel;
    }

    private matchXYindex(z: number, data: readonly Point3D[]): Point3D {
        let point = data[0];
        for (let index = 0; index < data.length; index++) {
            const element = data[index];
            if (element.z === z) {
                point = element;
                break;
            }
        }
        return point;
    }

    private static calculateLayout = (width: number, height: number): string => {
        if (width && height) {
            let ratio = width / height;
            let verticalDiff = Math.abs(ratio - StokesAnalysisComponent.layoutRatioCutoffs.vertical);
            let horizontalDiff = Math.abs(ratio - StokesAnalysisComponent.layoutRatioCutoffs.horizontal);

            let minValue = Math.min(verticalDiff, horizontalDiff);

            if (minValue === verticalDiff) {
                return "vertical";
            } else if (minValue === horizontalDiff) {
                return "horizontal";
            }
            return null;
        }
        return null;
    };

    onGraphCursorMoved = _.throttle(x => {
        this.widgetStore.setlinePlotCursorX(x);
    }, 33);

    onScatterGraphCursorMoved = _.throttle((x, y) => {
        this.widgetStore.setScatterPlotCursor({x: x, y: y});
    }, 33);

    private static calculatePA(qData: Float32Array | Float64Array, uData: Float32Array | Float64Array): Array<number> {
        let vals = [];
        if (qData && uData && qData.length === uData.length) {
            for (let i = 0; i < qData.length; i++) {
                // Unit degree
                vals[i] = polarizationAngle(qData[i], uData[i]);
            }
        }
        return vals;
    }

    private static calculatePI(qData: Float32Array | Float64Array, uData: Float32Array | Float64Array): Array<number> {
        let vals = [];
        if (qData && uData && qData.length === uData.length) {
            for (let i = 0; i < qData.length; i++) {
                vals[i] = polarizedIntensity(qData[i], uData[i]);
            }
        }
        return vals;
    }

    private static calculateFractionalPol(targetData: Array<number> | Float32Array | Float64Array, dataIz: Float32Array | Float64Array): Array<number> {
        let vals = [];
        if (targetData && dataIz && targetData.length === dataIz.length) {
            for (let i = 0; i < targetData.length; i++) {
                vals[i] = normalising(targetData[i], dataIz[i]);
            }
        }
        return vals;
    }

    private calculateCompositeProfile(statsType: CARTA.StatsType): {
        qProfile: Array<number>;
        qProfileSmoothed: Array<number>;
        qSmoothedX: Array<number>;
        uProfile: Array<number>;
        uProfileSmoothed: Array<number>;
        uSmoothedX: Array<number>;
        piProfile: Array<number>;
        piProfileSmoothed: Array<number>;
        paProfile: Array<number>;
        paProfileSmoothed: Array<number>;
        qProgress: number;
        uProgress: number;
        iProgress: number;
    } {
        if (this.profileStore) {
            let qProfileOriginal = this.profileStore.getProfile(StokesCoordinate.LinearPolarizationQ, statsType);
            let uProfileOriginal = this.profileStore.getProfile(StokesCoordinate.LinearPolarizationU, statsType);

            if (qProfileOriginal && uProfileOriginal && qProfileOriginal.values && uProfileOriginal.values) {
                let qProfileSmoothedValues = this.widgetStore.smoothingStore.getSmoothingValues(this.widgetStore.effectiveFrame.channelValues, qProfileOriginal.values);
                let uProfileSmoothedValues = this.widgetStore.smoothingStore.getSmoothingValues(this.widgetStore.effectiveFrame.channelValues, uProfileOriginal.values);
                let qProfile = [];
                let uProfile = [];
                let piProfile = [];
                let paProfile = [];
                let qProfileSmoothed = [];
                let uProfileSmoothed = [];
                let qSmoothedX = [];
                let uSmoothedX = [];
                let piProfileSmoothed = [];
                let paProfileSmoothed = [];
                qProfile = Array.prototype.slice.call(qProfileOriginal.values);
                uProfile = Array.prototype.slice.call(uProfileOriginal.values);
                piProfile = StokesAnalysisComponent.calculatePI(qProfileOriginal.values, uProfileOriginal.values);
                paProfile = StokesAnalysisComponent.calculatePA(qProfileOriginal.values, uProfileOriginal.values);
                if (this.widgetStore.smoothingStore.type !== SmoothingType.NONE) {
                    qProfileSmoothed = Array.prototype.slice.call(qProfileSmoothedValues.y);
                    uProfileSmoothed = Array.prototype.slice.call(uProfileSmoothedValues.y);
                    qSmoothedX = qProfileSmoothedValues.x;
                    uSmoothedX = uProfileSmoothedValues.x;
                    piProfileSmoothed = StokesAnalysisComponent.calculatePI(qProfileSmoothedValues.y, uProfileSmoothedValues.y);
                    paProfileSmoothed = StokesAnalysisComponent.calculatePA(qProfileSmoothedValues.y, uProfileSmoothedValues.y);
                }
                if (this.widgetStore.fractionalPolVisible) {
                    let iProfileOriginal = this.profileStore.getProfile(StokesCoordinate.TotalIntensity, statsType);
                    if (iProfileOriginal && iProfileOriginal.values) {
                        piProfile = StokesAnalysisComponent.calculateFractionalPol(piProfile, iProfileOriginal.values);
                        qProfile = StokesAnalysisComponent.calculateFractionalPol(qProfile, iProfileOriginal.values);
                        uProfile = StokesAnalysisComponent.calculateFractionalPol(uProfile, iProfileOriginal.values);
                        if (this.widgetStore.smoothingStore.type !== SmoothingType.NONE) {
                            let iProfileSmoothedValues = this.widgetStore.smoothingStore.getSmoothingValues(this.widgetStore.effectiveFrame.channelValues, iProfileOriginal.values);
                            piProfileSmoothed = StokesAnalysisComponent.calculateFractionalPol(piProfileSmoothed, iProfileSmoothedValues.y);
                            qProfileSmoothed = StokesAnalysisComponent.calculateFractionalPol(qProfileSmoothed, iProfileSmoothedValues.y);
                            uProfileSmoothed = StokesAnalysisComponent.calculateFractionalPol(uProfileSmoothed, iProfileSmoothedValues.y);
                        }
                        return {
                            qProfile,
                            qProfileSmoothed,
                            qSmoothedX,
                            uProfile,
                            uProfileSmoothed,
                            uSmoothedX,
                            piProfile,
                            piProfileSmoothed,
                            paProfile,
                            paProfileSmoothed,
                            qProgress: qProfileOriginal.progress,
                            uProgress: uProfileOriginal.progress,
                            iProgress: iProfileOriginal.progress
                        };
                    }
                }
                return {
                    qProfile,
                    qProfileSmoothed,
                    qSmoothedX,
                    uProfile,
                    uProfileSmoothed,
                    uSmoothedX,
                    piProfile,
                    piProfileSmoothed,
                    paProfile,
                    paProfileSmoothed,
                    qProgress: qProfileOriginal.progress,
                    uProgress: uProfileOriginal.progress,
                    iProgress: 1
                };
            }
        }
        return null;
    }

    private getChartAreaWH(chartArea: ChartArea): {width: number; height: number} {
        if (chartArea && chartArea.right && chartArea.bottom) {
            return {width: Math.abs(chartArea.right - chartArea.left), height: Math.abs(chartArea.bottom - chartArea.top)};
        } else {
            return {width: 0, height: 0};
        }
    }

    private resizeScatterData(xMin: number, xMax: number, yMin: number, yMax: number): {xMin: number; xMax: number; yMin: number; yMax: number} {
        if (!this.widgetStore.equalAxes) {
            return {xMin: xMin, xMax: xMax, yMin: yMin, yMax: yMax};
        }
        let xLimit = Math.max(Math.abs(xMin), Math.abs(xMax));
        let yLimit = Math.max(Math.abs(yMin), Math.abs(yMax));
        if (this.widgetStore.scatterChartArea) {
            let currentChartArea = this.getChartAreaWH(this.widgetStore.scatterChartArea);
            if (currentChartArea.width !== 0 && currentChartArea.height !== 0) {
                let ratio = currentChartArea.width / currentChartArea.height;
                if (ratio < 1) {
                    yLimit = yLimit * (1 / ratio);
                }
                if (ratio > 1) {
                    xLimit = xLimit * ratio;
                }
            }
        }
        return {xMin: -xLimit, xMax: xLimit, yMin: -yLimit, yMax: yLimit};
    }

    private calculateXYborder(xValues: Array<number>, yValues: Array<number>, isLinePlots: boolean, type: StokesCoordinate): Border {
        const xBounds = minMaxArray(xValues);
        const yBounds = minMaxArray(yValues);
        let xMin = xBounds.minVal;
        let xMax = xBounds.maxVal;
        let yMin = yBounds.minVal;
        let yMax = yBounds.maxVal;

        if (!this.widgetStore.isLinePlotsAutoScaledX && isLinePlots) {
            const localXMin = clamp(this.widgetStore.sharedMinX, xMin, xMax);
            const localXMax = clamp(this.widgetStore.sharedMaxX, xMin, xMax);
            xMin = localXMin;
            xMax = localXMax;
        }

        if (!this.widgetStore.isQUScatterPlotAutoScaledX && !isLinePlots && type === StokesCoordinate.PolarizationQU) {
            const localXMin = clamp(this.widgetStore.quScatterMinX, xMin, xMax);
            const localXMax = clamp(this.widgetStore.quScatterMaxX, xMin, xMax);
            xMin = localXMin;
            xMax = localXMax;
        }

        if (!this.widgetStore.isQUScatterPlotAutoScaledY && !isLinePlots && type === StokesCoordinate.PolarizationQU) {
            const localYMin = clamp(this.widgetStore.quScatterMinY, yMin, yMax);
            const localYMax = clamp(this.widgetStore.quScatterMaxY, yMin, yMax);
            yMin = localYMin;
            yMax = localYMax;
        }

        if (yMin === Number.MAX_VALUE) {
            yMin = undefined;
            yMax = undefined;
        }

        if (!this.widgetStore.isPolAngleAutoScaledY && isLinePlots && type === StokesCoordinate.PolarizationAngle) {
            const localYMin = clamp(this.widgetStore.polAngleMinY, yMin, yMax);
            const localYMax = clamp(this.widgetStore.polAngleMaxY, yMin, yMax);
            yMin = localYMin;
            yMax = localYMax;
        }
        if (!this.widgetStore.isPolIntensityAutoScaledY && isLinePlots && type === StokesCoordinate.PolarizedIntensity) {
            const localYMin = clamp(this.widgetStore.polIntensityMinY, yMin, yMax);
            const localYMax = clamp(this.widgetStore.polIntensityMaxY, yMin, yMax);
            yMin = localYMin;
            yMax = localYMax;
        }
        if (!this.widgetStore.isQULinePlotAutoScaledY && isLinePlots && (type === StokesCoordinate.LinearPolarizationQ || type === StokesCoordinate.LinearPolarizationU)) {
            const localYMin = clamp(this.widgetStore.quMinY, yMin, yMax);
            const localYMax = clamp(this.widgetStore.quMaxY, yMin, yMax);
            yMin = localYMin;
            yMax = localYMax;
        } else if (isLinePlots) {
            // extend y range a bit gor line plots
            const range = yMax - yMin;
            yMin -= range * VERTICAL_RANGE_PADDING;
            yMax += range * VERTICAL_RANGE_PADDING;
        }
        return {xMin, xMax, yMin, yMax};
    }

    private assembleLinePlotData(
        profile: Array<number>,
        channelValues: Array<number>,
        type: StokesCoordinate
    ): {
        dataset: Array<Point2D>;
        border: Border;
    } {
        if (profile && profile.length && channelValues && profile.length === channelValues.length) {
            let border = this.calculateXYborder(channelValues, profile, true, type);
            let values: Array<{x: number; y: number}> = [];
            for (let i = 0; i < channelValues.length; i++) {
                const x = channelValues[i];
                const y = profile[i];

                if (x < border.xMin || x > border.xMax || y < border.yMin || y > border.yMax) {
                    values.push({x: x, y: NaN});
                } else {
                    values.push({x, y});
                }
            }
            return {dataset: values, border};
        }
        return null;
    }

    private assembleScatterPlotData(
        qProfile: Array<number>,
        uProfile: Array<number>,
        type: StokesCoordinate
    ): {
        dataset: Array<{x: number; y: number; z: number}>;
        border: Border;
    } {
        const frame = this.widgetStore.effectiveFrame;
        if (
            qProfile &&
            qProfile.length &&
            uProfile &&
            uProfile.length &&
            frame.channelValues &&
            frame.channelValues.length &&
            qProfile.length === uProfile.length &&
            (qProfile.length === frame.channelValues.length || this.widgetStore.smoothingStore.type === SmoothingType.BINNING)
        ) {
            const channelValues = frame.channelValues;
            let border = this.calculateXYborder(qProfile, uProfile, false, type);
            let values: Array<{x: number; y: number; z: number}> = [];
            // centered origin and equal scaler
            let equalScalerBorder = this.resizeScatterData(border.xMin, border.xMax, border.yMin, border.yMax);
            this.widgetStore.scatterOutRangePointsZIndex = [];
            for (let i = 0; i < channelValues.length; i++) {
                const x = qProfile[i];
                const y = uProfile[i];
                const z = channelValues[i];
                values.push({x, y, z});

                // update line plot color array
                if (x < border.xMin || x > border.xMax || y < border.yMin || y > border.yMax) {
                    this.widgetStore.scatterOutRangePointsZIndex.push(z);
                }
            }
            return {dataset: values, border: equalScalerBorder};
        }
        return null;
    }

    private compareVariable(a: number, b: number, c: number, d: number): boolean {
        return a === b && a === c && a === d && a !== null;
    }

    private getScatterColor(percentage: number, reversed: boolean): string {
        const colorMap = this.widgetStore.colorPixel.color;
        const mapSize = this.widgetStore.colorPixel.size;
        if (reversed) {
            percentage = 1 - percentage;
        }
        const index = Math.round(percentage * (mapSize - 1)) * 4;
        const opacity = this.widgetStore.pointTransparency ? this.widgetStore.pointTransparency : 1;
        return `rgba(${colorMap[index]}, ${colorMap[index + 1]}, ${colorMap[index + 2]}, ${opacity})`;
    }

    private fillScatterColor(data: Array<{x: number; y: number; z?: number}>, interactionBorder: {xMin: number; xMax: number}, zIndex: boolean): Array<string> {
        let scatterColors = [];
        const widgetStore = this.widgetStore;
        if (data && data.length && zIndex && interactionBorder && widgetStore) {
            let xlinePlotRange = interactionBorder;
            const outOfRangeColor = `hsla(0, 0%, 50%, ${this.opacityOutRange})`;
            const frame = widgetStore.effectiveFrame;
            const reversed = this.getColorMapOrder(frame);
            const localPoints = [];
            for (let index = 0; index < data.length; index++) {
                const point = data[index];
                if (point.z >= xlinePlotRange.xMin && point.z <= xlinePlotRange.xMax) {
                    localPoints.push(point);
                }
            }
            const minMaxZ = minMaxPointArrayZ(localPoints);
            for (let index = 0; index < data.length; index++) {
                const point = data[index];
                let pointColor = this.pointDefaultColor;
                let outRange = true;
                if (point.z >= xlinePlotRange.xMin && point.z <= xlinePlotRange.xMax) {
                    outRange = false;
                }
                let percentage = (point.z - minMaxZ.minVal) / (minMaxZ.maxVal - minMaxZ.minVal);
                if (widgetStore.invertedColorMap) {
                    percentage = 1 - percentage;
                }
                pointColor = outRange ? outOfRangeColor : this.getScatterColor(percentage, reversed);
                scatterColors.push(pointColor);
            }
        }
        return scatterColors;
    }

    private fillLineColor(data: Array<Point2D>, lineColor: string): Array<string> {
        let lineColors = [];
        // n points have n-1 gaps between all points for line plot
        if (this.widgetStore.plotType !== PlotType.POINTS) {
            lineColors.push("");
        }
        if (data && data.length && lineColor) {
            for (let index = 0; index < data.length; index++) {
                const point = data[index];
                if (!(this.widgetStore.scatterOutRangePointsZIndex && this.widgetStore.scatterOutRangePointsZIndex.indexOf(point.x) >= 0)) {
                    lineColors.push(lineColor);
                } else {
                    lineColors.push(this.multicolorLineColorOutRange);
                }
            }
        }
        return lineColors;
    }

    private closestChannel(channel: number, data: Array<{x: number; y: number; z?: number}>): number {
        var mid;
        var lo = 0;
        var hi = data.length - 1;
        while (hi - lo > 1) {
            mid = Math.floor((lo + hi) / 2);
            if (data[mid].z < channel) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        if (channel - data[lo].z <= data[hi].z - channel) {
            return data[lo].z;
        }
        return data[hi].z;
    }

    private getScatterChannel(data: Array<{x: number; y: number; z?: number}>, channel: {channelCurrent: number; channelHovered: number}, zIndex: boolean): {currentChannel: Point3D; hoveredChannel: Point3D} {
        let indicator = {currentChannel: data[0], hoveredChannel: data[0]};
        if (data && data.length && zIndex && channel) {
            let channelCurrent = channel.channelCurrent;
            let channelHovered = channel.channelHovered;
            if (channelCurrent) {
                let close = channelCurrent;
                if (channelHovered) {
                    close = this.closestChannel(channelHovered, data);
                    if (this.channelBorder && this.channelBorder.xMin !== 0) {
                        if (close > this.channelBorder.xMax || close < this.channelBorder.xMin || !this.widgetStore.isMouseMoveIntoLinePlots) {
                            close = channelCurrent;
                        }
                    }
                }
                for (let index = 0; index < data.length; index++) {
                    const points = data[index];
                    if (points.z === close) {
                        indicator.hoveredChannel = points;
                    }
                    if (points.z === channelCurrent) {
                        indicator.currentChannel = points;
                    }
                }
            }
        }
        return indicator;
    }

    @computed get plotData(): {
        qValues: {dataset: Array<Point2D>; border: Border};
        uValues: {dataset: Array<Point2D>; border: Border};
        piValues: {dataset: Array<Point2D>; border: Border};
        paValues: {dataset: Array<Point2D>; border: Border};
        qSmoothedValues: {dataset: Array<Point2D>; border: Border};
        uSmoothedValues: {dataset: Array<Point2D>; border: Border};
        piSmoothedValues: {dataset: Array<Point2D>; border: Border};
        paSmoothedValues: {dataset: Array<Point2D>; border: Border};
        quValues: {dataset: Array<{x: number; y: number; z: number}>; border: Border};
        quSmoothedValues: {dataset: Array<{x: number; y: number; z: number}>; border: Border};
        qProgress: number;
        uProgress: number;
        iProgress: number;
    } {
        const frame = this.widgetStore.effectiveFrame;
        if (!frame) {
            return null;
        }

        let compositeProfile: {
            qProfile: Array<number>;
            uProfile: Array<number>;
            piProfile: Array<number>;
            paProfile: Array<number>;
            qProfileSmoothed: Array<number>;
            uProfileSmoothed: Array<number>;
            qSmoothedX: Array<number>;
            uSmoothedX: Array<number>;
            piProfileSmoothed: Array<number>;
            paProfileSmoothed: Array<number>;
            qProgress: number;
            uProgress: number;
            iProgress: number;
        };
        let regionId = this.widgetStore.effectiveRegionId;
        if (frame.regionSet) {
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);
            if (region) {
                compositeProfile = this.calculateCompositeProfile(region.isClosedRegion ? this.widgetStore.statsType : CARTA.StatsType.Sum);
            }
        }
        let channelInfo = frame.channelInfo;
        if (compositeProfile && channelInfo) {
            let quDic = this.assembleScatterPlotData(compositeProfile.qProfile, compositeProfile.uProfile, StokesCoordinate.PolarizationQU);
            let quSmoothedDic = this.assembleScatterPlotData(compositeProfile.qProfileSmoothed, compositeProfile.uProfileSmoothed, StokesCoordinate.PolarizationQU);
            let piDic = this.assembleLinePlotData(compositeProfile.piProfile, frame.channelValues, StokesCoordinate.PolarizedIntensity);
            let paDic = this.assembleLinePlotData(compositeProfile.paProfile, frame.channelValues, StokesCoordinate.PolarizationAngle);
            let qDic = this.assembleLinePlotData(compositeProfile.qProfile, frame.channelValues, StokesCoordinate.LinearPolarizationQ);
            let uDic = this.assembleLinePlotData(compositeProfile.uProfile, frame.channelValues, StokesCoordinate.LinearPolarizationU);
            let piSmoothedDic = this.assembleLinePlotData(compositeProfile.piProfileSmoothed, compositeProfile.qSmoothedX, StokesCoordinate.PolarizedIntensity);
            let paSmoothedDic = this.assembleLinePlotData(compositeProfile.paProfileSmoothed, compositeProfile.qSmoothedX, StokesCoordinate.PolarizationAngle);
            let qSmoothedDic = this.assembleLinePlotData(compositeProfile.qProfileSmoothed, compositeProfile.qSmoothedX, StokesCoordinate.LinearPolarizationQ);
            let uSmoothedDic = this.assembleLinePlotData(compositeProfile.uProfileSmoothed, compositeProfile.uSmoothedX, StokesCoordinate.LinearPolarizationU);

            return {
                qValues: qDic,
                uValues: uDic,
                piValues: piDic,
                paValues: paDic,
                qSmoothedValues: qSmoothedDic,
                uSmoothedValues: uSmoothedDic,
                piSmoothedValues: piSmoothedDic,
                paSmoothedValues: paSmoothedDic,
                quValues: quDic,
                quSmoothedValues: quSmoothedDic,
                qProgress: compositeProfile.qProgress,
                uProgress: compositeProfile.uProgress,
                iProgress: compositeProfile.iProgress
            };
        }
        return null;
    }

    private fillProfilerDataInLinePlots = (
        quDataset: readonly Point3D[],
        piDataset: readonly Point2D[],
        paDataset: readonly Point2D[],
        lineCursorProfiler: number,
        profilerData: {q: number; u: number; pi: number; pa: number; channel: number}
    ) => {
        const piNearest = binarySearchByX(piDataset, lineCursorProfiler);
        const paNearest = binarySearchByX(paDataset, lineCursorProfiler);
        if (piNearest && piNearest.point && paNearest && paNearest.point) {
            const cursor = this.matchXYindex(piNearest.point.x, quDataset);
            profilerData.q = cursor.x;
            profilerData.u = cursor.y;
            profilerData.channel = cursor.z;
            profilerData.pi = piNearest.point.y;
            profilerData.pa = paNearest.point.y;
        }
    };

    private fillProfilerDataInScatterPlots = (
        quDataset: readonly Point3D[],
        piDataset: readonly Point2D[],
        paDataset: readonly Point2D[],
        scatterCursorProfiler: Point3D,
        profilerData: {q: number; u: number; pi: number; pa: number; channel: number}
    ) => {
        const minIndex = closestPointIndexToCursor(scatterCursorProfiler, quDataset);
        if (minIndex >= 0) {
            const currentScatterData = quDataset[minIndex];
            if (currentScatterData) {
                const piNearest = binarySearchByX(piDataset, currentScatterData.z);
                const paNearest = binarySearchByX(paDataset, currentScatterData.z);
                profilerData.q = currentScatterData.x;
                profilerData.u = currentScatterData.y;
                if (piNearest && piNearest.point && paNearest && paNearest.point) {
                    profilerData.channel = piNearest.point.x;
                    profilerData.pi = piNearest.point.y;
                    profilerData.pa = paNearest.point.y;
                }
            }
        }
    };

    private getCursorInfo = (quDataset: readonly Point3D[], piDataset: readonly Point2D[], paDataset: readonly Point2D[], scatterCursorProfiler: Point3D, lineCursorProfiler: number, scatterCursorImage: Point3D, lineCursorImage: number) => {
        let cursorInfo = null;
        const isMouseEntered = this.widgetStore.isMouseMoveIntoLinePlots || this.widgetStore.isMouseMoveIntoScatterPlots;
        const xUnit = this.widgetStore.effectiveFrame ? this.widgetStore.effectiveFrame.spectralUnitStr : "Channel";
        if (isMouseEntered) {
            let profilerData = {q: NaN, u: NaN, pi: NaN, pa: NaN, channel: NaN};
            if (this.widgetStore.isMouseMoveIntoLinePlots) {
                this.fillProfilerDataInLinePlots(quDataset, piDataset, paDataset, lineCursorProfiler, profilerData);
            }
            if (this.widgetStore.isMouseMoveIntoScatterPlots) {
                this.fillProfilerDataInScatterPlots(quDataset, piDataset, paDataset, scatterCursorProfiler, profilerData);
            }
            cursorInfo = {
                isMouseEntered: isMouseEntered,
                quValue: {x: profilerData.q, y: profilerData.u},
                channel: profilerData.channel,
                pi: profilerData.pi,
                pa: profilerData.pa,
                xUnit: xUnit
            };
        } else {
            const piNearest = binarySearchByX(piDataset, lineCursorImage);
            const paNearest = binarySearchByX(paDataset, lineCursorImage);
            cursorInfo = {
                isMouseEntered: isMouseEntered,
                quValue: {x: scatterCursorImage ? scatterCursorImage.x : NaN, y: scatterCursorImage ? scatterCursorImage.y : NaN},
                channel: lineCursorImage,
                pi: piNearest && piNearest.point ? piNearest.point.y : NaN,
                pa: paNearest && paNearest.point ? paNearest.point.y : NaN,
                xUnit: xUnit
            };
        }
        return cursorInfo;
    };

    private genProfilerInfo = (): string[] => {
        let profilerInfo: string[] = [];
        if (!this.cursorInfo || this.cursorInfo.quValue.x === null || this.cursorInfo.quValue.y === null || isNaN(this.cursorInfo.quValue.x) || isNaN(this.cursorInfo.quValue.y)) {
            return profilerInfo;
        }
        const frame = this.widgetStore.effectiveFrame;
        if (frame && this.plotData) {
            const xLabel = this.cursorInfo.xUnit === "Channel" ? "Channel " + toFixed(this.cursorInfo.channel) : formattedNotation(this.cursorInfo.channel) + " " + this.cursorInfo.xUnit;
            const fractionalPol = this.widgetStore.fractionalPolVisible;
            const qLabel = fractionalPol ? ", Q/I: " : ", Q: ";
            const uLabel = fractionalPol ? ", U/I: " : ", U: ";
            const piLabel = fractionalPol ? ", PI/I: " : ", PI: ";
            const cursorString =
                "(" + xLabel + qLabel + toExponential(this.cursorInfo.quValue.x, 2) + uLabel + toExponential(this.cursorInfo.quValue.y, 2) + piLabel + toExponential(this.cursorInfo.pi, 2) + ", PA: " + toFixed(this.cursorInfo.pa, 2) + ")";
            profilerInfo.push(`${this.cursorInfo.isMouseEntered ? "Cursor:" : "Data:"} ${cursorString}`);
        }
        return profilerInfo;
    };

    render() {
        const appStore = AppStore.Instance;
        if (!this.widgetStore) {
            return <NonIdealState icon={"error"} title={"Missing profile"} description={"Profile not found"} />;
        }
        const frame = this.widgetStore.effectiveFrame;
        const imageName = this.widgetStore.effectiveFrame ? this.widgetStore.effectiveFrame.filename : undefined;
        let quLinePlotProps: LinePlotComponentProps = {
            xLabel: "Channel",
            yLabel: "Value",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "quLine",
            tickTypeY: TickType.Scientific,
            showXAxisTicks: false,
            showXAxisLabel: false,
            showLegend: true,
            xTickMarkLength: 0,
            graphCursorMoved: this.onGraphCursorMoved,
            isGroupSubPlot: true,
            scrollZoom: true,
            graphZoomedX: this.widgetStore.setSharedXBounds,
            graphZoomedY: this.widgetStore.setQULinePlotYBounds,
            graphZoomedXY: this.widgetStore.setQULinePlotsXYBounds,
            graphZoomReset: this.widgetStore.clearLinePlotsXYBounds,
            graphClicked: this.onChannelChanged,
            markers: [],
            mouseEntered: this.widgetStore.setMouseMoveIntoLinePlots,
            multiColorMultiLinesColors: new Map(),
            // settings
            plotType: this.widgetStore.plotType,
            borderWidth: this.widgetStore.lineWidth,
            pointRadius: this.widgetStore.linePlotPointSize,
            multiPlotPropsMap: new Map<string, MultiPlotProps>()
        };

        let piLinePlotProps: LinePlotComponentProps = {
            xLabel: "Channel",
            yLabel: "Value",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "piLine",
            tickTypeY: TickType.Scientific,
            showXAxisTicks: false,
            showXAxisLabel: false,
            xTickMarkLength: 0,
            graphCursorMoved: this.onGraphCursorMoved,
            isGroupSubPlot: true,
            scrollZoom: true,
            graphZoomedX: this.widgetStore.setSharedXBounds,
            graphZoomedY: this.widgetStore.setPolIntensityYBounds,
            graphZoomedXY: this.widgetStore.setPolIntensityXYBounds,
            graphZoomReset: this.widgetStore.clearLinePlotsXYBounds,
            graphClicked: this.onChannelChanged,
            markers: [],
            mouseEntered: this.widgetStore.setMouseMoveIntoLinePlots,
            // settings
            plotType: this.widgetStore.plotType,
            borderWidth: this.widgetStore.lineWidth,
            pointRadius: this.widgetStore.linePlotPointSize,
            multiPlotPropsMap: new Map<string, MultiPlotProps>(),
            order: 1
        };

        let paLinePlotProps: LinePlotComponentProps = {
            xLabel: "Channel",
            yLabel: "Value",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "paLine",
            tickTypeY: TickType.Integer,
            showXAxisTicks: true,
            showXAxisLabel: true,
            graphCursorMoved: this.onGraphCursorMoved,
            isGroupSubPlot: true,
            scrollZoom: true,
            graphZoomedX: this.widgetStore.setSharedXBounds,
            graphZoomedY: this.widgetStore.setPolAngleYBounds,
            graphZoomedXY: this.widgetStore.setPolAngleXYBounds,
            graphZoomReset: this.widgetStore.clearLinePlotsXYBounds,
            graphClicked: this.onChannelChanged,
            markers: [],
            mouseEntered: this.widgetStore.setMouseMoveIntoLinePlots,
            // settings
            plotType: this.widgetStore.plotType,
            borderWidth: this.widgetStore.lineWidth,
            pointRadius: this.widgetStore.linePlotPointSize,
            multiPlotPropsMap: new Map<string, MultiPlotProps>(),
            order: 1
        };

        let quScatterPlotProps: ScatterPlotComponentProps = {
            xLabel: "Channel",
            yLabel: "Channel",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "quScatter",
            tickTypeX: TickType.Scientific,
            tickTypeY: TickType.Scientific,
            showXAxisTicks: true,
            showXAxisLabel: true,
            plotType: PlotType.POINTS,
            zeroLineWidth: 2,
            isGroupSubPlot: true,
            colorRangeEnd: 240,
            zIndex: true,
            graphCursorMoved: this.onScatterGraphCursorMoved,
            graphClicked: this.onScatterChannelChanged,
            graphZoomReset: this.widgetStore.clearScatterPlotXYBounds,
            mouseEntered: this.widgetStore.setMouseMoveIntoScatterPlots,
            scrollZoom: true,
            graphZoomedXY: this.widgetStore.setQUScatterPlotXYBounds,
            updateChartArea: this.widgetStore.setScatterChartAres,
            // settings
            pointRadius: this.widgetStore.scatterPlotPointSize
        };

        let className = "profile-container-" + StokesAnalysisComponent.calculateLayout(this.width, this.height);
        let interactionBorder = {xMin: 0, xMax: 0};
        if (this.profileStore && frame) {
            const cursorX = {
                profiler: this.widgetStore.linePlotcursorX,
                image: this.currentChannelValue,
                unit: frame.spectralUnitStr
            };
            const currentPlotData = this.plotData;
            let channel = {channelCurrent: 0, channelHovered: 0};
            if (currentPlotData && currentPlotData.piValues && currentPlotData.paValues && currentPlotData.qValues && currentPlotData.uValues && currentPlotData.quValues) {
                piLinePlotProps.data = currentPlotData.piValues.dataset;
                paLinePlotProps.data = currentPlotData.paValues.dataset;
                quScatterPlotProps.data = this.widgetStore.smoothingStore.type === SmoothingType.NONE ? currentPlotData.quValues.dataset : currentPlotData.quSmoothedValues.dataset;

                const lineOpacity = this.minProgress < 1.0 ? 0.15 + this.minProgress / 4.0 : 1.0;
                quLinePlotProps.opacity = lineOpacity;
                piLinePlotProps.opacity = lineOpacity;
                paLinePlotProps.opacity = lineOpacity;
                quLinePlotProps.opacity = lineOpacity;

                let primaryLineColor = getColorForTheme(this.widgetStore.primaryLineColor);
                let ulinePlotColor = getColorForTheme(this.widgetStore.secondaryLineColor);
                if (appStore.darkTheme) {
                    if (!this.widgetStore.primaryLineColor.fixed) {
                        primaryLineColor = Colors.BLUE4;
                    }
                    if (!this.widgetStore.secondaryLineColor.fixed) {
                        ulinePlotColor = Colors.ORANGE4;
                    }
                }
                piLinePlotProps.lineColor = primaryLineColor;
                paLinePlotProps.lineColor = primaryLineColor;

                let qPlotProps: MultiPlotProps = {
                    imageName: imageName,
                    plotName: "q",
                    data: currentPlotData.qValues.dataset,
                    type: this.widgetStore.plotType,
                    borderColor: primaryLineColor,
                    order: 1,
                    comments: [StokesCoordinate.LinearPolarizationQ]
                };
                let uPlotProps: MultiPlotProps = {
                    imageName: imageName,
                    plotName: "u",
                    data: currentPlotData.uValues.dataset,
                    type: this.widgetStore.plotType,
                    borderColor: ulinePlotColor,
                    order: 1,
                    comments: [StokesCoordinate.LinearPolarizationU]
                };
                quLinePlotProps.multiPlotPropsMap.set(StokesCoordinate.LinearPolarizationQ, qPlotProps);
                quLinePlotProps.multiPlotPropsMap.set(StokesCoordinate.LinearPolarizationU, uPlotProps);

                const smoothingStore = this.widgetStore.smoothingStore;
                if (smoothingStore.type !== SmoothingType.NONE && currentPlotData.qSmoothedValues && currentPlotData.uSmoothedValues && currentPlotData.piSmoothedValues && currentPlotData.piSmoothedValues) {
                    let smoothedQPlotProps: MultiPlotProps = {
                        imageName: imageName,
                        plotName: "q-smoothed",
                        data: currentPlotData.qSmoothedValues.dataset,
                        type: smoothingStore.lineType,
                        borderColor: primaryLineColor,
                        borderWidth: this.widgetStore.lineWidth + 1,
                        pointRadius: this.widgetStore.linePlotPointSize + 1
                    };
                    let smoothedUPlotProps: MultiPlotProps = {
                        imageName: imageName,
                        plotName: "u-smoothed",
                        data: currentPlotData.uSmoothedValues.dataset,
                        type: smoothingStore.lineType,
                        borderColor: ulinePlotColor,
                        borderWidth: this.widgetStore.lineWidth + 1,
                        pointRadius: this.widgetStore.linePlotPointSize + 1
                    };
                    let smoothedPiPlotProps: MultiPlotProps = {
                        imageName: imageName,
                        plotName: "pi-smoothed",
                        data: currentPlotData.piSmoothedValues.dataset,
                        type: smoothingStore.lineType,
                        borderColor: primaryLineColor,
                        borderWidth: this.widgetStore.lineWidth + 1,
                        pointRadius: this.widgetStore.linePlotPointSize + 1
                    };
                    let smoothedPaPlotProps: MultiPlotProps = {
                        imageName: imageName,
                        plotName: "pa-smoothed",
                        data: currentPlotData.paSmoothedValues.dataset,
                        type: smoothingStore.lineType,
                        borderColor: getColorForTheme(smoothingStore.colorMap.get(StokesCoordinate.PolarizationAngle) ? getColorForTheme(smoothingStore.colorMap.get(StokesCoordinate.PolarizationAngle)) : primaryLineColor),
                        borderWidth: this.widgetStore.lineWidth + 1,
                        pointRadius: this.widgetStore.linePlotPointSize + 1
                    };
                    quLinePlotProps.multiPlotPropsMap.set(StokesCoordinate.LinearPolarizationQ + "_smoothed", smoothedQPlotProps);
                    quLinePlotProps.multiPlotPropsMap.set(StokesCoordinate.LinearPolarizationU + "_smoothed", smoothedUPlotProps);
                    piLinePlotProps.multiPlotPropsMap.set("smoothed", smoothedPiPlotProps);
                    paLinePlotProps.multiPlotPropsMap.set("smoothed", smoothedPaPlotProps);
                }

                const loadData = currentPlotData.qProgress === 1 && currentPlotData.uProgress === 1 && currentPlotData.iProgress === 1;
                let qlinePlotWithInteractionColor;
                let ulinePlotWithInteractionColor;
                if (smoothingStore.type !== SmoothingType.NONE && !smoothingStore.isOverlayOn) {
                    qlinePlotWithInteractionColor = loadData ? this.fillLineColor(currentPlotData.qValues.dataset, "#00000000") : [];
                    ulinePlotWithInteractionColor = loadData ? this.fillLineColor(currentPlotData.uValues.dataset, "#00000000") : [];
                    piLinePlotProps.multiColorSingleLineColors = loadData ? this.fillLineColor(currentPlotData.piValues.dataset, "#00000000") : [];
                    paLinePlotProps.multiColorSingleLineColors = loadData ? this.fillLineColor(currentPlotData.paValues.dataset, "#00000000") : [];
                } else {
                    qlinePlotWithInteractionColor = loadData ? this.fillLineColor(currentPlotData.qValues.dataset, primaryLineColor) : [];
                    ulinePlotWithInteractionColor = loadData ? this.fillLineColor(currentPlotData.uValues.dataset, ulinePlotColor) : [];
                    piLinePlotProps.multiColorSingleLineColors = loadData ? this.fillLineColor(currentPlotData.piValues.dataset, primaryLineColor) : [];
                    paLinePlotProps.multiColorSingleLineColors = loadData ? this.fillLineColor(currentPlotData.paValues.dataset, primaryLineColor) : [];
                }
                quLinePlotProps.multiColorMultiLinesColors.set(StokesCoordinate.LinearPolarizationQ, qlinePlotWithInteractionColor);
                quLinePlotProps.multiColorMultiLinesColors.set(StokesCoordinate.LinearPolarizationU, ulinePlotWithInteractionColor);

                let qBorder = currentPlotData.qValues.border;
                let uBorder = currentPlotData.uValues.border;
                let piBorder = currentPlotData.piValues.border;
                let paBorder = currentPlotData.paValues.border;
                let quBorder = currentPlotData.quValues.border;

                if (this.compareVariable(qBorder.xMin, uBorder.xMin, piBorder.xMin, paBorder.xMin) && this.compareVariable(qBorder.xMax, uBorder.xMax, piBorder.xMax, paBorder.xMax)) {
                    interactionBorder = {xMin: paBorder.xMin, xMax: paBorder.xMax};
                    this.channelBorder = {xMin: paBorder.xMin, xMax: paBorder.xMax};
                    if (this.widgetStore.isLinePlotsAutoScaledX) {
                        quLinePlotProps.xMin = qBorder.xMin;
                        quLinePlotProps.xMax = qBorder.xMax;
                        piLinePlotProps.xMin = piBorder.xMin;
                        piLinePlotProps.xMax = piBorder.xMax;
                        paLinePlotProps.xMin = paBorder.xMin;
                        paLinePlotProps.xMax = paBorder.xMax;
                    } else {
                        quLinePlotProps.xMin = this.widgetStore.sharedMinX;
                        quLinePlotProps.xMax = this.widgetStore.sharedMaxX;
                        piLinePlotProps.xMin = this.widgetStore.sharedMinX;
                        piLinePlotProps.xMax = this.widgetStore.sharedMaxX;
                        paLinePlotProps.xMin = this.widgetStore.sharedMinX;
                        paLinePlotProps.xMax = this.widgetStore.sharedMaxX;
                        interactionBorder = {xMin: this.widgetStore.sharedMinX, xMax: this.widgetStore.sharedMaxX};
                    }
                    let dataBackgroundColor = this.fillScatterColor(quScatterPlotProps.data, interactionBorder, true);
                    quScatterPlotProps.dataBackgroundColor = dataBackgroundColor;

                    if (this.widgetStore.isQULinePlotAutoScaledY) {
                        quLinePlotProps.yMin = qBorder.yMin < uBorder.yMin ? qBorder.yMin : uBorder.yMin;
                        quLinePlotProps.yMax = qBorder.yMax > uBorder.yMax ? qBorder.yMax : uBorder.yMax;
                    } else {
                        quLinePlotProps.yMin = this.widgetStore.quMinY;
                        quLinePlotProps.yMax = this.widgetStore.quMaxY;
                    }

                    if (this.widgetStore.isPolIntensityAutoScaledY) {
                        piLinePlotProps.yMin = piBorder.yMin;
                        piLinePlotProps.yMax = piBorder.yMax;
                    } else {
                        piLinePlotProps.yMin = this.widgetStore.polIntensityMinY;
                        piLinePlotProps.yMax = this.widgetStore.polIntensityMaxY;
                    }

                    if (this.widgetStore.isPolAngleAutoScaledY) {
                        paLinePlotProps.yMin = paBorder.yMin;
                        paLinePlotProps.yMax = paBorder.yMax;
                    } else {
                        paLinePlotProps.yMin = this.widgetStore.polAngleMinY;
                        paLinePlotProps.yMax = this.widgetStore.polAngleMaxY;
                    }
                }

                if (this.widgetStore.isQUScatterPlotAutoScaledX) {
                    quScatterPlotProps.xMin = quBorder.xMin;
                    quScatterPlotProps.xMax = quBorder.xMax;
                } else {
                    quScatterPlotProps.xMin = this.widgetStore.quScatterMinX;
                    quScatterPlotProps.xMax = this.widgetStore.quScatterMaxX;
                }
                if (this.widgetStore.isQUScatterPlotAutoScaledY) {
                    quScatterPlotProps.yMin = quBorder.yMin;
                    quScatterPlotProps.yMax = quBorder.yMax;
                } else {
                    quScatterPlotProps.yMin = this.widgetStore.quScatterMinY;
                    quScatterPlotProps.yMax = this.widgetStore.quScatterMaxY;
                }
                let scatterCursorInfor = {
                    profiler: {x: this.widgetStore.scatterPlotCursorX, y: this.widgetStore.scatterPlotCursorY},
                    image: this.matchXYindex(cursorX.image, quScatterPlotProps.data),
                    unit: frame.spectralUnitStr
                };
                quScatterPlotProps.cursorXY = scatterCursorInfor;
                this.cursorInfo = this.getCursorInfo(
                    quScatterPlotProps.data,
                    this.widgetStore.smoothingStore.type === SmoothingType.NONE ? currentPlotData.piValues.dataset : currentPlotData.piSmoothedValues.dataset,
                    this.widgetStore.smoothingStore.type === SmoothingType.NONE ? currentPlotData.paValues.dataset : currentPlotData.paSmoothedValues.dataset,
                    scatterCursorInfor.profiler,
                    cursorX.profiler,
                    scatterCursorInfor.image,
                    cursorX.image
                );
                if (this.cursorInfo && this.cursorInfo.quValue) {
                    quScatterPlotProps.cursorNearestPoint = this.cursorInfo.quValue;
                }
            }

            paLinePlotProps.yLabel = "PA (Degrees)";
            if (this.widgetStore.fractionalPolVisible) {
                quLinePlotProps.yLabel = "Value (%)";
                piLinePlotProps.yLabel = "PI/I (%)";
                quScatterPlotProps.xLabel = "Q/I (%)";
                quScatterPlotProps.yLabel = "U/I (%)";
            } else {
                quLinePlotProps.yLabel = "Value (" + frame.headerUnit + ")";
                piLinePlotProps.yLabel = "PI (" + frame.headerUnit + ")";
                quScatterPlotProps.xLabel = "Stokes Q (" + frame.headerUnit + ")";
                quScatterPlotProps.yLabel = "Stokes U (" + frame.headerUnit + ")";
            }

            if (frame.spectralAxis && !frame.isCoordChannel) {
                paLinePlotProps.xLabel = piLinePlotProps.xLabel = quLinePlotProps.xLabel = frame.spectralLabel;
            }

            paLinePlotProps.markers = [];
            piLinePlotProps.markers = [];
            quLinePlotProps.markers = [];

            if (this.cursorInfo && this.cursorInfo.channel && this.widgetStore.isMouseMoveIntoScatterPlots) {
                let lineCursorIndicator = {
                    value: this.cursorInfo.channel,
                    id: "marker-profiler-cursor-stokes2",
                    draggable: false,
                    horizontal: false,
                    color: appStore.darkTheme ? Colors.GRAY4 : Colors.GRAY2,
                    opacity: 0.8,
                    isMouseMove: !this.widgetStore.isMouseMoveIntoLinePlots,
                    interactionMarker: true
                };
                paLinePlotProps.markers.push(lineCursorIndicator);
                piLinePlotProps.markers.push(lineCursorIndicator);
                quLinePlotProps.markers.push(lineCursorIndicator);
            }

            if (cursorX.profiler !== null) {
                let cursor = {
                    value: cursorX.profiler,
                    id: "marker-profiler-cursor-stokes",
                    draggable: false,
                    horizontal: false,
                    color: appStore.darkTheme ? Colors.GRAY4 : Colors.GRAY2,
                    opacity: 0.8,
                    isMouseMove: !this.widgetStore.isMouseMoveIntoLinePlots
                };
                paLinePlotProps.markers.push(cursor);
                piLinePlotProps.markers.push(cursor);
                quLinePlotProps.markers.push(cursor);
                if (cursor && cursor.value && typeof cursor.value !== undefined) {
                    channel.channelHovered = cursor.value;
                }
            }

            if (cursorX.image !== null) {
                let channelCurrent = {
                    value: cursorX.image,
                    id: "marker-channel-current",
                    opacity: 0.4,
                    draggable: false,
                    horizontal: false
                };
                let channelRequired = {
                    value: this.requiredChannelValue,
                    id: "marker-channel-required",
                    draggable: !AnimatorStore.Instance.animationActive,
                    dragMove: this.onChannelChanged,
                    horizontal: false
                };
                paLinePlotProps.markers.push(channelCurrent, channelRequired);
                piLinePlotProps.markers.push(channelCurrent, channelRequired);
                quLinePlotProps.markers.push(channelCurrent, channelRequired);

                if (channelCurrent && channelCurrent.value && typeof channelCurrent.value !== undefined) {
                    channel.channelCurrent = channelCurrent.value;
                }
            }

            if (quScatterPlotProps.data && quScatterPlotProps.data.length && interactionBorder) {
                const scatterChannelInteraction = this.getScatterChannel(quScatterPlotProps.data, channel, true);
                quScatterPlotProps.indicatorInteractionChannel = {
                    currentChannel: scatterChannelInteraction.currentChannel,
                    hoveredChannel: scatterChannelInteraction.hoveredChannel,
                    start: this.widgetStore.isMouseMoveIntoLinePlots
                };
            }

            paLinePlotProps.comments = this.exportHeaders;
            piLinePlotProps.comments = this.exportHeaders;
            quLinePlotProps.comments = this.exportHeaders;
            quScatterPlotProps.comments = this.exportQUScatterHeaders;
        }

        return (
            <div className={"stokes-widget"}>
                <div className={className}>
                    <div className="profile-plot-toolbar">
                        <StokesAnalysisToolbarComponent widgetStore={this.widgetStore} id={this.props.id} />
                    </div>
                    <div className="profile-plot-qup">
                        <div className="profile-plot-qu">
                            <LinePlotComponent {...quLinePlotProps} />
                        </div>
                        <div className="profile-plot-pi">
                            <LinePlotComponent {...piLinePlotProps} />
                        </div>
                        <div className="profile-plot-pa">
                            <LinePlotComponent {...paLinePlotProps} />
                        </div>
                    </div>
                    <div className="profile-plot-qvsu">
                        <ScatterPlotComponent {...quScatterPlotProps} />
                    </div>
                    <ProfilerInfoComponent info={this.genProfilerInfo()} />
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}></ReactResizeDetector>
            </div>
        );
    }
}
