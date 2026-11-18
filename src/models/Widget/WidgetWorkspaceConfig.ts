import {type WorkspaceCatalogOverlayConfig, type WorkspaceCatalogPlotConfig} from "../Workspace";

/**
 * The Widget Config that a workspace saves for each kind of widget, by the type in the widget's
 * registration. To give another kind of widget a Widget Config, add an entry here. Then save and
 * restore it where the stores of the widget are kept.
 */
export interface WidgetWorkspaceConfigs {
    "catalog-overlay": WorkspaceCatalogOverlayConfig;
    "catalog-plot": WorkspaceCatalogPlotConfig;
}

export type WidgetWorkspaceType = keyof WidgetWorkspaceConfigs;

/** The Widget Config of one widget, with the kind of the widget in `type`. A restore needs the kind to create the widget again when the layout does not have it. */
export type WidgetWorkspaceConfig<TType extends WidgetWorkspaceType = WidgetWorkspaceType> = {[K in TType]: {type: K} & WidgetWorkspaceConfigs[K]}[TType];

export function isWidgetWorkspaceConfigOf<TType extends WidgetWorkspaceType>(config: WidgetWorkspaceConfig, type: TType): config is Extract<WidgetWorkspaceConfig, {type: TType}> {
    return config.type === type;
}
