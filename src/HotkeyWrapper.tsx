import * as React from "react";
import {Classes, Dialog, Hotkey, Hotkeys, useHotkeys} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {observer} from "mobx-react";

import {ImageViewLayer} from "components";
import {AppStore, BrowserMode, DialogId} from "stores";
import {RegionMode} from "stores/Frame";

import "./HotkeyWrapper.scss";

enum HotkeyGroup {
    Navigation = "Navigation",
    Regions = "Regions",
    FrameControls = "Frame controls",
    FileControls = "File controls",
    Other = "Other"
}

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
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(1, 0);
        }
    };

    static PrevChannel = () => {
        const appStore = AppStore.Instance;
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
            if (regionSet.selectedRegion) {
                regionSet.selectedRegion.toggleLock();
            }
        }
    };

    static UnlockAllRegions = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            const regionSet = appStore.activeFrame.regionSet;
            for (const region of regionSet.regions) {
                region.setLocked(false);
            }
        }
    };

    static HandleRegionEsc = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame && appStore.activeFrame.regionSet) {
            const regionSet = appStore.activeFrame.regionSet;
            if (regionSet.selectedRegion) {
                // First try to deselect point, then deselect region
                if (regionSet.selectedRegion.hasSelectedPoint) {
                    regionSet.selectedRegion.deselectPoint();
                } else {
                    regionSet.deselectRegion();
                }
            } else if (regionSet.mode === RegionMode.CREATING) {
                regionSet.setMode(RegionMode.MOVING);
                appStore.updateActiveLayer(ImageViewLayer.RegionMoving);
            }
        }
    };

    static EnterPointSelection = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame?.regionSet.selectedRegion) {
            const region = appStore.activeFrame.regionSet.selectedRegion;
            if (region.supportsPointSelection && !region.hasSelectedPoint) {
                region.selectPoint(0);
            }
        }
    };

    static SelectNextPoint = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame?.regionSet.selectedRegion?.supportsPointSelection) {
            appStore.activeFrame.regionSet.selectedRegion.selectNextPoint();
        }
    };

    static SelectPreviousPoint = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame?.regionSet.selectedRegion?.supportsPointSelection) {
            appStore.activeFrame.regionSet.selectedRegion.selectPreviousPoint();
        }
    };

    static SelectNextRegion = () => {
        const appStore = AppStore.Instance;
        appStore.activeFrame?.regionSet.selectNextRegion();
    };

    static SelectPreviousRegion = () => {
        const appStore = AppStore.Instance;
        appStore.activeFrame?.regionSet.selectPreviousRegion();
    };

    static SelectNextRegionOrPoint = () => {
        const appStore = AppStore.Instance;
        const regionSet = appStore.activeFrame?.regionSet;
        if (!regionSet) {
            return;
        }

        const region = regionSet.selectedRegion;
        // Only cycle points if a control point is already selected; otherwise go to next region
        if (region?.hasSelectedPoint) {
            region.selectNextPoint();
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

        const region = regionSet.selectedRegion;
        // Only cycle points if a control point is already selected; otherwise go to previous region
        if (region?.hasSelectedPoint) {
            region.selectPreviousPoint();
        } else {
            regionSet.selectPreviousRegion();
        }
    };

    static MoveSelectedRegion = (deltaX: number, deltaY: number, acceleratedMultiplier: number) => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame?.regionSet.selectedRegion) {
            const region = appStore.activeFrame.regionSet.selectedRegion;

            // Calculate movement distance based on acceleration and zoom level
            const baseIncrement = 1;
            const zoomMultiplier = Math.max(1, 1 / appStore.activeFrame.zoomLevel);

            const actualDeltaX = deltaX * baseIncrement * acceleratedMultiplier * zoomMultiplier;
            const actualDeltaY = deltaY * baseIncrement * acceleratedMultiplier * zoomMultiplier;

            // Check if a specific point is selected for polygon/polyline regions
            if (region.supportsPointSelection && region.hasSelectedPoint) {
                // Move only the selected point
                region.moveSelectedPoint(actualDeltaX, actualDeltaY);
            } else if (region.regionType === CARTA.RegionType.POLYGON || region.regionType === CARTA.RegionType.POLYLINE || region.regionType === CARTA.RegionType.ANNPOLYGON || region.regionType === CARTA.RegionType.ANNPOLYLINE) {
                // Move all control points (entire region)
                const newControlPoints = region.controlPoints.map(point => ({
                    x: point.x + actualDeltaX,
                    y: point.y + actualDeltaY
                }));
                region.setControlPoints(newControlPoints);
            } else {
                // For other region types, use setCenter
                const newCenter = {
                    x: region.center.x + actualDeltaX,
                    y: region.center.y + actualDeltaY
                };
                region.setCenter(newCenter);
            }
        }
    };

    // For display in custom hotkeys dialog
    static NavigationDisplayHotkeys() {
        const group = HotkeyGroup.Navigation;
        const base = {group, global: true};
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
        const group = HotkeyGroup.Regions;
        const base = {group, global: true};
        const items = [
            {combo: "mod", label: "Switch region creation mode"},
            {combo: "shift", label: "Symmetric region creation"},
            {combo: "double-click", label: "Region properties"}
        ];
        return items.map(item => ({...base, ...item}));
    }

    static RegionHotkeys() {
        const appStore = AppStore.Instance;
        const group = HotkeyGroup.Regions;
        const base = {group, global: true, allowInInput: false, preventDefault: true};
        const items = [
            {combo: "c", label: "Toggle region creation mode", onKeyDown: HotkeyService.ToggleCreateMode},
            {combo: "l", label: "Toggle current region lock", onKeyDown: HotkeyService.ToggleRegionLock},
            {combo: "shift + l", label: "Unlock all regions", onKeyDown: HotkeyService.UnlockAllRegions},
            {combo: "delete", label: "Delete selected region", onKeyDown: appStore.deleteSelectedRegion},
            {combo: "backspace", label: "Delete selected region", onKeyDown: appStore.deleteSelectedRegion},
            {combo: "esc", label: "Deselect region/point or cancel creation", onKeyDown: HotkeyService.HandleRegionEsc},
            {combo: "enter", label: "Enter point selection mode", onKeyDown: HotkeyService.EnterPointSelection},
            {combo: "tab", label: "Select next region/point", onKeyDown: HotkeyService.SelectNextRegionOrPoint},
            {combo: "shift + tab", label: "Select previous region/point", onKeyDown: HotkeyService.SelectPreviousRegionOrPoint},
            {combo: "up + down", label: "Move region/point vertically", onKeyDown: undefined},
            {combo: "left + right", label: "Move region/point horizontally", onKeyDown: undefined}
        ];
        return items.map(item => ({...base, ...item}));
    }

    static RegionHiddenHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const group = HotkeyGroup.Regions;
        const base = {group, global: true, allowInInput: false, preventDefault: true};
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
        const group = HotkeyGroup.FrameControls;
        const base = {group, global: true, allowInInput: false, preventDefault: true};
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
        const group = HotkeyGroup.FrameControls;
        const base = {group, global: true, allowInInput: false, preventDefault: true};
        const items = [
            {combo: `${modString}‘`, label: "Next image", onKeyDown: appStore.nextImage},
            {combo: `${modString}“`, label: "Previous image", onKeyDown: appStore.prevImage}
        ];
        return items.map(item => ({...base, ...item}));
    }

    static FileControlHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const group = HotkeyGroup.FileControls;
        const base = {group, global: true, allowInInput: false, preventDefault: true};
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
        const group = HotkeyGroup.Other;
        const base = {group, global: true, allowInInput: false, preventDefault: true};
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

        // 1) Navigation
        const navigationHotKeys: React.ReactElement[] = toElements(HotkeyService.NavigationDisplayHotkeys());

        // 2) Regions
        const regionHotKeys: React.ReactElement[] = toElements(HotkeyService.RegionHotkeys());
        const regionDisplayOnlyHotkeys: React.ReactElement[] = toElements(HotkeyService.RegionDisplayHotkeys());
        regionHotKeys.push(...regionDisplayOnlyHotkeys);

        // 3) Frame controls
        const animatorHotkeys: React.ReactElement[] = toElements(HotkeyService.FrameControlHotkeys());

        // 4) File controls
        const fileHotkeys: React.ReactElement[] = toElements(HotkeyService.FileControlHotkeys());

        // 5) Other
        const otherHotKeys: React.ReactElement[] = toElements(HotkeyService.OtherHotkeys());

        return {
            navigationHotKeys,
            regionHotKeys,
            animatorHotkeys,
            fileHotkeys,
            otherHotKeys
        };
    }

    static RenderHotkeyGroups() {
        const hotkeys = HotkeyService.GetHotkeyDefinitionsForDisplay();
        const hotkeyGroups = [hotkeys.navigationHotKeys, hotkeys.fileHotkeys, hotkeys.regionHotKeys, hotkeys.animatorHotkeys, hotkeys.otherHotKeys];

        // Render each group; placement handled purely by CSS multi-column
        return hotkeyGroups.map((group, idx) => (
            <div className="hotkeys-item" key={`hotkeys-group-${idx}`}>
                <Hotkeys>{group}</Hotkeys>
            </div>
        ));
    }
}

export function HotkeysRegistrar() {
    const hotkeys = React.useMemo(() => [...HotkeyService.FrameControlHotkeys(), ...HotkeyService.FrameControlHiddenHotkeys(), ...HotkeyService.RegionHotkeys(), ...HotkeyService.RegionHiddenHotkeys(), ...HotkeyService.FileControlHotkeys(), ...HotkeyService.OtherHotkeys()], []);

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
