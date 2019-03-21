import * as React from "react";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {FormGroup, H5, InputGroup} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {RegionStore} from "stores";
import "./EllipticalRegionForm.css";

@observer
export class EllipticalRegionForm extends React.Component<{ region: RegionStore }> {
    @observable displayColorPicker: boolean;

    private handleNameChange = (ev) => {
        this.props.region.setName(ev.currentTarget.value);
    };

    public render() {
        const region = this.props.region;
        if (!region || !region.isValid || region.regionType !== CARTA.RegionType.ELLIPSE) {
            return null;
        }

        return (
            <div className="form-section elliptical-region-form">
                <H5>Properties</H5>
                <FormGroup label="Region Name" inline={true}>
                    <InputGroup placeholder="Enter a region name" value={region.name} onChange={this.handleNameChange}/>
                </FormGroup>
            </div>
        );
    }
}