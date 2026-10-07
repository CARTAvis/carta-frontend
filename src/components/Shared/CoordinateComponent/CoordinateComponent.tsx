import * as React from "react";
import {HTMLSelect, Radio, RadioGroup} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {CoordinateMode, SystemType} from "enums";
import {AppStore} from "stores";

import "./CoordinateComponent.scss";

interface ICoordinateComponentProps {
    selectedValue: CoordinateMode;
    onChange: (coordinate: CoordinateMode) => void;
    disableCoordinate?: boolean;
    "data-testid"?: string;
}

@observer
export class CoordinateComponent extends React.Component<ICoordinateComponentProps> {
    public render() {
        return (
            <div className="coordinate-panel">
                <RadioGroup inline={true} onChange={ev => this.props.onChange(ev.currentTarget.value as CoordinateMode)} selectedValue={this.props.selectedValue} disabled={this.props.disableCoordinate}>
                    <Radio data-testid={this.props["data-testid"] ? `${this.props["data-testid"]}-image-radio` : undefined} label={CoordinateMode.Image} value={CoordinateMode.Image} />
                    <Radio data-testid={this.props["data-testid"] ? `${this.props["data-testid"]}-world-radio` : undefined} label={CoordinateMode.World} value={CoordinateMode.World} />
                </RadioGroup>
                <HTMLSelect
                    data-testid={this.props["data-testid"] ? `${this.props["data-testid"]}-system-select` : undefined}
                    options={Object.keys(SystemType).map(key => ({label: key, value: SystemType[key]}))}
                    value={AppStore.Instance.overlaySettings.global.system}
                    onChange={ev => AppStore.Instance.overlaySettings.global.setSystem(ev.currentTarget.value as SystemType)}
                />
            </div>
        );
    }
}
