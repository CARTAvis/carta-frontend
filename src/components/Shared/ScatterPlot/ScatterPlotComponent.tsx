import * as React from "react";
import {observer} from "mobx-react";
import {action, computed, observable} from "mobx";
import {ESCAPE} from "@blueprintjs/core/lib/cjs/common/keys";
import {Colors} from "@blueprintjs/core";
import {Scatter} from "react-chartjs-2";
import ReactResizeDetector from "react-resize-detector";
import {Layer, Stage, Group, Line, Rect} from "react-konva";
import {ChartArea} from "chart.js";
import {PlotContainerComponent, TickType} from "components/Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {LineMarker, InteractionMode} from "components/Shared/LinePlot/LinePlotComponent";
import {ToolbarComponent} from "components/Shared/LinePlot/Toolbar/ToolbarComponent";
import "./ScatterPlotComponent.css";

type Point3D = { x: number, y: number, z?: number };

export class ScatterPlotComponentProps {
    width?: number;
    height?: number;
    data?: { x: number, y: number, z?: number }[];
    dataStat?: { mean: number, rms: number };
    cursorXY?: { profiler: Point3D, image: Point3D, unit: string };
    comments?: string[];
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
    imageName?: string;
    plotName?: string;
    usePointSymbols?: boolean;
    tickTypeX?: TickType;
    tickTypeY?: TickType;
    interpolateLines?: boolean;
    showTopAxis?: boolean;
    markers?: LineMarker[];
    topAxisTickFormatter?: (value: number, index: number, values: number[]) => string | number;
    graphClicked?: (x: number) => void;
    graphRightClicked?: (x: number) => void;
    graphZoomedX?: (xMin: number, xMax: number) => void;
    graphZoomedY?: (yMin: number, yMax: number) => void;
    graphZoomedXY?: (xMin: number, xMax: number, yMin: number, yMax: number) => void;
    graphZoomReset?: () => void;
    graphCursorMoved?: (x: number, y: number) => void;
    scrollZoom?: boolean;
    colorRangeEnd?: number;
    showXAxisTicks?: boolean;
    showXAxisLabel?: boolean;
    xZeroLineColor?: string;
    yZeroLineColor?: string;
    showLegend?: boolean;
    xTickMarkLength?: number;
    plotType?: string;
    dataBackgroundColor?: Array<string>;
    isGroupSubPlot?: boolean;
    centeredOrigin?: boolean;
    equalScale?: boolean;
    zIndex?: boolean;
    pointRadius?: number;
    scatterIndicator?:  { currentChannel: Point3D, hoveredChannel: Point3D };
    zeroLineWidth?: number;
}

@observer
export class ScatterPlotComponent extends React.Component<ScatterPlotComponentProps> {
    private markerOpacity = 0.8;
    private plotRef;
    private centeredOriginBorder: { xMin: number, xMax: number, yMin: number, yMax: number };

    @observable chartArea: ChartArea;
    @observable hoveredMarker: LineMarker;
    @observable width = 0;
    @observable height = 0;
    @observable isMouseEntered = false;
    @observable interactionMode = InteractionMode.NONE;

    @computed get isSelecting() {
        return this.interactionMode === InteractionMode.SELECTING;
    }

    @computed get isPanning() {
        return this.interactionMode === InteractionMode.PANNING;
    }

    onPlotRefUpdated = (plotRef) => {
        this.plotRef = plotRef;
    };

    @action updateChart = (chartArea: ChartArea) => {
        this.chartArea = chartArea;
    };

    @action resize = (w, h) => {
        this.width = w;
        this.height = h;
    };

    @action showMouseEnterWidget = () => {
        this.isMouseEntered = true;
    };

    @action hideMouseEnterWidget = () => {
        this.isMouseEntered = false;
    };

    @action endInteractions() {
        this.interactionMode = InteractionMode.NONE;
    }

    onMouseEnter = () => {
        this.showMouseEnterWidget();
    };

    onMouseMove = () => {
        this.showMouseEnterWidget();
    };

    onMouseLeave = () => {
        this.hideMouseEnterWidget();
    };

    onKeyDown = (ev: React.KeyboardEvent) => {
        if (this.isSelecting && ev.keyCode === ESCAPE) {
            this.endInteractions();
        }
    };

    private getTimestamp() {
        const now = new Date();
        return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
    }

    private genBorderRect = () => {
        const chartArea = this.chartArea;
        let borderRect = null;
        if (this.chartArea) {
            borderRect = (
                // Shift by half a pixel for sharp 1px lines
                <Rect
                    x={Math.floor(chartArea.left) - 0.5 * devicePixelRatio}
                    y={Math.floor(chartArea.top) - 0.5 * devicePixelRatio}
                    width={Math.ceil(chartArea.right - chartArea.left + 1)}
                    height={Math.ceil(chartArea.bottom - chartArea.top + 1)}
                    listening={false}
                    stroke={this.props.darkMode ? Colors.DARK_GRAY5 : Colors.LIGHT_GRAY1}
                    strokeWidth={1}
                />
            );
        }
        return borderRect;
    };

