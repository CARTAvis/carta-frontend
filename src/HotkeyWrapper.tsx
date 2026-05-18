import * as React from "react";
import {Classes, Dialog, Hotkey, Hotkeys, useHotkeys} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {BrowserMode, DialogId, ImageViewLayer, RegionMode, RegionsOpacity} from "enums";
import {AppStore} from "stores";
import {CURSOR_REGION_ID, RegionSetStore} from "stores/Frame";

import "./HotkeyWrapper.scss";

@observer
export class HotkeyService extends React.Component<{}> {
    public render() {
        const appStore = AppStore.Instance;
        const className = classNames(Classes.HOTKEY_DIALOG, {[Classes.DARK]: appStore.darkTheme});

        return (
            <Dialog
                portalClassName="dialog-portal"
                isOpen={appStore.dialogStore.dialogVisible.get(DialogId.Hotkey)}
                className={classNames(className, "hotkeys-dialog")}
                canEscapeKeyClose={true}
                canOutsideClickClose={true}
                onClose={() => appStore.dialogStore.hideDialog(DialogId.Hotkey)}
            >
                <div className={Classes.DIALOG_BODY}>
                    <div className="hotkeys-grid">{HotkeyService.RenderHotkeyGroups()}</div>
                </div>
            </Dialog>
        );
    }

