import * as React from "react";
import {observer} from "mobx-react";
import {action, computed, observable} from "mobx";
import {ESCAPE} from "@blueprintjs/core/lib/cjs/common/keys";
import {Colors} from "@blueprintjs/core";
import {ChartArea} from "chart.js";
import {Scatter} from "react-chartjs-2";
import ReactResizeDetector from "react-resize-detector";
import {Arrow, Group, Layer, Line, Rect, Stage, Text} from "react-konva";
import {PlotContainerComponent, TickType} from "./PlotContainer/PlotContainerComponent";
import {ToolbarComponent} from "./Toolbar/ToolbarComponent";
import {StokesCoordinate} from "stores/widgets/StokesAnalysisWidgetStore";
import {Point2D} from "models";
import {clamp, toExponential} from "utilities";
import "./LinePlotComponent.css";

export enum ZoomMode {
    NONE,
    X,
    Y,
    XY
}

export enum InteractionMode {
    NONE,
    SELECTING,
    PANNING
}

export interface LineMarker {
    value: number;
    id: string;
    color?: string;
    opacity?: number;
    dash?: number[];
    label?: string;
    horizontal: boolean;
    width?: number;
    draggable?: boolean;
    dragCustomBoundary?: { xMin?: number, xMax?: number, yMin?: number, yMax?: number };
    dragMove?: (val: number) => void;
    isMouseMove?: boolean;
    interactionMarker?: boolean;
}

export class LinePlotComponentProps {
    width?: number;
    height?: number;
    data?: { x: number, y: number, z?: number }[];
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
    markers?: LineMarker[];
    showTopAxis?: boolean;
    topAxisTickFormatter?: (value: number, index: number, values: number[]) => string | number;
    graphClicked?: (x: number) => void;
    graphRightClicked?: (x: number) => void;
    graphZoomedX?: (xMin: number, xMax: number) => void;
    graphZoomedY?: (yMin: number, yMax: number) => void;
    graphZoomedXY?: (xMin: number, xMax: number, yMin: number, yMax: number) => void;
    graphZoomReset?: () => void;
    graphCursorMoved?: (x: number) => void;
    scrollZoom?: boolean;
    multiPlotData?: Map<string, { x: number, y: number }[]>;
    showXAxisTicks?: boolean;
    showXAxisLabel?: boolean;
    xZeroLineColor?: string;
    yZeroLineColor?: string;
    showLegend?: boolean;
    xTickMarkLength?: number;
    multiPlotBorderColor?: Map<string, string>;
    plotType?: string;
    isGroupSubPlot?: boolean;
    zIndex?: boolean;
    pointRadius?: number;
    zeroLineWidth?: number;
    mouseEntered?: (value: boolean) => void;
    multiColorSingleLineColors?: Array<string>;
    multiColorMultiLinesColors?: Map<string, Array<string>>;
    borderWidth?: number;
}

// Maximum time between double clicks
const DOUBLE_CLICK_THRESHOLD = 300;
// Minimum pixel distance before turning a click into a drag event
const DRAG_THRESHOLD = 3;
// Thickness of the rectangle used for detecting hits
const MARKER_HITBOX_THICKNESS = 16;
// Maximum pixel distance before turing an X or Y zoom into an XY zoom
const XY_ZOOM_THRESHOLD = 20;

export const VERTICAL_RANGE_PADDING = 0.05;

@observer
export class LinePlotComponent extends React.Component<LinePlotComponentProps> {
    private plotRef;
    private stageRef;
    private stageClickStartX: number;
    private stageClickStartY: number;
    private panPrevious: number;
    private previousClickTime: number;
    private pendingClickHandle;

    @observable chartArea: ChartArea;
    @observable hoveredMarker: LineMarker;
    @observable width = 0;
    @observable height = 0;
    @observable interactionMode = InteractionMode.NONE;
    @observable panStart = 0;
    @observable selectionBoxStart = {x: 0, y: 0};
    @observable selectionBoxEnd = {x: 0, y: 0};
    @observable isMouseEntered = false;
    @observable isMarkerDragging = false;