    private getChartAreaWH(chartArea: ChartArea): { width: number, height: number } {
        if (chartArea && chartArea.right && chartArea.bottom) {
            return {width: Math.abs(chartArea.right - chartArea.left), height: Math.abs(chartArea.bottom - chartArea.top)};
        } else {
            return {width: 0, height: 0};
        }
    }

    private resizeData(): { xMin: number, xMax: number, yMin: number, yMax: number } {
        if (this.props.centeredOrigin && this.props.xMin && this.props.xMax && this.props.yMin && this.props.yMax) {
            let xLimit = Math.max(Math.abs(this.props.xMin), Math.abs(this.props.xMax));
            let yLimit = Math.max(Math.abs(this.props.yMin), Math.abs(this.props.yMax));
            if (this.props.equalScale && this.chartArea) {
                let currentChartArea = this.getChartAreaWH(this.chartArea);
                if (currentChartArea.width !== 0 && currentChartArea.height !== 0) {
                    let ratio = currentChartArea.width / currentChartArea.height;
                    if (ratio < 1) {
                        yLimit = yLimit * (1 / ratio);
                    }
                    if (ratio > 1) {
                        xLimit = xLimit * ratio;
                    }
                }
            }
            return {xMin: -xLimit, xMax: xLimit, yMin: -yLimit, yMax: yLimit};
        }
        return {xMin: this.props.xMin, xMax: this.props.xMax, yMin: this.props.yMin, yMax: this.props.yMax};
    }

    private getPixelValue(value: number, min: number, max: number, isX: boolean) {
        if (!this.chartArea) {
            return undefined;
        }
        let fraction = (value - min) / (max - min);
        if (!isX) {
            fraction = 1 - fraction;
            return fraction * (this.chartArea.bottom - this.chartArea.top) + this.chartArea.top;
        }
        return fraction * (this.chartArea.right - this.chartArea.left) + this.chartArea.left;
    }

    private genXline(id: string, markerColor: string, markerOpacity: number, valueCanvasSpace: number) {
        const chartArea = this.chartArea;
        let lineSegments = [];
        if (chartArea) {
           lineSegments.push(<Line listening={false} key={0} points={[0, chartArea.top, 0, chartArea.bottom]} strokeWidth={1} stroke={markerColor} opacity={markerOpacity}/>); 
        } 
        return (
            <Group key={id} x={valueCanvasSpace} y={0}>
                {lineSegments}
            </Group>
        );
    }

    private genYline(id: string, markerColor: string, markerOpacity: number, valueCanvasSpace: number) {
        const chartArea = this.chartArea;
        let lineSegments = [];
        if (chartArea) {
            lineSegments.push(<Line listening={false} key={0} points={[chartArea.left, 0, chartArea.right, 0]} strokeWidth={1} stroke={markerColor} opacity={markerOpacity}/>);
        }
        return (
            <Group key={id} x={0} y={valueCanvasSpace}>
                {lineSegments}
            </Group>
        );
    }

    private genIndicator = () => {
        const chartArea = this.chartArea;
        let lines = [];
        const channel = this.props.scatterIndicator;
        const border = this.centeredOriginBorder;
        const markerOpacity = this.markerOpacity;
        const drawIndicator = chartArea && channel && this.props.centeredOrigin && border; 
        if (drawIndicator && channel.hoveredChannel && !isNaN(channel.hoveredChannel.x) && !isNaN(channel.hoveredChannel.y)) {
            const channelH = this.props.scatterIndicator.hoveredChannel;
            const markerColor = this.props.darkMode ? Colors.GRAY4 : Colors.GRAY2;           
            let xCanvasSpace = Math.floor(this.getPixelValue(channelH.x, border.xMin, border.xMax, true)) + 0.5 * devicePixelRatio;
            lines.push(this.genXline("scatter-indicator-x-hovered-interactive", markerColor, markerOpacity, xCanvasSpace));
            let yCanvasSpace = Math.floor(this.getPixelValue(channelH.y, border.yMin, border.yMax, false)) + 0.5 * devicePixelRatio;
            lines.push(this.genYline("scatter-indicator-y-hovered-interactive", markerColor, markerOpacity, yCanvasSpace));  
        }
        if (drawIndicator && channel.currentChannel && !isNaN(channel.currentChannel.x) && !isNaN(channel.currentChannel.y)) {
            const channelC = this.props.scatterIndicator.currentChannel;
            const markerColor = this.props.darkMode ? Colors.RED4 : Colors.RED2;
            let xCanvasSpace = Math.floor(this.getPixelValue(channelC.x, border.xMin, border.xMax, true)) + 0.5 * devicePixelRatio;
            lines.push(this.genXline("scatter-indicator-x-current-interactive", markerColor, markerOpacity, xCanvasSpace));
            let yCanvasSpace = Math.floor(this.getPixelValue(channelC.y, border.yMin, border.yMax, false)) + 0.5 * devicePixelRatio;
            lines.push(this.genYline("scatter-indicator-y-current-interactive", markerColor, markerOpacity, yCanvasSpace));  
        }
        return lines;
    }

