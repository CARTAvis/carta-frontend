import * as React from "react";
import * as _ from "lodash";
import {autorun, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Colors, NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {LinePlotComponent, LinePlotComponentProps, PopoverSettingsComponent, PlotType} from "components/Shared";
import {SpectralProfilerSettingsPanelComponent} from "./SpectralProfilerSettingsPanelComponent/SpectralProfilerSettingsPanelComponent";
import {FrameStore, SpectralProfileStore, WidgetConfig, WidgetProps} from "stores";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {Point2D} from "models";
import {clamp} from "utilities";
import "./SpectralProfilerComponent.css";

// The fixed size of the settings panel popover (excluding the show/hide button)
const PANEL_CONTENT_WIDTH = 180;

@observer
export class SpectralProfilerComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "spectral-profiler",
            type: "spectral-profiler",
            minWidth: 250,
            minHeight: 225,
            defaultWidth: 650,
            defaultHeight: 225,
            title: "Z Profile: Cursor",
            isCloseable: true
        };
    }

    @observable width: number;
    @observable height: number;

    @computed get widgetStore(): SpectralProfileWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.spectralProfileWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.spectralProfileWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.error("can't find store for widget");
        return new SpectralProfileWidgetStore();
    }

    @computed get profileStore(): SpectralProfileStore {
        if (this.props.appStore && this.props.appStore.activeFrame) {
            let keyStruct = {fileId: this.widgetStore.fileId, regionId: this.widgetStore.regionId};
            // Replace "current file" fileId with active frame's fileId
            if (this.widgetStore.fileId === -1) {
                keyStruct.fileId = this.props.appStore.activeFrame.frameInfo.fileId;
            }
            const key = `${keyStruct.fileId}-${keyStruct.regionId}`;
            return this.props.appStore.spectralProfiles.get(key);
        }
        return undefined;
    }

    @computed get frame(): FrameStore {
        if (this.props.appStore && this.widgetStore) {
            return this.props.appStore.getFrame(this.widgetStore.fileId);
        } else {
            return undefined;
        }
    }

    @computed get settingsPanelWidth(): number {
        return 20 + (this.widgetStore.settingsPanelVisible ? PANEL_CONTENT_WIDTH : 0);
    }

    @computed get plotData(): { values: Array<Point2D>, xMin: number, xMax: number, yMin: number, yMax: number, yMean: number, yRms: number } {
        if (!this.frame) {
            return null;
        }

        // Use accurate profiles from server-sent data
        const coordinateData = this.profileStore.profiles.get(this.widgetStore.coordinate);
        let channelInfo = this.frame.channelInfo;
        if (coordinateData && channelInfo && coordinateData.vals && coordinateData.vals.length && coordinateData.vals.length === channelInfo.values.length) {
            let channelValues = this.widgetStore.useWcsValues ? channelInfo.values : channelInfo.indexes;
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

            // values are needed to be sorted in incremental order for binary search
            let values: Array<{ x: number, y: number }> = [];
            let isIncremental = channelValues[0] <= channelValues[channelValues.length - 1] ? true : false;
            for (let i = 0; i < channelValues.length; i++) {
                let index = isIncremental ? i : channelValues.length - 1 - i;
                const x = channelValues[index];
                const y = coordinateData.vals[index];

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
        return null;
    }

    constructor(props: WidgetProps) {
        super(props);
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === SpectralProfilerComponent.WIDGET_CONFIG.id) {
            // Assign the next unique ID
            const id = props.appStore.widgetsStore.addNewSpectralProfileWidget();
            props.appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!this.props.appStore.widgetsStore.spectralProfileWidgets.has(this.props.id)) {
                console.error(`can't find store for widget with id=${this.props.id}`);
                this.props.appStore.widgetsStore.spectralProfileWidgets.set(this.props.id, new SpectralProfileWidgetStore());
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
            } else {
                this.props.appStore.widgetsStore.setWidgetTitle(this.props.id, `Z Profile: Cursor`);
            }
        });
    }

    onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    onChannelChanged = (x: number) => {
        if (this.props.appStore.activeFrame && this.frame.channelInfo) {
            let channelInfo = this.frame.channelInfo;
            let nearestIndex = (this.widgetStore.useWcsValues && channelInfo.getChannelIndexWCS) ?
                            channelInfo.getChannelIndexWCS(x) :
                            channelInfo.getChannelIndexSimple(x);
            if (nearestIndex !== null && nearestIndex !== undefined) {
                this.props.appStore.activeFrame.setChannels(nearestIndex, this.props.appStore.activeFrame.requiredStokes);
            }
        }
    }

    private getChannelValue = (): number => {
        const channel = this.frame.channel;
        if (this.widgetStore.useWcsValues && this.frame.channelInfo) {
            const channelInfo = this.frame.channelInfo;
            if (channel >= 0 && channel < channelInfo.values.length) {
                return channelInfo.values[channel];
            }
        }
        return channel;
    };

    private getChannelLabel = (): string => {
        if (this.widgetStore.useWcsValues && this.frame.channelInfo) {
            const channelInfo = this.frame.channelInfo;
            let channelLabel = channelInfo.channelType.name;
            if (channelInfo.channelType.unit && channelInfo.channelType.unit.length) {
                channelLabel += ` (${channelInfo.channelType.unit})`;
            }
            return channelLabel;
        }
        return null;
    };

    private getChannelUnit = (): string => {
        if (this.widgetStore.useWcsValues && this.frame.channelInfo && this.frame.channelInfo.channelType.unit) {
            return this.frame.channelInfo.channelType.unit;
        }
        return "Channel";
    };

    onGraphCursorMoved = _.throttle((x) => {
        this.widgetStore.setCursor(x);
    }, 33);

    render() {
        const appStore = this.props.appStore;
        if (!this.widgetStore) {
            return <NonIdealState icon={"error"} title={"Missing profile"} description={"Profile not found"}/>;
        }

        const imageName = (appStore.activeFrame ? appStore.activeFrame.frameInfo.fileInfo.name : undefined);

        let linePlotProps: LinePlotComponentProps = {
            xLabel: "Channel",
            yLabel: "Value",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: `Z profile`,
            usePointSymbols: this.widgetStore.plotType === PlotType.POINTS,
            interpolateLines: this.widgetStore.plotType === PlotType.LINES,
            forceScientificNotationTicksY: true,
            graphClicked: this.onChannelChanged,
            graphZoomedX: this.widgetStore.setXBounds,
            graphZoomedY: this.widgetStore.setYBounds,
            graphZoomedXY: this.widgetStore.setXYBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true,
            markers: []
        };

        if (appStore.activeFrame) {
            if (this.profileStore && this.frame) {
                if (this.frame.unit) {
                    linePlotProps.yLabel = `Value (${this.frame.unit})`;
                }
                const currentPlotData = this.plotData;
                if (currentPlotData) {
                    linePlotProps.data = currentPlotData.values;
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

                const wcsLabel = this.getChannelLabel();
                if (wcsLabel) {
                    linePlotProps.xLabel = this.getChannelLabel();
                }
                linePlotProps.cursorX = {
                    profiler: this.widgetStore.cursorX,
                    image: this.getChannelValue(),
                    unit: this.getChannelUnit()
                };

                linePlotProps.markers = [{
                    value: linePlotProps.cursorX.image,
                    id: "marker-channel",
                    draggable: true,
                    dragMove: this.onChannelChanged,
                    horizontal: false,
                }];

                linePlotProps.markers.push({
                    value: linePlotProps.cursorX.profiler,
                    id: "marker-profiler-cursor",
                    draggable: false,
                    horizontal: false,
                    color: appStore.darkTheme ? Colors.GRAY4 : Colors.GRAY2,
                    opacity: 0.8,
                    isMouseMove: true,
                });

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

                    linePlotProps.dataStat = {mean: currentPlotData.yMean, rms: currentPlotData.yRms};
                }

                // TODO: Get comments from region info, rather than directly from cursor position
                if (appStore.cursorInfo) {
                    const comments: string[] = [];
                    comments.push(`region (pixel): Point[${appStore.cursorInfo.posImageSpace.x.toFixed(0)}, ${appStore.cursorInfo.posImageSpace.y.toFixed(0)}]`);
                    if (appStore.cursorInfo.infoWCS) {
                        comments.push(`region (world): Point[${appStore.cursorInfo.infoWCS.x}, ${appStore.cursorInfo.infoWCS.y}]`);
                    }
                    linePlotProps.comments = comments;
                }
            }
        }

        return (
            <div className={"spectral-profiler-widget"}>
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
                    <SpectralProfilerSettingsPanelComponent widgetStore={this.widgetStore} appStore={appStore}/>
                </PopoverSettingsComponent>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}
