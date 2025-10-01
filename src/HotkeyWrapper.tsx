import * as React from "react";
import {Classes, Dialog, Hotkey, Hotkeys, useHotkeys} from "@blueprintjs/core";
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
                regionSet.deselectRegion();
            } else if (regionSet.mode === RegionMode.CREATING) {
                regionSet.setMode(RegionMode.MOVING);
                appStore.updateActiveLayer(ImageViewLayer.RegionMoving);
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
            {combo: "esc", label: "Deselect/Cancel region creation", onKeyDown: HotkeyService.HandleRegionEsc}
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

        // Navigation
        const navigationHotKeys: React.ReactElement[] = toElements(HotkeyService.NavigationDisplayHotkeys());

        // Regions
        const regionHotKeys: React.ReactElement[] = toElements(HotkeyService.RegionHotkeys());
        const regionDisplayOnlyHotkeys: React.ReactElement[] = toElements(HotkeyService.RegionDisplayHotkeys());
        regionHotKeys.push(...regionDisplayOnlyHotkeys);

        // Frame controls
        const animatorHotkeys: React.ReactElement[] = toElements(HotkeyService.FrameControlHotkeys());

        // File controls
        const fileHotkeys: React.ReactElement[] = toElements(HotkeyService.FileControlHotkeys());

        // Other
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
        const hotkeyGroups = [hotkeys.navigationHotKeys, hotkeys.regionHotKeys, hotkeys.animatorHotkeys, hotkeys.fileHotkeys, hotkeys.otherHotKeys];

        // Render each group; placement handled purely by CSS multi-column
        return hotkeyGroups.map((group, idx) => (
            <div className="hotkeys-item" key={`hotkeys-group-${idx}`}>
                <Hotkeys>{group}</Hotkeys>
            </div>
        ));
    }
}

export function HotkeysRegistrar() {
    const hotkeys = React.useMemo(() => [...HotkeyService.FrameControlHotkeys(), ...HotkeyService.FrameControlHiddenHotkeys(), ...HotkeyService.RegionHotkeys(), ...HotkeyService.FileControlHotkeys(), ...HotkeyService.OtherHotkeys()], []);

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
