import * as React from "react";
import {observer} from "mobx-react";
import {AppStore} from "../../stores/AppStore";
import * as Plotly from "plotly.js/dist/plotly-cartesian";
import createPlotlyComponent from "react-plotly.js/factory";
import ReactResizeDetector from "react-resize-detector";
import {Config, Data, Layout, Point, Shape} from "plotly.js";
import "./ColormapComponent.css";

// This allows us to use a minimal Plotly.js bundle with React-Plotly.js (900k compared to 2.7 MB)
const Plot = createPlotlyComponent(Plotly);

class ColormapComponentProps {
    appStore: AppStore;
}

class ColormapComponentState {
    width: number;
    height: number;
    hoveringScaleMin: boolean;
    hoveringScaleMax: boolean;
}

@observer
export class ColormapComponent extends React.Component<ColormapComponentProps, ColormapComponentState> {

    private plotRef: any;
    private movingScaleMax: boolean;
    private movingScaleMin: boolean;

    constructor(props: ColormapComponentProps) {
        super(props);
        this.state = {width: 0, height: 0, hoveringScaleMin: false, hoveringScaleMax: false};
    }

    onResize = (width: number, height: number) => {
        this.setState({width, height});
    };

    handleMouseClick = (ev: React.MouseEvent<HTMLDivElement>) => {
        if (this.movingScaleMin || this.movingScaleMax) {
            this.movingScaleMax = false;
            this.movingScaleMin = false;
            return;
        }

        const frame = this.props.appStore.activeFrame;
        const pixelThreshold = 5;
        if (this.plotRef && frame) {
            const xAxis = this.plotRef.el._fullLayout.xaxis;
            if (xAxis && xAxis.p2c) {
                const leftMargin = this.plotRef.el._fullLayout.margin.l;
                const posScaleMin = xAxis.c2p(frame.scaleMin) + leftMargin;
                const posScaleMax = xAxis.c2p(frame.scaleMax) + leftMargin;
                if (Math.abs(ev.nativeEvent.offsetX - posScaleMin) < pixelThreshold) {
                    this.movingScaleMin = true;
                    ev.preventDefault();
                }
                else if (Math.abs(ev.nativeEvent.offsetX - posScaleMax) < pixelThreshold) {
                    this.movingScaleMax = true;
                    ev.preventDefault();
                }
            }
        }
    };

    handleMouseMove = (ev: React.MouseEvent<HTMLDivElement>) => {
        const frame = this.props.appStore.activeFrame;
        const pixelThreshold = 5;
        if (this.plotRef && frame) {
            const xAxis = this.plotRef.el._fullLayout.xaxis;
            if (xAxis && xAxis.p2c) {
                const leftMargin = this.plotRef.el._fullLayout.margin.l;
                const cursorVal = xAxis.p2c(ev.nativeEvent.offsetX - leftMargin);
                const posScaleMin = xAxis.c2p(frame.scaleMin) + leftMargin;
                const posScaleMax = xAxis.c2p(frame.scaleMax) + leftMargin;

                if (this.movingScaleMin) {
                    // Handle switchover (from moving min to moving max)
                    if (cursorVal >= frame.scaleMax) {
                        this.movingScaleMin = false;
                        this.movingScaleMax = true;
                        this.setState({hoveringScaleMax: true, hoveringScaleMin: false});
                    }
                    else {
                        frame.scaleMin = cursorVal;
                    }
                }
                else if (this.movingScaleMax) {
                    // Handle switchover (from moving max to moving min)
                    if (cursorVal <= frame.scaleMin) {
                        this.movingScaleMax = false;
                        this.movingScaleMin = true;
                        this.setState({hoveringScaleMin: true, hoveringScaleMax: false});
                    }
                    else {
                        frame.scaleMax = cursorVal;
                    }
                }
                else if (Math.abs(ev.nativeEvent.offsetX - posScaleMin) < pixelThreshold) {
                    this.setState({hoveringScaleMin: true, hoveringScaleMax: false});
                }
                else if (Math.abs(ev.nativeEvent.offsetX - posScaleMax) < pixelThreshold) {
                    this.setState({hoveringScaleMax: true, hoveringScaleMin: false});
                }
                else if (this.state.hoveringScaleMin || this.state.hoveringScaleMax) {
                    this.setState({hoveringScaleMax: false, hoveringScaleMin: false});
                }
            }
        }
    };

