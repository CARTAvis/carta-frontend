import * as React from "react";
import {observer} from "mobx-react";
import {Colors} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {Layer, Stage, Group, Line} from "react-konva";
import {ChartArea} from "chart.js";
import {PlotContainerComponent} from "components/Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {ToolbarComponent} from "components/Shared/LinePlot/Toolbar/ToolbarComponent";
import {LinePlotComponent} from "components/Shared/LinePlot/LinePlotComponent";
import "./ScatterPlotComponent.css";

@observer
export class ScatterPlotComponent extends LinePlotComponent {
    private markerOpacity = 0.8;

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
        const channel = this.props.currentChannel;
        if (chartArea && channel) {
            const markerColor = this.props.darkMode ? Colors.GRAY4 : Colors.GRAY2;
            const markerOpacity = this.markerOpacity;
            let border = this.resizeData();
            let xCanvasSpace = Math.floor(this.getPixelValue(channel.x, border.xMin, border.xMax, true)) + 0.5 * devicePixelRatio;
            lines.push(this.genXline("scatter-indicator-x", markerColor, markerOpacity, xCanvasSpace));
            let yCanvasSpace = Math.floor(this.getPixelValue(channel.y, border.yMin, border.yMax, false)) + 0.5 * devicePixelRatio;
            lines.push(this.genYline("scatter-indicator-y", markerColor, markerOpacity, yCanvasSpace));  
        }
        return lines;
    }

    render() {
        const isHovering = this.hoveredMarker !== undefined && !this.isSelecting;
        let axisRange = this.resizeData();
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
                    visible={this.isMouseEntered && (this.props.data !== undefined || this.props.multiPlotData !== undefined)}
                    exportImage={this.exportImage}
                    exportData={this.exportData}
                />
            </div>
        );
    }
}
