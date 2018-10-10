import * as React from "react";
import * as AST from "ast_wrapper";
import {observer} from "mobx-react";
import {AppStore} from "../../stores/AppStore";
import ReactResizeDetector from "react-resize-detector";
import "./SpatialProfilerComponent.css";
import {WidgetConfig} from "../../stores/widgets/FloatingWidgetStore";
import {Colors, NonIdealState} from "@blueprintjs/core";
import {ChartOptions, ChartData} from "chart.js";
import {Scatter} from "react-chartjs-2";
import {clamp} from "../../util/math";

const Chart = require("react-chartjs-2").Chart;

class SpatialProfilerComponentProps {
    appStore: AppStore;
    id: string;
    docked: boolean;
}

@observer
export class SpatialProfilerComponent extends React.Component<SpatialProfilerComponentProps, { width: number, height: number }> {

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

    constructor(props: SpatialProfilerComponentProps) {
        super(props);
        this.state = {width: 0, height: 0};
    }

    componentWillMount() {
        const ChartAnnotation = require("chartjs-plugin-annotation");
        Chart.pluginService.register(ChartAnnotation);
    }

    onResize = (width: number, height: number) => {
        this.setState({width, height});
    };

    filterTicks = (scaleInstance) => {
        // Get inter-tick distance
        if (scaleInstance.ticksAsNumbers.length >= 4) {
            const interTickDist = Math.abs(scaleInstance.ticksAsNumbers[2] - scaleInstance.ticksAsNumbers[1]);
            const initialDist = Math.abs(scaleInstance.ticksAsNumbers[1] - scaleInstance.ticksAsNumbers[0]);
            const finalDist = Math.abs(scaleInstance.ticksAsNumbers[scaleInstance.ticks.length - 1] - scaleInstance.ticksAsNumbers[scaleInstance.ticks.length - 2]);

            // Perform tick removal if the initial tick is too close
            if (initialDist < interTickDist * 0.75) {
                scaleInstance.ticks[0] = null;
                scaleInstance.ticksAsNumbers[0] = null;
            }
            // Perform tick removal if the final tick is too close
            if (finalDist < interTickDist * 0.75) {
                scaleInstance.ticks[scaleInstance.ticks.length - 1] = null;
                scaleInstance.ticksAsNumbers[scaleInstance.ticksAsNumbers.length - 1] = null;
            }
        }
    };

    annotationDraw = (chart) => {
        const appStore = this.props.appStore;
        const profileConfig = appStore.spatialProfileWidgets.get(this.props.id);
        const isXProfile = profileConfig.coordinate.indexOf("x") >= 0;

        if (appStore.activeFrame) {
            let keyStruct = {fileId: profileConfig.fileId, regionId: profileConfig.regionId};
            // Replace "current file" fileId with active frame's fileId
            if (profileConfig.fileId === -1) {
                keyStruct.fileId = appStore.activeFrame.frameInfo.fileId;
            }
            const key = `${keyStruct.fileId}-${keyStruct.regionId}`;
            const profileStore = appStore.spatialProfiles.get(key);
            const frame = appStore.frames.find(f => f.frameInfo.fileId === keyStruct.fileId);
            if (profileStore && frame) {
                const scaledX = Math.floor(chart.scales["x-axis-0"].getPixelForValue(isXProfile ? profileStore.x : profileStore.y)) + 0.5;
                if (scaledX < chart.chartArea.left || scaledX > chart.chartArea.right) {
                    return;
                }
                chart.chart.ctx.restore();
                chart.chart.ctx.beginPath();
                chart.chart.ctx.strokeStyle = `${appStore.darkTheme ? Colors.RED4 : Colors.RED2}`;
                chart.chart.ctx.lineWidth = 1;
                chart.chart.ctx.setLineDash([5, 5]);
                chart.chart.ctx.moveTo(scaledX, chart.chartArea.bottom);
                chart.chart.ctx.lineTo(scaledX, chart.chartArea.top);
                chart.chart.ctx.stroke();
            }
        }
    };

