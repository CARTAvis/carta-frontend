import * as React from "react";
import ReactResizeDetector from "react-resize-detector";
import SplitPane, {Pane} from "react-split-pane";
import {Classes, Colors, NonIdealState} from "@blueprintjs/core";
import classNames from "classnames";
import * as _ from "lodash";
import {action, autorun, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {LineMarker, LinePlotComponent, LinePlotComponentProps, LinePlotSelectingMode, PlotType, SmoothingType} from "components/Shared";
import {Point2D, SpectralType} from "models";
import {AnimatorStore, AppStore, DefaultWidgetConfig, FittingContinuum, HelpType, WidgetProps, WidgetsStore} from "stores";
import {MultiPlotData, SpectralProfileWidgetStore} from "stores/Widgets";
import {binarySearchByX, clamp, formattedExponential, getColorForTheme, toExponential, toFixed, toFormattedNotationByDiff} from "utilities";

import {MultiPlotProps, TickType} from "../Shared/LinePlot/PlotContainer/PlotContainerComponent";

import {ProfileInfo, SpectralProfilerInfoComponent} from "./SpectralProfilerInfoComponent/SpectralProfilerInfoComponent";
import {SpectralProfilerToolbarComponent} from "./SpectralProfilerToolbarComponent/SpectralProfilerToolbarComponent";

import "./SpectralProfilerComponent.scss";

const INFO_HEIGHT_MIN = 28;
const INFO_HEIGHT_MAX = 100;
@observer
export class SpectralProfilerComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "spectral-profiler",
            type: "spectral-profiler",
            minWidth: 880,
            minHeight: 300,
            defaultWidth: 870,
            defaultHeight: 300,
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

    @computed get plotData(): MultiPlotData {
        return this.widgetStore.plotData;
    }

    @computed get isMeanRmsVisible(): boolean {
        // Show Mean/RMS when only 1 profile
        return this.widgetStore.meanRmsVisible && this.plotData?.numProfiles === 1;
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

        // Update widget title
        autorun(() => {
            let title = "Z Profile";
            const currentData = this.plotData;
            if (this.widgetStore && currentData && isFinite(currentData.progress)) {
                if (currentData.progress < 1.0) {
                    const totalProgress = currentData.numProfiles * 100;
                    title += `: [${toFixed(currentData.progress * totalProgress)}%/${totalProgress}% complete]`;
                    this.widgetStore.updateStreamingDataStatus(true);
                } else {
                    this.widgetStore.updateStreamingDataStatus(false);
                }
            }
            appStore.widgetsStore.setWidgetTitle(this.props.id, title);
        });
    }

    @action private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    onChannelChanged = (x: number) => {
        const frame = this.widgetStore.effectiveFrame;
        const appStore = AppStore.Instance;
        if (x === null || x === undefined || !isFinite(x) || AnimatorStore.Instance.animationActive || this.widgetStore.fittingStore.isCursorSelectingComponent) {
            return;
        }
        const nearestIndex = frame.findChannelIndexByValue(x);
        if (frame && isFinite(nearestIndex) && nearestIndex >= 0 && nearestIndex < frame.numChannels) {
            frame.setChannel(nearestIndex);
            if (!_.isEqual(frame, appStore.activeFrame)) {
                appStore.setChannelsByFrame(frame);
            }
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
        } else if (this.widgetStore.fittingStore.isCursorSelectingYIntercept) {
            return LinePlotSelectingMode.LINE;
        } else if (this.widgetStore.fittingStore.isCursorSelectingSlope) {
            return LinePlotSelectingMode.LINE;
        } else if (this.widgetStore.fittingStore.isCursorSelectingComponent) {
            return LinePlotSelectingMode.BOX;
        }
        return LinePlotSelectingMode.BOX;
    }

    onGraphCursorMoved = _.throttle(x => {
        this.widgetStore.setCursor(x);
    }, 33);

    private precisionFormatting = (data: number, diff: number, spectralType: SpectralType): string => {
        return spectralType === SpectralType.CHANNEL ? toFixed(data) : toFormattedNotationByDiff(data, diff);
    };

    private genCursorInfoString = (data: Point2D[], smoothedData: Point2D[], secondaryXData: number[], cursorXValue: number, cursorXUnit: string, label: string): string => {
        const frame = this.widgetStore.effectiveFrame;

        let diffLeft: number = undefined;
        let secondaryXUnit = "";
        let secondaryChannelString = "";
        let cursorInfoString: string = "";

        const nearest = binarySearchByX(data, cursorXValue);
        const nearestSmooth = smoothedData.length ? binarySearchByX(smoothedData, cursorXValue) : null;
        if (nearest?.point && nearest?.index >= 0 && nearest?.index < data?.length) {
            let primaryXStr: string = "";
            let smoothedFloatXStr = "";
            const currentIndex = nearest.index;
            const neighborIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex + 1;
            diffLeft = data.length === 1 ? 1e-9 : Math.abs(data[currentIndex].x - data[neighborIndex].x);
            primaryXStr = this.precisionFormatting(data[currentIndex].x, diffLeft, frame.spectralType);
            smoothedFloatXStr = this.precisionFormatting(nearestSmooth?.point.x, diffLeft, frame.spectralType);

            let xLabel = cursorXUnit === "Channel" ? `Channel ${primaryXStr}` : `${primaryXStr}${cursorXUnit ? ` ${cursorXUnit}` : ""}`;

            if (this.widgetStore.secondaryAxisCursorInfoVisible) {
                diffLeft = data.length === 1 ? 1e-9 : Math.abs(secondaryXData[currentIndex] - secondaryXData[neighborIndex]);
                const secondaryXStr = this.precisionFormatting(secondaryXData[currentIndex], diffLeft, frame.spectralTypeSecondary);

                if (frame.spectralTypeSecondary !== SpectralType.CHANNEL) {
                    secondaryXUnit = frame.spectralUnitSecondary;
                } else {
                    secondaryChannelString = "Channel";
                }

                xLabel += secondaryChannelString === "Channel" ? `, Channel ${secondaryXStr}` : `, ${secondaryXStr}${secondaryXUnit ? ` ${secondaryXUnit}` : ""}`;
            }
            const smoothedXLabel = cursorXUnit === "Channel" ? `${cursorXUnit} ${toFixed(nearestSmooth?.point.x, 0)}` : `${smoothedFloatXStr} ${cursorXUnit}`;
            if (nearestSmooth && this.widgetStore.smoothingStore.isOverlayOn) {
                cursorInfoString = `(${xLabel}, ${toExponential(nearest.point.y, 2)}), Smoothed: (${smoothedXLabel}, ${toExponential(nearestSmooth.point.y, 2)})`;
            } else if (nearestSmooth) {
                cursorInfoString = `(${smoothedXLabel}, ${toExponential(nearestSmooth.point.y, 2)})`;
            } else {
                cursorInfoString = `(${xLabel}, ${toExponential(nearest.point.y, 2)})`;
            }
        }
        return `${label}: ${cursorInfoString ?? "---"}`;
    };

    private genProfilerInfo = (): ProfileInfo[] => {
        let profilerInfo: ProfileInfo[] = [];
        const frame = this.widgetStore.effectiveFrame;
        if (frame && this.plotData?.numProfiles > 0 && this.plotData?.data) {
            const isCursorInsideLinePlots = this.widgetStore.isMouseMoveIntoLinePlots;
            const label = isCursorInsideLinePlots ? "Cursor" : "Data";
            const cursorXValue = isCursorInsideLinePlots ? this.widgetStore.cursorX : this.currentChannelValue;
            const cursorXUnit = frame.spectralUnitStr;

            if (this.plotData.numProfiles === 1 && !(this.widgetStore.smoothingStore.type !== SmoothingType.NONE && this.widgetStore.smoothingStore.isOverlayOn)) {
                // Single profile, Mean/RMS is available
                const data = this.plotData.data[0];
                const smoothedData = this.plotData.smoothedData[0];
                const secondary = this.plotData.secondaryXData[0];
                const cursorInfoString = this.genCursorInfoString(data, smoothedData, secondary, cursorXValue, cursorXUnit, label);
                profilerInfo.push({
                    infoString: this.isMeanRmsVisible ? `${cursorInfoString}, Mean/RMS: ${formattedExponential(this.plotData.yMean, 2)}/${formattedExponential(this.plotData.yRms, 2)}` : cursorInfoString
                });
            } else {
                for (let i = 0; i < this.plotData.numProfiles; i++) {
                    const data = this.plotData.data[i];
                    const smoothedData = this.plotData.smoothedData[i];
                    const secondary = this.plotData.secondaryXData[i];
                    const cursorInfoString = this.genCursorInfoString(data, smoothedData, secondary, cursorXValue, cursorXUnit, label);
                    profilerInfo.push({
                        color: this.plotData.colors?.[i],
                        infoString: `${cursorInfoString}, ${this.plotData.labels?.[i]?.image}, ${this.plotData.labels?.[i]?.plot}`
                    });
                }
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

    private setSelectedLine = (startX: number, endX: number, startY: number, endY: number) => {
        if (isFinite(startX) && isFinite(endX) && isFinite(startY) && isFinite(endY)) {
            if (this.widgetStore.fittingStore.isCursorSelectingYIntercept) {
                this.widgetStore.fittingStore.setYIntercept((startY + endY) / 2);
                this.widgetStore.fittingStore.setIsCursorSelectingYIntercept(false);
            } else if (this.widgetStore.fittingStore.isCursorSelectingSlope) {
                const slope = (endY - startY) / (endX - startX);
                this.widgetStore.fittingStore.setYIntercept(startY - slope * startX);
                this.widgetStore.fittingStore.setSlope(slope);
                this.widgetStore.fittingStore.setIsCursorSelectingSlope(false);
            }
        }
    };

    private setSelectedBox = (xMin: number, xMax: number, yMin: number, yMax: number) => {
        if (isFinite(xMin) && isFinite(xMax) && isFinite(yMin) && isFinite(yMax)) {
            this.widgetStore.fittingStore.setComponentByCursor(xMin, xMax, yMin, yMax);
        }
    };

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
            return <NonIdealState icon={"error"} title={"Missing profile"} description={"Profile not found"} />;
        }

        let linePlotProps: LinePlotComponentProps = {
            xLabel: "Channel",
            yLabel: "Value",
            darkMode: appStore.darkTheme,
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
            isSelectingInsideBox: this.widgetStore.fittingStore.isCursorSelectingComponent,
            setSelectedInsideBox: this.setSelectedBox,
            setSelectedLine: this.setSelectedLine,
            insideBoxes: this.widgetStore.fittingStore.componentPlottingBoxes,
            insideTexts: this.widgetStore.fittingStore.componentResultNumber,
            zeroLineWidth: 2,
            order: 1,
            multiPlotPropsMap: new Map<string, MultiPlotProps>()
        };

        const frame = this.widgetStore.effectiveFrame;
        if (frame) {
            if (frame.spectralAxis && !frame.isCoordChannel) {
                linePlotProps.xLabel = frame.spectralLabel;
            }
            if (this.widgetStore.yUnit) {
                linePlotProps.yLabel = `Value (${this.widgetStore.yUnit})`;
            }

            const currentPlotData = this.plotData;
            const fittingStore = this.widgetStore.fittingStore;
            if (currentPlotData?.numProfiles > 0) {
                linePlotProps.imageName = currentPlotData.plotName?.image;
                linePlotProps.plotName = currentPlotData.plotName?.plot;
                // Fill profile & smoothed profiles
                for (let i = 0; i < currentPlotData.numProfiles; i++) {
                    const smoothingStore = this.widgetStore.smoothingStore;
                    const imageName = currentPlotData.labels[i]?.image;
                    const plotName = `Z-profile-${currentPlotData.labels[i]?.plot}`.replace(/,\s/g, "-")?.replace(/\s/g, "_");
                    if (i < currentPlotData.data?.length) {
                        linePlotProps.multiPlotPropsMap.set(`profile${i}`, {
                            imageName: imageName,
                            plotName: plotName,
                            data: currentPlotData.data[i],
                            type: this.widgetStore.plotType,
                            borderColor: currentPlotData.colors[i],
                            comments: currentPlotData.comments[i],
                            order: 1,
                            hidden: smoothingStore.type !== SmoothingType.NONE && !smoothingStore.isOverlayOn,
                            followingData: this.widgetStore.profileNum === 1 && fittingStore.hasResult && smoothingStore.type === SmoothingType.NONE ? ["fittingModel", "fittingResidual"] : null
                        });
                    }

                    if (smoothingStore.type !== SmoothingType.NONE && i < currentPlotData.smoothedData?.length) {
                        linePlotProps.multiPlotPropsMap.set(`smoothedProfile${i}`, {
                            imageName: imageName,
                            plotName: `${plotName}-smoothed`,
                            data: currentPlotData.smoothedData[i],
                            type: smoothingStore.lineType,
                            borderColor: currentPlotData.numProfiles > 1 ? currentPlotData.colors[i] : getColorForTheme(smoothingStore.lineColor),
                            borderWidth: currentPlotData.numProfiles > 1 ? this.widgetStore.lineWidth + 1 : smoothingStore.lineWidth,
                            pointRadius: smoothingStore.pointRadius,
                            order: 0,
                            comments: [...currentPlotData.comments[i], ...smoothingStore.comments],
                            followingData: this.widgetStore.profileNum === 1 && fittingStore.hasResult ? ["fittingModel", "fittingResidual"] : null
                        });
                    }
                }

                // Opacity ranges from 0.15 to 0.40 when data is in progress, and is 1.0 when finished
                linePlotProps.opacity = currentPlotData.progress < 1.0 ? 0.15 + currentPlotData.progress / 4.0 : 1.0;

                // set line color
                let primaryLineColor = getColorForTheme(this.widgetStore.primaryLineColor);
                linePlotProps.lineColor = primaryLineColor;

                if (this.widgetStore.profileNum === 1) {
                    if (fittingStore.continuum !== FittingContinuum.NONE && !fittingStore.hasResult) {
                        let fittingPlotProps: MultiPlotProps = {
                            imageName: currentPlotData.plotName.image,
                            plotName: currentPlotData.plotName.plot,
                            data: fittingStore.baseLinePoint2DArray,
                            type: PlotType.LINES,
                            borderColor: getColorForTheme("auto-lime"),
                            borderWidth: 2,
                            pointRadius: 1,
                            order: 0,
                            noExport: true
                        };
                        linePlotProps.multiPlotPropsMap.set("fittingBaseline", fittingPlotProps);
                    }
                    if (fittingStore.hasResult) {
                        let fittingPlotProps: MultiPlotProps = {
                            imageName: currentPlotData.plotName.image,
                            plotName: currentPlotData.plotName.plot,
                            data: fittingStore.modelPoint2DArray,
                            type: PlotType.LINES,
                            borderColor: getColorForTheme("auto-orange"),
                            borderWidth: 2,
                            pointRadius: 1,
                            order: 0,
                            noExport: true
                        };
                        linePlotProps.multiPlotPropsMap.set("fittingModel", fittingPlotProps);

                        for (let i = 0; i < fittingStore.individualModelPoint2DArrays.length; i++) {
                            const individualPlotProps: MultiPlotProps = {
                                imageName: currentPlotData.plotName.image,
                                plotName: currentPlotData.plotName.plot,
                                data: fittingStore.individualModelPoint2DArrays[i],
                                type: PlotType.LINES,
                                borderColor: getColorForTheme("auto-orange"),
                                borderWidth: 2,
                                pointRadius: 1,
                                order: 0,
                                opacity: 0.6,
                                noExport: true
                            };
                            linePlotProps.multiPlotPropsMap.set(`fittingModel(${i + 1})`, individualPlotProps);
                        }

                        if (fittingStore.enableResidual) {
                            let fittingResidualPlotProps: MultiPlotProps = {
                                imageName: currentPlotData.plotName.image,
                                plotName: currentPlotData.plotName.plot,
                                data: fittingStore.residualPoint2DArray,
                                type: PlotType.POINTS,
                                borderColor: getColorForTheme("auto-orange"),
                                borderWidth: 2,
                                pointRadius: 1,
                                order: 0,
                                noExport: true
                            };
                            linePlotProps.multiPlotPropsMap.set("fittingResidual", fittingResidualPlotProps);
                        }
                    }
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
                    isMouseMove: true
                });
            }
            if (!isNaN(this.currentChannelValue)) {
                linePlotProps.markers.push({
                    value: this.currentChannelValue,
                    id: "marker-channel-current",
                    opacity: 0.4,
                    draggable: false,
                    horizontal: false
                });
            }
            if (!isNaN(this.requiredChannelValue)) {
                linePlotProps.markers.push({
                    value: this.requiredChannelValue,
                    id: "marker-channel-required",
                    draggable: !AnimatorStore.Instance.animationActive,
                    dragMove: this.onChannelChanged,
                    horizontal: false
                });
            }

            if (this.isMeanRmsVisible && isFinite(currentPlotData.yMean) && isFinite(currentPlotData.yRms)) {
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
        }

        const className = classNames("spectral-profiler-widget", {[Classes.DARK]: appStore.darkTheme, "linked-to-widget-highlighted": this.widgetStore.isHighlighted});

        return (
            <div className={className}>
                <div className="profile-container">
                    <div className="profile-toolbar">
                        <SpectralProfilerToolbarComponent widgetStore={this.widgetStore} id={this.props.id} />
                    </div>
                    <SplitPane
                        className="body-split-pane"
                        split="horizontal"
                        primary={"second"}
                        defaultSize={clamp(this.plotData?.numProfiles > 0 ? this.plotData.numProfiles * 20 : INFO_HEIGHT_MIN, INFO_HEIGHT_MIN, INFO_HEIGHT_MAX)}
                        minSize={INFO_HEIGHT_MIN}
                    >
                        <Pane className={"line-plot-container"}>
                            <LinePlotComponent {...linePlotProps} />
                        </Pane>
                        <Pane className={"info-container"}>
                            <SpectralProfilerInfoComponent profileInfo={this.genProfilerInfo()} />
                        </Pane>
                    </SplitPane>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33} />
            </div>
        );
    }
}
