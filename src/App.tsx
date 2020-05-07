import * as React from "react";

import {observer} from "mobx-react";
import ReactResizeDetector from "react-resize-detector";
import {Alert, Classes, Colors, Dialog, Hotkey, Hotkeys, HotkeysTarget, Intent} from "@blueprintjs/core";
import {UIControllerComponent, FloatingWidgetManagerComponent} from "./components";
import {TaskProgressDialogComponent} from "./components/Dialogs";
import {AppStore, BrowserMode, RegionMode} from "./stores";
import "./App.css";
import "./layout-base.css";
import "./layout-theme.css";

@observer
export class App extends React.Component {
    // GoldenLayout resize handler
    onContainerResize = (width, height) => {
        const appStore = AppStore.Instance;
        if (appStore.layoutStore.dockedLayout) {
            appStore.layoutStore.dockedLayout.updateSize(width, height);
        }
    };

    public render() {
        const appStore = AppStore.Instance;
        let className = "App";
        let glClassName = "gl-container-app";
        if (appStore.darkTheme) {
            className += " bp3-dark";
            glClassName += " dark-theme";
        }

        return (
            <div className={className}>
                <UIControllerComponent/>
                <Alert isOpen={appStore.alertStore.alertVisible} onClose={appStore.alertStore.dismissAlert} canEscapeKeyCancel={true}>
                    <p>{appStore.alertStore.alertText}</p>
                </Alert>
                <Alert
                    isOpen={appStore.alertStore.interactiveAlertVisible}
                    confirmButtonText="OK"
                    cancelButtonText="Cancel"
                    intent={Intent.DANGER}
                    onClose={appStore.alertStore.handleInteractiveAlertClosed}
                    canEscapeKeyCancel={true}
                >
                    <p>{appStore.alertStore.interactiveAlertText}</p>
                </Alert>
                <TaskProgressDialogComponent progress={undefined} timeRemaining={0} isOpen={appStore.resumingSession} cancellable={false} text={"Resuming session..."}/>
                <div className={glClassName} ref={ref => appStore.setAppContainer(ref)}>
                    <ReactResizeDetector handleWidth handleHeight onResize={this.onContainerResize} refreshMode={"throttle"} refreshRate={200}/>
                </div>
                <FloatingWidgetManagerComponent/>
                <Dialog isOpen={appStore.dialogStore.hotkeyDialogVisible} className={"bp3-hotkey-dialog"} canEscapeKeyClose={true} canOutsideClickClose={true} onClose={appStore.dialogStore.hideHotkeyDialog}>
                    <div className={Classes.DIALOG_BODY}>
                        {this.renderHotkeys()}
                    </div>
                </Dialog>
            </div>
        );
    }

