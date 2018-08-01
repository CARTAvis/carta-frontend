import * as React from "react";
import * as GoldenLayout from "golden-layout";
import * as AST from "ast_wrapper";
import * as _ from "lodash";
import * as $ from "jquery";
import "./App.css";
import {PlaceholderComponent} from "./components/Placeholder/PlaceholderComponent";
import {RootMenuComponent} from "./components/Menu/RootMenuComponent";
import {ImageViewComponent} from "./components/ImageView/ImageViewComponent";
import {OverlaySettingsDialogComponent} from "./components/Dialogs/OverlaySettings/OverlaySettingsDialogComponent";
import {AppStore} from "./stores/AppStore";
import {observer} from "mobx-react";
import {SpatialProfileStore} from "./stores/SpatialProfileStore";
import {SpatialProfilerComponent} from "./components/SpatialProfiler/SpatialProfilerComponent";
import DevTools from "mobx-react-devtools";
import {FileBrowserDialogComponent} from "./components/Dialogs/FileBrowser/FileBrowserDialogComponent";
import {FileBrowserStore} from "./stores/FileBrowserStore";
import {URLConnectDialogComponent} from "./components/Dialogs/URLConnect/URLConnectDialogComponent";
import {Alert, Hotkey, Hotkeys, HotkeysTarget} from "@blueprintjs/core";
import {RenderConfigComponent} from "./components/RenderConfig/RenderConfigComponent";
import {LogComponent} from "./components/Log/LogComponent";
import ReactResizeDetector from "react-resize-detector";
import {FloatingWidgetManagerComponent} from "./components/FloatingWidgetManager/FloatingWidgetManagerComponent";

@HotkeysTarget @observer
export class App extends React.Component<{ appStore: AppStore }> {

    private glContainer: HTMLElement;

