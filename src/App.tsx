import * as React from "react";
import * as GoldenLayout from "golden-layout";
import * as AST from "ast_wrapper";
import {observer} from "mobx-react";
import DevTools from "mobx-react-devtools";
import ReactResizeDetector from "react-resize-detector";
import {Alert, Classes, Colors, Dialog, Hotkey, Hotkeys, HotkeysTarget} from "@blueprintjs/core";
import {RootMenuComponent, FloatingWidgetManagerComponent, exportImage} from "./components";
import {AboutDialogComponent, FileBrowserDialogComponent, OverlaySettingsDialogComponent, URLConnectDialogComponent} from "./components/Dialogs";
import {AppStore, FileBrowserStore, dayPalette, nightPalette} from "./stores";
import {smoothStepOffset} from "./utilities";
import GitCommit from "./static/gitInfo";
import "./App.css";
import "./layout-theme.css";

@HotkeysTarget @observer
export class App extends React.Component<{ appStore: AppStore }> {

    private glContainer: HTMLElement;

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

        appStore.backendService.connect(wsURL, "1234").subscribe(sessionId => {
            console.log(`Connected with session ID ${sessionId}`);
            connected = true;
            appStore.logStore.addInfo(`Connected to server ${wsURL}`, ["network"]);

            if (appStore.astReady && fileSearchParam) {
                autoFileLoaded = true;
                appStore.addFrame(folderSearchParam, fileSearchParam, "", 0);
            }

        }, err => console.log(err));
    }

    componentDidMount() {
        const widgetsStore = this.props.appStore.widgetsStore;
        // Adjust default image view size based on window height
        const defaultImageViewFraction = smoothStepOffset(window.innerHeight, 720, 1080, 65, 75);
        const initialLayout: any[] = [{
            type: "row",
            content: [{
                type: "column",
                width: 60,
                content: [{
                    type: "react-component",
                    component: "image-view",
                    title: "No image loaded",
                    height: defaultImageViewFraction,
                    id: "image-view",
                    isClosable: false,
                    props: {appStore: this.props.appStore, id: "image-view-docked", docked: true}
                }, {
                    type: "stack",
                    content: [{
                        type: "react-component",
                        component: "render-config",
                        title: "Render Configuration",
                        id: "render-config-0",
                        props: {appStore: this.props.appStore, id: "render-config-0", docked: true}
                    }, {
                        type: "react-component",
                        component: "log",
                        title: "Log",
                        id: "log-docked",
                        props: {appStore: this.props.appStore, id: "log-docked", docked: true}
                    }]
                }]
            }, {
                type: "column",
                content: [{
                    type: "react-component",
                    component: "spatial-profiler",
                    id: "spatial-profiler-0",
                    props: {appStore: this.props.appStore, id: "spatial-profiler-0", docked: true}
                }, {
                    type: "react-component",
                    component: "spatial-profiler",
                    id: "spatial-profiler-1",
                    props: {appStore: this.props.appStore, id: "spatial-profiler-1", docked: true}
                }, {
                    type: "react-component",
                    component: "spectral-profiler",
                    id: "spectral-profiler-0",
                    props: {appStore: this.props.appStore, id: "spectral-profiler-0", docked: true}
                }, {
                    type: "stack",
                    content: [{
                        type: "react-component",
                        component: "animator",
                        title: "Animator",
                        id: "animator-0",
                        props: {appStore: this.props.appStore, id: "animator-0", docked: true}
                    }]
                }]
            }]
        }];

        widgetsStore.addSpatialProfileWidget("spatial-profiler-0", -1, 0, "x");
        widgetsStore.addSpatialProfileWidget("spatial-profiler-1", -1, 0, "y");
        widgetsStore.addSpectralProfileWidget("spectral-profiler-0", -1, 0, "z");
        widgetsStore.addRenderConfigWidget("render-config-0");

        const layout = new GoldenLayout({
            settings: {
                showPopoutIcon: false,
                showCloseIcon: false
            },
            dimensions: {
                minItemWidth: 200,
                minItemHeight: 200,
                dragProxyWidth: 600,
                dragProxyHeight: 270,
            },
            content: initialLayout
        }, this.glContainer);

        widgetsStore.setDockedLayout(layout);
        this.props.appStore.setDarkTheme();
        this.props.appStore.setLightTheme();
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
                {process.env.NODE_ENV === "development" && <DevTools/>}
                <RootMenuComponent appStore={appStore}/>
                <OverlaySettingsDialogComponent appStore={appStore}/>
                <URLConnectDialogComponent appStore={appStore}/>
                <FileBrowserDialogComponent appStore={appStore}/>
                <AboutDialogComponent appStore={appStore}/>
                <Alert isOpen={appStore.alertStore.alertVisible} onClose={appStore.alertStore.dismissAlert} canEscapeKeyCancel={true}>
                    <p>{appStore.alertStore.alertText}</p>
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

    public renderHotkeys() {
        const appStore = this.props.appStore;
        const modString = appStore.modifierString;

        const animatorHotkeys = [
            <Hotkey key={0} group="Frame controls" global={true} combo={`${modString}]`} label="Next frame" onKeyDown={appStore.nextFrame}/>,
            <Hotkey key={1} group="Frame controls" global={true} combo={`${modString}[`} label="Previous frame" onKeyDown={appStore.prevFrame}/>,
            <Hotkey key={2} group="Frame controls" global={true} combo={`${modString}up`} label="Next channel" onKeyDown={this.nextChannel}/>,
            <Hotkey key={3} group="Frame controls" global={true} combo={`${modString}down`} label="Previous channel" onKeyDown={this.prevChannel}/>,
            <Hotkey key={4} group="Frame controls" global={true} combo={`${modString}shift + up`} label="Next Stokes cube" onKeyDown={this.nextStokes}/>,
            <Hotkey key={5} group="Frame controls" global={true} combo={`${modString}shift + down`} label="Previous Stokes cube" onKeyDown={this.prevStokes}/>
        ];

        const fileHotkeys = [
            <Hotkey key={0} group="File controls" global={true} combo={`${modString}O`} label="Open image" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser()}/>,
            <Hotkey key={1} group="File controls" global={true} combo={`${modString}L`} label="Append image" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser(true)}/>,
            <Hotkey key={2} group="File controls" global={true} combo={`${modString}E`} label="Export image" onKeyDown={() => exportImage(appStore.overlayStore.padding, appStore.darkTheme, appStore.activeFrame.frameInfo.fileInfo.name)}/>
        ];

        return (
            <Hotkeys>
                {animatorHotkeys}
                {fileHotkeys}
                <Hotkey group="Appearance" global={true} combo="shift + D" label="Toggle light/dark theme" onKeyDown={this.toggleDarkTheme}/>
                <Hotkey group="Cursor" global={true} combo="F" label="Freeze/unfreeze cursor position" onKeyDown={appStore.toggleCursorFrozen}/>
            </Hotkeys>
        );
    }
}
