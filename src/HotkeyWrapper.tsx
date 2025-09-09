import * as React from "react";
import {Classes, Dialog, Hotkey, Hotkeys, useHotkeys} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {observer} from "mobx-react";

import {ImageViewLayer} from "components";
import {AppStore, BrowserMode, DialogId} from "stores";
import {RegionMode} from "stores/Frame";

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

    static MoveSelectedRegion = (deltaX: number, deltaY: number, accelerated = false) => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame?.regionSet.selectedRegion) {
            const region = appStore.activeFrame.regionSet.selectedRegion;

            // Calculate movement distance based on acceleration and zoom level
            const baseIncrement = 1;
            const acceleratedMultiplier = 10;
            const zoomMultiplier = Math.max(1, 1 / appStore.activeFrame.zoomLevel);

            const actualDeltaX = deltaX * baseIncrement * (accelerated ? acceleratedMultiplier * zoomMultiplier : 1);
            const actualDeltaY = deltaY * baseIncrement * (accelerated ? acceleratedMultiplier * zoomMultiplier : 1);

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
    static GetNavigationDisplayOnlyHotkeys() {
        const group = "1) Navigation";
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
    static GetRegionDisplayOnlyHotkeys() {
        const group = "3) Regions";
        const base = {group, global: true};
        const items = [
            {combo: "mod", label: "Switch region creation mode"},
            {combo: "shift", label: "Symmetric region creation"},
            {combo: "double-click", label: "Region properties"}
        ];
        return items.map(item => ({...base, ...item}));
    }

    static GetRegionHotkeys() {
        const appStore = AppStore.Instance;
        const group = "3) Regions";
        const base = {group, global: true, allowInInput: false, preventDefault: true};
        const items = [
            {combo: "c", label: "Toggle region creation mode", onKeyDown: HotkeyService.ToggleCreateMode},
            {combo: "l", label: "Toggle current region lock", onKeyDown: HotkeyService.ToggleRegionLock},
            {combo: "shift + l", label: "Unlock all regions", onKeyDown: HotkeyService.UnlockAllRegions},
            {combo: "delete", label: "Delete selected region", onKeyDown: appStore.deleteSelectedRegion},
            {combo: "backspace", label: "Delete selected region", onKeyDown: appStore.deleteSelectedRegion},
            {combo: "esc", label: "Deselect region/point or cancel creation", onKeyDown: HotkeyService.HandleRegionEsc},
            {
                combo: "tab",
                label: (
                    <>
                        Select next point
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(polygon/polyline)
                    </>
                ),
                onKeyDown: HotkeyService.SelectNextPoint
            },
            {
                combo: "shift + tab",
                label: (
                    <>
                        Select previous point
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(polygon/polyline)
                    </>
                ),
                onKeyDown: HotkeyService.SelectPreviousPoint
            },
            {
                combo: "up + down",
                label: (
                    <>
                        Move region/point vertically
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(+ shift for faster move)
                    </>
                ),
                onKeyDown: undefined
            },
            {
                combo: "left + right",
                label: (
                    <>
                        Move region/point horizontally
                        <br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(+ shift for faster move)
                    </>
                ),
                onKeyDown: undefined
            }
        ];
        return items.map(item => ({...base, ...item}));
    }

    static GetRegionHiddenHotkeys() {
        const group = "3) Regions";
        const base = {group, global: true, allowInInput: false, preventDefault: true};
        const items = [
            {combo: "up", label: "Move selected region up (fine)", onKeyDown: () => HotkeyService.MoveSelectedRegion(0, 1, false)},
            {combo: "down", label: "Move selected region down (fine)", onKeyDown: () => HotkeyService.MoveSelectedRegion(0, -1, false)},
            {combo: "left", label: "Move selected region left (fine)", onKeyDown: () => HotkeyService.MoveSelectedRegion(-1, 0, false)},
            {combo: "right", label: "Move selected region right (fine)", onKeyDown: () => HotkeyService.MoveSelectedRegion(1, 0, false)},
            {combo: "shift + up", label: "Move selected region up (coarse)", onKeyDown: () => HotkeyService.MoveSelectedRegion(0, 1, true)},
            {combo: "shift + down", label: "Move selected region down (coarse)", onKeyDown: () => HotkeyService.MoveSelectedRegion(0, -1, true)},
            {combo: "shift + left", label: "Move selected region left (coarse)", onKeyDown: () => HotkeyService.MoveSelectedRegion(-1, 0, true)},
            {combo: "shift + right", label: "Move selected region right (coarse)", onKeyDown: () => HotkeyService.MoveSelectedRegion(1, 0, true)}
        ];
        return items.map(item => ({...base, ...item}));
    }

    static GetFrameControlHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const group = "4) Frame controls";
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
    static GetFrameControlHiddenHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const group = "4) Frame controls";
        const base = {group, global: true, allowInInput: false, preventDefault: true};
        const items = [
            {combo: `${modString}‘`, label: "Next image", onKeyDown: appStore.nextImage},
            {combo: `${modString}“`, label: "Previous image", onKeyDown: appStore.prevImage}
        ];
        return items.map(item => ({...base, ...item}));
    }

    static GetFileControlHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const group = "2) File controls";
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

    static GetOtherHotkeys() {
        const appStore = AppStore.Instance;
        const group = "5) Other";
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
        const toElements = (hotkeys: any[]) => hotkeys.map((hotkey, index) => <Hotkey key={index} group={hotkey.group} global={hotkey.global} combo={hotkey.combo} label={hotkey.label} onKeyDown={hotkey.onKeyDown} />);

        // 1) Navigation
        const navigationHotKeys: React.ReactElement[] = toElements(HotkeyService.GetNavigationDisplayOnlyHotkeys());

        // 2) Regions
        const regionHotKeys: React.ReactElement[] = toElements(HotkeyService.GetRegionHotkeys());
        const regionDisplayOnlyHotkeys: React.ReactElement[] = toElements(HotkeyService.GetRegionDisplayOnlyHotkeys());
        regionHotKeys.push(...regionDisplayOnlyHotkeys);

        // 3) Frame controls
        const animatorHotkeys: React.ReactElement[] = toElements(HotkeyService.GetFrameControlHotkeys());

        // 4) File controls
        const fileHotkeys: React.ReactElement[] = toElements(HotkeyService.GetFileControlHotkeys());

        // 5) Other
        const otherHotKeys: React.ReactElement[] = toElements(HotkeyService.GetOtherHotkeys());

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
    const hotkeys = React.useMemo(
        () => [
            ...HotkeyService.GetFrameControlHotkeys(),
            ...HotkeyService.GetFrameControlHiddenHotkeys(),
            ...HotkeyService.GetRegionHotkeys(),
            ...HotkeyService.GetRegionHiddenHotkeys(),
            ...HotkeyService.GetFileControlHotkeys(),
            ...HotkeyService.GetOtherHotkeys()
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
