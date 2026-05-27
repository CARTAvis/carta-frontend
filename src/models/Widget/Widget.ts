import {type ComponentType} from "react";

import {
    AnimatorComponent,
    CatalogOverlayComponent,
    CatalogOverlayPlotSettingsPanelComponent,
    CatalogPlotComponent,
    ChannelMapControlComponent,
    CursorInfoComponent,
    HistogramComponent,
    HistogramSettingsPanelComponent,
    ImageViewComponent,
    ImageViewSettingsPanelComponent,
    LayerListComponent,
    LayerListSettingsPanelComponent,
    LogComponent,
    PlaceholderComponent,
    PvGeneratorComponent,
    PvPreviewComponent,
    RegionListComponent,
    RenderConfigComponent,
    RenderConfigSettingsPanelComponent,
    SpatialProfilerComponent,
    SpatialProfilerSettingsPanelComponent,
    SpectralLineQueryComponent,
    SpectralProfilerComponent,
    SpectralProfilerSettingsPanelComponent,
    StatsComponent,
    StokesAnalysisComponent,
    StokesAnalysisSettingsPanelComponent
} from "components";
import {type HelpType} from "enums";

interface DockedWidgetComponentProps {
    id: string;
    docked: boolean;
    floatingSettingsId?: string;
}

export interface DefaultWidgetConfig {
    id: string;
    type: string;
    minWidth: number;
    minHeight: number;
    defaultWidth: number;
    defaultHeight: number;
    defaultX?: number;
    defaultY?: number;
    isCloseable: boolean;
    title?: string;
    parentId?: string;
    parentType?: string;
    helpType?: HelpType | HelpType[];
    componentId?: string;
}

export const GetDefaultWidgetConfig = (type: string): DefaultWidgetConfig => {
    switch (type) {
        case ImageViewComponent.WidgetConfig.type:
            return ImageViewComponent.WidgetConfig;
        case RenderConfigComponent.WidgetConfig.type:
            return RenderConfigComponent.WidgetConfig;
        case LayerListComponent.WidgetConfig.type:
            return LayerListComponent.WidgetConfig;
        case LogComponent.WidgetConfig.type:
            return LogComponent.WidgetConfig;
        case AnimatorComponent.WidgetConfig.type:
            return AnimatorComponent.WidgetConfig;
        case ChannelMapControlComponent.WidgetConfig.type:
            return ChannelMapControlComponent.WidgetConfig;
        case SpatialProfilerComponent.WidgetConfig.type:
            return SpatialProfilerComponent.WidgetConfig;
        case SpectralProfilerComponent.WidgetConfig.type:
            return SpectralProfilerComponent.WidgetConfig;
        case StatsComponent.WidgetConfig.type:
            return StatsComponent.WidgetConfig;
        case HistogramComponent.WidgetConfig.type:
            return HistogramComponent.WidgetConfig;
        case RegionListComponent.WidgetConfig.type:
            return RegionListComponent.WidgetConfig;
        case StokesAnalysisComponent.WidgetConfig.type:
            return StokesAnalysisComponent.WidgetConfig;
        case CatalogOverlayComponent.WidgetConfig.type:
            return CatalogOverlayComponent.WidgetConfig;
        case CatalogPlotComponent.WidgetConfig.type:
            return CatalogPlotComponent.WidgetConfig;
        case SpectralLineQueryComponent.WidgetConfig.type:
            return SpectralLineQueryComponent.WidgetConfig;
        case CursorInfoComponent.WidgetConfig.type:
            return CursorInfoComponent.WidgetConfig;
        case PvGeneratorComponent.WidgetConfig.type:
            return PvGeneratorComponent.WidgetConfig;
        case PvPreviewComponent.WidgetConfig.type:
            return PvPreviewComponent.WidgetConfig;
        default:
            return PlaceholderComponent.WidgetConfig;
    }
};

export const GetDefaultWidgetSettingsConfig = (type: string): DefaultWidgetConfig => {
    switch (type) {
        case ImageViewComponent.WidgetConfig.type:
            return ImageViewSettingsPanelComponent.WidgetConfig;
        case StokesAnalysisComponent.WidgetConfig.type:
            return StokesAnalysisSettingsPanelComponent.WidgetConfig;
        case SpectralProfilerComponent.WidgetConfig.type:
            return SpectralProfilerSettingsPanelComponent.WidgetConfig;
        case SpatialProfilerComponent.WidgetConfig.type:
            return SpatialProfilerSettingsPanelComponent.WidgetConfig;
        case RenderConfigComponent.WidgetConfig.type:
            return RenderConfigSettingsPanelComponent.WidgetConfig;
        case HistogramComponent.WidgetConfig.type:
            return HistogramSettingsPanelComponent.WidgetConfig;
        case CatalogOverlayComponent.WidgetConfig.type:
            return CatalogOverlayPlotSettingsPanelComponent.WidgetConfig;
        case LayerListComponent.WidgetConfig.type:
            return LayerListSettingsPanelComponent.WidgetConfig;
        case PvGeneratorComponent.WidgetConfig.type:
            return PvPreviewComponent.WidgetConfig;
        default:
            return PlaceholderComponent.WidgetConfig;
    }
};

export const COMPONENT_MAP: Map<string, ComponentType<DockedWidgetComponentProps>> = new Map<string, ComponentType<DockedWidgetComponentProps>>([
    ["image-view", ImageViewComponent],
    ["spatial-profiler", SpatialProfilerComponent],
    ["spectral-profiler", SpectralProfilerComponent],
    ["spectral-line-query", SpectralLineQueryComponent],
    ["stats", StatsComponent],
    ["histogram", HistogramComponent],
    ["render-config", RenderConfigComponent],
    ["region-list", RegionListComponent],
    ["layer-list", LayerListComponent],
    ["cursor-info", CursorInfoComponent],
    ["pv-generator", PvGeneratorComponent],
    ["pv-preview", PvPreviewComponent],
    ["log", LogComponent],
    ["animator", AnimatorComponent],
    ["channel-map-control", ChannelMapControlComponent],
    ["stokes", StokesAnalysisComponent],
    ["catalog-overlay", CatalogOverlayComponent],
    ["catalog-plot", CatalogPlotComponent]
]);
