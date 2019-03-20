import {observer} from "mobx-react";
import {RegionStore} from "stores";
import * as React from "react";
import "./EllipticalRegionForm.css";

@observer
export class EllipticalRegionForm extends React.Component<{region: RegionStore}> {
    public render() {
        return <h1>Elliptical Region Form Placeholder</h1>;
    }
}