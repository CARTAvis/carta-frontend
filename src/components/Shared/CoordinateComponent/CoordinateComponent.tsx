import * as React from "react";
import {observer} from "mobx-react";
import {HTMLSelect, Radio, RadioGroup} from "@blueprintjs/core";
import {AppStore, SystemType} from "stores";
import {CoordinateMode, RegionStore} from "stores/Frame";
import "./CoordinateComponent.scss";

interface ICoordinateComponentProps {
    region?: RegionStore;
    disableCoordinate?: boolean;
    selectedValue?: CoordinateMode;
    onChange?: (ev: React.FormEvent<HTMLInputElement>) => void;
}

@observer
export class CoordinateComponent extends React.Component<ICoordinateComponentProps> {
    public render() {
        const region = this.props.region;
        return (
            <div className="coordinate-panel">
                <RadioGroup
                    inline={true}
                    onChange={this.props.onChange || (ev => region?.setCoordinate(ev.currentTarget.value as CoordinateMode))}
                    selectedValue={this.props.selectedValue || region?.coordinate}
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
