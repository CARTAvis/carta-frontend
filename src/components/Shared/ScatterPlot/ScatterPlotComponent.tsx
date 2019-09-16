import * as React from "react";
import {observer} from "mobx-react";
import {action, computed, observable} from "mobx";
import {ESCAPE} from "@blueprintjs/core/lib/cjs/common/keys";
import {Colors} from "@blueprintjs/core";
import {Scatter} from "react-chartjs-2";
import ReactResizeDetector from "react-resize-detector";
import {Layer, Stage, Group, Line, Ring, Rect} from "react-konva";
import {ChartArea} from "chart.js";
import {PlotContainerComponent, TickType} from "components/Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {ToolbarComponent} from "components/Shared/LinePlot/Toolbar/ToolbarComponent";
import {Point2D} from "models";
import {clamp} from "utilities";
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
    showTopAxis?: boolean;
    topAxisTickFormatter?: (value: number, index: number, values: number[]) => string | number;
    graphClicked?: (x: number, y: number, data: { x: number, y: number, z?: number }[]) => void;
    graphRightClicked?: (x: number) => void;
    graphZoomedX?: (xMin: number, xMax: number) => void;
    graphZoomedY?: (yMin: number, yMax: number) => void;
    graphZoomedXY?: (xMin: number, xMax: number, yMin: number, yMax: number) => void;
    graphZoomReset?: () => void;
    graphCursorMoved?: (x: number, y: number) => void;
    mouseEntered?: (value: boolean) => void;
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
    indicatorInteractionChannel?: { currentChannel: Point3D, hoveredChannel: Point3D, start: boolean };
    zeroLineWidth?: number;
    cursorNearestPoint?: { x: number, y: number };
}

// Maximum time between double clicks
const DOUBLE_CLICK_THRESHOLD = 300;
// Minimum pixel distance before turning a click into a drag event
const DRAG_THRESHOLD = 3;

@observer
export class ScatterPlotComponent extends React.Component<ScatterPlotComponentProps> {
    private markerOpacity = 0.8;
    private plotRef;
    private centeredOriginMode: { xMin: number, xMax: number, yMin: number, yMax: number };
    private previousClickTime: number;
    private pendingClickHandle;
    private stageClickStartX: number;
    private stageClickStartY: number;

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
        // set mouseEtered to true, if mouse entered into the plots or mouse already in plots
        if (this.props.mouseEntered) {
            this.props.mouseEntered(true);
        }
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
        if (this.props.mouseEntered) {
            this.props.mouseEntered(false);
        }
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

    private genCircle(id: string, markerColor: string, valueCanvasSpaceX: number, valueCanvasSpaceY: number) {
        return (
            <Group key={id} x={valueCanvasSpaceX} y={valueCanvasSpaceY}>
                <Ring innerRadius={2} outerRadius={6} fill={markerColor}/>
            </Group>
        );
    }

