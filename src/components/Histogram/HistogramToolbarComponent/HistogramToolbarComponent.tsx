import {observer} from "mobx-react";
import * as React from "react";
import {FormGroup, HTMLSelect} from "@blueprintjs/core";
import {AppStore} from "stores";
import {HistogramWidgetStore} from "stores/widgets";
import {RegionSelectorComponent} from "components";
import "./HistogramToolbarComponent.scss";

@observer
export class HistogramToolbarComponent extends React.Component<{ widgetStore: HistogramWidgetStore}> {
    private handleCoordinateChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.widgetStore.setCoordinate(changeEvent.target.value);
    };

    public render() {
        const widgetStore = this.props.widgetStore;

        let enableStokesSelect = false;
        let stokesClassName = "unlinked-to-selected";
        const profileCoordinateOptions = [{value: "z", label: "Current"}];
        
        if (widgetStore.effectiveFrame && widgetStore.effectiveFrame.regionSet) {
            enableStokesSelect = widgetStore.effectiveFrame.hasStokes;
            
            const stokesInfo = widgetStore.effectiveFrame.stokesInfo;
            stokesInfo.forEach(stokes => profileCoordinateOptions.push({value: `${stokes}z`, label: stokes}));

            const linkedClass = "linked-to-selected-stokes";
            if (enableStokesSelect && widgetStore.matchActiveFrame && (widgetStore.coordinate === stokesInfo[widgetStore.effectiveFrame.requiredStokes] + "z")) {
                stokesClassName = AppStore.Instance.darkTheme ? `${linkedClass} dark-theme` : linkedClass;
            }
        }
        return (
            <div className="spectral-profiler-toolbar">
                <RegionSelectorComponent widgetStore={this.props.widgetStore}/>
                <FormGroup label={"Stokes"} inline={true} disabled={!enableStokesSelect}>
                    <HTMLSelect className={stokesClassName} value={widgetStore.coordinate} options={profileCoordinateOptions} onChange={this.handleCoordinateChanged} disabled={!enableStokesSelect}/>
                </FormGroup>
            </div>
        );
    }
}