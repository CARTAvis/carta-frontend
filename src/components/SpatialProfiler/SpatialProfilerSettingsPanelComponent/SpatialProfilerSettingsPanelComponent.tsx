import * as React from "react";
import {observer} from "mobx-react";
import {Button, ControlGroup, FormGroup, HTMLSelect, Switch} from "@blueprintjs/core";
import {PlotTypeSelectorComponent} from "components/Shared";
import {SpatialProfileWidgetStore} from "stores/widgets";
import "./SpatialProfilerSettingsPanelComponent.css";

@observer
export class SpatialProfilerSettingsPanelComponent extends React.Component<{ widgetStore: SpatialProfileWidgetStore }> {

    handleWcsAxisChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setWcsAxisVisible(changeEvent.target.checked);
    };

    handleMeanRmsChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setMeanRmsVisible(changeEvent.target.checked);
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
                        <Switch label={"Show WCS Axis"} checked={widgetStore.wcsAxisVisible} onChange={this.handleWcsAxisChanged}/>
                        <Switch label={"Show Mean/RMS"} checked={widgetStore.meanRmsVisible} onChange={this.handleMeanRmsChanged}/>
                        <PlotTypeSelectorComponent value={widgetStore.plotType} onValueChanged={widgetStore.setPlotType}/>
                        <Button icon={"zoom-to-fit"} small={true} disabled={widgetStore.isAutoScaledX && widgetStore.isAutoScaledY} onClick={widgetStore.clearXYBounds}>Reset Range</Button>
                    </ControlGroup>
                </FormGroup>
            </React.Fragment>
        );
    }
}