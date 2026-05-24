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
import {AppStore, CatalogStore, type WidgetConfig, WidgetsStore} from "stores";

@observer
export class FloatingWidgetManagerComponent extends React.Component {
    private floatingSettingType = "floating-settings";

    onFloatingWidgetSelected = (widget: WidgetConfig) => {
        // rearrange will cause a bug of empty table, change to zIndex
        const zIndexManager = AppStore.Instance.zIndexManager;
        const id = widget.componentId ? widget.componentId : widget.id;
        zIndexManager.updateIndexOnSelect(id);
    };

    onFloatingWidgetClosed = (widget: WidgetConfig) => {
        const widgetsStore = WidgetsStore.Instance;
        switch (widget.type) {
            case CatalogOverlayComponent.WidgetConfig.type:
                // remove widget component only
                if (widget.componentId !== undefined) {
                    widgetsStore.removeFloatingWidgetComponent(widget.componentId);
                    CatalogStore.Instance.catalogProfiles.delete(widget.componentId);
                }
                break;
            case CatalogPlotComponent.WidgetConfig.type:
                if (widget.componentId !== undefined) {
                    widgetsStore.removeFloatingWidgetComponent(widget.componentId);
                    CatalogStore.Instance.clearCatalogPlotsByComponentId(widget.componentId);
                }
                break;
            case LayerListSettingsPanelComponent.WidgetConfig.type:
                if (widget.parentId !== undefined) {
                    widgetsStore.layerListWidgets.get(widget.parentId)?.resetSelectedFrameIndex();
                }
                widgetsStore.removeFloatingWidget(widget.id);
                break;
            case PvPreviewComponent.WidgetConfig.type:
                if (widget.parentId !== undefined) {
                    widgetsStore.pvGeneratorWidgets.get(widget.parentId)?.removePreviewFrame(parseInt(widget.parentId.split("-")[2]));
                }
                widgetsStore.removeFloatingWidget(widget.id);
                break;
            case PvGeneratorComponent.WidgetConfig.type:
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
            case ImageViewComponent.WidgetConfig.type:
                return <ImageViewComponent id={widgetConfig.id} docked={false} />;
            case LayerListComponent.WidgetConfig.type:
                return <LayerListComponent id={widgetConfig.id} docked={false} />;
            case LogComponent.WidgetConfig.type:
                return <LogComponent id={widgetConfig.id} docked={false} />;
            case RenderConfigComponent.WidgetConfig.type:
                return <RenderConfigComponent id={widgetConfig.id} docked={false} />;
            case AnimatorComponent.WidgetConfig.type:
                return <AnimatorComponent id={widgetConfig.id} docked={false} />;
            case ChannelMapControlComponent.WidgetConfig.type:
                return <ChannelMapControlComponent id={widgetConfig.id} docked={false} />;
            case SpatialProfilerComponent.WidgetConfig.type:
                return <SpatialProfilerComponent id={widgetConfig.id} docked={false} />;
            case SpectralProfilerComponent.WidgetConfig.type:
                return <SpectralProfilerComponent id={widgetConfig.id} docked={false} />;
            case SpectralLineQueryComponent.WidgetConfig.type:
                return <SpectralLineQueryComponent id={widgetConfig.id} docked={false} />;
            case StatsComponent.WidgetConfig.type:
                return <StatsComponent id={widgetConfig.id} docked={false} />;
            case HistogramComponent.WidgetConfig.type:
                return <HistogramComponent id={widgetConfig.id} docked={false} />;
            case RegionListComponent.WidgetConfig.type:
                return <RegionListComponent id={widgetConfig.id} docked={false} />;
            case StokesAnalysisComponent.WidgetConfig.type:
                return <StokesAnalysisComponent id={widgetConfig.id} docked={false} />;
            case CursorInfoComponent.WidgetConfig.type:
                return <CursorInfoComponent id={widgetConfig.id} docked={false} />;
            case CatalogOverlayComponent.WidgetConfig.type:
                return <CatalogOverlayComponent id={widgetConfig.componentId ?? ""} docked={false} />;
            case CatalogPlotComponent.WidgetConfig.type:
                return <CatalogPlotComponent id={widgetConfig.id} docked={false} />;
            case PvGeneratorComponent.WidgetConfig.type:
                return <PvGeneratorComponent id={widgetConfig.id} docked={false} />;
            case PvPreviewComponent.WidgetConfig.type:
                return <PvPreviewComponent id={widgetConfig.parentId ?? ""} docked={false} floatingSettingsId={widgetConfig.id} />;
            default:
                return <PlaceholderComponent id={widgetConfig.id} docked={false} label={widgetConfig.title ?? ""} />;
        }
    }

    private getWidgetSettings(widgetConfig: WidgetConfig) {
        if (widgetConfig.parentId) {
            switch (widgetConfig.parentType) {
                case ImageViewComponent.WidgetConfig.type:
                    return <ImageViewSettingsPanelComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
                case StokesAnalysisComponent.WidgetConfig.type:
                    return <StokesAnalysisSettingsPanelComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
                case SpectralProfilerComponent.WidgetConfig.type:
                    return <SpectralProfilerSettingsPanelComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
                case SpatialProfilerComponent.WidgetConfig.type:
                    return <SpatialProfilerSettingsPanelComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
                case RenderConfigComponent.WidgetConfig.type:
                    return <RenderConfigSettingsPanelComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
                case HistogramComponent.WidgetConfig.type:
                    return <HistogramSettingsPanelComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
                case CatalogOverlayComponent.WidgetConfig.type:
                    return <CatalogOverlayPlotSettingsPanelComponent id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id} />;
                case LayerListComponent.WidgetConfig.type:
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
            case StokesAnalysisComponent.WidgetConfig.type:
                return true;
            case SpectralProfilerComponent.WidgetConfig.type:
                return true;
            case SpatialProfilerComponent.WidgetConfig.type:
                return true;
            case RenderConfigComponent.WidgetConfig.type:
                return true;
            case HistogramComponent.WidgetConfig.type:
                return true;
            case CatalogOverlayComponent.WidgetConfig.type:
                return true;
            case LayerListComponent.WidgetConfig.type:
                return true;
            default:
                return false;
        }
    }

    public render() {
        const widgetConfigs = WidgetsStore.Instance.floatingWidgets;
        const zIndexManager = AppStore.Instance.zIndexManager;

        return (
            <div>
                {widgetConfigs.map(w => {
                    let showSettingsButton = this.showFloatingSettingsButton(w);
                    if (w.type === RenderConfigComponent.WidgetConfig.type) {
                        showSettingsButton = AppStore.Instance.activeImage?.type !== ImageType.COLOR_BLENDING;
                    }

                    const showPinButton = this.showPin(w);
                    const id = w.componentId ? w.componentId : w.id;

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
