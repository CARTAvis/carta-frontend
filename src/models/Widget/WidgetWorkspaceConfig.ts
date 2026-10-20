import {type IdentifiedWidgetStore} from "../Config/ConfigurableStore";
import {
    type WorkspaceCatalogOverlayConfig,
    type WorkspaceCatalogPlotConfig,
    type WorkspaceHistogramWidgetConfig,
    type WorkspaceSpatialProfileWidgetConfig,
    type WorkspaceStatsWidgetConfig,
    type WorkspaceStokesAnalysisWidgetConfig
} from "../Workspace";

/**
 * The Widget Config that a workspace saves for each kind of widget, by the type in the widget's
 * registration. To give another kind of widget a Widget Config, add an entry here. Then save and
 * restore it where the stores of the widget are kept.
 */
export interface WidgetWorkspaceConfigs {
    "catalog-overlay": WorkspaceCatalogOverlayConfig;
    "catalog-plot": WorkspaceCatalogPlotConfig;
    "spatial-profiler": WorkspaceSpatialProfileWidgetConfig;
    histogram: WorkspaceHistogramWidgetConfig;
    stats: WorkspaceStatsWidgetConfig;
    stokes: WorkspaceStokesAnalysisWidgetConfig;
}

export type WidgetWorkspaceType = keyof WidgetWorkspaceConfigs;

/** The Widget Config of one widget, with the kind of the widget in `type`. A restore needs the kind to create the widget again when the layout does not have it. */
export type WidgetWorkspaceConfig<TType extends WidgetWorkspaceType = WidgetWorkspaceType> = {[K in TType]: {type: K} & WidgetWorkspaceConfigs[K]}[TType];

export function isWidgetWorkspaceConfigOf<TType extends WidgetWorkspaceType>(config: WidgetWorkspaceConfig, type: TType): config is Extract<WidgetWorkspaceConfig, {type: TType}> {
    return config.type === type;
}

/** How a workspace being saved names the data a widget shows. */
export interface WorkspaceIdWriter {
    /** The workspace ID of an image, or nothing for one the workspace does not carry. */
    imageIdOf(fileId: number): number | undefined;
}

/** How a workspace being restored names the data a widget shows, in this session's terms. */
export interface WorkspaceIdReader {
    /** The file ID a workspace image has in this session, or nothing for one that was not restored. */
    fileIdOf(workspaceImageId: number): number | undefined;
    /**
     * The ID a saved region has in this session, or nothing for one that was not restored.
     *
     * @param workspaceImageId - the image it was saved on; none for the image that was in front.
     */
    regionIdOf(workspaceImageId: number | undefined, savedRegionId: number): number | undefined;
}

/**
 * A widget's store that keeps Widget Config in a workspace.
 *
 * A restore applies it in two steps, letting what the widget does when it is pointed at other data
 * settle in between: first which image and region the widget shows, then the rest. Each step
 * answers what it could not bring back, as sentences about the widget.
 */
export interface WorkspaceConfigurableWidget<TConfig> extends IdentifiedWidgetStore {
    toWorkspaceConfig(ids: WorkspaceIdWriter): TConfig;
    applyWorkspaceBinding(config: TConfig, ids: WorkspaceIdReader): string[];
    applyWorkspaceConfig(config: TConfig, ids: WorkspaceIdReader): string[];
}
