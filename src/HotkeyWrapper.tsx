import * as React from "react";
import {Classes, Dialog, Hotkey, Hotkeys, useHotkeys} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {BrowserMode, DialogId, ImageViewLayer, RegionMode, RegionOpacity} from "enums";
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
                    <div className="hotkeys-grid">{HotkeyService.renderHotkeyGroups()}</div>
                </div>
            </Dialog>
        );
    }

    public static nextChannel = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(1, 0);
        }
    };

    public static prevChannel = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(-1, 0);
        }
    };

    public static nextStokes = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(0, 1);
        }
    };

    public static prevStokes = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(0, -1);
        }
    };

    public static toggleDarkTheme = () => {
        const appStore = AppStore.Instance;
        if (appStore.darkTheme) {
            appStore.setLightTheme();
        } else {
            appStore.setDarkTheme();
        }
    };

    public static toggleCreateMode = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            appStore.toggleActiveLayer();
            appStore.activeFrame.regionSet.toggleMode();
        }
    };

    public static toggleRegionLock = () => {
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

            if (regionSet.focusedRegion && regionSet.focusedRegion.regionId !== CURSOR_REGION_ID && regionSet.focusedRegion.opacity !== RegionOpacity.Invisible) {
                regionSet.focusedRegion.toggleLock();
            }
        }
    };

    public static toggleRegionVisibility = () => {
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

    public static showAllRegions = () => {
        const regionSet = AppStore.Instance.activeFrame?.regionSet;
        if (!regionSet) {
            return;
        }

        regionSet.setEditableRegionsOpacity(RegionOpacity.Visible);
    };

    public static unlockAllRegions = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            const regionSet = appStore.activeFrame.regionSet;
            if (regionSet.locked) {
                return;
            }
            for (const region of regionSet.regions) {
                if (region.opacity !== RegionOpacity.Invisible) {
                    region.setLocked(false);
                }
            }
        }
    };

    public static handleRegionEsc = () => {
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

        const noRegionFocused = !selectedRegion || selectedRegion.regionId === CURSOR_REGION_ID;
        if (!noRegionFocused) {
            regionSet.deselectRegion();
        } else if (regionSet.mode === RegionMode.CREATING) {
            regionSet.setMode(RegionMode.MOVING);
            appStore.updateActiveLayer(ImageViewLayer.RegionMoving);
        }
    };

    public static enterPointSelection = () => {
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

    public static selectNextRegionOrPoint = () => {
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

    public static selectPreviousRegionOrPoint = () => {
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

    public static moveSelectedRegion = (deltaX: number, deltaY: number, acceleratedMultiplier: number, scaleWithZoom: boolean = true) => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const region = frame?.regionSet.focusedRegion;
        if (!frame || !region || region.regionId === CURSOR_REGION_ID) {
            return;
        }

        const zoomMultiplier = scaleWithZoom ? Math.max(1, 1 / frame.zoomLevel) : 1;
        const actualDeltaX = deltaX * acceleratedMultiplier * zoomMultiplier;
        const actualDeltaY = deltaY * acceleratedMultiplier * zoomMultiplier;
        const canEditSelectedPoint = region.visible && !region.locked && frame.regionSet.selectedRegionCount <= 1 && region.supportsPointSelection;

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

    public static moveSelectedRegionOrChangeChannel = (deltaX: number, deltaY: number, channelDelta: number) => {
        const appStore = AppStore.Instance;
        const region = appStore.activeFrame?.regionSet.focusedRegion;
        if (region && region.regionId !== CURSOR_REGION_ID) {
            HotkeyService.moveSelectedRegion(deltaX, deltaY, 1, false);
        } else if (channelDelta > 0) {
            HotkeyService.nextChannel();
        } else {
            HotkeyService.prevChannel();
        }
    };

    // For display in custom hotkeys dialog
    public static navigationDisplayHotkeys() {
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
    public static regionDisplayHotkeys() {
        const base = {group: "Regions", global: true};
        const items = [
            {combo: "click", label: "Select region/point"},
            {combo: "mod + click", label: "Toggle region selection"},
            {combo: "shift + click", label: "Select region range"},
            {combo: "l", label: "Toggle selected region(s) lock"},
            {combo: "shift + l", label: "Unlock all regions"},
            {combo: "h", label: "Toggle selected region(s) visibility"},
            {combo: "shift + h", label: "Show all regions"},
            {combo: "double-click", label: "Region properties"},
            {combo: "delete", label: "Delete selected region(s)"},
            {combo: "backspace", label: "Delete selected region(s)"}
        ];
        return items.map(item => ({...base, ...item}));
    }

    // For display in custom hotkeys dialog
    public static regionImageViewerDisplayHotkeys() {
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
    public static regionListDisplayHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const base = {group: "Regions (Region List)", global: true};
        const items = [
            {combo: `${modString}a`, label: "Select all regions"},
            {combo: "up", label: "Select previous region"},
            {combo: "down", label: "Select next region"},
            {combo: "shift + up", label: "Extend selection upward"},
            {combo: "shift + down", label: "Extend selection downward"},
            {combo: "tab", label: "Select next region in selection"},
            {combo: "shift + tab", label: "Select previous region in selection"},
            {combo: "esc", label: "Deselect region(s)"},
            {combo: "enter", label: "Region properties"},
            {combo: "right-click", label: "Region context menu"}
        ];
        return items.map(item => ({...base, ...item}));
    }

    public static regionHotkeys() {
        const base = {group: "Regions", global: true, allowInInput: false, preventDefault: true};
        const items = [
            {combo: "c", label: "Toggle region creation mode", onKeyDown: HotkeyService.toggleCreateMode},
            {combo: "l", label: "Toggle selected region(s) lock", onKeyDown: HotkeyService.toggleRegionLock},
            {combo: "h", label: "Toggle selected region(s) visibility", onKeyDown: HotkeyService.toggleRegionVisibility},
            {combo: "shift + h", label: "Show all regions", onKeyDown: HotkeyService.showAllRegions},
            {combo: "shift + l", label: "Unlock all regions", onKeyDown: HotkeyService.unlockAllRegions},
            {combo: "delete", label: "Delete selected region(s)", onKeyDown: HotkeyService.confirmDeleteRegions},
            {combo: "backspace", label: "Delete selected region(s)", onKeyDown: HotkeyService.confirmDeleteRegions},
            {combo: "esc", label: "Deselect region/point or cancel creation", onKeyDown: HotkeyService.handleRegionEsc},
            {combo: "enter", label: "Enter point selection mode", onKeyDown: HotkeyService.enterPointSelection},
            {combo: "tab", label: "Select next region/point", preventDefault: false, onKeyDown: (e: KeyboardEvent) => HotkeyService.handleTab(e, HotkeyService.selectNextRegionOrPoint)},
            {combo: "shift + tab", label: "Select previous region/point", preventDefault: false, onKeyDown: (e: KeyboardEvent) => HotkeyService.handleTab(e, HotkeyService.selectPreviousRegionOrPoint)}
        ];
        return items.map(item => ({...base, ...item}));
    }

    // Only handle Tab/Shift+Tab when there is an active non-cursor region
    public static handleTab(e: KeyboardEvent, action: () => void) {
        const regionSet = AppStore.Instance.activeFrame?.regionSet;
        const region = regionSet?.focusedRegion;
        if (!region || region.regionId === CURSOR_REGION_ID) {
            return;
        }

        const activeEl = (document?.activeElement as Element) || null;
        const isRegionListFocused = !!activeEl && !!activeEl.closest(".region-list-table");
        if (isRegionListFocused && regionSet.selectedRegionCount <= 1) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        action();
    }

    public static confirmDeleteRegions = async () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const regionSet = frame?.regionSet;
        if (!frame || !regionSet) return;

        // Only show confirmation when Region List has focus; otherwise delete immediately
        const activeEl = (document?.activeElement as Element) || null;
        const isRegionListFocused = !!activeEl && !!activeEl.closest(".region-list-table");
        const isRegionDeleteHotkeyHandled = HotkeyService.tryHandleRegionDeleteHotkey();
        if (!isRegionListFocused || isRegionDeleteHotkeyHandled) {
            return;
        }

        const hasDeletableRegions = !regionSet.locked && regionSet.regions.some(r => r.regionId !== CURSOR_REGION_ID && !r.locked);
        if (!hasDeletableRegions) return;

        // No explicit selection; confirm deleting all regions
        const confirmed = await appStore.alertStore.showInteractiveAlert("Are you sure you want to delete all regions?");
        if (confirmed) {
            appStore.deleteAllRegions();
        }
    };

    public static tryHandleRegionDeleteHotkey = (): boolean => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const regionSet = frame?.regionSet;
        if (!frame || !regionSet) {
            return false;
        }

        if (regionSet.locked) {
            return true;
        }

        if (regionSet.selectedRegionIds?.size > 0) {
            appStore.deleteSelectedRegions();
            return true;
        }

        if (regionSet.focusedRegion && regionSet.focusedRegion.regionId !== CURSOR_REGION_ID) {
            appStore.deleteSelectedRegions();
            return true;
        }

        return false;
    };

    public static regionHiddenHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const base = {group: "Regions", global: true, allowInInput: false, preventDefault: true};
        const fineMoveMultiplier = 1;
        const normalMoveMultiplier = 10;
        const coarseMoveMultiplier = 100;
        const items = [
            // Fine up/down movement is handled by MoveSelectedRegionOrChangeChannel because those combos also change channels.
            {combo: `${modString}left`, label: "Move selected region left (fine)", onKeyDown: () => HotkeyService.moveSelectedRegion(-1, 0, fineMoveMultiplier, false)},
            {combo: `${modString}right`, label: "Move selected region right (fine)", onKeyDown: () => HotkeyService.moveSelectedRegion(1, 0, fineMoveMultiplier, false)},
            {combo: "up", label: "Move selected region up", onKeyDown: () => HotkeyService.moveSelectedRegion(0, 1, normalMoveMultiplier)},
            {combo: "down", label: "Move selected region down", onKeyDown: () => HotkeyService.moveSelectedRegion(0, -1, normalMoveMultiplier)},
            {combo: "left", label: "Move selected region left", onKeyDown: () => HotkeyService.moveSelectedRegion(-1, 0, normalMoveMultiplier)},
            {combo: "right", label: "Move selected region right", onKeyDown: () => HotkeyService.moveSelectedRegion(1, 0, normalMoveMultiplier)},
            {combo: "shift + up", label: "Move selected region up (coarse)", onKeyDown: () => HotkeyService.moveSelectedRegion(0, 1, coarseMoveMultiplier)},
            {combo: "shift + down", label: "Move selected region down (coarse)", onKeyDown: () => HotkeyService.moveSelectedRegion(0, -1, coarseMoveMultiplier)},
            {combo: "shift + left", label: "Move selected region left (coarse)", onKeyDown: () => HotkeyService.moveSelectedRegion(-1, 0, coarseMoveMultiplier)},
            {combo: "shift + right", label: "Move selected region right (coarse)", onKeyDown: () => HotkeyService.moveSelectedRegion(1, 0, coarseMoveMultiplier)}
        ];
        return items.map(item => ({...base, ...item}));
    }

    public static frameControlHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const base = {group: "Frame controls", global: true, allowInInput: false, preventDefault: true};
        const items = [
            {combo: `${modString}]`, label: "Next image", onKeyDown: appStore.nextImage},
            {combo: `${modString}[`, label: "Previous image", onKeyDown: appStore.prevImage},
            {combo: `${modString}up`, label: "Next channel", onKeyDown: () => HotkeyService.moveSelectedRegionOrChangeChannel(0, 1, 1)},
            {combo: `${modString}down`, label: "Previous channel", onKeyDown: () => HotkeyService.moveSelectedRegionOrChangeChannel(0, -1, -1)},
            {combo: `${modString}shift + up`, label: "Next Stokes cube", onKeyDown: HotkeyService.nextStokes},
            {combo: `${modString}shift + down`, label: "Previous Stokes cube", onKeyDown: HotkeyService.prevStokes}
        ];
        return items.map(item => ({...base, ...item}));
    }

    // Hidden hotkeys for input method compatibility
    public static frameControlHiddenHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const base = {group: "Frame controls", global: true, allowInInput: false, preventDefault: true};
        const items = [
            {combo: `${modString}‘`, label: "Next image", onKeyDown: appStore.nextImage},
            {combo: `${modString}“`, label: "Previous image", onKeyDown: appStore.prevImage}
        ];
        return items.map(item => ({...base, ...item}));
    }

    public static fileControlHotkeys() {
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

    public static otherHotkeys() {
        const appStore = AppStore.Instance;
        const base = {group: "Other", global: true, allowInInput: false, preventDefault: true};
        const items = [
            {combo: "shift + d", label: "Toggle light/dark theme", onKeyDown: HotkeyService.toggleDarkTheme},
            {combo: "f", label: "Freeze/unfreeze cursor position", onKeyDown: appStore.toggleCursorFrozen},
            {combo: "g", label: "Mirror cursor on multipanel view", onKeyDown: appStore.toggleCursorMirror}
        ];
        return items.map(item => ({...base, ...item}));
    }

    // For display in custom hotkeys dialog
    public static getHotkeyDefinitionsForDisplay() {
        const toElements = (hotkeys: any[]) =>
            hotkeys.map((hotkey, index) => {
                return <Hotkey key={index} group={hotkey.group} global={hotkey.global} combo={hotkey.combo} label={hotkey.label} onKeyDown={hotkey.onKeyDown} />;
            });

        // Navigation
        const navigationHotKeys: React.ReactElement[] = toElements(HotkeyService.navigationDisplayHotkeys());

        // Regions
        const regionHotKeys: React.ReactElement[] = toElements(HotkeyService.regionDisplayHotkeys());
        const regionImageViewerHotKeys: React.ReactElement[] = toElements(HotkeyService.regionImageViewerDisplayHotkeys());
        const regionListHotKeys: React.ReactElement[] = toElements(HotkeyService.regionListDisplayHotkeys());

        // Frame controls
        const animatorHotkeys: React.ReactElement[] = toElements(HotkeyService.frameControlHotkeys());

        // File controls
        const fileHotkeys: React.ReactElement[] = toElements(HotkeyService.fileControlHotkeys());

        // Other
        const otherHotKeys: React.ReactElement[] = toElements(HotkeyService.otherHotkeys());

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

    public static renderHotkeyGroups() {
        const hotkeys = HotkeyService.getHotkeyDefinitionsForDisplay();
        const hotkeyGroups = [hotkeys.navigationHotKeys, hotkeys.fileHotkeys, hotkeys.animatorHotkeys, hotkeys.regionHotKeys, hotkeys.regionImageViewerHotKeys, hotkeys.regionListHotKeys, hotkeys.otherHotKeys];

        // Render each group; placement handled purely by CSS multi-column
        return hotkeyGroups.map((group, idx) => (
            <div className="hotkeys-item" key={`hotkeys-group-${idx}`}>
                <Hotkeys>{group}</Hotkeys>
            </div>
        ));
    }
}

export const HotkeysRegistrar = () => {
    const hotkeys = React.useMemo(
        () => [
            ...HotkeyService.frameControlHotkeys(),
            ...HotkeyService.frameControlHiddenHotkeys(),
            ...HotkeyService.regionHotkeys(),
            ...HotkeyService.regionHiddenHotkeys(),
            ...HotkeyService.fileControlHotkeys(),
            ...HotkeyService.otherHotkeys()
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
};
