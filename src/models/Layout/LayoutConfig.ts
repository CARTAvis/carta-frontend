import Ajv from "ajv";

import {createFlexLayoutModel, extractAbstractConfig, getComponentTabJson, getImageViewWeight, PresetLayout} from "models";
import {AppStore, type WidgetConfig} from "stores";
import {findDeep} from "utilities";

// eslint-disable-next-line @typescript-eslint/naming-convention
const layoutSchema = require("carta-schemas/layout_schema_2.json");

export class LayoutConfig {
    public static layoutValidator = new Ajv({useDefaults: "empty", strictTypes: false}).compile(layoutSchema);
    public static currentSchemaVersion = 2;

    public static getPresetConfig = (presetName: string) => {
        if (!presetName) {
            return null;
        }

        const config = PresetLayout.PRESET_CONFIGS.get(presetName);
        if (!config) {
            return null;
        }

        const imageViewerHeight = getImageViewWeight(); // modify WidgetsStore.ts as well if changing this
        const imageViewerWidth = 60;

        return {
            layoutVersion: LayoutConfig.currentSchemaVersion,
            docked: {
                type: "row",
                content: [
                    {
                        type: "column",
                        width: imageViewerWidth,
                        content: [
                            {type: "component", id: "image-view", height: imageViewerHeight},
                            {...config.leftBottomContent, height: 100 - imageViewerHeight}
                        ]
                    },
                    {
                        type: "column",
                        width: 100 - imageViewerWidth,
                        content: config.rightColumnContent
                    }
                ]
            },
            floating: []
        };
    };

