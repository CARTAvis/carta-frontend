import * as React from "react";
import * as _ from "lodash";
import {ChartArea, ChartData, ChartDataSets, ChartOptions} from "chart.js";
import {Scatter} from "react-chartjs-2";
import {Colors} from "@blueprintjs/core";
import {clamp, hexStringToRgba} from "utilities";

export enum TickType {
    Automatic,
    Scientific,
    Integer
}

export class PlotContainerProps {
    width?: number;
    height?: number;
    data?: { x: number, y: number, z?: number }[];
    xMin?: number;
    xMax?: number;
    yMin?: number;
    yMax?: number;
    xLabel?: string;
    yLabel?: string;
    logY?: boolean;
    lineColor?: string;
    opacity?: number;
    darkMode?: boolean;
    usePointSymbols?: boolean;
    tickTypeX?: TickType;
    tickTypeY?: TickType;
    interpolateLines?: boolean;
    showTopAxis?: boolean;
    topAxisTickFormatter?: (value: number, index: number, values: number[]) => string | number;
    chartAreaUpdated?: (chartArea: ChartArea) => void;
    plotRefUpdated?: (plotRef: Scatter) => void;
    multiPlotData?: Map<string, { x: number, y: number }[]>;
    showXAxisTicks?: boolean;
    showXAxisLabel?: boolean;
    xZeroLineColor?: string;
    yZeroLineColor?: string;
    showLegend?: boolean;
    xTickMarkLength?: number;
    multiPlotBorderColor?: Map<string, string>;
    plotType?: string;
    dataBackgroundColor?: Array<string>;
    isGroupSubPlot?: boolean;
    pointRadius?: number;
    zeroLineWidth?: number;
    interactionMode?: boolean;
}

export class PlotContainerComponent extends React.Component<PlotContainerProps> {
    private plotRef: Scatter;
    private chartArea: ChartArea;

