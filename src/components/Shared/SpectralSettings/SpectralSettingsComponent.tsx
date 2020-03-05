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
        const nativeSpectralCoordinate = frame ? frame.nativeSpectralCoordinate : undefined;
        const widgetStore = this.props.widgetStore;
        const spectralCoordinateOptions: IOptionProps[] = frame && frame.spectralCoordsSupported ?
            Array.from(frame.spectralCoordsSupported.keys()).map((coord: string) => { return {value: coord, label: coord === nativeSpectralCoordinate ? coord + " (Native WCS)" : coord}; }) :
            Array.from(SPECTRAL_COORDS_SUPPORTED.keys()).map((coord: string) => { return {value: coord, label: coord === nativeSpectralCoordinate ? coord + " (Native WCS)" :  coord}; });
        const spectralSystemOptions: IOptionProps[] = frame && frame.spectralSystemsSupported ?
            frame.spectralSystemsSupported.map((system) => { return {value: system, label: system}; }) :
            Object.keys(SpectralSystem).map((key) => ({label: key, value: SpectralSystem[key]}));
        const disableCoordinateSetting = this.props.disable || !frame || !frame.isSpectralCoordinateConvertible;
        const disableSystemSetting = this.props.disable || !frame || !frame.isSpectralSystemConvertible;

        return (
            <React.Fragment>
                <div className="spectral-settings">
                    <FormGroup label={"Coordinate"} inline={true} disabled={disableCoordinateSetting}>
                        <HTMLSelect
                            disabled={disableCoordinateSetting}
                            value={frame && frame.spectralCoordinate ? frame.spectralCoordinate : ""}
                            options={spectralCoordinateOptions}
                            onChange={(event: React.FormEvent<HTMLSelectElement>) => widgetStore.setSpectralCoordinate(event.currentTarget.value as string)}
                        />
                    </FormGroup>
                    <FormGroup label={"System"} inline={true} disabled={disableSystemSetting}>
                        <HTMLSelect
                            disabled={disableSystemSetting}
                            value={frame && frame.spectralSystem ? frame.spectralSystem : ""}
                            options={spectralSystemOptions}
                            onChange={(event: React.FormEvent<HTMLSelectElement>) => widgetStore.setSpectralSystem(event.currentTarget.value as SpectralSystem)}
                        />
                    </FormGroup>
                </div>
            </React.Fragment>
        );
    }
}