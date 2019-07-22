import * as React from "react";
import * as GoldenLayout from "golden-layout";
import * as AST from "ast_wrapper";
import {observer} from "mobx-react";
import {autorun} from "mobx";
import ReactResizeDetector from "react-resize-detector";
import {Alert, Classes, Colors, Dialog, Hotkey, Hotkeys, HotkeysTarget, Intent} from "@blueprintjs/core";
import {exportImage, FloatingWidgetManagerComponent, RootMenuComponent} from "./components";
import {AppToaster} from "./components/Shared";
import {
    AboutDialogComponent,
    ApiKeyDialogComponent,
    FileBrowserDialogComponent,
    OverlaySettingsDialogComponent,
    RegionDialogComponent,
    URLConnectDialogComponent,
    PreferenceDialogComponent,
    SaveLayoutDialogComponent
} from "./components/Dialogs";
import {AppStore, dayPalette, FileBrowserStore, nightPalette, RegionMode, WidgetsStore} from "./stores";
import {Layout} from "models";
import {ConnectionStatus} from "./services";
import {smoothStepOffset} from "./utilities";
import GitCommit from "./static/gitInfo";
import "./App.css";
import "./layout-theme.css";

@HotkeysTarget @observer
export class App extends React.Component<{ appStore: AppStore }> {

    private glContainer: HTMLElement;
    private previousConnectionStatus: ConnectionStatus;