    constructor(props: { appStore: AppStore }) {
        super(props);

        const appStore = this.props.appStore;
        AST.onReady.then(() => {
            appStore.astReady = true;
        });

        // Spatial profile data test: Cursor
        let spatialProfileTest = new SpatialProfileStore();
        spatialProfileTest.channel = 0;
        spatialProfileTest.stokes = 0;
        spatialProfileTest.fileId = 0;
        spatialProfileTest.regionId = -1;
        spatialProfileTest.x = 50;
        spatialProfileTest.y = 25;
        spatialProfileTest.profiles = [{
            start: 0,
            end: 99,
            coordinate: "x",
            values: new Float32Array([
                3.5388799, 3.5388799, 3.5388799, 3.5388799, 3.5388799, 3.5388799, 3.5388799, 3.5388799, 3.5388799, 3.4591336, 3.4561,
                3.4072924, 3.3721337, 3.3832974, 3.4105334, 3.4524047, 3.4580958, 3.4375236, 3.4199784, 3.4393167, 3.4584327, 3.4354074,
                3.4113927, 3.4119952, 3.4215453, 3.4216359, 3.4213932, 3.4325855, 3.4327922, 3.398506, 3.399336, 3.437289, 3.4664133, 3.4839017,
                3.4926062, 3.493307, 3.4989746, 3.4689262, 3.4236014, 3.41666, 3.4301221, 3.4599838, 3.465103, 3.4571815, 3.4482892, 3.4676614,
                3.496216, 3.5149648, 3.524428, 3.5305812, 3.5366623, 3.5252733, 3.5099807, 3.5153043, 3.5147445, 3.5075433, 3.4916546, 3.491599,
                3.5145745, 3.6262999, 3.974516, 4.168722, 4.255072, 4.140615, 3.8385026, 3.6227393, 3.5287037, 3.5015194, 3.506729, 3.605974,
                3.6752694, 3.572344, 3.5049593, 3.6320043, 3.7007551, 3.7074296, 3.7284214, 3.71259, 3.5978725, 3.6083283, 3.6992102, 3.6576242,
                3.557638, 3.5043185, 3.5170414, 3.601478, 3.7584405, 3.8834133, 3.8931904, 3.814434, 3.6640775, 3.5430145, 3.5342467, 3.5469003,
                3.5544434, 3.5179012, 3.4899187, 3.4986625, 3.5043032, 3.5049388])
        }, {
            start: 0,
            end: 99,
            coordinate: "y",
            values: new Float32Array([
                3.4649298, 3.4667826, 3.4629383, 3.466211, 3.4725702, 3.4732285, 3.4746306, 3.4783895, 3.478682, 3.4795306, 3.4864075, 3.4880533,
                3.4830766, 3.4778461, 3.4737396, 3.4744494, 3.4713385, 3.472508, 3.4888499, 3.5189433, 3.5597272, 3.5714843, 3.545362, 3.507979,
                3.4646971, 3.4514968, 3.456988, 3.467615, 3.5172741, 3.5968275, 3.6836078, 3.826141, 3.9673371, 4.0046005, 3.9301507, 3.7608857,
                3.5661457, 3.487837, 3.4686396, 3.4595885, 3.4436076, 3.4299421, 3.4464827, 3.4818513, 3.509606, 3.5292587, 3.536447, 3.522934,
                3.493671, 3.4837656, 3.4992337, 3.5113368, 3.5172505, 3.518542, 3.5195243, 3.5194263, 3.5064735, 3.482475, 3.4564917, 3.4352887,
                3.4251409, 3.417951, 3.4148626, 3.41891, 3.4224284, 3.4267948, 3.435942, 3.4396746, 3.438761, 3.4439719, 3.4420073, 3.4346523,
                3.4311812, 3.4243217, 3.4254432, 3.4329243, 3.43806, 3.4335177, 3.4192092, 3.417901, 3.4213035, 3.4223235, 3.4333832, 3.4351563,
                3.4341018, 3.4453797, 3.4654388, 3.4729166, 3.470188, 3.4677384, 3.468177, 3.4676323, 3.470549, 3.4872558, 3.5295255, 3.5618677,
                3.5519793, 3.5231485, 3.5053034, 3.5028384])
        }];
        appStore.spatialProfiles.set(spatialProfileTest.regionId, spatialProfileTest);
        appStore.backendService.loggingEnabled = true;
        appStore.fileBrowserStore = new FileBrowserStore(appStore.backendService);

        let wsURL;
        if (process.env.NODE_ENV === "development" && process.env.REACT_APP_DEFAULT_ADDRESS) {
            wsURL = process.env.REACT_APP_DEFAULT_ADDRESS;
        }
        else {
            wsURL = `${location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}/socket`;
        }

        console.log(`Connecting to defaullt URL: ${wsURL}`);
        appStore.backendService.connect(wsURL, "1234").subscribe(sessionId => {
            console.log(`Connected with session ID ${sessionId}`);
            this.props.appStore.logStore.addInfo(`Connected to server ${wsURL}`, ["server"]);
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
                        component: "placeholder",
                        title: "Animation",
                        id: "placeholder-0",
                        props: {appStore: this.props.appStore, id: "placeholder-0", label: "Animation placeholder"}
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

        this.props.appStore.addSpatialProfileWidget("spatial-profiler-0", -1, "x");
        this.props.appStore.addSpatialProfileWidget("spatial-profiler-1", -1, "y");

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

        return (
            <div className="App">
                <DevTools/>
                <RootMenuComponent appStore={appStore}/>
                <OverlaySettingsDialogComponent appStore={appStore}/>
                <URLConnectDialogComponent appStore={appStore}/>
                <FileBrowserDialogComponent appStore={appStore}/>
                <Alert isOpen={appStore.alertStore.alertVisible} onClose={appStore.alertStore.dismissAlert} canEscapeKeyCancel={true}>
                    <p>{appStore.alertStore.alertText}</p>
                </Alert>
                <div className="gl-container" ref={ref => this.glContainer = ref}>
                    <ReactResizeDetector handleWidth handleHeight onResize={this.onContainerResize} refreshMode={"throttle"} refreshRate={200}/>
                </div>
                <FloatingWidgetManagerComponent appStore={appStore}/>
            </div>
        );
    }

    public renderHotkeys() {
        const appStore = this.props.appStore;
        return (
            <Hotkeys>
                <Hotkey group="Frame controls" global={true} combo="alt + [" label="Previous frame" onKeyDown={appStore.prevFrame}/>
                <Hotkey group="Frame controls" global={true} combo="alt + ]" label="Next frame" onKeyDown={appStore.nextFrame}/>
                <Hotkey group="Frame controls" global={true} combo="alt + pageup" label="Next channel" onKeyDown={() => {
                    if (appStore.activeFrame) {
                        appStore.activeFrame.incrementChannels(1, 0);
                    }
                }}/>
                <Hotkey group="Frame controls" global={true} combo="alt + pagedown" label="Previous channel" onKeyDown={() => {
                    if (appStore.activeFrame) {
                        appStore.activeFrame.incrementChannels(-1, 0);
                    }
                }}/>
                <Hotkey group="File controls" global={true} combo="alt + o" label="Open file" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser()}/>
                <Hotkey group="File controls" global={true} combo="alt + a" label="Append file" onKeyDown={() => appStore.fileBrowserStore.showFileBrowser(true)}/>
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