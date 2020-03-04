import * as React from "react";
import {observer} from "mobx-react";
import {
    AnimatorComponent,
    FloatingWidgetComponent,
    HistogramComponent,
    ImageViewComponent,
    LayerListComponent,
    LogComponent,
    PlaceholderComponent,
    RegionListComponent,
    RenderConfigComponent,
    SpatialProfilerComponent,
    SpectralProfilerComponent,
    StatsComponent,
    StokesAnalysisComponent,
    CatalogOverlayComponent,
    CatalogScatterComponent,
    StokesAnalysisSettingsPanelComponent,
    SpectralProfilerSettingsPanelComponent,
    SpatialProfilerSettingsPanelComponent,
    RenderConfigSettingsPanelComponent,
    HistogramSettingsPanelComponent
} from "components";
import {AppStore, WidgetConfig} from "stores";

@observer
export class FloatingWidgetManagerComponent extends React.Component<{ appStore: AppStore }> {
    private floatingSettingType = "floating-settings";

    onFloatingWidgetSelected = (widget: WidgetConfig) => {
        this.props.appStore.widgetsStore.selectFloatingWidget(widget.id);
    };

    onFloatingWidgetClosed = (widget: WidgetConfig) => {
        this.props.appStore.widgetsStore.removeFloatingWidget(widget.id);
    };

    private getWidgetContent(widgetConfig: WidgetConfig) {
        const appStore = this.props.appStore;

        switch (widgetConfig.type) {
            case ImageViewComponent.WIDGET_CONFIG.type:
                return <ImageViewComponent appStore={appStore} id={widgetConfig.id} docked={false}/>;
            case LayerListComponent.WIDGET_CONFIG.type:
                return <LayerListComponent appStore={appStore} id={widgetConfig.id} docked={false}/>;
            case LogComponent.WIDGET_CONFIG.type:
                return <LogComponent appStore={appStore} id={widgetConfig.id} docked={false}/>;
            case RenderConfigComponent.WIDGET_CONFIG.type:
                return <RenderConfigComponent appStore={appStore} id={widgetConfig.id} docked={false}/>;
            case AnimatorComponent.WIDGET_CONFIG.type:
                return <AnimatorComponent appStore={appStore} id={widgetConfig.id} docked={false}/>;
            case SpatialProfilerComponent.WIDGET_CONFIG.type:
                return <SpatialProfilerComponent appStore={appStore} id={widgetConfig.id} docked={false}/>;
            case SpectralProfilerComponent.WIDGET_CONFIG.type:
                return <SpectralProfilerComponent appStore={appStore} id={widgetConfig.id} docked={false}/>;
            case StatsComponent.WIDGET_CONFIG.type:
                return <StatsComponent appStore={appStore} id={widgetConfig.id} docked={false}/>;
            case HistogramComponent.WIDGET_CONFIG.type:
                return <HistogramComponent appStore={appStore} id={widgetConfig.id} docked={false}/>;
            case RegionListComponent.WIDGET_CONFIG.type:
                return <RegionListComponent appStore={appStore} id={widgetConfig.id} docked={false}/>;
            case StokesAnalysisComponent.WIDGET_CONFIG.type:
                return <StokesAnalysisComponent appStore={appStore} id={widgetConfig.id} docked={false}/>;
            case CatalogOverlayComponent.WIDGET_CONFIG.type:
                return <CatalogOverlayComponent appStore={appStore} id={widgetConfig.id} docked={false}/>;
            case CatalogScatterComponent.WIDGET_CONFIG.type:
                return <CatalogScatterComponent appStore={appStore} id={widgetConfig.id} docked={false}/>;
            default:
                return <PlaceholderComponent appStore={appStore} id={widgetConfig.id} docked={false} label={widgetConfig.title}/>;
        }
    }

    private getWidgetSettings(widgetConfig: WidgetConfig) {
        if (widgetConfig.parentId) {
            const appStore = this.props.appStore;
            switch (widgetConfig.parentType) {
                case StokesAnalysisComponent.WIDGET_CONFIG.type:
                    return <StokesAnalysisSettingsPanelComponent appStore={appStore} id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id}/>;
                case SpectralProfilerComponent.WIDGET_CONFIG.type:
                    return <SpectralProfilerSettingsPanelComponent appStore={appStore} id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id}/>;
                case SpatialProfilerComponent.WIDGET_CONFIG.type:
                    return <SpatialProfilerSettingsPanelComponent appStore={appStore} id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id}/>;
                case RenderConfigComponent.WIDGET_CONFIG.type:
                    return <RenderConfigSettingsPanelComponent appStore={appStore} id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id}/>;
                case HistogramComponent.WIDGET_CONFIG.type:
                    return <HistogramSettingsPanelComponent appStore={appStore} id={widgetConfig.parentId} docked={false} floatingSettingsId={widgetConfig.id}/>;
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
            default:
                return false;
        }
    }

    public render() {
        const appStore = this.props.appStore;
        const widgetConfigs = appStore.widgetsStore.floatingWidgets;

        return (
            <div>
                {widgetConfigs.map((w, index) => {
                    const showPinButton = this.showPin(w); 
                    return (
                        <div key={w.id}>
                            <FloatingWidgetComponent
                                isSelected={index === widgetConfigs.length - 1}
                                appStore={appStore}
                                key={w.id}
                                widgetConfig={w}
                                zIndex={index}
                                showPinButton={showPinButton}
                                onSelected={() => this.onFloatingWidgetSelected(w)}
                                onClosed={() => this.onFloatingWidgetClosed(w)}
                                showFloatingSettingsButton={this.showFloatingSettingsButton(w)}
                            >
                                {showPinButton ?
                                    this.getWidgetContent(w)
                                :
                                    this.getWidgetSettings(w)
                                }
                            </FloatingWidgetComponent>
                    </div>
                    );
                })}
            </div>);
    }
}