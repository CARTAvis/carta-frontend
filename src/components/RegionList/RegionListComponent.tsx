import * as React from "react";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {HTMLTable, Icon, NonIdealState, Position, Tooltip} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {RegionStore, DefaultWidgetConfig, WidgetProps, HelpType, DialogStore, AppStore, FrameStore, WCS_PRECISION} from "stores";
import {toFixed, getFormattedWCSPoint, formattedArcsec} from "utilities";
import {CustomIcon} from "icons/CustomIcons";
import "./RegionListComponent.scss";

@observer
export class RegionListComponent extends React.Component<WidgetProps> {
    private static readonly ACTION_COLUMN_DEFAULT_WIDTH = 25;
    private static readonly NAME_COLUMN_MIN_WIDTH = 50;
    private static readonly NAME_COLUMN_DEFAULT_WIDTH = 150;
    private static readonly TYPE_COLUMN_DEFAULT_WIDTH = 90;
    private static readonly CENTER_COLUMN_DEFAULT_WIDTH = 140;
    private static readonly SIZE_COLUMN_DEFAULT_WIDTH = 160;
    private static readonly ROTATION_COLUMN_DEFAULT_WIDTH = 80;

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
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

    @computed get validRegions(): RegionStore[] {
        const frame = AppStore.Instance.activeFrame;
        if (frame) {
            return frame.regionSet.regions.filter(r => !r.isTemporary);
        }
        return [];
    }

    @observable width: number = 0;
    @observable height: number = 0;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @action private onResize = (width: number, height: number) => {
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
        DialogStore.Instance.showRegionDialog();
    };

    render() {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;

        if (!frame) {
            return (
                <div className="region-list-widget">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />;
                    <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}></ReactResizeDetector>
                </div>
            );
        }

        const padding = 5;
        const rowSize = 41;
        const requiredTableHeight = 1 + padding * 2 + rowSize * (this.validRegions.length + 1);
        const tableHeight = isFinite(this.height) ? Math.min(requiredTableHeight, this.height) : requiredTableHeight;

        let nameWidth = RegionListComponent.NAME_COLUMN_DEFAULT_WIDTH;
        const availableWidth = this.width - 2 * padding;
        let fixedWidth =
            RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH * 2 +
            RegionListComponent.TYPE_COLUMN_DEFAULT_WIDTH +
            RegionListComponent.CENTER_COLUMN_DEFAULT_WIDTH +
            RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH +
            RegionListComponent.ROTATION_COLUMN_DEFAULT_WIDTH;
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
            let centerContent: React.ReactNode;
            if (isFinite(region.center.x) && isFinite(region.center.y)) {
                if (frame.validWcs) {
                    centerContent = <RegionWcsCenter region={region} frame={frame} />;
                } else {
                    centerContent = `(${toFixed(region.center.x, 1)}, ${toFixed(region.center.y, 1)})`;
                }
            } else {
                centerContent = "Invalid";
            }
            const centerEntry = (
                <td style={{width: RegionListComponent.CENTER_COLUMN_DEFAULT_WIDTH}} onDoubleClick={this.handleRegionListDoubleClick}>
                    {centerContent}
                </td>
            );

            let sizeEntry: React.ReactNode;
            if (showSizeColumn) {
                let sizeContent: React.ReactNode;
                if (region.size) {
                    if (frame.validWcs) {
                        sizeContent = (
                            <React.Fragment>
                                {formattedArcsec(region.wcsSize.x, WCS_PRECISION)}
                                <br />
                                {formattedArcsec(region.wcsSize.y, WCS_PRECISION)}
                            </React.Fragment>
                        );
                    } else {
                        sizeContent = `(${toFixed(region.size.x, 1)}, ${toFixed(region.size.y, 1)})`;
                    }
                }
                sizeEntry = (
                    <td style={{width: RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH}} onDoubleClick={this.handleRegionListDoubleClick}>
                        {region.regionType !== CARTA.RegionType.POINT && (
                            <Tooltip
                                content={region.regionType === CARTA.RegionType.ELLIPSE ? "Semi-major and semi-minor axes" : "Width and height"}
                                position={Position.BOTTOM}
                            >
                                {sizeContent}
                            </Tooltip>
                        )}
                    </td>
                );
            }

