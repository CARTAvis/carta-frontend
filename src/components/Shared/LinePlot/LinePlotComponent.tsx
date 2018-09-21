import * as React from "react";
import * as _ from "lodash";
import {ChartData, ChartOptions, Chart, ChartArea} from "chart.js";
import {Scatter} from "react-chartjs-2";
import {Colors} from "@blueprintjs/core";

export interface Marker {
    value: number;
    color: string;
    draggable?: boolean;
}

export class LinePlotComponentProps {
    width?: number;
    height?: number;
    data?: { x: number, y: number }[];
    xMin?: number;
    xMax?: number;
    xLabel?: string;
    yLabel?: string;
    logY?: boolean;
    lineColor?: string;
    markers?: Marker[];
}

interface LinePlotComponentState {
    chartArea: ChartArea;
}

export class LinePlotComponent extends React.Component<LinePlotComponentProps, LinePlotComponentState> {
    private hoveredMarker: Marker;
    private skipRender = false;
    private plotRef;

    constructor(props: LinePlotComponentProps) {
        super(props);
        this.state = {chartArea: undefined};
    }

    private afterChartLayout = (chart: Chart) => {
        const updatedArea = chart.chartArea;
        const currentArea = this.state.chartArea;

        if (!_.isEqual(updatedArea, currentArea)) {
            this.setState({chartArea: updatedArea});
            this.skipRender = true;
            return false;
        }
        this.skipRender = false;
        return true;
    };

    private beforeDatasetUpdate = () => {
        return !this.skipRender;
    };

    private beforeChartRender = () => {
        if (this.skipRender) {
            this.skipRender = false;
            return false;
        }
        return true;
    };

    private beforeChartEvent = (chart, event) => {
        console.log(event);
    };

    drawMarkersToCanvas = (chart) => {
        const scale = chart.scales["x-axis-0"];
        if (scale && this.props.markers && this.props.markers.length) {
            for (let marker of this.props.markers) {
                const x = Math.floor(scale.getPixelForValue(marker.value)) + 0.5;
                chart.chart.ctx.restore();
                chart.chart.ctx.beginPath();
                chart.chart.ctx.strokeStyle = marker.color;
                chart.chart.ctx.lineWidth = 1;
                chart.chart.ctx.setLineDash([5, 5]);
                chart.chart.ctx.moveTo(x, chart.chartArea.bottom);
                chart.chart.ctx.lineTo(x, chart.chartArea.top);
                chart.chart.ctx.stroke();
            }
        }
    };

    render() {
        // ChartJS plot
        let plotOptions: ChartOptions = {
            maintainAspectRatio: false,
            events: ["mousedown", "mouseup", "mousemove", "dblclick"],
            legend: {
                display: false
            },
            scales: {
                xAxes: [{
                    id: "x-axis-0",
                    scaleLabel: {
                        display: true,
                        labelString: this.props.xLabel
                    },
                    ticks: {
                        maxRotation: 0,
                        min: this.props.xMin,
                        max: this.props.xMax
                    },
                    afterBuildTicks: axis => {
                        axis.ticks = axis.ticks.slice(1, -1);
                    }
                }],
                yAxes: [{
                    id: "y-axis-0",
                    scaleLabel: {
                        display: true,
                        labelString: this.props.yLabel
                    },
                    ticks: {
                        display: true,
                        min: 0.5
                    }
                }]
            },
            animation: {
                duration: 0
            }
        };

        if (this.props.logY) {
            plotOptions.scales.yAxes[0].afterBuildTicks = (axis) => {
                // Limit log axis ticks to power of 10 values
                axis.ticks = axis.ticks.filter(v => Math.abs(Math.log10(v) % 1.0) < 0.001);
            };
            plotOptions.scales.yAxes[0].type = "logarithmic";
        }
        else {
            plotOptions.scales.yAxes[0].afterBuildTicks = (axis) => axis;
            plotOptions.scales.yAxes[0].type = "linear";
        }

        let plotData: Partial<ChartData> = {
            datasets: [
                {
                    label: "LineGraph",
                    data: this.props.data,
                    type: "line",
                    fill: false,
                    pointRadius: 0,
                    showLine: true,
                    steppedLine: true,
                    borderWidth: 1,
                    borderColor: this.props.lineColor
                }
            ]
        };

        const plugins = [{
            afterDraw: this.drawMarkersToCanvas,
            afterLayout: this.afterChartLayout,
            beforeDatasetUpdate: this.beforeDatasetUpdate,
            beforeRender: this.beforeChartRender,
            beforeEvent: this.beforeChartEvent
        }];

        return <Scatter data={plotData} options={plotOptions} plugins={plugins} ref={ref => this.plotRef = ref}/>;
    }
}