import * as React from "react";
import * as _ from "lodash";
import {Chart, ChartArea} from "chart.js";
import {PlotContainerComponent} from "./PlotContainer/PlotContainerComponent";
import {Group, Layer, Line, Rect, Stage} from "react-konva";
import ReactResizeDetector from "react-resize-detector";

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
    scrollZoom?: boolean;
}

interface LinePlotComponentState {
    chartArea: ChartArea;
    hoveredMarker: Marker;
    width: number;
    height: number;
    selecting: boolean;
    selectionBoxStart: number;
    selectionBoxEnd: number;
}

export class LinePlotComponent extends React.Component<LinePlotComponentProps, LinePlotComponentState> {
    private plotRef;
    private scaleX;
    private scaleY;
    private stageClickStartX: number;
    private stageClickStartY: number;

    constructor(props: LinePlotComponentProps) {
        super(props);
        this.state = {chartArea: undefined, hoveredMarker: undefined, width: 0, height: 0, selecting: false, selectionBoxStart: 0, selectionBoxEnd: 0};
    }

    onPlotRefUpdated = (plotRef) => {
        this.plotRef = plotRef;
    };

    onChartAreaUpdated = (chartArea: ChartArea) => {
        if (!_.isEqual(chartArea, this.state.chartArea)) {
            this.setState({chartArea});
        }
    };

    onChartScalesUpdated = (scaleX, scaleY) => {
        this.scaleX = scaleX;
        this.scaleY = scaleY;
    };

    onResize = (w, h) => {
        if (w !== this.state.width || h !== this.state.height) {
            this.setState({width: w, height: h});
        }
    };

    onMarkerDragged = (ev, marker: Marker) => {
        if (this.scaleX && this.props.markers) {
            if (marker && marker.dragMove) {
                const newPostionCanvasSpace = ev.evt.offsetX;
                // Prevent dragging out of canvas space
                if (newPostionCanvasSpace < this.state.chartArea.left || newPostionCanvasSpace > this.state.chartArea.right) {
                    return;
                }
                const newPositionDataSpace = this.scaleX.getValueForPixel(newPostionCanvasSpace);
                marker.dragMove(newPositionDataSpace);
            }
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
        if (this.state.hoveredMarker === undefined) {
            this.setState({selecting: true, selectionBoxStart: mouseEvent.offsetX, selectionBoxEnd: mouseEvent.offsetX});
        }
    };

    onStageMouseUp = (ev) => {
        const mouseEvent: MouseEvent = ev.evt;

        // Redirect clicks
        const mouseMoveDist = {x: Math.abs(mouseEvent.offsetX - this.stageClickStartX), y: Math.abs(mouseEvent.offsetY - this.stageClickStartY)};
        if (mouseMoveDist.x < 1 && mouseMoveDist.y < 1) {
            this.onStageClick(ev);
        }
        else {
            this.stageClickStartX = undefined;
            this.stageClickStartY = undefined;
            if (this.state.selecting && this.props.graphZoomed && this.scaleX) {
                const minCanvasSpace = Math.min(this.state.selectionBoxStart, this.state.selectionBoxEnd);
                const maxCanvasSpace = Math.max(this.state.selectionBoxStart, this.state.selectionBoxEnd);
                const minGraphSpace = this.scaleX.getValueForPixel(minCanvasSpace);
                const maxGraphSpace = this.scaleX.getValueForPixel(maxCanvasSpace);
                this.props.graphZoomed(minGraphSpace, maxGraphSpace);
            }
        }
        this.setState({selecting: false});
    };

    onStageMouseMove = (ev) => {
        const mouseEvent: MouseEvent = ev.evt;
        if (this.state.selecting) {
            this.setState({selectionBoxEnd: mouseEvent.offsetX});
        }

    };

    onStageClick = (ev) => {
        const mouseEvent: MouseEvent = ev.evt;
        // Ignore click-drags for click handling
        console.log(mouseEvent);
        const mouseMoveDist = {x: Math.abs(mouseEvent.offsetX - this.stageClickStartX), y: Math.abs(mouseEvent.offsetY - this.stageClickStartY)};
        if (mouseMoveDist.x > 1 || mouseMoveDist.y > 1) {
            return;
        }
        // // Do left-click callback if it exists
        // if (this.props.graphClicked && mouseEvent.button === 0 && this.scaleX) {
        //     const xCanvasSpace = mouseEvent.offsetX / devicePixelRatio;
        //     const xGraphSpace = this.scaleX.getValueForPixel(xCanvasSpace);
        //     this.props.graphClicked(xGraphSpace);
        // }
        // // Do right-click callback if it exists
        // else if (this.props.graphRightClicked && mouseEvent.button === 2 && this.scaleX) {
        //     const xCanvasSpace = mouseEvent.offsetX / devicePixelRatio;
        //     const xGraphSpace = this.scaleX.getValueForPixel(xCanvasSpace);
        //     this.props.graphRightClicked(xGraphSpace);
        // }
    };

    onStageRightClick = (ev) => {
        // block default handling if we have a right-click handler
        if (this.props.graphRightClicked) {
            ev.evt.preventDefault();
        }
    };

    onStageDoubleClick = (ev) => {
        console.log(ev);
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

    render() {
        const chartArea = this.state.chartArea;
        const isHovering = this.state.hoveredMarker !== undefined && !this.state.selecting;

        let lines = [];
        if (this.props.markers && this.props.markers.length && chartArea && this.scaleX) {
            const markerHitBoxWidth = 10;
            const lineHeight = chartArea.bottom - chartArea.top;
            const markerHoverBoxHeight = 0.6 * lineHeight;
            const markerHoverBoxOffset = (lineHeight - markerHoverBoxHeight) / 2.0;
            for (let i = 0; i < this.props.markers.length; i++) {
                const marker = this.props.markers[i];
                const xVal = this.scaleX.getPixelForValue(marker.value);
                lines.push(
                    <Group key={i} x={xVal} y={0}>
                        <Rect
                            dragBoundFunc={pos => ({x: pos.x, y: chartArea.top})}
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
                        <Rect
                            hitFunc={() => false}
                            x={-markerHitBoxWidth / 2.0}
                            y={chartArea.top + markerHoverBoxOffset}
                            width={markerHitBoxWidth}
                            height={markerHoverBoxHeight}
                            visible={isHovering && this.state.hoveredMarker.id === marker.id}
                            fill={marker.color}
                            opacity={0.5}
                            strokeWidth={1}
                            stroke={marker.color}
                        />
                        <Line
                            points={[0, chartArea.top, 0, chartArea.bottom]}
                            strokeWidth={1}
                            stroke={marker.color}
                        />
                    </Group>
                );
            }
        }

        let selectionRect;
        const w = this.state.selectionBoxEnd - this.state.selectionBoxStart;
        if (this.state.selecting && Math.abs(w) > 0 && chartArea) {
            const h = chartArea.bottom - chartArea.top;
            const x = this.state.selectionBoxStart;
            selectionRect = <Rect fill={"grey"} opacity={0.2} x={x} y={chartArea.top} width={w} height={h}/>;
        }

        return (
            <div style={{width: "100%", height: "100%", cursor: isHovering ? "move" : "crosshair"}}>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
                <PlotContainerComponent
                    {...this.props}
                    plotRefUpdated={this.onPlotRefUpdated}
                    chartAreaUpdated={this.onChartAreaUpdated}
                    scalesUpdated={this.onChartScalesUpdated}
                    width={this.state.width}
                    height={this.state.height}
                />;
                <Stage
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