    @computed get isSelecting() {
        return this.interactionMode === InteractionMode.SELECTING;
    }

    @computed get isPanning() {
        return this.interactionMode === InteractionMode.PANNING;
    }

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

    private getValueForPixelX(pixel: number) {
        if (!this.chartArea) {
            return undefined;
        }
        const fraction = (pixel - this.chartArea.left) / (this.chartArea.right - this.chartArea.left);
        return fraction * (this.props.xMax - this.props.xMin) + this.props.xMin;
    }

    private getValueForPixelY(pixel: number, logScale: boolean = false) {
        if (!this.chartArea) {
            return undefined;
        }
        if (logScale) {
            let value = this.chartArea.bottom - pixel;
            value /= this.chartArea.bottom - this.chartArea.top;
            value *= Math.log10(this.props.yMax / this.props.yMin);
            return Math.pow(10, Math.log10(this.props.yMin) + value);
        } else {
            const fraction = (this.chartArea.bottom - pixel) / (this.chartArea.bottom - this.chartArea.top);
            return fraction * (this.props.yMax - this.props.yMin) + this.props.yMin;
        }

    }

    private getPixelForValueX(value: number) {
        if (!this.chartArea) {
            return undefined;
        }
        const fraction = (value - this.props.xMin) / (this.props.xMax - this.props.xMin);
        return fraction * (this.chartArea.right - this.chartArea.left) + this.chartArea.left;
    }

    private getPixelForValueY(value: number, logScale: boolean = false) {
        if (!this.chartArea) {
            return undefined;
        }
        let fraction;
        if (logScale) {
            fraction = (Math.log(this.props.yMax) - Math.log(value)) / (Math.log(this.props.yMax) - Math.log(this.props.yMin));
        } else {
            fraction = (this.props.yMax - value) / (this.props.yMax - this.props.yMin);
        }
        return fraction * (this.chartArea.bottom - this.chartArea.top) + this.chartArea.top;
    }

    private getCanvasSpaceX(x: number) {
        return Math.floor(this.getPixelForValueX(x)) + 0.5 * devicePixelRatio;
    }

    private getCanvasSpaceY(y: number) {
        return Math.floor(this.getPixelForValueY(y, this.props.logY)) + 0.5 * devicePixelRatio;
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
        if (this.props.mouseEntered) {
            this.props.mouseEntered(true);
        }
    };

    @action hideMouseEnterWidget = () => {
        this.isMouseEntered = false;
        if (this.props.mouseEntered) {
            this.props.mouseEntered(false);
        }
    };

    dragBoundsFuncVertical = (pos: Point2D, marker: LineMarker) => {
        let xMin = this.chartArea.left;
        let xMax = this.chartArea.right;
        if (marker.dragCustomBoundary && marker.dragCustomBoundary.xMin) {
            xMin = this.getCanvasSpaceX(marker.dragCustomBoundary.xMin);
        }
        if (marker.dragCustomBoundary && marker.dragCustomBoundary.xMax) {
            xMax = this.getCanvasSpaceX(marker.dragCustomBoundary.xMax);
        }
        return {x: clamp(pos.x, xMin, xMax), y: 0};
    };

    dragBoundsFuncHorizontal = (pos: Point2D, marker: LineMarker) => {
        let yMin = this.chartArea.top;
        let yMax = this.chartArea.bottom;
        if (marker.dragCustomBoundary && marker.dragCustomBoundary.yMin) {
            yMin = this.getCanvasSpaceY(marker.dragCustomBoundary.yMin);
        }
        if (marker.dragCustomBoundary && marker.dragCustomBoundary.yMax) {
            yMax = this.getCanvasSpaceY(marker.dragCustomBoundary.yMax);
        }
        return {x: 0, y: clamp(pos.y, yMin, yMax)};
    };

    @action onMarkerDragStart = () => {
        this.isMarkerDragging = true;
    };

    @action onMarkerDragEnd = () => {
        this.isMarkerDragging = false;
    };

