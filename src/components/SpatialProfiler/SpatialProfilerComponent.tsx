import * as React from "react";
import {observer} from "mobx-react";
import {AppState} from "../../Models/AppState";
import {SpatialProfileData} from "../../Models/SpatialProfileState";
import Plot from "react-plotly.js";
import ReactResizeDetector from "react-resize-detector";
import {Config, Data, Layout} from "plotly.js";
import "./SpatialProfilerComponent.css";

class SpatialProfilerComponentProps {
    label: string;
    dataSourceId: number;
    profileCoordinate: string;
    appState: AppState;
}

@observer
export class SpatialProfilerComponent extends React.Component<SpatialProfilerComponentProps, { width: number, height: number }> {

    constructor(props: SpatialProfilerComponentProps) {
        super(props);
        this.state = {width: 0, height: 0};
    }

    onResize = (width: number, height: number) => {
        this.setState({width, height});
    };

    render() {
        const appState = this.props.appState;
        const backgroundColor = "#F2F2F2";
        const isXProfile = this.props.profileCoordinate.indexOf("x") >= 0;

        let plotLayout: Partial<Layout> = {
            width: this.state.width,
            height: this.state.height,
            paper_bgcolor: backgroundColor,
            plot_bgcolor: backgroundColor,
            xaxis: {
                title: `Image ${this.props.profileCoordinate.toUpperCase()}-coordinate`
            },
            yaxis: {
                title: "Value"
            },
            margin: {
                t: 10,
                r: 10,
                l: 60,
                b: 60,
            }
        };
        // DefinitelyTyped PR #25608 issued to fix Data typing
        // let plotData: Partial<Data[]> = [];
        let plotData = [];

        let plotConfig: Partial<Config> = {
            displaylogo: false,
            modeBarButtonsToRemove: ["toImage", "sendDataToCloud", "toggleHover", "toggleSpikelines", "hoverClosestCartesian", "hoverCompareCartesian"],
            setBackground: "transparent"
        };

        if (appState.spatialProfiles.has(this.props.dataSourceId)) {
            const profileState = appState.spatialProfiles.get(this.props.dataSourceId);
            const coordinateData = profileState.profiles.filter(data => data.coordinate === this.props.profileCoordinate);
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
                        width: 1.0
                    }

                });
                plotLayout.shapes = [{
                    yref: "paper",
                    type: "line",
                    x0: isXProfile ? profileState.x : profileState.y,
                    x1: isXProfile ? profileState.x : profileState.y,
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
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}