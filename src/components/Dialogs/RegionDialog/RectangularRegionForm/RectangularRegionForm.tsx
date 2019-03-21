import * as React from "react";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {H5, FormGroup, InputGroup} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {RegionStore} from "stores";
import "./RectangularRegionForm.css";

@observer
export class RectangularRegionForm extends React.Component<{ region: RegionStore }> {
    @observable displayColorPicker: boolean;

    private handleNameChange = (ev) => {
        this.props.region.setName(ev.currentTarget.value);
    };

    public render() {
        const region = this.props.region;
        if (!region || !region.isValid || region.regionType !== CARTA.RegionType.RECTANGLE) {
            return null;
        }

        return (
            <div className="form-section rectangular-region-form">
                <H5>Properties</H5>
                <FormGroup label="Region Name" inline={true}>
                    <InputGroup placeholder="Enter a region name" value={region.name} onChange={this.handleNameChange}/>
                </FormGroup>
            </div>
        );
    }
}