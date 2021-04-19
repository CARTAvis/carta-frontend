import * as React from "react";
import {observer} from "mobx-react";
import {action, computed, makeObservable, observable} from "mobx";
import {ESCAPE} from "@blueprintjs/core/lib/cjs/common/keys";
import {Colors} from "@blueprintjs/core";
import {Scatter} from "react-chartjs-2";
import ResizeObserver from "react-resize-detector/build/withPolyfill";
import {Layer, Stage, Group, Line, Ring, Rect} from "react-konva";
import {ChartArea} from "chart.js";
import {PlotContainerComponent, TickType, MultiPlotProps} from "components/Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {ToolbarComponent} from "components/Shared/LinePlot/Toolbar/ToolbarComponent";
import {ZoomMode, InteractionMode} from "components/Shared/LinePlot/LinePlotComponent";
import {PlotType} from "../PlotTypeSelector/PlotTypeSelectorComponent";
import {Point2D} from "models";
import {clamp, toExponential, getTimestamp, exportTsvFile} from "utilities";
import {AppStore} from "stores";
import "./ScatterPlotComponent.scss";


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
    tickTypeX?: TickType;
    tickTypeY?: TickType;
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
    colorRangeEnd?: number;
    showXAxisTicks?: boolean;
    showXAxisLabel?: boolean;
    xZeroLineColor?: string;
    yZeroLineColor?: string;
    showLegend?: boolean;
    xTickMarkLength?: number;
    plotType?: PlotType;
    dataBackgroundColor?: Array<string>;
    isGroupSubPlot?: boolean;
    zIndex?: boolean;
    pointRadius?: number;
    indicatorInteractionChannel?: { currentChannel: Point3D, hoveredChannel: Point3D, start: boolean };
    zeroLineWidth?: number;
    cursorNearestPoint?: { x: number, y: number };
    updateChartArea?: (chartArea: ChartArea) => void;
    multiPlotPropsMap?: Map<string, MultiPlotProps>;
}

// Maximum time between double clicks
const DOUBLE_CLICK_THRESHOLD = 300;
// Minimum pixel distance before turning a click into a drag event
const DRAG_THRESHOLD = 3;
// Maximum pixel distance before turing an X or Y zoom into an XY zoom
const XY_ZOOM_THRESHOLD = 20;
// indicator default Radius
const INNERRADIUS = 0.5;
const OUTERRADIUS = 3;

@observer
export class ScatterPlotComponent extends React.Component<ScatterPlotComponentProps> {
    private markerOpacity = 0.8;
    private plotRef;
    private previousClickTime: number;
    private pendingClickHandle;
    private stageClickStartX: number;
    private stageClickStartY: number;
    private panPrevious: {x: number, y: number};

    @observable selectionBoxStart = {x: 0, y: 0};
    @observable selectionBoxEnd = {x: 0, y: 0};

    @observable chartArea: ChartArea;
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

    constructor(props: ScatterPlotComponentProps) {
        super(props);
        makeObservable(this);
    }

    onPlotRefUpdated = (plotRef) => {
        this.plotRef = plotRef;
    };

