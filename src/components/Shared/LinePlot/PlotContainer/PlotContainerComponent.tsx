import * as React from "react";
import * as _ from "lodash";
import {Chart, ChartArea, ChartData, ChartDataSets, ChartOptions} from "chart.js";
import {Scatter} from "react-chartjs-2";
import {Colors} from "@blueprintjs/core";

export class PlotContainerProps {
    width?: number;
    height?: number;
    data?: { x: number, y: number }[];
    xMin?: number;
    xMax?: number;
    yMin?: number;
    yMax?: number;
    xLabel?: string;
    yLabel?: string;
    logY?: boolean;
    lineColor?: string;
    darkMode?: boolean;
    usePointSymbols?: boolean;
    interpolateLines?: boolean;
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
        else if (props.usePointSymbols !== nextProps.usePointSymbols) {
            return true;
        }
        else if (props.interpolateLines !== nextProps.interpolateLines) {
            return true;
        }
        else if (props.darkMode !== nextProps.darkMode) {
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
        else if (props.yMin !== nextProps.yMin) {
            return true;
        }
        else if (props.yMax !== nextProps.yMax) {
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
        const labelColor = this.props.darkMode ? Colors.LIGHT_GRAY4 : Colors.GRAY1;
        const gridColor = this.props.darkMode ? Colors.DARK_GRAY5 : Colors.LIGHT_GRAY1;
        const lineColor = this.props.lineColor || (this.props.darkMode ? Colors.BLUE4 : Colors.BLUE2);
        // ChartJS plot
        let plotOptions: any = {
            maintainAspectRatio: false,
            events: ["mousedown", "mouseup", "mousemove", "dblclick"],
            legend: {
                display: false
            },
            scales: {
                xAxes: [{
                    id: "x-axis-0",
                    scaleLabel: {
                        fontColor: labelColor,
                        display: true,
                        labelString: this.props.xLabel
                    },
                    ticks: {
                        minor: {
                            fontColor: labelColor,
                        },
                        maxRotation: 0,
                        min: this.props.xMin,
                        max: this.props.xMax
                    },
                    afterBuildTicks: axis => {
                        axis.ticks = axis.ticks.slice(1, -1);
                    },
                    gridLines: {
                        drawBorder: false,
                        color: gridColor,
                        zeroLineColor: gridColor
                    }
                }],
                yAxes: [{
                    id: "y-axis-0",
                    drawBorder: false,
                    scaleLabel: {
                        fontColor: labelColor,
                        display: true,
                        labelString: this.props.yLabel
                    },
                    ticks: {
                        minor: {
                            fontColor: labelColor,
                        },
                        display: true,
                        min: this.props.yMin,
                        max: this.props.yMax
                    },
                    gridLines: {
                        drawBorder: false,
                        color: gridColor,
                        zeroLineColor: gridColor
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

        let plotData: Partial<ChartData> = {datasets: []};
        if (this.props.data && this.props.data.length) {
            const datasetConfig: ChartDataSets = {
                label: "LineGraph",
                type: "line",
                data: this.props.data,
                fill: false,
            };

            if (this.props.usePointSymbols) {
                datasetConfig.showLine = false;
                datasetConfig.pointRadius = 1;
                datasetConfig.pointBackgroundColor = lineColor;
            }
            else {
                datasetConfig.pointRadius = 0;
                datasetConfig.showLine = true;
                datasetConfig.steppedLine = !this.props.interpolateLines;
                datasetConfig.borderWidth = 1;
                datasetConfig.borderColor = lineColor;
            }
            plotData.datasets.push(datasetConfig);
        }

        const plugins = [{
            afterLayout: this.afterChartLayout,
        }];

        return <Scatter data={plotData} options={plotOptions} plugins={plugins} ref={this.onRef}/>;
    }
}