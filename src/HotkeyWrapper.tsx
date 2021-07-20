import * as React from "react";
import {observer} from "mobx-react";
import {Classes, Dialog, Hotkey, Hotkeys, HotkeysTarget} from "@blueprintjs/core";
import {AppStore, BrowserMode, RegionMode} from "./stores";

// There are some issues with the Blueprint hotkey target decorator, so this rather hacky workaround is needed for now
// Once the issues are fixed, the decorator can be used and the functions can be made non-static

@observer
export class HotkeyContainer extends React.Component {
    public render() {
        const appStore = AppStore.Instance;
        let className = "bp3-hotkey-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        return (
            <Dialog portalClassName="dialog-portal" isOpen={appStore.dialogStore.hotkeyDialogVisible} className={className} canEscapeKeyClose={true} canOutsideClickClose={true} onClose={appStore.dialogStore.hideHotkeyDialog}>
                <div className={Classes.DIALOG_BODY}>{HotkeyContainer.RenderHotkeys()}</div>
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
            }
        }
    };

    static RenderHotkeys() {
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
            <Hotkey key={3} group={regionGroupTitle} global={true} combo="del" label="Delete selected region" onKeyDown={appStore.deleteSelectedRegion} />,
            <Hotkey key={4} group={regionGroupTitle} global={true} combo="backspace" label="Delete selected region" onKeyDown={appStore.deleteSelectedRegion} />,
            <Hotkey key={5} group={regionGroupTitle} global={true} combo="esc" label="Deselect region/Cancel region creation" onKeyDown={HotkeyContainer.HandleRegionEsc} />,
            <Hotkey key={6} group={regionGroupTitle} global={true} combo="mod" label="Switch region creation mode" />,
            <Hotkey key={7} group={regionGroupTitle} global={true} combo={"shift"} label="Symmetric region creation" />,
            <Hotkey key={8} group={regionGroupTitle} global={true} combo="double-click" label="Region properties" />
        ];

        const animatorHotkeys = [
            <Hotkey key={0} group={animatorGroupTitle} global={true} combo={`${modString}]`} label="Next image" onKeyDown={appStore.nextFrame} />,
            <Hotkey key={1} group={animatorGroupTitle} global={true} combo={`${modString}[`} label="Previous image" onKeyDown={appStore.prevFrame} />,
            <Hotkey key={2} group={animatorGroupTitle} global={true} combo={`${modString}up`} label="Next channel" onKeyDown={HotkeyContainer.NextChannel} />,
            <Hotkey key={3} group={animatorGroupTitle} global={true} combo={`${modString}down`} label="Previous channel" onKeyDown={HotkeyContainer.PrevChannel} />,
            <Hotkey key={4} group={animatorGroupTitle} global={true} combo={`${modString}shift + up`} label="Next Stokes cube" onKeyDown={HotkeyContainer.NextStokes} />,
            <Hotkey key={5} group={animatorGroupTitle} global={true} combo={`${modString}shift + down`} label="Previous Stokes cube" onKeyDown={HotkeyContainer.PrevStokes} />
        ];

        const fileHotkeys = [
            <Hotkey key={0} group={fileGroupTitle} global={true} combo={`${modString}O`} label="Open image" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File)} />,
            <Hotkey key={1} group={fileGroupTitle} global={true} combo={`${modString}L`} label="Append image" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File, true)} />,
            <Hotkey key={2} group={fileGroupTitle} global={true} combo={`${modString}W`} label="Close image" onKeyDown={() => appStore.closeCurrentFile(true)} />,
            <Hotkey key={3} group={fileGroupTitle} global={true} combo={`${modString}S`} label="Save image" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.SaveFile, false)} />,
            <Hotkey key={4} group={fileGroupTitle} global={true} combo={`${modString}G`} label="Import catalog" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.Catalog, false)} />,
            <Hotkey key={5} group={fileGroupTitle} global={true} combo={`${modString}E`} label="Export image" onKeyDown={appStore.exportImage} />
        ];

        const otherHotKeys = [
            <Hotkey key={0} group={otherGroupTitle} global={true} combo="shift + D" label="Toggle light/dark theme" onKeyDown={HotkeyContainer.ToggleDarkTheme} />,
            <Hotkey key={1} group={otherGroupTitle} global={true} combo="F" label="Freeze/unfreeze cursor position" onKeyDown={appStore.toggleCursorFrozen} />
        ];

        return (
            <Hotkeys>
                {regionHotKeys}
                {navigationHotKeys}
                {animatorHotkeys}
                {fileHotkeys}
                {otherHotKeys}
            </Hotkeys>
        );
    }
}

function HotkeyWrapper() {} // tslint:disable-line
HotkeyWrapper.prototype = Object.create(HotkeyContainer.prototype);
HotkeyWrapper.prototype.renderHotkeys = HotkeyContainer.RenderHotkeys;
export const HotkeyTargetContainer = HotkeysTarget(HotkeyWrapper as any);
