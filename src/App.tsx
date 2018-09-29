import * as React from "react";
import * as GoldenLayout from "golden-layout";
import * as AST from "ast_wrapper";
import * as _ from "lodash";
import * as $ from "jquery";
import "./App.css";
import "./layout-theme.css";
import {observer} from "mobx-react";
import DevTools from "mobx-react-devtools";
import ReactResizeDetector from "react-resize-detector";
import {Alert, Colors, Hotkey, Hotkeys, HotkeysTarget} from "@blueprintjs/core";
import {PlaceholderComponent} from "./components/Placeholder/PlaceholderComponent";
import {RootMenuComponent} from "./components/Menu/RootMenuComponent";
import {ImageViewComponent} from "./components/ImageView/ImageViewComponent";
import {OverlaySettingsDialogComponent} from "./components/Dialogs/OverlaySettings/OverlaySettingsDialogComponent";
import {SpatialProfilerComponent} from "./components/SpatialProfiler/SpatialProfilerComponent";
import {FileBrowserDialogComponent} from "./components/Dialogs/FileBrowser/FileBrowserDialogComponent";
import {URLConnectDialogComponent} from "./components/Dialogs/URLConnect/URLConnectDialogComponent";
import {RenderConfigComponent} from "./components/RenderConfig/RenderConfigComponent";
import {LogComponent} from "./components/Log/LogComponent";
import {FloatingWidgetManagerComponent} from "./components/FloatingWidgetManager/FloatingWidgetManagerComponent";
import {AnimatorComponent} from "./components/Animator/AnimatorComponent";
import {FileBrowserStore} from "./stores/FileBrowserStore";
import {AppStore} from "./stores/AppStore";
import GitCommit from "./static/gitInfo";

@HotkeysTarget @observer
export class App extends React.Component<{ appStore: AppStore }> {

    private glContainer: HTMLElement;

    constructor(props: { appStore: AppStore }) {
        super(props);

        const appStore = this.props.appStore;
        AST.onReady.then(() => {
            appStore.astReady = true;
        });
        appStore.backendService.loggingEnabled = true;
        appStore.fileBrowserStore = new FileBrowserStore(appStore.backendService);

        // Log the frontend git commit hash
        appStore.logStore.addDebug(`Current frontend version: ${GitCommit.logMessage}`, ["version"]);
        let wsURL = `${location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}/socket`;
        if (process.env.NODE_ENV === "development") {
            wsURL = process.env.REACT_APP_DEFAULT_ADDRESS ? process.env.REACT_APP_DEFAULT_ADDRESS : wsURL;
        }
        else {
            wsURL = process.env.REACT_APP_DEFAULT_ADDRESS_PROD ? process.env.REACT_APP_DEFAULT_ADDRESS_PROD : wsURL;
        }

        console.log(`Connecting to defaullt URL: ${wsURL}`);
        appStore.backendService.connect(wsURL, "1234").subscribe(sessionId => {
            console.log(`Connected with session ID ${sessionId}`);
            this.props.appStore.logStore.addInfo(`Connected to server ${wsURL}`, ["network"]);
        }, err => console.log(err));
    }

