import {type ComponentType} from "react";

import {
    AnimatorComponent,
    CatalogOverlayComponent,
    CatalogOverlayPlotSettingsPanelComponent,
    CatalogPlotComponent,
    ChannelMapControlComponent,
    CursorInfoComponent,
    CustomWidgetComponent,
    HistogramComponent,
    HistogramSettingsPanelComponent,
    ImageViewComponent,
    ImageViewSettingsPanelComponent,
    LayerListComponent,
    LayerListSettingsPanelComponent,
    LogComponent,
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

export interface DockedWidgetComponentProps {
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

export interface WidgetRegistration {
    config: DefaultWidgetConfig;
    settingsConfig?: DefaultWidgetConfig;
    component: ComponentType<DockedWidgetComponentProps>;
}

const CreateWidgetMap = () =>
    new Map<string, WidgetRegistration>([
        [ImageViewComponent.WidgetConfig.type, {config: ImageViewComponent.WidgetConfig, settingsConfig: ImageViewSettingsPanelComponent.WidgetConfig, component: ImageViewComponent}],
        [RenderConfigComponent.WidgetConfig.type, {config: RenderConfigComponent.WidgetConfig, settingsConfig: RenderConfigSettingsPanelComponent.WidgetConfig, component: RenderConfigComponent}],
        [LayerListComponent.WidgetConfig.type, {config: LayerListComponent.WidgetConfig, settingsConfig: LayerListSettingsPanelComponent.WidgetConfig, component: LayerListComponent}],
        [LogComponent.WidgetConfig.type, {config: LogComponent.WidgetConfig, component: LogComponent}],
        [AnimatorComponent.WidgetConfig.type, {config: AnimatorComponent.WidgetConfig, component: AnimatorComponent}],
        [ChannelMapControlComponent.WidgetConfig.type, {config: ChannelMapControlComponent.WidgetConfig, component: ChannelMapControlComponent}],
        [SpatialProfilerComponent.WidgetConfig.type, {config: SpatialProfilerComponent.WidgetConfig, settingsConfig: SpatialProfilerSettingsPanelComponent.WidgetConfig, component: SpatialProfilerComponent}],
        [SpectralProfilerComponent.WidgetConfig.type, {config: SpectralProfilerComponent.WidgetConfig, settingsConfig: SpectralProfilerSettingsPanelComponent.WidgetConfig, component: SpectralProfilerComponent}],
        [StatsComponent.WidgetConfig.type, {config: StatsComponent.WidgetConfig, component: StatsComponent}],
        [HistogramComponent.WidgetConfig.type, {config: HistogramComponent.WidgetConfig, settingsConfig: HistogramSettingsPanelComponent.WidgetConfig, component: HistogramComponent}],
        [RegionListComponent.WidgetConfig.type, {config: RegionListComponent.WidgetConfig, component: RegionListComponent}],
        [StokesAnalysisComponent.WidgetConfig.type, {config: StokesAnalysisComponent.WidgetConfig, settingsConfig: StokesAnalysisSettingsPanelComponent.WidgetConfig, component: StokesAnalysisComponent}],
        [CatalogOverlayComponent.WidgetConfig.type, {config: CatalogOverlayComponent.WidgetConfig, settingsConfig: CatalogOverlayPlotSettingsPanelComponent.WidgetConfig, component: CatalogOverlayComponent}],
        [CatalogPlotComponent.WidgetConfig.type, {config: CatalogPlotComponent.WidgetConfig, component: CatalogPlotComponent}],
        [SpectralLineQueryComponent.WidgetConfig.type, {config: SpectralLineQueryComponent.WidgetConfig, component: SpectralLineQueryComponent}],
        [CursorInfoComponent.WidgetConfig.type, {config: CursorInfoComponent.WidgetConfig, component: CursorInfoComponent}],
        [PvGeneratorComponent.WidgetConfig.type, {config: PvGeneratorComponent.WidgetConfig, settingsConfig: PvPreviewComponent.WidgetConfig, component: PvGeneratorComponent}],
        [PvPreviewComponent.WidgetConfig.type, {config: PvPreviewComponent.WidgetConfig, component: PvPreviewComponent}],
        [CustomWidgetComponent.WidgetConfig.type, {config: CustomWidgetComponent.WidgetConfig, component: CustomWidgetComponent}]
    ]);

let widgetMap: Map<string, WidgetRegistration> | undefined;

export function getWidgetMap() {
    if (!widgetMap) {
        widgetMap = CreateWidgetMap();
    }
    return widgetMap;
}
