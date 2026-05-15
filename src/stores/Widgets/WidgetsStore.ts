import * as React from "react";
import {Classes} from "@blueprintjs/core";
import {Actions, type BorderNode, type ITabRenderValues, type ITabSetRenderValues, type TabNode, type TabSetNode} from "flexlayout-react";
import {action, computed, makeObservable, observable, reaction} from "mobx";
import {Observer} from "mobx-react";

import {
    AnimatorComponent,
    CatalogOverlayComponent,
    CatalogPlotComponent,
    ChannelMapControlComponent,
    CursorInfoComponent,
    HistogramComponent,
    ImageViewComponent,
    LayerListComponent,
    LogComponent,
    PvGeneratorComponent,
    PvPreviewComponent,
    RegionListComponent,
    RenderConfigComponent,
    SpatialProfilerComponent,
    SpectralLineQueryComponent,
    SpectralProfilerComponent,
    StatsComponent,
    StokesAnalysisComponent
} from "components";
import {CatalogPlotType, HelpType, ImagePanelMode, ImageType, PreferenceKeys, WidgetType} from "enums";
import {COMPONENT_MAP, createWidgetButton, type DefaultWidgetConfig, FlexLayoutDomMarker, GetDefaultWidgetConfig, GetDefaultWidgetSettingsConfig} from "models";
import {AppStore, CatalogStore, HelpStore, LayoutStore, PreferenceStore} from "stores";
import {
    ACTIVE_FILE_ID,
    CatalogPlotWidgetStore,
    type CatalogPlotWidgetStoreProps,
    CatalogWidgetStore,
    EmptyWidgetStore,
    HistogramWidgetStore,
    LayerListWidgetStore,
    PvGeneratorWidgetStore,
    RegionWidgetStore,
    RenderConfigWidgetStore,
    SpatialProfileWidgetStore,
    SpectralLineQueryWidgetStore,
    SpectralProfileWidgetStore,
    StatsWidgetStore,
    StokesAnalysisWidgetStore
} from "stores/Widgets";

export type {DefaultWidgetConfig} from "models";

export class WidgetConfig implements DefaultWidgetConfig {
    id: string;
    readonly type: string;
    readonly minWidth: number;
    readonly minHeight: number;
    @observable defaultWidth: number;
    @observable defaultHeight: number;
    @observable defaultX?: number;
    @observable defaultY?: number;
    readonly isCloseable: boolean;
    @observable title?: string;
    parentId?: string;
    parentType?: string;
    helpType?: HelpType | HelpType[];
    componentId?: string;

    @action setDefaultPosition = (x: number, y: number) => {
        this.defaultX = x;
        this.defaultY = y;
    };

    @action setDefaultSize = (w: number, h: number) => {
        this.defaultWidth = w;
        this.defaultHeight = h;
    };

    constructor(id: string, defaultConfig: DefaultWidgetConfig) {
        this.id = id;
        this.type = defaultConfig.type;
        this.minWidth = defaultConfig.minWidth;
        this.minHeight = defaultConfig.minHeight;
        this.defaultWidth = defaultConfig.defaultWidth || defaultConfig.minWidth;
        this.defaultHeight = defaultConfig.defaultHeight || defaultConfig.minHeight;
        this.defaultX = defaultConfig.defaultX;
        this.defaultY = defaultConfig.defaultY;
        this.isCloseable = defaultConfig.isCloseable;
        this.title = defaultConfig.title;
        this.parentId = defaultConfig.parentId;
        this.parentType = defaultConfig.parentType;
        this.helpType = defaultConfig.helpType;
        this.componentId = defaultConfig.componentId;
        makeObservable(this);
    }
}

export class WidgetProps {
    id: string;
    docked: boolean;
    floatingSettingsId?: string;
}

interface Disposable {
    dispose(): void;
}

export class WidgetsStore {
    private static staticInstance: WidgetsStore;

    static get Instance() {
        if (!WidgetsStore.staticInstance) {
            WidgetsStore.staticInstance = new WidgetsStore();
        }
        return WidgetsStore.staticInstance;
    }

    @observable floatingWidgets: WidgetConfig[] = [];
    @observable renderConfigWidgets: Map<string, RenderConfigWidgetStore> = new Map<string, RenderConfigWidgetStore>();
    @observable spatialProfileWidgets: Map<string, SpatialProfileWidgetStore> = new Map<string, SpatialProfileWidgetStore>();
    @observable spectralProfileWidgets: Map<string, SpectralProfileWidgetStore> = new Map<string, SpectralProfileWidgetStore>();
    @observable statsWidgets: Map<string, StatsWidgetStore> = new Map<string, StatsWidgetStore>();
    @observable histogramWidgets: Map<string, HistogramWidgetStore> = new Map<string, HistogramWidgetStore>();
    @observable layerListWidgets: Map<string, LayerListWidgetStore> = new Map<string, LayerListWidgetStore>();
    @observable logWidgets: Map<string, EmptyWidgetStore> = new Map<string, EmptyWidgetStore>();
    @observable regionListWidgets: Map<string, EmptyWidgetStore> = new Map<string, EmptyWidgetStore>();
    @observable animatorWidgets: Map<string, EmptyWidgetStore> = new Map<string, EmptyWidgetStore>();
    @observable channelMapControlWidgets: Map<string, EmptyWidgetStore> = new Map<string, EmptyWidgetStore>();
    @observable stokesAnalysisWidgets: Map<string, StokesAnalysisWidgetStore> = new Map<string, StokesAnalysisWidgetStore>();
    @observable floatingSettingsWidgets: Map<string, string> = new Map<string, string>();
    @observable catalogWidgets: Map<string, CatalogWidgetStore> = new Map<string, CatalogWidgetStore>();
    @observable catalogPlotWidgets: Map<string, CatalogPlotWidgetStore> = new Map<string, CatalogPlotWidgetStore>();
    @observable spectralLineQueryWidgets: Map<string, SpectralLineQueryWidgetStore> = new Map<string, SpectralLineQueryWidgetStore>();
    @observable cursorInfoWidgets: Map<string, EmptyWidgetStore> = new Map<string, EmptyWidgetStore>();
    @observable pvGeneratorWidgets: Map<string, PvGeneratorWidgetStore> = new Map<string, PvGeneratorWidgetStore>();

    private widgetsMap: Map<string, Map<string, any>>;
    private defaultFloatingWidgetOffset: number;
    private beingUnpinned: Set<string> = new Set();

    private static readonly showCogWidgets = ["image-view", "spatial-profiler", "spectral-profiler", "histogram", "render-config", "stokes", "catalog-overlay", "layer-list"];
    private static readonly hideHelpButtonWidgets = ["pv-preview"];

