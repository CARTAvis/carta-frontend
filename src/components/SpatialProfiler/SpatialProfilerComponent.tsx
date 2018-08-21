import * as React from "react";
import {observer} from "mobx-react";
import {AppStore} from "../../stores/AppStore";
import * as Plotly from "plotly.js/dist/plotly-cartesian";
import createPlotlyComponent from "react-plotly.js/factory";
import ReactResizeDetector from "react-resize-detector";
import {Config, Data, Layout} from "plotly.js";
import "./SpatialProfilerComponent.css";
import {WidgetConfig} from "../../stores/FloatingWidgetStore";
import {Colors, NonIdealState} from "@blueprintjs/core";

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
                title: `Image ${profileConfig.coordinate.toUpperCase()}-coordinate`
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

        if (appStore.spatialProfiles.has(profileConfig.dataSourceId)) {
            const profileStore = appStore.spatialProfiles.get(profileConfig.dataSourceId);
            const coordinateData = profileStore.profiles.filter(data => data.coordinate === profileConfig.coordinate);
            if (coordinateData.length) {
                // Will eventually need WCS coordinate info
                let xVals = new Array(coordinateData[0].values.length);
                let yVals = new Array(coordinateData[0].values.length);
                for (let i = 0; i < xVals.length; i++) {
                    xVals[i] = coordinateData[0].start + i;
                }

                plotData.push({
                    x: xVals,
                    y: coordinateData[0].values,
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
        return (
            <div style={{width: "100%", height: "100%"}}>
                <Plot layout={plotLayout} data={plotData} config={plotConfig}/>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}