    onMarkerDragged = (ev, marker: LineMarker) => {
        if (this.props.markers) {
            if (marker && marker.dragMove) {
                let newPositionDataSpace;
                if (marker.horizontal) {
                    // Prevent dragging out of canvas space
                    newPositionDataSpace = this.getValueForPixelY(clamp(ev.evt.offsetY, this.chartArea.top, this.chartArea.bottom), this.props.logY);
                } else {
                    // Prevent dragging out of canvas space
                    newPositionDataSpace = this.getValueForPixelX(clamp(ev.evt.offsetX, this.chartArea.left, this.chartArea.right));
                }
                marker.dragMove(newPositionDataSpace);
            }
        }
        // Cursor move updates
        if (this.props.graphCursorMoved) {
            const cursorPosGraphSpace = this.getValueForPixelX(ev.evt.offsetX);
            this.props.graphCursorMoved(cursorPosGraphSpace);
        }
    };

    @action setHoveredMarker(marker: LineMarker) {
        this.hoveredMarker = marker;
    }

    @action startSelection(x: number, y: number) {
        this.interactionMode = InteractionMode.SELECTING;
        this.selectionBoxStart = {x, y};
        this.selectionBoxEnd = {x, y};
    }

    @action startPanning(x: number) {
        this.interactionMode = InteractionMode.PANNING;
        this.panPrevious = x;
    }

    onStageMouseDown = (ev) => {
        const mouseEvent: MouseEvent = ev.evt;
        this.stageClickStartX = mouseEvent.offsetX;
        this.stageClickStartY = mouseEvent.offsetY;
        const modifierPressed = mouseEvent.ctrlKey || mouseEvent.shiftKey || mouseEvent.altKey;
        if (this.hoveredMarker === undefined && !modifierPressed) {
            this.startSelection(mouseEvent.offsetX, mouseEvent.offsetY);
        } else if (modifierPressed) {
            this.startPanning(mouseEvent.offsetX);
        }
    };

    @action endInteractions() {
        this.interactionMode = InteractionMode.NONE;
    }