    public readonly CARTAWidgets = new Map<WidgetType, {isCustomIcon: boolean; icon: string; onClick: () => void; widgetConfig: DefaultWidgetConfig}>([
        [WidgetType.Region, {isCustomIcon: true, icon: "regionList", onClick: () => WidgetsStore.Instance.createFloatingRegionListWidget(), widgetConfig: RegionListComponent.WIDGET_CONFIG}],
        [WidgetType.Log, {isCustomIcon: false, icon: "application", onClick: () => WidgetsStore.Instance.createFloatingLogWidget(), widgetConfig: LogComponent.WIDGET_CONFIG}],
        [WidgetType.SpatialProfiler, {isCustomIcon: true, icon: "spatialProfiler", onClick: () => WidgetsStore.Instance.createFloatingSpatialProfilerWidget(), widgetConfig: SpatialProfilerComponent.WIDGET_CONFIG}],
        [WidgetType.SpectralProfiler, {isCustomIcon: true, icon: "spectralProfiler", onClick: () => WidgetsStore.Instance.createFloatingSpectralProfilerWidget(), widgetConfig: SpectralProfilerComponent.WIDGET_CONFIG}],
        [WidgetType.Statistics, {isCustomIcon: false, icon: "calculator", onClick: () => WidgetsStore.Instance.createFloatingStatsWidget(), widgetConfig: StatsComponent.WIDGET_CONFIG}],
        [WidgetType.Histogram, {isCustomIcon: false, icon: "timeline-bar-chart", onClick: () => WidgetsStore.Instance.createFloatingHistogramWidget(), widgetConfig: HistogramComponent.WIDGET_CONFIG}],
        [WidgetType.Animator, {isCustomIcon: false, icon: "video", onClick: () => WidgetsStore.Instance.createFloatingAnimatorWidget(), widgetConfig: AnimatorComponent.WIDGET_CONFIG}],
        [WidgetType.ChannelMapControl, {isCustomIcon: false, icon: "heat-grid", onClick: () => WidgetsStore.Instance.createFloatingChannelMapControlWidget(), widgetConfig: ChannelMapControlComponent.WIDGET_CONFIG}],
        [WidgetType.RenderConfig, {isCustomIcon: false, icon: "style", onClick: () => WidgetsStore.Instance.createFloatingRenderWidget(), widgetConfig: RenderConfigComponent.WIDGET_CONFIG}],
        [WidgetType.StokesAnalysis, {isCustomIcon: true, icon: "stokes", onClick: () => WidgetsStore.Instance.createFloatingStokesWidget(), widgetConfig: StokesAnalysisComponent.WIDGET_CONFIG}],
        [WidgetType.ImageList, {isCustomIcon: false, icon: "layers", onClick: () => WidgetsStore.Instance.createFloatingLayerListWidget(), widgetConfig: LayerListComponent.WIDGET_CONFIG}],
        [WidgetType.Catalog, {isCustomIcon: false, icon: "heatmap", onClick: () => WidgetsStore.Instance.reloadFloatingCatalogWidget(), widgetConfig: CatalogOverlayComponent.WIDGET_CONFIG}],
        [WidgetType.SpectralLineQuery, {isCustomIcon: true, icon: "spectralLineQuery", onClick: () => WidgetsStore.Instance.createFloatingSpectralLineQueryWidget(), widgetConfig: SpectralLineQueryComponent.WIDGET_CONFIG}],
        [WidgetType.CursorInfo, {isCustomIcon: true, icon: "cursor", onClick: () => WidgetsStore.Instance.createFloatingCursorInfoWidget(), widgetConfig: CursorInfoComponent.WIDGET_CONFIG}],
        [WidgetType.PvGenerator, {isCustomIcon: true, icon: "pv", onClick: () => WidgetsStore.Instance.createFloatingPvGeneratorWidget(), widgetConfig: PvGeneratorComponent.WIDGET_CONFIG}]
    ]);

    @action public removeFrameFromRegionWidgets(fileId: number = ACTIVE_FILE_ID) {
        this.widgetsMap.forEach(widgets => {
            widgets.forEach(widgetStore => {
                if (widgetStore instanceof RegionWidgetStore) {
                    if (fileId === ACTIVE_FILE_ID) {
                        widgetStore.clearRegionMap();
                        widgetStore.setFileId(ACTIVE_FILE_ID);
                    } else {
                        widgetStore.clearFrameEntry(fileId);
                        if (widgetStore.fileId === fileId) {
                            widgetStore.setFileId(ACTIVE_FILE_ID);
                        }
                    }
                }
            });
        });
    }

    @action public removeRegionFromRegionWidgets = (fileId: number, regionId: number) => {
        this.widgetsMap.forEach(widgets => {
            widgets.forEach(widgetStore => {
                if (widgetStore instanceof RegionWidgetStore) {
                    const selectedRegionId = widgetStore.regionIdMap.get(fileId);
                    if (isFinite(selectedRegionId ?? NaN) && selectedRegionId === regionId) {
                        widgetStore.clearFrameEntry(fileId);
                    }
                }
            });
        });
    };

    @action public removeRegionsFromRegionWidgetsByFrame = (fileId: number) => {
        this.widgetsMap.forEach(widgets => {
            widgets.forEach(widgetStore => {
                if (widgetStore instanceof RegionWidgetStore) {
                    if (widgetStore.regionIdMap.has(fileId)) {
                        widgetStore.clearFrameEntry(fileId);
                    }
                }
            });
        });
    };

    public static ResetWidgetPlotXYBounds(storeMap: Map<string, SpatialProfileWidgetStore | SpectralProfileWidgetStore | HistogramWidgetStore | StokesAnalysisWidgetStore>, fileId: number = ACTIVE_FILE_ID) {
        if (fileId === ACTIVE_FILE_ID) {
            storeMap.forEach(widgetStore => widgetStore.clearXYBounds());
        } else {
            storeMap.forEach(widgetStore => {
                if (widgetStore.fileId === fileId) {
                    widgetStore.clearXYBounds();
                }
            });
        }
    }

    private constructor() {
        makeObservable(this);
        this.widgetsMap = new Map<string, Map<string, any>>([
            [SpatialProfilerComponent.WIDGET_CONFIG.type, this.spatialProfileWidgets],
            [SpectralProfilerComponent.WIDGET_CONFIG.type, this.spectralProfileWidgets],
            [StatsComponent.WIDGET_CONFIG.type, this.statsWidgets],
            [HistogramComponent.WIDGET_CONFIG.type, this.histogramWidgets],
            [RenderConfigComponent.WIDGET_CONFIG.type, this.renderConfigWidgets],
            [AnimatorComponent.WIDGET_CONFIG.type, this.animatorWidgets],
            [ChannelMapControlComponent.WIDGET_CONFIG.type, this.channelMapControlWidgets],
            [LayerListComponent.WIDGET_CONFIG.type, this.layerListWidgets],
            [LogComponent.WIDGET_CONFIG.type, this.logWidgets],
            [RegionListComponent.WIDGET_CONFIG.type, this.regionListWidgets],
            [StokesAnalysisComponent.WIDGET_CONFIG.type, this.stokesAnalysisWidgets],
            [CatalogOverlayComponent.WIDGET_CONFIG.type, this.catalogWidgets],
            [CatalogPlotComponent.WIDGET_CONFIG.type, this.catalogPlotWidgets],
            [SpectralLineQueryComponent.WIDGET_CONFIG.type, this.spectralLineQueryWidgets],
            [CursorInfoComponent.WIDGET_CONFIG.type, this.cursorInfoWidgets],
            [PvGeneratorComponent.WIDGET_CONFIG.type, this.pvGeneratorWidgets]
        ]);
        this.defaultFloatingWidgetOffset = 100;
        reaction(() => this.imageViewWidgetTitle, this.updateImageWidgetTitle);
    }

