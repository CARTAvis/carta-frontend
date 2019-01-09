import * as React from "react";
import {observer} from "mobx-react";
import {Button, ControlGroup, FormGroup, Switch} from "@blueprintjs/core";
import {RenderConfigWidgetStore} from "stores/widgets/RenderConfigWidgetStore";
import "./RenderConfigSettingsPanelComponent.css";
import {PlotTypeSelectorComponent} from "components/Shared/PlotTypeSelector/PlotTypeSelectorComponent";

@observer
export class RenderConfigSettingsPanelComponent extends React.Component<{ widgetStore: RenderConfigWidgetStore }> {

    handleLogScaleChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setLogScale(changeEvent.target.checked);
    };

    handleMarkerTextChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setMarkerTextVisible(changeEvent.target.checked);
    };

    render() {
        const widgetStore = this.props.widgetStore;
        return (
            <React.Fragment>
                <FormGroup className={"render-config-settings-panel-form"}>
                    <ControlGroup fill={true} vertical={true}>
                        <Switch label={"Log Scale"} checked={widgetStore.logScaleY} onChange={this.handleLogScaleChanged}/>
                        <Switch label={"Show Labels"} checked={widgetStore.markerTextVisible} onChange={this.handleMarkerTextChanged}/>
                        <PlotTypeSelectorComponent value={widgetStore.plotType} onValueChanged={widgetStore.setPlotType}/>
                        <Button icon={"zoom-to-fit"} small={true} disabled={widgetStore.isAutoScaledX && widgetStore.isAutoScaledY} onClick={widgetStore.clearXYBounds}>Reset Range</Button>
                    </ControlGroup>
                </FormGroup>
            </React.Fragment>
        );
    }
}