    static NextChannel = () => {
        const appStore = AppStore.Instance;
        const region = appStore.activeFrame?.regionSet.focusedRegion;
        if (region && region.regionId !== CURSOR_REGION_ID) {
            return;
        }

        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(1, 0);
        }
    };

    static PrevChannel = () => {
        const appStore = AppStore.Instance;
        const region = appStore.activeFrame?.regionSet.focusedRegion;
        if (region && region.regionId !== CURSOR_REGION_ID) {
            return;
        }
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(-1, 0);
        }
    };

    static NextStokes = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(0, 1);
        }
    };

    static PrevStokes = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(0, -1);
        }
    };

    static ToggleDarkTheme = () => {
        const appStore = AppStore.Instance;
        if (appStore.darkTheme) {
            appStore.setLightTheme();
        } else {
            appStore.setDarkTheme();
        }
    };

    static ToggleCreateMode = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            appStore.toggleActiveLayer();
            appStore.activeFrame.regionSet.toggleMode();
        }
    };

    static ToggleRegionLock = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            const regionSet = appStore.activeFrame.regionSet;
            if (regionSet.locked) {
                return;
            }

            if (regionSet.selectedRegionsList.length > 0) {
                regionSet.toggleSelectedRegionsLocked();
                return;
            }

            if (regionSet.focusedRegion && regionSet.focusedRegion.regionId !== CURSOR_REGION_ID && regionSet.focusedRegion.opacity !== RegionsOpacity.Invisible) {
                regionSet.focusedRegion.toggleLock();
            }
        }
    };

    static ToggleRegionVisibility = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            const regionSet = appStore.activeFrame.regionSet;

            if (regionSet.selectedRegionsList.length > 0) {
                regionSet.toggleSelectedRegionsVisibility();
                return;
            }

            if (regionSet.focusedRegion && regionSet.focusedRegion.regionId !== CURSOR_REGION_ID) {
                regionSet.focusedRegion.setOpacity(RegionSetStore.NextOpacity(regionSet.focusedRegion.opacity));
            }
        }
    };

    static UnlockAllRegions = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            const regionSet = appStore.activeFrame.regionSet;
            if (regionSet.locked) {
                return;
            }
            for (const region of regionSet.regions) {
                if (region.opacity !== RegionsOpacity.Invisible) {
                    region.setLocked(false);
                }
            }
        }
    };

    static HandleRegionEsc = () => {
        const appStore = AppStore.Instance;
        const regionSet = appStore.activeFrame?.regionSet;
        if (!regionSet) {
            return;
        }

        const selectedRegion = regionSet.focusedRegion;
        if (selectedRegion?.hasSelectedPoint) {
            selectedRegion.deselectPoint();
            return;
        }

        if (regionSet.selectedRegionCount > 0) {
            regionSet.clearSelection();
            return;
        }

        if (selectedRegion && selectedRegion.regionId !== CURSOR_REGION_ID) {
            regionSet.deselectRegion();
        } else if (!selectedRegion && regionSet.mode === RegionMode.CREATING) {
            regionSet.setMode(RegionMode.MOVING);
            appStore.updateActiveLayer(ImageViewLayer.RegionMoving);
        }
    };

    static EnterPointSelection = () => {
        const appStore = AppStore.Instance;
        const regionSet = appStore.activeFrame?.regionSet;
        if (!regionSet?.focusedRegion || regionSet.selectedRegionCount > 1) {
            return;
        }

        const region = regionSet.focusedRegion;
        if (region.supportsPointSelection && !region.hasSelectedPoint) {
            region.selectPoint(0);
        }
    };

    static SelectNextRegionOrPoint = () => {
        const appStore = AppStore.Instance;
        const regionSet = appStore.activeFrame?.regionSet;
        if (!regionSet) {
            return;
        }

        const selectedRegion = regionSet.focusedRegion;
        if (selectedRegion?.hasSelectedPoint) {
            selectedRegion.selectNextPoint();
        } else {
            regionSet.selectNextRegion();
        }
    };

    static SelectPreviousRegionOrPoint = () => {
        const appStore = AppStore.Instance;
        const regionSet = appStore.activeFrame?.regionSet;
        if (!regionSet) {
            return;
        }

        const selectedRegion = regionSet.focusedRegion;
        if (selectedRegion?.hasSelectedPoint) {
            selectedRegion.selectPreviousPoint();
        } else {
            regionSet.selectPreviousRegion();
        }
    };

    static MoveSelectedRegion = (deltaX: number, deltaY: number, acceleratedMultiplier: number) => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const region = frame?.regionSet.focusedRegion;
        if (!frame || !region || region.regionId === CURSOR_REGION_ID) {
            return;
        }

        const zoomMultiplier = Math.max(1, 1 / frame.zoomLevel);
        const actualDeltaX = deltaX * acceleratedMultiplier * zoomMultiplier;
        const actualDeltaY = deltaY * acceleratedMultiplier * zoomMultiplier;
        const canEditSelectedPoint = frame.regionSet.selectedRegionCount <= 1 && region.supportsPointSelection;

        if (canEditSelectedPoint && region.hasSelectedRotationPoint) {
            region.rotateSelectedPoint((deltaX * acceleratedMultiplier) / 10);
            return;
        }

        if (canEditSelectedPoint && region.isCompassRegion && region.hasSelectedPoint) {
            region.moveSelectedPoint((deltaX * acceleratedMultiplier) / 10, 0);
            return;
        }

        if (canEditSelectedPoint && region.hasSelectedPoint) {
            region.moveSelectedPoint(actualDeltaX, actualDeltaY);
        } else {
            frame.regionSet.translateMovingRegionSelection(region, {x: actualDeltaX, y: actualDeltaY});
        }
    };

    // For display in custom hotkeys dialog
    static NavigationDisplayHotkeys() {
        const base = {group: "Navigation", global: true};
        const items = [
            {combo: "click", label: "Pan image"},
            {combo: "middle-click", label: "Pan image (inside region)"},
            {combo: "mod + click", label: "Pan image (inside region)"},
            {combo: "mouse-wheel", label: "Zoom image"}
        ];
        return items.map(item => ({...base, ...item}));
    }

    // For display in custom hotkeys dialog
    static RegionDisplayHotkeys() {
        const base = {group: "Regions", global: true};
        const items = [
            {combo: "l", label: "Toggle selected region(s) lock"},
            {combo: "h", label: "Toggle selected region(s) visibility"},
            {combo: "shift + l", label: "Unlock all regions"},
            {combo: "delete", label: "Delete selected region(s)"},
            {combo: "backspace", label: "Delete selected region(s)"},
            {combo: "double-click", label: "Region properties"}
        ];
        return items.map(item => ({...base, ...item}));
    }

    // For display in custom hotkeys dialog
    static RegionImageViewerDisplayHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const base = {group: "Regions (Image Viewer)", global: true};
        const items = [
            {combo: "c", label: "Toggle region creation mode"},
            {combo: "mod", label: "Switch region creation mode"},
            {combo: "shift", label: "Symmetric region creation"},
            {combo: "shift + drag", label: "Toggle region box selection"},
            {combo: "esc", label: "Deselect region/point or cancel creation"},
            {combo: "enter", label: "Enter point selection mode"},
            {combo: "tab", label: "Select next region/point"},
            {combo: "shift + tab", label: "Select previous region/point"},
            {combo: "up", label: "Move region/point (↑ ↓ ← →)"},
            {combo: "shift + up", label: "Coarse move (↑ ↓ ← →)"},
            {combo: `${modString}up`, label: "Fine move (1 pixel, ↑ ↓ ← →)"}
        ];
        return items.map(item => ({...base, ...item}));
    }

    // For display in custom hotkeys dialog
    static RegionListDisplayHotkeys() {
        const base = {group: "Regions (Region List)", global: true};
        const items = [
            {combo: "click", label: "Select region"},
            {combo: "mod + click", label: "Toggle region selection"},
            {combo: "shift + click", label: "Select region range"},
            {combo: "up", label: "Select previous region"},
            {combo: "down", label: "Select next region"},
            {combo: "shift + up", label: "Extend selection upward"},
            {combo: "shift + down", label: "Extend selection downward"},
            {combo: "right-click", label: "Region context menu"}
        ];
        return items.map(item => ({...base, ...item}));
    }

    static RegionHotkeys() {
        const base = {group: "Regions", global: true, allowInInput: false, preventDefault: true};
        const items = [
            {combo: "c", label: "Toggle region creation mode", onKeyDown: HotkeyService.ToggleCreateMode},
            {combo: "l", label: "Toggle selected region(s) lock", onKeyDown: HotkeyService.ToggleRegionLock},
            {combo: "h", label: "Toggle selected region(s) visibility", onKeyDown: HotkeyService.ToggleRegionVisibility},
            {combo: "shift + l", label: "Unlock all regions", onKeyDown: HotkeyService.UnlockAllRegions},
            {combo: "delete", label: "Delete selected region(s)", onKeyDown: HotkeyService.ConfirmDeleteRegions},
            {combo: "backspace", label: "Delete selected region(s)", onKeyDown: HotkeyService.ConfirmDeleteRegions},
            {combo: "esc", label: "Deselect region/point or cancel creation", onKeyDown: HotkeyService.HandleRegionEsc},
            {combo: "enter", label: "Enter point selection mode", onKeyDown: HotkeyService.EnterPointSelection},
            {combo: "tab", label: "Select next region/point", preventDefault: false, onKeyDown: (e: KeyboardEvent) => HotkeyService.HandleTab(e, HotkeyService.SelectNextRegionOrPoint)},
            {combo: "shift + tab", label: "Select previous region/point", preventDefault: false, onKeyDown: (e: KeyboardEvent) => HotkeyService.HandleTab(e, HotkeyService.SelectPreviousRegionOrPoint)}
        ];
        return items.map(item => ({...base, ...item}));
    }

    // Only handle Tab/Shift+Tab when there is an active non-cursor region
    static HandleTab(e: KeyboardEvent, action: () => void) {
        const region = AppStore.Instance.activeFrame?.regionSet.focusedRegion;
        if (!region || region.regionId === CURSOR_REGION_ID) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        action();
    }

    static ConfirmDeleteRegions = async () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const regionSet = frame?.regionSet;
        if (!frame || !regionSet) return;

        // Only show confirmation when Region List has focus; otherwise delete immediately
        const activeEl = (document?.activeElement as Element) || null;
        const isRegionListFocused = !!activeEl && !!activeEl.closest(".region-list-table");
        const isSelectedRegionDeletionHandled = appStore.deleteSelectedRegions();
        if (!isRegionListFocused || isSelectedRegionDeletionHandled) {
            return;
        }

        const hasDeletableRegions = regionSet.regions.some(r => r.regionId !== CURSOR_REGION_ID);
        if (!hasDeletableRegions) return;

        // No explicit selection; confirm deleting all regions
        const confirmed = await appStore.alertStore.showInteractiveAlert("Are you sure you want to delete all regions?");
        if (confirmed) {
            appStore.deleteAllRegions();
        }
    };

    static RegionHiddenHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const base = {group: "Regions", global: true, allowInInput: false, preventDefault: true};
        const fineMoveMultiplier = 1;
        const normalMoveMultiplier = 10;
        const coarseMoveMultiplier = 100;
        const items = [
            {combo: `${modString}up`, label: "Move selected region up (fine)", onKeyDown: () => HotkeyService.MoveSelectedRegion(0, 1, fineMoveMultiplier)},
            {combo: `${modString}down`, label: "Move selected region down (fine)", onKeyDown: () => HotkeyService.MoveSelectedRegion(0, -1, fineMoveMultiplier)},
            {combo: `${modString}left`, label: "Move selected region left (fine)", onKeyDown: () => HotkeyService.MoveSelectedRegion(-1, 0, fineMoveMultiplier)},
            {combo: `${modString}right`, label: "Move selected region right (fine)", onKeyDown: () => HotkeyService.MoveSelectedRegion(1, 0, fineMoveMultiplier)},
            {combo: "up", label: "Move selected region up", onKeyDown: () => HotkeyService.MoveSelectedRegion(0, 1, normalMoveMultiplier)},
            {combo: "down", label: "Move selected region down", onKeyDown: () => HotkeyService.MoveSelectedRegion(0, -1, normalMoveMultiplier)},
            {combo: "left", label: "Move selected region left", onKeyDown: () => HotkeyService.MoveSelectedRegion(-1, 0, normalMoveMultiplier)},
            {combo: "right", label: "Move selected region right", onKeyDown: () => HotkeyService.MoveSelectedRegion(1, 0, normalMoveMultiplier)},
            {combo: "shift + up", label: "Move selected region up (coarse)", onKeyDown: () => HotkeyService.MoveSelectedRegion(0, 1, coarseMoveMultiplier)},
            {combo: "shift + down", label: "Move selected region down (coarse)", onKeyDown: () => HotkeyService.MoveSelectedRegion(0, -1, coarseMoveMultiplier)},
            {combo: "shift + left", label: "Move selected region left (coarse)", onKeyDown: () => HotkeyService.MoveSelectedRegion(-1, 0, coarseMoveMultiplier)},
            {combo: "shift + right", label: "Move selected region right (coarse)", onKeyDown: () => HotkeyService.MoveSelectedRegion(1, 0, coarseMoveMultiplier)}
        ];
        return items.map(item => ({...base, ...item}));
    }

    static FrameControlHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const base = {group: "Frame controls", global: true, allowInInput: false, preventDefault: true};
        const items = [
            {combo: `${modString}]`, label: "Next image", onKeyDown: appStore.nextImage},
            {combo: `${modString}[`, label: "Previous image", onKeyDown: appStore.prevImage},
            {combo: `${modString}up`, label: "Next channel", onKeyDown: HotkeyService.NextChannel},
            {combo: `${modString}down`, label: "Previous channel", onKeyDown: HotkeyService.PrevChannel},
            {combo: `${modString}shift + up`, label: "Next Stokes cube", onKeyDown: HotkeyService.NextStokes},
            {combo: `${modString}shift + down`, label: "Previous Stokes cube", onKeyDown: HotkeyService.PrevStokes}
        ];
        return items.map(item => ({...base, ...item}));
    }

    // Hidden hotkeys for input method compatibility
    static FrameControlHiddenHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const base = {group: "Frame controls", global: true, allowInInput: false, preventDefault: true};
        const items = [
            {combo: `${modString}‘`, label: "Next image", onKeyDown: appStore.nextImage},
            {combo: `${modString}“`, label: "Previous image", onKeyDown: appStore.prevImage}
        ];
        return items.map(item => ({...base, ...item}));
    }

    static FileControlHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const base = {group: "File controls", global: true, allowInInput: false, preventDefault: true};
        const items = [
            {combo: `${modString}O`, label: "Open image", onKeyDown: () => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File)},
            {combo: `${modString}L`, label: "Append image", onKeyDown: () => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File, true)},
            {combo: `${modString}W`, label: "Close image", onKeyDown: () => appStore.closeCurrentFile(true)},
            {combo: `${modString}S`, label: "Save image", onKeyDown: () => appStore.fileBrowserStore.showFileBrowser(BrowserMode.SaveFile, false)},
            {combo: `${modString}G`, label: "Import catalog", onKeyDown: () => appStore.fileBrowserStore.showFileBrowser(BrowserMode.Catalog, false)},
            {combo: `${modString}E`, label: "Export image", onKeyDown: () => appStore.exportImage(1)}
        ];
        return items.map(item => ({...base, ...item}));
    }

    static OtherHotkeys() {
        const appStore = AppStore.Instance;
        const base = {group: "Other", global: true, allowInInput: false, preventDefault: true};
        const items = [
            {combo: "shift + d", label: "Toggle light/dark theme", onKeyDown: HotkeyService.ToggleDarkTheme},
            {combo: "f", label: "Freeze/unfreeze cursor position", onKeyDown: appStore.toggleCursorFrozen},
            {combo: "g", label: "Mirror cursor on multipanel view", onKeyDown: appStore.toggleCursorMirror}
        ];
        return items.map(item => ({...base, ...item}));
    }

    // For display in custom hotkeys dialog
    static GetHotkeyDefinitionsForDisplay() {
        const toElements = (hotkeys: any[]) =>
            hotkeys.map((hotkey, index) => {
                return <Hotkey key={index} group={hotkey.group} global={hotkey.global} combo={hotkey.combo} label={hotkey.label} onKeyDown={hotkey.onKeyDown} />;
            });

        // Navigation
        const navigationHotKeys: React.ReactElement[] = toElements(HotkeyService.NavigationDisplayHotkeys());

        // Regions
        const regionHotKeys: React.ReactElement[] = toElements(HotkeyService.RegionDisplayHotkeys());
        const regionImageViewerHotKeys: React.ReactElement[] = toElements(HotkeyService.RegionImageViewerDisplayHotkeys());
        const regionListHotKeys: React.ReactElement[] = toElements(HotkeyService.RegionListDisplayHotkeys());

        // Frame controls
        const animatorHotkeys: React.ReactElement[] = toElements(HotkeyService.FrameControlHotkeys());

        // File controls
        const fileHotkeys: React.ReactElement[] = toElements(HotkeyService.FileControlHotkeys());

        // Other
        const otherHotKeys: React.ReactElement[] = toElements(HotkeyService.OtherHotkeys());

        return {
            navigationHotKeys,
            regionHotKeys,
            regionImageViewerHotKeys,
            regionListHotKeys,
            animatorHotkeys,
            fileHotkeys,
            otherHotKeys
        };
    }

    static RenderHotkeyGroups() {
        const hotkeys = HotkeyService.GetHotkeyDefinitionsForDisplay();
        const hotkeyGroups = [hotkeys.navigationHotKeys, hotkeys.fileHotkeys, hotkeys.animatorHotkeys, hotkeys.regionHotKeys, hotkeys.regionImageViewerHotKeys, hotkeys.regionListHotKeys, hotkeys.otherHotKeys];

        // Render each group; placement handled purely by CSS multi-column
        return hotkeyGroups.map((group, idx) => (
            <div className="hotkeys-item" key={`hotkeys-group-${idx}`}>
                <Hotkeys>{group}</Hotkeys>
            </div>
        ));
    }
}

export function HotkeysRegistrar() {
    const hotkeys = React.useMemo(
        () => [
            ...HotkeyService.FrameControlHotkeys(),
            ...HotkeyService.FrameControlHiddenHotkeys(),
            ...HotkeyService.RegionHotkeys(),
            ...HotkeyService.RegionHiddenHotkeys(),
            ...HotkeyService.FileControlHotkeys(),
            ...HotkeyService.OtherHotkeys()
        ],
        []
    );

    useHotkeys(hotkeys);

    // Directly handle Shift+? to open custom hotkeys dialog
    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            // Only handle if not in an editable element
            const target = event.target as Element;
            if (target && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.closest("input, textarea, [contenteditable]"))) {
                return;
            }

            if (event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey && (event.key === "?" || event.key === "/")) {
                event.preventDefault();
                event.stopPropagation();
                const currentAppStore = AppStore.Instance;
                if (!currentAppStore.dialogStore.dialogVisible.get(DialogId.Hotkey)) {
                    currentAppStore.dialogStore.showDialog(DialogId.Hotkey);
                }
            }
        };

        document.addEventListener("keydown", onKeyDown, true);
        return () => document.removeEventListener("keydown", onKeyDown, true);
    }, []);

    return null;
}