            let lockEntry: React.ReactNode;
            if (region.regionId) {
                lockEntry = (
                    <td style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH}} onClick={ev => this.handleRegionLockClicked(ev, region)}>
                        <Icon icon={region.locked ? "lock" : "unlock"} />
                    </td>
                );
            } else {
                lockEntry = (
                    <td colSpan={2} style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH * 2}}>
                        <Icon icon={"blank"} />
                        <Icon icon={"blank"} />
                    </td>
                );
            }

            let focusEntry: React.ReactNode;
            if (region.regionId) {
                focusEntry = (
                    <td style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH}} onClick={ev => this.handleFocusClicked(ev, region)}>
                        <CustomIcon icon="center" />
                    </td>
                );
            }

            return (
                <tr
                    className={selectedRegion && selectedRegion.regionId === region.regionId ? "selected" : ""}
                    key={region.regionId}
                    onClick={() => frame.regionSet.selectRegion(region)}
                >
                    {lockEntry}
                    {focusEntry}
                    <td style={{width: nameWidth}} onDoubleClick={this.handleRegionListDoubleClick}>
                        {region.nameString}
                    </td>
                    <td style={{width: RegionListComponent.TYPE_COLUMN_DEFAULT_WIDTH}} onDoubleClick={this.handleRegionListDoubleClick}>
                        {RegionStore.RegionTypeString(region.regionType)}
                    </td>
                    {centerEntry}
                    {showSizeColumn && sizeEntry}
                    {showRotationColumn && (
                        <td style={{width: RegionListComponent.ROTATION_COLUMN_DEFAULT_WIDTH}} onDoubleClick={this.handleRegionListDoubleClick}>
                            {toFixed(region.rotation, 1)}
                        </td>
                    )}
                </tr>
            );
        });

        return (
            <div className="region-list-widget">
                <HTMLTable style={{height: tableHeight}}>
                    <thead className={appStore.darkTheme ? "dark-theme" : ""}>
                        <tr>
                            <th style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH * 2}}>
                                <Icon icon={"blank"} />
                                <Icon icon={"blank"} />
                            </th>
                            <th style={{width: nameWidth}}>Name</th>
                            <th style={{width: RegionListComponent.TYPE_COLUMN_DEFAULT_WIDTH}}>Type</th>
                            <th style={{width: RegionListComponent.CENTER_COLUMN_DEFAULT_WIDTH}}>{frame.validWcs ? "Center" : "Pixel Center"}</th>
                            {showSizeColumn && <th style={{width: RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH}}>{frame.validWcs ? "Size" : "Size (px)"}</th>}
                            {showRotationColumn && <th style={{width: RegionListComponent.ROTATION_COLUMN_DEFAULT_WIDTH}}>P.A. (deg)</th>}
                        </tr>
                    </thead>
                    <tbody className={appStore.darkTheme ? "dark-theme" : ""}>{rows}</tbody>
                </HTMLTable>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}></ReactResizeDetector>
            </div>
        );
    }
}
@observer
export class RegionWcsCenter extends React.Component<{region: RegionStore; frame: FrameStore}> {
    public render() {
        // dummy variables related to wcs to trigger re-render
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const system = AppStore.Instance.overlayStore.global.explicitSystem;
        const formatX = AppStore.Instance.overlayStore.numbers.formatTypeX;
        const formatY = AppStore.Instance.overlayStore.numbers.formatTypeY;
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const frame = this.props.frame;
        const region = this.props.region;
        if (!region || !region.center || !(isFinite(region.center.x) && isFinite(region.center.y) && this.props.frame.validWcs)) {
            return null;
        }

        if (region.regionId === 0 && frame.cursorInfo?.infoWCS) {
            return (
                <React.Fragment>
                    {frame.cursorInfo.infoWCS.x}
                    <br />
                    {frame.cursorInfo.infoWCS.y}
                </React.Fragment>
            );
        }

        const centerWCSPoint = getFormattedWCSPoint(this.props.frame.wcsInfoForTransformation, region.center);
        if (centerWCSPoint) {
            return (
                <React.Fragment>
                    {centerWCSPoint.x}
                    <br />
                    {centerWCSPoint.y}
                </React.Fragment>
            );
        }

        return null;
    }
}
