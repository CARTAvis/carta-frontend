import Ajv from "ajv";
import {AppStore, WidgetConfig, CatalogStore} from "stores";
import {PresetLayout} from "models";
import {findDeep, smoothStepOffset} from "utilities";
import {CatalogOverlayComponent} from "components";

const layoutSchema = require("models/layout_schema_2.json");

const COMPONENT_CONFIG = new Map<string, any>([
    ["image-view", {
        type: "react-component",
        component: "image-view",
        title: "No image loaded",
        height: smoothStepOffset(window.innerHeight, 720, 1080, 65, 75), // image view fraction: adjust layout properties based on window dimensions
        id: "image-view",
        isClosable: false
    }],
    ["render-config", {
        type: "react-component",
        component: "render-config",
        title: "Render Configuration",
        id: "render-config"
    }],
    ["region-list", {
        type: "react-component",
        component: "region-list",
        title: "Region List",
        id: "region-list"
    }],
    ["animator", {
        type: "react-component",
        component: "animator",
        title: "Animator",
        id: "animator"
    }],
    ["spatial-profiler", {
        type: "react-component",
        component: "spatial-profiler",
        id: "spatial-profiler"
    }],
    ["spectral-profiler", {
        type: "react-component",
        component: "spectral-profiler",
        id: "spectral-profiler",
        title: "Z Profile: Cursor"
    }],
    ["stokes", {
        type: "react-component",
        component: "stokes",
        id: "stokes",
        title: "Stokes Analysis"
    }],
    ["histogram", {
        type: "react-component",
        component: "histogram",
        title: "Histogram",
        id: "histogram"
    }],
    ["stats", {
        type: "react-component",
        component: "stats",
        title: "Statistics",
        id: "stats"
    }],
    ["layer-list", {
        type: "react-component",
        component: "layer-list",
        title: "Image List",
        id: "layer-list"
    }],
    ["log", {
        type: "react-component",
        component: "log",
        title: "Log",
        id: "log"
    }],
    ["catalog-overlay", {
        type: "react-component",
        component: "catalog-overlay",
        title: "Catalog Overlay",
        id: "catalog-overlay"
    }],
    ["catalog-plot", {
        type: "react-component",
        component: "catalog-plot",
        title: "Catalog Plot",
        id: "catalog-plot"
    }],
    ["spectral-line-query", {
        type: "react-component",
        component: "spectral-line-query",
        title: "Spectral Line Query",
        id: "spectral-line-query"
    }]
]);

export class LayoutConfig {
    public static LayoutValidator = new Ajv({useDefaults: "empty", strictTypes: false}).compile(layoutSchema);
    public static CurrentSchemaVersion = 2;

    public static GetPresetConfig = (presetName: string) => {
        if (!presetName) {
            return null;
        }

        const config = PresetLayout.PRESET_CONFIGS.get(presetName);
        if (!config) {
            return null;
        }

        return {
            layoutVersion: LayoutConfig.CurrentSchemaVersion,
            docked: {
                type: "row",
                content: [{
                    type: "column",
                    width: 60,
                    content: [{type: "component", id: "image-view"}, config.leftBottomContent]
                }, {
                    type: "column",
                    content: config.rightColumnContent
                }]
            },
            floating: []
        };
    };

    public static UpgradeLayout = (layout: { layoutVersion: 1 | 2, docked: any, floating: any }) => {
        // Upgrade to V2 if required
        if (layout.layoutVersion === 1) {
            const spatialProfileWidgets = findDeep(layout, item => item.id === "spatial-profiler");
            for (const widget of spatialProfileWidgets) {
                if (widget.coord) {
                    if (!widget.widgetSettings) {
                        widget.widgetSettings = {};
                    }
                    widget.widgetSettings.coordinate = widget.coord;
                    delete widget.coord;
                }
            }
            layout.layoutVersion = 2;
        }

        // Upgrade floating widgets to consistent type
        if (layout.floating && Array.isArray(layout.floating)) {
            for (const widget of layout.floating) {
                if (widget.type !== "component") {
                    // Store widget type as id, to be consistent with docked widgets
                    widget.id = widget.type;
                    widget.type = "component";
                }
            }
        }
    };

    // Note: layoutConfig is formalized(modified) during validation if valid
    public static IsUserLayoutValid = (layoutName: string, layoutConfig: any): boolean => {
        if (!layoutName || !layoutConfig) {
            return false;
        }
        // exclude conflict with presets
        if (PresetLayout.isPreset(layoutName)) {
            return false;
        }

        const validLayout = LayoutConfig.LayoutValidator(layoutConfig);
        if (validLayout) {
            return true;
        } else {
            console.log(LayoutConfig.LayoutValidator.errors);
            return false;
        }
    };

