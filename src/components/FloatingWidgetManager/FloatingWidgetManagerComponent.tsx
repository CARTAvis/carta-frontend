import * as React from "react";
import {observer} from "mobx-react";
import {AnimatorComponent, FloatingWidgetComponent, ImageViewComponent, LogComponent, PlaceholderComponent, RenderConfigComponent, SpatialProfilerComponent, SpectralProfilerComponent} from "components";
import {AppStore, WidgetConfig} from "stores";

@observer
export class FloatingWidgetManagerComponent extends React.Component<{ appStore: AppStore }> {

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
            default:
                return <PlaceholderComponent appStore={appStore} id={widgetConfig.id} docked={false} label={widgetConfig.title}/>;
        }
    }

    public render() {
        const appStore = this.props.appStore;
        const widgetConfigs = appStore.widgetsStore.floatingWidgets;

        return (
            <div>
                {widgetConfigs.map((w, index) => {
                    return (
                        <FloatingWidgetComponent
                            isSelected={index === widgetConfigs.length - 1}
                            appStore={appStore}
                            key={w.id}
                            widgetConfig={w}
                            zIndex={index}
                            showPinButton={true}
                            onSelected={() => this.onFloatingWidgetSelected(w)}
                            onClosed={() => this.onFloatingWidgetClosed(w)}
                        >
                            {this.getWidgetContent(w)}
                        </FloatingWidgetComponent>
                    );
                })}
            </div>);
    }
}