    onStageMouseUp = (ev) => {
        const mouseEvent: MouseEvent = ev.evt;
        // Redirect clicks
        const mouseMoveDist = {x: Math.abs(mouseEvent.offsetX - this.stageClickStartX), y: Math.abs(mouseEvent.offsetY - this.stageClickStartY)};
        if (mouseMoveDist.x < DRAG_THRESHOLD && mouseMoveDist.y < DRAG_THRESHOLD) {
            this.onStageClick(ev);
        } else {
            if (this.props.data || (this.props.multiPlotData && this.props.multiPlotData.size > 0)) {
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
                    let minY = this.getValueForPixelY(maxCanvasSpace, this.props.logY);
                    let maxY = this.getValueForPixelY(minCanvasSpace, this.props.logY);

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

    @action updateSelection(x: number, y: number) {
        this.selectionBoxEnd = {x, y};
    }

    @action updatePan(x: number) {
        this.panPrevious = x;
    }

    onStageMouseMove = (ev) => {
        if (this.props.data || (this.props.multiPlotData && this.props.multiPlotData.size > 0)) {
            const mouseEvent: MouseEvent = ev.evt;
            const chartArea = this.chartArea;
            let mousePosX = clamp(mouseEvent.offsetX, chartArea.left - 1, chartArea.right + 1);
            let mousePosY = clamp(mouseEvent.offsetY, chartArea.top - 1, chartArea.bottom + 1);
            if (this.isSelecting) {
                this.updateSelection(mousePosX, mousePosY);
            } else if (this.isPanning && this.props.graphZoomedX) {
                const currentPan = mousePosX;
                const prevPanGraphSpace = this.getValueForPixelX(this.panPrevious);
                const currentPanGraphSpace = this.getValueForPixelX(currentPan);
                const delta = (currentPanGraphSpace - prevPanGraphSpace);
                this.updatePan(currentPan);
                // Shift zoom to counteract drag's delta
                this.props.graphZoomedX(this.props.xMin - delta, this.props.xMax - delta);
            }
            // Cursor move updates
            if (this.interactionMode === InteractionMode.NONE && this.props.graphCursorMoved) {
                const cursorPosGraphSpace = this.getValueForPixelX(mousePosX);
                this.props.graphCursorMoved(cursorPosGraphSpace);
            }
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
                if (this.props.graphClicked && mouseButton === 0) {
                    const xCanvasSpace = mousePoint.x;
                    const xGraphSpace = this.getValueForPixelX(xCanvasSpace);
                    this.props.graphClicked(xGraphSpace);
                }
                // Do right-click callback if it exists
                else if (this.props.graphRightClicked && mouseButton === 2) {
                    const xCanvasSpace = mousePoint.x;
                    const xGraphSpace = this.getValueForPixelX(xCanvasSpace);
                    this.props.graphRightClicked(xGraphSpace);
                }
            }, DOUBLE_CLICK_THRESHOLD);
        }
    };

    onStageRightClick = (ev) => {
        // block default handling if we have a right-click handler
        if (this.props.graphRightClicked) {
            ev.evt.preventDefault();
        }
    };

    onStageDoubleClick = () => {
        if (this.props.graphZoomReset) {
            this.props.graphZoomReset();
        }
    };

    onStageWheel = (ev) => {
        if ((this.props.data || (this.props.multiPlotData && this.props.multiPlotData.size > 0) ) && this.props.scrollZoom && this.props.graphZoomedX && this.chartArea) {
            const wheelEvent: WheelEvent = ev.evt;
            const chartArea = this.chartArea;
            const lineHeight = 15;
            const zoomSpeed = 0.001;
            if (wheelEvent.offsetX > chartArea.right || wheelEvent.offsetX < chartArea.left) {
                return;
            }
            const delta = wheelEvent.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? wheelEvent.deltaY : wheelEvent.deltaY * lineHeight;
            const currentRange = this.props.xMax - this.props.xMin;
            const fraction = (wheelEvent.offsetX - chartArea.left) / (chartArea.right - chartArea.left);
            const rangeChange = zoomSpeed * delta * currentRange;
            this.props.graphZoomedX(this.props.xMin - rangeChange * fraction, this.props.xMax + rangeChange * (1 - fraction));
        }
    };

    onKeyDown = (ev: React.KeyboardEvent) => {
        if (this.isSelecting && ev.keyCode === ESCAPE) {
            this.endInteractions();
        }
    };

    onMouseEnter = () => {
        this.showMouseEnterWidget();
    };

    onMouseMove = () => {
        this.showMouseEnterWidget();
    };

    onMouseLeave = () => {
        this.hideMouseEnterWidget();
    };

    private getTimestamp() {
        const now = new Date();
        return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
    }

    private exportSubPlotImage(visible: boolean) {
        const scatterChart = this.plotRef.chartInstance;
        scatterChart.config.options.scales.xAxes[0].ticks.display = visible;
        scatterChart.config.options.scales.xAxes[0].ticks.major.display = visible;
        scatterChart.config.options.scales.xAxes[0].ticks.minor.display = visible;
        let tickMarkLength = 10;
        if (!visible) {
            tickMarkLength = 0;
        }
        scatterChart.options.scales.xAxes[0].gridLines.tickMarkLength = tickMarkLength;
        scatterChart.options.scales.xAxes[0].scaleLabel.display = visible;
        scatterChart.update();
    }

    private showPlotxAxes() {
        const scatterProps = this.plotRef.chartInstance;
        if (this.props.isGroupSubPlot === true) {
            if (scatterProps && scatterProps.options.scales.xAxes[0].ticks.display === false) {
                return true;
            }
        }
        return false;
    }

    exportImage = () => {
        const scatter = this.plotRef as Scatter;
        const showPlotxAxes = this.showPlotxAxes();
        if (showPlotxAxes) {
            this.exportSubPlotImage(true);
        }
        const canvas = scatter.chartInstance.canvas;
        const plotName = this.props.plotName || "unknown";
        const imageName = this.props.imageName || "unknown";

        const composedCanvas = document.createElement("canvas") as HTMLCanvasElement;
        composedCanvas.width = canvas.width;
        composedCanvas.height = canvas.height;

        const ctx = composedCanvas.getContext("2d");
        ctx.fillStyle = "rgba(255, 255, 255, 0.0)";
        ctx.fillRect(0, 0, composedCanvas.width, composedCanvas.height);
        ctx.drawImage(canvas, 0, 0);

        composedCanvas.toBlob((blob) => {
            const link = document.createElement("a") as HTMLAnchorElement;
            link.download = `${imageName}-${plotName.replace(" ", "-")}-${this.getTimestamp()}.png`;
            link.href = URL.createObjectURL(blob);
            link.dispatchEvent(new MouseEvent("click"));
        }, "image/png");

        if (showPlotxAxes) {
            this.exportSubPlotImage(false);
        }

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

        // add comments from properties
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
            } else if (this.props.multiPlotData && this.props.multiPlotData.size) {
                this.props.multiPlotData.forEach((value, key) => {
                    if (key === StokesCoordinate.LinearPolarizationQ || key === StokesCoordinate.LinearPolarizationU) {
                        rows.push(`# ${key}\t`);
                        value.forEach(o => {
                            rows.push(`${o.x}\t${toExponential(o.y, 10)}`);
                        });
                    } else {
                        rows = value.map(o => `${o.x}\t${toExponential(o.y, 10)}`);
                    }
                });
            }
        }

