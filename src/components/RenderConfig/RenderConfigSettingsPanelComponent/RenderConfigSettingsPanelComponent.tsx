import * as React from "react";
import {observer} from "mobx-react";
import {computed} from "mobx";
import {Colors} from "@blueprintjs/core";
import {LinePlotSettingsPanelComponentProps, LinePlotSettingsPanelComponent} from "components/Shared";
import {RenderConfigWidgetStore} from "stores/widgets/RenderConfigWidgetStore";
import {WidgetProps, WidgetConfig} from "stores";

@observer
export class RenderConfigSettingsPanelComponent extends React.Component<WidgetProps> {

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "render-config-floating-settings",
            type: "floating-settings",
            minWidth: 280,
            minHeight: 225,
            defaultWidth: 300,
            defaultHeight: 375,
            title: "render-config-settings",
            isCloseable: true,
            parentId: "render-config",
            parentType: "render-config"
        };
    }

    @computed get widgetStore(): RenderConfigWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.renderConfigWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.renderConfigWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return null;
    }

    handleLogScaleChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setLogScale(changeEvent.target.checked);
    };

    handleMarkerTextChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setMarkerTextVisible(changeEvent.target.checked);
    };

    render() {
        const widgetStore = this.widgetStore;
        const lineSettingsProps: LinePlotSettingsPanelComponentProps = {
            darkMode: this.props.appStore.darkTheme,
            primaryDarkModeLineColor: Colors.BLUE4,
            primaryLineColor: widgetStore.primaryLineColor,
            lineWidth: widgetStore.lineWidth,
            plotType: widgetStore.plotType,
            linePlotPointSize: widgetStore.linePlotPointSize,
            setPrimaryLineColor: widgetStore.setPrimaryLineColor,
            setLineWidth: widgetStore.setLineWidth,
            setLinePlotPointSize: widgetStore.setLinePlotPointSize,
            setPlotType: widgetStore.setPlotType,
            isAutoScaledX: widgetStore.isAutoScaledX,
            isAutoScaledY: widgetStore.isAutoScaledY,
            clearXYBounds: widgetStore.clearXYBounds,
            logScaleY: widgetStore.logScaleY,
            handleLogScaleChanged: this.handleLogScaleChanged,
            markerTextVisible: widgetStore.markerTextVisible,
            handleMarkerTextChanged: this.handleMarkerTextChanged
        };
        return (
            <LinePlotSettingsPanelComponent {...lineSettingsProps}/>
        );
    }
}