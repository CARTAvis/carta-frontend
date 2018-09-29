import * as React from "react";
import {observer} from "mobx-react";
import * as _ from "lodash";
import {ESCAPE} from "@blueprintjs/core/lib/cjs/common/keys";
import {ChartArea} from "chart.js";
import {PlotContainerComponent} from "./PlotContainer/PlotContainerComponent";
import {Arrow, Group, Layer, Line, Rect, Stage, Text} from "react-konva";
import ReactResizeDetector from "react-resize-detector";
import {Point2D} from "../../../models/Point2D";
import "./LinePlotComponent.css";
import {clamp} from "../../../util/math";
import {Colors} from "@blueprintjs/core";
import {Col} from "react-flexbox-grid";

export interface LineMarker {
    value: number;
    id: string;
    color?: string;
    label?: string;
    horizontal: boolean;
    draggable?: boolean;
    dragMove?: (val: number) => void;
}

export class LinePlotComponentProps {
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
    markers?: LineMarker[];
    graphClicked?: (x: number) => void;
    graphRightClicked?: (x: number) => void;
    graphZoomed?: (xMin: number, xMax: number) => void;
    graphZoomReset?: () => void;
    graphCursorMoved?: (x: number) => void;
    scrollZoom?: boolean;
}

interface LinePlotComponentState {
    chartArea: ChartArea;
    hoveredMarker: LineMarker;
    width: number;
    height: number;
    selecting: boolean;
    panning: boolean;
    panStart: number;
    selectionBoxStart: number;
    selectionBoxEnd: number;
}

// Maximum time between double clicks
const DOUBLE_CLICK_THRESHOLD = 300;
// Minimum pixel distance before turning a click into a drag event
const DRAG_THRESHOLD = 3;
// Thickness of the rectangle used for detecting hits
const MARKER_HITBOX_THICKNESS = 16;
// Maximum pixel distance before turing an X or Y zoom into an XY zoom
const XY_ZOOM_THRESHOLD = 20;

@observer
export class LinePlotComponent extends React.Component<LinePlotComponentProps, LinePlotComponentState> {
    private plotRef;
    private stageRef;
    private stageClickStartX: number;
    private stageClickStartY: number;
    private panPrevious: number;
    private previousClickTime: number;
    private pendingClickHandle;

    constructor(props: LinePlotComponentProps) {
        super(props);
        this.state = {chartArea: undefined, hoveredMarker: undefined, width: 0, height: 0, selecting: false, selectionBoxStart: 0, selectionBoxEnd: 0, panning: false, panStart: 0};
    }

    private getValueForPixelX(pixel: number) {
        if (!this.state.chartArea) {
            return undefined;
        }
        const fraction = (pixel - this.state.chartArea.left) / (this.state.chartArea.right - this.state.chartArea.left);
        return fraction * (this.props.xMax - this.props.xMin) + this.props.xMin;
    }

    private getValueForPixelY(pixel: number, logScale: boolean = false) {
        if (!this.state.chartArea) {
            return undefined;
        }
        if (logScale) {
            let value = this.state.chartArea.bottom - pixel;
            value /= this.state.chartArea.bottom - this.state.chartArea.top;
            value *= Math.log10(this.props.yMax / this.props.yMin);
            return Math.pow(10, Math.log10(this.props.yMin) + value);
        }
        else {
            const fraction = (this.state.chartArea.bottom - pixel) / (this.state.chartArea.bottom - this.state.chartArea.top);
            return fraction * (this.props.yMax - this.props.yMin) + this.props.yMin;
        }

    }

    private getPixelForValueX(value: number) {
        if (!this.state.chartArea) {
            return undefined;
        }
        const fraction = (value - this.props.xMin) / (this.props.xMax - this.props.xMin);
        return fraction * (this.state.chartArea.right - this.state.chartArea.left) + this.state.chartArea.left;
    }