        const tsvData = `data:text/tab-separated-values;charset=utf-8,${comment}\n${header}\n${rows.join("\n")}\n`;

        const dataURL = encodeURI(tsvData).replace(/\#/g, "%23");

        const a = document.createElement("a") as HTMLAnchorElement;
        a.href = dataURL;
        a.download = `${imageName}-${plotName.replace(" ", "-")}-${this.getTimestamp()}.tsv`;
        a.dispatchEvent(new MouseEvent("click"));
    };

    private genHorizontalLines = (marker: LineMarker, isHovering: boolean, markerColor: string, markerOpacity: number, valueCanvasSpace: number) => {
        const chartArea = this.chartArea;
        const lineWidth = chartArea.right - chartArea.left;
        const isHoverMarker = isHovering && this.hoveredMarker.id === marker.id;
        const midPoint = (chartArea.left + chartArea.right) / 2.0;

        let lineSegments = null;
        if (isHoverMarker) {
            const arrowSize = MARKER_HITBOX_THICKNESS / 1.5;
            const arrowStart = 3;
            lineSegments = [
                <Line listening={false} key={0} points={[chartArea.left, 0, chartArea.right, 0]} strokeWidth={1} stroke={markerColor} opacity={markerOpacity} dash={marker.dash}/>,
                <Arrow listening={false} key={1} x={midPoint} y={0} points={[0, -arrowStart, 0, -arrowStart - arrowSize]} pointerLength={arrowSize} pointerWidth={arrowSize} opacity={markerOpacity} fill={markerColor}/>,
                <Arrow listening={false} key={2} x={midPoint} y={0} points={[0, arrowStart, 0, arrowStart + arrowSize]} pointerLength={arrowSize} pointerWidth={arrowSize} opacity={markerOpacity} fill={markerColor}/>
            ];
        } else {
            if (marker.width) {
                const thickness = this.getPixelForValueY(marker.value - marker.width / 2.0, this.props.logY) - this.getPixelForValueY(marker.value + marker.width / 2.0, this.props.logY);
                let lowerBound = clamp(valueCanvasSpace - thickness, chartArea.top, chartArea.bottom);
                let upperBound = clamp(valueCanvasSpace + thickness, chartArea.top, chartArea.bottom);
                let croppedThickness = upperBound - lowerBound;
                lineSegments = [(
                    <Rect listening={false} key={0} x={chartArea.left} y={lowerBound - valueCanvasSpace} width={lineWidth} height={croppedThickness} fill={markerColor} opacity={markerOpacity}/>
                )];
            } else {
                lineSegments = [<Line listening={false} key={0} points={[chartArea.left, 0, chartArea.right, 0]} strokeWidth={1} stroke={markerColor} opacity={markerOpacity} dash={marker.dash}/>];
            }
        }
        if (marker.label) {
            lineSegments.push(<Text align={"left"} fill={markerColor} key={lineSegments.length} text={marker.label} x={chartArea.left} y={0}/>);
        }

        if (marker.draggable) {
            return (
                <Group
                    key={marker.id + "-draggable"}
                    x={0}
                    y={valueCanvasSpace}
                    draggable={true}
                    dragBoundFunc={pos => this.dragBoundsFuncHorizontal(pos, marker)}
                    onDragMove={ev => this.onMarkerDragged(ev, marker)}
                >
                    <Rect
                        x={chartArea.left}
                        y={-MARKER_HITBOX_THICKNESS / 2.0}
                        width={lineWidth}
                        height={MARKER_HITBOX_THICKNESS}
                        onMouseEnter={() => this.setHoveredMarker(marker)}
                        onMouseLeave={() => this.setHoveredMarker(undefined)}
                    />
                    {lineSegments}
                </Group>
            );
        } else {
            return (
                <Group key={marker.id} x={0} y={valueCanvasSpace}>
                    {lineSegments}
                </Group>
            );
        }
    };

