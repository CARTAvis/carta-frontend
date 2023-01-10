import * as React from "react";
import {observer} from "mobx-react";
import {HTMLSelect, Radio, RadioGroup} from "@blueprintjs/core";
import {AppStore, SystemType} from "stores";
import {CoordinateMode} from "stores/Frame";
import "./CoordinateComponent.scss";

interface ICoordinateComponentProps {
    selectedValue: CoordinateMode;
    onChange: (coordinate: CoordinateMode) => void;
    disableCoordinate?: boolean;
}

@observer
export class CoordinateComponent extends React.Component<ICoordinateComponentProps> {
    public render() {
        return (
            <div className="coordinate-panel">
                <RadioGroup
                    inline={true}
                    onChange={ev => this.props.onChange(ev.currentTarget.value as CoordinateMode)}
                    selectedValue={this.props.selectedValue}
                    disabled={this.props.disableCoordinate}
                >
                    <Radio label={CoordinateMode.Image} value={CoordinateMode.Image} />
                    <Radio label={CoordinateMode.World} value={CoordinateMode.World} />
                </RadioGroup>
                <HTMLSelect
                    options={Object.keys(SystemType).map(key => ({label: key, value: SystemType[key]}))}
                    value={AppStore.Instance.overlayStore.global.system}
                    onChange={ev => AppStore.Instance.overlayStore.global.setSystem(ev.currentTarget.value as SystemType)}
                />
            </div>
        );
    }
}
