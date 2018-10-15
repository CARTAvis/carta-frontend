import * as React from "react";
import {observer} from "mobx-react";
import {Alignment, Button, Checkbox, ControlGroup, FormGroup, Switch} from "@blueprintjs/core";
import {SpatialProfileWidgetStore} from "../../../stores/widgets/SpatialProfileWidgetStore";
import "./SpatialProfilerSettingsPanelComponent.css";

@observer
export class SpatialProfilerSettingsPanelComponent extends React.Component<{ widgetStore: SpatialProfileWidgetStore }> {

    handleMeanRmsChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setMeanRmsVisible(changeEvent.target.checked);
    };

    handlePointsChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setUsePoints(changeEvent.target.checked);
    };

    handleSteppedLinesChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setInterpolateLines(changeEvent.target.checked);
    };

    render() {
        return (
            <React.Fragment>
                <FormGroup className={"spatial-profile-settings-panel-form"}>
                    <ControlGroup fill={true} vertical={true}>
                        <Switch label={"Show Mean/RMS"} checked={this.props.widgetStore.meanRmsVisible} onChange={this.handleMeanRmsChanged}/>
                        <Switch label={"Draw as Points"} checked={this.props.widgetStore.usePoints} onChange={this.handlePointsChanged}/>
                        <Switch label={"Interpolated"} disabled={this.props.widgetStore.usePoints} checked={this.props.widgetStore.interpolateLines} onChange={this.handleSteppedLinesChanged}/>
                        <Button icon={"zoom-to-fit"} small={true} disabled={this.props.widgetStore.isAutoScaledX && this.props.widgetStore.isAutoScaledY} onClick={this.props.widgetStore.clearXYBounds}>Reset Range</Button>
                    </ControlGroup>
                </FormGroup>
            </React.Fragment>
        );
    }
}