    componentDidMount() {
        const initialLayout: any[] = [{
            type: "row",
            content: [{
                type: "column",
                width: 60,
                content: [{
                    type: "react-component",
                    component: "image-view",
                    title: "No image loaded",
                    height: 75,
                    id: "image-view",
                    isClosable: false,
                    props: {appStore: this.props.appStore, id: "image-view-docked", docked: true}
                }, {
                    type: "stack",
                    content: [{
                        type: "react-component",
                        component: "render-config",
                        title: "Render Configuration",
                        id: "render-config-docked",
                        props: {appStore: this.props.appStore, id: "render-config-docked", docked: true}
                    }, {
                        type: "react-component",
                        component: "log",
                        title: "Log",
                        id: "log-docked",
                        props: {appStore: this.props.appStore, id: "log-docked", docked: true}
                    }, {
                        type: "react-component",
                        component: "animator",
                        title: "Animator",
                        id: "animator-0",
                        props: {appStore: this.props.appStore, id: "animator-0", docked: true}
                    }]
                }]
            }, {
                type: "column",
                content: [{
                    type: "react-component",
                    component: "spatial-profiler",
                    title: "X Profile: Cursor",
                    id: "spatial-profiler-0",
                    props: {appStore: this.props.appStore, id: "spatial-profiler-0", docked: true}
                }, {
                    type: "react-component",
                    component: "spatial-profiler",
                    title: "Y Profile: Cursor",
                    id: "spatial-profiler-1",
                    props: {appStore: this.props.appStore, id: "spatial-profiler-1", docked: true}
                }, {
                    type: "react-component",
                    component: "placeholder",
                    title: "Z Profile: Cursor",
                    id: "placeholder-1",
                    props: {appStore: this.props.appStore, id: "placeholder-1", label: "Spectral placeholder"}
                }, {
                    type: "stack",
                    height: 33.3,
                    content: [{
                        type: "react-component",
                        component: "placeholder",
                        title: "Histogram: Region #1",
                        id: "placeholder-2",
                        props: {appStore: this.props.appStore, id: "placeholder-2", label: "Histogram placeholder"}
                    }, {
                        type: "react-component",
                        component: "placeholder",
                        title: "Statistics: Region #1",
                        id: "placeholder-3",
                        props: {appStore: this.props.appStore, id: "placeholder-3", label: "Statistics placeholder"}
                    }]
                }]
            }]
        }];

        this.props.appStore.addSpatialProfileWidget("spatial-profiler-0", -1, 0, "x");
        this.props.appStore.addSpatialProfileWidget("spatial-profiler-1", -1, 0, "y");

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

        layout.registerComponent("placeholder", PlaceholderComponent);
        layout.registerComponent("image-view", ImageViewComponent);
        layout.registerComponent("spatial-profiler", SpatialProfilerComponent);
        layout.registerComponent("render-config", RenderConfigComponent);
        layout.registerComponent("log", LogComponent);
        layout.registerComponent("animator", AnimatorComponent);

        layout.on("stackCreated", (stack) => {
            let unpinButton = $(`<div class="pin-icon"><span class="bp3-icon-standard bp3-icon-unpin"/></div>`);
            unpinButton.on("click", () => this.onUnpinClicked(stack.getActiveContentItem()));

            stack.header.controlsContainer.prepend(unpinButton);
        });

        layout.on("itemCreated", item => {
            if (item.config.type === "component") {
                const floatingWidgetStore = this.props.appStore.floatingWidgetStore;
                if (floatingWidgetStore.widgets.find(w => w.id === item.config.id)) {
                    floatingWidgetStore.removeWidget(item.config.id);
                }
            }
        });

        layout.on("itemDestroyed", item => {
            if (item.config.type === "component") {
                console.log(`itemDestroyed: ${item.config.id}`);
            }
        });

        this.props.appStore.layoutSettings.setLayout(layout);
        this.props.appStore.layoutSettings.layout.init();
    }

