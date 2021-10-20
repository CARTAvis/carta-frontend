import * as React from "react";
import * as _ from "lodash";
import tinycolor from "tinycolor2";
import {Chart, ChartArea, ChartDataset, ChartOptions, Plugin, Scale, Tick} from "chart.js";
import {Scatter} from "react-chartjs-2";
import {Colors} from "@blueprintjs/core";
import {clamp, toExponential, toFixed} from "utilities";
import {PlotType} from "components/Shared";

export enum TickType {
    Automatic,
    Scientific,
    Integer
}

export class PlotContainerProps {
    width?: number;
    height?: number;
    data?: {x: number; y: number; z?: number}[];
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
    tickTypeX?: TickType;
    tickTypeY?: TickType;
    showTopAxis?: boolean;
    topAxisTickFormatter?: (value: number, index: number, values: Tick[]) => string | number;
    chartAreaUpdated?: (chartArea: ChartArea) => void;
    plotRefUpdated?: (plotRef: Chart) => void;
    showXAxisTicks?: boolean;
    showXAxisLabel?: boolean;
    showYAxisTicks?: boolean;
    showYAxisLabel?: boolean;
    xZeroLineColor?: string;
    yZeroLineColor?: string;
    showLegend?: boolean;
    xTickMarkLength?: number;
    plotType?: PlotType;
    dataBackgroundColor?: Array<string>;
    isGroupSubPlot?: boolean;
    pointRadius?: number;
    zeroLineWidth?: number;
    multiColorSingleLineColors?: Array<string>;
    multiColorMultiLinesColors?: Map<string, Array<string>>;
    borderWidth?: number;
    order?: number;
    multiPlotPropsMap?: Map<string, MultiPlotProps>;
}

export class MultiPlotProps {
    imageName: string;
    plotName: string;
    data: {x: number; y: number}[];
    type: PlotType;
    borderColor?: string;
    borderWidth?: number;
    pointRadius?: number;
    opacity?: number;
    order?: number;
    comments?: string[];
    hidden?: boolean;
    followingData?: string[];
    noExport?: boolean;
}

export class PlotContainerComponent extends React.Component<PlotContainerProps> {
    private plotRef: Chart;
    private chartArea: ChartArea;

