import * as React from "react";
import {AppStore} from "../../stores/AppStore";
import {WidgetConfig} from "../../stores/FloatingWidgetStore";
import {FloatingWidgetComponent} from "../FloatingWidget/FloatingWidgetComponent";
import {RenderConfigComponent} from "../RenderConfig/RenderConfigComponent";
import {LogComponent} from "../Log/LogComponent";
import {observer} from "mobx-react";

@observer
export class FloatingWidgetManagerComponent extends React.Component<{ appStore: AppStore }> {

    onFloatingWidgetSelected = (widget: WidgetConfig) => {
        this.props.appStore.floatingWidgetStore.selectWidget(widget.id);
    };

    onFloatingWidgetClosed = (widget: WidgetConfig) => {
        this.props.appStore.floatingWidgetStore.removeWidget(widget.id);
    };

    public render() {
        const appStore = this.props.appStore;
        const widgetConfigs = appStore.floatingWidgetStore.widgets;

        return widgetConfigs.map((w, index) => {
            let widgetContent: JSX.Element;
            let title: string;
            if (w.type === "log") {
                widgetContent = <LogComponent appStore={appStore} id={w.id} docked={false}/>;
                title = "Log";
            }
            else if (w.type === "render-config") {
                widgetContent = <RenderConfigComponent appStore={appStore} id={w.id} docked={false}/>;
                title = "Render Configuration";
            }
            return (
                <FloatingWidgetComponent
                    isSelected={index === widgetConfigs.length - 1}
                    title={title}
                    layout={appStore.layoutSettings.layout}
                    appStore={appStore}
                    type={w.type}
                    id={w.id}
                    minWidth={w.minWidth}
                    key={w.id}
                    minHeight={w.minHeight}
                    zIndex={index}
                    onSelected={() => this.onFloatingWidgetSelected(w)}
                    onClosed={() => this.onFloatingWidgetClosed(w)}
                >
                    {widgetContent}
                </FloatingWidgetComponent>
            );
        });

    }
}