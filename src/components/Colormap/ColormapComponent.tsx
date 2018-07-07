import * as React from "react";
import {observer} from "mobx-react";
import {AppState} from "../../states/AppState";
import * as Plotly from "plotly.js/dist/plotly-cartesian";
import createPlotlyComponent from "react-plotly.js/factory";
import ReactResizeDetector from "react-resize-detector";
import {Config, Data, Layout} from "plotly.js";
import "./ColormapComponent.css";

// This allows us to use a minimal Plotly.js bundle with React-Plotly.js (900k compared to 2.7 MB)
const Plot = createPlotlyComponent(Plotly);

class ColormapComponentProps {
    appState: AppState;
}

@observer
export class ColormapComponent extends React.Component<ColormapComponentProps, { width: number, height: number }> {

    constructor(props: ColormapComponentProps) {
        super(props);
        this.state = {width: 0, height: 0};
    }

    onResize = (width: number, height: number) => {
        this.setState({width, height});
    };

    render() {
        const appState = this.props.appState;
        const backgroundColor = "#F2F2F2";

        let plotLayout: Partial<Layout> = {
            width: this.state.width,
            height: this.state.height,
            paper_bgcolor: backgroundColor,
            plot_bgcolor: backgroundColor,
            xaxis: {
                title: `Value`
            },
            yaxis: {
                title: "Count",
                type: "log"
            },
            margin: {
                t: 10,
                r: 10,
                l: 60,
                b: 60,
            }
        };

        let plotData: Partial<Data[]> = [];
        let plotConfig: Partial<Config> = {
            displaylogo: false,
            modeBarButtonsToRemove: ["toImage", "sendDataToCloud", "toggleHover", "toggleSpikelines", "hoverClosestCartesian", "hoverCompareCartesian"],
            setBackground: "transparent"
        };

        if (appState.activeFrame && appState.activeFrame.channelHistogram && appState.activeFrame.channelHistogram.bins) {
            const histogram = appState.activeFrame.channelHistogram;
            let xVals = new Array(histogram.bins.length);
            for (let i = 0; i < xVals.length; i++) {
                xVals[i] = histogram.firstBinCenter + histogram.binWidth * i;
            }

            plotData.push({
                x: xVals,
                y: histogram.bins,
                type: "scatter",
                mode: "lines",
                line: {
                    width: 1.0,
                    shape: "hv"
                }
            });
        }
        return (
            <div style={{width: "100%", height: "100%"}}>
                <Plot layout={plotLayout} data={plotData} config={plotConfig}/>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}