    render() {
        const appStore = this.props.appStore;

        const profileConfig = appStore.spatialProfileWidgets.get(this.props.id);
        if (!profileConfig) {
            return <NonIdealState icon={"error"} title={"Missing profile"} description={"Profile not found"}/>;
        }

        const backgroundColor = appStore.darkTheme ? Colors.DARK_GRAY3 : Colors.LIGHT_GRAY5;
        const isXProfile = profileConfig.coordinate.indexOf("x") >= 0;

        let plotOptions: ChartOptions = {
            maintainAspectRatio: false,
            legend: {
                display: false
            },
            scales: {
                xAxes: [{
                    id: "x-axis-0",
                    scaleLabel: {
                        display: true,
                        labelString: `${isXProfile ? "X" : "Y"} coordinate`
                    },
                    afterTickToLabelConversion: this.filterTicks
                    ,
                    ticks: {
                        maxRotation: 0
                    }
                }
                ],
                yAxes: [{
                    id: "y-axis-0",
                    scaleLabel: {
                        display: true,
                        labelString: "Value"
                    },
                    afterTickToLabelConversion: this.filterTicks,
                    ticks: {}
                }]
            },
            animation: {
                duration: 0
            }
        };

        let plotData: Partial<ChartData> = {
            datasets: [
                {
                    label: "Profile",
                    data: [],
                    type: "line",
                    fill: false,
                    pointRadius: 0,
                    showLine: true,
                    steppedLine: true,
                    borderWidth: 1,
                    borderColor: `${appStore.darkTheme ? Colors.BLUE4 : Colors.BLUE2}`
                }
            ]
        };

        let plugins = [];

        if (appStore.activeFrame) {
            let keyStruct = {fileId: profileConfig.fileId, regionId: profileConfig.regionId};
            // Replace "current file" fileId with active frame's fileId
            if (profileConfig.fileId === -1) {
                keyStruct.fileId = appStore.activeFrame.frameInfo.fileId;
            }
            const key = `${keyStruct.fileId}-${keyStruct.regionId}`;
            const profileStore = appStore.spatialProfiles.get(key);
            const frame = appStore.frames.find(f => f.frameInfo.fileId === keyStruct.fileId);
            if (profileStore && frame) {
                if (frame.unit) {
                    plotOptions.scales.yAxes[0].scaleLabel.labelString = `Value (${frame.unit})`;
                }

                const labelAttribute = `Label(${isXProfile ? 1 : 2})`;
                const astLabel = AST.getString(frame.wcsInfo, labelAttribute);

                if (astLabel) {
                    plotOptions.scales.xAxes[0].scaleLabel.labelString = astLabel;
                }

                if (frame.validWcs) {
                    if (isXProfile) {
                        plotOptions.scales.xAxes[0].ticks.callback = (v) => {
                            const pointWCS = AST.pixToWCS(frame.wcsInfo, v, profileStore.y);
                            const normVals = AST.normalizeCoordinates(frame.wcsInfo, pointWCS.x, pointWCS.y);
                            return AST.getFormattedCoordinates(frame.wcsInfo, normVals.x, undefined).x;
                        };
                    }
                    else {
                        plotOptions.scales.xAxes[0].ticks.callback = (v) => {
                            const pointWCS = AST.pixToWCS(frame.wcsInfo, profileStore.x, v);
                            const normVals = AST.normalizeCoordinates(frame.wcsInfo, pointWCS.x, pointWCS.y);
                            return AST.getFormattedCoordinates(frame.wcsInfo, undefined, normVals.y).y;
                        };
                    }
                }
                else {
                    // Use tick values directly
                    plotOptions.scales.xAxes[0].ticks.callback = (v) => v;
                }

                // Use cached frame data for an approximate profile
                if (profileStore.approximate) {
                    // Check if frame data can be used to approximate profile
                    if (profileStore.x >= frame.currentFrameView.xMin && profileStore.x <= frame.currentFrameView.xMax && profileStore.y >= frame.currentFrameView.yMin && profileStore.y <= frame.currentFrameView.yMax) {
                        const w = Math.floor((frame.currentFrameView.xMax - frame.currentFrameView.xMin) / frame.currentFrameView.mip);
                        const h = Math.floor((frame.currentFrameView.yMax - frame.currentFrameView.yMin) / frame.currentFrameView.mip);
                        const yOffset = Math.floor((profileStore.y - frame.currentFrameView.yMin) / frame.currentFrameView.mip);
                        const xOffset = Math.floor((profileStore.x - frame.currentFrameView.xMin) / frame.currentFrameView.mip);

                        let lowerBound: number;
                        let upperBound: number;
                        if (isXProfile) {
                            lowerBound = clamp(frame.requiredFrameView.xMin, 0, frame.frameInfo.fileInfoExtended.width);
                            upperBound = clamp(frame.requiredFrameView.xMax, 0, frame.frameInfo.fileInfoExtended.width);
                        }
                        else {
                            lowerBound = clamp(frame.requiredFrameView.yMin, 0, frame.frameInfo.fileInfoExtended.height);
                            upperBound = clamp(frame.requiredFrameView.yMax, 0, frame.frameInfo.fileInfoExtended.height);
                        }

                        lowerBound = Math.floor(lowerBound);
                        upperBound = Math.floor(upperBound);

                        let vals: { x: number, y: number }[];
                        if (isXProfile) {
                            vals = new Array(w);
                            for (let i = 0; i < w; i++) {
                                vals[i] = {x: frame.currentFrameView.xMin + frame.currentFrameView.mip * i, y: frame.rasterData[yOffset * w + i]};
                            }
                        }
                        else {
                            vals = new Array(h);
                            for (let i = 0; i < h; i++) {
                                vals[i] = {x: frame.currentFrameView.yMin + frame.currentFrameView.mip * i, y: frame.rasterData[i * w + xOffset]};
                            }
                        }

                        let yMin = Number.MAX_VALUE;
                        let yMax = -Number.MAX_VALUE;
                        for (let i = 0; i < vals.length; i++) {
                            if (vals[i].x >= lowerBound && !isNaN(vals[i].y)) {
                                yMin = Math.min(yMin, vals[i].y);
                                yMax = Math.max(yMax, vals[i].y);
                            }
                            if (vals[i].x > upperBound) {
                                break;
                            }
                        }

                        if (yMin !== Number.MAX_VALUE) {
                            plotOptions.scales.yAxes[0].ticks.min = yMin;
                            plotOptions.scales.yAxes[0].ticks.max = yMax;
                        }

                        plotOptions.scales.xAxes[0].ticks.min = lowerBound;
                        plotOptions.scales.xAxes[0].ticks.max = upperBound;
                        plotData.datasets[0].data = vals;
                    }
                    else if (profileStore.x !== undefined && profileStore.y !== undefined) {
                        console.log(`Out of bounds profile request: (${profileStore.x}, ${profileStore.y})`);
                    }
                }
                else {
                    // Use accurate profiles from server-sent data
                    const coordinateData = profileStore.profiles.get(profileConfig.coordinate);
                    if (coordinateData && coordinateData.values && coordinateData.values.length) {
                        let lowerBound: number;
                        let upperBound: number;
                        if (isXProfile) {
                            lowerBound = clamp(frame.requiredFrameView.xMin, 0, frame.frameInfo.fileInfoExtended.width);
                            upperBound = clamp(frame.requiredFrameView.xMax, 0, frame.frameInfo.fileInfoExtended.width);
                        }
                        else {
                            lowerBound = clamp(frame.requiredFrameView.yMin, 0, frame.frameInfo.fileInfoExtended.height);
                            upperBound = clamp(frame.requiredFrameView.yMax, 0, frame.frameInfo.fileInfoExtended.height);
                        }

                        lowerBound = Math.floor(lowerBound);
                        upperBound = Math.floor(upperBound);

                        const N = Math.floor(Math.min(upperBound - lowerBound, coordinateData.values.length));
                        let vals = new Array(N);
                        for (let i = 0; i < N; i++) {
                            vals[i] = {x: coordinateData.start + i + lowerBound, y: coordinateData.values[i + lowerBound]};
                        }

                        let yMin = Number.MAX_VALUE;
                        let yMax = -Number.MAX_VALUE;
                        for (let i = 0; i < vals.length; i++) {
                            if (vals[i].x >= lowerBound && !isNaN(vals[i].y)) {
                                yMin = Math.min(yMin, vals[i].y);
                                yMax = Math.max(yMax, vals[i].y);
                            }
                            if (vals[i].x > upperBound) {
                                break;
                            }
                        }

                        if (yMin !== Number.MAX_VALUE) {
                            plotOptions.scales.yAxes[0].ticks.min = yMin;
                            plotOptions.scales.yAxes[0].ticks.max = yMax;
                        }

                        plotOptions.scales.xAxes[0].ticks.min = lowerBound;
                        plotOptions.scales.xAxes[0].ticks.max = upperBound;
                        plotData.datasets[0].data = vals;
                    }
                }
            }
        }

        plugins.push({
            afterDraw: this.annotationDraw
        });

        return (
            <div className={"spatial-profiler-widget"}>
                <Scatter data={plotData} options={plotOptions} plugins={plugins}/>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}