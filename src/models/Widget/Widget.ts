import {type ComponentType} from "react";

import {
    AnimatorComponent,
    AnimatorSettingsPanelComponent,
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
import {
    AnimatorWidgetStore,
    EmptyWidgetStore,
    HistogramWidgetStore,
    LayerListWidgetStore,
    PvGeneratorWidgetStore,
    RenderConfigWidgetStore,
    SpatialProfileWidgetStore,
    SpectralLineQueryWidgetStore,
    SpectralProfileWidgetStore,
    StatsWidgetStore,
    StokesAnalysisWidgetStore
} from "stores/Widgets";

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
    /** Creates the store behind each instance of the widget. A widget without one is either a singleton or creates its stores itself. */
    createStore?: () => object;
}

const CreateWidgetMap = () =>
    new Map<string, WidgetRegistration>([
        [ImageViewComponent.WidgetConfig.type, {config: ImageViewComponent.WidgetConfig, settingsConfig: ImageViewSettingsPanelComponent.WidgetConfig, component: ImageViewComponent}],
        [
            RenderConfigComponent.WidgetConfig.type,
            {config: RenderConfigComponent.WidgetConfig, settingsConfig: RenderConfigSettingsPanelComponent.WidgetConfig, component: RenderConfigComponent, createStore: () => new RenderConfigWidgetStore()}
        ],
        [LayerListComponent.WidgetConfig.type, {config: LayerListComponent.WidgetConfig, settingsConfig: LayerListSettingsPanelComponent.WidgetConfig, component: LayerListComponent, createStore: () => new LayerListWidgetStore()}],
        [LogComponent.WidgetConfig.type, {config: LogComponent.WidgetConfig, component: LogComponent, createStore: () => new EmptyWidgetStore()}],
        [AnimatorComponent.WidgetConfig.type, {config: AnimatorComponent.WidgetConfig, settingsConfig: AnimatorSettingsPanelComponent.WidgetConfig, component: AnimatorComponent, createStore: () => new AnimatorWidgetStore()}],
        [ChannelMapControlComponent.WidgetConfig.type, {config: ChannelMapControlComponent.WidgetConfig, component: ChannelMapControlComponent, createStore: () => new EmptyWidgetStore()}],
        [
            SpatialProfilerComponent.WidgetConfig.type,
            {config: SpatialProfilerComponent.WidgetConfig, settingsConfig: SpatialProfilerSettingsPanelComponent.WidgetConfig, component: SpatialProfilerComponent, createStore: () => new SpatialProfileWidgetStore()}
        ],
        [
            SpectralProfilerComponent.WidgetConfig.type,
            {config: SpectralProfilerComponent.WidgetConfig, settingsConfig: SpectralProfilerSettingsPanelComponent.WidgetConfig, component: SpectralProfilerComponent, createStore: () => new SpectralProfileWidgetStore()}
        ],
        [StatsComponent.WidgetConfig.type, {config: StatsComponent.WidgetConfig, component: StatsComponent, createStore: () => new StatsWidgetStore()}],
        [HistogramComponent.WidgetConfig.type, {config: HistogramComponent.WidgetConfig, settingsConfig: HistogramSettingsPanelComponent.WidgetConfig, component: HistogramComponent, createStore: () => new HistogramWidgetStore()}],
        [RegionListComponent.WidgetConfig.type, {config: RegionListComponent.WidgetConfig, component: RegionListComponent, createStore: () => new EmptyWidgetStore()}],
        [
            StokesAnalysisComponent.WidgetConfig.type,
            {config: StokesAnalysisComponent.WidgetConfig, settingsConfig: StokesAnalysisSettingsPanelComponent.WidgetConfig, component: StokesAnalysisComponent, createStore: () => new StokesAnalysisWidgetStore()}
        ],
        [CatalogOverlayComponent.WidgetConfig.type, {config: CatalogOverlayComponent.WidgetConfig, settingsConfig: CatalogOverlayPlotSettingsPanelComponent.WidgetConfig, component: CatalogOverlayComponent}],
        [CatalogPlotComponent.WidgetConfig.type, {config: CatalogPlotComponent.WidgetConfig, component: CatalogPlotComponent}],
        [SpectralLineQueryComponent.WidgetConfig.type, {config: SpectralLineQueryComponent.WidgetConfig, component: SpectralLineQueryComponent, createStore: () => new SpectralLineQueryWidgetStore()}],
        [CursorInfoComponent.WidgetConfig.type, {config: CursorInfoComponent.WidgetConfig, component: CursorInfoComponent, createStore: () => new EmptyWidgetStore()}],
        [PvGeneratorComponent.WidgetConfig.type, {config: PvGeneratorComponent.WidgetConfig, settingsConfig: PvPreviewComponent.WidgetConfig, component: PvGeneratorComponent, createStore: () => new PvGeneratorWidgetStore()}],
        [PvPreviewComponent.WidgetConfig.type, {config: PvPreviewComponent.WidgetConfig, component: PvPreviewComponent}]
    ]);

let widgetMap: Map<string, WidgetRegistration> | undefined;

export function getWidgetMap() {
    if (!widgetMap) {
        widgetMap = CreateWidgetMap();
    }
    return widgetMap;
}
