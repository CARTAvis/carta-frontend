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
 * The Widget Config that a workspace saves for each kind of widget, by the type in the widget's
 * registration. To give another kind of widget a Widget Config, add an entry here. Then save and
 * restore it where the stores of the widget are kept.
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

/** The Widget Config of one widget, with the kind of the widget in `type`. A restore needs the kind to create the widget again when the layout does not have it. */
export type WidgetWorkspaceConfig<TType extends WidgetWorkspaceType = WidgetWorkspaceType> = {[K in TType]: {type: K} & WidgetWorkspaceConfigs[K]}[TType];

export function isWidgetWorkspaceConfigOf<TType extends WidgetWorkspaceType>(config: WidgetWorkspaceConfig, type: TType): config is Extract<WidgetWorkspaceConfig, {type: TType}> {
    return config.type === type;
}

/** Gives the workspace IDs of the data that a widget shows, while a workspace is saved. */
export interface WorkspaceIdWriter {
    /** Returns the workspace ID of an image, or nothing when the workspace does not save the image. */
    imageIdOf(fileId: number): number | undefined;
}

/** Gives the IDs in this session of the data that a widget showed, while a workspace is restored. */
export interface WorkspaceIdReader {
    /** Returns the file ID that a workspace image has in this session, or nothing when the image was not restored. */
    fileIdOf(workspaceImageId: number): number | undefined;
    /**
     * Returns the ID that a saved region has in this session, or nothing when the region was not
     * restored.
     *
     * @param workspaceImageId - the workspace ID of the image that the region was saved on. Leave
     *                           it out for the image that was in front.
     */
    regionIdOf(workspaceImageId: number | undefined, savedRegionId: number): number | undefined;
    /** Returns whether the image that was in front when the workspace was saved was restored. A widget that follows the active image showed this image. */
    wasActiveImageRestored(): boolean;
}

/**
 * A widget store that saves a Widget Config in a workspace.
 *
 * A restore applies the config in three steps:
 * 1. Point the widget at its image and region.
 * 2. Apply what the widget shows of them.
 * 3. Zoom the widget to its saved range.
 *
 * Each step can reset the result of a later step, so the widget settles between the steps. The
 * first two steps return the problems as sentences about the widget. When there are problems, the
 * third step does not apply the zoom range.
 */
export interface WorkspaceConfigurableWidget<TConfig> extends IdentifiedWidgetStore {
    toWorkspaceConfig(ids: WorkspaceIdWriter): TConfig;
    applyWorkspaceBinding(config: TConfig, ids: WorkspaceIdReader): string[];
    applyWorkspaceConfig(config: TConfig, ids: WorkspaceIdReader): string[];
    applyWorkspaceView(config: TConfig): void;
}
