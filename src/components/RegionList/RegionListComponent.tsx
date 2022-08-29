import * as React from "react";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, ButtonGroup, Icon, NonIdealState, Position, Spinner} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {FixedSizeList, ListOnItemsRenderedProps} from "react-window";
import ReactResizeDetector from "react-resize-detector";
import {CSSProperties} from "react";
import classNames from "classnames";
import {CARTA} from "carta-protobuf";
import {DefaultWidgetConfig, WidgetProps, HelpType, DialogStore, AppStore, FileBrowserStore, BrowserMode} from "stores";
import {FrameStore, RegionStore, WCS_PRECISION} from "stores/Frame";
import {toFixed, getFormattedWCSPoint, formattedArcsec, length2D, clamp} from "utilities";
import {CustomIcon} from "icons/CustomIcons";
import "./RegionListComponent.scss";

@observer
export class RegionListComponent extends React.Component<WidgetProps> {
    private static readonly ACTION_COLUMN_DEFAULT_WIDTH = 25;
    private static readonly ACTIONS_COLUMN_DEFAULT_WIDTH = 75;
    private static readonly NAME_COLUMN_MIN_WIDTH = 50;
    private static readonly NAME_COLUMN_DEFAULT_WIDTH = 150;
    private static readonly TYPE_COLUMN_DEFAULT_WIDTH = 90;
    private static readonly CENTER_COLUMN_DEFAULT_WIDTH = 140;
    private static readonly SIZE_COLUMN_DEFAULT_WIDTH = 160;
    private static readonly ROTATION_COLUMN_DEFAULT_WIDTH = 80;
    private static readonly ROW_HEIGHT = 35;
    private static readonly HEADER_ROW_HEIGHT = 25;

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
    @observable firstVisibleRow: number = 0;
    @observable lastVisibleRow: number = 0;
    @observable regionsVisibility: number = 2;
    @observable regionsLock: boolean = false;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @action private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    @action private toggleRegionVisibility = () => {
        this.regionsVisibility = (this.regionsVisibility + 2) % 3;
    };

    @action private toggleRegionsLock = (locked?: boolean) => {
        this.regionsLock = locked !== undefined ? locked : !this.regionsLock;
    };

    private syncRegionsLocked = () => {
        AppStore.Instance.activeFrame.regionSet.setLocked(this.regionsLock);
    };