    private getPixelForValueY(value: number, logScale: boolean = false) {
        if (!this.state.chartArea) {
            return undefined;
        }
        let fraction;
        if (logScale) {
            fraction = (Math.log(this.props.yMax) - Math.log(value)) / (Math.log(this.props.yMax) - Math.log(this.props.yMin));
        }
        else {
            fraction = (this.props.yMax - value) / (this.props.yMax - this.props.yMin);
        }
        return fraction * (this.state.chartArea.bottom - this.state.chartArea.top) + this.state.chartArea.top;
    }

    onPlotRefUpdated = (plotRef) => {
        this.plotRef = plotRef;
    };

    onChartAreaUpdated = (chartArea: ChartArea) => {
        if (!_.isEqual(chartArea, this.state.chartArea)) {
            this.setState({chartArea});
        }
    };

    onResize = (w, h) => {
        if (w !== this.state.width || h !== this.state.height) {
            this.setState({width: w, height: h});
        }
    };

    dragBoundsFuncVertical = (pos: Point2D) => {
        const chartArea = this.state.chartArea;
        return {x: clamp(pos.x, chartArea.left, chartArea.right), y: chartArea.top};
    };

    dragBoundsFuncHorizontal = (pos: Point2D) => {
        const chartArea = this.state.chartArea;
        return {x: chartArea.left, y: clamp(pos.y, chartArea.top, chartArea.bottom)};
    };