    public static upgradeLayout = (layout: {layoutVersion: 1 | 2; docked: any; floating: any}) => {
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

    /**
     * Upgrade and validate a layout without changing the caller's object.
     *
     * Layout validation applies defaults, so validating a workspace's embedded layout in place
     * would mutate the workspace and make it possible to clear the current layout before a bad
     * config is rejected. Keep this operation as the single preparation step for callers that
     * are about to replace a live layout.
     */
    public static prepareLayout = (layout: {layoutVersion?: number; docked?: any; floating?: any[]} | undefined | null): any | undefined => {
        if (!layout) {
            return undefined;
        }

        let candidate: any;
        try {
            candidate = JSON.parse(JSON.stringify(layout));
        } catch (err) {
            console.error("Layout preparation failed:", err);
            return undefined;
        }

        LayoutConfig.upgradeLayout(candidate);
        if (!LayoutConfig.layoutValidator(candidate)) {
            console.error("Layout validation failed:", LayoutConfig.layoutValidator.errors);
            return undefined;
        }
        return candidate;
    };

    // Note: layoutConfig is formalized(modified) during validation if valid
    public static isUserLayoutValid = (layoutName: string, layoutConfig: any): boolean => {
        if (!layoutName || !layoutConfig) {
            return false;
        }
        // exclude conflict with presets
        if (PresetLayout.isPreset(layoutName)) {
            return false;
        }

        const isValidLayout = LayoutConfig.layoutValidator(layoutConfig);
        if (isValidLayout) {
            return true;
        } else {
            console.log(LayoutConfig.layoutValidator.errors);
            return false;
        }
    };

    /**
     * Converts the app's abstract layout config into a FlexLayout IJsonModel.
     * Also collects component configs for initializing widget stores.
     */
    public static createFlexLayoutModelJson = (dockedConfig: any, componentConfigs: any[]) => {
        // Convert the abstract config to FlexLayout model JSON first — this assigns unique IDs
        const modelJson = createFlexLayoutModel({type: dockedConfig.type, content: dockedConfig.content});
        // Then collect component configs (uses _assignedId set by createFlexLayoutModel)
        LayoutConfig.collectComponentConfigs(dockedConfig.content, componentConfigs);
        return modelJson;
    };

    /**
     * Recursively collects component configs from the abstract layout tree.
     * Each component config has: id, props, widgetSettings, plotType.
     */
    private static collectComponentConfigs = (content: any[], componentConfigs: any[]) => {
        if (!content || !Array.isArray(content)) {
            return;
        }

        for (const child of content) {
            if (!child.type) {
                continue;
            }

            if (child.type === "stack" || child.type === "row" || child.type === "column") {
                if (child.content) {
                    LayoutConfig.collectComponentConfigs(child.content, componentConfigs);
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
     *
     * @param shouldIncludeWorkspaceBindings - whether the arrangement may name the session's images and
     *        catalogs. A workspace carries its own copy of the layout alongside those items, so it
     *        can; a saved layout is meant to be reused against whatever happens to be open, where
     *        an ID from the session it was saved in would name something unrelated.
     */
    public static createConfigToSave = (appStore: AppStore, modelJson: any, shouldIncludeWorkspaceBindings: boolean = false) => {
        if (!appStore || !modelJson) {
            return null;
        }

        // Extract abstract config from FlexLayout model JSON
        const abstractConfig = extractAbstractConfig(modelJson);

        const configToSave = {
            layoutVersion: LayoutConfig.currentSchemaVersion,
            docked: abstractConfig,
            floating: [] as any[]
        };

        // Enrich docked widgets with widget settings
        LayoutConfig.enrichSaveConfig(appStore, configToSave.docked, shouldIncludeWorkspaceBindings);

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
            const widgetSettingsConfig = appStore.widgetsStore.toWidgetSettingsConfig(config.type, config.id, shouldIncludeWorkspaceBindings);
            if (widgetSettingsConfig) {
                floatingConfig.widgetSettings = widgetSettingsConfig;
            }
            // add plot type
            if (widgetSettingsConfig && "plotType" in widgetSettingsConfig && widgetSettingsConfig.plotType) {
                floatingConfig.plotType = widgetSettingsConfig.plotType;
            } else {
                const plotWidget = appStore.widgetsStore.catalogPlotWidgets.get(config.id);
                if (plotWidget) {
                    floatingConfig.plotType = plotWidget.plotType;
                }
            }
            configToSave.floating.push(floatingConfig);
        });

        return configToSave;
    };

    /**
     * Recursively enriches the abstract config with widget settings from current widget stores.
     */
    private static enrichSaveConfig = (appStore: AppStore, node: any, shouldIncludeWorkspaceBindings: boolean) => {
        if (!node || !node.content) {
            return;
        }

        for (const child of node.content) {
            if (child.type === "stack" || child.type === "row" || child.type === "column") {
                LayoutConfig.enrichSaveConfig(appStore, child, shouldIncludeWorkspaceBindings);
            } else if (child.type === "component" && child.id) {
                // Use the original instance ID for widget store lookups (e.g. "catalog-plot-0")
                // since child.id is the collapsed base type (e.g. "catalog-plot")
                const instanceId = child._instanceId || child.id;
                const widgetType = child.id.replace(/(-component)?-\d+$/, "");
                const widgetSettingsConfig = appStore.widgetsStore.toWidgetSettingsConfig(widgetType, instanceId, shouldIncludeWorkspaceBindings);
                if (widgetSettingsConfig) {
                    child.widgetSettings = widgetSettingsConfig;
                }
                if (widgetSettingsConfig && "plotType" in widgetSettingsConfig && widgetSettingsConfig.plotType) {
                    child.plotType = widgetSettingsConfig.plotType;
                } else {
                    const plotWidget = appStore.widgetsStore.catalogPlotWidgets.get(instanceId);
                    if (plotWidget) {
                        child.plotType = plotWidget.plotType;
                    }
                }
                // Clean up internal field so it doesn't persist in saved layouts
                delete child._instanceId;
            }
        }
    };

    /**
     * Legacy compatibility: Collects component configs from abstract layout tree.
     * Used when applying a layout to initialize widget stores before creating the FlexLayout model.
     */
    public static createConfigToApply = (newParentContent: any, parentContent: any, componentConfigs: any[]) => {
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
                        LayoutConfig.createConfigToApply(simpleChild.content, child.content, componentConfigs);
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
