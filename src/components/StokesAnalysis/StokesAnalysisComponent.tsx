import * as React from "react";
import * as _ from "lodash";
import {computed, observable} from "mobx";
import {observer} from "mobx-react";
import {NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {LinePlotComponent, LinePlotComponentProps} from "components/Shared";
import {StokesAnalysisToolbarComponent} from "./StokesAnalysisToolbarComponent/StokesAnalysisToolbarComponent";
import {WidgetConfig, WidgetProps, SpectralProfileStore, FrameStore} from "stores";
import {StokesAnalysisWidgetStore} from "stores/widgets";
import {Point2D, ChannelInfo} from "models";
import {CARTA} from "carta-protobuf";
import {clamp, pi, pa, normalising} from "utilities";
import {StokesCoordinate, StokesCoordinateLabel} from "stores/widgets/StokesAnalysisWidgetStore";
import "./StokesAnalysisComponent.css";
import {build} from "protobufjs";

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

    constructor(props: WidgetProps) {
        super(props);
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === StokesAnalysisComponent.WIDGET_CONFIG.type) {
            // Assign the next unique ID
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

    private static calculatePA(qData: Array<number>, uData: Array<number>): Array<number> {
        let vals = [];
        if (qData && uData && qData.length === uData.length) {
            for (let i = 0; i < qData.length; i++) {
                vals[i] = pa(qData[i], uData[i]);
            }
        }
        return vals;
    }

    private static calculatePI(qData: Array<number>, uData: Array<number>): Array<number> {
        let vals = [];
        if (qData && uData && qData.length === uData.length) {
            for (let i = 0; i < qData.length; i++) {
                vals[i] = pi(qData[i], uData[i]);
            }
        }
        return vals;
    }

    // calculate fractional Pol
    private static calculateFractionalPol (targetData: Array<number>, dataIz: Array<number>): Array<number> {
        let vals = [];
        if (targetData && dataIz && targetData.length === dataIz.length) {
            for (let i = 0; i < targetData.length; i++) {
                vals[i] = normalising(targetData[i], dataIz[i]);
            }
        }
        return vals;
    }

    // return composite profile for Q, U, PI and PA
    private calculateCompositeProfile(statsType: CARTA.StatsType): {
        qProfile: CARTA.ISpectralProfile,
        uProfile: CARTA.ISpectralProfile,
        piProfile: CARTA.ISpectralProfile,
        paProfile: CARTA.ISpectralProfile,
    } {

        let qProfileOriginal = this.profileStore.getProfile(StokesCoordinate.LinearPolarizationQ, statsType);
        let uProfileOriginal = this.profileStore.getProfile(StokesCoordinate.LinearPolarizationU, statsType);

        let qProfile = {...qProfileOriginal};
        let uProfile = {...uProfileOriginal};
        let piProfile = {...qProfile};
        let paProfile = {...qProfile};
        piProfile.coordinate = StokesCoordinate.PolarizedIntensity;
        paProfile.coordinate = StokesCoordinate.PolarizationAngle;
        // console.log(this.profileStore)
        let piCoordinate = [];
        let paCoordinate = [];
        if (qProfile && uProfile) {
            piCoordinate = StokesAnalysisComponent.calculatePI(qProfile.vals, uProfile.vals);
            paCoordinate = StokesAnalysisComponent.calculatePA(qProfile.vals, uProfile.vals);
            let iProfile = this.profileStore.getProfile(StokesCoordinate.TotalIntensity, statsType);
            if (this.widgetStore.fractionalPolVisible && iProfile) {
                // console.log(iProfile)
                piCoordinate = StokesAnalysisComponent.calculateFractionalPol(piCoordinate, iProfile.vals);
                qProfile.vals = StokesAnalysisComponent.calculateFractionalPol(qProfile.vals, iProfile.vals);
                uProfile.vals = StokesAnalysisComponent.calculateFractionalPol(uProfile.vals, iProfile.vals);
            }
            piProfile.vals = piCoordinate;
            paProfile.vals = paCoordinate;
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

                // Skip values outside of range. If array already contains elements, we've reached the end of the range, and can break
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

    private calculateXYborder(channelValues: Array<number>): {xMin: number, xMax: number, yMin: number, yMax: number} {
        let xMin = Math.min(channelValues[0], channelValues[channelValues.length - 1]);
        let xMax = Math.max(channelValues[0], channelValues[channelValues.length - 1]);
        let yMin = Number.MAX_VALUE;
        let yMax = -Number.MAX_VALUE;

        if (!this.widgetStore.isAutoScaledX) {
            const localXMin = clamp(this.widgetStore.sharedMinX, xMin, xMax);
            const localXMax = clamp(this.widgetStore.sharedMinX, xMin, xMax);
            xMin = localXMin;
            xMax = localXMax;
        }

        if (yMin === Number.MAX_VALUE) {
            yMin = undefined;
            yMax = undefined;
        }

        return {xMin, xMax, yMin, yMax};
    }

    private assambleLinePlotData(profile: CARTA.ISpectralProfile, channelInfo: ChannelInfo): {dataset: Array<Point2D>, border: {xMin: number, xMax: number, yMin: number, yMax: number}} {
        if (profile.vals  && profile.vals.length && profile.vals.length === channelInfo.values.length) {
            
            let channelValues = this.widgetStore.useWcsValues ? channelInfo.values : channelInfo.indexes;
            let border = this.calculateXYborder(channelValues);

            let values = StokesAnalysisComponent.assambleXYData(profile.vals, channelValues, border.xMin, border.xMax);
            return {dataset: values, border};
        }
        return null;
    }

    @computed get plotDataPI(): { 
        qValues: {dataset: Array<Point2D>, border: {xMin: number, xMax: number, yMin: number, yMax: number}}, 
        uValues: {dataset: Array<Point2D>, border: {xMin: number, xMax: number, yMin: number, yMax: number}},
        piValues: {dataset: Array<Point2D>, border: {xMin: number, xMax: number, yMin: number, yMax: number}},
        paValues: {dataset: Array<Point2D>, border: {xMin: number, xMax: number, yMin: number, yMax: number}},
        sharedMinX: number, 
        sharedMaxX: number, polIntensityMinY: number, polIntensityMaxY: number} {
        const frame = this.props.appStore.activeFrame;
        if (!frame) {
            return null;
        }

        const fileId = frame.frameInfo.fileId;
        let compositeProfile: {
            qProfile: CARTA.ISpectralProfile,
            uProfile: CARTA.ISpectralProfile,
            piProfile: CARTA.ISpectralProfile,
            paProfile: CARTA.ISpectralProfile,
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
            // console.log(compositeProfile);
            // console.log(channelInfo);
            let piDic = this.assambleLinePlotData(compositeProfile.piProfile, channelInfo);
            let paDic = this.assambleLinePlotData(compositeProfile.paProfile, channelInfo);
            let qDic = this.assambleLinePlotData(compositeProfile.qProfile, channelInfo);
            let uDic = this.assambleLinePlotData(compositeProfile.uProfile, channelInfo);

            return {qValues: qDic, uValues: uDic, piValues: piDic, paValues: paDic, sharedMinX: 0, sharedMaxX: 0, polIntensityMinY: 0, polIntensityMaxY: 0};
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
            // xLabel: "Frequence (GHz)",
            yLabel: "Q + U",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "profile",
            forceScientificNotationTicksY: true,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true,
            showBottomAxis: false
        };

        let piLinePlotProps: LinePlotComponentProps = {
            // xLabel: "Frequence (GHz)",
            yLabel: "PI",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "profile",
            forceScientificNotationTicksY: true,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true,
            showBottomAxis: false
        };

        let paLinePlotProps: LinePlotComponentProps = {
            xLabel: "Frequence (GHz)",
            yLabel: "PA",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "profile",
            forceScientificNotationTicksY: true,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true
        };

        let qvsuLinePlotProps: LinePlotComponentProps = {
            xLabel: "Q",
            yLabel: "U",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: "profile",
            forceScientificNotationTicksY: true,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true
        };

        let className = "profile-container-" + StokesAnalysisComponent.calculateLayout(this.width, this.height);
        console.log(className);
        if (this.profileStore && frame) {
            const currentPlotData = this.plotDataPI;
            // console.log(currentPlotData);
            if (currentPlotData.piValues && currentPlotData.paValues && currentPlotData.qValues) {
                
                piLinePlotProps.data = currentPlotData.piValues.dataset;
                paLinePlotProps.data = currentPlotData.paValues.dataset;
                quLinePlotProps.data = currentPlotData.qValues.dataset;
                // Determine scale in X and Y directions. If auto-scaling, use the bounds of the current data
            }
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
