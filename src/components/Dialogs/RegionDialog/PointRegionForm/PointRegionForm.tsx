import {observer} from "mobx-react";
import {RegionStore} from "stores";
import * as React from "react";
import "./PointRegionForm.css";

@observer
export class PointRegionForm extends React.Component<{region: RegionStore}> {
    public render() {
        return <h1>Point Form Placeholder</h1>;
    }
}