import * as React from "react";
import {observer} from "mobx-react";

import {
    AnimatorComponent,
    AnimatorSettingsPanelComponent,
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
import {canPopoutWidget} from "models/Layout/FlexLayoutModelFactory";
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
    private static readonly FloatingSettingsWidgetTypes = new Set<string>(["stokes", "spectral-profiler", "spatial-profiler", "render-config", "histogram", "catalog-overlay", "layer-list", "animator"]);

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
                [ImageViewComponent.WidgetConfig.type, RenderDocklessWidget(ImageViewComponent)],
                [LayerListComponent.WidgetConfig.type, RenderDocklessWidget(LayerListComponent)],
                [LogComponent.WidgetConfig.type, RenderDocklessWidget(LogComponent)],
                [RenderConfigComponent.WidgetConfig.type, RenderDocklessWidget(RenderConfigComponent)],
                [AnimatorComponent.WidgetConfig.type, RenderDocklessWidget(AnimatorComponent)],
                [ChannelMapControlComponent.WidgetConfig.type, RenderDocklessWidget(ChannelMapControlComponent)],
                [SpatialProfilerComponent.WidgetConfig.type, RenderDocklessWidget(SpatialProfilerComponent)],
                [SpectralProfilerComponent.WidgetConfig.type, RenderDocklessWidget(SpectralProfilerComponent)],
                [SpectralLineQueryComponent.WidgetConfig.type, RenderDocklessWidget(SpectralLineQueryComponent)],
                [StatsComponent.WidgetConfig.type, RenderDocklessWidget(StatsComponent)],
                [HistogramComponent.WidgetConfig.type, RenderDocklessWidget(HistogramComponent)],
                [RegionListComponent.WidgetConfig.type, RenderDocklessWidget(RegionListComponent)],
                [StokesAnalysisComponent.WidgetConfig.type, RenderDocklessWidget(StokesAnalysisComponent)],
                [CursorInfoComponent.WidgetConfig.type, RenderDocklessWidget(CursorInfoComponent)],
                [CatalogPlotComponent.WidgetConfig.type, RenderDocklessWidget(CatalogPlotComponent)],
                [PvGeneratorComponent.WidgetConfig.type, RenderDocklessWidget(PvGeneratorComponent)]
            ]);
        }

        return this.floatingWidgetContentRenderers;
    };

    private getWidgetSettingsRenderers = () => {
        if (!this.floatingWidgetSettingsRenderers) {
            this.floatingWidgetSettingsRenderers = new Map<string, FloatingWidgetRenderer>([
                [ImageViewComponent.WidgetConfig.type, RenderFloatingSettingsWidget(ImageViewSettingsPanelComponent)],
                [StokesAnalysisComponent.WidgetConfig.type, RenderFloatingSettingsWidget(StokesAnalysisSettingsPanelComponent)],
                [SpectralProfilerComponent.WidgetConfig.type, RenderFloatingSettingsWidget(SpectralProfilerSettingsPanelComponent)],
                [SpatialProfilerComponent.WidgetConfig.type, RenderFloatingSettingsWidget(SpatialProfilerSettingsPanelComponent)],
                [RenderConfigComponent.WidgetConfig.type, RenderFloatingSettingsWidget(RenderConfigSettingsPanelComponent)],
                [HistogramComponent.WidgetConfig.type, RenderFloatingSettingsWidget(HistogramSettingsPanelComponent)],
                [CatalogOverlayComponent.WidgetConfig.type, RenderFloatingSettingsWidget(CatalogOverlayPlotSettingsPanelComponent)],
                [LayerListComponent.WidgetConfig.type, RenderFloatingSettingsWidget(LayerListSettingsPanelComponent)],
                [AnimatorComponent.WidgetConfig.type, RenderFloatingSettingsWidget(AnimatorSettingsPanelComponent)]
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
            case CatalogOverlayComponent.WidgetConfig.type:
                this.removeCatalogOverlayWidget(widget.componentId);
                break;
            case CatalogPlotComponent.WidgetConfig.type:
                this.removeCatalogPlotWidget(widget.componentId);
                break;
            case LayerListSettingsPanelComponent.WidgetConfig.type:
                this.removeLayerListSettingsWidget(widget);
                break;
            case PvPreviewComponent.WidgetConfig.type:
                this.removePvPreviewWidget(widget);
                break;
            case PvGeneratorComponent.WidgetConfig.type:
                this.removePvGeneratorWidget(widget.id);
                break;
            default:
                this.removeFloatingWidget(widget.id);
                break;
        }
    };

    private getWidgetContent(widgetConfig: WidgetConfig) {
        if (widgetConfig.type === CatalogOverlayComponent.WidgetConfig.type) {
            return <CatalogOverlayComponent id={widgetConfig.componentId ?? ""} docked={false} />;
        }

        if (widgetConfig.type === PvPreviewComponent.WidgetConfig.type) {
            return <PvPreviewComponent id={widgetConfig.parentId ?? ""} docked={false} floatingSettingsId={widgetConfig.id} />;
        }

        const renderWidget = this.getWidgetContentRenderers().get(widgetConfig.type);
        if (renderWidget) {
            return renderWidget(widgetConfig);
        }

        return <PlaceholderComponent id={widgetConfig.id} isDocked={false} label={widgetConfig.title ?? ""} />;
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
                    let shouldShowSettingsButton = this.showFloatingSettingsButton(w);
                    if (w.type === RenderConfigComponent.WidgetConfig.type) {
                        shouldShowSettingsButton = AppStore.Instance.activeImage?.type !== ImageType.COLOR_BLENDING;
                    }

                    const shouldShowPinButton = this.showPin(w);
                    const canPopout = canPopoutWidget(w.type);
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
                                shouldShowPinButton={shouldShowPinButton}
                                onSelected={() => this.onFloatingWidgetSelected(w)}
                                onClosed={() => this.onFloatingWidgetClosed(w)}
                                shouldShowFloatingSettingsButton={shouldShowSettingsButton}
                                canPopout={canPopout}
                                floatingWidgets={widgetConfigs.length}
                            >
                                {shouldShowPinButton ? this.getWidgetContent(w) : this.getWidgetSettings(w)}
                            </FloatingWidgetComponent>
                        </div>
                    );
                })}
            </div>
        );
    }
}
