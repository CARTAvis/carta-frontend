import * as React from "react";
import * as _ from "lodash";
import {Chart, ChartArea, ChartData, ChartOptions} from "chart.js";
import {Scatter} from "react-chartjs-2";

export class PlotContainerProps {
    width?: number;
    height?: number;
    data?: { x: number, y: number }[];
    xMin?: number;
    xMax?: number;
    xLabel?: string;
    yLabel?: string;
    logY?: boolean;
    lineColor?: string;
    chartAreaUpdated?: (chartArea: ChartArea) => void;
    plotRefUpdated?: (plotRef: Scatter) => void;
}

export class PlotContainerComponent extends React.Component<PlotContainerProps> {
    private plotRef: Scatter;
    private chartArea: ChartArea;

    private afterChartLayout = (chart: any) => {
        if (!_.isEqual(chart.chartArea, this.chartArea)) {
            this.chartArea = chart.chartArea;
            if (this.props.chartAreaUpdated) {
                this.props.chartAreaUpdated(this.chartArea);
            }
        }
    };

    private onRef = (ref) => {
        if (ref !== this.plotRef) {
            this.plotRef = ref;
            if (this.props.plotRefUpdated) {
                this.props.plotRefUpdated(this.plotRef);
            }
        }
    };

    shouldComponentUpdate(nextProps: PlotContainerProps) {
        const props = this.props;

        // Basic prop check
        if (props.width !== nextProps.width) {
            return true;
        }
        else if (props.height !== nextProps.height) {
            return true;
        }
        else if (props.lineColor !== nextProps.lineColor) {
            return true;
        }
        else if (props.logY !== nextProps.logY) {
            return true;
        }
        else if (props.xLabel !== nextProps.xLabel) {
            return true;
        }
        else if (props.xMin !== nextProps.xMin) {
            return true;
        }
        else if (props.xMax !== nextProps.xMax) {
            return true;
        }
        else if (props.yLabel !== nextProps.yLabel) {
            return true;
        }

        // Deep check of arrays (this should be optimised!)
        if (!props.data || !nextProps.data || props.data.length !== nextProps.data.length) {
            return true;
        }
        for (let i = 0; i < props.data.length; i++) {
            if (props.data[i].x !== nextProps.data[i].x || props.data[i].y !== nextProps.data[i].y) {
                return true;
            }
        }

        // Skip any other changes
        return false;
    }

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
            // plotOptions.scales.yAxes[0].ticks.min = 0.5;
        }
        else {
            plotOptions.scales.yAxes[0].afterBuildTicks = (axis) => axis;
            plotOptions.scales.yAxes[0].type = "linear";
        }

        let plotData: Partial<ChartData> = {datasets: []};
        if (this.props.data && this.props.data.length) {
            plotData.datasets.push({
                label: "LineGraph",
                type: "line",
                data: this.props.data,
                fill: false,
                pointRadius: 0,
                showLine: true,
                steppedLine: true,
                borderWidth: 1,
                borderColor: this.props.lineColor
            });
        }

        const plugins = [{
            afterLayout: this.afterChartLayout,
        }];

        return <Scatter data={plotData} options={plotOptions} plugins={plugins} ref={this.onRef}/>;
    }
}