    private getNextId = (defaultId: string) => {
        const widgets = this.widgetsMap.get(defaultId);
        if (!widgets) {
            return null;
        }
        let nextIndex = 0;
        while (true) {
            const nextId = `${defaultId}-${nextIndex}`;
            if (!widgets.has(nextId)) {
                return nextId;
            }
            nextIndex++;
        }
    };

    private getNextSettingId = (defaultId: string, parentId: string) => {
        const floatingSettingsWidgets = this.floatingSettingsWidgets;
        if (!floatingSettingsWidgets) {
            return null;
        }
        let settingShowed = false;
        floatingSettingsWidgets.forEach(value => {
            if (value === parentId) {
                settingShowed = true;
            }
        });
        if (settingShowed) {
            return null;
        }
        let nextIndex = 0;
        while (true) {
            const nextId = `${parentId}-${defaultId}-${nextIndex}`;
            if (!floatingSettingsWidgets.has(nextId)) {
                return nextId;
            }
            nextIndex++;
        }
    };

    private getFloatingWidgetOffset = (): number => {
        this.defaultFloatingWidgetOffset += 25;
        this.defaultFloatingWidgetOffset = ((this.defaultFloatingWidgetOffset - 100) % 300) + 100;
        return this.defaultFloatingWidgetOffset;
    };

    private static isDisposable = (store: unknown): store is Disposable => {
        return typeof (store as Disposable | undefined)?.dispose === "function";
    };

    public removeWidget = (widgetId: string, widgetType: string) => {
        const widgets = this.widgetsMap.get(widgetType);
        if (widgets) {
            this.removeAssociatedFloatingSetting(widgetId);
            const store = widgets.get(widgetId) as unknown;
            if (WidgetsStore.isDisposable(store)) {
                try {
                    store.dispose();
                } catch (err) {
                    console.error(`Failed to dispose widget store (type=${widgetType}, id=${widgetId})`, err);
                }
            }
            widgets.delete(widgetId);
            this.removeCatalogAssociations(widgetId, widgetType);
        }
        this.floatingSettingsWidgets.delete(widgetId);
    };

    private removeCatalogAssociations = (widgetId: string, widgetType: string) => {
        if (widgetType === CatalogOverlayComponent.WIDGET_CONFIG.type) {
            CatalogStore.Instance.catalogProfiles.delete(widgetId);
        } else if (widgetType === CatalogPlotComponent.WIDGET_CONFIG.type) {
            CatalogStore.Instance.clearCatalogPlotsByWidgetId(widgetId);
        }
    };

    private addWidgetByType = (widgetType: string, widgetSettings: object | null = null, preAssignedId: string | null = null): string => {
        let itemId;
        switch (widgetType) {
            case ImageViewComponent.WIDGET_CONFIG.type:
                itemId = ImageViewComponent.WIDGET_CONFIG.id;
                break;
            case RenderConfigComponent.WIDGET_CONFIG.type:
                itemId = this.addRenderConfigWidget(preAssignedId, widgetSettings);
                break;
            case SpatialProfilerComponent.WIDGET_CONFIG.type:
                itemId = this.addSpatialProfileWidget(preAssignedId, widgetSettings);
                break;
            case SpectralProfilerComponent.WIDGET_CONFIG.type:
                itemId = this.addSpectralProfileWidget(preAssignedId, widgetSettings);
                break;
            case StatsComponent.WIDGET_CONFIG.type:
                itemId = this.addStatsWidget(preAssignedId);
                break;
            case HistogramComponent.WIDGET_CONFIG.type:
                itemId = this.addHistogramWidget(preAssignedId, widgetSettings);
                break;
            case AnimatorComponent.WIDGET_CONFIG.type:
                itemId = this.addAnimatorWidget(preAssignedId);
                break;
            case ChannelMapControlComponent.WIDGET_CONFIG.type:
                itemId = this.addChannelMapControlWidget(preAssignedId);
                break;
            case LayerListComponent.WIDGET_CONFIG.type:
                itemId = this.addLayerListWidget(preAssignedId);
                break;
            case LogComponent.WIDGET_CONFIG.type:
                itemId = this.addLogWidget(preAssignedId);
                break;
            case RegionListComponent.WIDGET_CONFIG.type:
                itemId = this.addRegionListWidget(preAssignedId);
                break;
            case StokesAnalysisComponent.WIDGET_CONFIG.type:
                itemId = this.addStokesWidget(preAssignedId, widgetSettings);
                break;
            case SpectralLineQueryComponent.WIDGET_CONFIG.type:
                itemId = this.addSpectralLineQueryWidget(preAssignedId);
                break;
            case CursorInfoComponent.WIDGET_CONFIG.type:
                itemId = this.addCursorInfoWidget(preAssignedId);
                break;
            case PvGeneratorComponent.WIDGET_CONFIG.type:
                itemId = this.addPvGeneratorWidget(preAssignedId);
                break;
            case CatalogOverlayComponent.WIDGET_CONFIG.type:
                itemId = this.initializeCatalogOverlayWidget(widgetSettings, preAssignedId);
                break;
            case CatalogPlotType.D2Scatter:
                itemId = this.initializeCatalogPlotWidget({xColumnName: "None", yColumnName: "None", plotType: CatalogPlotType.D2Scatter}, preAssignedId);
                break;
            case CatalogPlotType.Histogram:
                itemId = this.initializeCatalogPlotWidget({xColumnName: "None", yColumnName: undefined, plotType: CatalogPlotType.Histogram}, preAssignedId);
                break;
            default:
                if (this.floatingWidgets.find(w => w.id === widgetType)) {
                    this.removeFloatingWidget(widgetType, true);
                }
                itemId = null;
                break;
        }
        return itemId;
    };

    private initializeCatalogOverlayWidget = (widgetSettings: object | null, preAssignedId: string | null): string | null => {
        if (widgetSettings && widgetSettings["catalogFileId"] !== undefined) {
            return this.addCatalogWidget(widgetSettings["catalogFileId"], preAssignedId, widgetSettings);
        }
        const itemId = preAssignedId || this.getNextComponentId(CatalogOverlayComponent.WIDGET_CONFIG);
        CatalogStore.Instance.catalogProfiles.set(itemId, 1);
        return itemId;
    };

    private initializeCatalogPlotWidget = (props: CatalogPlotWidgetStoreProps, preAssignedId: string | null): string | null => {
        const itemId = this.addCatalogPlotWidget(props, preAssignedId);
        if (itemId) {
            const componentId = this.getNextComponentId(CatalogPlotComponent.WIDGET_CONFIG);
            CatalogStore.Instance.setCatalogPlots(componentId, 1, itemId);
        }
        return itemId;
    };

    public removeFloatingWidgets = () => {
        this.floatingWidgets.slice().forEach(widgetConfig => this.removeFloatingWidget(widgetConfig.id));
    };

    @action public clearDockedWidgets = () => {
        this.widgetsMap.forEach((widgets, widgetType) => {
            const widgetIds = Array.from(widgets.keys());
            widgetIds.forEach(widgetId => this.removeWidget(widgetId, widgetType));
        });
    };

