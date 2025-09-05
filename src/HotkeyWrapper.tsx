import * as React from "react";
import {Classes, Dialog, Hotkey, Hotkeys, useHotkeys} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {ImageViewLayer} from "components";
import {AppStore, BrowserMode, DialogId} from "stores";
import {RegionMode} from "stores/Frame";

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
            const newColumnCount = this.calculateColumnCount();
            if (newColumnCount !== this.state.columnCount) {
                this.setState({columnCount: newColumnCount});
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
                className={className}
                canEscapeKeyClose={true}
                canOutsideClickClose={true}
                onClose={() => appStore.dialogStore.hideDialog(DialogId.Hotkey)}
                style={{width: this.getDialogWidth(), maxWidth: "90vw"}}
            >
                <div className={Classes.DIALOG_BODY}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: this.getGridColumns(),
                            gap: "20px",
                            alignItems: "start"
                        }}
                    >
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

    // Unified hotkey definitions used by both display and registration systems
    static GetUnifiedHotkeyDefinitions(isHiddenHotkeysIncluded: boolean = true) {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;

        return [
            // 3) Frame controls
            {
                combo: `${modString}]`,
                group: "3) Frame controls",
                label: "Next image",
                global: true,
                allowInInput: false,
                preventDefault: true,
                onKeyDown: () => appStore.nextImage()
            },
            {
                combo: `${modString}[`,
                group: "3) Frame controls",
                label: "Previous image",
                global: true,
                allowInInput: false,
                preventDefault: true,
                onKeyDown: () => appStore.prevImage()
            },
            {
                combo: `${modString}up`,
                group: "3) Frame controls",
                label: "Next channel",
                global: true,
                allowInInput: false,
                preventDefault: true,
                onKeyDown: HotkeyService.NextChannel
            },
            {
                combo: `${modString}down`,
                group: "3) Frame controls",
                label: "Previous channel",
                global: true,
                allowInInput: false,
                preventDefault: true,
                onKeyDown: HotkeyService.PrevChannel
            },
            {
                combo: `${modString}shift + up`,
                group: "3) Frame controls",
                label: "Next Stokes cube",
                global: true,
                allowInInput: false,
                preventDefault: true,
                onKeyDown: HotkeyService.NextStokes
            },
            {
                combo: `${modString}shift + down`,
                group: "3) Frame controls",
                label: "Previous Stokes cube",
                global: true,
                allowInInput: false,
                preventDefault: true,
                onKeyDown: HotkeyService.PrevStokes
            },

            // Hidden hotkeys for input method compatibility (only included if requested)
            ...(isHiddenHotkeysIncluded
                ? [
                      {
                          combo: `${modString}‘`,
                          group: "3) Frame controls",
                          label: "Next image",
                          global: true,
                          allowInInput: false,
                          preventDefault: true,
                          onKeyDown: () => appStore.nextImage()
                      },
                      {
                          combo: `${modString}“`,
                          group: "3) Frame controls",
                          label: "Previous image",
                          global: true,
                          allowInInput: false,
                          preventDefault: true,
                          onKeyDown: () => appStore.prevImage()
                      }
                  ]
                : []),

            // 2) Regions
            {
                combo: "c",
                group: "2) Regions",
                label: "Toggle region creation mode",
                global: true,
                allowInInput: false,
                onKeyDown: HotkeyService.ToggleCreateMode
            },
            {
                combo: "l",
                group: "2) Regions",
                label: "Toggle current region lock",
                global: true,
                allowInInput: false,
                onKeyDown: HotkeyService.ToggleRegionLock
            },
            {
                combo: "shift+l",
                group: "2) Regions",
                label: "Unlock all regions",
                global: true,
                allowInInput: false,
                onKeyDown: HotkeyService.UnlockAllRegions
            },
            {
                combo: "delete",
                group: "2) Regions",
                label: "Delete selected region",
                global: true,
                allowInInput: false,
                preventDefault: true,
                onKeyDown: () => appStore.deleteSelectedRegion()
            },
            {
                combo: "backspace",
                group: "2) Regions",
                label: "Delete selected region",
                global: true,
                allowInInput: false,
                preventDefault: true,
                onKeyDown: () => appStore.deleteSelectedRegion()
            },
            {
                combo: "esc",
                group: "2) Regions",
                label: "Deselect/Cancel region creation",
                global: true,
                allowInInput: false,
                onKeyDown: HotkeyService.HandleRegionEsc
            },

            // 4) File controls
            {
                combo: `${modString}O`,
                group: "4) File controls",
                label: "Open image",
                global: true,
                allowInInput: false,
                onKeyDown: () => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File)
            },
            {
                combo: `${modString}L`,
                group: "4) File controls",
                label: "Append image",
                global: true,
                allowInInput: false,
                onKeyDown: () => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File, true)
            },
            {
                combo: `${modString}W`,
                group: "4) File controls",
                label: "Close image",
                global: true,
                allowInInput: false,
                onKeyDown: () => appStore.closeCurrentFile(true)
            },
            {
                combo: `${modString}S`,
                group: "4) File controls",
                label: "Save image",
                global: true,
                allowInInput: false,
                onKeyDown: () => appStore.fileBrowserStore.showFileBrowser(BrowserMode.SaveFile, false)
            },
            {
                combo: `${modString}G`,
                group: "4) File controls",
                label: "Import catalog",
                global: true,
                allowInInput: false,
                onKeyDown: () => appStore.fileBrowserStore.showFileBrowser(BrowserMode.Catalog, false)
            },
            {
                combo: `${modString}E`,
                group: "4) File controls",
                label: "Export image",
                global: true,
                allowInInput: false,
                onKeyDown: () => appStore.exportImage(1)
            },

            // 5) Other
            {
                combo: "shift+d",
                group: "5) Other",
                label: "Toggle light/dark theme",
                global: true,
                allowInInput: false,
                onKeyDown: HotkeyService.ToggleDarkTheme
            },
            {
                combo: "f",
                group: "5) Other",
                label: "Freeze/unfreeze cursor position",
                global: true,
                allowInInput: false,
                onKeyDown: () => appStore.toggleCursorFrozen()
            },
            {
                combo: "g",
                group: "5) Other",
                label: "Mirror cursor on multipanel view",
                global: true,
                allowInInput: false,
                onKeyDown: () => appStore.toggleCursorMirror()
            }
        ];
    }

    // For display in custom hotkeys dialog
    static GetHotkeyDefinitionsForDisplay(isHiddenHotkeysIncluded: boolean = true) {
        const unifiedHotkeys = HotkeyService.GetUnifiedHotkeyDefinitions(isHiddenHotkeysIncluded);

        const navigationGroupTitle = "1) Navigation";
        const regionGroupTitle = "2) Regions";
        const animatorGroupTitle = "3) Frame controls";
        const fileGroupTitle = "4) File controls";
        const otherGroupTitle = "5) Other";

        const navigationHotKeys = [
            <Hotkey key={0} group={navigationGroupTitle} global={true} combo="click" label="Pan image" />,
            <Hotkey key={1} group={navigationGroupTitle} global={true} combo="middle-click" label="Pan image (inside region)" />,
            <Hotkey key={2} group={navigationGroupTitle} global={true} combo="mod+click" label="Pan image (inside region)" />,
            <Hotkey key={3} group={navigationGroupTitle} global={true} combo="mouse-wheel" label="Zoom image" />
        ];

        const regionDisplayOnlyHotkeys = [
            <Hotkey key={100} group={regionGroupTitle} global={true} combo="mod" label="Switch region creation mode" />,
            <Hotkey key={101} group={regionGroupTitle} global={true} combo="shift" label="Symmetric region creation" />,
            <Hotkey key={102} group={regionGroupTitle} global={true} combo="double-click" label="Region properties" />
        ];

        const regionHotKeys: React.ReactElement[] = [];
        const animatorHotkeys: React.ReactElement[] = [];
        const fileHotkeys: React.ReactElement[] = [];
        const otherHotKeys: React.ReactElement[] = [];

        unifiedHotkeys.forEach((hotkey, index) => {
            const hotkeyElement = <Hotkey key={index} group={hotkey.group} global={hotkey.global} combo={hotkey.combo} label={hotkey.label} onKeyDown={hotkey.onKeyDown} />;

            if (hotkey.group === regionGroupTitle) {
                regionHotKeys.push(hotkeyElement);
            } else if (hotkey.group === animatorGroupTitle) {
                animatorHotkeys.push(hotkeyElement);
            } else if (hotkey.group === fileGroupTitle) {
                fileHotkeys.push(hotkeyElement);
            } else if (hotkey.group === otherGroupTitle) {
                otherHotKeys.push(hotkeyElement);
            }
        });

        regionHotKeys.push(...regionDisplayOnlyHotkeys);

        return {
            navigationHotKeys,
            regionHotKeys,
            animatorHotkeys,
            fileHotkeys,
            otherHotKeys
        };
    }

    static RenderHotkeysInColumns(columnCount: number = 3) {
        const hotkeys = HotkeyService.GetHotkeyDefinitionsForDisplay(false);
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
    const hotkeys = React.useMemo(() => HotkeyService.GetUnifiedHotkeyDefinitions(true), []);

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
