import * as React from "react";
import * as _ from "lodash";
import * as AST from "ast_wrapper";
import {autorun, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Colors, NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {LinePlotComponent, LinePlotComponentProps, PlotType, ProfilerInfoComponent, VERTICAL_RANGE_PADDING} from "components/Shared";
import {TickType} from "../Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {SpectralProfilerToolbarComponent} from "./SpectralProfilerToolbarComponent/SpectralProfilerToolbarComponent";
import {AnimationState, SpectralProfileStore, WidgetConfig, WidgetProps, HelpType} from "stores";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {Point2D, ProcessedSpectralProfile} from "models";
import {binarySearchByX, clamp, formattedNotation, toExponential, toFixed} from "utilities";
import "./SpectralProfilerComponent.css";

type PlotData = { values: Point2D[], xMin: number, xMax: number, yMin: number, yMax: number, yMean: number, yRms: number, progress: number };

@observer
export class SpectralProfilerComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "spectral-profiler",
            type: "spectral-profiler",
            minWidth: 250,
            minHeight: 225,
            defaultWidth: 650,
            defaultHeight: 275,
            title: "Z Profile: Cursor",
            isCloseable: true,
            helpType: HelpType.SPECTRAL_PROFILER
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
        console.log("can't find store for widget");
        return new SpectralProfileWidgetStore(this.props.appStore);
    }

    @computed get profileStore(): SpectralProfileStore {
        if (this.props.appStore && this.props.appStore.activeFrame) {
            let fileId = this.props.appStore.activeFrame.frameInfo.fileId;
            const regionId = this.widgetStore.effectiveRegionId;
            const frameMap = this.props.appStore.spectralProfiles.get(fileId);
            if (frameMap) {
                return frameMap.get(regionId);
            }
        }
        return null;
    }

    @computed get plotData(): PlotData {
        const frame = this.props.appStore.activeFrame;
        if (!frame) {
            return null;
        }

        const fileId = frame.frameInfo.fileId;
        let coordinateData: ProcessedSpectralProfile;
        let regionId = this.widgetStore.effectiveRegionId;
        if (frame.regionSet) {
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);
            if (region && this.profileStore) {
                coordinateData = this.profileStore.getProfile(this.widgetStore.coordinate, region.isClosedRegion ? this.widgetStore.statsType : CARTA.StatsType.Sum);
            }
        }

        if (coordinateData && coordinateData.values && coordinateData.values.length &&
            this.widgetStore.channelValues && this.widgetStore.channelValues.length &&
            coordinateData.values.length === this.widgetStore.channelValues.length) {
            const channelValues = this.widgetStore.channelValues;
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
            const isIncremental = channelValues[0] <= channelValues[channelValues.length - 1];
            for (let i = 0; i < channelValues.length; i++) {
                let index = isIncremental ? i : channelValues.length - 1 - i;
                const x = channelValues[index];
                const y = coordinateData.values[index];

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
            } else {
                // extend y range a bit
                const range = yMax - yMin;
                yMin -= range * VERTICAL_RANGE_PADDING;
                yMax += range * VERTICAL_RANGE_PADDING;
            }
            return {values, xMin, xMax, yMin, yMax, yMean, yRms, progress: coordinateData.progress};
        }
        return null;
    }

    @computed get exportHeaders(): string[] {
        let headerString = [];
        const frame = this.props.appStore.activeFrame;
        if (frame && frame.frameInfo && frame.regionSet) {
            const regionId = this.widgetStore.effectiveRegionId;
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);

            // statistic type, ignore when region == cursor
            if (regionId !== 0) {
                headerString.push(`statistic: ${SpectralProfileWidgetStore.StatsTypeString(this.widgetStore.statsType)}`);
            }
            // region info
            if (region) {
                headerString.push(region.regionProperties);
            }
        }
        return headerString;
    }

    constructor(props: WidgetProps) {
        super(props);
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === SpectralProfilerComponent.WIDGET_CONFIG.type) {
            // Assign the next unique ID
            const id = props.appStore.widgetsStore.addSpectralProfileWidget();
            props.appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!this.props.appStore.widgetsStore.spectralProfileWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                this.props.appStore.widgetsStore.addSpectralProfileWidget(this.props.id);
            }
        }
        // Update widget title when region or coordinate changes
        autorun(() => {
            if (this.widgetStore) {
                const coordinate = this.widgetStore.coordinate;
                const appStore = this.props.appStore;
                const frame = appStore.activeFrame;
                let progressString = "";
                const currentData = this.plotData;
                if (currentData && isFinite(currentData.progress) && currentData.progress < 1.0) {
                    progressString = `[${toFixed(currentData.progress * 100)}% complete]`;
                }
                if (frame && coordinate) {
                    let coordinateString: string;
                    if (coordinate.length === 2) {
                        coordinateString = `Z Profile (Stokes ${coordinate[0]})`;
                    } else {
                        coordinateString = `Z Profile`;
                    }
                    const regionId = this.widgetStore.effectiveRegionId;
                    const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
                    const selectedString = this.widgetStore.matchesSelectedRegion ? "(Active)" : "";
                    this.props.appStore.widgetsStore.setWidgetTitle(this.props.id, `${coordinateString}: ${regionString} ${selectedString} ${progressString}`);
                }
                if (currentData) {
                    this.widgetStore.initXYBoundaries(currentData.xMin, currentData.xMax, currentData.yMin, currentData.yMax);
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
        const frame = this.props.appStore.activeFrame;
        if (this.props.appStore.animatorStore.animationState === AnimationState.PLAYING) {
            return;
        }

        if (frame && frame.channelInfo) {
            let channelInfo = frame.channelInfo;
            let nearestIndex;
            if (this.widgetStore.isCoordChannel) {
                nearestIndex = channelInfo.getChannelIndexSimple(x);
            } else {
                if (this.widgetStore.isSpectralPropsEqual) {
                    nearestIndex = channelInfo.getChannelIndexWCS(x);
                } else {
                    // invert x in selected widget wcs to frame's default wcs
                    const tx =  AST.transformSpectralPoint(frame.spectralFrame, this.widgetStore.spectralType, this.widgetStore.spectralUnit, this.widgetStore.spectralSystem, x, false);
                    nearestIndex = channelInfo.getChannelIndexWCS(tx);
                }
            }
            if (nearestIndex !== null && nearestIndex !== undefined) {
                frame.setChannels(nearestIndex, frame.requiredStokes);
            }
        }
    };

    @computed get currentChannelValue(): number {
        const frame = this.props.appStore.activeFrame;
        if (!frame || !this.widgetStore.channelValues) {
            return null;
        }
        const channel = frame.channel;
        if (channel < 0 || channel >= this.widgetStore.channelValues.length) {
            return null;
        }
        return this.widgetStore.isCoordChannel ? channel : this.widgetStore.channelValues[channel];
    }

    @computed get requiredChannelValue(): number {
        const frame = this.props.appStore.activeFrame;
        if (!frame || !this.widgetStore.channelValues) {
            return null;
        }
        const channel = frame.requiredChannel;
        if (channel < 0 || channel >= this.widgetStore.channelValues.length) {
            return null;
        }
        return this.widgetStore.isCoordChannel ? channel : this.widgetStore.channelValues[channel];
    }

    private getChannelUnit = (): string => {
        return this.widgetStore.isCoordChannel ? "Channel" : this.widgetStore.spectralUnit;
    };

    onGraphCursorMoved = _.throttle((x) => {
        this.widgetStore.setCursor(x);
    }, 33);

    private genProfilerInfo = (): string[] => {
        let profilerInfo: string[] = [];
        const frame = this.props.appStore.activeFrame;
        if (frame && this.plotData) {
            const cursorX = {
                profiler: this.widgetStore.cursorX,
                image: this.currentChannelValue,
                unit: this.getChannelUnit()
            };
            const data = this.plotData.values;
            const nearest = binarySearchByX(data, this.widgetStore.isMouseMoveIntoLinePlots ? cursorX.profiler : cursorX.image);
            let cursorString = "";
            if (nearest && nearest.point && nearest.index >= 0 && nearest.index < data.length) {
                let floatXStr = "";
                const diffLeft = nearest.index - 1 >= 0 ? Math.abs(nearest.point.x - data[nearest.index - 1].x) : 0;
                if (diffLeft > 0 && diffLeft < 1e-6) {
                    floatXStr = formattedNotation(nearest.point.x);
                } else if (diffLeft >= 1e-6  && diffLeft < 1e-3) {
                    floatXStr = toFixed(nearest.point.x, 6);
                } else {
                    floatXStr = toFixed(nearest.point.x, 3);
                }
                const xLabel = cursorX.unit === "Channel" ? "Channel " + toFixed(nearest.point.x) : floatXStr + " " + cursorX.unit;
                cursorString =  "(" + xLabel + ", " + toExponential(nearest.point.y, 2) + ")";
            }

            profilerInfo.push(`${this.widgetStore.isMouseMoveIntoLinePlots ? "Cursor:" : "Data:"} ${cursorString}`);
            if (this.widgetStore.meanRmsVisible) {
                profilerInfo.push(`Mean/RMS: ${formattedNotation(this.plotData.yMean) + " / " + formattedNotation(this.plotData.yRms)}`);
            }
        }
        return profilerInfo;
    };

    render() {
        const appStore = this.props.appStore;
        if (!this.widgetStore) {
            return <NonIdealState icon={"error"} title={"Missing profile"} description={"Profile not found"}/>;
        }

        const frame = appStore.activeFrame;
        const imageName = (frame ? frame.frameInfo.fileInfo.name : undefined);

        let linePlotProps: LinePlotComponentProps = {
            xLabel: "Channel",
            yLabel: "Value",
            darkMode: appStore.darkTheme,
            imageName: imageName,
            plotName: `Z profile`,
            usePointSymbols: this.widgetStore.plotType === PlotType.POINTS,
            interpolateLines: this.widgetStore.plotType === PlotType.LINES,
            tickTypeY: TickType.Scientific,
            graphClicked: this.onChannelChanged,
            graphZoomedX: this.widgetStore.setXBounds,
            graphZoomedY: this.widgetStore.setYBounds,
            graphZoomedXY: this.widgetStore.setXYBounds,
            graphZoomReset: this.widgetStore.clearXYBounds,
            graphCursorMoved: this.onGraphCursorMoved,
            scrollZoom: true,
            markers: [],
            mouseEntered: this.widgetStore.setMouseMoveIntoLinePlots,
            borderWidth: this.widgetStore.lineWidth,
            pointRadius: this.widgetStore.linePlotPointSize,
            zeroLineWidth: 2
        };

        if (this.profileStore && frame) {
            if (!this.widgetStore.isCoordChannel) {
                linePlotProps.xLabel = `${this.widgetStore.spectralSystem}, ${this.widgetStore.spectralCoordinate}`;
            }
            if (frame.unit) {
                linePlotProps.yLabel = `Value (${frame.unit})`;
            }

            const currentPlotData = this.plotData;
            if (currentPlotData) {
                linePlotProps.data = currentPlotData.values;
                // Opacity ranges from 0.15 to 0.40 when data is in progress, and is 1.0 when finished
                linePlotProps.opacity = currentPlotData.progress < 1.0 ? 0.15 + currentPlotData.progress / 4.0 : 1.0;
                
                // set line color
                let primaryLineColor = this.widgetStore.primaryLineColor.colorHex;
                if (appStore.darkTheme) {
                    if (!this.widgetStore.primaryLineColor.fixed) {
                        primaryLineColor = Colors.BLUE4;   
                    }
                }
                linePlotProps.lineColor = primaryLineColor;
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

            linePlotProps.markers = [];
            if (!isNaN(this.widgetStore.cursorX)) {
                linePlotProps.markers.push({
                    value: this.widgetStore.cursorX,
                    id: "marker-profiler-cursor",
                    draggable: false,
                    horizontal: false,
                    color: appStore.darkTheme ? Colors.GRAY4 : Colors.GRAY2,
                    opacity: 0.8,
                    isMouseMove: true,
                });
            }
            if (!isNaN(this.currentChannelValue)) {
                linePlotProps.markers.push({
                    value: this.currentChannelValue,
                    id: "marker-channel-current",
                    opacity: 0.4,
                    draggable: false,
                    horizontal: false,
                });
            }
            if (!isNaN(this.requiredChannelValue)) {
                linePlotProps.markers.push({
                    value: this.requiredChannelValue,
                    id: "marker-channel-required",
                    draggable: appStore.animatorStore.animationState !== AnimationState.PLAYING,
                    dragMove: this.onChannelChanged,
                    horizontal: false,
                });
            }

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

            linePlotProps.comments = this.exportHeaders;
        }

        let className = "spectral-profiler-widget";
        if (this.widgetStore.matchesSelectedRegion) {
            className += " linked-to-selected";
        }

        if (appStore.darkTheme) {
            className += " dark-theme";
        }

        return (
            <div className={className}>
                <div className="profile-container">
                    <SpectralProfilerToolbarComponent widgetStore={this.widgetStore} appStore={appStore}/>
                    <div className="profile-plot">
                        <LinePlotComponent {...linePlotProps}/>
                        <ProfilerInfoComponent info={this.genProfilerInfo()}/>
                    </div>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}
