import * as React from "react";
import { computed, observable } from "mobx";
import { observer } from "mobx-react";
import { HTMLTable, Icon, NonIdealState } from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import { CARTA } from "carta-protobuf";
import { RegionStore, WidgetConfig, WidgetProps, HelpType } from "stores";
import { Point2D} from "models";
import { toFixed } from "utilities";
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

    private static readonly ACTION_COLUMN_DEFAULT_WIDTH = 25;
    private static readonly NAME_COLUMN_MIN_WIDTH = 50;
    private static readonly NAME_COLUMN_DEFAULT_WIDTH = 150;
    private static readonly TYPE_COLUMN_DEFAULT_WIDTH = 90;
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
            isCloseable: true,
            helpType: HelpType.REGION_LIST
        };
    }

    private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    private handleRegionLockClicked = (ev: React.MouseEvent<HTMLTableDataCellElement, MouseEvent>, region: RegionStore) => {
        region.toggleLock();
        ev.stopPropagation();
    };

    private handleFocusClicked = (ev: React.MouseEvent<HTMLTableDataCellElement, MouseEvent>, region: RegionStore) => {
        region.focusCenter();
        ev.stopPropagation();
    };

    private handleRegionListDoubleClick = () => {
        this.props.appStore.dialogStore.showRegionDialog();
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
        let fixedWidth = RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH * 2 + RegionListComponent.TYPE_COLUMN_DEFAULT_WIDTH
            + RegionListComponent.CENTER_COLUMN_DEFAULT_WIDTH + RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH + RegionListComponent.ROTATION_COLUMN_DEFAULT_WIDTH;
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
            let point: Point2D = region.center;
            
            let pixelCenterEntry;
            if (isFinite(point.x) && isFinite(point.y)) {
                pixelCenterEntry = <td style={{width: RegionListComponent.CENTER_COLUMN_DEFAULT_WIDTH}} onDoubleClick={this.handleRegionListDoubleClick} >{`(${toFixed(point.x, 1)}, ${toFixed(point.y, 1)})`}</td>;
            } else {
                pixelCenterEntry = <td style={{width: RegionListComponent.CENTER_COLUMN_DEFAULT_WIDTH}}>Invalid</td>;
            }

            let pixelSizeEntry;
            if (showSizeColumn) {
                if (region.regionType === CARTA.RegionType.RECTANGLE || region.regionType === CARTA.RegionType.POLYGON) {
                    const sizePoint = region.boundingBox;
                    pixelSizeEntry = <td style={{width: RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH}} onDoubleClick={this.handleRegionListDoubleClick} >{`(${toFixed(sizePoint.x, 1)} \u00D7 ${toFixed(sizePoint.y, 1)})`}</td>;
                } else if (region.regionType === CARTA.RegionType.ELLIPSE) {
                    const sizePoint = region.controlPoints[1];
                    pixelSizeEntry = <td style={{width: RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH}} onDoubleClick={this.handleRegionListDoubleClick} >{`maj: ${toFixed(sizePoint.x, 1)}; min: ${toFixed(sizePoint.y, 1)}`}</td>;
                } else {
                    pixelSizeEntry = <td style={{width: RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH}} onDoubleClick={this.handleRegionListDoubleClick} />;
                }
            }

            let lockEntry: React.ReactNode;
            if (region.regionId) {
                lockEntry = <td style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH}} onClick={(ev) => this.handleRegionLockClicked(ev, region)}><Icon icon={region.locked ? "lock" : "unlock"}/></td>;
            } else {
                lockEntry = <td colSpan={2} style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH * 2}}><Icon icon={"blank"}/><Icon icon={"blank"}/></td>;
            }

            let focusEntry: React.ReactNode;
            if (region.regionId) {
                focusEntry = <td style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH}} onClick={(ev) => this.handleFocusClicked(ev, region)}><Icon icon={"eye-open"}/></td>;
            }

            return (
                <tr
                    className={(selectedRegion && selectedRegion.regionId === region.regionId) ? "selected" : ""}
                    key={region.regionId}
                    onClick={() => frame.regionSet.selectRegion(region)}
                >
                    {lockEntry}{focusEntry}
                    <td style={{width: nameWidth}} onDoubleClick={this.handleRegionListDoubleClick} >{region.nameString}</td>
                    <td style={{width: RegionListComponent.TYPE_COLUMN_DEFAULT_WIDTH}} onDoubleClick={this.handleRegionListDoubleClick} >{RegionStore.RegionTypeString(region.regionType)}</td>
                    {pixelCenterEntry}
                    {showSizeColumn && pixelSizeEntry}
                    {showRotationColumn && <td style={{width: RegionListComponent.ROTATION_COLUMN_DEFAULT_WIDTH}} onDoubleClick={this.handleRegionListDoubleClick} >{toFixed(region.rotation, 1)}</td>}
                </tr>
            );
        });

        return (
            <div className="region-list-widget">
                <HTMLTable style={{height: tableHeight}}>
                    <thead className={this.props.appStore.darkTheme ? "dark-theme" : ""}>
                    <tr>
                        <th style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH * 2}}><Icon icon={"blank"}/><Icon icon={"blank"}/></th>
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