    exportImage = () => {
        const scatter = this.plotRef as Scatter;
        const canvas = scatter.chartInstance.canvas;
        const plotName = this.props.plotName || "unknown";
        const imageName = this.props.imageName || "unknown";

        const composedCanvas = document.createElement("canvas") as HTMLCanvasElement;
        composedCanvas.width = canvas.width;
        composedCanvas.height = canvas.height;

        const ctx = composedCanvas.getContext("2d");
        ctx.fillStyle = this.props.darkMode ? Colors.DARK_GRAY3 : Colors.LIGHT_GRAY5;
        ctx.fillRect(0, 0, composedCanvas.width, composedCanvas.height);
        ctx.drawImage(canvas, 0, 0);

        composedCanvas.toBlob((blob) => {
            const link = document.createElement("a") as HTMLAnchorElement;
            link.download = `${imageName}-${plotName.replace(" ", "-")}-${this.getTimestamp()}.png`;
            link.href = URL.createObjectURL(blob);
            link.dispatchEvent(new MouseEvent("click"));
        }, "image/png");
    };

    exportData = () => {
        const plotName = this.props.plotName || "unknown";
        const imageName = this.props.imageName || "unknown";

        let comment = `# ${imageName} ${plotName}`;
        if (this.props.xLabel) {
            comment += `\n# xLabel: ${this.props.xLabel}`;
        }
        if (this.props.yLabel) {
            comment += `\n# yLabel: ${this.props.yLabel}`;
        }

        if (this.props.comments && this.props.comments.length) {
            comment += "\n" + this.props.comments.map(c => "# " + c).join("\n");
        }

        const header = "# x\ty";

        let rows = [];
        if (plotName === "histogram") {
            rows = this.props.data.map(o => `${o.x.toExponential(10)}\t${o.y.toExponential(10)}`);
        } else {
            if (this.props.data && this.props.data.length) {
                if (this.props.tickTypeX === TickType.Scientific) {
                    rows = this.props.data.map(o => `${o.x.toExponential(10)}\t${o.y.toExponential(10)}`);
                } else {
                    rows = this.props.data.map(o => `${o.x}\t${o.y.toExponential(10)}`);
                }
            }
        }

        const tsvData = `data:text/tab-separated-values;charset=utf-8,${comment}\n${header}\n${rows.join("\n")}\n`;

        const dataURL = encodeURI(tsvData).replace(/\#/g, "%23");

        const a = document.createElement("a") as HTMLAnchorElement;
        a.href = dataURL;
        a.download = `${imageName}-${plotName.replace(" ", "-")}-${this.getTimestamp()}.tsv`;
        a.dispatchEvent(new MouseEvent("click"));
    };

    render() {
        const isHovering = this.hoveredMarker !== undefined && !this.isSelecting;
        let axisRange = this.resizeData();
        this.centeredOriginBorder = axisRange;
        return (
            <div
                className={"scatter-plot-component"}
                style={{cursor: this.isPanning || isHovering ? "move" : "crosshair"}}
                onKeyDown={this.onKeyDown}
                onMouseEnter={this.onMouseEnter}
                onMouseMove={this.onMouseMove}
                onMouseLeave={this.onMouseLeave}
                tabIndex={0}
            >
                <ReactResizeDetector handleWidth handleHeight onResize={this.resize} refreshMode={"throttle"} refreshRate={33}/>
                <PlotContainerComponent
                    {...this.props}
                    plotRefUpdated={this.onPlotRefUpdated}
                    chartAreaUpdated={this.updateChart}
                    width={this.width}
                    height={this.height}
                    xMin={axisRange.xMin}
                    xMax={axisRange.xMax}
                    yMin={axisRange.yMin}
                    yMax={axisRange.yMax}
                />
                <Stage
                    className={"annotation-stage"}
                    width={this.width}
                    height={this.height}
                >
                    <Layer>
                        {this.genIndicator()}
                        {this.genBorderRect()}
                    </Layer>
                </Stage>
                <ToolbarComponent
                    darkMode={this.props.darkMode}
                    visible={this.isMouseEntered && (this.props.data !== undefined)}
                    exportImage={this.exportImage}
                    exportData={this.exportData}
                />
            </div>
        );
    }
}
