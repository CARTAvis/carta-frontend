import * as React from "react";
import * as AST from "ast_wrapper";
import * as CARTACompute from "carta_computation";
import {observer} from "mobx-react";
import {autorun} from "mobx";
import ReactResizeDetector from "react-resize-detector";
import {Alert, Classes, Colors, Dialog, Hotkey, Hotkeys, HotkeysTarget, Intent} from "@blueprintjs/core";
import {exportImage, FloatingWidgetManagerComponent, RootMenuComponent, SplashScreenComponent} from "./components";
import {AppToaster} from "./components/Shared";
import {
    AboutDialogComponent,
    AuthDialogComponent,
    FileBrowserDialogComponent,
    OverlaySettingsDialogComponent,
    PreferenceDialogComponent,
    RegionDialogComponent,
    SaveLayoutDialogComponent,
    TaskProgressDialogComponent
} from "./components/Dialogs";
import {AppStore, BrowserMode, dayPalette, nightPalette, RegionMode} from "./stores";
import {ConnectionStatus} from "./services";
import {PresetLayout} from "models";
import GitCommit from "./static/gitInfo";
import "./App.css";
import "./layout-base.css";
import "./layout-theme.css";

@HotkeysTarget @observer
export class App extends React.Component<{ appStore: AppStore }> {
    private previousConnectionStatus: ConnectionStatus;

    constructor(props: { appStore: AppStore }) {
        super(props);

        const appStore = this.props.appStore;

        AST.onReady.then(() => {
            AST.setPalette(appStore.darkTheme ? nightPalette : dayPalette);
            appStore.astReady = true;
            appStore.logStore.addInfo("AST library loaded", ["ast"]);
        });

        CARTACompute.onReady.then(() => {
            appStore.cartaComputeReady = true;
            appStore.logStore.addInfo("Compute module loaded", ["compute"]);
        });

        // Log the frontend git commit hash
        appStore.logStore.addDebug(`Current frontend version: ${GitCommit.logMessage}`, ["version"]);

        this.previousConnectionStatus = ConnectionStatus.CLOSED;
        // Display toasts when connection status changes
        autorun(() => {
            const newConnectionStatus = appStore.backendService.connectionStatus;
            const userString = appStore.username ? ` as ${appStore.username}` : "";
            switch (newConnectionStatus) {
                case ConnectionStatus.ACTIVE:
                    if (appStore.backendService.connectionDropped) {
                        AppToaster.show({icon: "warning-sign", message: `Reconnected to server${userString}. Some errors may occur`, intent: "warning", timeout: 3000});
                    } else {
                        AppToaster.show({icon: "swap-vertical", message: `Connected to CARTA server${userString}`, intent: "success", timeout: 3000});
                    }
                    break;
                case ConnectionStatus.CLOSED:
                    if (this.previousConnectionStatus === ConnectionStatus.ACTIVE) {
                        AppToaster.show({icon: "error", message: "Disconnected from server", intent: "danger", timeout: 3000});
                    }
                    break;
                default:
                    break;
            }
            this.previousConnectionStatus = newConnectionStatus;
        });
    }

    componentDidMount() {
        // initiate application layout
        if (!this.props.appStore.layoutStore.applyLayout(this.props.appStore.preferenceStore.layout)) {
            this.props.appStore.layoutStore.applyLayout(PresetLayout.DEFAULT);
        }
    }

    // GoldenLayout resize handler
    onContainerResize = (width, height) => {
        if (this.props.appStore.layoutStore.dockedLayout) {
            this.props.appStore.layoutStore.dockedLayout.updateSize(width, height);
        }
    };

    public render() {
        const appStore = this.props.appStore;
        let className = "App";
        let glClassName = "gl-container";
        if (appStore.darkTheme) {
            className += " bp3-dark";
            glClassName += " dark-theme";
        }

        document.body.style.backgroundColor = appStore.darkTheme ? Colors.DARK_GRAY4 : Colors.WHITE;

        return (
            <div className={className}>
                <SplashScreenComponent appStore={appStore}/>
                <RootMenuComponent appStore={appStore}/>
                <OverlaySettingsDialogComponent appStore={appStore}/>
                <AuthDialogComponent appStore={appStore}/>
                <FileBrowserDialogComponent appStore={appStore}/>
                <AboutDialogComponent appStore={appStore}/>
                <RegionDialogComponent appStore={appStore}/>
                <PreferenceDialogComponent appStore={appStore}/>
                <SaveLayoutDialogComponent appStore={appStore}/>
                <Alert isOpen={appStore.alertStore.alertVisible} onClose={appStore.alertStore.dismissAlert} canEscapeKeyCancel={true}>
                    <p>{appStore.alertStore.alertText}</p>
                </Alert>
                <Alert
                    isOpen={appStore.alertStore.interactiveAlertVisible}
                    confirmButtonText="Yes"
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
                <FloatingWidgetManagerComponent appStore={appStore}/>
                <Dialog isOpen={appStore.hotkeyDialogVisible} className={"bp3-hotkey-dialog"} canEscapeKeyClose={true} canOutsideClickClose={true} onClose={appStore.hideHotkeyDialog}>
                    <div className={Classes.DIALOG_BODY}>
                        {this.renderHotkeys()}
                    </div>
                </Dialog>
            </div>
        );
    }

    nextChannel = () => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(1, 0);
        }
    };

    prevChannel = () => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(-1, 0);
        }
    };

    nextStokes = () => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(0, 1);
        }
    };

    prevStokes = () => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
            appStore.activeFrame.incrementChannels(0, -1);
        }
    };

    toggleDarkTheme = () => {
        const appStore = this.props.appStore;
        if (appStore.darkTheme) {
            appStore.setLightTheme();
        } else {
            appStore.setDarkTheme();
        }
    };

    toggleCreateMode = () => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
            appStore.activeFrame.regionSet.toggleMode();
        }
    };

    exitCreateMode = () => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame && appStore.activeFrame.regionSet.mode !== RegionMode.MOVING) {
            appStore.activeFrame.regionSet.setMode(RegionMode.MOVING);
        }
    };

    toggleRegionLock = () => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
            const regionSet = appStore.activeFrame.regionSet;
            if (regionSet.selectedRegion) {
                regionSet.selectedRegion.toggleLock();
            }
        }
    };

    unlockAllRegions = () => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
            const regionSet = appStore.activeFrame.regionSet;
            for (const region of regionSet.regions) {
                region.setLocked(false);
            }
        }
    };

    public renderHotkeys() {
        const appStore = this.props.appStore;
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
            <Hotkey key={5} group={regionGroupTitle} global={true} combo="esc" label="Deselect region" onKeyDown={appStore.deselectRegion}/>,
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
            <Hotkey key={2} group={fileGroupTitle} global={true} combo={`${modString}E`} label="Export image" onKeyDown={() => exportImage(appStore.overlayStore.padding, appStore.darkTheme, appStore.activeFrame.frameInfo.fileInfo.name)}/>
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