    constructor(props: { appStore: AppStore }) {
        super(props);

        const appStore = this.props.appStore;

        let wsURL = `${location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}/socket`;
        if (process.env.NODE_ENV === "development") {
            wsURL = process.env.REACT_APP_DEFAULT_ADDRESS ? process.env.REACT_APP_DEFAULT_ADDRESS : wsURL;
        } else {
            wsURL = process.env.REACT_APP_DEFAULT_ADDRESS_PROD ? process.env.REACT_APP_DEFAULT_ADDRESS_PROD : wsURL;
        }

        // Check for URL query parameters as a final override
        const url = new URL(window.location.href);
        const socketUrl = url.searchParams.get("socketUrl");

        if (socketUrl) {
            wsURL = socketUrl;
            console.log(`Connecting to override URL: ${wsURL}`);
        } else {
            console.log(`Connecting to default URL: ${wsURL}`);
        }

        const folderSearchParam = url.searchParams.get("folder");
        const fileSearchParam = url.searchParams.get("file");

        let connected = false;
        let autoFileLoaded = false;

        AST.onReady.then(() => {
            AST.setPalette(appStore.darkTheme ? nightPalette : dayPalette);
            appStore.astReady = true;
            if (connected && !autoFileLoaded && fileSearchParam) {
                appStore.addFrame(folderSearchParam, fileSearchParam, "", 0);
            }
        });
        appStore.backendService.loggingEnabled = true;
        appStore.fileBrowserStore = new FileBrowserStore(appStore.backendService);

        // Log the frontend git commit hash
        appStore.logStore.addDebug(`Current frontend version: ${GitCommit.logMessage}`, ["version"]);

        this.previousConnectionStatus = ConnectionStatus.CLOSED;
        // Display toasts when connection status changes
        autorun(() => {
            const newConnectionStatus = appStore.backendService.connectionStatus;
            switch (newConnectionStatus) {
                case ConnectionStatus.ACTIVE:
                    if (appStore.backendService.connectionDropped) {
                        AppToaster.show({icon: "warning-sign", message: "Reconnected to server. Some errors may occur", intent: "warning", timeout: 3000});
                    } else {
                        AppToaster.show({icon: "swap-vertical", message: "Connected to CARTA server", intent: "success", timeout: 3000});
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

        appStore.backendService.connect(wsURL, appStore.apiKey).subscribe(sessionId => {
            console.log(`Connected with session ID ${sessionId}`);
            connected = true;
            appStore.logStore.addInfo(`Connected to server ${wsURL}`, ["network"]);

            if (appStore.astReady && fileSearchParam) {
                autoFileLoaded = true;
                appStore.addFrame(folderSearchParam, fileSearchParam, "", 0);
            }

            if (appStore.preferenceStore.autoLaunch) {
                appStore.fileBrowserStore.showFileBrowser();
            }
        }, err => console.log(err));
    }

    componentDidMount() {
        const widgetsStore = this.props.appStore.widgetsStore;
        // Adjust layout properties based on window dimensions
        const defaultImageViewFraction = smoothStepOffset(window.innerHeight, 720, 1080, 65, 75);

        // TODO: replace configs with AppStore.COMPONENT_CONFIG
        const configs = {
            imageView: {
                type: "react-component",
                component: "image-view",
                title: "No image loaded",
                height: defaultImageViewFraction,
                id: "image-view",
                isClosable: false,
                props: {appStore: this.props.appStore, id: "image-view-docked", docked: true}
            },
            // left bottom components in stack: render config, region list, animator
            renderConfig: {
                type: "react-component",
                component: "render-config",
                title: "Render Configuration",
                id: "render-config-0",
                props: {appStore: this.props.appStore, id: "render-config-0", docked: true}
            },
            regionList: {
                type: "react-component",
                component: "region-list",
                title: "Region List",
                id: "region-list-0",
                props: {appStore: this.props.appStore, id: "region-list-0", docked: true}
            },
            animator: {
                type: "react-component",
                component: "animator",
                title: "Animator",
                id: "animator-0",
                props: {appStore: this.props.appStore, id: "animator-0", docked: true}
            },
            // right column components: X/Y/Z profiler, statistics
            spatialProfilerX: {
                type: "react-component",
                component: "spatial-profiler",
                id: "spatial-profiler-0",
                props: {appStore: this.props.appStore, id: "spatial-profiler-0", docked: true}
            },
            spatialProfilerY: {
                type: "react-component",
                component: "spatial-profiler",
                id: "spatial-profiler-1",
                props: {appStore: this.props.appStore, id: "spatial-profiler-1", docked: true}
            },
            spectralProfilerZ: {
                type: "react-component",
                component: "spectral-profiler",
                id: "spectral-profiler-0",
                title: "Z Profile: Cursor",
                props: {appStore: this.props.appStore, id: "spectral-profiler-0", docked: true}
            },
            stats: {
                type: "react-component",
                component: "stats",
                title: "Statistics",
                id: "stats-0",
                props: {appStore: this.props.appStore, id: "stats-0", docked: true}
            }
        };

        // common components in left bottom
        widgetsStore.addRenderConfigWidget(configs.renderConfig.id);
        widgetsStore.addAnimatorWidget(configs.animator.id);
        widgetsStore.addRegionListWidget(configs.regionList.id);

        // customize layout
        let customizedLayout;
        switch (this.props.appStore.preferenceStore.layout) {
            case Layout.CUBEVIEW:
                customizedLayout = this.genCubeViewLayout(configs, widgetsStore);
                break;
            case Layout.CUBEANALYSIS:
                customizedLayout = this.genCubeAnalysisLayout(configs, widgetsStore);
                break;
            case Layout.CONTINUUMANALYSIS:
                customizedLayout = this.genContinuumAnalysisLayout(configs, widgetsStore);
                break;
            case Layout.DEFAULT: default:
                customizedLayout = this.genDefaultLayout(configs, widgetsStore);
                break;
        }

        const arrangementConfig = {
            type: "row",
            content: [{
                type: "column",
                width: 60,
                content: [configs.imageView, customizedLayout.leftBottomContent]
            }, {
                type: "column",
                content: customizedLayout.rightColumnContent
            }]
        };

        const mainLayoutConfig = {
            settings: {
                showPopoutIcon: false,
                showCloseIcon: false
            },
            dimensions: {
                minItemWidth: 250,
                minItemHeight: 200,
                dragProxyWidth: 600,
                dragProxyHeight: 270,
            },
            content: [arrangementConfig]
        };
        widgetsStore.setDockedLayout(new GoldenLayout(mainLayoutConfig, this.glContainer));
    }

    private genDefaultLayout(configs: any, widgetsStore: WidgetsStore) {
        widgetsStore.addSpatialProfileWidget(configs.spatialProfilerX.id, "x", -1, 0);
        widgetsStore.addSpatialProfileWidget(configs.spatialProfilerY.id, "y", -1, 0);

        return {
            leftBottomContent: {
                type: "stack",
                content: [configs.renderConfig]
            },
            rightColumnContent: [configs.spatialProfilerX, configs.spatialProfilerY, {
                type: "stack",
                content: [configs.animator, configs.regionList]
            }]
        };
    }

    private genCubeViewLayout(configs: any, widgetsStore: WidgetsStore) {
        widgetsStore.addSpatialProfileWidget(configs.spatialProfilerX.id, "x", -1, 0);
        widgetsStore.addSpatialProfileWidget(configs.spatialProfilerY.id, "y", -1, 0);
        widgetsStore.addSpectralProfileWidget(configs.spectralProfilerZ.id, "z");

        return {
            leftBottomContent: {
                type: "stack",
                content: [configs.animator, configs.renderConfig, configs.regionList]
            },
            rightColumnContent: [configs.spatialProfilerX, configs.spatialProfilerY, configs.spectralProfilerZ]
        };
    }

    private genCubeAnalysisLayout(configs: any, widgetsStore: WidgetsStore) {
        widgetsStore.addSpectralProfileWidget(configs.spectralProfilerZ.id, "z");
        widgetsStore.addStatsWidget(configs.stats.id);

        return {
            leftBottomContent: {
                type: "stack",
                content: [configs.animator, configs.renderConfig, configs.regionList]
            },
            rightColumnContent: [configs.spectralProfilerZ, configs.stats]
        };
    }

    private genContinuumAnalysisLayout(configs: any, widgetsStore: WidgetsStore) {
        widgetsStore.addSpatialProfileWidget(configs.spatialProfilerX.id, "x", -1, 0);
        widgetsStore.addSpatialProfileWidget(configs.spatialProfilerY.id, "y", -1, 0);
        widgetsStore.addStatsWidget(configs.stats.id);

        return {
            leftBottomContent: {
                type: "stack",
                content: [configs.renderConfig, configs.regionList, configs.animator]
            },
            rightColumnContent: [configs.spatialProfilerX, configs.spatialProfilerY, configs.stats]
        };
    }

    // GoldenLayout resize handler
    onContainerResize = (width, height) => {
        if (this.props.appStore.widgetsStore.dockedLayout) {
            this.props.appStore.widgetsStore.dockedLayout.updateSize(width, height);
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
                <RootMenuComponent appStore={appStore}/>
                <OverlaySettingsDialogComponent appStore={appStore}/>
                <URLConnectDialogComponent appStore={appStore}/>
                <ApiKeyDialogComponent appStore={appStore}/>
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
                    onConfirm={() => {
                        appStore.alertStore.dismissInteractiveAlert();
                        appStore.layoutStore.saveLayout();
                    }}
                    onCancel={appStore.alertStore.dismissInteractiveAlert}
                    canEscapeKeyCancel={true}
                >
                    <p>{appStore.alertStore.interactiveAlertText}</p>
                </Alert>
                <div className={glClassName} ref={ref => this.glContainer = ref}>
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
            <Hotkey key={1} group={regionGroupTitle} global={true} combo="del" label="Delete selected region" onKeyDown={appStore.deleteSelectedRegion}/>,
            <Hotkey key={2} group={regionGroupTitle} global={true} combo="backspace" label="Delete selected region" onKeyDown={appStore.deleteSelectedRegion}/>,
            <Hotkey key={3} group={regionGroupTitle} global={true} combo="esc" label="Deselect region" onKeyDown={appStore.deselectRegion}/>,
            <Hotkey key={4} group={regionGroupTitle} global={true} combo="mod" label="Switch region creation mode"/>,
            <Hotkey key={5} group={regionGroupTitle} global={true} combo={"shift"} label="Symmetric region creation"/>,
            <Hotkey key={6} group={regionGroupTitle} global={true} combo="double-click" label="Region properties"/>
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
            <Hotkey key={0} group={fileGroupTitle} global={true} combo={`${modString}O`} label="Open image" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser()}/>,
            <Hotkey key={1} group={fileGroupTitle} global={true} combo={`${modString}L`} label="Append image" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser(true)}/>,
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