    onMarkerDragged = (ev, marker: LineMarker) => {
        if (this.props.markers) {
            if (marker && marker.dragMove) {
                let newPositionDataSpace;
                if (marker.horizontal) {
                    const newPositionCanvasSpace = ev.evt.offsetY;
                    // Prevent dragging out of canvas space
                    if (newPositionCanvasSpace < this.state.chartArea.top || newPositionCanvasSpace > this.state.chartArea.bottom) {
                        return;
                    }
                    newPositionDataSpace = this.getValueForPixelY(newPositionCanvasSpace, this.props.logY);
                }
                else {
                    const newPositionCanvasSpace = ev.evt.offsetX;
                    // Prevent dragging out of canvas space
                    if (newPositionCanvasSpace < this.state.chartArea.left || newPositionCanvasSpace > this.state.chartArea.right) {
                        return;
                    }
                    newPositionDataSpace = this.getValueForPixelX(newPositionCanvasSpace);
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

    setHoveredMarker(marker: LineMarker) {
        if (this.state.hoveredMarker !== marker) {
            this.setState({hoveredMarker: marker});
        }
    }

    onStageMouseDown = (ev) => {
        const mouseEvent: MouseEvent = ev.evt;
        this.stageClickStartX = mouseEvent.offsetX;
        this.stageClickStartY = mouseEvent.offsetY;
        const modifierPressed = mouseEvent.ctrlKey || mouseEvent.shiftKey || mouseEvent.altKey;
        if (this.state.hoveredMarker === undefined && !modifierPressed) {
            this.setState({selecting: true, selectionBoxStart: mouseEvent.offsetX, selectionBoxEnd: mouseEvent.offsetX});
        }
        else if (modifierPressed) {
            this.setState({panning: true});
            this.panPrevious = mouseEvent.offsetX;
        }
    };

    onStageMouseUp = (ev) => {
        const mouseEvent: MouseEvent = ev.evt;

        // Redirect clicks
        const mouseMoveDist = {x: Math.abs(mouseEvent.offsetX - this.stageClickStartX), y: Math.abs(mouseEvent.offsetY - this.stageClickStartY)};
        if (mouseMoveDist.x < DRAG_THRESHOLD && mouseMoveDist.y < DRAG_THRESHOLD) {
            this.onStageClick(ev);
        }
        else {
            this.stageClickStartX = undefined;
            this.stageClickStartY = undefined;
            if (this.state.selecting && this.props.graphZoomed) {
                const minCanvasSpace = Math.min(this.state.selectionBoxStart, this.state.selectionBoxEnd);
                const maxCanvasSpace = Math.max(this.state.selectionBoxStart, this.state.selectionBoxEnd);
                const minGraphSpace = this.getValueForPixelX(minCanvasSpace);
                const maxGraphSpace = this.getValueForPixelX(maxCanvasSpace);
                this.props.graphZoomed(minGraphSpace, maxGraphSpace);
            }
        }
        this.setState({selecting: false, panning: false});
    };

    onStageMouseMove = (ev) => {
        const mouseEvent: MouseEvent = ev.evt;
        const chartArea = this.state.chartArea;
        if (mouseEvent.offsetX > chartArea.right || mouseEvent.offsetX < chartArea.left) {
            return;
        }

        if (this.state.selecting) {
            this.setState({selectionBoxEnd: mouseEvent.offsetX});
        }
        else if (this.state.panning && this.props.graphZoomed) {
            const currentPan = mouseEvent.offsetX;
            const prevPanGraphSpace = this.getValueForPixelX(this.panPrevious);
            const currentPanGraphSpace = this.getValueForPixelX(currentPan);
            const delta = (currentPanGraphSpace - prevPanGraphSpace);
            this.panPrevious = currentPan;
            // Shift zoom to counteract drag's delta
            this.props.graphZoomed(this.props.xMin - delta, this.props.xMax - delta);
        }
        // Cursor move updates
        if (this.props.graphCursorMoved) {
            const cursorPosGraphSpace = this.getValueForPixelX(mouseEvent.offsetX);
            this.props.graphCursorMoved(cursorPosGraphSpace);
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
            this.onStageDoubleClick(ev);
            clearTimeout(this.pendingClickHandle);
            return;
        }
        else {
            this.pendingClickHandle = setTimeout(() => {
                // Ignore click-drags for click handling
                const mouseMoveDist = {x: Math.abs(mousePoint.x - this.stageClickStartX), y: Math.abs(mousePoint.y - this.stageClickStartY)};
                if (mouseMoveDist.x > 1 || mouseMoveDist.y > 1) {
                    return;
                }
                // Do left-click callback if it exists
                if (this.props.graphClicked && mouseButton === 0) {
                    const xCanvasSpace = mousePoint.x / devicePixelRatio;
                    const xGraphSpace = this.getValueForPixelX(xCanvasSpace);
                    this.props.graphClicked(xGraphSpace);
                }
                // Do right-click callback if it exists
                else if (this.props.graphRightClicked && mouseButton === 2) {
                    const xCanvasSpace = mousePoint.x / devicePixelRatio;
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

    onStageDoubleClick = (ev) => {
        if (this.props.graphZoomReset) {
            this.props.graphZoomReset();
        }
    };

    onStageWheel = (ev) => {
        if (this.props.scrollZoom && this.props.graphZoomed && this.state.chartArea) {
            const wheelEvent: WheelEvent = ev.evt;
            const chartArea = this.state.chartArea;
            const lineHeight = 15;
            const zoomSpeed = 0.001;

            if (wheelEvent.offsetX > chartArea.right || wheelEvent.offsetX < chartArea.left) {
                return;
            }
            const delta = wheelEvent.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? wheelEvent.deltaY : wheelEvent.deltaY * lineHeight;
            const currentRange = this.props.xMax - this.props.xMin;
            const fraction = (wheelEvent.offsetX - chartArea.left) / (chartArea.right - chartArea.left);
            const rangeChange = zoomSpeed * delta * currentRange;
            this.props.graphZoomed(this.props.xMin - rangeChange * fraction, this.props.xMax + rangeChange * (1 - fraction));
        }
    };

    onKeyDown = (ev: React.KeyboardEvent) => {
        if (this.state.selecting && ev.keyCode === ESCAPE) {
            this.setState({selecting: false});
        }
    };

    render() {
        const chartArea = this.state.chartArea;
        const isHovering = this.state.hoveredMarker !== undefined && !this.state.selecting;
        let lines = [];
        if (this.props.markers && this.props.markers.length && chartArea) {
            const lineHeight = chartArea.bottom - chartArea.top;
            const lineWidth = chartArea.right - chartArea.left;
            for (let i = 0; i < this.props.markers.length; i++) {
                const marker = this.props.markers[i];
                // Default marker colors if none is given
                const markerColor = marker.color || (this.props.darkMode ? Colors.RED4 : Colors.RED2);
                // Separate configuration for horizontal markers
                if (marker.horizontal) {
                    let valueCanvasSpace = Math.floor(this.getPixelForValueY(marker.value, this.props.logY)) + 0.5 * devicePixelRatio;
                    if (valueCanvasSpace < Math.floor(chartArea.top - 1) || valueCanvasSpace > Math.ceil(chartArea.bottom + 1) || isNaN(valueCanvasSpace)) {
                        continue;
                    }
                    const isHoverMarker = isHovering && this.state.hoveredMarker.id === marker.id;
                    const midPoint = (chartArea.left + chartArea.right) / 2.0;

                    let lineSegments;
                    let interactionRect;
                    // Add hover markers
                    if (isHoverMarker) {
                        const arrowSize = MARKER_HITBOX_THICKNESS / 1.5;
                        const arrowStart = 3;
                        lineSegments = [
                            <Line listening={false} key={0} points={[chartArea.left, 0, chartArea.right, 0]} strokeWidth={1} stroke={markerColor}/>,
                            <Arrow listening={false} key={1} x={midPoint} y={0} points={[0, -arrowStart, 0, -arrowStart - arrowSize]} pointerLength={arrowSize} pointerWidth={arrowSize} fill={markerColor}/>,
                            <Arrow listening={false} key={2} x={midPoint} y={0} points={[0, arrowStart, 0, arrowStart + arrowSize]} pointerLength={arrowSize} pointerWidth={arrowSize} fill={markerColor}/>
                        ];
                    }
                    else {
                        lineSegments = [<Line listening={false} key={0} points={[chartArea.left, 0, chartArea.right, 0]} strokeWidth={1} stroke={markerColor}/>];
                    }
                    if (marker.label) {
                        lineSegments.push(<Text align={"left"} fill={markerColor} key={lineSegments.length} text={marker.label} x={chartArea.left} y={0}/>);
                    }

                    if (marker.draggable) {
                        interactionRect = (
                            <Rect
                                dragBoundFunc={this.dragBoundsFuncHorizontal}
                                x={chartArea.left}
                                y={-MARKER_HITBOX_THICKNESS / 2.0}
                                width={lineWidth}
                                height={MARKER_HITBOX_THICKNESS}
                                draggable={true}
                                onDragMove={ev => this.onMarkerDragged(ev, marker)}
                                onMouseEnter={() => this.setHoveredMarker(marker)}
                                onMouseLeave={() => this.setHoveredMarker(undefined)}
                            />
                        );
                    }
                    lines.push(
                        <Group key={marker.id} x={0} y={valueCanvasSpace}>
                            {interactionRect}
                            {lineSegments}
                        </Group>
                    );
                }
                else {
                    let valueCanvasSpace = Math.floor(this.getPixelForValueX(marker.value)) + 0.5 * devicePixelRatio;
                    if (valueCanvasSpace < Math.floor(chartArea.left - 1) || valueCanvasSpace > Math.ceil(chartArea.right + 1) || isNaN(valueCanvasSpace)) {
                        continue;
                    }
                    const isHoverMarker = isHovering && this.state.hoveredMarker.id === marker.id;
                    const midPoint = (chartArea.top + chartArea.bottom) / 2.0;
                    let lineSegments;
                    let interactionRect;
                    // Add hover markers
                    if (isHoverMarker) {
                        const arrowSize = MARKER_HITBOX_THICKNESS / 1.5;
                        const arrowStart = 3;
                        lineSegments = [
                            <Line listening={false} key={0} points={[0, chartArea.top, 0, chartArea.bottom]} strokeWidth={1} stroke={markerColor}/>,
                            <Arrow listening={false} key={1} x={0} y={midPoint} points={[-arrowStart, 0, -arrowStart - arrowSize, 0]} pointerLength={arrowSize} pointerWidth={arrowSize} fill={markerColor}/>,
                            <Arrow listening={false} key={2} x={0} y={midPoint} points={[arrowStart, 0, arrowStart + arrowSize, 0]} pointerLength={arrowSize} pointerWidth={arrowSize} fill={markerColor}/>
                        ];
                    }
                    else {
                        lineSegments = [<Line listening={false} key={0} points={[0, chartArea.top, 0, chartArea.bottom]} strokeWidth={1} stroke={markerColor}/>];
                    }
                    if (marker.label) {
                        lineSegments.push(<Text align={"left"} fill={markerColor} key={lineSegments.length} text={marker.label} rotation={-90} x={0} y={chartArea.bottom}/>);
                    }

                    if (marker.draggable) {
                        interactionRect = (
                            <Rect
                                dragBoundFunc={this.dragBoundsFuncVertical}
                                x={-MARKER_HITBOX_THICKNESS / 2.0}
                                y={chartArea.top}
                                width={MARKER_HITBOX_THICKNESS}
                                height={lineHeight}
                                strokeEnabled={false}
                                draggable={true}
                                onDragMove={ev => this.onMarkerDragged(ev, marker)}
                                onMouseEnter={() => this.setHoveredMarker(marker)}
                                onMouseLeave={() => this.setHoveredMarker(undefined)}
                            />
                        );
                    }
                    lines.push(
                        <Group key={marker.id} x={valueCanvasSpace} y={0}>
                            {interactionRect}
                            {lineSegments}
                        </Group>
                    );
                }
            }
        }

        let selectionRect;
        const selectionWidth = this.state.selectionBoxEnd - this.state.selectionBoxStart;
        if (this.state.selecting && Math.abs(selectionWidth) > DRAG_THRESHOLD && chartArea) {
            const h = chartArea.bottom - chartArea.top;
            const x = this.state.selectionBoxStart;
            const y = chartArea.top + h / 2.0;
            selectionRect = [
                <Rect fill={Colors.GRAY3} key={0} opacity={0.2} x={x} y={chartArea.top} width={selectionWidth} height={h}/>,
                <Line stroke={Colors.RED4} key={1} x={x} y={y} points={[0, -XY_ZOOM_THRESHOLD, 0, XY_ZOOM_THRESHOLD]} strokeWidth={3}/>,
                <Line stroke={Colors.RED4} key={2} x={x + selectionWidth} y={y} points={[0, -XY_ZOOM_THRESHOLD, 0, XY_ZOOM_THRESHOLD]} strokeWidth={3}/>
            ];
        }

        let borderRect;
        if (chartArea) {
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

        return (
            <div className={"line-plot-component"} style={{cursor: this.state.panning || isHovering ? "move" : "crosshair"}} onKeyDown={this.onKeyDown} tabIndex={0}>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
                <PlotContainerComponent
                    {...this.props}
                    plotRefUpdated={this.onPlotRefUpdated}
                    chartAreaUpdated={this.onChartAreaUpdated}
                    width={this.state.width}
                    height={this.state.height}
                />
                <Stage
                    className={"annotation-stage"}
                    ref={ref => this.stageRef = ref}
                    width={this.state.width}
                    height={this.state.height}
                    onMouseDown={this.onStageMouseDown}
                    onMouseUp={this.onStageMouseUp}
                    onContextMenu={this.onStageRightClick}
                    onMouseMove={this.onStageMouseMove}
                    onWheel={this.onStageWheel}
                >
                    <Layer>
                        {lines}
                        {selectionRect}
                        {borderRect}
                    </Layer>
                </Stage>
            </div>

        );

    }
}