    private afterChartLayout = (chart: Chart) => {
        if (this.props.isGroupSubPlot) {
            var xScale = chart.scales["x-axis-0"];
            var yScale = chart.scales["y-axis-0"];
            const currentWidth = chart.width;

            chart.chartArea.left = 85;
            chart.chartArea.right = currentWidth - 1;

            xScale.left = 85;
            xScale.right = currentWidth - 1;
            xScale.width = xScale.right - xScale.left;
            xScale["_startPixel"] = xScale.left;
            xScale["_length"] = xScale.width;

            chart.chartArea.left = 85;
            chart.chartArea.right = currentWidth - 1;

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

    private onRef = ref => {
        if (ref !== this.plotRef) {
            this.plotRef = ref;
            if (this.props.plotRefUpdated) {
                this.props.plotRefUpdated(this.plotRef);
            }
        }
    };

    private filterLogTicks = (axis: Scale) => {
        const ticks = this.removeAdditionalTicks(axis.ticks);
        if (ticks && ticks.length) {
            // Limit log axis ticks to integer multiples of power of 10 (i.e 1, 2, 3, 0.8, 0.5)
            let filteredTicks = ticks.filter(v => {
                const power = Math.floor(Math.log10(v.value));
                const mantissa = v.value * Math.pow(10, power);
                return Math.abs(mantissa % 1.0) < 1e-6;
            });
            if (filteredTicks.length > 8) {
                // Limit log axis ticks to power of 10 values or multiples of 2 of powers of 10 (i.e. 1, 2, 10, 0.1, 0.2)
                filteredTicks = ticks.filter(v => Math.abs(Math.log10(v.value) % 1.0) < 0.001 || Math.abs(Math.log10(v.value / 2.0) % 1.0) < 0.001);
                if (filteredTicks.length > 8) {
                    // Limit log axis ticks to power of 10 values
                    filteredTicks = ticks.filter(v => Math.abs(Math.log10(v.value) % 1.0) < 0.001);
                }
            }
            axis.ticks = filteredTicks;
        }
    };

    private filterLinearTicks = (axis: Scale, removeAdditionalTicks: boolean = true) => {
        let removeFirstTick = false;
        let removeLastTick = false;
        let roundingDecimalDigits: number;
        const ticks = removeAdditionalTicks ? this.removeAdditionalTicks(axis.ticks) : axis.ticks;
        // Get inter-tick distance
        if (ticks && ticks.length >= 4) {
            const interTickDist = Math.abs(ticks[2].value - ticks[1].value);
            const initialDist = Math.abs(ticks[1].value - ticks[0].value);
            const finalDist = Math.abs(ticks[ticks.length - 1].value - ticks[ticks.length - 2].value);

            // Flag initial tick removal if tick is too close to the subsequent tick
            if (initialDist < interTickDist * 0.999 || initialDist > interTickDist * 0.999) {
                removeFirstTick = true;
            }
            // Flag final tick removal if tick is too close to the preceding tick
            if (finalDist < interTickDist * 0.999 || finalDist > interTickDist * 0.999) {
                removeLastTick = true;
            }
            // Ensure that very small ticks display as zero
            // This is necessary due to a bug in Chart.js 2.8.0 that should be fixed in the next release
            const delta = ticks.length > 3 ? ticks[2].value - ticks[1].value : ticks[1].value - ticks[0].value;
            for (let i = 1; i < ticks.length - 1; i++) {
                const tickVal = ticks[i].value;
                const prevVal = ticks[i - 1].value;
                const nextVal = ticks[i + 1].value;
                // check if this tick might be the zero tick. If so, set it to exactly zero
                if (prevVal * nextVal < 0 && Math.abs(tickVal) < Math.abs(delta * 1e-3)) {
                    ticks[i].value = 0.0;
                    break;
                }
            }

            // Round ticks by inter-tick distance.
            // This is a workaround for the float number bug in Chart.js that the ticks could be like [45.451, 45.4520000001,45.4529999998] when users zoom in.
            if (interTickDist < 1) {
                roundingDecimalDigits = Math.abs(Math.floor(Math.log10(interTickDist)));
            }
        }
        // Remove first and last ticks if they've been flagged
        const newticks = ticks.slice(removeFirstTick ? 1 : 0, removeLastTick ? -1 : undefined);
        axis.ticks = roundingDecimalDigits ? newticks.map(tick => {
            tick.value = Number(tick.value.toFixed(roundingDecimalDigits));
            return tick;
        }) : newticks;
    };

    private filterYLogTicks = (axis: Scale) => {
        return this.filterLogTicks(axis);
    };

    private filterYLinearTicks = (axis: Scale) => {
        return this.filterLinearTicks(axis);
    };

    // remove the additional ticks, which are equal to the data value, when there is only one data
    // otherwise the additional ticks could overlap other ticks
    private removeAdditionalTicks = (ticks: Tick[]) => {
        let newTicks: Tick[] = ticks;
        if (this.props.data?.length === 1 && !this.props.multiPlotPropsMap?.size) {
            newTicks = ticks.slice(1, ticks.length - 1);
        } else if (!this.props.data?.length && this.props.multiPlotPropsMap?.size === 1) {
            this.props.multiPlotPropsMap.forEach(props => {
                if (props.data?.length === 1) {
                    newTicks = ticks.slice(1, ticks.length - 1);
                }
            });
        }
        return newTicks;
    };

    private static FormatTicksScientific = (value: number, index: number, ticks: Tick[]) => {
        return toExponential(value, 2);
    };

    private static FormatTicksInteger = (value: number, index: number, ticks: Tick[]) => {
        return toFixed(value);
    };

    private static FormatTicksAutomatic = (value: number, index: number, ticks: Tick[]) => {
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
        } else if (props.tickTypeX !== nextProps.tickTypeX) {
            return true;
        } else if (props.tickTypeY !== nextProps.tickTypeY) {
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
        } else if (props.borderWidth !== nextProps.borderWidth) {
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

        if (!props.multiColorSingleLineColors || !nextProps.multiColorSingleLineColors || props.multiColorSingleLineColors.length !== nextProps.multiColorSingleLineColors.length) {
            return true;
        }
        for (let i = 0; i < props.multiColorSingleLineColors.length; i++) {
            if (props.multiColorSingleLineColors[i] !== nextProps.multiColorSingleLineColors[i]) {
                return true;
            }
        }

        // Deep check of maps
        if (!_.isEqual(props.multiPlotPropsMap, nextProps.multiPlotPropsMap)) {
            return true;
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
            lineColor = tinycolor(lineColor).setAlpha(opacity).toRgbString();
        }

        // ChartJS plot
        let plotOptions: ChartOptions<"scatter"> = {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: this.props.showLegend === undefined ? false : this.props.showLegend
                }
            },
            scales: {
                "x-axis-0": {
                    position: "bottom",
                    min: this.props.xMin,
                    max: this.props.xMax,
                    afterBuildTicks: (axis: Scale) => this.filterLinearTicks(axis, false),
                    title: {
                        color: labelColor,
                        display: this.props.showXAxisLabel === undefined ? true : this.props.showXAxisLabel,
                        text: this.props.xLabel
                    },
                    ticks: {
                        display: this.props.showXAxisTicks === undefined ? true : this.props.showXAxisTicks,
                        maxRotation: 0,
                        color: labelColor,
                        callback: PlotContainerComponent.GetCallbackForTickType(this.props.tickTypeX)
                    },
                    grid: {
                        drawBorder: false,
                        color: (grid) => (grid.index === 0 && this.props.xZeroLineColor ? this.props.xZeroLineColor : gridColor),
                        lineWidth: (grid) => (grid.index === 0 && this.props.zeroLineWidth ? this.props.zeroLineWidth : 1),
                        tickLength: this.props.xTickMarkLength === 0 ? this.props.xTickMarkLength : 10
                    }
                },
                "x-axis-1": {
                    position: "top",
                    min: this.props.xMin,
                    max: this.props.xMax,
                    afterBuildTicks: (axis: Scale) => this.filterLinearTicks(axis, false),
                    type: "linear",
                    display: this.props.showTopAxis !== undefined,
                    ticks: {
                        color: labelColor,
                        maxRotation: 0
                    }
                },
                "y-axis-0":{
                    min: this.props.yMin,
                    max: this.props.yMax,
                    title: {
                        color: labelColor,
                        display: this.props.showYAxisLabel === undefined ? true : this.props.showYAxisLabel,
                        text: this.props.yLabel
                    },
                    ticks: {
                        color: labelColor,
                        display: this.props.showYAxisTicks === undefined ? true : this.props.showYAxisTicks,
                        callback: PlotContainerComponent.GetCallbackForTickType(this.props.tickTypeY)
                    },
                    grid: {
                        drawBorder: false,
                        color: (grid) => (grid.index === 0 && this.props.xZeroLineColor ? this.props.xZeroLineColor : gridColor),
                        lineWidth: (grid) => (grid.index === 0 && this.props.zeroLineWidth ? this.props.zeroLineWidth : 1)
                    }
                }
            },
            animation: false
        };

        if (this.props.topAxisTickFormatter) {
            plotOptions.scales["x-axis-1"].ticks.callback = this.props.topAxisTickFormatter;
        }

        if (this.props.logY) {
            plotOptions.scales["y-axis-0"].afterBuildTicks = this.filterYLogTicks;
            plotOptions.scales["y-axis-0"].type = "logarithmic";
        } else {
            plotOptions.scales["y-axis-0"].afterBuildTicks = this.filterYLinearTicks;
            plotOptions.scales["y-axis-0"].type = "linear";
        }

        let plotData: ChartDataset<"scatter">[] = [];
        if (this.props.data && this.props.data.length) {
            const datasetConfig: ChartDataset = {
                label: "LineGraph",
                type: "scatter",
                data: this.props.data,
                fill: false,
                tension: 0,
                order: this.props.order ? this.props.order : 0,
            };
            if (this.props.plotType === PlotType.POINTS) {
                datasetConfig.showLine = false;
                datasetConfig.borderWidth = 0;
                datasetConfig.borderColor = "rgba(0, 0, 0, 0)";
                datasetConfig.pointRadius = this.props.pointRadius ? this.props.pointRadius : 1;
                datasetConfig.pointBackgroundColor = lineColor;
            } else {
                datasetConfig.pointRadius = 0;
                datasetConfig.showLine = true;
                datasetConfig.stepped = this.props.plotType === PlotType.STEPS ? "middle" : false;
                datasetConfig.borderWidth = this.props.borderWidth ? this.props.borderWidth : 1;
                datasetConfig.borderColor = lineColor;
            }

            // change line segments or points color with interaction
            if (this.props.multiColorSingleLineColors && this.props.multiColorSingleLineColors.length) {
                if (this.props.plotType === PlotType.POINTS) {
                    datasetConfig.pointBackgroundColor = this.props.multiColorSingleLineColors;
                } else {
                    datasetConfig.pointRadius = 0.5;
                    datasetConfig.pointStyle = "line";
                    datasetConfig.segment = {
                        borderColor: (segment) => {
                            return this.props.multiColorSingleLineColors[segment.p0DataIndex];
                        }
                    }
                }
            }
            // line data point background color
            if (this.props.dataBackgroundColor) {
                datasetConfig.pointBackgroundColor = this.props.dataBackgroundColor;
            }
            plotData.push(datasetConfig);
        }

        if (this.props.multiPlotPropsMap && this.props.multiPlotPropsMap.size > 0) {
            this.props.multiPlotPropsMap.forEach((props, key) => {
                if (props.hidden) {
                    return;
                }

                // replace log(0) with log(0.5)
                if (this.props.logY) {
                    for (let index = 0; index < props.data.length; index++) {
                        const point = props.data[index];
                        if (point.y === 0) {
                            point.y = 0.5;
                        }
                    }
                }

                let currentLineColor = props.borderColor ? props.borderColor : lineColor;
                let currentOpacity = clamp((props.opacity ? props.opacity : opacity) || 1.0, 0, 1);
                if (currentOpacity < 1.0) {
                    currentLineColor = tinycolor(currentLineColor).setAlpha(currentOpacity).toRgbString();
                }
                const multiPlotDatasetConfig: ChartDataset = {
                    type: "scatter",
                    label: key,
                    data: props.data,
                    fill: false,
                    tension: 0,
                    backgroundColor: currentLineColor,
                    order: props.order ? props.order : 0
                };

                if (this.props.multiColorMultiLinesColors && this.props.multiColorMultiLinesColors.size) {
                    if (props.type === PlotType.POINTS) {
                        multiPlotDatasetConfig.pointBackgroundColor = this.props.multiColorMultiLinesColors.get(key);
                        multiPlotDatasetConfig.borderColor = currentLineColor;
                        multiPlotDatasetConfig.pointBorderColor = "rgba(0, 0, 0, 0)";
                    } else {
                        const colors = this.props.multiColorMultiLinesColors.get(key);
                        multiPlotDatasetConfig.segment = {
                            borderColor: (segment) => { 
                                return colors[segment.p0DataIndex];
                            }
                        }
                    }
                }

                let currentPointRadius = props.pointRadius ? props.pointRadius : this.props.pointRadius;
                let currentLineWidth = props.borderWidth ? props.borderWidth : this.props.borderWidth;

                if (props.type === PlotType.POINTS) {
                    multiPlotDatasetConfig.showLine = false;
                    multiPlotDatasetConfig.pointStyle = "circle";
                    multiPlotDatasetConfig.pointRadius = currentPointRadius ? currentPointRadius : 1;
                    multiPlotDatasetConfig.borderWidth = 0;
                } else if (props.type === PlotType.LINES || props.type === PlotType.STEPS) {
                    multiPlotDatasetConfig.showLine = true;
                    multiPlotDatasetConfig.pointRadius = 0.5;
                    multiPlotDatasetConfig.pointStyle = "line";
                    multiPlotDatasetConfig.stepped = props.type === PlotType.STEPS ? "middle" : false;
                    multiPlotDatasetConfig.borderWidth = currentLineWidth ? currentLineWidth : 1;
                    multiPlotDatasetConfig.borderColor = currentLineColor;
                }

                plotData.push(multiPlotDatasetConfig);
            });
        }

        let plugins: Plugin[] = [
            {
                id: "afterLayout",
                afterLayout: this.afterChartLayout
            }
        ];

        // https://github.com/reactchartjs/react-chartjs-2/issues/734 fixed in v3.1.1
        return <Scatter data={{datasets: plotData}} options={plotOptions} plugins={plugins} ref={this.onRef} />;
    }
}