    private genVerticalLines = (marker: LineMarker, isHovering: boolean, markerColor: string, markerOpacity: number, valueCanvasSpace: number) => {
        const chartArea = this.chartArea;
        const lineHeight = chartArea.bottom - chartArea.top;
        const isHoverMarker = isHovering && this.hoveredMarker.id === marker.id;
        const midPoint = (chartArea.top + chartArea.bottom) / 2.0;

        let lineSegments = null;
        if (isHoverMarker) {
            const arrowSize = MARKER_HITBOX_THICKNESS / 1.5;
            const arrowStart = 3;
            lineSegments = [
                <Line listening={false} key={0} points={[0, chartArea.top, 0, chartArea.bottom]} strokeWidth={1} stroke={markerColor} opacity={markerOpacity}/>,
                <Arrow listening={false} key={1} x={0} y={midPoint} points={[-arrowStart, 0, -arrowStart - arrowSize, 0]} pointerLength={arrowSize} pointerWidth={arrowSize} opacity={markerOpacity} fill={markerColor}/>,
                <Arrow listening={false} key={2} x={0} y={midPoint} points={[arrowStart, 0, arrowStart + arrowSize, 0]} pointerLength={arrowSize} pointerWidth={arrowSize} opacity={markerOpacity} fill={markerColor}/>
            ];
        } else {
            if (marker.width) {
                const thickness = this.getPixelForValueX(marker.value + marker.width / 2.0) - this.getPixelForValueX(marker.value - marker.width / 2.0);
                let lowerBound = clamp(valueCanvasSpace - thickness, chartArea.left, chartArea.right);
                let upperBound = clamp(valueCanvasSpace + thickness, chartArea.left, chartArea.right);
                let croppedThickness = upperBound - lowerBound;
                lineSegments = [(
                    <Rect listening={false} key={0} x={lowerBound - valueCanvasSpace} y={chartArea.top} width={croppedThickness} height={lineHeight} fill={markerColor} opacity={markerOpacity}/>
                )];
            } else {
                lineSegments = [<Line listening={false} key={0} points={[0, chartArea.top, 0, chartArea.bottom]} strokeWidth={1} stroke={markerColor} opacity={markerOpacity} dash={marker.dash}/>];
            }
        }
        if (marker.label) {
            lineSegments.push(<Text align={"left"} fill={markerColor} key={lineSegments.length} text={marker.label} rotation={-90} x={0} y={chartArea.bottom}/>);
        }

        if (marker.draggable) {
            return (
                <Group
                    key={marker.id + "-draggable"}
                    x={valueCanvasSpace}
                    y={0}
                    draggable={true}
                    dragBoundFunc={pos => this.dragBoundsFuncVertical(pos, marker)}
                    onDragStart={this.onMarkerDragStart}
                    onDragEnd={this.onMarkerDragEnd}
                    onDragMove={ev => this.onMarkerDragged(ev, marker)}
                >
                    <Rect
                        x={-MARKER_HITBOX_THICKNESS / 2.0}
                        y={chartArea.top}
                        width={MARKER_HITBOX_THICKNESS}
                        height={lineHeight}
                        onMouseEnter={() => this.setHoveredMarker(marker)}
                        onMouseLeave={() => this.setHoveredMarker(undefined)}
                    />
                    {lineSegments}
                </Group>
            );
        } else {
            return (
                <Group key={marker.id} x={valueCanvasSpace} y={0}>
                    {lineSegments}
                </Group>
            );
        }
    };

