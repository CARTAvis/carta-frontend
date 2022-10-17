import * as React from "react";
import {observer} from "mobx-react";
import {FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {FrameStore} from "stores/Frame";
import {SpectralSystem} from "models";

@observer
export class SpectralSettingsComponent extends React.Component<{
    frame: FrameStore;
    onSpectralCoordinateChange: (cooridnate: string) => void;
    onSpectralCoordinateChangeSecondary?: (cooridnate: string) => void;
    onSpectralSystemChange: (system: string) => void;
    disable: boolean;
    disableChannelOption?: boolean;
    secondaryAxisCursorInfoVisible?: boolean;
}> {
    render() {
        const frame = this.props.frame;
        const nativeSpectralCoordinate = frame?.nativeSpectralCoordinate;
        const spectralTypes = frame?.spectralCoordsSupported ? Array.from(frame.spectralCoordsSupported.keys()) : [];
        const filteredSpectralTypes = this.props.disableChannelOption ? spectralTypes.filter(type => type !== "Channel") : spectralTypes;
        const spectralCoordinateOptions: IOptionProps[] = filteredSpectralTypes.map((coord: string) => {
            return {value: coord, label: coord === nativeSpectralCoordinate ? coord + " (Native WCS)" : coord};
        });
        const spectralSystemOptions: IOptionProps[] = frame?.spectralSystemsSupported
            ? frame.spectralSystemsSupported.map(system => {
                  return {value: system, label: system};
              })
            : [];
        const hasFrameCoordinateSetting = frame && (frame.isSpectralCoordinateConvertible || (frame.spectralAxis && !frame.spectralAxis.valid));
        const disableCoordinateSetting = this.props.disable || !hasFrameCoordinateSetting;
        const disableSystemSetting = this.props.disable || !frame || !frame.isSpectralSystemConvertible;

        return (
            <React.Fragment>
                <FormGroup label={"Coordinate"} inline={true} disabled={disableCoordinateSetting}>
                    <HTMLSelect
                        disabled={disableCoordinateSetting}
                        value={frame && frame.spectralCoordinate ? frame.spectralCoordinate : ""}
                        options={spectralCoordinateOptions}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => this.props.onSpectralCoordinateChange(event.currentTarget.value as string)}
                    />
                </FormGroup>
                {this.props.secondaryAxisCursorInfoVisible && (
                    <FormGroup label={"Secondary Coordinate"} inline={true} disabled={disableCoordinateSetting}>
                        <HTMLSelect
                            disabled={disableCoordinateSetting}
                            value={frame && frame.spectralCoordinateSecondary ? frame.spectralCoordinateSecondary : ""}
                            options={spectralCoordinateOptions}
                            onChange={(event: React.FormEvent<HTMLSelectElement>) => this.props.onSpectralCoordinateChangeSecondary(event.currentTarget.value as string)}
                        />
                    </FormGroup>
                )}

                <FormGroup label={"System"} inline={true} disabled={disableSystemSetting}>
                    <HTMLSelect
                        disabled={disableSystemSetting}
                        value={frame && frame.spectralSystem ? frame.spectralSystem : ""}
                        options={spectralSystemOptions}
                        onChange={(event: React.FormEvent<HTMLSelectElement>) => this.props.onSpectralSystemChange(event.currentTarget.value as SpectralSystem)}
                    />
                </FormGroup>
            </React.Fragment>
        );
    }
}
