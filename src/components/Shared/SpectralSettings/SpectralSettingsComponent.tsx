import * as React from "react";
import {FormGroup, HTMLSelect, IOptionProps} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {SpectralSystem} from "models";
import {FrameStore} from "stores/Frame";

@observer
export class SpectralSettingsComponent extends React.Component<{
    frame: FrameStore;
    onSpectralCoordinateChange: (coordinate: string) => void;
    onSpectralCoordinateChangeSecondary?: (coordinate: string) => void;
    onSpectralSystemChange: (system: string) => void;
    disable: boolean;
    disableChannelOption?: boolean;
    secondaryAxisCursorInfoVisible?: boolean;
    label?: string;
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
                <FormGroup label={this.props.label ? this.props.label : "Coordinate"} inline={true} disabled={disableCoordinateSetting}>
                    <HTMLSelect
                        disabled={disableCoordinateSetting}
                        value={frame && frame.spectralCoordinate ? frame.spectralCoordinate : ""}
                        options={spectralCoordinateOptions}
                        onChange={event => this.props.onSpectralCoordinateChange(event.currentTarget.value as string)}
                    />
                </FormGroup>
                {this.props.secondaryAxisCursorInfoVisible && (
                    <FormGroup label={"Secondary coordinate"} inline={true} disabled={disableCoordinateSetting}>
                        <HTMLSelect
                            disabled={disableCoordinateSetting}
                            value={frame && frame.spectralCoordinateSecondary ? frame.spectralCoordinateSecondary : ""}
                            options={spectralCoordinateOptions}
                            onChange={event => this.props.onSpectralCoordinateChangeSecondary(event.currentTarget.value as string)}
                        />
                    </FormGroup>
                )}

                <FormGroup label={this.props.label ? " " : "System"} inline={true} disabled={disableSystemSetting}>
                    <HTMLSelect
                        disabled={disableSystemSetting}
                        value={frame && frame.spectralSystem ? frame.spectralSystem : ""}
                        options={spectralSystemOptions}
                        onChange={event => this.props.onSpectralSystemChange(event.currentTarget.value as SpectralSystem)}
                    />
                </FormGroup>
            </React.Fragment>
        );
    }
}
