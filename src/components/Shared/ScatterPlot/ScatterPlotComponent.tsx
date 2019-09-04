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
import {ToolbarComponent} from "components/Shared/LinePlot/Toolbar/ToolbarComponent";
import {ScatterProfilerInfoComponent} from "./ProfilerInfo/ProfilerInfoComponent";
import {closestPointToCursor} from "utilities";
import "./ScatterPlotComponent.css";

type Point3D = { x: number, y: number, z?: number };

enum InteractionMode {
    NONE,
    SELECTING,
    PANNING
}

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
    // markers?: LineMarker[];
    showTopAxis?: boolean;
    topAxisTickFormatter?: (value: number, index: number, values: number[]) => string | number;
    graphClicked?: (x: number) => void;
    graphRightClicked?: (x: number) => void;
    graphZoomedX?: (xMin: number, xMax: number) => void;
    graphZoomedY?: (yMin: number, yMax: number) => void;
    graphZoomedXY?: (xMin: number, xMax: number, yMin: number, yMax: number) => void;
    graphZoomReset?: () => void;
    graphCursorMoved?: (x: number, y: number) => void;
    scrollZoom?: boolean;
    multiPlotData?: Map<string, { x: number, y: number }[]>;
    colorRangeEnd?: number;
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
    private centeredOriginMode :{ xMin: number, xMax: number, yMin: number, yMax: number };
    @observable chartArea: ChartArea;
    @observable width = 0;
    @observable height = 0;
    @observable isMouseEntered = false;
    @observable interactionMode = InteractionMode.NONE;

    @computed get isSelecting() {
        return this.interactionMode === InteractionMode.SELECTING;
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

    // not fit, need to change
    private getValueForPixelX(pixel: number) {
        if (!this.chartArea) {
            return undefined;
        }
        const fraction = (pixel - this.chartArea.left) / (this.chartArea.right - this.chartArea.left);
        if (this.centeredOriginMode && this.props.centeredOrigin) {
            return fraction * (this.centeredOriginMode.xMax - this.centeredOriginMode.xMin) + this.centeredOriginMode.xMin;
        }
        return fraction * (this.props.xMax - this.props.xMin) + this.props.xMin;
    }

    private getValueForPixelY(pixel: number) {
        if (!this.chartArea) {
            return undefined;
        }
        const fraction = (this.chartArea.bottom - pixel) / (this.chartArea.bottom - this.chartArea.top);
        if (this.centeredOriginMode && this.props.centeredOrigin) {
            return fraction * (this.centeredOriginMode.yMax - this.centeredOriginMode.yMin) + this.centeredOriginMode.yMin;
        }
        return fraction * (this.props.yMax - this.props.yMin) + this.props.yMin;
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
        let border = this.resizeData();
        const markerOpacity = this.markerOpacity; 
        if (chartArea && channel && channel.hoveredChannel && !isNaN(channel.hoveredChannel.x) && !isNaN(channel.hoveredChannel.y)) {
            const channelH = this.props.scatterIndicator.hoveredChannel;
            const markerColor = this.props.darkMode ? Colors.GRAY4 : Colors.GRAY2;           
            let xCanvasSpace = Math.floor(this.getPixelValue(channelH.x, border.xMin, border.xMax, true)) + 0.5 * devicePixelRatio;
            lines.push(this.genXline("scatter-indicator-x-hovered-interactive", markerColor, markerOpacity, xCanvasSpace));
            let yCanvasSpace = Math.floor(this.getPixelValue(channelH.y, border.yMin, border.yMax, false)) + 0.5 * devicePixelRatio;
            lines.push(this.genYline("scatter-indicator-y-hovered-interactive", markerColor, markerOpacity, yCanvasSpace));  
        }
        if (chartArea && channel && channel.currentChannel && !isNaN(channel.currentChannel.x) && !isNaN(channel.currentChannel.y)) {
            const channelC = this.props.scatterIndicator.currentChannel;
            const markerColor = this.props.darkMode ? Colors.RED4 : Colors.RED2;
            let xCanvasSpace = Math.floor(this.getPixelValue(channelC.x, border.xMin, border.xMax, true)) + 0.5 * devicePixelRatio;
            lines.push(this.genXline("scatter-indicator-x-current-interactive", markerColor, markerOpacity, xCanvasSpace));
            let yCanvasSpace = Math.floor(this.getPixelValue(channelC.y, border.yMin, border.yMax, false)) + 0.5 * devicePixelRatio;
            lines.push(this.genYline("scatter-indicator-y-current-interactive", markerColor, markerOpacity, yCanvasSpace));  
        }
        if (this.props.cursorXY && this.isMouseEntered) {
            // console.log(this.props.cursorXY)
            const channelH = this.props.cursorXY.profiler;
            const markerColor = this.props.darkMode ? Colors.GRAY4 : Colors.GRAY2;
            if (channelH.x >= this.centeredOriginMode.xMin && channelH.x <= this.centeredOriginMode.xMax && channelH.y >= this.centeredOriginMode.yMin && channelH.y <= this.centeredOriginMode.yMax) {
            let xCanvasSpace = Math.floor(this.getPixelValue(channelH.x, border.xMin, border.xMax, true)) + 0.5 * devicePixelRatio;
            lines.push(this.genXline("scatter-indicator-x-hovered", markerColor, markerOpacity, xCanvasSpace));
            let yCanvasSpace = Math.floor(this.getPixelValue(channelH.y, border.yMin, border.yMax, false)) + 0.5 * devicePixelRatio;
            lines.push(this.genYline("scatter-indicator-y-hovered", markerColor, markerOpacity, yCanvasSpace));  
            }
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


    onStageMouseMove = (ev) => {
        if (this.props.data || this.props.multiPlotData) {
            const mouseEvent: MouseEvent = ev.evt;
            const chartArea = this.chartArea;
            // console.log("in")
            let mousePosX = mouseEvent.offsetX;
            let mousePosY = mouseEvent.offsetY;
            // let mousePosY = clamp(mouseEvent.offsetY, chartArea.top - 1, chartArea.bottom + 1);
            // if (this.isSelecting) {
            //     this.updateSelection(mousePosX, mousePosY);
            // } else if (this.isPanning && this.props.graphZoomedX) {
            //     const currentPan = mousePosX;
            //     const prevPanGraphSpace = this.getValueForPixelX(this.panPrevious);
            //     const currentPanGraphSpace = this.getValueForPixelX(currentPan);
            //     const delta = (currentPanGraphSpace - prevPanGraphSpace);
            //     this.updatePan(currentPan);
            //     // Shift zoom to counteract drag's delta
            //     this.props.graphZoomedX(this.props.xMin - delta, this.props.xMax - delta);
            // }
            // Cursor move updates
            if (this.interactionMode === InteractionMode.NONE && this.props.graphCursorMoved) {
                const cursorXPosGraphSpace = this.getValueForPixelX(mousePosX);
                const cursorYPosGraphSpace = this.getValueForPixelY(mousePosY);
                this.props.graphCursorMoved(cursorXPosGraphSpace, cursorYPosGraphSpace);
            }
        }
    };

    private getCursorInfo = () => {
        let cursorInfo = null;
        if (this.props.data && this.props.cursorXY && this.isMouseEntered) {
            let nearest = closestPointToCursor(this.props.cursorXY.profiler, this.props.data);
            if (nearest) {
                cursorInfo = {
                    isMouseEntered: this.isMouseEntered,
                    cursorX: nearest.x,
                    cursorY: nearest.y,
                    xUnit: this.props.cursorXY.unit,
                };
            }
        }
        return cursorInfo;
    };

    render() {
        // const isHovering = this.hoveredMarker !== undefined && !this.isSelecting;
        let axisRange = this.resizeData();
        this.centeredOriginMode = axisRange;
        const cursorInfo = this.getCursorInfo();
        return (
            <div
                className={"scatter-plot-component"}
                style={{cursor: "crosshair"}}
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
                    onMouseMove={this.onStageMouseMove}
                >
                    <Layer>
                        {this.genIndicator()}
                        {this.genBorderRect()}
                    </Layer>
                </Stage>
                <ToolbarComponent
                    darkMode={this.props.darkMode}
                    visible={this.isMouseEntered && (this.props.data !== undefined || this.props.multiPlotData !== undefined)}
                    exportImage={this.exportImage}
                    exportData={this.exportData}
                />
                {cursorInfo &&
                <ScatterProfilerInfoComponent
                    darkMode={this.props.darkMode}
                    cursorInfo={cursorInfo}
                    statInfo={this.props.dataStat}
                />
                }
            </div>
        );
    }
}
