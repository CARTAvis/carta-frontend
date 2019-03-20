import {observer} from "mobx-react";
import {RegionStore} from "stores";
import * as React from "react";
import "./RectangularRegionForm.css";

@observer
export class RectangularRegionForm extends React.Component<{region: RegionStore}> {
    public render() {
        return <h1>Rectangular Region Form Placeholder</h1>;
    }
}