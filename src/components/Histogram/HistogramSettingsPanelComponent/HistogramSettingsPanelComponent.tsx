import * as React from "react";
import {observer} from "mobx-react";
import {Button, ControlGroup, FormGroup, HTMLSelect, IOptionProps, Switch} from "@blueprintjs/core";
import {PlotTypeSelectorComponent} from "components/Shared";
import {AppStore} from "stores";
import {HistogramWidgetStore} from "stores/widgets";
import "./HistogramSettingsPanelComponent.css";

@observer
export class HistogramSettingsPanelComponent extends React.Component<{ appStore: AppStore, widgetStore: HistogramWidgetStore }> {

    private handleLogScaleChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.props.widgetStore.setLogScale(changeEvent.target.checked);
    };

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
            this.props.widgetStore.setRegionId(appStore.activeFrame.frameInfo.fileId, parseInt(changeEvent.target.value));
        }
    };

    render() {
        const widgetStore = this.props.widgetStore;
        const appStore = this.props.appStore;

        let regionId = -1;

        // Fill region select options with all non-temporary regions that are closed
        let profileRegionOptions: IOptionProps[] = [{value: -1, label: "Image"}];
        if (appStore.activeFrame && appStore.activeFrame.regionSet) {
            let fileId = appStore.activeFrame.frameInfo.fileId;
            regionId = widgetStore.regionIdMap.get(fileId) || -1;
            profileRegionOptions = profileRegionOptions.concat(this.props.appStore.activeFrame.regionSet.regions.filter(r => !r.isTemporary && r.isClosedRegion).map(r => {
                return {
                    value: r.regionId,
                    label: r.nameString
                };
            }));
        }

        return (
            <React.Fragment>
                <FormGroup className={"histogram-settings-panel-form"}>
                    <ControlGroup fill={true} vertical={true}>
                        <FormGroup label={"Region"} inline={true}>
                            <HTMLSelect value={regionId} options={profileRegionOptions} onChange={this.handleRegionChanged}/>
                        </FormGroup>
                        <Switch label={"Log Scale"} checked={widgetStore.logScaleY} onChange={this.handleLogScaleChanged}/>
                        <PlotTypeSelectorComponent value={widgetStore.plotType} onValueChanged={widgetStore.setPlotType}/>
                        <Button icon={"zoom-to-fit"} small={true} disabled={widgetStore.isAutoScaledX && widgetStore.isAutoScaledY} onClick={widgetStore.clearXYBounds}>Reset Range</Button>
                    </ControlGroup>
                </FormGroup>
            </React.Fragment>
        );
    }
}