    public static CreateConfigToSave = (appStore: AppStore, rootConfig: any) => {
        if (!appStore || !rootConfig || !("type" in rootConfig) || !("content" in rootConfig)) {
            return null;
        }

        let configToSave = {
            layoutVersion: LayoutConfig.CurrentSchemaVersion,
            docked: {
                type: rootConfig.type,
                content: []
            },
            floating: []
        };

        // 1. generate config from current docked widgets
        LayoutConfig.GenSimpleConfigToSave(appStore, configToSave.docked.content, rootConfig.content);

        // 2. handle floating widgets
        appStore.widgetsStore.floatingWidgets.forEach((config: WidgetConfig) => {
            let floatingConfig = {
                type: "component",
                id: config.type,
                defaultWidth: config.defaultWidth ? config.defaultWidth : "",
                defaultHeight: config.defaultHeight ? config.defaultHeight : "",
                defaultX: config.defaultX ? config.defaultX : "",
                defaultY: config.defaultY ? config.defaultY : ""
            };
            // add widget settings
            let widgetSettingsConfig = undefined;
            if (config.type === CatalogOverlayComponent.WIDGET_CONFIG.type) {
                const catalogFileId = CatalogStore.Instance.catalogProfiles.get(config.id);
                const catalogWidgetStoreId = CatalogStore.Instance.catalogWidgets.get(catalogFileId);
                widgetSettingsConfig = appStore.widgetsStore.toWidgetSettingsConfig(config.type, catalogWidgetStoreId);
            } else {
                widgetSettingsConfig = appStore.widgetsStore.toWidgetSettingsConfig(config.type, config.id);
            }
            if (widgetSettingsConfig) {
                floatingConfig["widgetSettings"] = widgetSettingsConfig;
            }
            // add plot type
            const plotWidget = appStore.widgetsStore.catalogPlotWidgets.get(config.id);
            if (plotWidget) {
                floatingConfig["plotType"] = plotWidget.plotType;
            }
            configToSave.floating.push(floatingConfig);
        });

        return configToSave;
    };

    private static GenSimpleConfigToSave = (appStore: AppStore, newParentContent: any, parentContent: any): void => {
        if (!appStore || !newParentContent || !Array.isArray(newParentContent) || !parentContent || !Array.isArray(parentContent)) {
            return;
        }

        parentContent.forEach((child) => {
            if (child.type) {
                if (child.type === "stack" || child.type === "row" || child.type === "column") {
                    let simpleChild = {
                        type: child.type,
                        content: []
                    };
                    if (child.type === "stack" && child.activeItemIndex >= 0 && child.activeItemIndex < child.content?.length) { // save active tab
                        simpleChild["activeItemIndex"] = child.activeItemIndex;
                    }
                    if (child.width) {
                        simpleChild["width"] = child.width;
                    }
                    if (child.height) {
                        simpleChild["height"] = child.height;
                    }
                    newParentContent.push(simpleChild);
                    if (child.content) {
                        LayoutConfig.GenSimpleConfigToSave(appStore, simpleChild.content, child.content);
                    }
                } else if (child.type === "component" && child.id) {
                    const widgetType = (child.id).replace(/(-component)?-\d+$/, "");
                    let simpleChild = {
                        type: child.type,
                        id: widgetType
                    };
                    if (child.width) {
                        simpleChild["width"] = child.width;
                    }
                    if (child.height) {
                        simpleChild["height"] = child.height;
                    }
                    // add widget settings
                    let widgetSettingsConfig = undefined;
                    if (widgetType === CatalogOverlayComponent.WIDGET_CONFIG.type) {
                        const catalogFileId = CatalogStore.Instance.catalogProfiles.get(child.id);
                        const catalogWidgetStoreId = CatalogStore.Instance.catalogWidgets.get(catalogFileId);
                        widgetSettingsConfig = appStore.widgetsStore.toWidgetSettingsConfig(widgetType, catalogWidgetStoreId);
                    } else {
                        widgetSettingsConfig = appStore.widgetsStore.toWidgetSettingsConfig(widgetType, child.id);
                    }
                    if (widgetSettingsConfig) {
                        simpleChild["widgetSettings"] = widgetSettingsConfig;
                    }
                    // add plot type
                    const plotWidget = appStore.widgetsStore.catalogPlotWidgets.get(child.id);
                    if (plotWidget) {
                        simpleChild["plotType"] = plotWidget.plotType;
                    }
                    newParentContent.push(simpleChild);
                }
            }
        });
    };

    public static CreateConfigToApply = (newParentContent: any, parentContent: any, componentConfigs: any[]) => {
        if (!newParentContent || !Array.isArray(newParentContent) || !parentContent || !Array.isArray(parentContent)) {
            return;
        }

        parentContent.forEach((child) => {
            if (child.type) {
                if (child.type === "stack" || child.type === "row" || child.type === "column") {
                    let simpleChild = {
                        type: child.type,
                        content: []
                    };
                    if (child.type === "stack" && child.activeItemIndex >= 0 && child.activeItemIndex < child.content?.length) { // load active tab
                        simpleChild["activeItemIndex"] = child.activeItemIndex;
                    }
                    if (child.width) {
                        simpleChild["width"] = child.width;
                    }
                    if (child.height) {
                        simpleChild["height"] = child.height;
                    }
                    newParentContent.push(simpleChild);
                    if (child.content) {
                        LayoutConfig.CreateConfigToApply(simpleChild.content, child.content, componentConfigs);
                    }
                } else if (child.type === "component" && child.id) {
                    const widgetType = (child.id).replace(/-\d+$/, "");
                    if (COMPONENT_CONFIG.has(widgetType)) {
                        let componentConfig = Object.assign({}, COMPONENT_CONFIG.get(widgetType));
                        if (child.width) {
                            componentConfig["width"] = child.width;
                        }
                        if (child.height) {
                            componentConfig["height"] = child.height;
                        }
                        if ("widgetSettings" in child) {
                            componentConfig["widgetSettings"] = child.widgetSettings;
                        }
                        if ("plotType" in child) {
                            componentConfig["plotType"] = child.plotType;
                        }
                        componentConfig.props = {appStore: AppStore.Instance, id: "", docked: true};
                        componentConfigs.push(componentConfig);
                        newParentContent.push(componentConfig);
                    }
                }
            }
        });
    };
}
