import {type IdentifiedWidgetStore} from "../Config/ConfigurableStore";
import {
    type WorkspaceCatalogOverlayConfig,
    type WorkspaceCatalogPlotConfig,
    type WorkspaceHistogramWidgetConfig,
    type WorkspaceRenderConfigWidgetConfig,
    type WorkspaceSpatialProfileWidgetConfig,
    type WorkspaceSpectralProfileWidgetConfig,
    type WorkspaceStatsWidgetConfig,
    type WorkspaceStokesAnalysisWidgetConfig
} from "../Workspace";

/**
 * The Widget Config a Workspace keeps for each kind of widget, keyed by the widget's registration
 * type (ADR-0005). A kind of widget that gains one adds an entry here rather than a branch.
 */
export interface WidgetWorkspaceConfigs {
    "catalog-overlay": WorkspaceCatalogOverlayConfig;
    "catalog-plot": WorkspaceCatalogPlotConfig;
    "render-config": WorkspaceRenderConfigWidgetConfig;
    "spatial-profiler": WorkspaceSpatialProfileWidgetConfig;
    "spectral-profiler": WorkspaceSpectralProfileWidgetConfig;
    histogram: WorkspaceHistogramWidgetConfig;
    stats: WorkspaceStatsWidgetConfig;
    stokes: WorkspaceStokesAnalysisWidgetConfig;
}

export type WidgetWorkspaceType = keyof WidgetWorkspaceConfigs;

/** One widget's Widget Config, tagged with its kind so that a restore can recreate a widget the layout does not have. */
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
    /** Whether the image saved in front was restored, which a widget following the active image was showing. */
    wasActiveImageRestored(): boolean;
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
