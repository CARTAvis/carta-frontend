import * as React from "react";
import {observer} from "mobx-react";
import {HTMLSelect, Radio, RadioGroup} from "@blueprintjs/core";
import {AppStore, RegionCoordinate, RegionStore, SystemType} from "stores";
import "./CoordinateComponent.scss";

@observer
export class CoordinateComponent extends React.Component<{region: RegionStore; disableCooridnate: boolean}> {
    public render() {
        const region = this.props.region;
        return (
            <div className="coordinate-panel">
                <RadioGroup inline={true} onChange={ev => region.setCoordinate(ev.currentTarget.value as RegionCoordinate)} selectedValue={region.coordinate} disabled={this.props.disableCooridnate}>
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