    private genIndicator = () => {
        const chartArea = this.chartArea;
        let indicator = [];
        const channel = this.props.indicatorInteractionChannel;
        let border = this.resizeData();
        const markerOpacity = this.markerOpacity; 
        if (chartArea && channel && channel.hoveredChannel && !isNaN(channel.hoveredChannel.x) && !isNaN(channel.hoveredChannel.y) && !this.isMouseEntered && channel.start) {
            const channelH = this.props.indicatorInteractionChannel.hoveredChannel;
            const markerColor = this.props.darkMode ? Colors.RED4 : Colors.RED2;           
            let xCanvasSpace = Math.floor(this.getPixelValue(channelH.x, border.xMin, border.xMax, true)) + 0.5 * devicePixelRatio;
            let yCanvasSpace = Math.floor(this.getPixelValue(channelH.y, border.yMin, border.yMax, false));
            indicator.push(this.genCircle("scatter-indicator-y-hovered-interaction-circle", markerColor , xCanvasSpace, yCanvasSpace));
        }
        if (chartArea && channel && channel.currentChannel && !isNaN(channel.currentChannel.x) && !isNaN(channel.currentChannel.y)) {
            const channelC = this.props.indicatorInteractionChannel.currentChannel;
            const markerColor = this.props.darkMode ? Colors.RED4 : Colors.RED2;
            let xCanvasSpace = Math.floor(this.getPixelValue(channelC.x, border.xMin, border.xMax, true)) + 0.5 * devicePixelRatio;
            indicator.push(this.genXline("scatter-indicator-x-current-interactive", markerColor, markerOpacity, xCanvasSpace));
            let yCanvasSpace = Math.floor(this.getPixelValue(channelC.y, border.yMin, border.yMax, false)) + 0.5 * devicePixelRatio;
            indicator.push(this.genYline("scatter-indicator-y-current-interactive", markerColor, markerOpacity, yCanvasSpace)); 
        }
        if (this.isMouseEntered && this.props.cursorNearestPoint) {
            const channelH = this.props.cursorNearestPoint;
            const markerColor = this.props.darkMode ? Colors.GRAY4 : Colors.GRAY2;
            if (channelH.x >= this.centeredOriginMode.xMin && channelH.x <= this.centeredOriginMode.xMax && channelH.y >= this.centeredOriginMode.yMin && channelH.y <= this.centeredOriginMode.yMax) {
                const x = Math.floor(this.getPixelValue(this.props.cursorNearestPoint.x, border.xMin, border.xMax, true)) + 0.5 * devicePixelRatio;
                const y = Math.floor(this.getPixelValue(this.props.cursorNearestPoint.y, border.yMin, border.yMax, false)) + 0.5 * devicePixelRatio;
                indicator.push(this.genCircle("scatter-indicator-y-hovered-circle", markerColor , x, y));
            }
        }
        return indicator;
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
            let mousePosX = clamp(mouseEvent.offsetX, chartArea.left - 1, chartArea.right + 1);
            let mousePosY = clamp(mouseEvent.offsetY, chartArea.top - 1, chartArea.bottom + 1);
            // Cursor move updates
            if (this.interactionMode === InteractionMode.NONE && this.props.graphCursorMoved) {
                const cursorXPosGraphSpace = this.getValueForPixelX(mousePosX);
                const cursorYPosGraphSpace = this.getValueForPixelY(mousePosY);
                this.props.graphCursorMoved(cursorXPosGraphSpace, cursorYPosGraphSpace);
            }
        }
    };

    onStageMouseDown = (ev) => {
        const mouseEvent: MouseEvent = ev.evt;
        this.stageClickStartX = mouseEvent.offsetX;
        this.stageClickStartY = mouseEvent.offsetY;
    };

    onStageDoubleClick = () => {
        if (this.props.graphZoomReset) {
            this.props.graphZoomReset();
        }
    };

    onStageClick = (ev) => {
        // Store event details for later callback use
        const mousePoint: Point2D = {x: ev.evt.offsetX, y: ev.evt.offsetY};
        const mouseButton = ev.evt.button;
        // Handle double-clicks
        const currentTime = performance.now();
        const delta = currentTime - this.previousClickTime;
        this.previousClickTime = currentTime;
        if (delta < DOUBLE_CLICK_THRESHOLD) {
            this.onStageDoubleClick();
            clearTimeout(this.pendingClickHandle);
            return;
        } else {
            this.pendingClickHandle = setTimeout(() => {
                // Ignore click-drags for click handling
                const mouseMoveDist = {x: Math.abs(mousePoint.x - this.stageClickStartX), y: Math.abs(mousePoint.y - this.stageClickStartY)};
                if (mouseMoveDist.x > 1 || mouseMoveDist.y > 1) {
                    return;
                }
                // Do left-click callback if it exists
                if (this.props.graphClicked && mouseButton === 0 && this.props.cursorNearestPoint) {
                    this.props.graphClicked(this.props.cursorNearestPoint.x, this.props.cursorNearestPoint.y, this.props.data);
                }
            }, DOUBLE_CLICK_THRESHOLD);
        }
    };

    onStageMouseUp = (ev) => {
        const mouseEvent: MouseEvent = ev.evt;
        // Redirect clicks
        const mouseMoveDist = {x: Math.abs(mouseEvent.offsetX - this.stageClickStartX), y: Math.abs(mouseEvent.offsetY - this.stageClickStartY)};
        if (mouseMoveDist.x < DRAG_THRESHOLD && mouseMoveDist.y < DRAG_THRESHOLD) {
            this.onStageClick(ev);
        } 
        this.endInteractions();
    };

    render() {
        // const isHovering = this.hoveredMarker !== undefined && !this.isSelecting;
        let axisRange = this.resizeData();
        this.centeredOriginMode = axisRange;
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
                    onMouseDown={this.onStageMouseDown}
                    onMouseUp={this.onStageMouseUp}
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
            </div>
        );
    }
}
