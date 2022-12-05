import {observer} from "mobx-react";
import * as React from "react";
import {autorun} from "mobx";
import {FormGroup, HTMLSelect} from "@blueprintjs/core";
import {AppStore} from "stores";
import {HistogramWidgetStore} from "stores/Widgets";
import {RegionSelectorComponent} from "components/Shared";
import "./HistogramToolbarComponent.scss";
import {FULL_POLARIZATIONS} from "models";

@observer
export class HistogramToolbarComponent extends React.Component<{widgetStore: HistogramWidgetStore}> {
    private handleCoordinateChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.props.widgetStore.setCoordinate(changeEvent.target.value);
    };

    constructor(props: {widgetStore: HistogramWidgetStore}) {
        super(props);
        const widgetStore = this.props.widgetStore;
        // When frame is changed(coordinateOptions changes), coordinate stays unchanged if new frame also supports it, otherwise defaults to 'z'
        autorun(() => {
            if (widgetStore.effectiveFrame && (!widgetStore.effectiveFrame.coordinateOptionsZ.find(option => option.value === widgetStore.coordinate) || !widgetStore.effectiveFrame.polarizationInfo)) {
                widgetStore.setCoordinate("z");
            }
        });
    }

    public render() {
        const widgetStore = this.props.widgetStore;

        let enableStokesSelect = false;
        let stokesClassName = "unlinked-to-selected";
        const coordinateOptions = [{value: "z", label: "Current"}];

        if (widgetStore.effectiveFrame?.regionSet) {
            enableStokesSelect = widgetStore.effectiveFrame.hasStokes;
            coordinateOptions.push(...widgetStore.effectiveFrame.coordinateOptionsZ);

            if (enableStokesSelect && widgetStore.isEffectiveFrameEqualToActiveFrame && widgetStore.coordinate === FULL_POLARIZATIONS.get(widgetStore.effectiveFrame.requiredPolarization) + "z") {
                const linkedClass = "linked-to-selected-stokes";
                stokesClassName = AppStore.Instance.darkTheme ? `${linkedClass} dark-theme` : linkedClass;
            }
        }
        return (
            <div className="spectral-profiler-toolbar">
                <RegionSelectorComponent widgetStore={this.props.widgetStore} />
                <FormGroup label={"Polarization"} inline={true} disabled={!enableStokesSelect}>
                    <HTMLSelect className={stokesClassName} value={widgetStore.coordinate} options={coordinateOptions} onChange={this.handleCoordinateChanged} disabled={!enableStokesSelect} />
                </FormGroup>
            </div>
        );
    }
}
