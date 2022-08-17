import * as React from "react";
import {observer} from "mobx-react";
import {HTMLSelect, Radio, RadioGroup} from "@blueprintjs/core";
import {AppStore, SystemType} from "stores";
import {RegionCoordinate, RegionStore} from "stores/Frame";
import "./CoordinateComponent.scss";

interface ICoordinateComponentProps {
    region?: RegionStore;
    disableCoordinate?: boolean;
    selectedValue?: RegionCoordinate;
    onChange?: (ev: React.FormEvent<HTMLInputElement>) => void;
}

@observer
export class CoordinateComponent extends React.Component<ICoordinateComponentProps> {

    public render() {
        const region = this.props.region;
        return (
            <div className="coordinate-panel">
                <RadioGroup inline={true} onChange={this.props.onChange || (ev => region.setCoordinate(ev.currentTarget.value as RegionCoordinate))} selectedValue={this.props.selectedValue || region.coordinate} disabled={this.props.disableCoordinate}>
                    <Radio label={RegionCoordinate.Image} value={RegionCoordinate.Image} />
                    <Radio label={RegionCoordinate.World} value={RegionCoordinate.World} />
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