    nextChannel = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(1, 0);
        }
    };

    prevChannel = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(-1, 0);
        }
    };

    nextStokes = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(0, 1);
        }
    };

    prevStokes = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(0, -1);
        }
    };

    toggleDarkTheme = () => {
        const appStore = AppStore.Instance;
        if (appStore.darkTheme) {
            appStore.setLightTheme();
        } else {
            appStore.setDarkTheme();
        }
    };

    toggleCreateMode = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            appStore.activeFrame.regionSet.toggleMode();
        }
    };

    exitCreateMode = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame && appStore.activeFrame.regionSet.mode !== RegionMode.MOVING) {
            appStore.activeFrame.regionSet.setMode(RegionMode.MOVING);
        }
    };

    toggleRegionLock = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            const regionSet = appStore.activeFrame.regionSet;
            if (regionSet.selectedRegion) {
                regionSet.selectedRegion.toggleLock();
            }
        }
    };

    unlockAllRegions = () => {
        const appStore = AppStore.Instance;
        if (appStore.activeFrame) {
            const regionSet = appStore.activeFrame.regionSet;
            for (const region of regionSet.regions) {
                region.setLocked(false);
            }
        }
    };

    handleRegionEsc = () => {
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

    public renderHotkeys() {
        const appStore = AppStore.Instance;
        const modString = appStore.modifierString;

        const navigationGroupTitle = "1) Navigation";
        const regionGroupTitle = "2) Regions";
        const animatorGroupTitle = "3) Frame controls";
        const fileGroupTitle = "4) File controls";
        const otherGroupTitle = "5) Other";

        const navigationHotKeys = [
            <Hotkey key={0} group={navigationGroupTitle} global={true} combo="click" label="Pan image"/>,
            <Hotkey key={1} group={navigationGroupTitle} global={true} combo="middle-click" label="Pan image (inside region)"/>,
            <Hotkey key={2} group={navigationGroupTitle} global={true} combo="mod+click" label="Pan image (inside region)"/>,
            <Hotkey key={3} group={navigationGroupTitle} global={true} combo="mouse-wheel" label="Zoom image"/>,
        ];

        const regionHotKeys = [
            <Hotkey key={0} group={regionGroupTitle} global={true} combo="c" label="Toggle region creation mode" onKeyDown={this.toggleCreateMode}/>,
            <Hotkey key={1} group={regionGroupTitle} global={true} combo="l" label="Toggle current region lock" onKeyDown={this.toggleRegionLock}/>,
            <Hotkey key={2} group={regionGroupTitle} global={true} combo="shift + l" label="Unlock all regions" onKeyDown={this.unlockAllRegions}/>,
            <Hotkey key={3} group={regionGroupTitle} global={true} combo="del" label="Delete selected region" onKeyDown={appStore.deleteSelectedRegion}/>,
            <Hotkey key={4} group={regionGroupTitle} global={true} combo="backspace" label="Delete selected region" onKeyDown={appStore.deleteSelectedRegion}/>,
            <Hotkey key={5} group={regionGroupTitle} global={true} combo="esc" label="Deselect region/Cancel region creation" onKeyDown={this.handleRegionEsc}/>,
            <Hotkey key={6} group={regionGroupTitle} global={true} combo="mod" label="Switch region creation mode"/>,
            <Hotkey key={7} group={regionGroupTitle} global={true} combo={"shift"} label="Symmetric region creation"/>,
            <Hotkey key={8} group={regionGroupTitle} global={true} combo="double-click" label="Region properties"/>
        ];

        const animatorHotkeys = [
            <Hotkey key={0} group={animatorGroupTitle} global={true} combo={`${modString}]`} label="Next frame" onKeyDown={appStore.nextFrame}/>,
            <Hotkey key={1} group={animatorGroupTitle} global={true} combo={`${modString}[`} label="Previous frame" onKeyDown={appStore.prevFrame}/>,
            <Hotkey key={2} group={animatorGroupTitle} global={true} combo={`${modString}up`} label="Next channel" onKeyDown={this.nextChannel}/>,
            <Hotkey key={3} group={animatorGroupTitle} global={true} combo={`${modString}down`} label="Previous channel" onKeyDown={this.prevChannel}/>,
            <Hotkey key={4} group={animatorGroupTitle} global={true} combo={`${modString}shift + up`} label="Next Stokes cube" onKeyDown={this.nextStokes}/>,
            <Hotkey key={5} group={animatorGroupTitle} global={true} combo={`${modString}shift + down`} label="Previous Stokes cube" onKeyDown={this.prevStokes}/>
        ];

        const fileHotkeys = [
            <Hotkey key={0} group={fileGroupTitle} global={true} combo={`${modString}O`} label="Open image" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File)}/>,
            <Hotkey key={1} group={fileGroupTitle} global={true} combo={`${modString}L`} label="Append image" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.File, true)}/>,
            <Hotkey key={1} group={fileGroupTitle} global={true} combo={`${modString}W`} label="Close image" onKeyDown={() => appStore.closeCurrentFile(true)}/>,
            <Hotkey key={2} group={fileGroupTitle} global={true} combo={`${modString}E`} label="Export image" onKeyDown={appStore.exportImage}/>,
            <Hotkey key={3} group={fileGroupTitle} global={true} combo={`${modString}C`} label="Append catalog" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser(BrowserMode.Catalog, false)}/>
        ];

        const otherHotKeys = [
            <Hotkey key={0} group={otherGroupTitle} global={true} combo="shift + D" label="Toggle light/dark theme" onKeyDown={this.toggleDarkTheme}/>,
            <Hotkey key={1} group={otherGroupTitle} global={true} combo="F" label="Freeze/unfreeze cursor position" onKeyDown={appStore.toggleCursorFrozen}/>
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

// Workaround to fix Blueprint HotkeysTarget bug
function AppWrapper() {} // tslint:disable-line
AppWrapper.prototype = Object.create(App.prototype);
AppWrapper.prototype.renderHotkeys = App.prototype.renderHotkeys;

export const AppContainer = HotkeysTarget(AppWrapper as any);