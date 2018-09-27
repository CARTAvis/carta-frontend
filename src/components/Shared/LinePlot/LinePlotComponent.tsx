import * as React from "react";
import {observer} from "mobx-react";
import * as _ from "lodash";
import {ESCAPE} from "@blueprintjs/core/lib/cjs/common/keys";
import {ChartArea} from "chart.js";
import {PlotContainerComponent} from "./PlotContainer/PlotContainerComponent";
import {Arrow, Group, Layer, Line, Rect, Stage} from "react-konva";
import ReactResizeDetector from "react-resize-detector";
import {Point2D} from "../../../models/Point2D";
import "./LinePlotComponent.css";
import {clamp} from "../../../util/math";

export interface Marker {
    value: number;
    id: string;
    color: string;
    draggable?: boolean;
    dragMove?: (x: number) => void;
}

export class LinePlotComponentProps {
    width?: number;
    height?: number;
    data?: { x: number, y: number }[];
    xMin?: number;
    xMax?: number;
    xLabel?: string;
    yLabel?: string;
    logY?: boolean;
    lineColor?: string;
    markers?: Marker[];
    graphClicked?: (x: number) => void;
    graphRightClicked?: (x: number) => void;
    graphZoomed?: (xMin: number, xMax: number) => void;
    graphZoomReset?: () => void;
    graphCursorMoved?: (x: number) => void;
    scrollZoom?: boolean;
}

interface LinePlotComponentState {
    chartArea: ChartArea;
    hoveredMarker: Marker;
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

    private getValueForPixel(pixel: number) {
        if (!this.state.chartArea) {
            return undefined;
        }
        const fraction = (pixel - this.state.chartArea.left) / (this.state.chartArea.right - this.state.chartArea.left);
        return fraction * (this.props.xMax - this.props.xMin) + this.props.xMin;
    }

