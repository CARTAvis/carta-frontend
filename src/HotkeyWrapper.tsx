import * as React from "react";
import {Classes, Dialog, Hotkey, Hotkeys, HotkeysTarget} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {ImageViewLayer} from "components";
import {AppStore, BrowserMode, DialogId} from "stores";
import {RegionMode} from "stores/Frame";

// There are some issues with the Blueprint hotkey target decorator, so this rather hacky workaround is needed for now
// Once the issues are fixed, the decorator can be used and the functions can be made non-static

interface HotkeyContainerState {
    columnCount: number;
}

@observer
export class HotkeyContainer extends React.Component<{}, HotkeyContainerState> {
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
                        {HotkeyContainer.RenderHotkeysInColumns(false, this.state?.columnCount || this.calculateColumnCount())}
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

    static GetHotkeyDefinitions(isHiddenHotkeysIncluded: boolean = true) {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;

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

        const regionHotKeys = [
            <Hotkey key={0} group={regionGroupTitle} global={true} combo="c" label="Toggle region creation mode" onKeyDown={HotkeyContainer.ToggleCreateMode} />,
            <Hotkey key={1} group={regionGroupTitle} global={true} combo="l" label="Toggle current region lock" onKeyDown={HotkeyContainer.ToggleRegionLock} />,
            <Hotkey key={2} group={regionGroupTitle} global={true} combo="shift + l" label="Unlock all regions" onKeyDown={HotkeyContainer.UnlockAllRegions} />,
            <Hotkey key={3} group={regionGroupTitle} global={true} combo="delete" label="Delete selected region" onKeyDown={appStore.deleteSelectedRegion} />,
            <Hotkey key={4} group={regionGroupTitle} global={true} combo="backspace" label="Delete selected region" onKeyDown={appStore.deleteSelectedRegion} />,
            <Hotkey key={5} group={regionGroupTitle} global={true} combo="esc" label="Deselect region/Cancel region creation" onKeyDown={HotkeyContainer.HandleRegionEsc} />,
            <Hotkey key={6} group={regionGroupTitle} global={true} combo="mod" label="Switch region creation mode" />,
            <Hotkey key={7} group={regionGroupTitle} global={true} combo={"shift"} label="Symmetric region creation" />,
            <Hotkey key={8} group={regionGroupTitle} global={true} combo="double-click" label="Region properties" />
        ];

        const animatorHotkeys = [
            <Hotkey key={0} group={animatorGroupTitle} global={true} combo={`${modString}]`} label="Next image" onKeyDown={appStore.nextImage} />,
            <Hotkey key={1} group={animatorGroupTitle} global={true} combo={`${modString}[`} label="Previous image" onKeyDown={appStore.prevImage} />,
            <Hotkey key={2} group={animatorGroupTitle} global={true} combo={`${modString}up`} label="Next channel" onKeyDown={HotkeyContainer.NextChannel} />,
            <Hotkey key={3} group={animatorGroupTitle} global={true} combo={`${modString}down`} label="Previous channel" onKeyDown={HotkeyContainer.PrevChannel} />,
            <Hotkey key={4} group={animatorGroupTitle} global={true} combo={`${modString}shift + up`} label="Next Stokes cube" onKeyDown={HotkeyContainer.NextStokes} />,
            <Hotkey key={5} group={animatorGroupTitle} global={true} combo={`${modString}shift + down`} label="Previous Stokes cube" onKeyDown={HotkeyContainer.PrevStokes} />
        ];

        if (isHiddenHotkeysIncluded) {
            animatorHotkeys.push(
                // ‘ and “ can be typed with option + ] and option + [ on macOS
                <Hotkey key={6} group={animatorGroupTitle} global={true} combo={`${modString}‘`} label="Next image" onKeyDown={appStore.nextImage} />,
                <Hotkey key={7} group={animatorGroupTitle} global={true} combo={`${modString}“`} label="Previous image" onKeyDown={appStore.prevImage} />
            );
        }

        const fileHotkeys = [
            <Hotkey key={0} group={fileGroupTitle} global={true} combo={`${modString}O`} label="Open image" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File)} />,
            <Hotkey key={1} group={fileGroupTitle} global={true} combo={`${modString}L`} label="Append image" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File, true)} />,
            <Hotkey key={2} group={fileGroupTitle} global={true} combo={`${modString}W`} label="Close image" onKeyDown={() => appStore.closeCurrentFile(true)} />,
            <Hotkey key={3} group={fileGroupTitle} global={true} combo={`${modString}S`} label="Save image" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.SaveFile, false)} />,
            <Hotkey key={4} group={fileGroupTitle} global={true} combo={`${modString}G`} label="Import catalog" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.Catalog, false)} />,
            <Hotkey key={5} group={fileGroupTitle} global={true} combo={`${modString}E`} label="Export image" onKeyDown={() => appStore.exportImage(1)} />
        ];

        const otherHotKeys = [
            <Hotkey key={0} group={otherGroupTitle} global={true} combo="shift + D" label="Toggle light/dark theme" onKeyDown={HotkeyContainer.ToggleDarkTheme} />,
            <Hotkey key={1} group={otherGroupTitle} global={true} combo="F" label="Freeze/unfreeze cursor position" onKeyDown={appStore.toggleCursorFrozen} />,
            <Hotkey key={2} group={otherGroupTitle} global={true} combo="G" label="Mirror cursor on multipanel view" onKeyDown={appStore.toggleCursorMirror} />
        ];

        return {
            navigationHotKeys,
            regionHotKeys,
            animatorHotkeys,
            fileHotkeys,
            otherHotKeys
        };
    }

    static RenderHotkeysInColumns(isHiddenHotkeysIncluded: boolean = true, columnCount: number = 3) {
        const hotkeys = HotkeyContainer.GetHotkeyDefinitions(isHiddenHotkeysIncluded);

        if (columnCount === 1) {
            // Single column: all hotkeys together
            return [
                <div key="column1">
                    <Hotkeys>
                        {hotkeys.navigationHotKeys}
                        {hotkeys.regionHotKeys}
                        {hotkeys.animatorHotkeys}
                        {hotkeys.fileHotkeys}
                        {hotkeys.otherHotKeys}
                    </Hotkeys>
                </div>
            ];
        } else if (columnCount === 2) {
            // Two columns: balanced distribution
            const column1 = (
                <div key="column1">
                    <Hotkeys>
                        {hotkeys.navigationHotKeys}
                        {hotkeys.regionHotKeys}
                    </Hotkeys>
                </div>
            );

            const column2 = (
                <div key="column2">
                    <Hotkeys>
                        {hotkeys.animatorHotkeys}
                        {hotkeys.fileHotkeys}
                        {hotkeys.otherHotKeys}
                    </Hotkeys>
                </div>
            );

            return [column1, column2];
        } else {
            // Three columns: original layout
            const column1 = (
                <div key="column1">
                    <Hotkeys>
                        {hotkeys.navigationHotKeys}
                        {hotkeys.regionHotKeys}
                    </Hotkeys>
                </div>
            );

            const column2 = (
                <div key="column2">
                    <Hotkeys>
                        {hotkeys.animatorHotkeys}
                        {hotkeys.fileHotkeys}
                    </Hotkeys>
                </div>
            );

            const column3 = (
                <div key="column3">
                    <Hotkeys>{hotkeys.otherHotKeys}</Hotkeys>
                </div>
            );

            return [column1, column2, column3];
        }
    }

    static RenderHotkeys(isHiddenHotkeysIncluded: boolean = true) {
        const hotkeys = HotkeyContainer.GetHotkeyDefinitions(isHiddenHotkeysIncluded);

        return (
            <Hotkeys>
                {hotkeys.regionHotKeys}
                {hotkeys.navigationHotKeys}
                {hotkeys.animatorHotkeys}
                {hotkeys.fileHotkeys}
                {hotkeys.otherHotKeys}
            </Hotkeys>
        );
    }
}

