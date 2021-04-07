import * as React from "react";
import {observer} from "mobx-react";
import {computed} from "mobx";
import {FormGroup, Switch} from "@blueprintjs/core";
import {LinePlotSettingsPanelComponentProps, LinePlotSettingsPanelComponent} from "components/Shared";
import {RenderConfigWidgetStore} from "stores/widgets/RenderConfigWidgetStore";
import {WidgetProps, DefaultWidgetConfig, HelpType, WidgetsStore} from "stores";
import {parseNumber} from "utilities";
import "./RenderConfigSettingsPanelComponent.scss"

const KEYCODE_ENTER = 13;

@observer
export class RenderConfigSettingsPanelComponent extends React.Component<WidgetProps> {

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
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
            parentType: "render-config",
            helpType: HelpType.RENDER_CONFIG_SETTINGS
        };
    }

    @computed get widgetStore(): RenderConfigWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.renderConfigWidgets) {
            const widgetStore = widgetsStore.renderConfigWidgets.get(this.props.id);
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

    handleMeanRmsChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setMeanRmsVisible(changeEvent.target.checked);
    };

    handleXMinChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore; 
        const minX = parseNumber(widgetStore.minX, widgetStore.linePlotInitXYBoundaries.minXVal);
        const maxX = parseNumber(widgetStore.maxX, widgetStore.linePlotInitXYBoundaries.maxXVal);
        if (isFinite(val) && val !== minX && val < maxX) {
            widgetStore.setXBounds(val, maxX);
        } else {
            ev.currentTarget.value = minX.toString();
        }
    };

    handleXMaxChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minX = parseNumber(widgetStore.minX, widgetStore.linePlotInitXYBoundaries.minXVal);
        const maxX = parseNumber(widgetStore.maxX, widgetStore.linePlotInitXYBoundaries.maxXVal);
        if (isFinite(val) && val !== maxX && val > minX) {
            widgetStore.setXBounds(minX, val);
        } else {
            ev.currentTarget.value = maxX.toString();
        }
    };

    handleYMinChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minY = parseNumber(widgetStore.minY, widgetStore.linePlotInitXYBoundaries.minYVal);
        const maxY = parseNumber(widgetStore.maxY, widgetStore.linePlotInitXYBoundaries.maxYVal);
        if (isFinite(val) && val !== minY && val < maxY) {
            widgetStore.setYBounds(val, maxY);
        } else {
            ev.currentTarget.value = minY.toString();
        }
    };

    handleYMaxChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minY = parseNumber(widgetStore.minY, widgetStore.linePlotInitXYBoundaries.minYVal);
        const maxY = parseNumber(widgetStore.maxY, widgetStore.linePlotInitXYBoundaries.maxYVal);
        if (isFinite(val) && val !== maxY && val > minY) {
            widgetStore.setYBounds(minY, val);
        } else {
            ev.currentTarget.value = maxY.toString();
        }
    };

    render() {
        const widgetStore = this.widgetStore;
        const lineSettingsProps: LinePlotSettingsPanelComponentProps = {
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
            handleMarkerTextChanged: this.handleMarkerTextChanged,
            meanRmsVisible: widgetStore.meanRmsVisible,
            handleMeanRmsChanged: this.handleMeanRmsChanged,
            xMinVal: parseNumber(widgetStore.minX, widgetStore.linePlotInitXYBoundaries.minXVal),
            handleXMinChange: this.handleXMinChange,
            xMaxVal: parseNumber(widgetStore.maxX, widgetStore.linePlotInitXYBoundaries.maxXVal),
            handleXMaxChange: this.handleXMaxChange,
            yMinVal: parseNumber(widgetStore.minY, widgetStore.linePlotInitXYBoundaries.minYVal),
            handleYMinChange: this.handleYMinChange,
            yMaxVal: parseNumber(widgetStore.maxY, widgetStore.linePlotInitXYBoundaries.maxYVal),
            handleYMaxChange: this.handleYMaxChange
        };

        return (
            <React.Fragment>
                <div className="line-settings-panel colormap-scaling-setting">
                    <FormGroup inline={true} label="Show Color Scaling">
                        <Switch
                            checked={widgetStore.showColormapScaling}
                            onChange={(ev) => widgetStore.setShowColormapScaling(ev.currentTarget.checked)}
                        />
                    </FormGroup>
                </div>
                <LinePlotSettingsPanelComponent {...lineSettingsProps}/>
            </React.Fragment>
        );
    }
}