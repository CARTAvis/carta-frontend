import type {CSSProperties} from "react";
import * as React from "react";
import {List} from "react-window";
import {AnchorButton, ButtonGroup, Classes, Icon, Menu, MenuDivider, MenuItem, NonIdealState, Position, showContextMenu, Spinner, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {action, computed, type IReactionDisposer, makeObservable, observable, reaction} from "mobx";
import {observer} from "mobx-react";

import {ResizeDetector} from "components/Shared";
import {BrowserMode, DialogId, HelpType, RegionsOpacity} from "enums";
import {CustomIcon} from "icons/CustomIcons";
import {AppStore, type DefaultWidgetConfig, DialogStore, FileBrowserStore, type WidgetProps} from "stores";
import {CURSOR_REGION_ID, type FrameStore, RegionStore, WCS_PRECISION} from "stores/Frame";
import {clamp, formattedArcsec, getFormattedWCSPoint, length2D, toFixed} from "utilities";

import "./RegionListComponent.scss";

@observer
export class RegionListComponent extends React.Component<WidgetProps> {
    private static readonly ACTION_COLUMN_DEFAULT_WIDTH = 25;
    private static readonly ACTIONS_COLUMN_DEFAULT_WIDTH = RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH * 4;
    private static readonly NAME_COLUMN_MIN_WIDTH = 50;
    private static readonly NAME_COLUMN_DEFAULT_WIDTH = 150;
    private static readonly TYPE_COLUMN_DEFAULT_WIDTH = 90;
    private static readonly CENTER_COLUMN_DEFAULT_WIDTH = 140;
    private static readonly SIZE_COLUMN_DEFAULT_WIDTH = 160;
    private static readonly ROTATION_COLUMN_DEFAULT_WIDTH = 80;
    private static readonly ROW_HEIGHT = 35;
    private static readonly HEADER_ROW_HEIGHT = 25;
    private listRef = React.createRef<any>();
    private tableRef = React.createRef<HTMLDivElement>();
    private readonly disposers: IReactionDisposer[] = [];
    private pendingScrollTarget = -1;

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
    @observable regionsVisibility: RegionsOpacity = RegionsOpacity.Visible;
    private rowPivotIndex: number = -1;

    private scrollToSelected = (selected: number) => {
        const listRefCurrent = this.listRef.current;
        const rowCount = this.validRegions.length;
        if (!listRefCurrent || !isFinite(selected) || selected < 0 || selected >= rowCount) {
            return;
        }
        listRefCurrent.scrollToRow({index: selected, align: "smart"});
    };

    @action private handleBackgroundClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        const target = event.target as HTMLElement;
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
        switch (this.regionsVisibility) {
            case RegionsOpacity.Visible:
                this.regionsVisibility = RegionsOpacity.SemiTransparent;
                break;
            case RegionsOpacity.SemiTransparent:
                this.regionsVisibility = RegionsOpacity.Invisible;
                break;
            default:
                this.regionsVisibility = RegionsOpacity.Visible;
                break;
        }
    };

    private handleRegionLockClicked = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>, region: RegionStore) => {
        const regionSet = AppStore.Instance.activeFrame?.regionSet;
        if (regionSet && regionSet.selectedRegionIds.has(region.regionId) && regionSet.selectedRegionsList.length > 1) {
            regionSet.toggleSelectedRegionsLocked();
        } else {
            region.toggleLock();
        }
        ev.stopPropagation();
    };

    private handleRegionHideClicked = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>, region: RegionStore) => {
        const regionSet = AppStore.Instance.activeFrame?.regionSet;
        if (regionSet) {
            const selectedRegionIds = regionSet.selectedRegionIds;
            const isRegionInMultiSelection = selectedRegionIds.has(region.regionId) && regionSet.selectedRegionsList.length > 1;
            if (!isRegionInMultiSelection) {
                regionSet.selectSingleRegion(region);
                this.rowPivotIndex = this.validRegions.findIndex(validRegion => validRegion.regionId === region.regionId);
            }
            regionSet.toggleSelectedRegionsVisibility();
        }
        ev.stopPropagation();
    };

    private handleAllRegionsLockClicked = (ev: React.MouseEvent<Element, MouseEvent>) => {
        AppStore.Instance.activeFrame?.regionSet.toggleEditableRegionsLocked();
        ev.stopPropagation();
    };

    private handleToggleHideClicked = (ev: React.MouseEvent<HTMLElement, MouseEvent>) => {
        const activeFrame = AppStore.Instance.activeFrame;
        this.toggleRegionVisibility();
        activeFrame?.regionSet.setOpacity(RegionsOpacity.Visible);
        activeFrame?.regionSet.setEditableRegionsOpacity(this.regionsVisibility);
        activeFrame?.regionSet.setLocked(this.regionsVisibility === RegionsOpacity.Invisible);
        ev.stopPropagation();
    };

    private handleFocusClicked = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>, region: RegionStore) => {
        region.focusCenter();
        ev.stopPropagation();
    };

    private handleRegionExportClicked = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>, region: RegionStore) => {
        ev.stopPropagation();
        const regionSet = AppStore.Instance.activeFrame?.regionSet;
        const isRegionInMultiSelection = !!regionSet && regionSet.selectedRegionIds.has(region.regionId) && regionSet.selectedRegionsList.length > 1;
        if (isRegionInMultiSelection) {
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
        const selectedCount = AppStore.Instance.activeFrame?.regionSet.selectedRegionsList.length ?? 0;
        if (selectedCount > 1) {
            FileBrowserStore.Instance.showExportSelectedRegions();
        } else {
            FileBrowserStore.Instance.showExportRegions();
        }
    };

    private handleRegionListDoubleClick = (region?: RegionStore) => {
        const regionSet = AppStore.Instance.activeFrame?.regionSet;
        if (!regionSet) {
            return;
        }

        const isMultiSelected = region ? regionSet.selectedRegionIds.has(region.regionId) && regionSet.selectedRegionsList.length > 1 : regionSet.selectedRegionsList.length > 1;
        if (!isMultiSelected && region && region.regionId !== CURSOR_REGION_ID) {
            regionSet.selectSingleRegion(region);
        }
        DialogStore.Instance.showDialog(isMultiSelected ? DialogId.GroupRegion : DialogId.Region);
    };

    private handleRegionContextMenu = (ev: React.MouseEvent<HTMLDivElement>, region: RegionStore) => {
        ev.preventDefault();
        ev.stopPropagation();

        const appStore = AppStore.Instance;
        const regionSet = appStore.activeFrame?.regionSet;
        if (!regionSet) {
            return;
        }

        if (!regionSet.selectedRegionIds.has(region.regionId)) {
            regionSet.selectSingleRegion(region);
            this.rowPivotIndex = this.validRegions.findIndex(validRegion => validRegion.regionId === region.regionId);
        } else {
            regionSet.selectRegion(region);
        }

        const selectedRegions = regionSet.selectedRegionsList;
        const isMultiSelected = selectedRegions.length > 1;
        const allLocked = regionSet.selectedRegionsAllLocked;
        const selectedRegionsVisibility = regionSet.selectedRegionsVisibility;
        const hasVisibleSelectedRegions = selectedRegionsVisibility !== RegionsOpacity.Invisible;
        const lockDisabled = regionSet.locked || selectedRegionsVisibility === RegionsOpacity.Invisible;
        const showLockedIcon = lockDisabled || allLocked;
        const title = isMultiSelected ? `${selectedRegions.length} regions selected` : region.nameString;

        showContextMenu({
            content: (
                <Menu>
                    <MenuDivider title={title} />
                    <MenuItem
                        icon={showLockedIcon ? "lock" : "unlock"}
                        text={showLockedIcon ? "Unlock" : "Lock"}
                        disabled={lockDisabled}
                        onClick={() => {
                            if (isMultiSelected) {
                                regionSet.toggleSelectedRegionsLocked();
                            } else {
                                region.toggleLock();
                            }
                        }}
                    />
                    <MenuItem
                        icon={<Icon icon={hasVisibleSelectedRegions ? "eye-open" : "eye-off"} style={{opacity: selectedRegionsVisibility === RegionsOpacity.SemiTransparent ? 0.3 : 1}} />}
                        text={hasVisibleSelectedRegions ? "Hide" : "Show"}
                        onClick={() => {
                            regionSet.toggleSelectedRegionsVisibility();
                        }}
                    />
                    {!isMultiSelected && <MenuItem icon={<CustomIcon icon="center" />} text="Focus" onClick={() => region.focusCenter()} />}
                    <MenuItem
                        icon="cloud-upload"
                        text={isMultiSelected ? "Export regions" : "Export region"}
                        onClick={() => {
                            if (isMultiSelected) {
                                FileBrowserStore.Instance.showExportSelectedRegions();
                            } else {
                                FileBrowserStore.Instance.showExportRegions(region.regionId);
                            }
                        }}
                    />
                    <MenuDivider />
                    <MenuItem icon="settings" text="Region Settings" onClick={() => DialogStore.Instance.showDialog(isMultiSelected ? DialogId.GroupRegion : DialogId.Region)} />
                    <MenuDivider />
                    <MenuItem
                        icon="trash"
                        intent="danger"
                        text="Delete"
                        onClick={() => {
                            if (isMultiSelected) {
                                appStore.deleteSelectedRegion();
                            } else {
                                appStore.deleteRegion(region);
                            }
                        }}
                    />
                </Menu>
            ),
            targetOffset: {left: ev.clientX, top: ev.clientY},
            isDarkTheme: appStore.darkTheme
        });
    };

    private scrollToRegionId = (regionId: number) => {
        const validIndex = this.validRegions.findIndex(region => region.regionId === regionId);
        if (validIndex >= 0) {
            this.scrollToSelected(validIndex);
        }
    };

    private getKeyboardNavigationList = (includeCursor: boolean): RegionStore[] => {
        return includeCursor ? this.validRegions : this.validRegions.filter(region => region.regionId !== CURSOR_REGION_ID);
    };

    private getPivotIndex = (list: RegionStore[], focusedIndex: number, direction: number): number => {
        let pivotIndex = -1;

        if (this.rowPivotIndex >= 0) {
            const pivotRegion = this.validRegions[this.rowPivotIndex];
            if (pivotRegion) {
                pivotIndex = list.findIndex(region => region.regionId === pivotRegion.regionId);
            }
        }

        if (pivotIndex >= 0 && pivotIndex < list.length) {
            return pivotIndex;
        }

        if (focusedIndex >= 0) {
            return focusedIndex;
        }

        return direction > 0 ? 0 : list.length - 1;
    };

    private getKeyboardStartIndex = (focusedIndex: number, direction: number, listLength: number): number => {
        if (focusedIndex >= 0) {
            return focusedIndex;
        }

        return direction > 0 ? -1 : listLength;
    };

    private getRegionIdsInRange = (regions: RegionStore[], startIndex: number, endIndex: number): number[] => {
        const ids: number[] = [];
        for (let i = startIndex; i <= endIndex; i++) {
            const region = regions[i];
            if (region) {
                ids.push(region.regionId);
            }
        }
        return ids;
    };

    private handleRangeKeyboardSelection = (regionSet: FrameStore["regionSet"], list: RegionStore[], focusedIndex: number, direction: number, isArrowUp: boolean) => {
        if ((isArrowUp && focusedIndex <= 0) || (!isArrowUp && focusedIndex >= list.length - 1)) {
            if (focusedIndex >= 0) {
                this.scrollToRegionId(list[focusedIndex]?.regionId);
            }
            return;
        }

        const pivotIndex = this.getPivotIndex(list, focusedIndex, direction);
        this.rowPivotIndex = this.validRegions.findIndex(region => region.regionId === list[pivotIndex]?.regionId);

        const startIndex = this.getKeyboardStartIndex(focusedIndex, direction, list.length);
        const nextIndex = clamp(startIndex + direction, 0, list.length - 1);
        const rangeStart = Math.min(pivotIndex, nextIndex);
        const rangeEnd = Math.max(pivotIndex, nextIndex);
        const selectedIds = this.getRegionIdsInRange(list, rangeStart, rangeEnd);
        const nextRegionId = list[nextIndex]?.regionId;

        regionSet.setSelectionByIds(selectedIds, nextRegionId);
        this.scrollToRegionId(nextRegionId);
    };

    private handleSingleKeyboardSelection = (regionSet: FrameStore["regionSet"], list: RegionStore[], focusedIndex: number, direction: number, shouldWrap: boolean) => {
        const startIndex = this.getKeyboardStartIndex(focusedIndex, direction, list.length);
        const nextIndex = shouldWrap ? (startIndex + direction + list.length) % list.length : clamp(startIndex + direction, 0, list.length - 1);
        const region = list[nextIndex];
        if (!region) {
            return;
        }

        regionSet.selectSingleRegion(region);
        this.rowPivotIndex = this.validRegions.findIndex(validRegion => validRegion.regionId === region.regionId);
        if (this.rowPivotIndex >= 0) {
            this.scrollToSelected(this.rowPivotIndex);
        }
    };

    // When the Region List has focus, arrow keys navigate selection instead of moving regions
    @action private handleKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>) => {
        const appStore = AppStore.Instance;
        const regionSet = appStore.activeFrame?.regionSet;
        if (!regionSet) {
            return;
        }

        const key = ev.key;
        const isArrowVertical = key === "ArrowUp" || key === "ArrowDown";
        const isArrowHorizontal = key === "ArrowLeft" || key === "ArrowRight";
        if (!isArrowVertical && !isArrowHorizontal) {
            return;
        }

        ev.preventDefault();
        ev.stopPropagation();

        if (isArrowHorizontal) {
            return;
        }

        const isArrowUp = key === "ArrowUp";
        const noModifier = !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey;
        const direction = isArrowUp ? -1 : 1;
        const list = this.getKeyboardNavigationList(noModifier);
        if (list.length === 0) {
            return;
        }

        const focusedId = regionSet.selectedRegion?.regionId ?? -1;
        const focusedIndex = list.findIndex(region => region.regionId === focusedId);

        if (ev.shiftKey) {
            this.handleRangeKeyboardSelection(regionSet, list, focusedIndex, direction, isArrowUp);
        } else {
            this.handleSingleKeyboardSelection(regionSet, list, focusedIndex, direction, noModifier);
        }
    };

    private handleRegionDeleteClicked = async () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        if (!frame) {
            return;
        }

        const confirmed = await appStore.alertStore.showInteractiveAlert("Are you sure you want to delete all regions?");
        if (confirmed) {
            appStore.deleteAllRegions();
        }
    };

    @action private handleRowClicked = (event: React.MouseEvent, region: RegionStore, index: number) => {
        const frame = AppStore.Instance.activeFrame;
        if (!frame) {
            return;
        }

        const isCtrlPressed = event.ctrlKey || event.metaKey;
        const isShiftPressed = event.shiftKey;
        const regionSet = frame.regionSet;
        const current = new Set(regionSet.selectedRegionIds);

        if (event.detail > 1 && !isCtrlPressed && !isShiftPressed) {
            this.handleRegionListDoubleClick(region);
            return;
        }

        if (isCtrlPressed && current.size > 0) {
            regionSet.toggleRegionSelection(region);
        } else if (isShiftPressed && current.size > 0 && this.rowPivotIndex >= 0) {
            const start = Math.min(this.rowPivotIndex, index);
            const end = Math.max(this.rowPivotIndex, index);
            regionSet.setSelectionByIds(this.getRegionIdsInRange(this.validRegions, start, end), region.regionId);
        } else {
            regionSet.selectSingleRegion(region);
            this.rowPivotIndex = index;
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
        const darkTheme = appStore.darkTheme;

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
            const _visible = region.visible;
            const _opacity = region.opacity;
            /* eslint-enable @typescript-eslint/no-unused-vars */
        }

        const selectedRegion = frame.regionSet.selectedRegion;

        // openOnTargetFocus={false} is to prevent the tooltip popup after the warning message.
        const floatRenderer = () => {
            const exportTooltip = frame.regionSet.selectedRegionsList.length > 1 ? "Export selected regions" : "Export all regions";
            return (
                <ButtonGroup className="float" style={{width: RegionListComponent.ACTIONS_COLUMN_DEFAULT_WIDTH}}>
                    <Tooltip content="Delete all regions" position={Position.TOP_LEFT} openOnTargetFocus={false}>
                        <AnchorButton icon={"trash"} onClick={this.handleRegionDeleteClicked} style={{cursor: "pointer"}} disabled={this.validRegions.length <= 1} />
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

        const headerRenderer = (regionsVisibility: RegionsOpacity) => {
            return (props: {index: number; style: CSSProperties}) => {
                const className = classNames("row-header", {[Classes.DARK]: darkTheme});
                const lockDisabled = regionsVisibility === RegionsOpacity.Invisible;
                const allRegionsLocked = frame.regionSet.editableRegionsAllLocked;
                const showLockedIcon = allRegionsLocked || lockDisabled;
                const lockIcon = showLockedIcon ? "lock" : "unlock";
                const lockTooltip = showLockedIcon ? "Unlock all regions" : "Lock all regions";

                return (
                    <div className={className} style={props.style}>
                        <div className="cell" style={{width: RegionListComponent.ACTIONS_COLUMN_DEFAULT_WIDTH, justifyContent: "center", gap: 8}}>
                            <Tooltip disabled={lockDisabled} content={lockTooltip} position={Position.BOTTOM}>
                                <Icon icon={lockIcon} onClick={lockDisabled ? undefined : ev => this.handleAllRegionsLockClicked(ev)} style={{cursor: "pointer", opacity: lockDisabled ? 0.3 : 1}} />
                            </Tooltip>
                            <Tooltip content={regionsVisibility === RegionsOpacity.Invisible ? "Show all regions" : "Hide all regions"} position={Position.BOTTOM}>
                                <Icon
                                    icon={regionsVisibility === RegionsOpacity.Invisible ? "eye-off" : "eye-open"}
                                    onClick={this.handleToggleHideClicked}
                                    style={{cursor: "pointer", opacity: regionsVisibility === RegionsOpacity.SemiTransparent ? 0.3 : 1}}
                                />
                            </Tooltip>
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
            const isActive = selectedRegion?.regionId === region.regionId;
            const isSecondarySelected = !isActive && frame.regionSet.selectedRegionIds.has(region.regionId);
            const className = classNames("row", {
                [Classes.DARK]: darkTheme,
                active: isActive,
                selected: isSecondarySelected
            });

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
                <div className="cell" style={{width: RegionListComponent.CENTER_COLUMN_DEFAULT_WIDTH}}>
                    {centerContent}
                </div>
            );

            let sizeEntry: React.ReactNode;
            if (showSizeColumn) {
                let sizeContent: React.ReactNode;
                if (region.size) {
                    if (frame.validWcs) {
                        sizeContent =
                            region.regionType === CARTA.RegionType.LINE || region.regionType === CARTA.RegionType.ANNLINE || region.regionType === CARTA.RegionType.ANNVECTOR || region.regionType === CARTA.RegionType.ANNRULER ? (
                                formattedArcsec(region.wcsSize ? length2D(region.wcsSize) : Number.NaN, WCS_PRECISION)
                            ) : (
                                <React.Fragment>
                                    {formattedArcsec(region.wcsSize?.x, WCS_PRECISION)}
                                    <br />
                                    {formattedArcsec(region.wcsSize?.y, WCS_PRECISION)}
                                </React.Fragment>
                            );
                    } else {
                        if (region.regionType === CARTA.RegionType.LINE) {
                            sizeContent = toFixed(region.size ? length2D(region.size) : Number.NaN, 1);
                        } else {
                            sizeContent = `(${toFixed(region.size.x, 1)}, ${toFixed(region.size.y, 1)})`;
                        }
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
                    <div className="cell" style={{width: RegionListComponent.SIZE_COLUMN_DEFAULT_WIDTH}}>
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
                const lockDisabled = regionSet.locked || this.regionsVisibility === RegionsOpacity.Invisible || region.opacity === RegionsOpacity.Invisible;
                const lockIcon = region.locked || this.regionsVisibility === RegionsOpacity.Invisible || region.opacity === RegionsOpacity.Invisible ? "lock" : "unlock";
                const lockTooltip = lockIcon === "lock" ? "Unlock region" : "Lock region";
                lockEntry = (
                    <div
                        className="cell"
                        style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH}}
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
                    <div className="cell" style={{width: RegionListComponent.ACTIONS_COLUMN_DEFAULT_WIDTH}}>
                        <Icon icon={"blank"} />
                        <Icon icon={"blank"} />
                        <Icon icon={"blank"} />
                        <Icon icon={"blank"} />
                    </div>
                );
            }

            let hideEntry: React.ReactNode;
            if (region.regionId) {
                const regionVisible = region.opacity !== RegionsOpacity.Invisible;
                hideEntry = (
                    <div className="cell" style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH}} onClick={ev => this.handleRegionHideClicked(ev, region)} onDoubleClick={this.stopDoubleClickPropagation}>
                        <Tooltip content={regionVisible ? "Hide region" : "Show region"} position={Position.BOTTOM}>
                            <Icon icon={regionVisible ? "eye-open" : "eye-off"} style={{opacity: region.opacity === RegionsOpacity.SemiTransparent ? 0.3 : 1}} />
                        </Tooltip>
                    </div>
                );
            }

            let focusEntry: React.ReactNode;
            if (region.regionId) {
                focusEntry = (
                    <div
                        className="cell"
                        style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH}}
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
                    <div className="cell" style={{width: RegionListComponent.ACTION_COLUMN_DEFAULT_WIDTH}} onClick={ev => this.handleRegionExportClicked(ev, region)} onDoubleClick={this.stopDoubleClickPropagation}>
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
                    onClick={ev => this.handleRowClicked(ev, region, props.index)}
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
                    <div className="cell" style={{width: RegionListComponent.TYPE_COLUMN_DEFAULT_WIDTH}}>
                        {RegionStore.RegionTypeString(region.regionType)}
                    </div>
                    {centerEntry}
                    {showSizeColumn && sizeEntry}
                    {showRotationColumn && (
                        <div className="cell" style={{width: RegionListComponent.ROTATION_COLUMN_DEFAULT_WIDTH}}>
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
                            rowHeight={RegionListComponent.HEADER_ROW_HEIGHT}
                            defaultHeight={RegionListComponent.HEADER_ROW_HEIGHT}
                            rowCount={1}
                            style={{height: RegionListComponent.HEADER_ROW_HEIGHT, width: "100%"}}
                            className="list-header"
                            rowComponent={headerRenderer(this.regionsVisibility)}
                            rowProps={{} as any}
                        />
                        <List
                            onRowsRendered={this.onListRendered}
                            defaultHeight={tableHeight - RegionListComponent.HEADER_ROW_HEIGHT - padding * 2}
                            rowCount={this.validRegions.length}
                            rowHeight={RegionListComponent.ROW_HEIGHT}
                            style={{height: tableHeight - RegionListComponent.HEADER_ROW_HEIGHT - padding * 2, width: "100%"}}
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