    createFloatingWidget = (savedConfig: any) => {
        if (savedConfig.id) {
            let savedConfigId = savedConfig.id;
            if (savedConfig.plotType) {
                savedConfigId = savedConfig.plotType;
            }
            const id = this.addWidgetByType(savedConfigId, savedConfig.widgetSettings);
            const config = new WidgetConfig(id, GetDefaultWidgetConfig(savedConfig.id));
            config.setDefaultSize(savedConfig.defaultWidth || config.defaultWidth, savedConfig.defaultHeight || config.defaultHeight);
            if (config.componentId) {
                config.componentId = config.id;
            }
            if (savedConfig.defaultX > 0 && savedConfig.defaultY > 0) {
                config.setDefaultPosition(savedConfig.defaultX, savedConfig.defaultY);
            } else {
                const offset = this.getFloatingWidgetOffset();
                config.setDefaultPosition(offset, offset);
            }
            this.floatingWidgets.push(config);
        }
    };

    public initWidgets = (componentConfigs: any[], floating: any[]) => {
        componentConfigs.forEach(componentConfig => {
            if (componentConfig.id && componentConfig.props) {
                let componentConfigId = componentConfig.id;
                if ("plotType" in componentConfig) {
                    componentConfigId = componentConfig.plotType;
                }
                // Pass the pre-assigned ID from the FlexLayout model so widget store IDs match tab node IDs
                const preAssignedId = componentConfig.props.id || null;
                const itemId = this.addWidgetByType(componentConfigId, "widgetSettings" in componentConfig ? componentConfig.widgetSettings : null, preAssignedId);
                if (itemId) {
                    componentConfig.id = itemId;
                    componentConfig.props.id = itemId;
                }
            }
        });
        floating.forEach(savedConfig => this.createFloatingWidget(savedConfig));
    };

    private getWidgetComponentId = (node: TabNode): string => {
        const config = node.getConfig() || {};
        return typeof config.id === "string" && config.id.length > 0 ? config.id : node.getId();
    };

    private getWidgetTestId = (node: TabNode): string => node.getId();

    // FlexLayout callback for App.tsx
    renderWidgetFactory = (node: TabNode): React.ReactNode => {
        const component = node.getComponent();
        if (!component) {
            return null;
        }
        const ComponentClass = COMPONENT_MAP.get(component);
        if (!ComponentClass) {
            return null;
        }
        const componentId = this.getWidgetComponentId(node);
        const testId = this.getWidgetTestId(node);
        const config = node.getConfig() || {};
        const props: WidgetProps = {
            id: componentId,
            docked: true,
            floatingSettingsId: config.floatingSettingsId
        };
        const element = React.createElement(ComponentClass, props);
        return React.createElement(React.Fragment, null, React.createElement(FlexLayoutDomMarker, {nodeId: testId, target: "tab-content"}), element);
    };

    // FlexLayout callback for App.tsx
    onRenderTab = (node: TabNode, renderValues: ITabRenderValues) => {
        const content = renderValues.content || node.getName();
        renderValues.content = React.createElement(FlexLayoutDomMarker, {nodeId: this.getWidgetTestId(node), target: "tab"}, content);
    };

    // FlexLayout callback for App.tsx
    onRenderTabSet = (tabSetNode: TabSetNode | BorderNode, renderValues: ITabSetRenderValues) => {
        const selectedNode = tabSetNode.getSelectedNode() as TabNode | undefined;
        if (!selectedNode) {
            return;
        }

        const component = selectedNode.getComponent() || "";
        const nodeId = this.getWidgetTestId(selectedNode);
        const isDarkTheme = AppStore.Instance.darkTheme;
        const canMaximize = "canMaximize" in tabSetNode && typeof tabSetNode.canMaximize === "function" && tabSetNode.canMaximize();
        const buttons: React.ReactNode[] = [];

        // Button order from left to right: channel-map, previous, multi-panel, next, settings, help, detach
        // (built-in maximize is appended by FlexLayout after these)

        if (component === "image-view") {
            buttons.push(
                React.createElement(Observer, {
                    key: "image-view-controls-" + nodeId,
                    children: () => {
                        const config = AppStore.Instance.imageViewConfigStore;
                        const imagePanelMode = config.imagePanelMode;
                        const hasPrevious = config.currentImagePage > 0;
                        const hasNext = config.imageNum > (config.currentImagePage + 1) * config.imagesPerPage;

                        return React.createElement(
                            React.Fragment,
                            null,
                            createWidgetButton({
                                buttonKey: "channel-map-" + nodeId,
                                iconClassName: Classes.iconClass("heat-grid"),
                                isDarkTheme,
                                onClick: () => this.onChannelMapButtonClick(),
                                testId: nodeId + "-header-channel-map-button",
                                title: "enable/disable channel map"
                            }),
                            createWidgetButton({
                                buttonKey: "prev-page-" + nodeId,
                                iconClassName: Classes.iconClass("step-backward"),
                                isDarkTheme,
                                isDisabled: !hasPrevious,
                                onClick: () => this.onPreviousPageClick(),
                                testId: nodeId + "-header-previous-page-button",
                                title: imagePanelMode === ImagePanelMode.None ? "previous image" : "previous page"
                            }),
                            createWidgetButton({
                                buttonKey: "image-panel-" + nodeId,
                                iconClassName: this.getImagePanelButtonIcon(imagePanelMode),
                                isDarkTheme,
                                onClick: () => this.onImagePanelButtonClick(),
                                testId: nodeId + "-header-multipanel-view-switch",
                                title: this.getImagePanelButtonTooltip(imagePanelMode)
                            }),
                            createWidgetButton({
                                buttonKey: "next-page-" + nodeId,
                                iconClassName: Classes.iconClass("step-forward"),
                                isDarkTheme,
                                isDisabled: !hasNext,
                                onClick: () => this.onNextPageClick(),
                                testId: nodeId + "-header-next-page-button",
                                title: imagePanelMode === ImagePanelMode.None ? "next image" : "next page"
                            })
                        );
                    }
                })
            );
        }

        if (WidgetsStore.showCogWidgets.includes(component)) {
            if (!(component === RenderConfigComponent.WIDGET_CONFIG.type && AppStore.Instance.activeImage?.type === ImageType.COLOR_BLENDING)) {
                buttons.push(
                    createWidgetButton({
                        buttonKey: "cog-" + nodeId,
                        iconClassName: Classes.iconClass("cog"),
                        isDarkTheme,
                        onClick: () => this.onCogPinedClick(selectedNode),
                        testId: nodeId + "-header-settings-button",
                        title: "settings"
                    })
                );
            }
        }

        if (!WidgetsStore.hideHelpButtonWidgets.includes(component)) {
            buttons.push(
                createWidgetButton({
                    buttonKey: "help-" + nodeId,
                    iconClassName: Classes.iconClass("help"),
                    isDarkTheme,
                    onClick: event => this.onHelpPinedClick(event, selectedNode),
                    testId: nodeId + "-header-help-button",
                    title: "help"
                })
            );
        }

        if (component !== "image-view") {
            buttons.push(
                createWidgetButton({
                    buttonKey: "unpin-" + nodeId,
                    iconClassName: Classes.iconClass("unpin"),
                    isDarkTheme,
                    onClick: () => this.unpinWidget(selectedNode),
                    testId: nodeId + "-header-dock-button",
                    title: "detach"
                })
            );
        }

        if (canMaximize) {
            buttons.push(
                React.createElement(FlexLayoutDomMarker, {key: "maximize-marker-" + nodeId, nodeId, target: "tabset-toolbar"}),
                React.createElement(FlexLayoutDomMarker, {key: "tabstrip-marker-" + nodeId, nodeId, target: "tabset-tabstrip"})
            );
        }

        if (buttons.length > 0) {
            renderValues.buttons = [...buttons, ...(renderValues.buttons || [])];
        }
    };