    // GoldenLayout resize handler
    onContainerResize = (width, height) => {
        const appStore = this.props.appStore;
        if (appStore.layoutSettings.layout) {
            appStore.layoutSettings.layout.updateSize(width, height);
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
        else {
            glClassName += " light-theme";
        }

        document.body.style.backgroundColor = appStore.darkTheme ? Colors.DARK_GRAY4 : Colors.WHITE;

        return (
            <div className={className}>
                {/*<DevTools/>*/}
                <RootMenuComponent appStore={appStore}/>
                <OverlaySettingsDialogComponent appStore={appStore}/>
                <URLConnectDialogComponent appStore={appStore}/>
                <FileBrowserDialogComponent appStore={appStore}/>
                <Alert isOpen={appStore.alertStore.alertVisible} onClose={appStore.alertStore.dismissAlert} canEscapeKeyCancel={true}>
                    <p>{appStore.alertStore.alertText}</p>
                </Alert>
                <div className={glClassName} ref={ref => this.glContainer = ref}>
                    <ReactResizeDetector handleWidth handleHeight onResize={this.onContainerResize} refreshMode={"throttle"} refreshRate={200}/>
                </div>
                <FloatingWidgetManagerComponent appStore={appStore}/>
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
        }
        else {
            appStore.setDarkTheme();
        }
    };

    public renderHotkeys() {
        const appStore = this.props.appStore;

        const animatorHotkeys = [
            <Hotkey key={0} group="Frame controls" global={true} combo="alt + ]" label="Next frame" onKeyDown={appStore.nextFrame}/>,
            <Hotkey key={1} group="Frame controls" global={true} combo="alt + [" label="Previous frame" onKeyDown={appStore.prevFrame}/>,
            <Hotkey key={2} group="Frame controls" global={true} combo="alt + pageup" label="Next channel" onKeyDown={this.nextChannel}/>,
            <Hotkey key={3} group="Frame controls" global={true} combo="alt + pagedown" label="Previous channel" onKeyDown={this.prevChannel}/>,
            <Hotkey key={4} group="Frame controls" global={true} combo="alt + shift + pageup" label="Next Stokes cube" onKeyDown={this.nextStokes}/>,
            <Hotkey key={5} group="Frame controls" global={true} combo="alt + shift + pagedown" label="Previous Stokes cube" onKeyDown={this.prevStokes}/>
        ];

        const fileHotkeys = [
            <Hotkey key={0} group="File controls" global={true} combo="alt + o" label="Open file" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser()}/>,
            <Hotkey key={1} group="File controls" global={true} combo="alt + a" label="Append file" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser(true)}/>
        ];

        return (
            <Hotkeys>
                {animatorHotkeys}
                {fileHotkeys}
                <Hotkey group="Appearance" global={true} combo="shift + d" label="Toggle dark theme" onKeyDown={this.toggleDarkTheme}/>
                <Hotkey group="Cursor" global={true} combo="shift + space" label="Toggle frozen cursor" onKeyDown={appStore.toggleCursorFrozen}/>
            </Hotkeys>
        );
    }

    private getDefaultWidgetConfig(type: string) {
        switch (type) {
            case ImageViewComponent.WIDGET_CONFIG.type:
                return ImageViewComponent.WIDGET_CONFIG;
            case RenderConfigComponent.WIDGET_CONFIG.type:
                return RenderConfigComponent.WIDGET_CONFIG;
            case LogComponent.WIDGET_CONFIG.type:
                return LogComponent.WIDGET_CONFIG;
            case AnimatorComponent.WIDGET_CONFIG.type:
                return AnimatorComponent.WIDGET_CONFIG;
            case SpatialProfilerComponent.WIDGET_CONFIG.type:
                return SpatialProfilerComponent.WIDGET_CONFIG;
            default:
                return PlaceholderComponent.WIDGET_CONFIG;
        }
    }

    onUnpinClicked = (item: GoldenLayout.ContentItem) => {
        const itemConfig = item.config as GoldenLayout.ReactComponentConfig;
        const id = itemConfig.id as string;
        const type = itemConfig.component;
        const title = itemConfig.title;
        // Get widget type from config
        let widgetConfig = this.getDefaultWidgetConfig(type);
        widgetConfig.id = id;
        widgetConfig.title = title;

        // Set default size and position from the existing item
        const container = item["container"] as GoldenLayout.Container;
        if (container && container.width && container.height) {
            // Snap size to grid
            widgetConfig.defaultWidth = Math.round(container.width / 25.0) * 25;
            widgetConfig.defaultHeight = Math.round(container.height / 25.0) * 25;
            const el = container["_element"][0] as HTMLElement;
            // Snap position to grid and adjust for title and container offset
            widgetConfig.defaultX = Math.round(el.offsetLeft / 25.0) * 25 + 5;
            widgetConfig.defaultY = Math.round(el.offsetTop / 25.0) * 25 - 25;
        }

        this.props.appStore.floatingWidgetStore.addWidget(widgetConfig);
        item.remove();
    };
}