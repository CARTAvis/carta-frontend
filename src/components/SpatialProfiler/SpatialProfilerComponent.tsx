import * as React from "react";
import * as AST from "ast_wrapper";
import {observer} from "mobx-react";
import {AppStore} from "../../stores/AppStore";
import ReactResizeDetector from "react-resize-detector";
import "./SpatialProfilerComponent.css";
import {WidgetConfig} from "../../stores/FloatingWidgetStore";
import {Colors, NonIdealState} from "@blueprintjs/core";
import {ChartOptions, ChartData, Point} from "chart.js";
import {Scatter} from "react-chartjs-2";
//import "chartjs-plugin-annotation";

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

    static PixelToChartSpace(chart, pixel) {
        let x = 0;
        let y = 0;

        for (let scaleName in chart.scales) {
            let scale = chart.scales[scaleName];
            if (scale.isHorizontal()) {
                x = scale.getValueForPixel(pixel.x);
            }
            else {
                y = scale.getValueForPixel(pixel.y);
            }
        }
        return {x, y};
    }

    static ChartToPixelSpace(chart, point) {
        let x = 0;
        let y = 0;

        for (let scaleName in chart.scales) {
            let scale = chart.scales[scaleName];
            if (scale.isHorizontal()) {
                x = scale.getPixelForValue(point.x);
            }
            else {
                y = scale.getPixelForValue(point.y);
            }
        }
        return {x, y};
    }

    componentWillMount() {
        const ChartAnnotation = require("chartjs-plugin-annotation");
        Chart.pluginService.register(ChartAnnotation);
    }

    onResize = (width: number, height: number) => {
        this.setState({width, height});
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
                    //plotOptions.scales.xAxes[0].ticks.callback = undefined;
                }


                // Use cached frame data for an approximate profile
                if (profileStore.approximate) {
                    // Check if frame data can be used to approximate profile
                    if (profileStore.x >= frame.currentFrameView.xMin && profileStore.x <= frame.currentFrameView.xMax && profileStore.y >= frame.currentFrameView.yMin && profileStore.y <= frame.currentFrameView.yMax) {
                        const w = Math.floor((frame.currentFrameView.xMax - frame.currentFrameView.xMin) / frame.currentFrameView.mip);
                        const h = Math.floor((frame.currentFrameView.yMax - frame.currentFrameView.yMin) / frame.currentFrameView.mip);
                        const yOffset = Math.floor((profileStore.y - frame.currentFrameView.yMin) / frame.currentFrameView.mip);
                        const xOffset = Math.floor((profileStore.x - frame.currentFrameView.xMin) / frame.currentFrameView.mip);
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

                        let lowerBound: number;
                        let upperBound: number;
                        if (isXProfile) {
                            lowerBound = Math.max(0, Math.min(frame.requiredFrameView.xMin, frame.frameInfo.fileInfoExtended.width));
                            upperBound = Math.max(0, Math.min(frame.requiredFrameView.xMax, frame.frameInfo.fileInfoExtended.width));
                        }
                        else {
                            lowerBound = Math.max(0, Math.min(frame.requiredFrameView.yMin, frame.frameInfo.fileInfoExtended.height));
                            upperBound = Math.max(0, Math.min(frame.requiredFrameView.yMax, frame.frameInfo.fileInfoExtended.height));
                        }

                        lowerBound = Math.floor(lowerBound);
                        upperBound = Math.floor(upperBound);
                        plotOptions.scales.xAxes[0].ticks.min = lowerBound;
                        plotOptions.scales.xAxes[0].ticks.max = upperBound;
                        plotData.datasets[0].data = vals;
                    }
                    else {
                        console.log(`Out of bounds profile request: (${profileStore.x}, ${profileStore.y}`);
                    }


                }
                else {
                    // Use accurate profiles from server-sent data
                    const coordinateData = profileStore.profiles.get(profileConfig.coordinate);
                    if (coordinateData && coordinateData.values && coordinateData.values.length) {
                        let lowerBound: number;
                        let upperBound: number;
                        if (isXProfile) {
                            lowerBound = Math.max(0, Math.min(frame.requiredFrameView.xMin, frame.frameInfo.fileInfoExtended.width));
                            upperBound = Math.max(0, Math.min(frame.requiredFrameView.xMax, frame.frameInfo.fileInfoExtended.width));
                        }
                        else {
                            lowerBound = Math.max(0, Math.min(frame.requiredFrameView.yMin, frame.frameInfo.fileInfoExtended.height));
                            upperBound = Math.max(0, Math.min(frame.requiredFrameView.yMax, frame.frameInfo.fileInfoExtended.height));
                        }

                        lowerBound = Math.floor(lowerBound);
                        upperBound = Math.floor(upperBound);

                        const N = Math.floor(Math.min(upperBound - lowerBound, coordinateData.values.length));
                        let vals = new Array(N);
                        for (let i = 0; i < N; i++) {
                            vals[i] = {x: coordinateData.start + i + lowerBound, y: coordinateData.values[i + lowerBound]};
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
            <div style={{width: "100%", height: "100%"}}>
                <Scatter data={plotData} width={this.state.width} height={this.state.height} options={plotOptions} plugins={plugins}/>
                {/*<Plot layout={plotLayout} data={plotData} config={plotConfig}/>*/}
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}