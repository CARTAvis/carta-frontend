import * as React from "react";
import {observer} from "mobx-react";
import {Button, ControlGroup, FormGroup, Switch} from "@blueprintjs/core";
import {PlotTypeSelectorComponent} from "components/Shared";
import {HistogramWidgetStore} from "stores/widgets";
import "./HistogramSettingsPanelComponent.css";

@observer
export class HistogramSettingsPanelComponent extends React.Component<{ widgetStore: HistogramWidgetStore }> {

    private handleLogScaleChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setLogScale(changeEvent.target.checked);
    };

    render() {
        const widgetStore = this.props.widgetStore;

        return (
            <React.Fragment>
                <FormGroup className={"histogram-settings-panel-form"}>
                    <ControlGroup fill={true} vertical={true}>
                        <Switch label={"Log Scale"} checked={widgetStore.logScaleY} onChange={this.handleLogScaleChanged}/>
                        <PlotTypeSelectorComponent value={widgetStore.plotType} onValueChanged={widgetStore.setPlotType}/>
                        <Button icon={"zoom-to-fit"} small={true} disabled={widgetStore.isAutoScaledX && widgetStore.isAutoScaledY} onClick={widgetStore.clearXYBounds}>Reset Range</Button>
                    </ControlGroup>
                </FormGroup>
            </React.Fragment>
        );
    }
}