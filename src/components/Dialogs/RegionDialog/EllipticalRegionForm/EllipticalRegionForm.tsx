import * as React from "react";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {Callout, FormGroup, InputGroup, NonIdealState} from "@blueprintjs/core";
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
            return <NonIdealState icon={"error"} title={"Missing region"} description={"Region not found or invalid"}/>;
        }

        return (
            <Callout title="Properties" className="elliptical-region-form">
                <FormGroup label="Region Name" inline={true}>
                    <InputGroup placeholder="Enter a region name" value={region.name} onChange={this.handleNameChange}/>
                </FormGroup>
            </Callout>
        );
    }
}