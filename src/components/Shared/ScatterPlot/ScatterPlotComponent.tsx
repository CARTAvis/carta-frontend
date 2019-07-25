import * as React from "react";
import {observer} from "mobx-react";
import ReactResizeDetector from "react-resize-detector";
import {Layer, Stage} from "react-konva";
import {PlotContainerComponent} from "components/Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {ToolbarComponent} from "components/Shared/LinePlot/Toolbar/ToolbarComponent";
import {LinePlotComponent} from "components/Shared/LinePlot/LinePlotComponent";
import "./ScatterPlotComponent.css";

@observer
export class ScatterPlotComponent extends LinePlotComponent {

    private getScatterColor(value: number, min: number, max: number, toColor: number): string {
        let percentage = (value + Math.abs(min)) / (Math.abs(min) + Math.abs(max));
        let hue = (percentage * toColor).toString(10);
        return ["hsl(", hue, ",100%,50%)"].join("");
    }

    private fillColor(): Array<string> {
        let scatterColors = [];
        if (this.props.data) {
            this.props.data.forEach(data => {
                let pointColor = this.getScatterColor(data.y, this.props.yMin, this.props.yMax, this.props.colorRangeEnd);
                scatterColors.push(pointColor);
            });
        }
        return scatterColors;
    }

    render() {
        const isHovering = this.hoveredMarker !== undefined && !this.isSelecting;
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
