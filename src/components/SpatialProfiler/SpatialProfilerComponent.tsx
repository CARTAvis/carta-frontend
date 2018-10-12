import * as React from "react";
import * as AST from "ast_wrapper";
import {computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Chart} from "chart.js";
import ReactResizeDetector from "react-resize-detector";
import {AppStore} from "../../stores/AppStore";
import {WidgetConfig} from "../../stores/widgets/FloatingWidgetStore";
import {NonIdealState} from "@blueprintjs/core";
import {clamp} from "../../util/math";
import {Point2D} from "../../models/Point2D";
import {SpatialProfileWidgetStore} from "../../stores/widgets/SpatialProfileWidgetStore";
import {SpatialProfileStore} from "../../stores/SpatialProfileStore";
import {LinePlotComponent, LinePlotComponentProps} from "../Shared/LinePlot/LinePlotComponent";
import {PopoverSettingsComponent} from "../Shared/PopoverSettings/PopoverSettingsComponent";
import {SpatialProfilerSettingsPanelComponent} from "./SpatialProfilerSettingsPanelComponent/SpatialProfilerSettingsPanelComponent";
import "./SpatialProfilerComponent.css";

class SpatialProfilerComponentProps {
    appStore: AppStore;
    id: string;
    docked: boolean;
}

// The fixed size of the settings panel popover (excluding the show/hide button)
const PANEL_CONTENT_WIDTH = 140;

