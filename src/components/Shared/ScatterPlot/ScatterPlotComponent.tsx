import * as React from "react";
import {observer} from "mobx-react";
import ReactResizeDetector from "react-resize-detector";
import {Layer, Stage} from "react-konva";
import {Colors} from "@blueprintjs/core";
import {ChartArea} from "chart.js";
import {PlotContainerComponent} from "components/Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {ToolbarComponent} from "components/Shared/LinePlot/Toolbar/ToolbarComponent";
import {LinePlotComponent} from "components/Shared/LinePlot/LinePlotComponent";
import "./ScatterPlotComponent.css";

@observer
export class ScatterPlotComponent extends LinePlotComponent {
    private pointDefaultColor = Colors.GRAY2;
    private opacityInit = 1;
    private opacityOutRange = 0.1;

    private getChartAreaWH(chartArea: ChartArea): { width: number, height: number } {
        if (chartArea && chartArea.right && chartArea.bottom) {
            return {width: Math.abs(chartArea.right - chartArea.left), height: Math.abs(chartArea.bottom - chartArea.top)};
        } else {
            return {width: 0, height: 0};
        }
    }

    private getScatterColor(currentIndex: number, range: number, toColor: number, frequencyIncreases: boolean): string {
        let percentage = currentIndex / range;
        if (!frequencyIncreases) {
            percentage = 1 - percentage;
        }
        let hue = (percentage * toColor);
        return `hsla(${hue}, 100%, 50%, ${this.opacityInit})`;
    }

    private frequencyIncreases (data: {x: number, y: number, z?: number}[]): boolean {
        const zFirst = data[0].z;
        const zLast = data[data.length - 1].z;
        if (zFirst > zLast) {
            return false;
        }
        return true;
    }

    private fillColor(): Array<string> {
        let scatterColors = [];
        if (this.props.data && this.props.data.length && this.props.zIndex && this.props.interactionBorder) {
            let xlinePlotRange = this.props.interactionBorder;
            const outOfRangeColor = `hsla(0, 0%, 50%, ${this.opacityOutRange})`;
            const zOrder = this.frequencyIncreases(this.props.data);
            const dataLength = this.props.data.length;
            const colorRangeEnd = this.props.colorRangeEnd;
            this.props.data.forEach((data, i) => {
                let pointColor = this.pointDefaultColor;
                let outRange = true;
                if (data.z >= xlinePlotRange.xMin && data.z <= xlinePlotRange.xMax) {
                    outRange = false;
                }
                pointColor = outRange ? outOfRangeColor : this.getScatterColor(i, dataLength, colorRangeEnd, zOrder);
                scatterColors.push(pointColor);
            });
        }
        return scatterColors;
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
                    dataBackgroundColor={this.props.colorRangeEnd ? this.fillColor() : []}
                    xMin={axisRange.xMin}
                    xMax={axisRange.xMax}
                    yMin={axisRange.yMin}
                    yMax={axisRange.yMax}
                />
                <Stage
                    className={"annotation-stage"}
                    width={this.width}
                    height={this.height}
                    onMouseDown={this.onStageMouseDown}
                    onMouseUp={this.onStageMouseUp}
                    onContextMenu={this.onStageRightClick}
                    onMouseMove={this.onStageMouseMove}
                    onWheel={this.onStageWheel}
                >
                    <Layer>
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
