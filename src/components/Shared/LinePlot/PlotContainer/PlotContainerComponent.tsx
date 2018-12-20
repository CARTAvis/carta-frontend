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
    forceScientificNotationTicksX?: boolean;
    forceScientificNotationTicksY?: boolean;
    interpolateLines?: boolean;
    showTopAxis?: boolean;
    topAxisTickFormatter?: (value: number, index: number, values: number[]) => string | number;
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

    private filterLogTicks = (axis) => {
        if (axis.ticks) {
            // Limit log axis ticks to integer multiples of power of 10 (i.e 1, 2, 3, 0.8, 0.5)
            let filteredTicks = axis.ticks.filter(v => {
                const power = Math.floor(Math.log10(v));
                const mantissa = v * Math.pow(10, power);
                return (Math.abs(mantissa % 1.0) < 1e-6);
            });
            if (filteredTicks.length > 8) {
                // Limit log axis ticks to power of 10 values or multiples of 2 of powers of 10 (i.e. 1, 2, 10, 0.1, 0.2)
                filteredTicks = axis.ticks.filter(v => Math.abs(Math.log10(v) % 1.0) < 0.001 || Math.abs(Math.log10(v / 2.0) % 1.0) < 0.001);
                if (filteredTicks.length > 8) {
                    // Limit log axis ticks to power of 10 values
                    filteredTicks = axis.ticks.filter(v => Math.abs(Math.log10(v) % 1.0) < 0.001);
                }

            }
            axis.ticks = filteredTicks;
        }
    };

    private filterLinearTicks = (axis) => {
        let removeFirstTick = false;
        let removeLastTick = false;
        // Get inter-tick distance
        if (axis.ticks && axis.ticks.length >= 4) {
            const interTickDist = Math.abs(axis.ticks[2] - axis.ticks[1]);
            const initialDist = Math.abs(axis.ticks[1] - axis.ticks[0]);
            const finalDist = Math.abs(axis.ticks[axis.ticks.length - 1] - axis.ticks[axis.ticks.length - 2]);

            // Flag initial tick removal if tick is too close to the subsequent tick
            if (initialDist < interTickDist * 0.999) {
                removeFirstTick = true;
            }
            // Flag final tick removal if tick is too close to the preceding tick
            if (finalDist < interTickDist * 0.999) {
                removeLastTick = true;
            }
        }
        // Remove first and last ticks if they've been flagged
        axis.ticks = axis.ticks.slice(removeFirstTick ? 1 : 0, removeLastTick ? -1 : undefined);
    };

    private formatTicksScientific = (value: number, index: number, values: number[]) => {
        return value.toExponential(2);
    };

    private formatTicksAutomatic = (value: number, index: number, values: number[]) => {
        // TODO: Work out how to revert to the automatic ChartJS formatting function
        return value;
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
        else if (props.forceScientificNotationTicksX !== nextProps.forceScientificNotationTicksX) {
            return true;
        }
        else if (props.forceScientificNotationTicksY !== nextProps.forceScientificNotationTicksY) {
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
        else if (props.showTopAxis !== nextProps.showTopAxis) {
            return true;
        }
        else if (props.topAxisTickFormatter !== nextProps.topAxisTickFormatter) {
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
        let plotOptions: ChartOptions = {
            maintainAspectRatio: false,
            events: ["mousedown", "mouseup", "mousemove", "dblclick"],
            legend: {
                display: false
            },
            scales: {
                xAxes: [{
                    id: "x-axis-0",
                    position: "bottom",
                    afterBuildTicks: this.filterLinearTicks,
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
                        max: this.props.xMax,
                        callback: this.props.forceScientificNotationTicksX ? this.formatTicksScientific : this.formatTicksAutomatic
                    },
                    gridLines: {
                        drawBorder: false,
                        color: gridColor,
                        zeroLineColor: gridColor
                    }
                }, {
                    id: "x-axis-1",
                    position: "top",
                    afterBuildTicks: this.filterLinearTicks,
                    type: "linear",
                    display: this.props.showTopAxis,
                    ticks: {
                        minor: {
                            fontColor: labelColor,
                        },
                        maxRotation: 0,
                        min: this.props.xMin,
                        max: this.props.xMax,
                    }
                }],
                yAxes: [{
                    id: "y-axis-0",
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
                        max: this.props.yMax,
                        callback: this.props.forceScientificNotationTicksY ? this.formatTicksScientific : this.formatTicksAutomatic
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

        if (this.props.topAxisTickFormatter) {
            plotOptions.scales.xAxes[1].ticks.callback = this.props.topAxisTickFormatter;
        }

        if (this.props.logY) {
            plotOptions.scales.yAxes[0].afterBuildTicks = this.filterLogTicks;
            plotOptions.scales.yAxes[0].type = "logarithmic";
        }
        else {
            plotOptions.scales.yAxes[0].afterBuildTicks = this.filterLinearTicks;
            plotOptions.scales.yAxes[0].type = "linear";
        }

        let plotData: Partial<ChartData> = {datasets: []};
        if (this.props.data && this.props.data.length) {
            const datasetConfig: ChartDataSets = {
                label: "LineGraph",
                type: "line",
                data: this.props.data,
                fill: false,
                lineTension: 0
            };

            if (this.props.usePointSymbols) {
                datasetConfig.showLine = false;
                datasetConfig.pointRadius = 1;
                datasetConfig.pointBackgroundColor = lineColor;
            }
            else {
                datasetConfig.pointRadius = 0;
                datasetConfig.showLine = true;
                // @ts-ignore TODO: Remove once Chart.js types are updated
                datasetConfig.steppedLine = this.props.interpolateLines ? false : "middle";
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