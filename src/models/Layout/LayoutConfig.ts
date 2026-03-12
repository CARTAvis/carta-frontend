import Ajv from "ajv";

import {CatalogOverlayComponent} from "components";
import {PresetLayout} from "models";
import {AppStore, CatalogStore, type WidgetConfig, type WidgetsStore} from "stores";
import {findDeep} from "utilities";

import {createFlexLayoutModel, extractAbstractConfig, getComponentTabJson} from "./FlexLayoutModelFactory";

const layoutSchema = require("carta-schemas/layout_schema_2.json");

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
                content: [
                    {
                        type: "column",
                        width: 60,
                        content: [
                            {type: "component", id: "image-view", height: 60},
                            {...config.leftBottomContent, height: 40}
                        ]
                    },
                    {
                        type: "column",
                        width: 40,
                        content: config.rightColumnContent
                    }
                ]
            },
            floating: []
        };
    };

    public static UpgradeLayout = (layout: {layoutVersion: 1 | 2; docked: any; floating: any}) => {
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
            // Remove floating settings widget in order to be backward compatible
            layout.floating = layout.floating.filter(floatingWidget => floatingWidget?.id !== "floating-settings");
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

    /**
     * Converts the app's abstract layout config into a FlexLayout IJsonModel.
     * Also collects component configs for initializing widget stores.
     */
    public static CreateFlexLayoutModelJson = (dockedConfig: any, componentConfigs: any[]) => {
        // Convert the abstract config to FlexLayout model JSON first — this assigns unique IDs
        const modelJson = createFlexLayoutModel({type: dockedConfig.type, content: dockedConfig.content});
        // Then collect component configs (uses _assignedId set by createFlexLayoutModel)
        LayoutConfig.CollectComponentConfigs(dockedConfig.content, componentConfigs);
        return modelJson;
    };

    /**
     * Recursively collects component configs from the abstract layout tree.
     * Each component config has: id, props, widgetSettings, plotType.
     */
    private static CollectComponentConfigs = (content: any[], componentConfigs: any[]) => {
        if (!content || !Array.isArray(content)) {
            return;
        }

        for (const child of content) {
            if (!child.type) {
                continue;
            }

            if (child.type === "stack" || child.type === "row" || child.type === "column") {
                if (child.content) {
                    LayoutConfig.CollectComponentConfigs(child.content, componentConfigs);
                }
            } else if (child.type === "component" && child.id) {
                const widgetType = child.id.replace(/-\d+$/, "");
                const tabJson = getComponentTabJson(widgetType);
                if (tabJson) {
                    // Use the unique ID assigned by createFlexLayoutModel if available
                    const assignedId = child._assignedId || child.id;
                    const componentConfig: any = {
                        id: widgetType,
                        component: widgetType,
                        props: {appStore: AppStore.Instance, id: assignedId, docked: true}
                    };
                    if (child.widgetSettings) {
                        componentConfig.widgetSettings = child.widgetSettings;
                    }
                    if (child.plotType) {
                        componentConfig.plotType = child.plotType;
                    }
                    componentConfigs.push(componentConfig);
                }
            }
        }
    };

    /**
     * Creates the abstract config from the current FlexLayout model for saving.
     */
    public static CreateConfigToSave = (appStore: AppStore, modelJson: any) => {
        if (!appStore || !modelJson) {
            return null;
        }

        // Extract abstract config from FlexLayout model JSON
        const abstractConfig = extractAbstractConfig(modelJson);

        const configToSave = {
            layoutVersion: LayoutConfig.CurrentSchemaVersion,
            docked: abstractConfig,
            floating: [] as any[]
        };

        // Enrich docked widgets with widget settings
        LayoutConfig.EnrichSaveConfig(appStore, configToSave.docked);

        // Handle floating widgets
        appStore.widgetsStore.floatingWidgets?.forEach((config: WidgetConfig) => {
            // skip saving floating settings panel
            if (config?.type === "floating-settings") {
                return;
            }
            const floatingConfig: any = {
                type: "component",
                id: config.type,
                defaultWidth: config.defaultWidth ? config.defaultWidth : "",
                defaultHeight: config.defaultHeight ? config.defaultHeight : "",
                defaultX: config.defaultX ? config.defaultX : "",
                defaultY: config.defaultY ? config.defaultY : ""
            };
            // add widget settings
            let widgetSettingsConfig: ReturnType<WidgetsStore["toWidgetSettingsConfig"]> = undefined;
            if (config.type === CatalogOverlayComponent.WIDGET_CONFIG.type) {
                const catalogFileId = CatalogStore.Instance.catalogProfiles.get(config.id) ?? NaN;
                const catalogWidgetStoreId = CatalogStore.Instance.catalogWidgets.get(catalogFileId);
                widgetSettingsConfig = appStore.widgetsStore.toWidgetSettingsConfig(config.type, catalogWidgetStoreId);
            } else {
                widgetSettingsConfig = appStore.widgetsStore.toWidgetSettingsConfig(config.type, config.id);
            }
            if (widgetSettingsConfig) {
                floatingConfig.widgetSettings = widgetSettingsConfig;
            }
            // add plot type
            const plotWidget = appStore.widgetsStore.catalogPlotWidgets.get(config.id);
            if (plotWidget) {
                floatingConfig.plotType = plotWidget.plotType;
            }
            configToSave.floating.push(floatingConfig);
        });

        return configToSave;
    };

    /**
     * Recursively enriches the abstract config with widget settings from current widget stores.
     */
    private static EnrichSaveConfig = (appStore: AppStore, node: any) => {
        if (!node || !node.content) {
            return;
        }

        for (const child of node.content) {
            if (child.type === "stack" || child.type === "row" || child.type === "column") {
                LayoutConfig.EnrichSaveConfig(appStore, child);
            } else if (child.type === "component" && child.id) {
                const widgetType = child.id.replace(/(-component)?-\d+$/, "");
                let widgetSettingsConfig: ReturnType<WidgetsStore["toWidgetSettingsConfig"]> = undefined;
                if (widgetType === CatalogOverlayComponent.WIDGET_CONFIG.type) {
                    const catalogFileId = CatalogStore.Instance.catalogProfiles.get(child.id) ?? NaN;
                    const catalogWidgetStoreId = CatalogStore.Instance.catalogWidgets.get(catalogFileId);
                    widgetSettingsConfig = appStore.widgetsStore.toWidgetSettingsConfig(widgetType, catalogWidgetStoreId);
                } else {
                    widgetSettingsConfig = appStore.widgetsStore.toWidgetSettingsConfig(widgetType, child.id);
                }
                if (widgetSettingsConfig) {
                    child.widgetSettings = widgetSettingsConfig;
                }
                const plotWidget = appStore.widgetsStore.catalogPlotWidgets.get(child.id);
                if (plotWidget) {
                    child.plotType = plotWidget.plotType;
                }
            }
        }
    };

    /**
     * Legacy compatibility: Collects component configs from abstract layout tree.
     * Used when applying a layout to initialize widget stores before creating the FlexLayout model.
     */
    public static CreateConfigToApply = (newParentContent: any, parentContent: any, componentConfigs: any[]) => {
        if (!newParentContent || !Array.isArray(newParentContent) || !parentContent || !Array.isArray(parentContent)) {
            return;
        }

        parentContent.forEach(child => {
            if (child.type) {
                if (child.type === "stack" || child.type === "row" || child.type === "column") {
                    const simpleChild: any = {
                        type: child.type,
                        content: []
                    };
                    if (child.type === "stack" && child.activeItemIndex >= 0 && child.activeItemIndex < child.content?.length) {
                        simpleChild.activeItemIndex = child.activeItemIndex;
                    }
                    if (child.width) {
                        simpleChild.width = child.width;
                    }
                    if (child.height) {
                        simpleChild.height = child.height;
                    }
                    newParentContent.push(simpleChild);
                    if (child.content) {
                        LayoutConfig.CreateConfigToApply(simpleChild.content, child.content, componentConfigs);
                    }
                } else if (child.type === "component" && child.id) {
                    const widgetType = child.id.replace(/-\d+$/, "");
                    const tabJson = getComponentTabJson(widgetType);
                    if (tabJson) {
                        const componentConfig: any = {
                            ...tabJson,
                            id: widgetType,
                            props: {appStore: AppStore.Instance, id: "", docked: true}
                        };
                        if (child.width) {
                            componentConfig.width = child.width;
                        }
                        if (child.height) {
                            componentConfig.height = child.height;
                        }
                        if (child.widgetSettings) {
                            componentConfig.widgetSettings = child.widgetSettings;
                        }
                        if (child.plotType) {
                            componentConfig.plotType = child.plotType;
                        }
                        componentConfigs.push(componentConfig);
                        newParentContent.push({
                            type: child.type,
                            id: child.id,
                            width: child.width,
                            height: child.height,
                            widgetSettings: child.widgetSettings,
                            plotType: child.plotType
                        });
                    }
                }
            }
        });
    };
}