    private handleRegionLockClicked = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>, region: RegionStore) => {
        region.toggleLock();
        ev.stopPropagation();
    };

    private handleAllRegionsLockClicked = (ev: React.MouseEvent<HTMLElement, MouseEvent>, regions: RegionStore[]) => {
        this.toggleRegionsLock();
        this.syncRegionsLocked();
        ev.stopPropagation();
    };

    private handleToggleHideClicked = () => {
        return (ev: React.MouseEvent<HTMLElement, MouseEvent>) => {
            if (this.regionsLock !== AppStore.Instance.activeFrame.regionSet.locked) this.syncRegionsLocked();
            this.toggleRegionVisibility();
            let opacityArr = [0, 0.5, 1];
            AppStore.Instance.activeFrame.regionSet.setOpacity(opacityArr[this.regionsVisibility]);
            if (this.regionsVisibility === 0) AppStore.Instance.activeFrame.regionSet.setLocked(true);
            ev.stopPropagation();
        };
    };

    private handleFocusClicked = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>, region: RegionStore) => {
        region.focusCenter();
        ev.stopPropagation();
    };

    private handleRegionExportClicked = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>, region: RegionStore) => {
        FileBrowserStore.Instance.showExportRegions(region.regionId);
    };

    private handleRegionImportClicked = () => {
        FileBrowserStore.Instance.showFileBrowser(BrowserMode.RegionImport, false);
    };

    private handleRegionExportAllClicked = () => {
        FileBrowserStore.Instance.showExportRegions();
    };

    private handleRegionListDoubleClick = () => {
        DialogStore.Instance.showRegionDialog();
    };

    @action private onListRendered = (view: ListOnItemsRenderedProps) => {
        // Update view bounds
        if (view && this.firstVisibleRow !== view.overscanStopIndex && this.lastVisibleRow !== view.overscanStopIndex) {
            this.firstVisibleRow = view.overscanStartIndex;
            this.lastVisibleRow = view.overscanStopIndex;
        }
    };

    render() {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const darkTheme = appStore.darkTheme;
        const regionSet = appStore.activeFrame?.regionSet;

        if (!frame) {
            return (
                <div className="region-list-widget">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                    <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} />
                </div>
            );
        }

        if (appStore.fileBrowserStore.isLoadingDialogOpen) {
            return (
                <div className="region-list-widget">
                    <NonIdealState icon={<Spinner />} title={"Loading regions"} description={"Region list with be shown when regions have been loaded"} />
                    <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} />
                </div>
            );
        }

        const padding = 5;
        const requiredTableHeight = RegionListComponent.ROW_HEIGHT * (this.validRegions.length + 1);
        const tableHeight = isFinite(this.height) ? Math.min(requiredTableHeight, this.height) : requiredTableHeight;

        let nameWidth = RegionListComponent.NAME_COLUMN_DEFAULT_WIDTH;
        const availableWidth = this.width - 2 * padding;
        let fixedWidth =
            RegionListComponent.ACTIONS_COLUMN_DEFAULT_WIDTH +
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

            // If it's still too short, hide the rotation column as well
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

        // Dummy values to trigger re-rendering of visible rows when region properties change from an external source
        const firstVisibleRegion = clamp(this.firstVisibleRow, 0, frame.regionSet.regions.length - 1);
        const lastVisibleRegion = clamp(this.lastVisibleRow, firstVisibleRegion, frame.regionSet.regions.length - 1);
        for (let i = firstVisibleRegion; i <= lastVisibleRegion; i++) {
            const region = frame.regionSet.regions[i];
            /* eslint-disable @typescript-eslint/no-unused-vars */
            const _isLocked = region.locked;
            const _name = region.name;
            const _angle = region.rotation;
            const _size = region.size.x + region.size.y;
            /* eslint-enable @typescript-eslint/no-unused-vars */
        }

        const selectedRegion = frame.regionSet.selectedRegion;

        const floatRenderer = () => {
            return (
                <ButtonGroup className="float" style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH * 3}}>
                    <Tooltip2 content="Import regions" position={Position.BOTTOM}>
                        <AnchorButton icon={"cloud-download"} onClick={this.handleRegionImportClicked} style={{cursor: "pointer"}} />
                    </Tooltip2>
                    <Tooltip2 content="Export all regions" position={Position.BOTTOM}>
                        {this.validRegions.length > 1 ? <AnchorButton icon="cloud-upload" onClick={this.handleRegionExportAllClicked} style={{cursor: "pointer"}} /> : <AnchorButton icon="cloud-upload" style={{opacity: 0.4}} />}
                    </Tooltip2>
                </ButtonGroup>
            );
        };

        const headerRenderer = (regionVisibility: number, regionsLock: boolean) => {
            return (props: {index: number; style: CSSProperties}) => {
                const className = classNames("row-header", {"bp3-dark": darkTheme});

                return (
                    <div className={className} style={props.style}>
                        <div className="cell" style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH * 3}}>
                            <Icon icon={"blank"} style={{width: 16}} />
                            <Tooltip2 disabled={this.regionsVisibility === 0} content="Lock All Regions" position={Position.BOTTOM}>
                                <Icon
                                    icon={this.regionsLock ? "lock" : this.regionsVisibility === 0 ? "lock" : "unlock"}
                                    onClick={this.regionsVisibility === 0 ? () => {} : ev => this.handleAllRegionsLockClicked(ev, this.validRegions)}
                                    style={{cursor: "pointer", opacity: this.regionsVisibility === 0 ? 0.3 : 1}}
                                />
                            </Tooltip2>
                            <Icon icon={"blank"} style={{width: 5}} />
                            <Tooltip2 content={this.regionsVisibility === 0 ? "Show Regions" : "Hide Regions"} position={Position.BOTTOM}>
                                <Icon icon={this.regionsVisibility === 0 ? "eye-off" : "eye-open"} onClick={this.handleToggleHideClicked()} style={{cursor: "pointer", opacity: this.regionsVisibility === 1 ? 0.3 : 1}} />
                            </Tooltip2>
                        </div>
                        <div className="cell" style={{width: nameWidth}}>
                            Name
                        </div>
                        <div className="cell" style={{width: RegionListComponent.TYPE_COLUMN_DEFAULT_WIDTH}}>
                            Type
                        </div>
                        <div className="cell" style={{width: RegionListComponent.CENTER_COLUMN_DEFAULT_WIDTH}}>
                            {frame.validWcs ? "Center" : "Pixel Center"}
                        </div>
                        {showSizeColumn && (
                            <div className="cell" style={{width: RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH}}>
                                {frame.validWcs ? "Size" : "Size (px)"}
                            </div>
                        )}
                        {showRotationColumn && (
                            <div className="cell" style={{width: RegionListComponent.ROTATION_COLUMN_DEFAULT_WIDTH}}>
                                P.A. (deg)
                            </div>
                        )}
                    </div>
                );
            };
        };

        const rowRenderer = (props: {index: number; style: CSSProperties}) => {
            const region = this.validRegions?.[props.index];
            if (!region) {
                return null;
            }
            const className = classNames("row", {"bp3-dark": darkTheme, selected: selectedRegion?.regionId === region.regionId});

            let centerContent: React.ReactNode;
            if (isFinite(region.center.x) && isFinite(region.center.y)) {
                if (frame.validWcs) {
                    if (frame.spatialReference?.regionSet.regions.find(r => r.modifiedTimestamp === region.modifiedTimestamp)) {
                        centerContent = <RegionWcsCenter region={region} frame={frame.spatialReference} />;
                    } else {
                        centerContent = <RegionWcsCenter region={region} frame={frame} />;
                    }
                } else {
                    centerContent = `(${toFixed(region.center.x, 1)}, ${toFixed(region.center.y, 1)})`;
                }
            } else {
                centerContent = "Invalid";
            }
            const centerEntry = (
                <div className="cell" style={{width: RegionListComponent.CENTER_COLUMN_DEFAULT_WIDTH}} onDoubleClick={this.handleRegionListDoubleClick}>
                    {centerContent}
                </div>
            );

            let sizeEntry: React.ReactNode;
            if (showSizeColumn) {
                let sizeContent: React.ReactNode;
                if (region.size) {
                    if (frame.validWcs) {
                        sizeContent =
                            region.regionType === CARTA.RegionType.LINE ? (
                                formattedArcsec(region.wcsSize ? length2D(region.wcsSize) : undefined, WCS_PRECISION)
                            ) : (
                                <React.Fragment>
                                    {formattedArcsec(region.wcsSize?.x, WCS_PRECISION)}
                                    <br />
                                    {formattedArcsec(region.wcsSize?.y, WCS_PRECISION)}
                                </React.Fragment>
                            );
                    } else {
                        sizeContent = region.regionType === CARTA.RegionType.LINE ? toFixed(region.size ? length2D(region.size) : undefined, 1) : `(${toFixed(region.size.x, 1)}, ${toFixed(region.size.y, 1)})`;
                    }
                }
                let tooltipContent = "";
                switch (region.regionType) {
                    case CARTA.RegionType.ELLIPSE:
                        tooltipContent = "Semi-major and semi-minor axes";
                        break;
                    case CARTA.RegionType.LINE:
                        tooltipContent = "Length";
                        break;
                    default:
                        tooltipContent = "Width and height";
                }
                sizeEntry = (
                    <div className="cell" style={{width: RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH}} onDoubleClick={this.handleRegionListDoubleClick}>
                        {region.regionType !== CARTA.RegionType.POINT && (
                            <Tooltip2 content={tooltipContent} position={Position.BOTTOM}>
                                {sizeContent}
                            </Tooltip2>
                        )}
                    </div>
                );
            }

            let lockEntry: React.ReactNode;
            if (region.regionId) {
                lockEntry = (
                    <div className="cell" style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH}} onClick={regionSet.locked || this.regionsVisibility === 0 ? () => {} : ev => this.handleRegionLockClicked(ev, region)}>
                        <Icon icon={region.locked ? "lock" : this.regionsVisibility === 0 ? "lock" : "unlock"} style={{opacity: regionSet.locked ? 0.3 : this.regionsVisibility === 0 ? 0.3 : 1}} />
                    </div>
                );
            } else {
                lockEntry = (
                    <div className="cell" style={{width: RegionListComponent.ACTIONS_COLUMN_DEFAULT_WIDTH}}>
                        <Icon icon={"blank"} />
                        <Icon icon={"blank"} />
                        <Icon icon={"blank"} />
                    </div>
                );
            }

            let focusEntry: React.ReactNode;
            if (region.regionId) {
                focusEntry = (
                    <div className="cell" style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH}} onClick={ev => this.handleFocusClicked(ev, region)}>
                        <CustomIcon icon="center" />
                    </div>
                );
            }

            let exportEntry: React.ReactNode;
            if (region.regionId) {
                exportEntry = (
                    <div className="cell" style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH}} onClick={ev => this.handleRegionExportClicked(ev, region)}>
                        <Tooltip2 content="Export region" position={Position.BOTTOM}>
                            <Icon icon="cloud-upload" />
                        </Tooltip2>
                    </div>
                );
            }

            const style = {...props.style};
            style.overflowX = "hidden";

            return (
                <div className={className} key={region.regionId} onClick={() => frame.regionSet.selectRegion(region)} style={style}>
                    {lockEntry}
                    {focusEntry}
                    {exportEntry}
                    <div className="cell" style={{width: nameWidth}} onDoubleClick={this.handleRegionListDoubleClick}>
                        {region.nameString}
                    </div>
                    <div className="cell" style={{width: RegionListComponent.TYPE_COLUMN_DEFAULT_WIDTH}} onDoubleClick={this.handleRegionListDoubleClick}>
                        {RegionStore.RegionTypeString(region.regionType)}
                    </div>
                    {centerEntry}
                    {showSizeColumn && sizeEntry}
                    {showRotationColumn && (
                        <div className="cell" style={{width: RegionListComponent.ROTATION_COLUMN_DEFAULT_WIDTH}} onDoubleClick={this.handleRegionListDoubleClick}>
                            {toFixed(region.rotation, 1)}
                        </div>
                    )}
                </div>
            );
        };

        return (
            <div className="region-list-widget">
                <div className={classNames("region-list-table", {"bp3-dark": darkTheme})}>
                    <FixedSizeList itemSize={RegionListComponent.HEADER_ROW_HEIGHT} height={RegionListComponent.HEADER_ROW_HEIGHT} itemCount={1} width="100%" className="list-header">
                        {headerRenderer(this.regionsVisibility, this.regionsLock)}
                    </FixedSizeList>
                    <FixedSizeList onItemsRendered={this.onListRendered} height={tableHeight - RegionListComponent.HEADER_ROW_HEIGHT - padding * 2} itemCount={this.validRegions.length} itemSize={RegionListComponent.ROW_HEIGHT} width="100%">
                        {rowRenderer}
                    </FixedSizeList>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} />
                {floatRenderer()}
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
