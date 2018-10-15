import * as React from "react";
import {observer} from "mobx-react";
import {Button, ControlGroup, FormGroup, HTMLSelect, Switch} from "@blueprintjs/core";
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

    handleCoordinateChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.widgetStore.setCoordinate(changeEvent.target.value);
    };

    render() {
        const widgetStore = this.props.widgetStore;
        const profileCoordinateOptions = [{
            value: "x", label: "X"
        }, {
            value: "y", label: "Y"
        }];

        return (
            <React.Fragment>
                <FormGroup className={"spatial-profile-settings-panel-form"}>
                    <ControlGroup fill={true} vertical={true}>
                        <FormGroup label={"Coordinate"} inline={true}>
                            <HTMLSelect value={widgetStore.coordinate} options={profileCoordinateOptions} onChange={this.handleCoordinateChanged}/>
                        </FormGroup>
                        <Switch label={"Show Mean/RMS"} checked={widgetStore.meanRmsVisible} onChange={this.handleMeanRmsChanged}/>
                        <Switch label={"Draw as Points"} checked={widgetStore.usePoints} onChange={this.handlePointsChanged}/>
                        <Switch label={"Interpolated"} disabled={widgetStore.usePoints} checked={this.props.widgetStore.interpolateLines} onChange={this.handleSteppedLinesChanged}/>
                        <Button icon={"zoom-to-fit"} small={true} disabled={widgetStore.isAutoScaledX && widgetStore.isAutoScaledY} onClick={widgetStore.clearXYBounds}>Reset Range</Button>
                    </ControlGroup>
                </FormGroup>
            </React.Fragment>
        );
    }
}