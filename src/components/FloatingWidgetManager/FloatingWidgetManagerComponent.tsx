import * as React from "react";
import {observer} from "mobx-react";

import {
    AnimatorComponent,
    CatalogOverlayComponent,
    CatalogOverlayPlotSettingsPanelComponent,
    CatalogPlotComponent,
    ChannelMapControlComponent,
    CursorInfoComponent,
    FloatingWidgetComponent,
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
import {ImageType} from "enums";
import {AppStore, CatalogStore, type WidgetConfig, type WidgetProps, WidgetsStore} from "stores";

type FloatingWidgetRenderer = (widgetConfig: WidgetConfig) => React.ReactNode;

const RenderDocklessWidget = (Component: React.ComponentType<WidgetProps>): FloatingWidgetRenderer => {
    return widgetConfig => <Component id={widgetConfig.id} docked={false} />;
};

const RenderFloatingSettingsWidget = (Component: React.ComponentType<WidgetProps>): FloatingWidgetRenderer => {
    return widgetConfig => <Component id={widgetConfig.parentId ?? ""} docked={false} floatingSettingsId={widgetConfig.id} />;
};

@observer
export class FloatingWidgetManagerComponent extends React.Component {
    private static readonly FloatingSettingsWidgetTypes = new Set<string>(["stokes", "spectral-profiler", "spatial-profiler", "render-config", "histogram", "catalog-overlay", "layer-list"]);

    private floatingSettingType = "floating-settings";
    private floatingWidgetContentRenderers?: Map<string, FloatingWidgetRenderer>;
    private floatingWidgetSettingsRenderers?: Map<string, FloatingWidgetRenderer>;

    private removeFloatingWidget = (widgetId: string) => {
        WidgetsStore.Instance.removeFloatingWidget(widgetId);
    };

    private getPreviewFrameIndex = (widgetId: string) => {
        return parseInt(widgetId.split("-")[2]);
    };

    private removeCatalogOverlayWidget = (componentId?: string) => {
        if (!componentId) {
            return;
        }

        const widgetsStore = WidgetsStore.Instance;
        widgetsStore.removeFloatingWidgetComponent(componentId);
        CatalogStore.Instance.catalogProfiles.delete(componentId);
    };

    private removeCatalogPlotWidget = (componentId?: string) => {
        if (!componentId) {
            return;
        }

        const widgetsStore = WidgetsStore.Instance;
        widgetsStore.removeFloatingWidgetComponent(componentId);
        CatalogStore.Instance.clearCatalogPlotsByComponentId(componentId);
    };

    private removeLayerListSettingsWidget = (widget: WidgetConfig) => {
        if (widget.parentId) {
            WidgetsStore.Instance.layerListWidgets.get(widget.parentId)?.resetSelectedFrameIndex();
        }

        this.removeFloatingWidget(widget.id);
    };

    private removePvPreviewWidget = (widget: WidgetConfig) => {
        if (widget.parentId) {
            WidgetsStore.Instance.pvGeneratorWidgets.get(widget.parentId)?.removePreviewFrame(this.getPreviewFrameIndex(widget.parentId));
        }

        this.removeFloatingWidget(widget.id);
    };

    private removePvGeneratorWidget = (widgetId: string) => {
        WidgetsStore.Instance.pvGeneratorWidgets.get(widgetId)?.removePreviewFrame(this.getPreviewFrameIndex(widgetId));
        this.removeFloatingWidget(widgetId);
    };

    private getFloatingWidgetId = (widget: WidgetConfig) => {
        return widget.componentId ? widget.componentId : widget.id;
    };

    private getWidgetContentRenderers = () => {
        if (!this.floatingWidgetContentRenderers) {
            this.floatingWidgetContentRenderers = new Map<string, FloatingWidgetRenderer>([
                [ImageViewComponent.WIDGET_CONFIG.type, RenderDocklessWidget(ImageViewComponent)],
                [LayerListComponent.WIDGET_CONFIG.type, RenderDocklessWidget(LayerListComponent)],
                [LogComponent.WIDGET_CONFIG.type, RenderDocklessWidget(LogComponent)],
                [RenderConfigComponent.WIDGET_CONFIG.type, RenderDocklessWidget(RenderConfigComponent)],
                [AnimatorComponent.WIDGET_CONFIG.type, RenderDocklessWidget(AnimatorComponent)],
                [ChannelMapControlComponent.WIDGET_CONFIG.type, RenderDocklessWidget(ChannelMapControlComponent)],
                [SpatialProfilerComponent.WIDGET_CONFIG.type, RenderDocklessWidget(SpatialProfilerComponent)],
                [SpectralProfilerComponent.WIDGET_CONFIG.type, RenderDocklessWidget(SpectralProfilerComponent)],
                [SpectralLineQueryComponent.WIDGET_CONFIG.type, RenderDocklessWidget(SpectralLineQueryComponent)],
                [StatsComponent.WIDGET_CONFIG.type, RenderDocklessWidget(StatsComponent)],
                [HistogramComponent.WIDGET_CONFIG.type, RenderDocklessWidget(HistogramComponent)],
                [RegionListComponent.WIDGET_CONFIG.type, RenderDocklessWidget(RegionListComponent)],
                [StokesAnalysisComponent.WIDGET_CONFIG.type, RenderDocklessWidget(StokesAnalysisComponent)],
                [CursorInfoComponent.WIDGET_CONFIG.type, RenderDocklessWidget(CursorInfoComponent)],
                [CatalogPlotComponent.WIDGET_CONFIG.type, RenderDocklessWidget(CatalogPlotComponent)],
                [PvGeneratorComponent.WIDGET_CONFIG.type, RenderDocklessWidget(PvGeneratorComponent)]
            ]);
        }

        return this.floatingWidgetContentRenderers;
    };

    private getWidgetSettingsRenderers = () => {
        if (!this.floatingWidgetSettingsRenderers) {
            this.floatingWidgetSettingsRenderers = new Map<string, FloatingWidgetRenderer>([
                [ImageViewComponent.WIDGET_CONFIG.type, RenderFloatingSettingsWidget(ImageViewSettingsPanelComponent)],
                [StokesAnalysisComponent.WIDGET_CONFIG.type, RenderFloatingSettingsWidget(StokesAnalysisSettingsPanelComponent)],
                [SpectralProfilerComponent.WIDGET_CONFIG.type, RenderFloatingSettingsWidget(SpectralProfilerSettingsPanelComponent)],
                [SpatialProfilerComponent.WIDGET_CONFIG.type, RenderFloatingSettingsWidget(SpatialProfilerSettingsPanelComponent)],
                [RenderConfigComponent.WIDGET_CONFIG.type, RenderFloatingSettingsWidget(RenderConfigSettingsPanelComponent)],
                [HistogramComponent.WIDGET_CONFIG.type, RenderFloatingSettingsWidget(HistogramSettingsPanelComponent)],
                [CatalogOverlayComponent.WIDGET_CONFIG.type, RenderFloatingSettingsWidget(CatalogOverlayPlotSettingsPanelComponent)],
                [LayerListComponent.WIDGET_CONFIG.type, RenderFloatingSettingsWidget(LayerListSettingsPanelComponent)]
            ]);
        }

        return this.floatingWidgetSettingsRenderers;
    };

    onFloatingWidgetSelected = (widget: WidgetConfig) => {
        // rearrange will cause a bug of empty table, change to zIndex
        const zIndexManager = AppStore.Instance.zIndexManager;
        zIndexManager.updateIndexOnSelect(this.getFloatingWidgetId(widget));
    };

    onFloatingWidgetClosed = (widget: WidgetConfig) => {
        switch (widget.type) {
            case CatalogOverlayComponent.WIDGET_CONFIG.type:
                this.removeCatalogOverlayWidget(widget.componentId);
                break;
            case CatalogPlotComponent.WIDGET_CONFIG.type:
                this.removeCatalogPlotWidget(widget.componentId);
                break;
            case LayerListSettingsPanelComponent.WIDGET_CONFIG.type:
                this.removeLayerListSettingsWidget(widget);
                break;
            case PvPreviewComponent.WIDGET_CONFIG.type:
                this.removePvPreviewWidget(widget);
                break;
            case PvGeneratorComponent.WIDGET_CONFIG.type:
                this.removePvGeneratorWidget(widget.id);
                break;
            default:
                this.removeFloatingWidget(widget.id);
                break;
        }
    };

    private getWidgetContent(widgetConfig: WidgetConfig) {
        if (widgetConfig.type === CatalogOverlayComponent.WIDGET_CONFIG.type) {
            return <CatalogOverlayComponent id={widgetConfig.componentId ?? ""} docked={false} />;
        }

        if (widgetConfig.type === PvPreviewComponent.WIDGET_CONFIG.type) {
            return <PvPreviewComponent id={widgetConfig.parentId ?? ""} docked={false} floatingSettingsId={widgetConfig.id} />;
        }

        const renderWidget = this.getWidgetContentRenderers().get(widgetConfig.type);
        if (renderWidget) {
            return renderWidget(widgetConfig);
        }

        return <PlaceholderComponent id={widgetConfig.id} docked={false} label={widgetConfig.title ?? ""} />;
    }

    private getWidgetSettings(widgetConfig: WidgetConfig) {
        if (!widgetConfig.parentId) {
            return null;
        }

        const renderWidgetSettings = widgetConfig.parentType ? this.getWidgetSettingsRenderers().get(widgetConfig.parentType) : undefined;
        return renderWidgetSettings ? renderWidgetSettings(widgetConfig) : null;
    }

    private showPin(widgetConfig: WidgetConfig) {
        return widgetConfig.type !== this.floatingSettingType;
    }

    private showFloatingSettingsButton(widgetConfig: WidgetConfig) {
        return FloatingWidgetManagerComponent.FloatingSettingsWidgetTypes.has(widgetConfig.type);
    }

    public render() {
        const widgetConfigs = WidgetsStore.Instance.floatingWidgets;
        const zIndexManager = AppStore.Instance.zIndexManager;

        return (
            <div>
                {widgetConfigs.map(w => {
                    let showSettingsButton = this.showFloatingSettingsButton(w);
                    if (w.type === RenderConfigComponent.WIDGET_CONFIG.type) {
                        showSettingsButton = AppStore.Instance.activeImage?.type !== ImageType.COLOR_BLENDING;
                    }

                    const showPinButton = this.showPin(w);
                    const canPopout = w.type !== CatalogPlotComponent.WIDGET_CONFIG.type;
                    const id = this.getFloatingWidgetId(w);

                    const zIndex = zIndexManager.findIndex(id);
                    const numFloatingObjs = zIndexManager.floatingObjsNum;

                    return (
                        <div key={id}>
                            <FloatingWidgetComponent
                                isSelected={zIndex === numFloatingObjs}
                                key={id}
                                widgetConfig={w}
                                zIndex={zIndex}
                                showPinButton={showPinButton}
                                onSelected={() => this.onFloatingWidgetSelected(w)}
                                onClosed={() => this.onFloatingWidgetClosed(w)}
                                showFloatingSettingsButton={showSettingsButton}
                                canPopout={canPopout}
                                floatingWidgets={widgetConfigs.length}
                            >
                                {showPinButton ? this.getWidgetContent(w) : this.getWidgetSettings(w)}
                            </FloatingWidgetComponent>
                        </div>
                    );
                })}
            </div>
        );
    }
}
