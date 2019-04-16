import * as React from "react";
import {observer} from "mobx-react";
import {Button, ControlGroup, FormGroup, Switch} from "@blueprintjs/core";
import {PlotTypeSelectorComponent} from "components/Shared";
import {SpectralProfileWidgetStore} from "stores/widgets";
import "./SpectralProfilerSettingsPanelComponent.css";

@observer
export class SpectralProfilerSettingsPanelComponent extends React.Component<{widgetStore: SpectralProfileWidgetStore }> {

    handleMeanRmsChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setMeanRmsVisible(changeEvent.target.checked);
    };

    handleWcsValuesChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setUseWcsValues(changeEvent.target.checked);
    };

    render() {
        const widgetStore = this.props.widgetStore;

        return (
            <React.Fragment>
                <FormGroup className={"spectral-profile-settings-panel-form"}>
                    <ControlGroup fill={true} vertical={true}>
                        <Switch label={"Use WCS Values"} checked={widgetStore.useWcsValues} onChange={this.handleWcsValuesChanged}/>
                        <Switch label={"Show Mean/RMS"} checked={widgetStore.meanRmsVisible} onChange={this.handleMeanRmsChanged}/>
                        <PlotTypeSelectorComponent value={widgetStore.plotType} onValueChanged={widgetStore.setPlotType}/>
                        <Button icon={"zoom-to-fit"} small={true} disabled={widgetStore.isAutoScaledX && widgetStore.isAutoScaledY} onClick={widgetStore.clearXYBounds}>Reset Range</Button>
                    </ControlGroup>
                </FormGroup>
            </React.Fragment>
        );
    }
}