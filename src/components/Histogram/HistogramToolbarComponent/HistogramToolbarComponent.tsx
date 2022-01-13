import {observer} from "mobx-react";
import * as React from "react";
import {autorun} from "mobx";
import {FormGroup, HTMLSelect} from "@blueprintjs/core";
import {AppStore} from "stores";
import {HistogramWidgetStore} from "stores/widgets";
import {RegionSelectorComponent} from "components/Shared";
import "./HistogramToolbarComponent.scss";

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
            if (widgetStore.effectiveFrame && (!widgetStore.effectiveFrame.polarizationInfo.find(polarization => `${polarization.replace("Stokes ", "")}z` === widgetStore.coordinate) || !widgetStore.effectiveFrame.polarizationInfo)) {
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
            const polarizationInfo = widgetStore.effectiveFrame.polarizationInfo;
            polarizationInfo.forEach(polarization => coordinateOptions.push({value: `${polarization.replace("Stokes ", "")}z`, label: polarization}));

            if (enableStokesSelect && widgetStore.isEffectiveFrameEqualToActiveFrame && widgetStore.coordinate === polarizationInfo[widgetStore.effectiveFrame.requiredStokes] + "z") {
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
