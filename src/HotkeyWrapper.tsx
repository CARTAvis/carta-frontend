import * as React from "react";
import {Classes, Dialog, Hotkey, Hotkeys, useHotkeys} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {ImageViewLayer} from "components";
import {AppStore, BrowserMode, DialogId} from "stores";
import {RegionMode} from "stores/Frame";
import "./HotkeyWrapper.scss";

interface HotkeyServiceState {
    columnCount: number;
}

@observer
export class HotkeyService extends React.Component<{}, HotkeyServiceState> {
    private resizeListener: () => void;

    constructor(props: {}) {
        super(props);
        this.state = {
            columnCount: this.calculateColumnCount()
        };
        this.resizeListener = () => {
            // Only update column count if the hotkeys dialog is open
            const appStore = AppStore.Instance;
            if (appStore.dialogStore.dialogVisible.get(DialogId.Hotkey)) {
                const newColumnCount = this.calculateColumnCount();
                if (newColumnCount !== this.state.columnCount) {
                    this.setState({columnCount: newColumnCount});
                }
            }
        };
    }

    componentDidMount() {
        window.addEventListener("resize", this.resizeListener);
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.resizeListener);
    }

    private calculateColumnCount(): number {
        const screenWidth = window.innerWidth;
        if (screenWidth < 840) {
            return 1;
        } else if (screenWidth < 1280) {
            return 2;
        } else {
            return 3;
        }
    }

    private getDialogWidth(): string {
        const columnCount = this.state?.columnCount || this.calculateColumnCount();
        switch (columnCount) {
            case 1:
                return "400px";
            case 2:
                return "800px";
            case 3:
            default:
                return "1200px";
        }
    }

    private getGridColumns(): string {
        const columnCount = this.state?.columnCount || this.calculateColumnCount();
        return Array(columnCount).fill("1fr").join(" ");
    }

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
                style={{width: this.getDialogWidth()}}
            >
                <div className={Classes.DIALOG_BODY}>
                    <div className="hotkeys-grid" style={{gridTemplateColumns: this.getGridColumns()}}>
                        {HotkeyService.RenderHotkeysInColumns(this.state?.columnCount || this.calculateColumnCount())}
                    </div>
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
        const group = "2) Regions";
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
        const group = "2) Regions";
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

    static GetFrameControlHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;
        const group = "3) Frame controls";
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
        const group = "3) Frame controls";
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
        const group = "4) File controls";
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
        const toElements = (hotkeys: any[]) => hotkeys.map((hotkey, index) => (
            <Hotkey key={index} group={hotkey.group} global={hotkey.global} combo={hotkey.combo} label={hotkey.label} onKeyDown={hotkey.onKeyDown} />
        ));

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

    static RenderHotkeysInColumns(columnCount: number = 3) {
        const hotkeys = HotkeyService.GetHotkeyDefinitionsForDisplay();
        const hotkeyGroups = [hotkeys.navigationHotKeys, hotkeys.regionHotKeys, hotkeys.animatorHotkeys, hotkeys.fileHotkeys, hotkeys.otherHotKeys];

        // Define how to distribute groups across columns
        const columnDistributions = {
            1: [[0, 1, 2, 3, 4]], // All groups in one column
            2: [
                [0, 1],
                [2, 3, 4]
            ], // First two groups in column 1, rest in column 2
            3: [[0, 1], [2, 3], [4]] // Distribute across three columns
        };

        const distribution = columnDistributions[columnCount] || columnDistributions[3];

        return distribution.map((groupIndices: number[], columnIndex: number) => (
            <div key={`column${columnIndex + 1}`}>
                <Hotkeys>{groupIndices.map(index => hotkeyGroups[index])}</Hotkeys>
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
