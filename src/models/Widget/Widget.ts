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
        case ImageViewComponent.WIDGET_CONFIG.type:
            return ImageViewComponent.WIDGET_CONFIG;
        case RenderConfigComponent.WIDGET_CONFIG.type:
            return RenderConfigComponent.WIDGET_CONFIG;
        case LayerListComponent.WIDGET_CONFIG.type:
            return LayerListComponent.WIDGET_CONFIG;
        case LogComponent.WIDGET_CONFIG.type:
            return LogComponent.WIDGET_CONFIG;
        case AnimatorComponent.WIDGET_CONFIG.type:
            return AnimatorComponent.WIDGET_CONFIG;
        case ChannelMapControlComponent.WIDGET_CONFIG.type:
            return ChannelMapControlComponent.WIDGET_CONFIG;
        case SpatialProfilerComponent.WIDGET_CONFIG.type:
            return SpatialProfilerComponent.WIDGET_CONFIG;
        case SpectralProfilerComponent.WIDGET_CONFIG.type:
            return SpectralProfilerComponent.WIDGET_CONFIG;
        case StatsComponent.WIDGET_CONFIG.type:
            return StatsComponent.WIDGET_CONFIG;
        case HistogramComponent.WIDGET_CONFIG.type:
            return HistogramComponent.WIDGET_CONFIG;
        case RegionListComponent.WIDGET_CONFIG.type:
            return RegionListComponent.WIDGET_CONFIG;
        case StokesAnalysisComponent.WIDGET_CONFIG.type:
            return StokesAnalysisComponent.WIDGET_CONFIG;
        case CatalogOverlayComponent.WIDGET_CONFIG.type:
            return CatalogOverlayComponent.WIDGET_CONFIG;
        case CatalogPlotComponent.WIDGET_CONFIG.type:
            return CatalogPlotComponent.WIDGET_CONFIG;
        case SpectralLineQueryComponent.WIDGET_CONFIG.type:
            return SpectralLineQueryComponent.WIDGET_CONFIG;
        case CursorInfoComponent.WIDGET_CONFIG.type:
            return CursorInfoComponent.WIDGET_CONFIG;
        case PvGeneratorComponent.WIDGET_CONFIG.type:
            return PvGeneratorComponent.WIDGET_CONFIG;
        case PvPreviewComponent.WIDGET_CONFIG.type:
            return PvPreviewComponent.WIDGET_CONFIG;
        default:
            return PlaceholderComponent.WIDGET_CONFIG;
    }
};

export const GetDefaultWidgetSettingsConfig = (type: string): DefaultWidgetConfig => {
    switch (type) {
        case ImageViewComponent.WIDGET_CONFIG.type:
            return ImageViewSettingsPanelComponent.WIDGET_CONFIG;
        case StokesAnalysisComponent.WIDGET_CONFIG.type:
            return StokesAnalysisSettingsPanelComponent.WIDGET_CONFIG;
        case SpectralProfilerComponent.WIDGET_CONFIG.type:
            return SpectralProfilerSettingsPanelComponent.WIDGET_CONFIG;
        case SpatialProfilerComponent.WIDGET_CONFIG.type:
            return SpatialProfilerSettingsPanelComponent.WIDGET_CONFIG;
        case RenderConfigComponent.WIDGET_CONFIG.type:
            return RenderConfigSettingsPanelComponent.WIDGET_CONFIG;
        case HistogramComponent.WIDGET_CONFIG.type:
            return HistogramSettingsPanelComponent.WIDGET_CONFIG;
        case CatalogOverlayComponent.WIDGET_CONFIG.type:
            return CatalogOverlayPlotSettingsPanelComponent.WIDGET_CONFIG;
        case LayerListComponent.WIDGET_CONFIG.type:
            return LayerListSettingsPanelComponent.WIDGET_CONFIG;
        case PvGeneratorComponent.WIDGET_CONFIG.type:
            return PvPreviewComponent.WIDGET_CONFIG;
        default:
            return PlaceholderComponent.WIDGET_CONFIG;
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
