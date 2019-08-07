import * as React from "react";
import * as _ from "lodash";
import {autorun, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Colors, NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {LinePlotComponent, LinePlotComponentProps, ScatterPlotComponent, VERTICAL_RANGE_PADDING} from "components/Shared";
import {StokesAnalysisToolbarComponent} from "./StokesAnalysisToolbarComponent/StokesAnalysisToolbarComponent";
import {WidgetConfig, WidgetProps, SpectralProfileStore, AnimationState} from "stores";
import {StokesAnalysisWidgetStore, StokesCoordinate} from "stores/widgets";
import {Point2D, ChannelInfo} from "models";
import {clamp, pi, pa, normalising} from "utilities";
import "./StokesAnalysisComponent.css";

@observer
export class StokesAnalysisComponent extends React.Component<WidgetProps> {
    private static layoutRatioCutoffs = {
        vertical: 0.5,
        horizontal: 2,
    };

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "stokes",
            type: "stokes",
            minWidth: 300,
            minHeight: 390,
            defaultWidth: 600,
            defaultHeight: 800,
            title: "Stokes Analysis",
            isCloseable: true
        };
    }

    @observable width: number;
    @observable height: number;

    @computed get widgetStore(): StokesAnalysisWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.stokesAnalysisWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.stokesAnalysisWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new StokesAnalysisWidgetStore();
    }

    @computed get profileStore(): SpectralProfileStore {
        if (this.props.appStore && this.props.appStore.activeFrame) {
            let fileId = this.props.appStore.activeFrame.frameInfo.fileId;
            const regionId = this.widgetStore.regionIdMap.get(fileId) || 0;
            const frameMap = this.props.appStore.spectralProfiles.get(fileId);
            if (frameMap) {
                return frameMap.get(regionId);
            }
        }
        return null;
    }

    @computed get exportHeaders(): string[] {
        let headerString = [];
        const frame = this.props.appStore.activeFrame;
        if (frame && frame.frameInfo && frame.regionSet) {
            const regionId = this.widgetStore.regionIdMap.get(frame.frameInfo.fileId) || 0;
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);

            if (region) {
                headerString.push(region.regionProperties);
            }
        }
        return headerString;
    }

    @computed get matchesSelectedRegion() {
        const appStore = this.props.appStore;
        const frame = appStore.activeFrame;
        if (frame) {
            const widgetRegion = this.widgetStore.regionIdMap.get(frame.frameInfo.fileId);
            if (frame.regionSet.selectedRegion && frame.regionSet.selectedRegion.regionId !== 0) {
                return widgetRegion === frame.regionSet.selectedRegion.regionId;
            }
        }
        return false;
    }

    constructor(props: WidgetProps) {
        super(props);
        if (!props.docked && props.id === StokesAnalysisComponent.WIDGET_CONFIG.type) {
            const id = props.appStore.widgetsStore.addStokesWidget();
            props.appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!this.props.appStore.widgetsStore.stokesAnalysisWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                this.props.appStore.widgetsStore.stokesAnalysisWidgets.set(this.props.id, new StokesAnalysisWidgetStore());
            }
        }

        autorun(() => {
            if (this.widgetStore) {
                const appStore = this.props.appStore;
                const frame = appStore.activeFrame;
                let progressString = "";
                const currentData = this.plotData;
                if (currentData && isFinite(currentData.qProgress) && isFinite(currentData.uProgress)) {
                    let minProgress = Math.min(currentData.qProgress, currentData.uProgress);
                    if (minProgress < 1) {
                        progressString = `[${(minProgress * 100).toFixed(0)}% complete]`;
                    }
                }
                if (frame) {
                    const regionId = this.widgetStore.regionIdMap.get(frame.frameInfo.fileId) || 0;
                    const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
                    const selectedString = this.matchesSelectedRegion ? "(Selected)" : "";
                    this.props.appStore.widgetsStore.setWidgetTitle(this.props.id, `Stokes Analysis : ${regionString} ${selectedString} ${progressString}`);
                }
            } else {
                this.props.appStore.widgetsStore.setWidgetTitle(this.props.id, `Stokes Analysis: Cursor`);
            }
        });
    }

    onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    private getChannelLabel = (): string => {
        const frame = this.props.appStore.activeFrame;
        if (this.widgetStore.useWcsValues && frame.channelInfo) {
            const channelInfo = frame.channelInfo;
            let channelLabel = channelInfo.channelType.name;
            if (channelInfo.channelType.unit && channelInfo.channelType.unit.length) {
                channelLabel += ` (${channelInfo.channelType.unit})`;
            }
            return channelLabel;
        }
        return null;
    };

    private getChannelUnit = (): string => {
        const frame = this.props.appStore.activeFrame;
        if (this.widgetStore.useWcsValues && frame.channelInfo && frame.channelInfo.channelType.unit) {
            return frame.channelInfo.channelType.unit;
        }
        return "Channel";
    };

    private getRequiredChannelValue = (): number => {
        const frame = this.props.appStore.activeFrame;
        if (frame) {
            const channel = frame.requiredChannel;
            if (this.widgetStore.useWcsValues && frame.channelInfo &&
                channel >= 0 && channel < frame.channelInfo.values.length) {
                return frame.channelInfo.values[channel];
            }
            return channel;
        }
        return null;
    };

    onChannelChanged = (x: number) => {
        const frame = this.props.appStore.activeFrame;
        if (this.props.appStore.animatorStore.animationState === AnimationState.PLAYING) {
            return;
        }

        if (frame && frame.channelInfo) {
            let channelInfo = frame.channelInfo;
            let nearestIndex = (this.widgetStore.useWcsValues && channelInfo.getChannelIndexWCS) ?
                channelInfo.getChannelIndexWCS(x) :
                channelInfo.getChannelIndexSimple(x);
            if (nearestIndex !== null && nearestIndex !== undefined) {
                frame.setChannels(nearestIndex, frame.requiredStokes);
            }
        }
    };

    private getCurrentChannelValue = (): number => {
        const frame = this.props.appStore.activeFrame;
        if (frame) {
            const channel = frame.channel;
            if (this.widgetStore.useWcsValues && frame.channelInfo &&
                channel >= 0 && channel < frame.channelInfo.values.length) {
                return frame.channelInfo.values[channel];
            }
            return channel;
        }
        return null;
    };

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

    onGraphCursorMoved = _.throttle((x) => {
        this.widgetStore.setCursor(x);
    }, 33);

    private static calculatePA(qData: Float32Array | Float64Array, uData: Float32Array | Float64Array): Array<number> {
        let vals = [];
        if (qData && uData && qData.length === uData.length) {
            for (let i = 0; i < qData.length; i++) {
                vals[i] = pa(qData[i], uData[i]);
            }
        }
        return vals;
    }

    private static calculatePI(qData: Float32Array | Float64Array, uData: Float32Array | Float64Array): Array<number> {
        let vals = [];
        if (qData && uData && qData.length === uData.length) {
            for (let i = 0; i < qData.length; i++) {
                vals[i] = pi(qData[i], uData[i]);
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

    private calculateCompositeProfile(statsType: CARTA.StatsType): { qProfile: Array<number>, uProfile: Array<number>, piProfile: Array<number>, paProfile: Array<number>, qProgress: number, uProgress: number } {
        if (this.profileStore) {
            let qProfileOriginal = this.profileStore.getProfile(StokesCoordinate.LinearPolarizationQ, statsType);
            let uProfileOriginal = this.profileStore.getProfile(StokesCoordinate.LinearPolarizationU, statsType);
            let piProfile = [];
            let paProfile = [];
            let qProfile = [];
            let uProfile = [];

            if (qProfileOriginal && uProfileOriginal && qProfileOriginal.values && uProfileOriginal.values) {
                qProfile = Array.prototype.slice.call(qProfileOriginal.values);
                uProfile = Array.prototype.slice.call(uProfileOriginal.values);
                piProfile = StokesAnalysisComponent.calculatePI(qProfileOriginal.values, uProfileOriginal.values);
                paProfile = StokesAnalysisComponent.calculatePA(qProfileOriginal.values, uProfileOriginal.values);

                if (this.widgetStore.fractionalPolVisible) {
                    let iProfileOriginal = this.profileStore.getProfile(StokesCoordinate.TotalIntensity, statsType);
                    if (iProfileOriginal && iProfileOriginal.values) {
                        piProfile = StokesAnalysisComponent.calculateFractionalPol(piProfile, iProfileOriginal.values);
                        qProfile = StokesAnalysisComponent.calculateFractionalPol(qProfile, iProfileOriginal.values);
                        uProfile = StokesAnalysisComponent.calculateFractionalPol(uProfile, iProfileOriginal.values);
                    }
                }
                return {qProfile, uProfile, piProfile, paProfile, qProgress: qProfileOriginal.progress, uProgress: uProfileOriginal.progress};
            }
        }
        return null;
    }

    private assambleXYData(profileVals: Array<number>, channelValues: Array<number>, xMin: number, xMax: number): Array<{ x: number, y: number }> {
        let values: Array<{ x: number, y: number }> = [];
        if (profileVals) {
            let isIncremental = channelValues[0] <= channelValues[channelValues.length - 1] ? true : false;
            for (let i = 0; i < channelValues.length; i++) {
                let index = isIncremental ? i : channelValues.length - 1 - i;
                const x = channelValues[index];
                const y = profileVals[index];

                if (x < xMin || x > xMax) {
                    if (values.length) {
                        break;
                    } else {
                        continue;
                    }
                }
                values.push({x, y});
            }
        }
        return values;
    }

    private calculateXYborder(xValues: Array<number>, yValues: Array<number>, isLinePlots: boolean): { xMin: number, xMax: number, yMin: number, yMax: number } {
        let xMin = Math.min(...xValues.filter(n => {
            return !isNaN(n);
        }));
        let xMax = Math.max(...xValues.filter(n => {
            return !isNaN(n);
        }));
        let yMin = Number.MAX_VALUE;
        let yMax = -Number.MAX_VALUE;

        if (!this.widgetStore.isLinePlotsAutoScaledX && isLinePlots) {
            const localXMin = clamp(this.widgetStore.sharedMinX, xMin, xMax);
            const localXMax = clamp(this.widgetStore.sharedMaxX, xMin, xMax);
            xMin = localXMin;
            xMax = localXMax;
        }

        yMin = Math.min(...yValues.filter(n => {
            return !isNaN(n);
        }));
        yMax = Math.max(...yValues.filter(n => {
            return !isNaN(n);
        }));

        if (yMin === Number.MAX_VALUE) {
            yMin = undefined;
            yMax = undefined;
        } else {
            // extend y range a bit
            const range = yMax - yMin;
            yMin -= range * VERTICAL_RANGE_PADDING;
            yMax += range * VERTICAL_RANGE_PADDING;
        }
        return {xMin, xMax, yMin, yMax};
    }

    private assembleLinePlotData(profile: Array<number>, channelInfo: ChannelInfo): { dataset: Array<Point2D>, border: { xMin: number, xMax: number, yMin: number, yMax: number } } {
        if (profile && profile.length && profile.length === channelInfo.values.length) {
            let channelValues = this.widgetStore.useWcsValues ? channelInfo.values : channelInfo.indexes;
            let border = this.calculateXYborder(channelValues, profile, true);
            let values = this.assambleXYData(profile, channelValues, border.xMin, border.xMax);
            return {dataset: values, border};
        }
        return null;
    }

    private assembleScatterPlotData(qProfile: Array<number>, uProfile: Array<number>): { dataset: Array<Point2D>, border: { xMin: number, xMax: number, yMin: number, yMax: number } } {
        if (qProfile && qProfile.length && uProfile && uProfile.length && qProfile.length === uProfile.length) {
            let border = this.calculateXYborder(qProfile, uProfile, false);
            let values = this.assambleXYData(uProfile, qProfile, border.xMin, border.xMax);
            return {dataset: values, border};
        }
        return null;
    }

    private compareVariable(a: number, b: number, c: number, d: number): boolean {
        return a === b && a === c && a === d && a !== null;
    }

    @computed get plotData(): {
        qValues: { dataset: Array<Point2D>, border: { xMin: number, xMax: number, yMin: number, yMax: number } },
        uValues: { dataset: Array<Point2D>, border: { xMin: number, xMax: number, yMin: number, yMax: number } },
        piValues: { dataset: Array<Point2D>, border: { xMin: number, xMax: number, yMin: number, yMax: number } },
        paValues: { dataset: Array<Point2D>, border: { xMin: number, xMax: number, yMin: number, yMax: number } },
        quValues: { dataset: Array<Point2D>, border: { xMin: number, xMax: number, yMin: number, yMax: number } },
        qProgress: number,
        uProgress: number
    } {
        const frame = this.props.appStore.activeFrame;
        if (!frame) {
            return null;
        }

        const fileId = frame.frameInfo.fileId;
        let compositeProfile: {
            qProfile: Array<number>,
            uProfile: Array<number>,
            piProfile: Array<number>,
            paProfile: Array<number>,
            qProgress: number,
            uProgress: number
        };
        let regionId = this.widgetStore.regionIdMap.get(fileId) || 0;
        if (frame.regionSet) {
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);
            if (region) {
                compositeProfile = this.calculateCompositeProfile(region.isClosedRegion ? this.widgetStore.statsType : CARTA.StatsType.Sum);
            }
        }

        let channelInfo = frame.channelInfo;
        if (compositeProfile && channelInfo) {
            let piDic = this.assembleLinePlotData(compositeProfile.piProfile, channelInfo);
            let paDic = this.assembleLinePlotData(compositeProfile.paProfile, channelInfo);
            let qDic = this.assembleLinePlotData(compositeProfile.qProfile, channelInfo);
            let uDic = this.assembleLinePlotData(compositeProfile.uProfile, channelInfo);
            let quDic = this.assembleScatterPlotData(compositeProfile.qProfile, compositeProfile.uProfile);

            return {qValues: qDic, uValues: uDic, piValues: piDic, paValues: paDic, quValues: quDic, qProgress: compositeProfile.qProgress, uProgress: compositeProfile.uProgress};
        }
        return null;
    }

    render() {
        const appStore = this.props.appStore;
        if (!this.widgetStore) {
            return <NonIdealState icon={"error"} title={"Missing profile"} description={"Profile not found"}/>;
        }
        const frame = appStore.activeFrame;
        const imageName = (appStore.activeFrame ? appStore.activeFrame.frameInfo.fileInfo.name : undefined);

        let quLinePlotProps: LinePlotComponentProps = {
            xLabel: "Channel",
            yLabel: "Value",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "profile",
            forceScientificNotationTicksY: true,
            showXAxisTicks: false,
            showXAxisLabel: false,
            multiPlotData: new Map(),
            showLegend: true,
            xTickMarkLength: 0,
            graphCursorMoved: this.onGraphCursorMoved,
            multiPlotBorderColor: new Map(),
            isGroupSubPlot: true,
            scrollZoom: true,
            graphZoomedX: this.widgetStore.setSharedXBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphClicked: this.onChannelChanged,
            markers: []
        };

        let piLinePlotProps: LinePlotComponentProps = {
            xLabel: "Channel",
            yLabel: "Value",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "profile",
            forceScientificNotationTicksY: true,
            showXAxisTicks: false,
            showXAxisLabel: false,
            multiPlotData: new Map(),
            xTickMarkLength: 0,
            graphCursorMoved: this.onGraphCursorMoved,
            isGroupSubPlot: true,
            scrollZoom: true,
            graphZoomedX: this.widgetStore.setSharedXBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphClicked: this.onChannelChanged,
            markers: []
        };

        let paLinePlotProps: LinePlotComponentProps = {
            xLabel: "Channel",
            yLabel: "Value",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "profile",
            forceScientificNotationTicksY: true,
            showXAxisTicks: true,
            showXAxisLabel: true,
            multiPlotData: new Map(),
            graphCursorMoved: this.onGraphCursorMoved,
            isGroupSubPlot: true,
            scrollZoom: true,
            graphZoomedX: this.widgetStore.setSharedXBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphClicked: this.onChannelChanged,
            markers: []
        };

        let quScatterPlotProps: LinePlotComponentProps = {
            plotType: "bubble",
            xLabel: "Value",
            yLabel: "Value",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "profile",
            forceScientificNotationTicksY: true,
            forceScientificNotationTicksX: true,
            showXAxisTicks: true,
            showXAxisLabel: true,
            usePointSymbols: true,
            multiPlotData: new Map(),
            xZeroLineColor: Colors.RED2,
            yZeroLineColor: Colors.RED2,
            multiPlotBorderColor: new Map(),
            isGroupSubPlot: true,
            colorRangeEnd: 250,
            centeredOrigin: true,
        };

        let className = "profile-container-" + StokesAnalysisComponent.calculateLayout(this.width, this.height);

        if (this.profileStore && frame) {
            const currentPlotData = this.plotData;
            if (currentPlotData && currentPlotData.piValues && currentPlotData.paValues && currentPlotData.qValues && currentPlotData.uValues && currentPlotData.quValues) {

                quLinePlotProps.multiPlotData.set(StokesCoordinate.LinearPolarizationQ, currentPlotData.qValues.dataset);
                quLinePlotProps.multiPlotData.set(StokesCoordinate.LinearPolarizationU, currentPlotData.uValues.dataset);
                piLinePlotProps.data = currentPlotData.piValues.dataset;
                paLinePlotProps.data = currentPlotData.paValues.dataset;
                quScatterPlotProps.data = currentPlotData.quValues.dataset;

                let qBorder = currentPlotData.qValues.border;
                let uBorder = currentPlotData.uValues.border;
                let piBorder = currentPlotData.piValues.border;
                let paBorder = currentPlotData.paValues.border;
                let quBorder = currentPlotData.quValues.border;

                if (this.compareVariable(qBorder.xMin, uBorder.xMin, piBorder.xMin, paBorder.xMin) && this.compareVariable(qBorder.xMax, uBorder.xMax, piBorder.xMax, paBorder.xMax)) {
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
                    }

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
            }

            paLinePlotProps.yLabel = "PA (Degrees)";
            if (this.widgetStore.fractionalPolVisible) {
                quLinePlotProps.yLabel = "Stokes Value (%)";
                piLinePlotProps.yLabel = "PI/I (%)";
                quScatterPlotProps.xLabel = "Q/I (%)";
                quScatterPlotProps.yLabel = "U/I (%)";
            } else {
                quLinePlotProps.yLabel = "Stokes Value (" + frame.unit + ")";
                piLinePlotProps.yLabel = "PI (" + frame.unit + ")";
                quScatterPlotProps.xLabel = "Stokes Q (" + frame.unit + ")";
                quScatterPlotProps.yLabel = "Stokes U (" + frame.unit + ")";
            }

            const wcsLabel = this.getChannelLabel();
            if (wcsLabel) {
                paLinePlotProps.xLabel = this.getChannelLabel();
                piLinePlotProps.xLabel = this.getChannelLabel();
                quLinePlotProps.xLabel = this.getChannelLabel();
            }

            let cursorXInfor = {
                profiler: this.widgetStore.cursorX,
                image: this.getCurrentChannelValue(),
                unit: this.getChannelUnit()
            };
            paLinePlotProps.cursorX = cursorXInfor;
            piLinePlotProps.cursorX = cursorXInfor;
            quLinePlotProps.cursorX = cursorXInfor;

            paLinePlotProps.markers = [];
            piLinePlotProps.markers = [];
            quLinePlotProps.markers = [];

            if (paLinePlotProps.cursorX.profiler !== null || piLinePlotProps.cursorX.profiler !== null) {
                let cursor = {
                    value: paLinePlotProps.cursorX.profiler,
                    id: "marker-profiler-cursor",
                    draggable: false,
                    horizontal: false,
                    color: appStore.darkTheme ? Colors.GRAY4 : Colors.GRAY2,
                    opacity: 0.8,
                    isMouseMove: false,
                };
                paLinePlotProps.markers.push(cursor);
                piLinePlotProps.markers.push(cursor);
                quLinePlotProps.markers.push(cursor);
            }

            if (paLinePlotProps.cursorX.image !== null) {
                let channelCurrent = {
                    value: paLinePlotProps.cursorX.image,
                    id: "marker-channel-current",
                    opacity: 0.4,
                    draggable: false,
                    horizontal: false,
                };
                let channelRequired = {
                    value: this.getRequiredChannelValue(),
                    id: "marker-channel-required",
                    draggable: appStore.animatorStore.animationState !== AnimationState.PLAYING,
                    dragMove: this.onChannelChanged,
                    horizontal: false,
                };
                paLinePlotProps.markers.push(channelCurrent, channelRequired);
                piLinePlotProps.markers.push(channelCurrent, channelRequired);
                quLinePlotProps.markers.push(channelCurrent, channelRequired);

            }

            quLinePlotProps.multiPlotBorderColor.set(StokesCoordinate.LinearPolarizationQ, Colors.GREEN2);
            quLinePlotProps.multiPlotBorderColor.set(StokesCoordinate.LinearPolarizationU, Colors.BLUE2);

            paLinePlotProps.comments = this.exportHeaders;
            piLinePlotProps.comments = this.exportHeaders;
            quLinePlotProps.comments = this.exportHeaders;
            quScatterPlotProps.comments = this.exportHeaders;

        }

        return (
            <div className={"stokes-widget"}>
                <div className={className}>
                    <div className="profile-plot-toolbar">
                        <StokesAnalysisToolbarComponent widgetStore={this.widgetStore} appStore={appStore}/>
                    </div>
                    <div className="profile-plot-qup">
                        <div className="profile-plot-qu">
                            <LinePlotComponent {...quLinePlotProps}/>
                        </div>
                        <div className="profile-plot-pi">
                            <LinePlotComponent {...piLinePlotProps}/>
                        </div>
                        <div className="profile-plot-pa">
                            <LinePlotComponent {...paLinePlotProps}/>
                        </div>
                    </div>
                    <div className="profile-plot-qvsu">
                        <ScatterPlotComponent {...quScatterPlotProps}/>
                    </div>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}
