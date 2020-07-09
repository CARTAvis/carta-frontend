import * as React from "react";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {H5, InputGroup, NumericInput, Classes} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {RegionStore} from "stores";
import {closeTo, getFormattedWCSString} from "utilities";
import "./PolygonRegionForm.css";

const KEYCODE_ENTER = 13;

@observer
export class PolygonRegionForm extends React.Component<{ region: RegionStore, wcsInfo: number }> {
    @observable displayColorPicker: boolean;

    private static readonly REGION_PIXEL_EPS = 1.0e-3;

    private handleNameChange = (ev) => {
        this.props.region.setName(ev.currentTarget.value);
    };

    private handlePointChange = (index: number, isXCoordinate: boolean, ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const region = this.props.region;

        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = isXCoordinate ? region.controlPoints[index].x : region.controlPoints[index].y;

        if (isFinite(value) && !closeTo(value, existingValue, PolygonRegionForm.REGION_PIXEL_EPS)) {
            if (isXCoordinate) {
                this.props.region.setControlPoint(index, {x: value, y: this.props.region.controlPoints[index].y});

            } else {
                this.props.region.setControlPoint(index, {x: this.props.region.controlPoints[index].x, y: value});
            }
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    public render() {
        const region = this.props.region;
        if (!region || !region.isValid || region.regionType !== CARTA.RegionType.POLYGON) {
            return null;
        }

        const commonProps = {
            selectAllOnFocus: true,
            allowNumericCharactersOnly: true,
        };
        const pxUnitSpan = <span className={Classes.TEXT_MUTED}>(px)</span>;

        const pointRows = region.controlPoints.map((point, index) => {
            return (
                <tr key={index}>
                    <td>Point {index} {pxUnitSpan}</td>
                    <td>
                        <NumericInput
                            {...commonProps}
                            buttonPosition={"none"}
                            placeholder="X Coordinate"
                            value={point.x}
                            onBlur={(evt) => this.handlePointChange(index, true, evt)}
                            onKeyDown={(evt) => this.handlePointChange(index, true, evt)}
                        />
                    </td>
                    <td>
                        <NumericInput
                            {...commonProps}
                            buttonPosition={"none"}
                            placeholder="Y Coordinate"
                            value={point.y}
                            onBlur={(evt) => this.handlePointChange(index, false, evt)}
                            onKeyDown={(evt) => this.handlePointChange(index, false, evt)}
                        />
                    </td>
                    <td>
                        <span className="wcs-string">{getFormattedWCSString(this.props.wcsInfo, point)}</span>
                    </td>
                </tr>
            );
        });

        return (
            <div className="form-section point-region-form">
                <H5>Properties</H5>
                <div className="form-contents">
                    <table>
                        <tbody>
                        <tr>
                            <td>Region Name</td>
                            <td colSpan={2}>
                                <InputGroup placeholder="Enter a region name" value={region.name} onChange={this.handleNameChange}/>
                            </td>
                        </tr>
                        {pointRows}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}