    private genLines = () => {
        const chartArea = this.chartArea;
        const isHovering = this.hoveredMarker !== undefined && !this.isSelecting;

        let lines = [];
        if (this.props.markers && this.props.markers.length && chartArea) {
            for (let i = 0; i < this.props.markers.length; i++) {
                const marker = this.props.markers[i];
                const markerColor = marker.color || (this.props.darkMode ? Colors.RED4 : Colors.RED2);
                const markerOpacity = (marker.isMouseMove && (!this.isMouseEntered || this.isMarkerDragging)) ? 0 : (marker.opacity || 1);
                if (marker.horizontal) {
                    let valueCanvasSpace = this.getCanvasSpaceY(marker.value);
                    if (valueCanvasSpace < Math.floor(chartArea.top - 1) || valueCanvasSpace > Math.ceil(chartArea.bottom + 1) || isNaN(valueCanvasSpace)) {
                        continue;
                    }
                    lines.push(this.genHorizontalLines(marker, isHovering, markerColor, markerOpacity, valueCanvasSpace));
                } else {
                    let valueCanvasSpace = this.getCanvasSpaceX(marker.value);
                    if (valueCanvasSpace < Math.floor(chartArea.left - 1) || valueCanvasSpace > Math.ceil(chartArea.right + 1) || isNaN(valueCanvasSpace)) {
                        continue;
                    }
                    if (marker.interactionMarker) {
                        const markerOpacityInteraction = (!marker.isMouseMove && (this.isMouseEntered)) ? 0 : (marker.opacity || 1);
                        lines.push(this.genVerticalLines(marker, isHovering, markerColor, markerOpacityInteraction, valueCanvasSpace));
                    } else {
                        lines.push(this.genVerticalLines(marker, isHovering, markerColor, markerOpacity, valueCanvasSpace));
                    }
                }
            }
        }
        return lines;
    };

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

    render() {
        const isHovering = this.hoveredMarker !== undefined && !this.isSelecting;
        return (
            <div
                className={"line-plot-component"}
                style={{cursor: this.isPanning || isHovering ? "move" : "crosshair"}}
                onKeyDown={this.onKeyDown}
                onMouseEnter={this.onMouseEnter}
                onMouseMove={this.onMouseMove}
                onMouseLeave={this.onMouseLeave}
                tabIndex={0}
            >
                <ReactResizeDetector handleWidth handleHeight onResize={this.resize} refreshMode={"throttle"} refreshRate={33}/>
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
                    ref={ref => this.stageRef = ref}
                    width={this.width}
                    height={this.height}
                    onMouseDown={this.onStageMouseDown}
                    onMouseUp={this.onStageMouseUp}
                    onContextMenu={this.onStageRightClick}
                    onMouseMove={this.onStageMouseMove}
                    onWheel={this.onStageWheel}
                >
                    <Layer>
                        {this.genLines()}
                        {this.genSelectionRect()}
                        {this.genBorderRect()}
                    </Layer>
                </Stage>
                }
                <ToolbarComponent
                    darkMode={this.props.darkMode}
                    visible={this.isMouseEntered && (this.props.data !== undefined || (this.props.multiPlotData && this.props.multiPlotData.size > 0))}
                    exportImage={this.exportImage}
                    exportData={this.exportData}
                />
            </div>
        );
    }
}
