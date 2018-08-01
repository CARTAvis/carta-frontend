import * as React from "react";
import {AppStore} from "../../stores/AppStore";
import {WidgetConfig} from "../../stores/FloatingWidgetStore";
import {FloatingWidgetComponent} from "../FloatingWidget/FloatingWidgetComponent";
import {RenderConfigComponent} from "../RenderConfig/RenderConfigComponent";
import {LogComponent} from "../Log/LogComponent";
import {observer} from "mobx-react";
import {PlaceholderComponent} from "../Placeholder/PlaceholderComponent";
import {ImageViewComponent} from "../ImageView/ImageViewComponent";
import {SpatialProfilerComponent} from "../SpatialProfiler/SpatialProfilerComponent";

@observer
export class FloatingWidgetManagerComponent extends React.Component<{ appStore: AppStore }> {

    onFloatingWidgetSelected = (widget: WidgetConfig) => {
        this.props.appStore.floatingWidgetStore.selectWidget(widget.id);
    };

    onFloatingWidgetClosed = (widget: WidgetConfig) => {
        this.props.appStore.floatingWidgetStore.removeWidget(widget.id);
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
            case SpatialProfilerComponent.WIDGET_CONFIG.type:
                return <SpatialProfilerComponent appStore={appStore} id={widgetConfig.id} docked={false}/>;
            default:
                return <PlaceholderComponent appStore={appStore} id={widgetConfig.id} docked={false} label={widgetConfig.title}/>;
        }
    }

    public render() {
        const appStore = this.props.appStore;
        const widgetConfigs = appStore.floatingWidgetStore.widgets;

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