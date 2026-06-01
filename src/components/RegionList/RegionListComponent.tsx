import type {CSSProperties} from "react";
import * as React from "react";
import {List} from "react-window";
import {AnchorButton, ButtonGroup, Classes, Icon, Menu, MenuDivider, MenuItem, NonIdealState, Position, showContextMenu, Spinner, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {action, computed, type IReactionDisposer, makeObservable, observable, reaction} from "mobx";
import {observer} from "mobx-react";

import {getRegionIconOpacity, ResizeDetector} from "components/Shared";
import {BrowserMode, DialogId, HelpType, RegionOpacity} from "enums";
import {CustomIcon} from "icons/CustomIcons";
import {AppStore, type DefaultWidgetConfig, DialogStore, FileBrowserStore, type WidgetProps} from "stores";
import {CURSOR_REGION_ID, type FrameStore, type RegionSetStore, RegionStore, WCS_PRECISION} from "stores/Frame";
import {clamp, formattedArcsec, getFormattedWCSPoint, getNextRegionOpacity, length2D, toFixed} from "utilities";

import "./RegionListComponent.scss";

@observer
export class RegionListComponent extends React.Component<WidgetProps> {
    private static readonly ActionColumnDefaultWidth = 25;
    private static readonly ActionsColumnDefaultWidth = RegionListComponent.ActionColumnDefaultWidth * 4;
    private static readonly NameColumnMinWidth = 50;
    private static readonly NameColumnDefaultWidth = 150;
    private static readonly TypeColumnDefaultWidth = 90;
    private static readonly CenterColumnDefaultWidth = 140;
    private static readonly SizeColumnDefaultWidth = 160;
    private static readonly RotationColumnDefaultWidth = 80;
    private static readonly RowHeight = 35;
    private static readonly HeaderRowHeight = 25;
    private listRef = React.createRef<any>();
    private tableRef = React.createRef<HTMLDivElement>();
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

    private scrollToIndex = (index: number) => {
        const listRefCurrent = this.listRef.current;
        const rowCount = this.validRegions.length;
        if (!listRefCurrent || !isFinite(index) || index < 0 || index >= rowCount) {
            return;
        }
        listRefCurrent.scrollToRow({index, align: "smart"});
    };

    @action private handleBackgroundClick = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        const target = ev.target as HTMLElement;
        const clickedRow = target.closest(".row");
        const clickedHeader = target.closest(".row-header");
        if (!clickedRow && !clickedHeader) {
            const frame = AppStore.Instance.activeFrame;
            frame?.regionSet.clearSelection();
        }
    };

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    componentDidMount() {
        this.disposers.push(
            reaction(
                () => AppStore.Instance.activeFrame?.regionSet?.focusedRegion?.regionId,
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
            setTimeout(() => this.scrollToIndex(target), 0);
        }
    }

    componentDidUpdate() {
        if (this.pendingScrollTarget >= 0) {
            const target = this.pendingScrollTarget;
            this.pendingScrollTarget = -1;
            this.scrollToIndex(target);
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

    private handleRegionLockClicked = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>, region: RegionStore) => {
        const regionSet = AppStore.Instance.activeFrame?.regionSet;
        if (regionSet?.isRegionInMultiSelection(region)) {
            regionSet.toggleSelectedRegionsLocked();
        } else {
            region.toggleLock();
        }
        ev.stopPropagation();
    };

    private handleRegionHideClicked = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>, region: RegionStore) => {
        const regionSet = AppStore.Instance.activeFrame?.regionSet;
        if (regionSet?.isRegionInMultiSelection(region)) {
            regionSet.toggleSelectedRegionsVisibility();
        } else {
            region.setOpacity(getNextRegionOpacity(region.opacity));
        }
        ev.stopPropagation();
    };

    private handleAllRegionsLockClicked = (ev: React.MouseEvent<Element, MouseEvent>) => {
        AppStore.Instance.activeFrame?.regionSet.toggleEditableRegionsLocked();
        ev.stopPropagation();
    };

    private handleToggleHideClicked = (ev: React.MouseEvent<HTMLElement, MouseEvent>) => {
        AppStore.Instance.activeFrame?.regionSet.toggleEditableRegionsVisibility();
        ev.stopPropagation();
    };

    private handleFocusClicked = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>, region: RegionStore) => {
        region.focusCenter();
        ev.stopPropagation();
    };

    private handleRegionExportClicked = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>, region: RegionStore) => {
        ev.stopPropagation();
        const regionSet = AppStore.Instance.activeFrame?.regionSet;
        if (regionSet?.isRegionInMultiSelection(region)) {
            FileBrowserStore.Instance.showExportSelectedRegions();
        } else {
            FileBrowserStore.Instance.showExportRegions(region.regionId);
        }
    };

    private stopDoubleClickPropagation = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        ev.stopPropagation();
    };

    private handleRegionImportClicked = () => {
        FileBrowserStore.Instance.showFileBrowser(BrowserMode.RegionImport, false);
    };

    private handleRegionExportAllClicked = () => {
        const selectedCount = AppStore.Instance.activeFrame?.regionSet.selectedRegionCount ?? 0;
        if (selectedCount > 1) {
            FileBrowserStore.Instance.showExportSelectedRegions();
        } else {
            FileBrowserStore.Instance.showExportRegions();
        }
    };

    private handleRegionListDoubleClick = (region?: RegionStore) => {
        const regionSet = AppStore.Instance.activeFrame?.regionSet;
        if (!regionSet || region?.regionId === CURSOR_REGION_ID) {
            return;
        }

        if (!regionSet.isRegionInMultiSelection(region) && region && region.regionId !== CURSOR_REGION_ID) {
            regionSet.selectSingleRegion(region);
        }
        DialogStore.Instance.showDialog(DialogId.Region);
    };

    private handleRegionContextMenu = (ev: React.MouseEvent<HTMLDivElement>, region: RegionStore) => {
        ev.preventDefault();
        ev.stopPropagation();

        if (region.regionId === CURSOR_REGION_ID) {
            return;
        }

        const appStore = AppStore.Instance;
        const regionSet = appStore.activeFrame?.regionSet;
        if (!regionSet) {
            return;
        }

        regionSet.selectRegionFromList(region, this.validRegions);

        const selectedRegions = regionSet.selectedRegionsList;
        const isMultiSelected = regionSet.selectedRegionCount > 1;
        const deleteDisabled = regionSet.isLocked || selectedRegions.every(selectedRegion => selectedRegion.isLocked);
        const deleteSelectedRegionsMenuItem = (
            <MenuItem
                icon="trash"
                intent="danger"
                text="Delete"
                disabled={deleteDisabled}
                onClick={() => {
                    appStore.deleteSelectedRegions();
                }}
            />
        );

        if (!isMultiSelected) {
            showContextMenu({
                content: <Menu>{deleteSelectedRegionsMenuItem}</Menu>,
                targetOffset: {left: ev.clientX, top: ev.clientY},
                isDarkTheme: appStore.isDarkTheme
            });
            return;
        }

        const selectedRegionsOpacity = regionSet.selectedRegionsOpacity;
        const hasVisibleSelectedRegions = selectedRegionsOpacity !== RegionOpacity.Invisible;
        const lockDisabled = regionSet.isLocked || selectedRegionsOpacity === RegionOpacity.Invisible;
        const showLockedIcon = lockDisabled || regionSet.isAllSelectedRegionsLocked;
        const title = `${regionSet.selectedRegionCount} regions selected`;

        showContextMenu({
            content: (
                <Menu>
                    <MenuDivider title={title} />
                    <MenuItem
                        icon={showLockedIcon ? "lock" : "unlock"}
                        text={showLockedIcon ? "Unlock" : "Lock"}
                        disabled={lockDisabled}
                        onClick={() => {
                            regionSet.toggleSelectedRegionsLocked();
                        }}
                    />
                    <MenuItem
                        icon={<Icon icon={hasVisibleSelectedRegions ? "eye-open" : "eye-off"} style={{opacity: getRegionIconOpacity(selectedRegionsOpacity)}} />}
                        text={hasVisibleSelectedRegions ? "Hide" : "Show"}
                        onClick={() => {
                            regionSet.toggleSelectedRegionsVisibility();
                        }}
                    />
                    <MenuItem
                        icon="cloud-upload"
                        text="Export regions"
                        onClick={() => {
                            FileBrowserStore.Instance.showExportSelectedRegions();
                        }}
                    />
                    <MenuDivider />
                    <MenuItem icon="settings" text="Region properties" onClick={() => DialogStore.Instance.showDialog(DialogId.Region)} />
                    <MenuDivider />
                    {deleteSelectedRegionsMenuItem}
                </Menu>
            ),
            targetOffset: {left: ev.clientX, top: ev.clientY},
            isDarkTheme: appStore.isDarkTheme
        });
    };

    private scrollToRegionId = (regionId: number) => {
        const validIndex = this.validRegions.findIndex(region => region.regionId === regionId);
        if (validIndex >= 0) {
            this.scrollToIndex(validIndex);
        }
    };

    private handleSelectAllKeyboard = (regionSet: RegionSetStore) => {
        regionSet.selectAllRegions();
        this.scrollToRegionId(regionSet.focusedRegion?.regionId ?? CURSOR_REGION_ID);
    };

    @action private handleKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>) => {
        const appStore = AppStore.Instance;
        const regionSet = appStore.activeFrame?.regionSet;
        if (!regionSet) {
            return;
        }

        const key = ev.key;
        if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && !ev.altKey && key.toLowerCase() === "a") {
            ev.preventDefault();
            ev.stopPropagation();
            this.handleSelectAllKeyboard(regionSet);
            return;
        }

        if (key === "Enter") {
            ev.preventDefault();
            ev.stopPropagation();
            this.handleRegionListDoubleClick(regionSet.focusedRegion ?? undefined);
            return;
        }

        const isArrowVertical = key === "ArrowUp" || key === "ArrowDown";
        const isArrowHorizontal = key === "ArrowLeft" || key === "ArrowRight";
        if (!isArrowVertical && !isArrowHorizontal) {
            return;
        }

        ev.preventDefault();
        ev.stopPropagation();

        if (isArrowHorizontal) {
            // Keep horizontal arrows local to the focused Region List instead of falling through to image-view region movement hotkeys.
            return;
        }

        const noModifier = !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey;
        const direction = key === "ArrowUp" ? -1 : 1;
        regionSet.selectAdjacentRegionFromList(this.validRegions, direction, {wrap: noModifier, range: ev.shiftKey, includeCursor: noModifier});
        this.scrollToRegionId(regionSet.focusedRegion?.regionId ?? CURSOR_REGION_ID);
    };

    private handleRegionDeleteClicked = async () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        if (!frame) {
            return;
        }
        const hasDeletableRegions = !frame.regionSet.isLocked && this.validRegions.some(region => region.regionId !== CURSOR_REGION_ID && !region.isLocked);
        if (!hasDeletableRegions) {
            return;
        }

        const confirmed = await appStore.alertStore.showInteractiveAlert("Are you sure you want to delete all regions?");
        if (confirmed) {
            appStore.deleteAllRegions();
        }
    };

    @action private handleRowClicked = (ev: React.MouseEvent, region: RegionStore) => {
        const frame = AppStore.Instance.activeFrame;
        if (!frame) {
            return;
        }

        const isCtrlPressed = ev.ctrlKey || ev.metaKey;
        const isShiftPressed = ev.shiftKey;
        const regionSet = frame.regionSet;

        if (ev.detail > 1 && !isCtrlPressed && !isShiftPressed) {
            this.handleRegionListDoubleClick(region);
            return;
        }

        regionSet.selectRegionFromList(region, this.validRegions, {toggle: isCtrlPressed, range: isShiftPressed});
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
        const darkTheme = appStore.isDarkTheme;

        if (!frame) {
            return (
                <ResizeDetector onResize={this.onResize}>
                    <div className="region-list-widget">
                        <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
                    </div>
                </ResizeDetector>
            );
        }

        const regionSet = frame.regionSet;

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

        let showSizeColumn = true;
        let showRotationColumn = true;
        // Dynamically hide size column if name size is too short
        if (nameWidth < RegionListComponent.NameColumnMinWidth) {
            showSizeColumn = false;
            fixedWidth -= RegionListComponent.SizeColumnDefaultWidth;
            if (availableWidth > fixedWidth) {
                nameWidth = availableWidth - fixedWidth;
            }

            // If it's still too short, hide the rotation column as well
            if (nameWidth < RegionListComponent.NameColumnMinWidth) {
                showRotationColumn = false;
                fixedWidth -= RegionListComponent.RotationColumnDefaultWidth;
                if (availableWidth > fixedWidth) {
                    nameWidth = availableWidth - fixedWidth;
                } else {
                    nameWidth = RegionListComponent.NameColumnMinWidth;
                }
            }
        }

        // Dummy values to trigger re-rendering of visible rows when region properties change from an external source
        const firstVisibleRegion = clamp(this.firstVisibleRow, 0, regionSet.regions.length - 1);
        const lastVisibleRegion = clamp(this.lastVisibleRow, firstVisibleRegion, regionSet.regions.length - 1);
        for (let i = firstVisibleRegion; i <= lastVisibleRegion; i++) {
            const region = regionSet.regions[i];
            /* eslint-disable @typescript-eslint/no-unused-vars */
            const _isLocked = region.isLocked;
            const _name = region.name;
            const _angle = region.rotation;
            const _size = region.size.x + region.size.y;
            const _opacity = region.opacity;
            /* eslint-enable @typescript-eslint/no-unused-vars */
        }

        /* eslint-disable @typescript-eslint/no-unused-vars */
        const _focusedRegionId = regionSet.focusedRegion?.regionId;
        const _selectedRegionIds = Array.from(regionSet.selectedRegionIds).join(",");
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const hasDeletableRegions = !regionSet.isLocked && this.validRegions.some(region => region.regionId !== CURSOR_REGION_ID && !region.isLocked);

        // openOnTargetFocus={false} is to prevent the tooltip popup after the warning message.
        const floatRenderer = () => {
            const exportTooltip = regionSet.selectedRegionCount > 1 ? "Export selected regions" : "Export all regions";
            return (
                <ButtonGroup className="float" style={{width: RegionListComponent.ActionsColumnDefaultWidth}}>
                    <Tooltip content="Delete all regions" position={Position.TOP_LEFT} openOnTargetFocus={false}>
                        <AnchorButton icon={"trash"} onClick={this.handleRegionDeleteClicked} style={{cursor: "pointer"}} disabled={!hasDeletableRegions} />
                    </Tooltip>
                    <Tooltip content="Import regions" position={Position.TOP_LEFT}>
                        <AnchorButton icon={"cloud-download"} onClick={this.handleRegionImportClicked} style={{cursor: "pointer"}} />
                    </Tooltip>
                    <Tooltip content={exportTooltip} position={Position.BOTTOM}>
                        <AnchorButton icon="cloud-upload" onClick={this.handleRegionExportAllClicked} style={{cursor: "pointer"}} disabled={this.validRegions.length <= 1} />
                    </Tooltip>
                </ButtonGroup>
            );
        };

        const headerRenderer = (props: {index: number; style: CSSProperties}) => {
            const className = classNames("row-header", {[Classes.DARK]: darkTheme});
            const lockDisabled = !regionSet.visibleEditableRegionsList.length;
            const allRegionsLocked = regionSet.isAllEditableRegionsLocked;
            const lockIcon = allRegionsLocked ? "lock" : "unlock";
            const lockTooltip = allRegionsLocked ? "Unlock all regions" : "Lock all regions";
            const regionsOpacity = regionSet.editableRegionsOpacity;

            return (
                <div className={className} style={props.style}>
                    <div className="cell" style={{width: RegionListComponent.ActionsColumnDefaultWidth, justifyContent: "center", gap: 8}}>
                        <Tooltip disabled={lockDisabled} content={lockTooltip} position={Position.BOTTOM}>
                            <Icon icon={lockIcon} onClick={lockDisabled ? undefined : ev => this.handleAllRegionsLockClicked(ev)} style={{cursor: "pointer", opacity: lockDisabled ? 0.3 : 1}} />
                        </Tooltip>
                        <Tooltip content={regionsOpacity === RegionOpacity.Invisible ? "Show all regions" : "Hide all regions"} position={Position.BOTTOM}>
                            <Icon icon={regionsOpacity === RegionOpacity.Invisible ? "eye-off" : "eye-open"} onClick={this.handleToggleHideClicked} style={{cursor: "pointer", opacity: getRegionIconOpacity(regionsOpacity)}} />
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
                    {showSizeColumn && (
                        <div className="cell" style={{width: RegionListComponent.SizeColumnDefaultWidth}}>
                            {frame.isValidWcs ? "Size" : "Size (px)"}
                        </div>
                    )}
                    {showRotationColumn && (
                        <div className="cell" style={{width: RegionListComponent.RotationColumnDefaultWidth}}>
                            P.A. (deg)
                        </div>
                    )}
                </div>
            );
        };

        const rowRenderer = (props: {index: number; style: CSSProperties}) => {
            const region = this.validRegions?.[props.index];
            if (!region) {
                return null;
            }
            const isActive = regionSet.focusedRegion?.regionId === region.regionId;
            const isSecondarySelected = !isActive && regionSet.selectedRegionIds.has(region.regionId);
            const className = classNames("row", {[Classes.DARK]: darkTheme, active: isActive, selected: isSecondarySelected});

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
                <div className="cell" style={{width: RegionListComponent.CenterColumnDefaultWidth}}>
                    {centerContent}
                </div>
            );

            let sizeEntry: React.ReactNode;
            if (showSizeColumn) {
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
                    <div className="cell" style={{width: RegionListComponent.SizeColumnDefaultWidth}}>
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
                const lockDisabled = regionSet.isLocked || !region.isVisible;
                const lockIcon = region.isLocked || !region.isVisible ? "lock" : "unlock";
                const lockTooltip = lockIcon === "lock" ? "Unlock region" : "Lock region";
                lockEntry = (
                    <div
                        className="cell"
                        style={{width: RegionListComponent.ActionColumnDefaultWidth}}
                        onClick={lockDisabled ? () => {} : ev => this.handleRegionLockClicked(ev, region)}
                        onDoubleClick={this.stopDoubleClickPropagation}
                        data-testid={"region-list-table-row-" + (props.index + 1) + "-lock-cell"}
                    >
                        <Tooltip disabled={lockDisabled} content={lockTooltip} position={Position.BOTTOM}>
                            <Icon icon={lockIcon} style={{opacity: lockDisabled ? 0.3 : 1}} />
                        </Tooltip>
                    </div>
                );
            } else {
                lockEntry = (
                    <div className="cell" style={{width: RegionListComponent.ActionsColumnDefaultWidth}}>
                        <Icon icon={"blank"} />
                        <Icon icon={"blank"} />
                        <Icon icon={"blank"} />
                        <Icon icon={"blank"} />
                    </div>
                );
            }

            let hideEntry: React.ReactNode;
            if (region.regionId) {
                const regionVisible = region.opacity !== RegionOpacity.Invisible;
                hideEntry = (
                    <div className="cell" style={{width: RegionListComponent.ActionColumnDefaultWidth}} onClick={ev => this.handleRegionHideClicked(ev, region)} onDoubleClick={this.stopDoubleClickPropagation}>
                        <Tooltip content={regionVisible ? "Hide region" : "Show region"} position={Position.BOTTOM}>
                            <Icon icon={regionVisible ? "eye-open" : "eye-off"} style={{opacity: getRegionIconOpacity(region.opacity)}} />
                        </Tooltip>
                    </div>
                );
            }

            let focusEntry: React.ReactNode;
            if (region.regionId) {
                focusEntry = (
                    <div
                        className="cell"
                        style={{width: RegionListComponent.ActionColumnDefaultWidth}}
                        onClick={ev => this.handleFocusClicked(ev, region)}
                        onDoubleClick={this.stopDoubleClickPropagation}
                        data-testid={"region-list-table-row-" + (props.index + 1) + "-center-cell"}
                    >
                        <Tooltip content="Focus" position={Position.BOTTOM}>
                            <CustomIcon icon="center" />
                        </Tooltip>
                    </div>
                );
            }

            let exportEntry: React.ReactNode;
            if (region.regionId) {
                exportEntry = (
                    <div className="cell" style={{width: RegionListComponent.ActionColumnDefaultWidth}} onClick={ev => this.handleRegionExportClicked(ev, region)} onDoubleClick={this.stopDoubleClickPropagation}>
                        <Tooltip content="Export region" position={Position.BOTTOM}>
                            <Icon icon="cloud-upload" />
                        </Tooltip>
                    </div>
                );
            }

            const style = {...props.style, overflowX: "hidden" as const};

            return (
                <div
                    className={className}
                    key={region.regionId}
                    onClick={ev => this.handleRowClicked(ev, region)}
                    onContextMenu={ev => this.handleRegionContextMenu(ev, region)}
                    style={style}
                    data-testid={"region-list-table-row-" + (props.index + 1)}
                >
                    {lockEntry}
                    {hideEntry}
                    {focusEntry}
                    {exportEntry}
                    <div className="cell" style={{width: nameWidth}}>
                        {region.nameString}
                    </div>
                    <div className="cell" style={{width: RegionListComponent.TypeColumnDefaultWidth}}>
                        {RegionStore.regionTypeString(region.regionType)}
                    </div>
                    {centerEntry}
                    {showSizeColumn && sizeEntry}
                    {showRotationColumn && (
                        <div className="cell" style={{width: RegionListComponent.RotationColumnDefaultWidth}}>
                            {toFixed(region.rotation, 1)}
                        </div>
                    )}
                </div>
            );
        };

        return (
            <ResizeDetector onResize={this.onResize}>
                <div className="region-list-widget" onClick={this.handleBackgroundClick}>
                    <div
                        className={classNames("region-list-table", {[Classes.DARK]: darkTheme})}
                        data-testid="region-list-table"
                        onClick={this.handleBackgroundClick}
                        // Make focusable to capture arrow key events
                        tabIndex={0}
                        ref={this.tableRef}
                        onKeyDown={this.handleKeyDown}
                        // Ensure clicks focus this container so it receives key events
                        onMouseDown={ev => (ev.currentTarget as HTMLDivElement).focus()}
                    >
                        <List
                            rowHeight={RegionListComponent.HeaderRowHeight}
                            defaultHeight={RegionListComponent.HeaderRowHeight}
                            rowCount={1}
                            style={{height: RegionListComponent.HeaderRowHeight, width: "100%"}}
                            className="list-header"
                            rowComponent={headerRenderer}
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