@observer
export class SpatialProfilerComponent extends React.Component<SpatialProfilerComponentProps> {
    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "spatial-profiler",
            type: "spatial-profiler",
            minWidth: 250,
            minHeight: 225,
            defaultWidth: 650,
            defaultHeight: 225,
            title: "Spatial Profile",
            isCloseable: true
        };
    }

    @observable width: number;
    @observable height: number;

    @computed get widgetStore(): SpatialProfileWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.spatialProfileWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.spatialProfileWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.error("can't find store for widget");
        return new SpatialProfileWidgetStore();
    }

    @computed get profileStore(): SpatialProfileStore {
        if (this.props.appStore && this.props.appStore.activeFrame) {
            let keyStruct = {fileId: this.widgetStore.fileId, regionId: this.widgetStore.regionId};
            // Replace "current file" fileId with active frame's fileId
            if (this.widgetStore.fileId === -1) {
                keyStruct.fileId = this.props.appStore.activeFrame.frameInfo.fileId;
            }
            const key = `${keyStruct.fileId}-${keyStruct.regionId}`;
            return this.props.appStore.spatialProfiles.get(key);
        }
        return undefined;
    }

    @computed get settingsPanelWidth(): number {
        return 20 + (this.widgetStore.settingsPanelVisible ? PANEL_CONTENT_WIDTH : 0);
    }

    @computed get plotData(): { values: Array<Point2D>, xMin: number, xMax: number, yMin: number, yMax: number } {
        const frame = this.props.appStore.getFrame(this.widgetStore.fileId);
        const isXProfile = this.widgetStore.coordinate.indexOf("x") >= 0;
        if (!frame) {
            return null;
        }

        if (this.profileStore.approximate) {
            // Check if frame data can be used to approximate profile
            if (this.profileStore.x >= frame.currentFrameView.xMin && this.profileStore.x <= frame.currentFrameView.xMax && this.profileStore.y >= frame.currentFrameView.yMin && this.profileStore.y <= frame.currentFrameView.yMax) {
                const w = Math.floor((frame.currentFrameView.xMax - frame.currentFrameView.xMin) / frame.currentFrameView.mip);
                const h = Math.floor((frame.currentFrameView.yMax - frame.currentFrameView.yMin) / frame.currentFrameView.mip);
                const yOffset = Math.floor((this.profileStore.y - frame.currentFrameView.yMin) / frame.currentFrameView.mip);
                const xOffset = Math.floor((this.profileStore.x - frame.currentFrameView.xMin) / frame.currentFrameView.mip);

                let xMin: number;
                let xMax: number;
                if (isXProfile) {
                    xMin = clamp(frame.requiredFrameView.xMin, 0, frame.frameInfo.fileInfoExtended.width);
                    xMax = clamp(frame.requiredFrameView.xMax, 0, frame.frameInfo.fileInfoExtended.width);
                }
                else {
                    xMin = clamp(frame.requiredFrameView.yMin, 0, frame.frameInfo.fileInfoExtended.height);
                    xMax = clamp(frame.requiredFrameView.yMax, 0, frame.frameInfo.fileInfoExtended.height);
                }

                xMin = Math.floor(xMin);
                xMax = Math.floor(xMax);

                let values: { x: number, y: number }[];
                if (isXProfile) {
                    values = new Array(w);
                    for (let i = 0; i < w; i++) {
                        values[i] = {x: frame.currentFrameView.xMin + frame.currentFrameView.mip * i, y: frame.rasterData[yOffset * w + i]};
                    }
                }
                else {
                    values = new Array(h);
                    for (let i = 0; i < h; i++) {
                        values[i] = {x: frame.currentFrameView.yMin + frame.currentFrameView.mip * i, y: frame.rasterData[i * w + xOffset]};
                    }
                }

                let yMin = Number.MAX_VALUE;
                let yMax = -Number.MAX_VALUE;

                // determine local range
                for (let i = 0; i < values.length; i++) {
                    if (values[i].x >= xMin && !isNaN(values[i].y)) {
                        yMin = Math.min(yMin, values[i].y);
                        yMax = Math.max(yMax, values[i].y);
                    }
                    if (values[i].x > xMax) {
                        break;
                    }
                }

                if (yMin === Number.MAX_VALUE) {
                    yMin = undefined;
                    yMax = undefined;
                }

                return {values: values, xMin, xMax, yMin, yMax};
            }
            else if (this.profileStore.x !== undefined && this.profileStore.y !== undefined) {
                console.log(`Out of bounds profile request: (${this.profileStore.x}, ${this.profileStore.y})`);
            }
        }
        else {
            // Use accurate profiles from server-sent data
            const coordinateData = this.profileStore.profiles.get(this.widgetStore.coordinate);
            if (coordinateData && coordinateData.values && coordinateData.values.length) {
                let xMin: number;
                let xMax: number;
                if (isXProfile) {
                    xMin = clamp(frame.requiredFrameView.xMin, 0, frame.frameInfo.fileInfoExtended.width);
                    xMax = clamp(frame.requiredFrameView.xMax, 0, frame.frameInfo.fileInfoExtended.width);
                }
                else {
                    xMin = clamp(frame.requiredFrameView.yMin, 0, frame.frameInfo.fileInfoExtended.height);
                    xMax = clamp(frame.requiredFrameView.yMax, 0, frame.frameInfo.fileInfoExtended.height);
                }

                xMin = Math.floor(xMin);
                xMax = Math.floor(xMax);

                const N = Math.floor(Math.min(xMax - xMin, coordinateData.values.length));
                let values = new Array(N);
                for (let i = 0; i < N; i++) {
                    values[i] = {x: coordinateData.start + i + xMin, y: coordinateData.values[i + xMin]};
                }

                let yMin = Number.MAX_VALUE;
                let yMax = -Number.MAX_VALUE;
                for (let i = 0; i < values.length; i++) {
                    if (values[i].x >= xMin && !isNaN(values[i].y)) {
                        yMin = Math.min(yMin, values[i].y);
                        yMax = Math.max(yMax, values[i].y);
                    }
                    if (values[i].x > xMax) {
                        break;
                    }
                }

                if (yMin === Number.MAX_VALUE) {
                    yMin = undefined;
                    yMax = undefined;
                }

                return {values: values, xMin, xMax, yMin, yMax};
            }
        }
        return null;
    }

    constructor(props: SpatialProfilerComponentProps) {
        super(props);
    }

    onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    render() {
        const appStore = this.props.appStore;
        if (!this.widgetStore) {
            return <NonIdealState icon={"error"} title={"Missing profile"} description={"Profile not found"}/>;
        }

        const isXProfile = this.widgetStore.coordinate.indexOf("x") >= 0;

        let linePlotProps: LinePlotComponentProps = {
            xLabel: `${isXProfile ? "X" : "Y"} coordinate`,
            yLabel: "Value",
            darkMode: appStore.darkTheme,
            logY: this.widgetStore.logScaleY,
            usePointSymbols: this.widgetStore.usePoints,
            interpolateLines: this.widgetStore.interpolateLines,
            graphZoomedX: this.widgetStore.setXBounds,
            graphZoomedY: this.widgetStore.setYBounds,
            graphZoomedXY: this.widgetStore.setXYBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            scrollZoom: true
        };

        if (appStore.activeFrame) {
            const frame = appStore.getFrame(this.widgetStore.fileId);
            if (this.profileStore && frame) {
                if (frame.unit) {
                    linePlotProps.yLabel = `Value (${frame.unit})`;
                }

                const labelAttribute = `Label(${isXProfile ? 1 : 2})`;
                // const astLabel = AST.getString(frame.wcsInfo, labelAttribute);
                //
                // if (astLabel) {
                //     linePlotProps.xLabel = astLabel;
                // }

                if (frame.validWcs) {
                    // if (isXProfile) {
                    //     plotOptions.scales.xAxes[0].ticks.callback = (v) => {
                    //         const pointWCS = AST.pixToWCS(frame.wcsInfo, v, this.profileStore.y);
                    //         const normVals = AST.normalizeCoordinates(frame.wcsInfo, pointWCS.x, pointWCS.y);
                    //         return AST.getFormattedCoordinates(frame.wcsInfo, normVals.x, undefined).x;
                    //     };
                    // }
                    // else {
                    //     plotOptions.scales.xAxes[0].ticks.callback = (v) => {
                    //         const pointWCS = AST.pixToWCS(frame.wcsInfo, this.profileStore.x, v);
                    //         const normVals = AST.normalizeCoordinates(frame.wcsInfo, pointWCS.x, pointWCS.y);
                    //         return AST.getFormattedCoordinates(frame.wcsInfo, undefined, normVals.y).y;
                    //     };
                    // }
                }
                else {
                    // Use tick values directly
                    // plotOptions.scales.xAxes[0].ticks.callback = (v) => v;
                }

                const currentPlotData = this.plotData;
                if (currentPlotData && currentPlotData.values && currentPlotData.values.length) {
                    linePlotProps.data = currentPlotData.values;
                    // Determine scale in X and Y directions. If auto-scaling, use the bounds of the current data
                    if (this.widgetStore.isAutoScaledX) {
                        linePlotProps.xMin = currentPlotData.xMin;
                        linePlotProps.xMax = currentPlotData.xMax;
                    }
                    else {
                        linePlotProps.xMin = this.widgetStore.minX;
                        linePlotProps.xMax = this.widgetStore.maxX;
                    }

                    if (this.widgetStore.isAutoScaledY) {
                        linePlotProps.yMin = currentPlotData.yMin;
                        linePlotProps.yMax = currentPlotData.yMax;
                    }
                    else {
                        linePlotProps.yMin = this.widgetStore.minY;
                        linePlotProps.yMax = this.widgetStore.maxY;
                    }
                    // Fix log plot min bounds for entries with zeros in them
                    if (this.widgetStore.logScaleY && linePlotProps.yMin <= 0) {
                        linePlotProps.yMin = 0.5;
                    }
                }
                const markerValue = isXProfile ? this.profileStore.x : this.profileStore.y;
                linePlotProps.markers = [{
                    value: markerValue,
                    id: "marker-min",
                    draggable: false,
                    horizontal: false,
                }];
            }
        }

        return (
            <div className={"spatial-profiler-widget"}>
                <div className="profile-container">
                    <div className="profile-plot">
                        <LinePlotComponent {...linePlotProps}/>
                    </div>
                </div>
                <PopoverSettingsComponent
                    isOpen={this.widgetStore.settingsPanelVisible}
                    onShowClicked={this.widgetStore.showSettingsPanel}
                    onHideClicked={this.widgetStore.hideSettingsPanel}
                    contentWidth={PANEL_CONTENT_WIDTH}
                >
                    <SpatialProfilerSettingsPanelComponent widgetStore={this.widgetStore}/>
                </PopoverSettingsComponent>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}