import Ajv from "ajv";

import {createFlexLayoutModel, extractAbstractConfig, getComponentTabJson, getImageViewWeight, type LayoutPersistence, PresetLayout} from "models";
import {AppStore, CatalogStore, type WidgetConfig} from "stores";
import {findDeep} from "utilities";

/* eslint-disable @typescript-eslint/naming-convention */
const layoutSchema = require("carta-schemas/layout_schema_2.json");
const workspaceSchema = require("carta-schemas/workspace_schema_2.json");
/* eslint-enable @typescript-eslint/naming-convention */

/** The settings of the line plots that a regular layout keeps for a plot widget, as CARTA v6.0 kept them. */
const LINE_PLOT_SETTINGS = ["primaryLineColor", "lineWidth", "linePlotPointSize", "plotType", "minXVal", "maxXVal", "minYVal", "maxYVal"] as const;

export class LayoutConfig {
    public static layoutValidator = new Ajv({useDefaults: "empty", strictTypes: false}).compile(layoutSchema);
    /** Validates the layout copy of a workspace, by the definition of the layout in the workspace schema. */
    public static workspaceLayoutValidator = new Ajv({useDefaults: "empty", strictTypes: false}).compile({$ref: "#/definitions/layout", definitions: workspaceSchema.definitions});
    public static currentSchemaVersion = 2;