    onAction = (action: any) => {
        const layoutModel = LayoutStore.Instance.layoutModel;
        if (!layoutModel) {
            return action;
        }

        if (action.type === "FlexLayout_DeleteTab") {
            const nodeId = action.data?.node;
            if (nodeId) {
                const node = layoutModel.getNodeById(nodeId);
                if (node && node.getType() === "tab") {
                    const tabNode = node as TabNode;
                    const component = tabNode.getComponent() || "";
                    const id = tabNode.getId();

                    if (!this.beingUnpinned.has(id)) {
                        const isCatalogTable = component === CatalogOverlayComponent.WIDGET_CONFIG.type;
                        const isCatalogPlot = component === CatalogPlotComponent.WIDGET_CONFIG.type;
                        const isPvPreview = component === PvPreviewComponent.WIDGET_CONFIG.type;

                        if (!isCatalogTable && !isCatalogPlot) {
                            this.removeWidget(id, component);
                        }
                        if (isCatalogTable) {
                            CatalogStore.Instance.catalogProfiles.delete(id);
                            this.removeAssociatedFloatingSetting(id);
                        }
                        if (isCatalogPlot) {
                            CatalogStore.Instance.clearCatalogPlotsByWidgetId(id);
                        }
                        if (isPvPreview) {
                            const regexPattern = /pv-generator-(\d+)/;
                            const pvGeneratorId = id.match(regexPattern);
                            this.pvGeneratorWidgets.get(pvGeneratorId?.[0] ?? "")?.removePreviewFrame(parseInt(id.split("-")[2]));
                        }
                    }
                }
            }
        }
        return action;
    };

    public toWidgetSettingsConfig = (widgetType: string, widgetID: string | undefined) => {
        if (!widgetType || !widgetID) {
            return null;
        }
        let widgetStore: RenderConfigWidgetStore | SpatialProfileWidgetStore | SpectralProfileWidgetStore | HistogramWidgetStore | StokesAnalysisWidgetStore | CatalogWidgetStore | null | undefined = null;
        switch (widgetType) {
            case RenderConfigComponent.WIDGET_CONFIG.type:
                widgetStore = this.renderConfigWidgets.get(widgetID);
                break;
            case SpatialProfilerComponent.WIDGET_CONFIG.type:
                widgetStore = this.spatialProfileWidgets.get(widgetID);
                break;
            case SpectralProfilerComponent.WIDGET_CONFIG.type:
                widgetStore = this.spectralProfileWidgets.get(widgetID);
                break;
            case HistogramComponent.WIDGET_CONFIG.type:
                widgetStore = this.histogramWidgets.get(widgetID);
                break;
            case StokesAnalysisComponent.WIDGET_CONFIG.type:
                widgetStore = this.stokesAnalysisWidgets.get(widgetID);
                break;
            case CatalogOverlayComponent.WIDGET_CONFIG.type:
                widgetStore = this.catalogWidgets.get(widgetID);
                break;
            default:
                break;
        }
        return widgetStore?.toConfig?.();
    };

    @action onCogPinedClick = (node: TabNode) => {
        const parentId = node.getId();
        const parentType = node.getComponent() || "";
        const parentTitle = node.getName();
        const floatingSettingsAppliedWidgets = [
            ImageViewComponent.WIDGET_CONFIG.type,
            StokesAnalysisComponent.WIDGET_CONFIG.type,
            SpectralProfilerComponent.WIDGET_CONFIG.type,
            SpatialProfilerComponent.WIDGET_CONFIG.type,
            RenderConfigComponent.WIDGET_CONFIG.type,
            HistogramComponent.WIDGET_CONFIG.type,
            CatalogOverlayComponent.WIDGET_CONFIG.type,
            LayerListComponent.WIDGET_CONFIG.type
        ];
        if (floatingSettingsAppliedWidgets.indexOf(parentType) === -1) {
            return;
        }
        const defaultConfig = GetDefaultWidgetSettingsConfig(parentType);
        const id = this.addFloatingSettingsWidget(null, parentId, defaultConfig.type);
        if (id !== null) {
            const widgetConfig = new WidgetConfig(id, defaultConfig);
            widgetConfig.title = parentType === "image-view" ? "Image View Settings" : parentTitle + " Settings";
            widgetConfig.parentId = parentId;
            widgetConfig.parentType = parentType;
            if (widgetConfig.id) {
                this.addFloatingWidget(widgetConfig);
            }
        }
    };

    @action unpinWidget = (node: TabNode) => {
        const id = node.getId();
        const type = node.getComponent() || "";
        const title = node.getName();
        if (type === ImageViewComponent.WIDGET_CONFIG.type) {
            return;
        }

        const widgetConfig = new WidgetConfig(id, GetDefaultWidgetConfig(type));
        widgetConfig.title = title;
        if (type === CatalogOverlayComponent.WIDGET_CONFIG.type) {
            widgetConfig.componentId = id;
        }
        if (type === PvPreviewComponent.WIDGET_CONFIG.type) {
            const nodeConfig = node.getConfig() || {};
            widgetConfig.parentId = nodeConfig.id || id;
            widgetConfig.parentType = PvPreviewComponent.WIDGET_CONFIG.parentType;
        }
        const catalogPlotWidgetStore = this.catalogPlotWidgets.get(id);
        if (catalogPlotWidgetStore) {
            widgetConfig.helpType = catalogPlotWidgetStore.plotType === CatalogPlotType.Histogram ? HelpType.CATALOG_HISTOGRAM_PLOT : HelpType.CATALOG_SCATTER_PLOT;
        }

        const rect = node.getRect();
        if (rect && rect.width && rect.height) {
            widgetConfig.setDefaultSize(Math.round(rect.width / 25.0) * 25, Math.round(rect.height / 25.0) * 25);
            widgetConfig.setDefaultPosition(Math.round(rect.x / 25.0) * 25 + 5, Math.round(rect.y / 25.0) * 25 - 25);
        }

        this.addFloatingWidget(widgetConfig);
        this.beingUnpinned.add(id);
        const layoutModel = LayoutStore.Instance.layoutModel;
        if (layoutModel) {
            layoutModel.doAction(Actions.deleteTab(id));
        }
        this.beingUnpinned.delete(id);
    };

