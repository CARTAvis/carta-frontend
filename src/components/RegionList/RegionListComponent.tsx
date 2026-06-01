import type {CSSProperties} from "react";
import * as React from "react";
import {List} from "react-window";
import {AnchorButton, ButtonGroup, Classes, Icon, NonIdealState, Position, Spinner, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {action, computed, type IReactionDisposer, makeObservable, observable, reaction} from "mobx";
import {observer} from "mobx-react";

import {ResizeDetector} from "components/Shared";
import {BrowserMode, DialogId, HelpType, RegionsOpacity} from "enums";
import {CustomIcon} from "icons/CustomIcons";
import {AppStore, type DefaultWidgetConfig, DialogStore, FileBrowserStore, type WidgetProps} from "stores";
import {type FrameStore, RegionStore, WCS_PRECISION} from "stores/Frame";
import {clamp, formattedArcsec, getFormattedWCSPoint, length2D, toFixed} from "utilities";

import "./RegionListComponent.scss";

@observer
export class RegionListComponent extends React.Component<WidgetProps> {
    private static readonly ActionColumnDefaultWidth = 25;
    private static readonly ActionsColumnDefaultWidth = 75;
    private static readonly NameColumnMinWidth = 50;
    private static readonly NameColumnDefaultWidth = 150;
    private static readonly TypeColumnDefaultWidth = 90;
    private static readonly CenterColumnDefaultWidth = 140;
    private static readonly SizeColumnDefaultWidth = 160;
    private static readonly RotationColumnDefaultWidth = 80;
    private static readonly RowHeight = 35;
    private static readonly HeaderRowHeight = 25;
    private listRef = React.createRef<any>();
    private readonly disposers: IReactionDisposer[] = [];
    private pendingScrollTarget = -1;

    public static get WidgetConfig(): DefaultWidgetConfig {
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
    @observable regionsVisibility: RegionsOpacity = RegionsOpacity.Visible;
    @observable isRegionsLocked: boolean = false;

    private scrollToSelected = (selected: number) => {
        const listRefCurrent = this.listRef.current;
        const rowCount = this.validRegions.length;
        if (!listRefCurrent || !isFinite(selected) || selected < 0 || selected >= rowCount) {
            return;
        }
        listRefCurrent.scrollToRow({index: selected, align: "smart"});
    };

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    componentDidMount() {
        this.disposers.push(
            reaction(
                () => AppStore.Instance.activeFrame?.regionSet?.selectedRegion?.regionId,
                id => {
                    if (id && id > 0) {
                        const idx = this.validRegions.findIndex(r => r.regionId === id);
                        // Store scroll target; componentDidUpdate will process it after the List
                        // re-renders with the updated rowCount, avoiding an out-of-range error.
                        this.pendingScrollTarget = idx;
                    }
                },
                {fireImmediately: true}
            )
        );
        // For the fireImmediately case the List is already rendered, but we still need to run
        // outside the reaction to avoid modifying observables (via onListRendered).
        if (this.pendingScrollTarget >= 0) {
            const target = this.pendingScrollTarget;
            this.pendingScrollTarget = -1;
            setTimeout(() => this.scrollToSelected(target), 0);
        }
    }

    componentDidUpdate() {
        if (this.pendingScrollTarget >= 0) {
            const target = this.pendingScrollTarget;
            this.pendingScrollTarget = -1;
            this.scrollToSelected(target);
        }
    }

    componentWillUnmount() {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    }

    @action private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    @action private toggleRegionVisibility = () => {
        if (this.regionsVisibility === RegionsOpacity.Visible) {
            this.regionsVisibility = RegionsOpacity.SemiTransparent;
        } else if (this.regionsVisibility === RegionsOpacity.SemiTransparent) {
            this.regionsVisibility = RegionsOpacity.Invisible;
        } else if (this.regionsVisibility === RegionsOpacity.Invisible) {
            this.regionsVisibility = RegionsOpacity.Visible;
        }
    };

    @action private toggleRegionsLock = (isLocked?: boolean) => {
        this.isRegionsLocked = isLocked !== undefined ? isLocked : !this.isRegionsLocked;
    };

    private syncRegionsLocked = () => {
        AppStore.Instance.activeFrame?.regionSet.setLocked(this.isRegionsLocked);
    };

    private handleRegionLockClicked = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>, region: RegionStore) => {
        region.toggleLock();
        ev.stopPropagation();
    };

    private handleAllRegionsLockClicked = (ev: React.MouseEvent<Element, MouseEvent>) => {
        this.toggleRegionsLock();
        this.syncRegionsLocked();
        ev.stopPropagation();
    };

    private handleToggleHideClicked = () => {
        return (ev: React.MouseEvent<HTMLElement, MouseEvent>) => {
            const activeFrame = AppStore.Instance.activeFrame;
            if (this.isRegionsLocked !== activeFrame?.regionSet.isLocked) {
                this.syncRegionsLocked();
            }
            this.toggleRegionVisibility();
            activeFrame?.regionSet.setOpacity(this.regionsVisibility);
            if (this.regionsVisibility === RegionsOpacity.Invisible) {
                activeFrame?.regionSet.setLocked(true);
            }
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
        DialogStore.Instance.showDialog(DialogId.Region);
    };

    private handleRegionDeleteClicked = async () => {
        const appStore = AppStore.Instance;
        const isConfirmed = await appStore.alertStore.showInteractiveAlert("Are you sure you want to delete all regions?");
        if (isConfirmed) {
            await appStore.deleteAllRegions();
        }
    };

    @action private onListRendered = (_visibleRows: {startIndex: number; stopIndex: number}, allRows: {startIndex: number; stopIndex: number}) => {
        // Update view bounds
        if (allRows && (this.firstVisibleRow !== allRows.startIndex || this.lastVisibleRow !== allRows.stopIndex)) {
            this.firstVisibleRow = allRows.startIndex;
            this.lastVisibleRow = allRows.stopIndex;
        }
    };

    render() {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const isDarkTheme = appStore.isDarkTheme;
        const regionSet = appStore.activeFrame?.regionSet;

        if (!frame) {
            return (
                <ResizeDetector onResize={this.onResize}>
                    <div className="region-list-widget">
                        <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                    </div>
                </ResizeDetector>
            );
        }

        if (appStore.fileBrowserStore.isLoadingDialogOpen) {
            return (
                <ResizeDetector onResize={this.onResize}>
                    <div className="region-list-widget">
                        <NonIdealState icon={<Spinner />} title={"Loading regions"} description={"Region list will be shown when regions have been loaded"} />
                    </div>
                </ResizeDetector>
            );
        }

        const padding = 5;
        const requiredTableHeight = RegionListComponent.RowHeight * (this.validRegions.length + 1);
        const tableHeight = isFinite(this.height) ? Math.min(requiredTableHeight, this.height) : requiredTableHeight;

        let nameWidth = RegionListComponent.NameColumnDefaultWidth;
        const availableWidth = this.width - 2 * padding;
        let fixedWidth =
            RegionListComponent.ActionsColumnDefaultWidth +
            RegionListComponent.TypeColumnDefaultWidth +
            RegionListComponent.CenterColumnDefaultWidth +
            RegionListComponent.SizeColumnDefaultWidth +
            RegionListComponent.RotationColumnDefaultWidth;
        nameWidth = availableWidth - fixedWidth;

        let shouldShowSizeColumn = true;
        let shouldShowRotationColumn = true;
        // Dynamically hide size column if name size is too short
        if (nameWidth < RegionListComponent.NameColumnMinWidth) {
            shouldShowSizeColumn = false;
            fixedWidth -= RegionListComponent.SizeColumnDefaultWidth;
            if (availableWidth > fixedWidth) {
                nameWidth = availableWidth - fixedWidth;
            }

            // If it's still too short, hide the rotation column as well
            if (nameWidth < RegionListComponent.NameColumnMinWidth) {
                shouldShowRotationColumn = false;
                fixedWidth -= RegionListComponent.RotationColumnDefaultWidth;
                if (availableWidth > fixedWidth) {
                    nameWidth = availableWidth - fixedWidth;
                } else {
                    nameWidth = RegionListComponent.NameColumnMinWidth;
                }
            }
        }

        // Dummy values to trigger re-rendering of visible rows when region properties change from an external source
        const firstVisibleRegion = clamp(this.firstVisibleRow, 0, frame.regionSet.regions.length - 1);
        const lastVisibleRegion = clamp(this.lastVisibleRow, firstVisibleRegion, frame.regionSet.regions.length - 1);
        for (let i = firstVisibleRegion; i <= lastVisibleRegion; i++) {
            const region = frame.regionSet.regions[i];
            /* eslint-disable @typescript-eslint/no-unused-vars */
            const _isRegionLocked = region.isLocked;
            const _name = region.name;
            const _angle = region.rotation;
            const _size = region.size.x + region.size.y;
            /* eslint-enable @typescript-eslint/no-unused-vars */
        }

        const selectedRegion = frame.regionSet.selectedRegion;

        // openOnTargetFocus={false} is to prevent the tooltip popup after the warning message.
        const floatRenderer = () => {
            return (
                <ButtonGroup className="float" style={{width: RegionListComponent.ActionColumnDefaultWidth * 3}}>
                    <Tooltip content="Delete all regions" position={Position.TOP_LEFT} openOnTargetFocus={false}>
                        <AnchorButton icon={"trash"} onClick={this.handleRegionDeleteClicked} style={{cursor: "pointer"}} disabled={this.validRegions.length <= 1} />
                    </Tooltip>
                    <Tooltip content="Import regions" position={Position.TOP_LEFT}>
                        <AnchorButton icon={"cloud-download"} onClick={this.handleRegionImportClicked} style={{cursor: "pointer"}} disabled={frame.isPreview} />
                    </Tooltip>
                    <Tooltip content="Export all regions" position={Position.BOTTOM}>
                        <AnchorButton icon="cloud-upload" onClick={this.handleRegionExportAllClicked} style={{cursor: "pointer"}} disabled={this.validRegions.length <= 1} />
                    </Tooltip>
                </ButtonGroup>
            );
        };

        const headerRenderer = (regionsVisibility: RegionsOpacity, isRegionsLock: boolean) => {
            return (props: {index: number; style: CSSProperties}) => {
                const className = classNames("row-header", {[Classes.DARK]: isDarkTheme});

                return (
                    <div className={className} style={props.style}>
                        <div className="cell" style={{width: RegionListComponent.ActionColumnDefaultWidth * 3}}>
                            <Icon icon={"blank"} style={{width: 16}} />
                            <Tooltip disabled={regionsVisibility === RegionsOpacity.Invisible} content="Lock all regions" position={Position.BOTTOM}>
                                <Icon
                                    icon={isRegionsLock ? "lock" : regionsVisibility === RegionsOpacity.Invisible ? "lock" : "unlock"}
                                    onClick={regionsVisibility === RegionsOpacity.Invisible ? () => {} : ev => this.handleAllRegionsLockClicked(ev)}
                                    style={{cursor: "pointer", opacity: regionsVisibility === RegionsOpacity.Invisible ? 0.3 : 1}}
                                />
                            </Tooltip>
                            <Icon icon={"blank"} style={{width: 5}} />
                            <Tooltip content={regionsVisibility === RegionsOpacity.Invisible ? "Show regions" : "Hide regions"} position={Position.BOTTOM}>
                                <Icon
                                    icon={regionsVisibility === RegionsOpacity.Invisible ? "eye-off" : "eye-open"}
                                    onClick={this.handleToggleHideClicked()}
                                    style={{cursor: "pointer", opacity: regionsVisibility === RegionsOpacity.SemiTransparent ? 0.3 : 1}}
                                />
                            </Tooltip>
                        </div>
                        <div className="cell" style={{width: nameWidth}}>
                            Name
                        </div>
                        <div className="cell" style={{width: RegionListComponent.TypeColumnDefaultWidth}}>
                            Type
                        </div>
                        <div className="cell" style={{width: RegionListComponent.CenterColumnDefaultWidth}}>
                            {frame.isValidWcs ? "Center" : "Pixel Center"}
                        </div>
                        {shouldShowSizeColumn && (
                            <div className="cell" style={{width: RegionListComponent.SizeColumnDefaultWidth}}>
                                {frame.isValidWcs ? "Size" : "Size (px)"}
                            </div>
                        )}
                        {shouldShowRotationColumn && (
                            <div className="cell" style={{width: RegionListComponent.RotationColumnDefaultWidth}}>
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
            const className = classNames("row", {[Classes.DARK]: isDarkTheme, selected: selectedRegion?.regionId === region.regionId});

            let centerContent: React.ReactNode;
            if (isFinite(region.center.x) && isFinite(region.center.y)) {
                if (frame.isValidWcs) {
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
                <div className="cell" style={{width: RegionListComponent.CenterColumnDefaultWidth}} onDoubleClick={this.handleRegionListDoubleClick}>
                    {centerContent}
                </div>
            );

            let sizeEntry: React.ReactNode;
            if (shouldShowSizeColumn) {
                let sizeContent: React.ReactNode;
                if (region.size) {
                    if (frame.isValidWcs) {
                        sizeContent =
                            region.regionType === CARTA.RegionType.LINE || region.regionType === CARTA.RegionType.ANNLINE || region.regionType === CARTA.RegionType.ANNVECTOR || region.regionType === CARTA.RegionType.ANNRULER ? (
                                formattedArcsec(region.wcsSize && length2D(region.wcsSize), WCS_PRECISION)
                            ) : (
                                <React.Fragment>
                                    {formattedArcsec(region.wcsSize?.x, WCS_PRECISION)}
                                    <br />
                                    {formattedArcsec(region.wcsSize?.y, WCS_PRECISION)}
                                </React.Fragment>
                            );
                    } else {
                        sizeContent = region.regionType === CARTA.RegionType.LINE ? toFixed(region.size && length2D(region.size), 1) : `(${toFixed(region.size.x, 1)}, ${toFixed(region.size.y, 1)})`;
                    }
                }
                let tooltipContent = "";
                switch (region.regionType) {
                    case CARTA.RegionType.ELLIPSE:
                    case CARTA.RegionType.ANNELLIPSE:
                        tooltipContent = "Semi-major and semi-minor axes";
                        break;
                    case CARTA.RegionType.LINE:
                    case CARTA.RegionType.ANNLINE:
                    case CARTA.RegionType.ANNVECTOR:
                    case CARTA.RegionType.ANNRULER:
                        tooltipContent = "Length";
                        break;
                    case CARTA.RegionType.ANNCOMPASS:
                        tooltipContent = "Axes Length";
                        break;
                    default:
                        tooltipContent = "Width and height";
                }
                sizeEntry = (
                    <div className="cell" style={{width: RegionListComponent.SizeColumnDefaultWidth}} onDoubleClick={this.handleRegionListDoubleClick}>
                        {region.regionType !== CARTA.RegionType.POINT && (
                            <Tooltip content={tooltipContent} position={Position.BOTTOM}>
                                {sizeContent}
                            </Tooltip>
                        )}
                    </div>
                );
            }

            let lockEntry: React.ReactNode;
            if (region.regionId) {
                lockEntry = (
                    <div
                        className="cell"
                        style={{width: RegionListComponent.ActionColumnDefaultWidth}}
                        onClick={regionSet?.isLocked || this.regionsVisibility === RegionsOpacity.Invisible ? () => {} : ev => this.handleRegionLockClicked(ev, region)}
                        data-testid={"region-list-table-row-" + (props.index + 1) + "-lock-cell"}
                    >
                        <Icon
                            icon={region.isLocked ? "lock" : this.regionsVisibility === RegionsOpacity.Invisible ? "lock" : "unlock"}
                            style={{opacity: regionSet?.isLocked || this.regionsVisibility === RegionsOpacity.Invisible ? 0.3 : 1}}
                        />
                    </div>
                );
            } else {
                lockEntry = (
                    <div className="cell" style={{width: RegionListComponent.ActionsColumnDefaultWidth}}>
                        <Icon icon={"blank"} />
                        <Icon icon={"blank"} />
                        <Icon icon={"blank"} />
                    </div>
                );
            }

            let focusEntry: React.ReactNode;
            if (region.regionId) {
                focusEntry = (
                    <div className="cell" style={{width: RegionListComponent.ActionColumnDefaultWidth}} onClick={ev => this.handleFocusClicked(ev, region)} data-testid={"region-list-table-row-" + (props.index + 1) + "-center-cell"}>
                        <CustomIcon icon="center" />
                    </div>
                );
            }

            let exportEntry: React.ReactNode;
            if (region.regionId) {
                exportEntry = (
                    <div className="cell" style={{width: RegionListComponent.ActionColumnDefaultWidth}} onClick={ev => this.handleRegionExportClicked(ev, region)}>
                        <Tooltip content="Export region" position={Position.BOTTOM}>
                            <Icon icon="cloud-upload" />
                        </Tooltip>
                    </div>
                );
            }

            const style = {...props.style, overflowX: "hidden" as const};

            return (
                <div className={className} key={region.regionId} onClick={() => frame.regionSet.selectRegion(region)} style={style} data-testid={"region-list-table-row-" + (props.index + 1)}>
                    {lockEntry}
                    {focusEntry}
                    {exportEntry}
                    <div className="cell" style={{width: nameWidth}} onDoubleClick={this.handleRegionListDoubleClick}>
                        {region.nameString}
                    </div>
                    <div className="cell" style={{width: RegionListComponent.TypeColumnDefaultWidth}} onDoubleClick={this.handleRegionListDoubleClick}>
                        {RegionStore.regionTypeString(region.regionType)}
                    </div>
                    {centerEntry}
                    {shouldShowSizeColumn && sizeEntry}
                    {shouldShowRotationColumn && (
                        <div className="cell" style={{width: RegionListComponent.RotationColumnDefaultWidth}} onDoubleClick={this.handleRegionListDoubleClick}>
                            {toFixed(region.rotation, 1)}
                        </div>
                    )}
                </div>
            );
        };

        return (
            <ResizeDetector onResize={this.onResize}>
                <div className="region-list-widget">
                    <div className={classNames("region-list-table", {[Classes.DARK]: isDarkTheme})} data-testid="region-list-table">
                        <List
                            rowHeight={RegionListComponent.HeaderRowHeight}
                            defaultHeight={RegionListComponent.HeaderRowHeight}
                            rowCount={1}
                            style={{height: RegionListComponent.HeaderRowHeight, width: "100%"}}
                            className="list-header"
                            rowComponent={headerRenderer(this.regionsVisibility, this.isRegionsLocked)}
                            rowProps={{} as any}
                        />
                        <List
                            onRowsRendered={this.onListRendered}
                            defaultHeight={tableHeight - RegionListComponent.HeaderRowHeight - padding * 2}
                            rowCount={this.validRegions.length}
                            rowHeight={RegionListComponent.RowHeight}
                            style={{height: tableHeight - RegionListComponent.HeaderRowHeight - padding * 2, width: "100%"}}
                            listRef={this.listRef}
                            rowComponent={rowRenderer}
                            rowProps={{} as any}
                        />
                    </div>
                    {floatRenderer()}
                </div>
            </ResizeDetector>
        );
    }
}

@observer
export class RegionWcsCenter extends React.Component<{region: RegionStore; frame: FrameStore}> {
    public render() {
        // dummy variables related to wcs to trigger re-render
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const system = AppStore.Instance.overlaySettings.global.explicitSystem;
        const formatX = AppStore.Instance.overlaySettings.numbers.formatTypeX;
        const formatY = AppStore.Instance.overlaySettings.numbers.formatTypeY;
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const frame = this.props.frame;
        const region = this.props.region;
        if (!region || !region.center || !(isFinite(region.center.x) && isFinite(region.center.y) && this.props.frame.isValidWcs)) {
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