function HotkeyWrapper(this: any, props: any) {
    // Initialize state manually since we can't call ES6 class constructor with .call()
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
HotkeyWrapper.prototype = Object.create(HotkeyContainer.prototype);
HotkeyWrapper.prototype.constructor = HotkeyWrapper;
HotkeyWrapper.prototype.renderHotkeys = () => HotkeyContainer.RenderHotkeys();

HotkeyWrapper.prototype.componentDidMount = function () {
    // Call parent's componentDidMount to set up resize listener
    if (HotkeyContainer.prototype.componentDidMount) {
        HotkeyContainer.prototype.componentDidMount.call(this);
    }
    // Use capture phase so we can intercept certain keys (e.g. Shift+?) before Blueprint's handlers
    document.addEventListener("keydown", this.handleGlobalKeydown, true);
};

HotkeyWrapper.prototype.componentWillUnmount = function () {
    // Call parent's componentWillUnmount to clean up resize listener
    if (HotkeyContainer.prototype.componentWillUnmount) {
        HotkeyContainer.prototype.componentWillUnmount.call(this);
    }
    document.removeEventListener("keydown", this.handleGlobalKeydown, true);
};

HotkeyWrapper.prototype.handleGlobalKeydown = function (event: KeyboardEvent) {
    const appStore = AppStore.Instance;

    // Helper to detect if an element (or its ancestors) is an editable control
    const isEditable = (el: Element | null): boolean => {
        if (!el) return false;
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
        const he = el as HTMLElement;
        if (he && (he.isContentEditable || he.getAttribute("contenteditable") !== null)) return true;
        // Common ARIA roles used by input components
        const role = he?.getAttribute?.("role");
        if (role && ["textbox", "searchbox", "combobox", "spinbutton"].includes(role)) return true;
        // Check ancestors for editable containers
        return !!el.closest(
            'input, textarea, select, [contenteditable], [role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"]'
        );
    };

    // Ignore when focus is inside editable elements (inputs, textareas, selects, or contenteditable)
    const target = (event.target as Element) ?? null;
    const activeEl = (document.activeElement as Element) ?? null;
    if (isEditable(target) || isEditable(activeEl)) {
        return;
    }

    // Intercept Shift+? to open our custom Hotkeys dialog and block Blueprint's default dialog
    // This prevents React 18 warnings from Blueprint's legacy ReactDOM.render path.
    if (event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey && (event.key === "?" || event.key === "/")) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
        }
        // Ensure only one instance of our dialog is shown
        if (!appStore.dialogStore.dialogVisible.get(DialogId.Hotkey)) {
            appStore.dialogStore.showDialog(DialogId.Hotkey);
        }
        return;
    }
};

export const HotkeyTargetContainer = HotkeysTarget(HotkeyWrapper as any);