    @action updateChart = (chartArea: ChartArea) => {
        this.chartArea = chartArea;
        if (this.props.updateChartArea) {
            this.props.updateChartArea(chartArea);
        }
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

    private getValueForPixelX(pixel: number) {
        if (!this.chartArea) {
            return undefined;
        }
        const fraction = (pixel - this.chartArea.left) / (this.chartArea.right - this.chartArea.left);
        return fraction * (this.props.xMax - this.props.xMin) + this.props.xMin;
    }

    private getValueForPixelY(pixel: number) {
        if (!this.chartArea) {
            return undefined;
        }
        const fraction = (this.chartArea.bottom - pixel) / (this.chartArea.bottom - this.chartArea.top);
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
        let innerRadius = INNERRADIUS;
        let outerRadius = OUTERRADIUS;
        if (this.props && this.props.pointRadius) {
            innerRadius = this.props.pointRadius - 1 <= 0 ? INNERRADIUS : this.props.pointRadius - 1;
            outerRadius = this.props.pointRadius + 2.5;  
        }
        return (
            <Group key={id} x={valueCanvasSpaceX} y={valueCanvasSpaceY}>
                <Ring innerRadius={innerRadius} outerRadius={outerRadius} fill={markerColor}/>
            </Group>
        );
    }

    private genIndicator = () => {
        const chartArea = this.chartArea;
        let indicator = [];
        const channel = this.props.indicatorInteractionChannel;
        const markerOpacity = this.markerOpacity; 
        if (chartArea && channel && channel.hoveredChannel && !isNaN(channel.hoveredChannel.x) && !isNaN(channel.hoveredChannel.y) && !this.isMouseEntered && channel.start) {
            const channelH = this.props.indicatorInteractionChannel.hoveredChannel;
            const markerColor = this.props.darkMode ? Colors.GRAY4 : Colors.GRAY2;
            if (channelH.x >= this.props.xMin && channelH.x <= this.props.xMax && channelH.y >= this.props.yMin && channelH.y <= this.props.yMax) {
                let xCanvasSpace = Math.floor(this.getPixelValue(channelH.x, this.props.xMin, this.props.xMax, true));
                let yCanvasSpace = Math.floor(this.getPixelValue(channelH.y, this.props.yMin, this.props.yMax, false));
                indicator.push(this.genCircle("scatter-indicator-y-hovered-interaction-circle", markerColor , xCanvasSpace, yCanvasSpace));
            }
        }
        if (chartArea && channel && channel.currentChannel && !isNaN(channel.currentChannel.x) && !isNaN(channel.currentChannel.y)) {
            const channelC = this.props.indicatorInteractionChannel.currentChannel;
            const markerColor = this.props.darkMode ? Colors.RED4 : Colors.RED2;
            if (channelC.x >= this.props.xMin && channelC.x <= this.props.xMax && channelC.y >= this.props.yMin && channelC.y <= this.props.yMax) {
                let xCanvasSpace = Math.floor(this.getPixelValue(channelC.x, this.props.xMin, this.props.xMax, true));
                let yCanvasSpace = Math.floor(this.getPixelValue(channelC.y, this.props.yMin, this.props.yMax, false));
                indicator.push(this.genXline("scatter-indicator-x-current-interactive", markerColor, markerOpacity, xCanvasSpace));
                indicator.push(this.genYline("scatter-indicator-y-current-interactive", markerColor, markerOpacity, yCanvasSpace)); 
            }
        }
        if (this.isMouseEntered && this.props.cursorNearestPoint) {
            const nearestPoint = this.props.cursorNearestPoint;
            const markerColor = this.props.darkMode ? Colors.GRAY4 : Colors.GRAY2;
            if (nearestPoint.x >= this.props.xMin && nearestPoint.x <= this.props.xMax && nearestPoint.y >= this.props.yMin && nearestPoint.y <= this.props.yMax) {
                const x = Math.floor(this.getPixelValue(nearestPoint.x, this.props.xMin, this.props.xMax, true)) + 0.5 * devicePixelRatio;
                const y = Math.floor(this.getPixelValue(nearestPoint.y, this.props.yMin, this.props.yMax, false)) + 0.5 * devicePixelRatio;
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
        ctx.fillStyle = AppStore.Instance.preferenceStore.transparentImageBackground ? "rgba(255, 255, 255, 0.0)" : (this.props.darkMode ?  Colors.DARK_GRAY3 : Colors.LIGHT_GRAY5);
        ctx.fillRect(0, 0, composedCanvas.width, composedCanvas.height);
        ctx.drawImage(canvas, 0, 0);

        composedCanvas.toBlob((blob) => {
            const link = document.createElement("a") as HTMLAnchorElement;
            link.download = `${imageName}-${plotName.replace(" ", "-")}-${getTimestamp()}.png`;
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
            rows = this.props.data.map(o => `${toExponential(o.x, 10)}\t${toExponential(o.y, 10)}`);
        } else {
            if (this.props.data && this.props.data.length) {
                if (this.props.tickTypeX === TickType.Scientific) {
                    rows = this.props.data.map(o => `${toExponential(o.x, 10)}\t${toExponential(o.y, 10)}`);
                } else {
                    rows = this.props.data.map(o => `${o.x}\t${toExponential(o.y, 10)}`);
                }
            }
        }

        exportTsvFile(imageName, plotName, `${comment}\n${header}\n${rows.join("\n")}\n`);
    };

    onStageMouseMove = (ev) => {
        if (this.props.data || this.props.multiPlotPropsMap?.size > 0) {
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
            if (this.isPanning && this.props.graphZoomedXY) {
                const currentPanX = mousePosX;
                const currentPanY = mousePosY;
                const prevPanGraphSpaceX = this.getValueForPixelX(this.panPrevious.x);
                const currentPanGraphSpaceX = this.getValueForPixelX(currentPanX);
                const deltaX = (currentPanGraphSpaceX - prevPanGraphSpaceX);
                const prevPanGraphSpaceY = this.getValueForPixelY(this.panPrevious.y);
                const currentPanGraphSpaceY = this.getValueForPixelY(currentPanY);
                const deltaY = (currentPanGraphSpaceY - prevPanGraphSpaceY);
                this.updatePan(currentPanX, currentPanY);
                const pinMinX = this.props.xMin - deltaX;
                const pinMaxX = this.props.xMax - deltaX;
                const pinMinY = this.props.yMin - deltaY;
                const pinMaxY = this.props.yMax - deltaY;
                this.props.graphZoomedXY(pinMinX, pinMaxX, pinMinY, pinMaxY);
            }
            if (this.isSelecting) {
                this.updateSelection(mousePosX, mousePosY);
            }
        }
    };

    @action startSelection(x: number, y: number) {
        this.interactionMode = InteractionMode.SELECTING;
        this.selectionBoxStart = {x, y};
        this.selectionBoxEnd = {x, y};
    }

    @action startPanning(x: number, y: number) {
        this.interactionMode = InteractionMode.PANNING;
        this.panPrevious = { x, y };

    }

    @action updateSelection(x: number, y: number) {
        this.selectionBoxEnd = {x, y};
    }

    @action updatePan(x: number, y: number) {
        this.panPrevious = { x, y };
    }

    onStageMouseDown = (ev) => {
        const mouseEvent: MouseEvent = ev.evt;
        this.stageClickStartX = mouseEvent.offsetX;
        this.stageClickStartY = mouseEvent.offsetY;
        const modifierPressed = mouseEvent.ctrlKey || mouseEvent.shiftKey || mouseEvent.altKey;
        if (!modifierPressed) {
            this.startSelection(mouseEvent.offsetX, mouseEvent.offsetY);
        } else if (modifierPressed) {
            this.startPanning(mouseEvent.offsetX, mouseEvent.offsetY);
        }
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
        } else {
            if (this.props.data) {
                this.stageClickStartX = undefined;
                this.stageClickStartY = undefined;
                if (this.isSelecting && this.zoomMode !== ZoomMode.NONE) {
                    let minCanvasSpace = Math.min(this.selectionBoxStart.x, this.selectionBoxEnd.x);
                    let maxCanvasSpace = Math.max(this.selectionBoxStart.x, this.selectionBoxEnd.x);
                    let minX = this.getValueForPixelX(minCanvasSpace);
                    let maxX = this.getValueForPixelX(maxCanvasSpace);

                    minCanvasSpace = Math.min(this.selectionBoxStart.y, this.selectionBoxEnd.y);
                    maxCanvasSpace = Math.max(this.selectionBoxStart.y, this.selectionBoxEnd.y);
                    // Canvas space y-axis is inverted, so min/max are switched when transforming to graph space
                    let minY = this.getValueForPixelY(maxCanvasSpace);
                    let maxY = this.getValueForPixelY(minCanvasSpace);

                    if (this.zoomMode === ZoomMode.X) {
                        this.props.graphZoomedX(minX, maxX);
                    }
                    if (this.zoomMode === ZoomMode.Y) {
                        this.props.graphZoomedY(minY, maxY);
                    } else if (this.zoomMode === ZoomMode.XY) {
                        this.props.graphZoomedXY(minX, maxX, minY, maxY);
                    }
                }
            }
        }
        this.endInteractions();
    };

    onStageWheel = (ev) => {
        if (this.props.data && this.props.scrollZoom && this.props.graphZoomedXY && this.chartArea) {
            const wheelEvent: WheelEvent = ev.evt;
            const chartArea = this.chartArea;
            const lineHeight = 15;
            const zoomSpeed = 0.001;
            if (wheelEvent.offsetX > chartArea.right || wheelEvent.offsetX < chartArea.left || wheelEvent.offsetY > chartArea.bottom || wheelEvent.offsetY < chartArea.top) {
                return;
            }
            const delta = wheelEvent.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? wheelEvent.deltaY : wheelEvent.deltaY * lineHeight;
            let currentRangeX = this.props.xMax - this.props.xMin;
            const fractionX = (wheelEvent.offsetX - chartArea.left) / (chartArea.right - chartArea.left);
            const rangeChangeX = zoomSpeed * delta * currentRangeX;

            let currentRangeY = this.props.yMax - this.props.yMin;
            const fractionY = (wheelEvent.offsetY - chartArea.top) / (chartArea.bottom - chartArea.top);
            const rangeChangeY = zoomSpeed * delta * currentRangeY;

            const zoomMinX = this.props.xMin - rangeChangeX * fractionX;
            const zoomMaxX = this.props.xMax + rangeChangeX * (1 - fractionX);
            const zoomMinY = this.props.yMin - rangeChangeY * (1 - fractionY);
            const zoomMaxY = this.props.yMax + rangeChangeY * fractionY;
            if (zoomMinX < zoomMaxX && zoomMinY < zoomMaxY) {
                this.props.graphZoomedXY(zoomMinX, zoomMaxX, zoomMinY, zoomMaxY);   
            }
        }
    };

    @computed get zoomMode(): ZoomMode {
        const absDelta = {x: Math.abs(this.selectionBoxEnd.x - this.selectionBoxStart.x), y: Math.abs(this.selectionBoxEnd.y - this.selectionBoxStart.y)};
        if (absDelta.x > XY_ZOOM_THRESHOLD && absDelta.y > XY_ZOOM_THRESHOLD && this.props.graphZoomedXY) {
            return ZoomMode.XY;
        } else if (this.props.graphZoomedX && this.props.graphZoomedY) {
            return absDelta.x > absDelta.y ? ZoomMode.X : ZoomMode.Y;
        } else if (this.props.graphZoomedX) {
            return ZoomMode.X;
        } else if (this.props.graphZoomedY) {
            return ZoomMode.Y;
        } else {
            return ZoomMode.NONE;
        }
    }

    private genSelectionRect = () => {
        let selectionRect = null;
        const chartArea = this.chartArea;
        const start = this.selectionBoxStart;
        const end = this.selectionBoxEnd;
        const delta = {x: end.x - start.x, y: end.y - start.y};
        const absDelta = {x: Math.abs(delta.x), y: Math.abs(delta.y)};

        if (this.isSelecting && (absDelta.x > DRAG_THRESHOLD || absDelta.y > DRAG_THRESHOLD) && chartArea) {
            const w = chartArea.right - chartArea.left;
            const h = chartArea.bottom - chartArea.top;
            if (this.zoomMode === ZoomMode.X) {
                // Determine appropriate bounds for the zoom markers, so that they don't extend past the chart area
                const heightAbove = clamp(XY_ZOOM_THRESHOLD, 0, start.y - chartArea.top);
                const heightBelow = clamp(XY_ZOOM_THRESHOLD, 0, chartArea.bottom - start.y);
                // Selection rectangle consists of a filled rectangle with vertical drag handles on either side
                selectionRect = [
                    <Rect fill={Colors.GRAY3} key={0} opacity={0.2} x={start.x} y={chartArea.top} width={delta.x} height={h}/>,
                    <Line stroke={Colors.GRAY3} key={1} x={start.x} y={start.y} points={[0, -heightAbove, 0, heightBelow]} strokeWidth={3}/>,
                    <Line stroke={Colors.GRAY3} key={2} x={end.x} y={start.y} points={[0, -heightAbove, 0, heightBelow]} strokeWidth={3}/>
                ];
            } else if (this.zoomMode === ZoomMode.Y) {
                // Determine appropriate bounds for the zoom markers, so that they don't extend past the chart area
                const widthLeft = clamp(XY_ZOOM_THRESHOLD, 0, start.x - chartArea.left);
                const widthRight = clamp(XY_ZOOM_THRESHOLD, 0, chartArea.right - start.x);
                // Selection rectangle consists of a filled rectangle with horizontal drag handles on either side
                selectionRect = [
                    <Rect fill={Colors.GRAY3} key={0} opacity={0.2} x={chartArea.left} y={start.y} width={w} height={delta.y}/>,
                    <Line stroke={Colors.GRAY3} key={1} x={start.x} y={start.y} points={[-widthLeft, 0, widthRight, 0]} strokeWidth={3}/>,
                    <Line stroke={Colors.GRAY3} key={2} x={start.x} y={end.y} points={[-widthLeft, 0, widthRight, 0]} strokeWidth={3}/>
                ];
            } else if (this.zoomMode === ZoomMode.XY) {
                // Selection rectangle consists of a filled rectangle with drag corners
                selectionRect = [
                    <Rect fill={Colors.GRAY3} key={0} opacity={0.2} x={start.x} y={start.y} width={delta.x} height={delta.y}/>,
                    <Line stroke={Colors.GRAY3} key={1} x={start.x} y={start.y} points={[0, XY_ZOOM_THRESHOLD / 2.0, 0, 0, XY_ZOOM_THRESHOLD / 2.0, 0]} strokeWidth={3} scaleX={Math.sign(delta.x)} scaleY={Math.sign(delta.y)}/>,
                    <Line stroke={Colors.GRAY3} key={2} x={end.x} y={start.y} points={[0, XY_ZOOM_THRESHOLD / 2.0, 0, 0, -XY_ZOOM_THRESHOLD / 2.0, 0]} strokeWidth={3} scaleX={Math.sign(delta.x)} scaleY={Math.sign(delta.y)}/>,
                    <Line stroke={Colors.GRAY3} key={3} x={start.x} y={end.y} points={[0, -XY_ZOOM_THRESHOLD / 2.0, 0, 0, XY_ZOOM_THRESHOLD / 2.0, 0]} strokeWidth={3} scaleX={Math.sign(delta.x)} scaleY={Math.sign(delta.y)}/>,
                    <Line stroke={Colors.GRAY3} key={4} x={end.x} y={end.y} points={[-XY_ZOOM_THRESHOLD / 2.0, 0, 0, 0, 0, -XY_ZOOM_THRESHOLD / 2.0]} strokeWidth={3} scaleX={Math.sign(delta.x)} scaleY={Math.sign(delta.y)}/>
                ];
            }
        }
        return selectionRect;
    };

    render() {
        return (
            <div
                className={"scatter-plot-component"}
                style={{cursor: this.isPanning ? "move" : "crosshair"}}
                onKeyDown={this.onKeyDown}
                onMouseEnter={this.onMouseEnter}
                onMouseMove={this.onMouseMove}
                onMouseLeave={this.onMouseLeave}
                tabIndex={0}
            >
                <ResizeObserver handleWidth handleHeight onResize={this.resize} refreshMode={"throttle"} refreshRate={33}>
                </ResizeObserver>
                {this.width > 0 && this.height > 0 &&
                <PlotContainerComponent
                    {...this.props}
                    plotRefUpdated={this.onPlotRefUpdated}
                    chartAreaUpdated={this.updateChart}
                    width={this.width}
                    height={this.height}
                />
                }
                {this.width > 0 && this.height > 0 &&
                <Stage
                    className={"annotation-stage"}
                    width={this.width}
                    height={this.height}
                    onMouseMove={this.onStageMouseMove}
                    onMouseDown={this.onStageMouseDown}
                    onMouseUp={this.onStageMouseUp}
                    onWheel={this.onStageWheel}
                >
                    <Layer>
                        {this.genIndicator()}
                        {this.genBorderRect()}
                        {this.genSelectionRect()}
                    </Layer>
                </Stage>
                }
                {(this.props.data !== undefined || this.props.multiPlotPropsMap?.size > 0) &&
                <ToolbarComponent
                    darkMode={this.props.darkMode}
                    visible={this.isMouseEntered}
                    exportImage={this.exportImage}
                    exportData={this.exportData}
                />
                }
            </div>
        );
    }
}
