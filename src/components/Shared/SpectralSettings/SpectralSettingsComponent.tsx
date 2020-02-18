import * as React from "react";
import {observer} from "mobx-react";
import {FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {AppStore} from "stores";
import {SpectralSystem, SPECTRAL_COORDS_SUPPORTED} from "models";
import "./SpectralSettingsComponent.css";

@observer
export class SpectralSettingsComponent extends React.Component<{appStore: AppStore, widgetStore: SpectralProfileWidgetStore}> {

    render() {
        const widgetStore = this.props.widgetStore;
        const spectralCoordinateOptions: IOptionProps[] = Array.from(SPECTRAL_COORDS_SUPPORTED.keys()).map((coord: string) => { return {value: coord, label: coord}; });

        return (
            <React.Fragment>
                <div className="spectral-settings">
                    <FormGroup label={"Coordinate"} inline={true} disabled={!this.props.appStore.activeFrame || !this.props.appStore.activeFrame.spectralFrame || !widgetStore.isSpectralCoordinateSupported}>
                        <HTMLSelect
                            disabled={!this.props.appStore.activeFrame || !this.props.appStore.activeFrame.spectralFrame || !widgetStore.isSpectralCoordinateSupported}
                            value={widgetStore.spectralCoordinate}
                            options={spectralCoordinateOptions}
                            onChange={(event: React.FormEvent<HTMLSelectElement>) => widgetStore.setSpectralCoordinate(event.currentTarget.value as string)}
                        />
                    </FormGroup>
                    <FormGroup label={"System"} inline={true} disabled={!this.props.appStore.activeFrame || !this.props.appStore.activeFrame.spectralFrame || !widgetStore.isSpectralSystemSupported}>
                        <HTMLSelect
                            disabled={!this.props.appStore.activeFrame || !this.props.appStore.activeFrame.spectralFrame || !widgetStore.isSpectralSystemSupported}
                            value={widgetStore.spectralSystem}
                            options={Object.keys(SpectralSystem).map((key) => ({label: key, value: SpectralSystem[key]}))}
                            onChange={(event: React.FormEvent<HTMLSelectElement>) => widgetStore.setSpectralSystem(event.currentTarget.value as SpectralSystem)}
                        />
                    </FormGroup>
                </div>
            </React.Fragment>
        );
    }
}