    handleMouseUp = (ev: React.MouseEvent<HTMLDivElement>) => {
        this.movingScaleMin = false;
        this.movingScaleMax = false;
    };

    handleDrag = (ev: React.MouseEvent<HTMLDivElement>) => {
        console.log("Drag event");
    };

    private getScaleMarkers(position: number, hovering: boolean, moving: boolean) {
        // By default, a single horizontal line marker is returned
        let markers: any[] = [{
            type: "line",
            yref: "paper",
            y0: 0,
            y1: 1,
            x0: position,
            x1: position,
            line: {
                color: "red",
                width: 1
            }
        }];

        // If the marker is being hovered over, then we add a rectangle as well
        if (hovering) {
            // split the line into two lines above and below the rectangle, so that the line doesn't show through the semi-transparent rectangle
            markers.push({...markers[0]});
            markers[0].y1 = 0.33;
            markers[1].y0 = 0.66;
            // add the rectangle
            markers.push({
                type: "rect",
                yref: "paper",
                y0: 0.33,
                y1: 0.66,
                xsizemode: "pixel",
                xanchor: position,
                x0: -3,
                x1: +3,
                fillcolor: `rgba(255, 0, 0, ${moving ? 0.7 : 0.5})`,
                line: {
                    width: 1,
                    color: "red"
                }
            });
        }
        return markers;
    }

    render() {
        const appStore = this.props.appStore;
        const backgroundColor = "#F2F2F2";

        let scaleMarkers = [];

        if (appStore.activeFrame) {
            scaleMarkers = this.getScaleMarkers(appStore.activeFrame.scaleMin, this.state.hoveringScaleMin, this.movingScaleMin);
            scaleMarkers = scaleMarkers.concat(this.getScaleMarkers(appStore.activeFrame.scaleMax, this.state.hoveringScaleMax, this.movingScaleMax));
        }

        let plotLayout: Partial<Layout> = {
            width: this.state.width,
            height: this.state.height,
            paper_bgcolor: backgroundColor,
            plot_bgcolor: backgroundColor,
            xaxis: {
                title: `Value`
            },
            yaxis: {
                type: "log",
                showticklabels: false
            },
            margin: {
                t: 10,
                r: 10,
                l: 10,
                b: 60,
            },
            shapes: scaleMarkers
        };

        let plotData: Partial<Data[]> = [];
        let plotConfig: Partial<Config> = {
            displaylogo: false,
            modeBarButtonsToRemove: ["toImage", "sendDataToCloud", "toggleHover", "toggleSpikelines", "hoverClosestCartesian", "hoverCompareCartesian"],
            setBackground: "transparent",
            doubleClick: false,
        };

        if (appStore.activeFrame && appStore.activeFrame.channelHistogram && appStore.activeFrame.channelHistogram.bins) {
            const histogram = appStore.activeFrame.channelHistogram;
            let xVals = new Array(histogram.bins.length);
            for (let i = 0; i < xVals.length; i++) {
                xVals[i] = histogram.firstBinCenter + histogram.binWidth * i;
            }

            plotData.push({
                x: xVals,
                y: histogram.bins,
                type: "scatter",
                hoverinfo: "x",
                mode: "lines",
                line: {
                    width: 1.0,
                    shape: "hv"
                }
            });
        }
        return (
            <div style={{width: "100%", height: "100%"}} onDrag={this.handleDrag} onClick={this.handleMouseClick} onMouseMove={this.handleMouseMove}>
                <Plot layout={plotLayout} data={plotData} config={plotConfig} ref={ref => this.plotRef = ref}/>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}