import * as React from "react";
import * as Plotly from "plotly.js/dist/plotly-cartesian";
import * as AST from "ast_wrapper";
import {observer} from "mobx-react";
import {AppStore} from "../../stores/AppStore";
import createPlotlyComponent from "react-plotly.js/factory";
import ReactResizeDetector from "react-resize-detector";
import {Config, Data, Layout} from "plotly.js";
import "./SpatialProfilerComponent.css";
import {WidgetConfig} from "../../stores/FloatingWidgetStore";
import {Colors, NonIdealState} from "@blueprintjs/core";
import {number} from "prop-types";

// This allows us to use a minimal Plotly.js bundle with React-Plotly.js (900k compared to 2.7 MB)
const Plot = createPlotlyComponent(Plotly);

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

    onResize = (width: number, height: number) => {
        this.setState({width, height});
    };

    render() {
        const appStore = this.props.appStore;

        const profileConfig = appStore.spatialProfileWidgets.get(this.props.id);
        if (!profileConfig) {
            return <NonIdealState icon={"error"} title={"Missing profile"} description={"Profile not found"}/>;
        }

        const backgroundColor = appStore.darkTheme ? Colors.DARK_GRAY3 : Colors.LIGHT_GRAY5;
        const isXProfile = profileConfig.coordinate.indexOf("x") >= 0;

        let plotLayout: Partial<Layout> = {
            width: this.state.width,
            height: this.state.height,
            paper_bgcolor: backgroundColor,
            plot_bgcolor: backgroundColor,
            xaxis: {
                title: `Image ${profileConfig.coordinate.toUpperCase()}-coordinate`,
                tickmode: "array",
            },
            yaxis: {
                title: "Value"
            },
            margin: {
                t: 10,
                r: 10,
                l: 60,
                b: 60,
            },
            font: {
                color: appStore.darkTheme ? Colors.LIGHT_GRAY3 : Colors.DARK_GRAY4
            }
        };

        let plotData: Partial<Data[]> = [];
        let plotConfig: Partial<Config> = {
            displaylogo: false,
            modeBarButtonsToRemove: ["toImage", "sendDataToCloud", "toggleHover", "toggleSpikelines", "hoverClosestCartesian", "hoverCompareCartesian"],
            setBackground: "transparent"
        };

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
                const coordinateData = profileStore.profiles.get(profileConfig.coordinate);
                if (coordinateData && coordinateData.values && coordinateData.values.length) {
                    let xVals = new Array(coordinateData.values.length);
                    for (let i = 0; i < xVals.length; i++) {
                        xVals[i] = coordinateData.start + i;
                    }

                    if (frame.unit) {
                        plotLayout.yaxis.title = `Value (${frame.unit})`;
                    }


                    if (frame.validWcs) {
                        // Generate tick placement
                        const numTicks = 5;
                        const interval = 1.0 / (numTicks+1) * (xVals[xVals.length - 1] - xVals[0]);
                        let tickVals = new Array<number>(numTicks);
                        for (let i = 0; i < numTicks; i++) {
                            tickVals[i] = (i+1) * interval;
                        }
                        plotLayout.xaxis.tickvals = tickVals;
                        const labelAttribute = `Label(${isXProfile?1:2})`;
                        const astLabel = AST.getString(frame.wcsInfo, labelAttribute);

                        if (astLabel) {
                            plotLayout.xaxis.title = astLabel;
                        }

                        // Generate tick text
                        if (isXProfile) {
                            plotLayout.xaxis.ticktext = plotLayout.xaxis.tickvals.map(v => {
                                const pointWCS = AST.pixToWCS(frame.wcsInfo, v, profileStore.y);
                                const normVals = AST.normalizeCoordinates(frame.wcsInfo, pointWCS.x, pointWCS.y);
                                const formatStringX = appStore.overlayStore.axis[0].cursorFormat ? appStore.overlayStore.axis[0].cursorFormat : "";
                                return AST.getFormattedCoordinates(frame.wcsInfo, normVals.x, normVals.y, `Format(1) = ${formatStringX}`).x;
                            });
                        }
                        else {
                            plotLayout.xaxis.ticktext = plotLayout.xaxis.tickvals.map(v => {
                                const pointWCS = AST.pixToWCS(frame.wcsInfo, profileStore.x, v);
                                const normVals = AST.normalizeCoordinates(frame.wcsInfo, pointWCS.x, pointWCS.y);
                                const formatStringY = appStore.overlayStore.axis[1].cursorFormat ? appStore.overlayStore.axis[1].cursorFormat : "";
                                return AST.getFormattedCoordinates(frame.wcsInfo, normVals.x, normVals.y, `Format(2) = ${formatStringY}`).y;
                            });
                        }

                    }

                    plotData.push({
                        x: xVals,
                        y: coordinateData.values,
                        type: "scatter",
                        mode: "lines",
                        line: {
                            width: 1.0,
                            shape: "hv",
                            color: `${appStore.darkTheme ? Colors.BLUE4 : Colors.BLUE2}`
                        }
                    });
                    plotLayout.shapes = [{
                        yref: "paper",
                        type: "line",
                        x0: isXProfile ? profileStore.x : profileStore.y,
                        x1: isXProfile ? profileStore.x : profileStore.y,
                        y0: 0,
                        y1: 1,
                        line: {
                            color: "red",
                            width: 1
                        }
                    }];
                }
            }
        }

        return (
            <div style={{width: "100%", height: "100%"}}>
                <Plot layout={plotLayout} data={plotData} config={plotConfig}/>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}