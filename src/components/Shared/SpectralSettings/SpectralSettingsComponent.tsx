import * as React from "react";
import {observer} from "mobx-react";
import {FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {SpectralProfileWidgetStore, StokesAnalysisWidgetStore} from "stores/widgets";
import {AppStore} from "stores";
import {SpectralSystem, SPECTRAL_COORDS_SUPPORTED} from "models";
import "./SpectralSettingsComponent.css";

@observer
export class SpectralSettingsComponent extends React.Component<{appStore: AppStore, widgetStore: SpectralProfileWidgetStore|StokesAnalysisWidgetStore, disable: boolean}> {

    render() {
        const frame = this.props.appStore.activeFrame;
        const widgetStore = this.props.widgetStore;
        const spectralCoordinateOptions: IOptionProps[] = frame && frame.spectralCoordsSupported ?
            Array.from(frame.spectralCoordsSupported.keys()).map((coord: string) => { return {value: coord, label: coord}; }) :
            Array.from(SPECTRAL_COORDS_SUPPORTED.keys()).map((coord: string) => { return {value: coord, label: coord}; });
        const spectralSystemOptions: IOptionProps[] = frame && frame.spectralSystemsSupported ?
            frame.spectralSystemsSupported.map((system) => { return {value: system, label: system}; }) :
            Object.keys(SpectralSystem).map((key) => ({label: key, value: SpectralSystem[key]}));
        const disableSetting = this.props.disable || !frame || !frame.spectralFrame || !frame.isSpectralSettingsSupported;

        return (
            <React.Fragment>
                <div className="spectral-settings">
                    <FormGroup label={"Coordinate"} inline={true} disabled={disableSetting}>
                        <HTMLSelect
                            disabled={disableSetting}
                            value={widgetStore.spectralCoordinate ? widgetStore.spectralCoordinate : ""}
                            options={spectralCoordinateOptions}
                            onChange={(event: React.FormEvent<HTMLSelectElement>) => widgetStore.setSpectralCoordinate(event.currentTarget.value as string)}
                        />
                    </FormGroup>
                    <FormGroup label={"System"} inline={true} disabled={disableSetting}>
                        <HTMLSelect
                            disabled={disableSetting}
                            value={widgetStore.spectralSystem ? widgetStore.spectralSystem : ""}
                            options={spectralSystemOptions}
                            onChange={(event: React.FormEvent<HTMLSelectElement>) => widgetStore.setSpectralSystem(event.currentTarget.value as SpectralSystem)}
                        />
                    </FormGroup>
                </div>
            </React.Fragment>
        );
    }
}