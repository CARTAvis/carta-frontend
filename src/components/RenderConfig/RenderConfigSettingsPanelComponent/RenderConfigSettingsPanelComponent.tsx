import * as React from "react";
import {observer} from "mobx-react";
import {Alignment, Button, Checkbox, ControlGroup, FormGroup, Switch} from "@blueprintjs/core";
import {RenderConfigWidgetStore} from "../../../stores/widgets/RenderConfigWidgetStore";
import "./RenderConfigSettingsPanelComponent.css";

@observer
export class RenderConfigSettingsPanelComponent extends React.Component<{ widgetStore: RenderConfigWidgetStore }> {

    handleLogScaleChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setLogScale(changeEvent.target.checked);
    };

    handlePointsChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setUsePoints(changeEvent.target.checked);
    };

    handleMarkerTextChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setMarkerTextVisible(changeEvent.target.checked);
    };

    render() {
        return (
            <React.Fragment>
                <FormGroup className={"render-config-settings-panel-form"}>
                    <ControlGroup fill={true} vertical={true}>
                        <Switch label={"Log Scale"} checked={this.props.widgetStore.logScaleY} onChange={this.handleLogScaleChanged}/>
                        <Switch label={"Show Labels"} checked={this.props.widgetStore.markerTextVisible} onChange={this.handleMarkerTextChanged}/>
                        <Switch label={this.props.widgetStore.usePoints ? "Points" : "Lines"} checked={this.props.widgetStore.usePoints} onChange={this.handlePointsChanged}/>
                        <Button icon={"zoom-to-fit"}small={true} disabled={this.props.widgetStore.isAutoScaled} onClick={this.props.widgetStore.clearXBounds}>Reset Range</Button>
                    </ControlGroup>
                </FormGroup>
            </React.Fragment>
        );
    }
}