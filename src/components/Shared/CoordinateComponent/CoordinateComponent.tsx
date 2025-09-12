import * as React from "react";
import {HTMLSelect} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {AppStore, NumberFormatType, SystemType} from "stores";
import {CoordinateMode} from "stores/Frame";

import "./CoordinateComponent.scss";

interface ICoordinateComponentProps {
    selectedValue: CoordinateMode;
    onChange: (coordinate: CoordinateMode) => void;
    disableCoordinate?: boolean;
}

@observer
export class CoordinateComponent extends React.Component<ICoordinateComponentProps> {
    private handleSystemChange = (ev: React.FormEvent<HTMLSelectElement>) => {
        const newSystem = ev.currentTarget.value as SystemType;
        const appStore = AppStore.Instance;
        const global = appStore.overlaySettings.global;
        const numbers = appStore.overlaySettings.numbers;

        // Auto-set format to degrees when switching to non-HMS/DMS coordinate systems
        const targetSystem = newSystem === SystemType.Auto ? global.explicitSystem : newSystem;
        
        // Set coordinate mode based on target system
        if (targetSystem === SystemType.Image) {
            this.props.onChange(CoordinateMode.Image);
        } else {
            this.props.onChange(CoordinateMode.World);
        }

        // Set the new system
        global.setSystem(newSystem);
        
        const supportsHmsDms = targetSystem === SystemType.FK4 || targetSystem === SystemType.FK5 || targetSystem === SystemType.ICRS;
        
        if (!supportsHmsDms && numbers.customFormat) {
            if (numbers.formatTypeX !== NumberFormatType.Degrees) {
                numbers.setFormatX(NumberFormatType.Degrees);
            }
            if (numbers.formatTypeY !== NumberFormatType.Degrees) {
                numbers.setFormatY(NumberFormatType.Degrees);
            }
        }
    };

    public render() {
        const global = AppStore.Instance.overlaySettings.global;
        return (
            <div className="coordinate-panel">
                <HTMLSelect
                    options={Object.keys(SystemType).map(key => ({label: key, value: SystemType[key]}))}
                    value={global.system === SystemType.Auto ? global.explicitSystem : global.system}
                    onChange={this.handleSystemChange}
                />
            </div>
        );
    }
}
