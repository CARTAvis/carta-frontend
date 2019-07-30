import * as React from "react";
import {computed, observable} from "mobx";
import {observer} from "mobx-react";
import {HTMLTable, NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {RegionStore, WidgetConfig, WidgetProps} from "stores";
import {Point2D} from "models";
import {midpoint2D, minMax2D} from "utilities";
import "./RegionListComponent.css";

@observer
export class RegionListComponent extends React.Component<WidgetProps> {
    @computed get validRegions(): RegionStore[] {
        if (this.props.appStore.activeFrame) {
            return this.props.appStore.activeFrame.regionSet.regions.filter(r => !r.isTemporary);
        }
        return [];
    }

    @observable width: number = 0;
    @observable height: number = 0;

    private static readonly NAME_COLUMN_MIN_WIDTH = 50;
    private static readonly NAME_COLUMN_DEFAULT_WIDTH = 160;
    private static readonly TYPE_COLUMN_DEFAULT_WIDTH = 80;
    private static readonly CENTER_COLUMN_DEFAULT_WIDTH = 120;
    private static readonly SIZE_COLUMN_DEFAULT_WIDTH = 160;
    private static readonly ROTATION_COLUMN_DEFAULT_WIDTH = 80;

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "region-list",
            type: "region-list",
            minWidth: 350,
            minHeight: 180,
            defaultWidth: 650,
            defaultHeight: 180,
            title: "Region List",
            isCloseable: true
        };
    }

    private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    render() {
        const frame = this.props.appStore.activeFrame;

        if (!frame) {
            return (
                <div className="region-list-widget">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>;
                    <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
                </div>
            );
        }

        const padding = 5;
        const rowSize = 41;
        const requiredTableHeight = 1 + padding * 2 + rowSize * (this.validRegions.length + 1);
        const tableHeight = isFinite(this.height) ? Math.min(requiredTableHeight, this.height) : requiredTableHeight;

        let nameWidth = RegionListComponent.NAME_COLUMN_DEFAULT_WIDTH;
        const availableWidth = this.width - 2 * padding;
        let fixedWidth = RegionListComponent.TYPE_COLUMN_DEFAULT_WIDTH + RegionListComponent.CENTER_COLUMN_DEFAULT_WIDTH + RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH + RegionListComponent.ROTATION_COLUMN_DEFAULT_WIDTH;
        nameWidth = availableWidth - fixedWidth;

        let showSizeColumn = true;
        let showRotationColumn = true;

        // Dynamically hide size column if name size is too short
        if (nameWidth < RegionListComponent.NAME_COLUMN_MIN_WIDTH) {
            showSizeColumn = false;
            fixedWidth -= RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH;
            if (availableWidth > fixedWidth) {
                nameWidth = availableWidth - fixedWidth;
            }

            // If its still too short, hide the rotation column as well
            if (nameWidth < RegionListComponent.NAME_COLUMN_MIN_WIDTH) {
                showRotationColumn = false;
                fixedWidth -= RegionListComponent.ROTATION_COLUMN_DEFAULT_WIDTH;
                if (availableWidth > fixedWidth) {
                    nameWidth = availableWidth - fixedWidth;
                } else {
                    nameWidth = RegionListComponent.NAME_COLUMN_MIN_WIDTH;
                }
            }
        }

        const selectedRegion = frame.regionSet.selectedRegion;

        const rows = this.validRegions.map(region => {
            let point: Point2D;
            if (region.regionType === CARTA.RegionType.POLYGON) {
                const bounds = minMax2D(region.controlPoints);
                point = midpoint2D(bounds.minPoint, bounds.maxPoint);
            } else {
                point = region.controlPoints[0];
            }
            let pixelCenterEntry;
            if (isFinite(point.x) && isFinite(point.y)) {
                pixelCenterEntry = <td style={{width: RegionListComponent.CENTER_COLUMN_DEFAULT_WIDTH}}>{`(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`}</td>;
            } else {
                pixelCenterEntry = <td style={{width: RegionListComponent.CENTER_COLUMN_DEFAULT_WIDTH}}>Invalid</td>;
            }

            let pixelSizeEntry;
            if (showSizeColumn) {
                if (region.regionType === CARTA.RegionType.RECTANGLE || region.regionType === CARTA.RegionType.POLYGON) {
                    const sizePoint = region.boundingBox;
                    pixelSizeEntry = <td style={{width: RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH}}>{`(${sizePoint.x.toFixed(1)} \u00D7 ${sizePoint.y.toFixed(1)})`}</td>;
                } else if (region.regionType === CARTA.RegionType.ELLIPSE) {
                    const sizePoint = region.controlPoints[1];
                    pixelSizeEntry = <td style={{width: RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH}}>{`maj: ${sizePoint.x.toFixed(1)}; min: ${sizePoint.y.toFixed(1)}`}</td>;
                } else {
                    pixelSizeEntry = <td style={{width: RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH}}/>;
                }
            }

            return (
                <tr
                    className={(selectedRegion && selectedRegion.regionId === region.regionId) ? "selected" : ""}
                    key={region.regionId}
                    onClick={() => frame.regionSet.selectRegion(region)}
                    onDoubleClick={this.props.appStore.showRegionDialog}
                >
                    <td style={{width: nameWidth}}>{region.nameString}</td>
                    <td style={{width: RegionListComponent.TYPE_COLUMN_DEFAULT_WIDTH}}>{RegionStore.RegionTypeString(region.regionType)}</td>
                    {pixelCenterEntry}
                    {showSizeColumn && pixelSizeEntry}
                    {showRotationColumn && <td style={{width: RegionListComponent.ROTATION_COLUMN_DEFAULT_WIDTH}}>{region.rotation.toFixed(1)}</td>}
                </tr>
            );
        });

        return (
            <div className="region-list-widget">
                <HTMLTable style={{height: tableHeight}}>
                    <thead className={this.props.appStore.darkTheme ? "dark-theme" : ""}>
                    <tr>
                        <th style={{width: nameWidth}}>Name</th>
                        <th style={{width: RegionListComponent.TYPE_COLUMN_DEFAULT_WIDTH}}>Type</th>
                        <th style={{width: RegionListComponent.CENTER_COLUMN_DEFAULT_WIDTH}}>Pixel Center</th>
                        {showSizeColumn && <th style={{width: RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH}}>Size (px)</th>}
                        {showRotationColumn && <th style={{width: RegionListComponent.ROTATION_COLUMN_DEFAULT_WIDTH}}>P.A. (deg)</th>}
                    </tr>
                    </thead>
                    <tbody className={this.props.appStore.darkTheme ? "dark-theme" : ""}>
                    {rows}
                    </tbody>
                </HTMLTable>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}