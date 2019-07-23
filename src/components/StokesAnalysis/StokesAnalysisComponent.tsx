import * as React from "react";
import * as _ from "lodash";
import {computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Colors, NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {LinePlotComponent, LinePlotComponentProps} from "components/Shared";
import {StokesAnalysisToolbarComponent} from "./StokesAnalysisToolbarComponent/StokesAnalysisToolbarComponent";
import {WidgetConfig, WidgetProps, SpectralProfileStore, FrameStore} from "stores";
import {StokesAnalysisWidgetStore} from "stores/widgets";
import {Point2D, ChannelInfo} from "models";
import {CARTA} from "carta-protobuf";
import {clamp, pi, pa, normalising} from "utilities";
import {StokesCoordinate} from "stores/widgets/StokesAnalysisWidgetStore";
import "./StokesAnalysisComponent.css";

@observer
export class StokesAnalysisComponent extends React.Component<WidgetProps> {
    private static layoutRatioCutoffs = {
        vertical:  0.5,
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
            }
            else if (minValue === horizontalDiff) {
                return "horizontal";
            }
            return null;
        }
        return null;
    }

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

    private static calculateFractionalPol (targetData: Array<number> | Float32Array | Float64Array, dataIz: Float32Array | Float64Array): Array<number> {
        let vals = [];
        if (targetData && dataIz && targetData.length === dataIz.length) {
            for (let i = 0; i < targetData.length; i++) {
                vals[i] = normalising(targetData[i], dataIz[i]);
            }
        }
        return vals;
    }

    private calculateCompositeProfile(statsType: CARTA.StatsType): {qProfile: Array<number>, uProfile: Array<number>, piProfile: Array<number>, paProfile: Array<number>} {
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
            return {qProfile, uProfile, piProfile, paProfile};
        }
        return null;
    }

    private static assambleXYData(profileVals: Array<number>, channelValues: Array<number>, xMin: number, xMax: number): Array<{ x: number, y: number }> {
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

    private calculateXYborder(xValues: Array<number>, yValues: Array<number>): {xMin: number, xMax: number, yMin: number, yMax: number} {
        let xMin = Math.min(... xValues);
        let xMax = Math.max(... xValues);
        let yMin = Number.MAX_VALUE;
        let yMax = -Number.MAX_VALUE;

        if (!this.widgetStore.isAutoScaledX) {
            const localXMin = clamp(this.widgetStore.sharedMinX, xMin, xMax);
            const localXMax = clamp(this.widgetStore.sharedMinX, xMin, xMax);
            xMin = localXMin;
            xMax = localXMax;
        }

        yMin = Math.min(... yValues);
        yMax = Math.max(... yValues);

        if (yMin === Number.MAX_VALUE) {
            yMin = undefined;
            yMax = undefined;
        }

        return {xMin, xMax, yMin, yMax};
    }

    private assambleLinePlotData(profile: Array<number>, channelInfo: ChannelInfo): {dataset: Array<Point2D>, border: {xMin: number, xMax: number, yMin: number, yMax: number}} {
        if (profile  && profile.length && profile.length === channelInfo.values.length) {
            let channelValues = this.widgetStore.useWcsValues ? channelInfo.values : channelInfo.indexes;
            let border = this.calculateXYborder(channelValues, profile);
            let values = StokesAnalysisComponent.assambleXYData(profile, channelValues, border.xMin, border.xMax);
            return {dataset: values, border};
        }
        return null;
    }

    private assambleScatterPlotData(qProfile: Array<number>, uProfile: Array<number>): {dataset: Array<Point2D>, border: {xMin: number, xMax: number, yMin: number, yMax: number}} {
        if (qProfile  && qProfile.length && uProfile && uProfile.length && qProfile.length === uProfile.length) {
            let border = this.calculateXYborder(qProfile, uProfile);
            let values = StokesAnalysisComponent.assambleXYData(uProfile, qProfile, border.xMin, border.xMax);
            return {dataset: values, border};
        }
        return null;
    }
    
    private compareVariable(a: number, b: number, c: number, d: number): boolean {
        return a === b && a === c && a === d && a !== null;
    }

    @computed get plotDataPI(): { 
        qValues: {dataset: Array<Point2D>, border: {xMin: number, xMax: number, yMin: number, yMax: number}}, 
        uValues: {dataset: Array<Point2D>, border: {xMin: number, xMax: number, yMin: number, yMax: number}},
        piValues: {dataset: Array<Point2D>, border: {xMin: number, xMax: number, yMin: number, yMax: number}},
        paValues: {dataset: Array<Point2D>, border: {xMin: number, xMax: number, yMin: number, yMax: number}},
        quValues: {dataset: Array<Point2D>, border: {xMin: number, xMax: number, yMin: number, yMax: number}},
        sharedMinX: number, 
        sharedMaxX: number, polIntensityMinY: number, polIntensityMaxY: number} {
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
            let piDic = this.assambleLinePlotData(compositeProfile.piProfile, channelInfo);
            let paDic = this.assambleLinePlotData(compositeProfile.paProfile, channelInfo);
            let qDic = this.assambleLinePlotData(compositeProfile.qProfile, channelInfo);
            let uDic = this.assambleLinePlotData(compositeProfile.uProfile, channelInfo);
            let quDic = this.assambleScatterPlotData(compositeProfile.qProfile, compositeProfile.uProfile);

            return {qValues: qDic, uValues: uDic, piValues: piDic, paValues: paDic, quValues: quDic , sharedMinX: 0, sharedMaxX: 0, polIntensityMinY: 0, polIntensityMaxY: 0};
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
            showBottomAxis: false,
            multiLineData: new Map(),
            graphCursorMoved: this.onGraphCursorMoved,
            markers: []
        };

        let piLinePlotProps: LinePlotComponentProps = {
            xLabel: "Channel",
            yLabel: "Value",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "profile",
            forceScientificNotationTicksY: true,
            showBottomAxis: false, 
            multiLineData: new Map(),
            graphCursorMoved: this.onGraphCursorMoved,
            markers: []
        };

        let paLinePlotProps: LinePlotComponentProps = {
            xLabel: "Channel",
            yLabel: "Value",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "profile",
            forceScientificNotationTicksY: true,
            multiLineData: new Map(),
            graphCursorMoved: this.onGraphCursorMoved,
            markers: []
        };

        let qvsuLinePlotProps: LinePlotComponentProps = {
            xLabel: "Value",
            yLabel: "Value",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "profile",
            forceScientificNotationTicksY: true,
            forceScientificNotationTicksX: true,
            usePointSymbols: true,
            multiLineData: new Map()
        };

        let className = "profile-container-" + StokesAnalysisComponent.calculateLayout(this.width, this.height);

        if (this.profileStore && frame) {
            const currentPlotData = this.plotDataPI;
            if (currentPlotData && currentPlotData.piValues && currentPlotData.paValues && currentPlotData.qValues && currentPlotData.uValues && currentPlotData.quValues) {
                
                piLinePlotProps.multiLineData.set(StokesCoordinate.PolarizedIntensity, currentPlotData.piValues.dataset);
                paLinePlotProps.multiLineData.set(StokesCoordinate.PolarizationAngle, currentPlotData.paValues.dataset);
                quLinePlotProps.multiLineData.set(StokesCoordinate.LinearPolarizationQ, currentPlotData.qValues.dataset);
                quLinePlotProps.multiLineData.set(StokesCoordinate.LinearPolarizationU, currentPlotData.uValues.dataset);
                qvsuLinePlotProps.multiLineData.set(StokesCoordinate.PolarizationQU, currentPlotData.quValues.dataset);

                let qBorder = currentPlotData.qValues.border;
                let uBorder = currentPlotData.uValues.border;
                let piBorder = currentPlotData.piValues.border;
                let paBorder = currentPlotData.paValues.border;
                let quBorder = currentPlotData.quValues.border;

                if (this.compareVariable(qBorder.xMin, uBorder.xMin, piBorder.xMin, paBorder.xMin) && this.compareVariable(qBorder.xMax, uBorder.xMax, piBorder.xMax, paBorder.xMax)) {
                    
                    quLinePlotProps.xMin = qBorder.xMin;
                    quLinePlotProps.xMax = qBorder.xMax;
                    quLinePlotProps.yMin = qBorder.yMin < uBorder.yMin ? qBorder.yMin : uBorder.yMin;
                    quLinePlotProps.yMax = qBorder.yMax > uBorder.yMax ? qBorder.yMax : uBorder.yMax;

                    piLinePlotProps.xMin = piBorder.xMin;
                    piLinePlotProps.xMax = piBorder.xMax;
                    piLinePlotProps.yMin = piBorder.yMin;
                    piLinePlotProps.yMax = piBorder.yMax;

                    paLinePlotProps.xMin = paBorder.xMin;
                    paLinePlotProps.xMax = paBorder.xMax;
                    paLinePlotProps.yMin = paBorder.yMin;
                    paLinePlotProps.yMax = paBorder.yMax;
                }
                qvsuLinePlotProps.xMin = quBorder.xMin;
                qvsuLinePlotProps.xMax = quBorder.xMax;
                qvsuLinePlotProps.yMin = quBorder.yMin;
                qvsuLinePlotProps.yMax = quBorder.yMax;
            }

            paLinePlotProps.yLabel = "PA (" + frame.unit + ")";
            if (this.widgetStore.fractionalPolVisible) {
                quLinePlotProps.yLabel = "Q/I + U/I (%)";
                piLinePlotProps.yLabel = "PI/I (%)";
                qvsuLinePlotProps.xLabel = "Q/I (%)";
                qvsuLinePlotProps.yLabel = "U/I (%)";
            } else {
                quLinePlotProps.yLabel = "Q + U (" + frame.unit + ")";
                piLinePlotProps.yLabel = "PI (" + frame.unit + ")";
                qvsuLinePlotProps.xLabel = "Stokes Q (" + frame.unit + ")";
                qvsuLinePlotProps.yLabel = "Stokes U (" + frame.unit + ")";
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
            paLinePlotProps.comments = this.exportHeaders;
            piLinePlotProps.comments = this.exportHeaders;
            quLinePlotProps.comments = this.exportHeaders;
            qvsuLinePlotProps.comments = this.exportHeaders;

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
                        <LinePlotComponent {...qvsuLinePlotProps}/>
                    </div>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}