    private afterChartLayout = (chart: any) => {
        if (this.props.isGroupSubPlot) {
            var xScale = chart.scales["x-axis-0"];
            var yScale = chart.scales["y-axis-0"];
            const currentWidth = chart.width;

            xScale.left = 85;
            xScale.right = currentWidth - 20;
            xScale.width = xScale.right - xScale.left;

            chart.chartArea.left = 85;
            chart.chartArea.right = currentWidth - 20;

            yScale.right = xScale.left;
            yScale.width = yScale.right - yScale.left;
        }

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
            // Ensure that very small ticks display as zero
            // This is necessary due to a bug in Chart.js 2.8.0 that should be fixed in the next release
            const delta = axis.ticks.length > 3 ? axis.ticks[2] - axis.ticks[1] : axis.ticks[1] - axis.ticks[0];
            for (let i = 1; i < axis.ticks.length - 1; i++) {
                const tickVal = axis.ticks[i];
                const prevVal = axis.ticks[i - 1];
                const nextVal = axis.ticks[i + 1];
                // check if this tick might be the zero tick. If so, set it to exactly zero
                if (prevVal * nextVal < 0 && Math.abs(tickVal) < Math.abs(delta * 1e-3)) {
                    axis.ticks[i] = 0.0;
                    break;
                }
            }
        }
        // Remove first and last ticks if they've been flagged
        axis.ticks = axis.ticks.slice(removeFirstTick ? 1 : 0, removeLastTick ? -1 : undefined);
    };

    private static FormatTicksScientific = (value: number, index: number, values: number[]) => {
        return value.toExponential(2);
    };

    private static FormatTicksInteger = (value: number, index: number, values: number[]) => {
        if (value) {
            return value.toFixed();
        }
        return value;
    };

    private static FormatTicksAutomatic = (value: number, index: number, values: number[]) => {
        // TODO: Work out how to revert to the automatic ChartJS formatting function
        return value;
    };

    private static GetCallbackForTickType(tickType: TickType) {
        switch (tickType) {
            case TickType.Scientific:
                return PlotContainerComponent.FormatTicksScientific;
            case TickType.Integer:
                return PlotContainerComponent.FormatTicksInteger;
            default:
                return PlotContainerComponent.FormatTicksAutomatic;
        }
    }

    shouldComponentUpdate(nextProps: PlotContainerProps) {
        const props = this.props;

        // Basic prop check
        if (props.width !== nextProps.width) {
            return true;
        } else if (props.height !== nextProps.height) {
            return true;
        } else if (props.lineColor !== nextProps.lineColor) {
            return true;
        } else if (props.opacity !== nextProps.opacity) {
            return true;
        } else if (props.usePointSymbols !== nextProps.usePointSymbols) {
            return true;
        } else if (props.tickTypeX !== nextProps.tickTypeX) {
            return true;
        } else if (props.tickTypeY !== nextProps.tickTypeY) {
            return true;
        } else if (props.interpolateLines !== nextProps.interpolateLines) {
            return true;
        } else if (props.darkMode !== nextProps.darkMode) {
            return true;
        } else if (props.logY !== nextProps.logY) {
            return true;
        } else if (props.xLabel !== nextProps.xLabel) {
            return true;
        } else if (props.xMin !== nextProps.xMin) {
            return true;
        } else if (props.xMax !== nextProps.xMax) {
            return true;
        } else if (props.yMin !== nextProps.yMin) {
            return true;
        } else if (props.yMax !== nextProps.yMax) {
            return true;
        } else if (props.yLabel !== nextProps.yLabel) {
            return true;
        } else if (props.showTopAxis !== nextProps.showTopAxis) {
            return true;
        } else if (props.topAxisTickFormatter !== nextProps.topAxisTickFormatter) {
            return true;
        } else if (props.showXAxisTicks !== nextProps.showXAxisTicks) {
            return true;
        } else if (props.showXAxisLabel !== nextProps.showXAxisLabel) {
            return true;
        } else if (props.xZeroLineColor !== nextProps.xZeroLineColor) {
            return true;
        } else if (props.yZeroLineColor !== nextProps.yZeroLineColor) {
            return true;
        } else if (props.showLegend !== nextProps.showLegend) {
            return true;
        } else if (props.xTickMarkLength !== nextProps.xTickMarkLength) {
            return true;
        } else if (props.multiPlotBorderColor !== nextProps.multiPlotBorderColor) {
            return true;
        } else if (props.plotType !== nextProps.plotType) {
            return true;
        } else if (props.dataBackgroundColor !== nextProps.dataBackgroundColor) {
            return true;
        } else if (props.isGroupSubPlot !== nextProps.isGroupSubPlot) {
            return true;
        } else if (props.pointRadius !== nextProps.pointRadius) {
            return true;
        } else if (props.zeroLineWidth !== nextProps.zeroLineWidth) {
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
        let lineColor = this.props.lineColor || (this.props.darkMode ? Colors.BLUE4 : Colors.BLUE2);
        const opacity = clamp(this.props.opacity || 1.0, 0, 1);
        if (opacity < 1.0) {
            lineColor = hexStringToRgba(lineColor, opacity);
        }

        // ChartJS plot
        let plotOptions: ChartOptions = {
            maintainAspectRatio: false,
            events: ["mousedown", "mouseup", "mousemove", "dblclick"],
            legend: {
                display: this.props.showLegend === undefined ? false : this.props.showLegend,
            },
            scales: {
                xAxes: [{
                    id: "x-axis-0",
                    position: "bottom",
                    afterBuildTicks: this.filterLinearTicks,
                    scaleLabel: {
                        fontColor: labelColor,
                        display: this.props.showXAxisLabel === undefined ? true : this.props.showXAxisLabel,
                        labelString: this.props.xLabel
                    },
                    ticks: {
                        display: this.props.showXAxisTicks === undefined ? true : this.props.showXAxisTicks,
                        minor: {
                            fontColor: labelColor,
                        },
                        maxRotation: 0,
                        min: this.props.xMin,
                        max: this.props.xMax,
                        callback: PlotContainerComponent.GetCallbackForTickType(this.props.tickTypeX)
                    },
                    gridLines: {
                        drawBorder: false,
                        color: gridColor,
                        zeroLineColor: this.props.xZeroLineColor ? this.props.xZeroLineColor : gridColor,
                        zeroLineWidth: this.props.zeroLineWidth ? this.props.zeroLineWidth : 1,
                        tickMarkLength: this.props.xTickMarkLength === 0 ? this.props.xTickMarkLength : 10
                    },
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
                        callback: PlotContainerComponent.GetCallbackForTickType(this.props.tickTypeY)
                    },
                    gridLines: {
                        drawBorder: false,
                        color: gridColor,
                        zeroLineColor: this.props.yZeroLineColor ? this.props.yZeroLineColor : gridColor,
                        zeroLineWidth: this.props.zeroLineWidth ? this.props.zeroLineWidth : 1,
                    },
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
        } else {
            plotOptions.scales.yAxes[0].afterBuildTicks = this.filterLinearTicks;
            plotOptions.scales.yAxes[0].type = "linear";
        }

        let plotData: Partial<ChartData> = {datasets: []};
        if (this.props.data && this.props.data.length) {
            const datasetConfig: ChartDataSets = {
                label: "LineGraph",
                type: this.props.plotType ? this.props.plotType : "line",
                data: this.props.data,
                fill: false,
                lineTension: 0,
            };
            if (this.props.usePointSymbols) {
                datasetConfig.showLine = false;
                datasetConfig.pointRadius = 1;
                datasetConfig.pointBackgroundColor = lineColor;
            } else {
                datasetConfig.pointRadius = 0;
                datasetConfig.showLine = true;
                datasetConfig.steppedLine = this.props.interpolateLines ? false : "middle";
                datasetConfig.borderWidth = 1;
                datasetConfig.borderColor = lineColor;
            }

            if (this.props.interactionMode) {
                datasetConfig.pointRadius = 1;
                datasetConfig.pointStyle = "line";
            }
            if (this.props.dataBackgroundColor) {
                datasetConfig.pointBackgroundColor = this.props.dataBackgroundColor;
            }
            if (this.props.pointRadius) {
                datasetConfig.pointRadius = this.props.pointRadius;
            }
            plotData.datasets.push(datasetConfig);
        }

        if (this.props.multiPlotData) {
            this.props.multiPlotData.forEach((value, key) => {
                let currentLineColor = this.props.multiPlotBorderColor ? this.props.multiPlotBorderColor.get(key) : lineColor;
                if (opacity < 1.0) {
                    currentLineColor = hexStringToRgba(currentLineColor, opacity);
                }
                const multiPlotDatasetConfig: ChartDataSets = {
                    type: this.props.plotType ? this.props.plotType : "line",
                    label: key[0],
                    data: value,
                    fill: false,
                    lineTension: 0,
                    borderColor: currentLineColor,
                    backgroundColor: currentLineColor,
                    showLine: true,
                    steppedLine: this.props.interpolateLines ? false : "middle",
                    borderWidth: 1,
                    pointRadius: 0
                };

                if (this.props.interactionMode) {
                    multiPlotDatasetConfig.pointRadius = 1;
                    multiPlotDatasetConfig.pointStyle = "line";
                }

                plotData.datasets.push(multiPlotDatasetConfig);
            });
        }

        let plugins = [{
            afterLayout: this.afterChartLayout,
        }];

        return <Scatter data={plotData} options={plotOptions} plugins={plugins} ref={this.onRef}/>;
    }
}