import {type WorkspaceCatalogOverlayConfig, type WorkspaceCatalogPlotConfig} from "../Workspace";

/**
 * The Widget Config a Workspace keeps for each kind of widget, keyed by the widget's registration
 * type (ADR-0005). A kind of widget that gains one adds an entry here rather than a branch.
 */
export interface WidgetWorkspaceConfigs {
    "catalog-overlay": WorkspaceCatalogOverlayConfig;
    "catalog-plot": WorkspaceCatalogPlotConfig;
}

export type WidgetWorkspaceType = keyof WidgetWorkspaceConfigs;

/** One widget's Widget Config, tagged with its kind so that a restore can recreate a widget the layout does not have. */
export type WidgetWorkspaceConfig<TType extends WidgetWorkspaceType = WidgetWorkspaceType> = {[K in TType]: {type: K} & WidgetWorkspaceConfigs[K]}[TType];

export function isWidgetWorkspaceConfigOf<TType extends WidgetWorkspaceType>(config: WidgetWorkspaceConfig, type: TType): config is Extract<WidgetWorkspaceConfig, {type: TType}> {
    return config.type === type;
}