    @action onHelpPinedClick = (ev: React.MouseEvent, node: TabNode) => {
        const type = node.getComponent() || "";
        const widgetConfig = GetDefaultWidgetConfig(type);
        const rect = node.getRect();
        let centerX = 0;
        if (rect && rect.width) {
            centerX = ev.currentTarget.getBoundingClientRect().right + 36 - rect.width * 0.5;
        }
        const helpStore = HelpStore.Instance;
        const toggleOrShow = (helpType: HelpType) => {
            if (helpStore.helpVisible && helpStore.type === helpType) {
                helpStore.hideHelpDrawer();
            } else {
                helpStore.showHelpDrawer(helpType, centerX);
            }
        };
        if (widgetConfig.helpType && !Array.isArray(widgetConfig.helpType)) {
            toggleOrShow(widgetConfig.helpType);
        } else {
            const id = node.getId();
            const catalogPlotWidgetStore = this.catalogPlotWidgets.get(id);
            if (catalogPlotWidgetStore) {
                toggleOrShow(catalogPlotWidgetStore.plotType === CatalogPlotType.Histogram ? HelpType.CATALOG_HISTOGRAM_PLOT : HelpType.CATALOG_SCATTER_PLOT);
            }
            const renderConfigWidgetStore = this.renderConfigWidgets.get(id);
            if (renderConfigWidgetStore) {
                toggleOrShow(AppStore.Instance.activeImage?.type === ImageType.COLOR_BLENDING ? HelpType.RENDER_CONFIG_COLOR_BLENDING : HelpType.RENDER_CONFIG);
            }
        }
    };

    onImagePanelButtonClick = () => {
        const channelMapStore = AppStore.Instance.channelMapStore;
        if (channelMapStore.channelMapEnabled) {
            channelMapStore.setChannelMapEnabled(false);
        } else {
            this.setImageMultiPanelEnabled(!PreferenceStore.Instance.imageMultiPanelEnabled);
        }
    };

    onChannelMapButtonClick = () => {
        AppStore.Instance.channelMapStore.setChannelMapEnabled(!AppStore.Instance.channelMapStore.channelMapEnabled);
    };

    setImageMultiPanelEnabled = (multiPanelEnabled: boolean) => {
        PreferenceStore.Instance.setPreference(PreferenceKeys.IMAGE_MULTI_PANEL_ENABLED, multiPanelEnabled);
    };

    private getImagePanelButtonTooltip = (imagePanelMode: ImagePanelMode) => {
        return imagePanelMode === ImagePanelMode.None ? "switch to multi-panel" : "switch to single panel";
    };

    private getImagePanelButtonIcon = (imagePanelMode: ImagePanelMode) => {
        return imagePanelMode === ImagePanelMode.None ? Classes.iconClass("square") : Classes.iconClass("grid-view");
    };

    onNextPageClick = () => {
        const appStore = AppStore.Instance;
        const config = appStore.imageViewConfigStore;
        const firstIndexInNextPage = (config.currentImagePage + 1) * config.imagesPerPage;
        if (config.imageNum > firstIndexInNextPage) {
            appStore.setActiveImageByIndex(firstIndexInNextPage);
        }
    };

    onPreviousPageClick = () => {
        const appStore = AppStore.Instance;
        const config = appStore.imageViewConfigStore;
        if (config.currentImagePage > 0) {
            appStore.setActiveImageByIndex((config.currentImagePage - 1) * config.imagesPerPage);
        }
    };

    @computed get imageViewWidgetTitle() {
        const activeImage = AppStore.Instance.activeImage;
        const visibleImages = AppStore.Instance.imageViewConfigStore.visibleImages;
        const titleImage = activeImage?.type !== ImageType.PV_PREVIEW && activeImage && visibleImages.includes(activeImage) ? activeImage : visibleImages[0];
        return titleImage ? (titleImage?.store?.filename ?? "") : "No image loaded";
    }

    /** Updates the title of the image view widget using {@link imageViewWidgetTitle}. */
    @action updateImageWidgetTitle = () => {
        const layoutModel = LayoutStore.Instance.layoutModel;
        const newTitle = this.imageViewWidgetTitle;
        if (layoutModel) {
            layoutModel.visitNodes(node => {
                if (node.getType() === "tab") {
                    const tabNode = node as TabNode;
                    if (tabNode.getComponent() === ImageViewComponent.WIDGET_CONFIG.type && tabNode.getName() !== newTitle) {
                        layoutModel.doAction(Actions.renameTab(tabNode.getId(), newTitle));
                    }
                }
            });
        }
        const imageViewWidget = this.floatingWidgets.find(w => w.type === ImageViewComponent.WIDGET_CONFIG.type);
        if (imageViewWidget && imageViewWidget.title !== newTitle) {
            this.setWidgetTitle(imageViewWidget.id, newTitle);
        }
    };

    @action setWidgetTitle(id: string, title: string) {
        const layoutModel = LayoutStore.Instance.layoutModel;
        if (layoutModel) {
            const node = layoutModel.getNodeById(id);
            if (node && node.getType() === "tab") {
                layoutModel.doAction(Actions.renameTab(id, title));
            }
        }
        const widget = this.floatingWidgets.find(w => w.id === id);
        if (widget) {
            widget.title = title;
        }
    }

    @action setWidgetComponentTitle(componentId: string, title: string) {
        const layoutModel = LayoutStore.Instance.layoutModel;
        if (layoutModel) {
            const node = layoutModel.getNodeById(componentId);
            if (node && node.getType() === "tab") {
                layoutModel.doAction(Actions.renameTab(componentId, title));
            }
        }
        const widgetComponent = this.floatingWidgets.find(w => w.componentId === componentId);
        if (widgetComponent) {
            widgetComponent.title = title;
        }
    }

    @action changeWidgetId(id: string, newId: string) {
        const widget = this.floatingWidgets.find(w => w.id === id);
        if (widget) {
            widget.id = newId;
        }
    }

    private createFloatingWidgetFromStore = (addWidgetStore: () => string | null, defaultConfig: DefaultWidgetConfig) => {
        const id = addWidgetStore();
        if (id !== null) {
            this.addFloatingWidget(new WidgetConfig(id, defaultConfig));
        }
    };

    createFloatingSpatialProfilerWidget = () => this.createFloatingWidgetFromStore(() => this.addSpatialProfileWidget(), SpatialProfilerComponent.WIDGET_CONFIG);