    /**
     * The widget settings that a regular layout keeps, by widget type. These are the settings that
     * CARTA v6.0 kept, and the settings added since then for the rest frame of the spectral profiler,
     * the mean and RMS of the histogram, and the time labels of the animator. A regular layout keeps
     * no settings for the other widgets. A layout is saved with only these settings, so settings
     * that a widget got from the layout copy of a workspace do not go into a regular layout.
     */
    public static readonly REGULAR_WIDGET_SETTINGS: Readonly<Record<string, readonly string[]>> = {
        "render-config": [...LINE_PLOT_SETTINGS, "logScaleY", "markerTextVisible", "meanRmsVisible"],
        "spatial-profiler": [...LINE_PLOT_SETTINGS, "coordinate", "wcsAxisVisible", "meanRmsVisible"],
        "spectral-profiler": [...LINE_PLOT_SETTINGS, "meanRmsVisible", "xAxisRestFrameEnabled", "restFrameRedshift", "restFrameShiftMode", "restFrameVelocityConvention", "yAxisRestFrameEnabled"],
        histogram: [...LINE_PLOT_SETTINGS, "logScaleY", "meanRmsVisible"],
        stokes: ["primaryLineColor", "secondaryLineColor", "lineWidth", "linePlotPointSize", "plotType", "colorMap", "scatterPlotPointSize", "pointTransparency", "equalAxes"],
        "catalog-overlay": ["catalogFileId", "catalogColor", "highlightColor", "catalogSize", "catalogShape", "tableSeparatorPosition", "thickness"],
        animator: ["timeLabelFormat", "timeZoneMode", "ianaTimeZone", "timeScale", "isoTimePrecision", "numericTimePrecision", "relativeTimeReference", "relativeReferenceMjdUtc", "relativeTimeUnit"]
    };

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
     *
     * @param persistence - the kind of layout. A regular layout is validated by the layout schema.
     *                      The layout copy of a workspace is validated by the definition of the
     *                      layout in the workspace schema.
     */
    public static prepareLayout = (layout: {layoutVersion?: number; docked?: any; floating?: any[]} | undefined | null, persistence: LayoutPersistence = "regular"): any | undefined => {
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
        const validator = persistence === "workspace" ? LayoutConfig.workspaceLayoutValidator : LayoutConfig.layoutValidator;
        if (!validator(candidate)) {
            console.error("Layout validation failed:", validator.errors);
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
     *
     * @param persistence - the kind of layout.
     */
    public static createFlexLayoutModelJson = (dockedConfig: any, componentConfigs: any[], persistence: LayoutPersistence = "regular") => {
        // Convert the abstract config to FlexLayout model JSON first — this assigns unique IDs
        const modelJson = createFlexLayoutModel({type: dockedConfig.type, content: dockedConfig.content}, persistence);
        // Then collect component configs (uses _assignedId set by createFlexLayoutModel)
        LayoutConfig.collectComponentConfigs(dockedConfig.content, componentConfigs);
        return modelJson;
    };

    /**
     * Recursively collects component configs from the abstract layout tree.
     * Each component config has: id, props, widgetSettings, and plotType for a catalog plot in a layout
     * saved before its type moved into its widget settings.
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
     * Creates the abstract config from the current FlexLayout model for saving. It names none of the
     * session's images.
     *
     * @param persistence - the kind of layout. A regular layout keeps what CARTA v6.0 kept: it keeps
     *                      no maximized stack, saves the floating widgets in the order of the list of
     *                      floating widgets, and saves a position of 0 as an empty value. The layout
     *                      copy of a workspace also keeps the own ID of each widget and the settings
     *                      that only a workspace needs, a maximized stack, and a floating widget at
     *                      the left or top edge. It saves the floating widgets in their stacking order.
     */
    public static createConfigToSave = (appStore: AppStore, modelJson: any, persistence: LayoutPersistence = "regular") => {
        if (!appStore || !modelJson) {
            return null;
        }

        const isWorkspace = persistence === "workspace";
        // Extract abstract config from FlexLayout model JSON
        const abstractConfig = extractAbstractConfig(modelJson, persistence);

        const configToSave = {
            layoutVersion: LayoutConfig.currentSchemaVersion,
            docked: abstractConfig,
            floating: [] as any[]
        };

        // Enrich docked widgets with widget settings
        LayoutConfig.enrichSaveConfig(appStore, configToSave.docked, persistence);

        // The layout copy of a workspace saves the floating widgets from the bottom one to the top
        // one. A layout adds them again in this order, and each widget it adds is put on top. So they
        // are stacked as they were.
        const floatingWidgets = [...(appStore.widgetsStore.floatingWidgets ?? [])];
        if (isWorkspace) {
            const zIndexManager = appStore.zIndexManager;
            const zIndexOf = (config: WidgetConfig): number => zIndexManager?.findIndex(config.componentId ? config.componentId : config.id) ?? 0;
            floatingWidgets.sort((a, b) => zIndexOf(a) - zIndexOf(b));
        }
        floatingWidgets.forEach((config: WidgetConfig) => {
            // skip saving floating settings panel
            if (config?.type === "floating-settings") {
                return;
            }
            const floatingConfig: any = {
                type: "component",
                id: config.type,
                defaultWidth: config.defaultWidth ? config.defaultWidth : "",
                defaultHeight: config.defaultHeight ? config.defaultHeight : "",
                // The layout copy of a workspace saves a position of 0 too. It is at the left or top edge.
                defaultX: (isWorkspace ? typeof config.defaultX === "number" : config.defaultX) ? config.defaultX : "",
                defaultY: (isWorkspace ? typeof config.defaultY === "number" : config.defaultY) ? config.defaultY : ""
            };
            // add widget settings
            const widgetSettingsConfig = LayoutConfig.widgetSettingsToSave(appStore, config.type, config.id, persistence);
            if (widgetSettingsConfig) {
                floatingConfig.widgetSettings = widgetSettingsConfig;
            }
            // A regular layout keeps the type of a catalog plot beside its settings.
            const plotType = isWorkspace ? undefined : LayoutConfig.catalogPlotTypeOf(appStore, config.type, config.id);
            if (plotType) {
                floatingConfig.plotType = plotType;
            }
            configToSave.floating.push(floatingConfig);
        });

        return configToSave;
    };

    /**
     * Returns the settings that a layout saves for a widget. A regular layout saves only the settings
     * in {@link REGULAR_WIDGET_SETTINGS}.
     */
    private static widgetSettingsToSave = (appStore: AppStore, widgetType: string, instanceId: string, persistence: LayoutPersistence): object | undefined => {
        const widgetSettings = appStore.widgetsStore.toWidgetSettingsConfig(widgetType, instanceId, persistence);
        if (!widgetSettings || persistence === "workspace") {
            return widgetSettings ?? undefined;
        }
        const regularSettings: Record<string, unknown> = {};
        for (const field of LayoutConfig.REGULAR_WIDGET_SETTINGS[widgetType] ?? []) {
            const value = (widgetSettings as Record<string, unknown>)[field];
            if (value !== undefined) {
                regularSettings[field] = value;
            }
        }
        return Object.keys(regularSettings).length ? regularSettings : undefined;
    };

    /** Returns the type of the plot that a catalog plot widget shows, or undefined for any other widget. */
    private static catalogPlotTypeOf = (appStore: AppStore, widgetType: string, instanceId: string): string | undefined => {
        if (widgetType !== "catalog-plot") {
            return undefined;
        }
        return CatalogStore.Instance.widgetBindings.layoutSettingsFor(instanceId)?.plotType ?? appStore.widgetsStore.catalogPlotWidgets.get(instanceId)?.plotType;
    };

    /**
     * Recursively enriches the abstract config with widget settings from current widget stores. The
     * settings are made again from the widget stores. So a regular layout does not keep the settings
     * that a tab got from the layout copy of a workspace.
     */
    private static enrichSaveConfig = (appStore: AppStore, node: any, persistence: LayoutPersistence) => {
        if (!node || !node.content) {
            return;
        }

        for (const child of node.content) {
            if (child.type === "stack" || child.type === "row" || child.type === "column") {
                LayoutConfig.enrichSaveConfig(appStore, child, persistence);
            } else if (child.type === "component" && child.id) {
                // Use the original instance ID for widget store lookups (e.g. "catalog-plot-0")
                // since child.id is the collapsed base type (e.g. "catalog-plot")
                const instanceId = child._instanceId || child.id;
                const widgetType = child.id.replace(/(-component)?-\d+$/, "");
                const widgetSettingsConfig = LayoutConfig.widgetSettingsToSave(appStore, widgetType, instanceId, persistence);
                if (widgetSettingsConfig) {
                    child.widgetSettings = widgetSettingsConfig;
                } else {
                    delete child.widgetSettings;
                }
                const plotType = persistence === "workspace" ? undefined : LayoutConfig.catalogPlotTypeOf(appStore, widgetType, instanceId);
                if (plotType) {
                    child.plotType = plotType;
                }
                // Clean up internal field so it doesn't persist in saved layouts
                delete child._instanceId;
            }
        }
    };

    /**
     * Legacy compatibility: Collects component configs from abstract layout tree.
     * Used when applying a layout to initialize widget stores before creating the FlexLayout model.
     *
     * @param persistence - the kind of layout. Only the layout copy of a workspace keeps a stack maximized.
     */
    public static createConfigToApply = (newParentContent: any, parentContent: any, componentConfigs: any[], persistence: LayoutPersistence = "regular") => {
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
                    if (persistence === "workspace" && child.type === "stack" && child.maximized === true) {
                        simpleChild.maximized = true;
                    }
                    if (child.width) {
                        simpleChild.width = child.width;
                    }
                    if (child.height) {
                        simpleChild.height = child.height;
                    }
                    newParentContent.push(simpleChild);
                    if (child.content) {
                        LayoutConfig.createConfigToApply(simpleChild.content, child.content, componentConfigs, persistence);
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
