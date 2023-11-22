import * as React from "react";
import {observer} from "mobx-react";

import {
    AnimatorComponent,
    CatalogOverlayComponent,
    CatalogOverlayPlotSettingsPanelComponent,
    CatalogPlotComponent,
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
import {ZIndexManagement} from "models";
import {AppStore, CatalogStore, WidgetConfig, WidgetsStore} from "stores";

@observer
export class FloatingWidgetManagerComponent extends React.Component {
    private floatingSettingType = "floating-settings";

    onFloatingWidgetSelected = (widget: WidgetConfig) => {
        // rearrange will cause a bug of empty table, change to zIndex
        const zIndexManagement = ZIndexManagement.Instance;
        zIndexManagement.updateFloatingObjzIndexOnSelect(widget.id, AppStore.Instance.floatingObjs);
    };

    onFloatingWidgetClosed = (widget: WidgetConfig) => {
        const widgetsStore = WidgetsStore.Instance;
        switch (widget.type) {
            case CatalogOverlayComponent.WIDGET_CONFIG.type:
                // remove widget component only
                widgetsStore.removeFloatingWidgetComponent(widget.componentId);
                CatalogStore.Instance.catalogProfiles.delete(widget.componentId);
                break;
            case CatalogPlotComponent.WIDGET_CONFIG.type:
                widgetsStore.removeFloatingWidgetComponent(widget.componentId);
                CatalogStore.Instance.clearCatalogPlotsByComponentId(widget.componentId);
                break;
            case LayerListSettingsPanelComponent.WIDGET_CONFIG.type:
                widgetsStore.layerListWidgets.get(widget.parentId)?.resetSelectedFrameIndex();
                widgetsStore.removeFloatingWidget(widget.id);
                break;
            case PvPreviewComponent.WIDGET_CONFIG.type:
                widgetsStore.pvGeneratorWidgets.get(widget.parentId)?.removePreviewFrame(parseInt(widget.parentId.split("-")[2]));
                widgetsStore.removeFloatingWidget(widget.id);
                break;
            case PvGeneratorComponent.WIDGET_CONFIG.type:
                widgetsStore.pvGeneratorWidgets.get(widget.id)?.removePreviewFrame(parseInt(widget.id.split("-")[2]));
                widgetsStore.removeFloatingWidget(widget.id);
                break;
            default:
                widgetsStore.removeFloatingWidget(widget.id);
                break;
        }
    };

    private getWidgetContent(widgetConfig: WidgetConfig) {
        switch (widgetConfig.type) {
            case ImageViewComponent.WIDGET_CONFIG.type:
                return <ImageViewComponent id={widgetConfig.id} docked={false} />;
            case LayerListComponent.WIDGET_CONFIG.type:
                return <LayerListComponent id={widgetConfig.id} docked={false} />;
            case LogComponent.WIDGET_CONFIG.type:
                return <LogComponent id={widgetConfig.id} docked={false} />;
            case RenderConfigComponent.WIDGET_CONFIG.type:
                return <RenderConfigComponent id={widgetConfig.id} docked={false} />;
            case AnimatorComponent.WIDGET_CONFIG.type:
                return <AnimatorComponent id={widgetConfig.id} docked={false} />;
            case SpatialProfilerComponent.WIDGET_CONFIG.type:
                return <SpatialProfilerComponent id={widgetConfig.id} docked={false} />;
            case SpectralProfilerComponent.WIDGET_CONFIG.type:
                return <SpectralProfilerComponent id={widgetConfig.id} docked={false} />;
            case SpectralLineQueryComponent.WIDGET_CONFIG.type:
                return <SpectralLineQueryComponent id={widgetConfig.id} docked={false} />;
            case StatsComponent.WIDGET_CONFIG.type:
                return <StatsComponent id={widgetConfig.id} docked={false} />;
            case HistogramComponent.WIDGET_CONFIG.type:
                return <HistogramComponent id={widgetConfig.id} docked={false} />;
            case RegionListComponent.WIDGET_CONFIG.type:
                return <RegionListComponent id={widgetConfig.id} docked={false} />;
            case StokesAnalysisComponent.WIDGET_CONFIG.type:
                return <StokesAnalysisComponent id={widgetConfig.id} docked={false} />;
            case CursorInfoComponent.WIDGET_CONFIG.type:
                return <CursorInfoComponent id={widgetConfig.id} docked={false} />;
            case CatalogOverlayComponent.WIDGET_CONFIG.type:
                return <CatalogOverlayComponent id={widgetConfig.componentId} docked={false} />;
            case CatalogPlotComponent.WIDGET_CONFIG.type:
                return <CatalogPlotComponent id={widgetConfig.id} docked={false} />;
            case PvGeneratorComponent.WIDGET_CONFIG.type:
                return <PvGeneratorComponent id={widgetConfig.id} docked={false} />;
            case PvPreviewComponent.WIDGET_CONFIG.type:
                return <PvPreviewComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
            default:
                return <PlaceholderComponent id={widgetConfig.id} docked={false} label={widgetConfig.title} />;
        }
    }

    private getWidgetSettings(widgetConfig: WidgetConfig) {
        if (widgetConfig.parentId) {
            switch (widgetConfig.parentType) {
                case ImageViewComponent.WIDGET_CONFIG.type:
                    return <ImageViewSettingsPanelComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
                case StokesAnalysisComponent.WIDGET_CONFIG.type:
                    return <StokesAnalysisSettingsPanelComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
                case SpectralProfilerComponent.WIDGET_CONFIG.type:
                    return <SpectralProfilerSettingsPanelComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
                case SpatialProfilerComponent.WIDGET_CONFIG.type:
                    return <SpatialProfilerSettingsPanelComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
                case RenderConfigComponent.WIDGET_CONFIG.type:
                    return <RenderConfigSettingsPanelComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
                case HistogramComponent.WIDGET_CONFIG.type:
                    return <HistogramSettingsPanelComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
                case CatalogOverlayComponent.WIDGET_CONFIG.type:
                    return <CatalogOverlayPlotSettingsPanelComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
                case LayerListComponent.WIDGET_CONFIG.type:
                    return <LayerListSettingsPanelComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
                default:
                    return null;
            }
        }
        return null;
    }

    private showPin(widgetConfig: WidgetConfig) {
        if (widgetConfig.type && widgetConfig.type === this.floatingSettingType) {
            return false;
        }
        return true;
    }

    private showFloatingSettingsButton(widgetConfig: WidgetConfig) {
        switch (widgetConfig.type) {
            case StokesAnalysisComponent.WIDGET_CONFIG.type:
                return true;
            case SpectralProfilerComponent.WIDGET_CONFIG.type:
                return true;
            case SpatialProfilerComponent.WIDGET_CONFIG.type:
                return true;
            case RenderConfigComponent.WIDGET_CONFIG.type:
                return true;
            case HistogramComponent.WIDGET_CONFIG.type:
                return true;
            case CatalogOverlayComponent.WIDGET_CONFIG.type:
                return true;
            case LayerListComponent.WIDGET_CONFIG.type:
                return true;
            default:
                return false;
        }
    }

    public render() {
        const widgetConfigs = WidgetsStore.Instance.floatingWidgets;
        const appStore = AppStore.Instance;
        return (
            <div>
                {widgetConfigs.map(w => {
                    const showPinButton = this.showPin(w);
                    const id = w.componentId ? w.componentId : w.id;

                    const selectedFloatingObj = appStore.floatingObjs.find(w => w.id === id);
                    let zIndex = selectedFloatingObj ? selectedFloatingObj.zIndex : 0;

                    return (
                        <div key={id}>
                            <FloatingWidgetComponent
                                isSelected={zIndex === appStore.floatingObjs.length}
                                key={id}
                                widgetConfig={w}
                                zIndex={zIndex}
                                showPinButton={showPinButton}
                                onSelected={() => this.onFloatingWidgetSelected(w)}
                                onClosed={() => this.onFloatingWidgetClosed(w)}
                                showFloatingSettingsButton={this.showFloatingSettingsButton(w)}
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