    @action addSpatialProfileWidget(id: string | null = null, widgetSettings: object | null = null) {
        if (!id) {
            id = this.getNextId(SpatialProfilerComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            const ws = new SpatialProfileWidgetStore();
            if (widgetSettings) {
                ws.init(widgetSettings);
            }
            this.spatialProfileWidgets.set(id, ws);
        }
        return id;
    }

    createFloatingSpectralProfilerWidget = () => this.createFloatingWidgetFromStore(() => this.addSpectralProfileWidget(), SpectralProfilerComponent.WIDGET_CONFIG);

    @action addSpectralProfileWidget(id: string | null = null, widgetSettings: object | null = null) {
        if (!id) {
            id = this.getNextId(SpectralProfilerComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            const ws = new SpectralProfileWidgetStore();
            if (widgetSettings) {
                ws.init(widgetSettings);
            }
            this.spectralProfileWidgets.set(id, ws);
        }
        return id;
    }

    @computed get spectralProfilerList(): string[] {
        return Array.from(this.spectralProfileWidgets.keys());
    }
    @computed get hasSpectralProfiler(): boolean {
        return this.spectralProfileWidgets && this.spectralProfileWidgets.size > 0;
    }
    @computed get isSpectralWidgetStreamingData(): boolean {
        let result = false;
        this.spectralProfileWidgets.forEach(ws => {
            result = result || ws.isStreamingData;
        });
        return result;
    }
    public getSpectralWidgetStoreByID = (id: string): SpectralProfileWidgetStore | undefined => this.spectralProfileWidgets.get(id);

    createFloatingStokesWidget = () => this.createFloatingWidgetFromStore(() => this.addStokesWidget(), StokesAnalysisComponent.WIDGET_CONFIG);

    @action addStokesWidget(id: string | null = null, widgetSettings: object | null = null) {
        if (!id) {
            id = this.getNextId(StokesAnalysisComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            const ws = new StokesAnalysisWidgetStore();
            if (widgetSettings) {
                ws.init(widgetSettings);
            }
            this.stokesAnalysisWidgets.set(id, ws);
        }
        return id;
    }

    private getNextComponentId = (config: DefaultWidgetConfig) => {
        let nextIndex = 0;
        const componentIds: string[] = [];
        if (config.type === CatalogPlotComponent.WIDGET_CONFIG.type) {
            CatalogStore.Instance.catalogPlots.forEach((_v, componentId) => componentIds.push(componentId));
        } else if (config.type === CatalogOverlayComponent.WIDGET_CONFIG.type) {
            CatalogStore.Instance.catalogProfiles.forEach((_v, componentId) => componentIds.push(componentId));
        }
        while (true) {
            const nextId = `${config.componentId}-${nextIndex}`;
            if (!componentIds.includes(nextId)) {
                return nextId;
            }
            nextIndex++;
        }
    };

    createFloatingCatalogWidget = (catalogFileId: number): {widgetStoreId: string | null; widgetComponentId: string} => {
        const widgetStoreId = this.addCatalogWidget(catalogFileId);
        const widgetComponentId = this.getNextComponentId(CatalogOverlayComponent.WIDGET_CONFIG);
        const config = new WidgetConfig(widgetComponentId, CatalogOverlayComponent.WIDGET_CONFIG);
        config.componentId = widgetComponentId;
        this.addFloatingWidget(config);
        return {widgetStoreId, widgetComponentId};
    };

    reloadFloatingCatalogWidget = () => {
        const appStore = AppStore.Instance;
        const catalogFileNum = appStore.catalogNum;
        const componentId = this.getNextComponentId(CatalogOverlayComponent.WIDGET_CONFIG);
        const config = new WidgetConfig(componentId, CatalogOverlayComponent.WIDGET_CONFIG);
        config.componentId = componentId;
        if (catalogFileNum) {
            CatalogStore.Instance.catalogProfiles.set(componentId, catalogFileNum);
        }
        this.addFloatingWidget(config);
    };

    @action addCatalogWidget(catalogFileId: number, id: string | null = null, widgetSettings: object | null = null) {
        const catalogStore = CatalogStore.Instance;
        const catalogWidgetId = catalogStore.catalogWidgets.get(catalogFileId);
        if (catalogWidgetId) {
            return catalogWidgetId;
        }
        if (!id) {
            id = this.getNextId(CatalogOverlayComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            const cws = new CatalogWidgetStore(catalogFileId);
            if (widgetSettings) {
                cws.init(widgetSettings);
            }
            this.catalogWidgets.set(id, cws);
            catalogStore.catalogWidgets.set(catalogFileId, id);
        }
        return id;
    }

    createFloatingCatalogPlotWidget = (props: CatalogPlotWidgetStoreProps): {widgetStoreId: string | null; widgetComponentId: string} => {
        const defaultConfig = CatalogPlotComponent.WIDGET_CONFIG;
        const widgetStoreId = this.addCatalogPlotWidget(props);
        const widgetComponentId = this.getNextComponentId(defaultConfig);
        if (widgetStoreId !== null) {
            const config = new WidgetConfig(widgetStoreId, defaultConfig);
            config.id = widgetStoreId;
            config.componentId = widgetComponentId;
            config.helpType = props.plotType === CatalogPlotType.Histogram ? HelpType.CATALOG_HISTOGRAM_PLOT : HelpType.CATALOG_SCATTER_PLOT;
            this.addFloatingWidget(config);
        }
        return {widgetStoreId, widgetComponentId};
    };

    @action addCatalogPlotWidget(props: CatalogPlotWidgetStoreProps, id: string | null = null) {
        if (!id) {
            id = this.getNextId(CatalogPlotComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            this.catalogPlotWidgets.set(id, new CatalogPlotWidgetStore(props));
        }
        return id;
    }

    createFloatingSpectralLineQueryWidget = () => this.createFloatingWidgetFromStore(() => this.addSpectralLineQueryWidget(), SpectralLineQueryComponent.WIDGET_CONFIG);

    @action addSpectralLineQueryWidget(id: string | null = null) {
        if (!id) {
            id = this.getNextId(SpectralLineQueryComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            this.spectralLineQueryWidgets.set(id, new SpectralLineQueryWidgetStore());
        }
        return id;
    }

    createFloatingSettingsWidget = (title: string, parentId: string, parentType: string) => {
        const defaultConfig = GetDefaultWidgetSettingsConfig(parentType);
        const id = this.addFloatingSettingsWidget(null, parentId, defaultConfig.type);
        if (id !== null) {
            const config = new WidgetConfig(id, defaultConfig);
            config.title = parentType === PvGeneratorComponent.WIDGET_CONFIG.type ? title : title + " Settings";
            config.parentId = parentId;
            config.parentType = parentType;
            if (config.id) {
                this.addFloatingWidget(config);
            } else {
                const settingWidgetId = parentId + "-floating-settings-0";
                AppStore.Instance.zIndexManager.updateIndexOnSelect(settingWidgetId);
            }
        }
    };

    @action addFloatingSettingsWidget(id: string | null = null, parentId: string, type: string) {
        if (!id) {
            id = this.getNextSettingId(type, parentId);
        }
        if (id) {
            this.floatingSettingsWidgets.set(id, parentId);
        }
        return id;
    }

    createFloatingStatsWidget = () => this.createFloatingWidgetFromStore(() => this.addStatsWidget(), StatsComponent.WIDGET_CONFIG);
    @action addStatsWidget(id: string | null = null) {
        if (!id) {
            id = this.getNextId(StatsComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            this.statsWidgets.set(id, new StatsWidgetStore());
        }
        return id;
    }

    createFloatingHistogramWidget = () => this.createFloatingWidgetFromStore(() => this.addHistogramWidget(), HistogramComponent.WIDGET_CONFIG);
    @action addHistogramWidget(id: string | null = null, widgetSettings: object | null = null) {
        if (!id) {
            id = this.getNextId(HistogramComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            const ws = new HistogramWidgetStore();
            if (widgetSettings) {
                ws.init(widgetSettings);
            }
            this.histogramWidgets.set(id, ws);
        }
        return id;
    }

    createFloatingRenderWidget = () => this.createFloatingWidgetFromStore(() => this.addRenderConfigWidget(), RenderConfigComponent.WIDGET_CONFIG);
    @action addRenderConfigWidget(id: string | null = null, widgetSettings: object | null = null) {
        if (!id) {
            id = this.getNextId(RenderConfigComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            const ws = new RenderConfigWidgetStore();
            if (widgetSettings) {
                ws.init(widgetSettings);
            }
            this.renderConfigWidgets.set(id, ws);
        }
        return id;
    }

    createFloatingLogWidget = () => this.createFloatingWidgetFromStore(() => this.addLogWidget(), LogComponent.WIDGET_CONFIG);
    @action addLogWidget(id: string | null = null) {
        if (!id) {
            id = this.getNextId(LogComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            this.logWidgets.set(id, new EmptyWidgetStore());
        }
        return id;
    }

    createFloatingAnimatorWidget = () => this.createFloatingWidgetFromStore(() => this.addAnimatorWidget(), AnimatorComponent.WIDGET_CONFIG);
    @action addAnimatorWidget(id: string | null = null) {
        if (!id) {
            id = this.getNextId(AnimatorComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            this.animatorWidgets.set(id, new EmptyWidgetStore());
        }
        return id;
    }

    createFloatingChannelMapControlWidget = () => this.createFloatingWidgetFromStore(() => this.addChannelMapControlWidget(), ChannelMapControlComponent.WIDGET_CONFIG);
    @action addChannelMapControlWidget(id: string | null = null) {
        if (!id) {
            id = this.getNextId(ChannelMapControlComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            this.channelMapControlWidgets.set(id, new EmptyWidgetStore());
        }
        return id;
    }

    createFloatingRegionListWidget = () => this.createFloatingWidgetFromStore(() => this.addRegionListWidget(), RegionListComponent.WIDGET_CONFIG);
    @action addRegionListWidget(id: string | null = null) {
        if (!id) {
            id = this.getNextId(RegionListComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            this.regionListWidgets.set(id, new EmptyWidgetStore());
        }
        return id;
    }

    createFloatingLayerListWidget = () => this.createFloatingWidgetFromStore(() => this.addLayerListWidget(), LayerListComponent.WIDGET_CONFIG);
    @action addLayerListWidget(id: string | null = null) {
        if (!id) {
            id = this.getNextId(LayerListComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            this.layerListWidgets.set(id, new LayerListWidgetStore());
        }
        return id;
    }

    createFloatingCursorInfoWidget = () => this.createFloatingWidgetFromStore(() => this.addCursorInfoWidget(), CursorInfoComponent.WIDGET_CONFIG);
    @action addCursorInfoWidget(id: string | null = null) {
        if (!id) {
            id = this.getNextId(CursorInfoComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            this.cursorInfoWidgets.set(id, new EmptyWidgetStore());
        }
        return id;
    }

    createFloatingPvGeneratorWidget = () => this.createFloatingWidgetFromStore(() => this.addPvGeneratorWidget(), PvGeneratorComponent.WIDGET_CONFIG);
    @action addPvGeneratorWidget(id: string | null = null) {
        if (!id) {
            id = this.getNextId(PvGeneratorComponent.WIDGET_CONFIG.type);
        }
        if (id) {
            this.pvGeneratorWidgets.set(id, new PvGeneratorWidgetStore());
        }
        return id;
    }

    handleToolbarWidgetDragStart = (e: React.DragEvent, widgetConfig: DefaultWidgetConfig) => {
        const layoutRef = LayoutStore.Instance.layoutRef;
        if (!layoutRef?.current) {
            return;
        }

        const id = this.addWidgetByType(widgetConfig.type);
        if (!id) {
            return;
        }

        const tabJson: any = {
            type: "tab",
            component: widgetConfig.type,
            name: widgetConfig.title || widgetConfig.type,
            id,
            config: {id}
        };

        let dropped = false;
        layoutRef.current.addTabWithDragAndDrop(e.nativeEvent, tabJson, (node: TabNode | undefined) => {
            if (node) {
                dropped = true;
            }
        });

        // Clean up widget store if drag was cancelled (no drop)
        const target = e.currentTarget;
        const onDragEnd = () => {
            target.removeEventListener("dragend", onDragEnd);
            if (!dropped) {
                this.removeWidget(id, widgetConfig.type);
            }
        };
        target.addEventListener("dragend", onDragEnd);
    };

    @action selectFloatingWidget = (id: string) => {
        const selectedWidgetIndex = this.floatingWidgets.findIndex(w => w.id === id);
        const N = this.floatingWidgets.length;
        if (N > 1 && selectedWidgetIndex >= 0 && selectedWidgetIndex < N - 1) {
            const selectedWidget = this.floatingWidgets[selectedWidgetIndex];
            for (let i = 0; i < N - 1; i++) {
                if (i >= selectedWidgetIndex) {
                    this.floatingWidgets[i] = this.floatingWidgets[i + 1];
                }
            }
            this.floatingWidgets[N - 1] = selectedWidget;
        }
    };

    @action addFloatingWidget = (widget: WidgetConfig) => {
        if (widget.defaultX === undefined || widget.defaultY === undefined || !(widget.defaultX > 0 && widget.defaultY > 0)) {
            const offset = this.getFloatingWidgetOffset();
            widget.setDefaultPosition(offset, offset);
        }
        this.floatingWidgets.push(widget);
        const zIndexManager = AppStore.Instance.zIndexManager;
        const id = widget.componentId ? widget.componentId : widget.id;
        zIndexManager.assignIndex(id);
    };

    @action removeFloatingWidget = (id: string, preserveStore: boolean = false) => {
        const widget = this.floatingWidgets.find(w => w.id === id);
        const zIndexManager = AppStore.Instance.zIndexManager;
        if (widget) {
            zIndexManager.updateIndexOnRemove(id);
            this.floatingWidgets = this.floatingWidgets.filter(w => w.id !== id);
            if (preserveStore) {
                return;
            }
            this.removeWidget(id, widget.type);
        }
    };

    @action removeFloatingWidgetComponent = (componentId: string) => {
        const widget = this.floatingWidgets.find(w => w.componentId === componentId);
        const zIndexManager = AppStore.Instance.zIndexManager;
        if (widget) {
            zIndexManager.updateIndexOnRemove(componentId);
            this.floatingWidgets = this.floatingWidgets.filter(w => w.componentId !== componentId);
            this.removeAssociatedFloatingSetting(componentId);
        }
    };

    private removeAssociatedFloatingSetting = (widgetId: string) => {
        if (this.floatingSettingsWidgets?.size) {
            let associatedFloatingSettingsId: string | null = null;
            this.floatingSettingsWidgets.forEach((value, key) => {
                if (value === widgetId) {
                    associatedFloatingSettingsId = key;
                }
            });
            const layoutModel = LayoutStore.Instance.layoutModel;
            if (layoutModel && associatedFloatingSettingsId) {
                const node = layoutModel.getNodeById(associatedFloatingSettingsId);
                if (node) {
                    layoutModel.doAction(Actions.deleteTab(associatedFloatingSettingsId));
                }
            }
            if (associatedFloatingSettingsId) {
                this.removeFloatingWidget(associatedFloatingSettingsId, true);
                this.floatingSettingsWidgets.delete(associatedFloatingSettingsId);
            }
        }
    };
}