    private getPixelForValue(value: number) {
        if (!this.state.chartArea) {
            return undefined;
        }
        const fraction = (value - this.props.xMin) / (this.props.xMax - this.props.xMin);
        return fraction * (this.state.chartArea.right - this.state.chartArea.left) + this.state.chartArea.left;
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

    dragBoundsFunc = (pos: Point2D) => {
        const chartArea = this.state.chartArea;
        return {x: clamp(pos.x, chartArea.left, chartArea.right), y: chartArea.top};
    };

    onMarkerDragged = (ev, marker: Marker) => {
        if (this.props.markers) {
            if (marker && marker.dragMove) {
                const newPositionCanvasSpace = ev.evt.offsetX;
                // Prevent dragging out of canvas space
                if (newPositionCanvasSpace < this.state.chartArea.left || newPositionCanvasSpace > this.state.chartArea.right) {
                    return;
                }
                const newPositionDataSpace = this.getValueForPixel(newPositionCanvasSpace);
                marker.dragMove(newPositionDataSpace);
            }
        }
        // Cursor move updates
        if (this.props.graphCursorMoved) {
            const cursorPosGraphSpace = this.getValueForPixel(ev.evt.offsetX);
            this.props.graphCursorMoved(cursorPosGraphSpace);
        }
    };

    setHoveredMarker(marker: Marker) {
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
                const minGraphSpace = this.getValueForPixel(minCanvasSpace);
                const maxGraphSpace = this.getValueForPixel(maxCanvasSpace);
                this.props.graphZoomed(minGraphSpace, maxGraphSpace);
            }
        }
        this.setState({selecting: false, panning: false});
    };

    onStageMouseMove = (ev) => {
        const mouseEvent: MouseEvent = ev.evt;
        if (this.state.selecting) {
            this.setState({selectionBoxEnd: mouseEvent.offsetX});
        }
        else if (this.state.panning && this.props.graphZoomed) {
            const currentPan = mouseEvent.offsetX;
            const prevPanGraphSpace = this.getValueForPixel(this.panPrevious);
            const currentPanGraphSpace = this.getValueForPixel(currentPan);
            const delta = (currentPanGraphSpace - prevPanGraphSpace);
            this.panPrevious = currentPan;
            // Shift zoom to counteract drag's delta
            this.props.graphZoomed(this.props.xMin - delta, this.props.xMax - delta);
        }
        // Cursor move updates
        if (this.props.graphCursorMoved) {
            const cursorPosGraphSpace = this.getValueForPixel(mouseEvent.offsetX);
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
                    const xGraphSpace = this.getValueForPixel(xCanvasSpace);
                    this.props.graphClicked(xGraphSpace);
                }
                // Do right-click callback if it exists
                else if (this.props.graphRightClicked && mouseButton === 2) {
                    const xCanvasSpace = mousePoint.x / devicePixelRatio;
                    const xGraphSpace = this.getValueForPixel(xCanvasSpace);
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
        if (this.props.scrollZoom && this.props.graphZoomed) {
            const wheelEvent: WheelEvent = ev.evt;
            const lineHeight = 15;
            const zoomSpeed = 0.001;
            const delta = wheelEvent.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? wheelEvent.deltaY : wheelEvent.deltaY * lineHeight;
            const currentRange = this.props.xMax - this.props.xMin;
            const midPoint = (this.props.xMax + this.props.xMin) / 2.0;
            const newRange = currentRange + zoomSpeed * delta * currentRange;
            this.props.graphZoomed(midPoint - newRange / 2.0, midPoint + newRange / 2.0);
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
            const markerHitBoxWidth = 16;
            const lineHeight = chartArea.bottom - chartArea.top;
            for (let i = 0; i < this.props.markers.length; i++) {
                const marker = this.props.markers[i];
                // Calculate canvas space location. Rounded to single pixel and shifted by 0.5 for crisp rendering
                const xVal = Math.floor(this.getPixelForValue(marker.value)) + 0.5;
                // Skip points out of range
                if (xVal < Math.floor(this.state.chartArea.left - 1) || xVal > Math.ceil(this.state.chartArea.right + 1) || isNaN(xVal)) {
                    continue;
                }

                const isHoverMarker = isHovering && this.state.hoveredMarker.id === marker.id;
                let lineSegments;
                // Add hover markers
                if (isHoverMarker) {
                    const arrowSize = markerHitBoxWidth / 1.5;
                    const midPoint = (chartArea.top + chartArea.bottom) / 2.0;
                    const arrowStart = 3;
                    lineSegments = [
                        <Line listening={false} key={0} points={[0, chartArea.top, 0, chartArea.bottom]} strokeWidth={1} stroke={marker.color}/>,
                        <Arrow listening={false} key={1} x={0} y={midPoint} points={[-arrowStart, 0, -arrowStart - arrowSize, 0]} pointerLength={arrowSize} pointerWidth={arrowSize} fill={marker.color}/>,
                        <Arrow listening={false} key={2} x={0} y={midPoint} points={[arrowStart, 0, arrowStart + arrowSize, 0]} pointerLength={arrowSize} pointerWidth={arrowSize} fill={marker.color}/>
                    ];
                }
                else {
                    lineSegments = <Line listening={false} points={[0, chartArea.top, 0, chartArea.bottom]} strokeWidth={1} stroke={marker.color}/>;
                }

                lines.push(
                    <Group key={marker.id} x={xVal} y={0}>
                        <Rect
                            dragBoundFunc={this.dragBoundsFunc}
                            x={-markerHitBoxWidth / 2.0}
                            y={chartArea.top}
                            width={markerHitBoxWidth}
                            height={lineHeight}
                            strokeEnabled={false}
                            draggable={marker.draggable}
                            onDragMove={ev => this.onMarkerDragged(ev, marker)}
                            onMouseEnter={() => this.setHoveredMarker(marker)}
                            onMouseLeave={() => this.setHoveredMarker(undefined)}
                        />
                        {lineSegments}
                    </Group>
                );
            }
        }

        let selectionRect;
        const w = this.state.selectionBoxEnd - this.state.selectionBoxStart;
        if (this.state.selecting && Math.abs(w) > DRAG_THRESHOLD && chartArea) {
            const h = chartArea.bottom - chartArea.top;
            const x = this.state.selectionBoxStart;
            selectionRect = <Rect fill={"grey"} opacity={0.2} x={x} y={chartArea.top} width={w} height={h}/>;
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
                />;
                <Stage
                    ref={ref => this.stageRef = ref}
                    width={this.state.width}
                    height={this.state.height}
                    style={{position: "absolute", top: 0}}
                    onMouseDown={this.onStageMouseDown}
                    onMouseUp={this.onStageMouseUp}
                    onContextMenu={this.onStageRightClick}
                    onMouseMove={this.onStageMouseMove}
                    onWheel={this.onStageWheel}
                >
                    <Layer>
                        {lines}
                        {selectionRect}
                    </Layer>
                </Stage>
            </div>

        );

    }
}