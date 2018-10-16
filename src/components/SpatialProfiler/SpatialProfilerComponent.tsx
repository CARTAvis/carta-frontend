import * as React from "react";
import * as AST from "ast_wrapper";
import {autorun, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Chart} from "chart.js";
import {Colors, NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {WidgetConfig, WidgetProps} from "../../stores/WidgetsStore";
import {clamp} from "../../util/math";
import {Point2D} from "../../models/Point2D";
import {SpatialProfileWidgetStore} from "../../stores/widgets/SpatialProfileWidgetStore";
import {SpatialProfileStore} from "../../stores/SpatialProfileStore";
import {LinePlotComponent, LinePlotComponentProps} from "../Shared/LinePlot/LinePlotComponent";
import {PopoverSettingsComponent} from "../Shared/PopoverSettings/PopoverSettingsComponent";
import {SpatialProfilerSettingsPanelComponent} from "./SpatialProfilerSettingsPanelComponent/SpatialProfilerSettingsPanelComponent";
import "./SpatialProfilerComponent.css";

// The fixed size of the settings panel popover (excluding the show/hide button)
const PANEL_CONTENT_WIDTH = 180;

@observer
export class SpatialProfilerComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "spatial-profiler",
            type: "spatial-profiler",
            minWidth: 250,
            minHeight: 225,
            defaultWidth: 650,
            defaultHeight: 225,
            title: "X Profile: Cursor",
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

    @computed get plotData(): { values: Array<Point2D>, xMin: number, xMax: number, yMin: number, yMax: number, yMean: number, yRms: number } {
        const frame = this.props.appStore.getFrame(this.widgetStore.fileId);
        const isXProfile = this.widgetStore.coordinate.indexOf("x") >= 0;
        if (!frame) {
            return null;
        }

        if (this.profileStore.approximate) {
            // Check if frame data can be used to approximate profile
            if (this.profileStore.x >= frame.currentFrameView.xMin && this.profileStore.x <= frame.currentFrameView.xMax && this.profileStore.y >= frame.currentFrameView.yMin && this.profileStore.y <= frame.currentFrameView.yMax) {
                const frameDataWidth = Math.floor((frame.currentFrameView.xMax - frame.currentFrameView.xMin) / frame.currentFrameView.mip);
                const frameDataHeight = Math.floor((frame.currentFrameView.yMax - frame.currentFrameView.yMin) / frame.currentFrameView.mip);
                const yOffset = Math.floor((this.profileStore.y - frame.currentFrameView.yMin) / frame.currentFrameView.mip);
                const xOffset = Math.floor((this.profileStore.x - frame.currentFrameView.xMin) / frame.currentFrameView.mip);

                let localMinX: number;
                let localMaxX: number;
                // Determine bounds automatically from the image view
                if (this.widgetStore.isAutoScaledX) {
                    if (isXProfile) {
                        localMinX = clamp(frame.requiredFrameView.xMin, 0, frame.frameInfo.fileInfoExtended.width);
                        localMaxX = clamp(frame.requiredFrameView.xMax, 0, frame.frameInfo.fileInfoExtended.width);
                    }
                    else {
                        localMinX = clamp(frame.requiredFrameView.yMin, 0, frame.frameInfo.fileInfoExtended.height);
                        localMaxX = clamp(frame.requiredFrameView.yMax, 0, frame.frameInfo.fileInfoExtended.height);
                    }
                }
                else {
                    localMinX = clamp(this.widgetStore.minX, 0, frame.frameInfo.fileInfoExtended.width);
                    if (isXProfile) {
                        localMaxX = clamp(this.widgetStore.maxX, 0, frame.frameInfo.fileInfoExtended.width);
                    }
                    else {
                        localMaxX = clamp(this.widgetStore.maxX, 0, frame.frameInfo.fileInfoExtended.height);
                    }
                }

                localMinX = Math.floor(localMinX);
                localMaxX = Math.floor(localMaxX);
                let yMin = Number.MAX_VALUE;
                let yMax = -Number.MAX_VALUE;
                let yMean;
                let yRms;
                // Variables for mean and RMS calculations
                let ySum = 0;
                let ySum2 = 0;
                let yCount = 0;

                let values: { x: number, y: number }[] = [];
                if (isXProfile) {
                    for (let i = 0; i < frameDataWidth; i++) {
                        const x = frame.currentFrameView.xMin + frame.currentFrameView.mip * i;
                        if (x > localMaxX) {
                            break;
                        }
                        if (x >= localMinX) {
                            const y = frame.rasterData[yOffset * frameDataWidth + i];
                            values.push({x, y});
                            if (!isNaN(y)) {
                                yMin = Math.min(yMin, y);
                                yMax = Math.max(yMax, y);
                                yCount++;
                                ySum += y;
                                ySum2 += y * y;
                            }
                        }
                    }
                }
                else {
                    for (let i = 0; i < frameDataHeight; i++) {
                        const x = frame.currentFrameView.yMin + frame.currentFrameView.mip * i;
                        if (x > localMaxX) {
                            break;
                        }
                        if (x >= localMinX) {
                            const y = frame.rasterData[i * frameDataWidth + xOffset];
                            values.push({x, y});
                            if (!isNaN(y)) {
                                yMin = Math.min(yMin, y);
                                yMax = Math.max(yMax, y);
                                yCount++;
                                ySum += y;
                                ySum2 += y * y;
                            }
                        }
                    }
                }

                if (yCount > 0) {
                    yMean = ySum / yCount;
                    yRms = Math.sqrt((ySum2 / yCount) - yMean * yMean);
                }

                if (yMin === Number.MAX_VALUE) {
                    yMin = undefined;
                    yMax = undefined;
                }
                return {values: values, xMin: localMinX, xMax: localMaxX, yMin, yMax, yMean, yRms};
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

                if (this.widgetStore.isAutoScaledX) {
                    if (isXProfile) {
                        xMin = clamp(frame.requiredFrameView.xMin, 0, frame.frameInfo.fileInfoExtended.width);
                        xMax = clamp(frame.requiredFrameView.xMax, 0, frame.frameInfo.fileInfoExtended.width);
                    }
                    else {
                        xMin = clamp(frame.requiredFrameView.yMin, 0, frame.frameInfo.fileInfoExtended.height);
                        xMax = clamp(frame.requiredFrameView.yMax, 0, frame.frameInfo.fileInfoExtended.height);
                    }
                }
                else {
                    xMin = clamp(this.widgetStore.minX, 0, frame.frameInfo.fileInfoExtended.width);
                    if (isXProfile) {
                        xMax = clamp(this.widgetStore.maxX, 0, frame.frameInfo.fileInfoExtended.width);
                    }
                    else {
                        xMax = clamp(this.widgetStore.maxX, 0, frame.frameInfo.fileInfoExtended.height);
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

                const N = Math.floor(Math.min(xMax - xMin, coordinateData.values.length));
                let values: Array<{ x: number, y: number }>;
                if (N > 0) {
                    values = new Array(N);
                    for (let i = 0; i < N; i++) {
                        values[i] = {x: coordinateData.start + i + xMin, y: coordinateData.values[i + xMin]};
                    }

                    for (let i = 0; i < values.length; i++) {
                        if (values[i].x > xMax) {
                            break;
                        }
                        const y = values[i].y;
                        if (values[i].x >= xMin && !isNaN(y)) {
                            yMin = Math.min(yMin, y);
                            yMax = Math.max(yMax, y);
                            yCount++;
                            ySum += y;
                            ySum2 += y * y;
                        }
                    }
                }

                if (yCount > 0) {
                    yMean = ySum / yCount;
                    yRms = Math.sqrt((ySum2 / yCount) - yMean * yMean);
                }

                if (yMin === Number.MAX_VALUE) {
                    yMin = undefined;
                    yMax = undefined;
                }
                return {values: values, xMin, xMax, yMin, yMax, yMean, yRms};
            }
        }
        return null;
    }

    constructor(props: WidgetProps) {
        super(props);
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === SpatialProfilerComponent.WIDGET_CONFIG.id) {
            // Assign the next unique ID
            const id = props.appStore.widgetsStore.addNewSpatialProfileWidget();
            props.appStore.widgetsStore.changeWidgetId(props.id, id);
        }
        else {
            if (!this.props.appStore.widgetsStore.spatialProfileWidgets.has(this.props.id)) {
                console.error(`can't find store for widget with id=${this.props.id}`);
                this.props.appStore.widgetsStore.spatialProfileWidgets.set(this.props.id, new SpatialProfileWidgetStore());
            }
        }
        // Update widget title when region or coordinate changes
        autorun(() => {
            if (this.widgetStore) {
                const coordinate = this.widgetStore.coordinate;
                const appStore = this.props.appStore;
                if (appStore && coordinate) {
                    const coordinateString = `${coordinate.toUpperCase()} Profile`;
                    const regionString = this.widgetStore.regionId === 0 ? "Cursor" : `Region #${this.widgetStore.regionId}`;
                    this.props.appStore.widgetsStore.setWidgetTitle(this.props.id, `${coordinateString}: ${regionString}`);
                }
            }
            else {
                this.props.appStore.widgetsStore.setWidgetTitle(this.props.id, `X Profile: Cursor`);
            }
        });
    }

    onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    private formatXProfileAst = (v) => {
        const frame = this.props.appStore.getFrame(this.widgetStore.fileId);
        if (!frame) {
            return v;
        }
        const pointWCS = AST.pixToWCS(frame.wcsInfo, v, this.profileStore.y);
        const normVals = AST.normalizeCoordinates(frame.wcsInfo, pointWCS.x, pointWCS.y);
        return AST.getFormattedCoordinates(frame.wcsInfo, normVals.x, undefined).x;
    };

    private formatYProfileAst = (v) => {
        const frame = this.props.appStore.getFrame(this.widgetStore.fileId);
        if (!frame) {
            return v;
        }
        const pointWCS = AST.pixToWCS(frame.wcsInfo, this.profileStore.x, v);
        const normVals = AST.normalizeCoordinates(frame.wcsInfo, pointWCS.x, pointWCS.y);
        return AST.getFormattedCoordinates(frame.wcsInfo, undefined, normVals.y).y;
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
            usePointSymbols: this.widgetStore.usePoints,
            interpolateLines: this.widgetStore.interpolateLines,
            forceScientificNotationTicksY: true,
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

                if (frame.validWcs && this.widgetStore.wcsAxisVisible) {
                    linePlotProps.showTopAxis = true;
                    if (isXProfile) {
                        linePlotProps.topAxisTickFormatter = this.formatXProfileAst;
                    }
                    else {
                        linePlotProps.topAxisTickFormatter = this.formatYProfileAst;
                    }
                }
                else {
                    linePlotProps.showTopAxis = false;
                }

                const currentPlotData = this.plotData;
                if (currentPlotData) {
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
                }
                const markerValue = isXProfile ? this.profileStore.x : this.profileStore.y;
                linePlotProps.markers = [{
                    value: markerValue,
                    id: "marker-min",
                    draggable: false,
                    horizontal: false,
                }];

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