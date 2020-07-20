import * as React from "react";
import {observer} from "mobx-react";
import {computed} from "mobx";
import {H5, InputGroup, NumericInput, Classes} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {FrameStore, RegionCoordinate, RegionStore} from "stores";
import {Point2D, WCSPoint2D} from "models";
import {closeTo, formattedArcsec, getFormattedWCSPoint, getPixelValueFromWCS, getValueFromArcsecString, WCS_REGEXP} from "utilities";
import {CoordinateComponent} from "../CoordinateComponent/CoordinateComponent";
import "./EllipticalRegionForm.css";

const KEYCODE_ENTER = 13;

@observer
export class EllipticalRegionForm extends React.Component<{ region: RegionStore, frame: FrameStore, wcsInfo: number }> {
    private static readonly REGION_PIXEL_EPS = 1.0e-3;

    @computed get centerWCSPoint(): WCSPoint2D {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || !region.controlPoints[0] || !this.props.wcsInfo) {
            return null;
        }
        const centerPoint = region.controlPoints[0];
        return getFormattedWCSPoint(this.props.wcsInfo, centerPoint);
    }

    @computed get sizeWCS(): WCSPoint2D {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || !region.controlPoints[1] || !this.props.frame) {
            return null;
        }
        const size = this.props.region.controlPoints[1];
        const wcsSize = this.props.frame.getWcsSizeInArcsec(size);
        if (wcsSize) {
            return {x: formattedArcsec(wcsSize.x), y: formattedArcsec(wcsSize.y)};
        }
        return null;
    }

    private handleNameChange = (ev) => {
        this.props.region.setName(ev.currentTarget.value);
    };

    private handleCenterXChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.controlPoints[0].x;

        if (isFinite(value) && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(0, {x: value, y: this.props.region.controlPoints[0].y});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleCenterYChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.controlPoints[0].y;

        if (isFinite(value) && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(0, {x: this.props.region.controlPoints[0].x, y: value});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleCenterWCSXChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        if (!this.centerWCSPoint) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === this.centerWCSPoint.x) {
            return;
        }
        if (WCS_REGEXP.test(wcsString)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.centerWCSPoint.y});
            const existingValue = this.props.region.controlPoints[0].x;
            if (newPoint && isFinite(newPoint.x) && !closeTo(newPoint.x, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setControlPoint(0, newPoint);
                return;
            }
        }

        ev.currentTarget.value = this.centerWCSPoint.x;
    };

    private handleCenterWCSYChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        if (!this.centerWCSPoint) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === this.centerWCSPoint.y) {
            return;
        }
        if (WCS_REGEXP.test(wcsString)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: this.centerWCSPoint.x, y: wcsString});
            const existingValue = this.props.region.controlPoints[0].y;
            if (newPoint && isFinite(newPoint.y) && !closeTo(newPoint.y, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setControlPoint(0, newPoint);
                return;
            }
        }

        ev.currentTarget.value = this.centerWCSPoint.y;
    };

    private handleMajorAxisChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.controlPoints[1].x;

        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(1, {x: value, y: this.props.region.controlPoints[1].y});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleMajorAxisWCSChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        if (!this.sizeWCS) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === this.sizeWCS.x) {
            return;
        }
        const value = this.props.frame.getImageValueFromArcsec(getValueFromArcsecString(wcsString));
        const existingValue = this.props.region.controlPoints[1].x;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(1, {x: value, y: this.props.region.controlPoints[1].y});
            return;
        }

        ev.currentTarget.value = this.sizeWCS.x;
    };

    private handleMinorAxisChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.controlPoints[1].y;

        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(1, {x: this.props.region.controlPoints[1].x, y: value});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleMinorAxisWCSChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        if (!this.sizeWCS) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === this.sizeWCS.y) {
            return;
        }
        const value = this.props.frame.getImageValueFromArcsec(getValueFromArcsecString(wcsString));
        const existingValue = this.props.region.controlPoints[1].y;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(1, {x: this.props.region.controlPoints[1].x, y: value});
            return;
        }

        ev.currentTarget.value = this.sizeWCS.y;
    };

    private handleRotationChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.rotation;

        if (isFinite(value) && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setRotation(value);
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    public render() {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || region.regionType !== CARTA.RegionType.ELLIPSE) {
            return null;
        }

        const centerPoint = region.controlPoints[0];
        let xInput, yInput;
        if (region.coordinate === RegionCoordinate.Image) {
            xInput = <NumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="X Coordinate" value={centerPoint.x} onBlur={this.handleCenterXChange} onKeyDown={this.handleCenterXChange}/>;
            yInput = <NumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Y Coordinate" value={centerPoint.y} onBlur={this.handleCenterYChange} onKeyDown={this.handleCenterYChange}/>;
        } else {
            xInput = (
                <NumericInput
                    allowNumericCharactersOnly={false}
                    buttonPosition="none"
                    placeholder="X WCS Coordinate"
                    disabled={!this.props.wcsInfo || !this.centerWCSPoint}
                    value={this.centerWCSPoint ? this.centerWCSPoint.x : ""}
                    onBlur={this.handleCenterWCSXChange}
                    onKeyDown={this.handleCenterWCSXChange}
                />
            );
            yInput = (
                <NumericInput
                    allowNumericCharactersOnly={false}
                    buttonPosition="none"
                    placeholder="Y WCS Coordinate"
                    disabled={!this.props.wcsInfo || !this.centerWCSPoint}
                    value={this.centerWCSPoint ? this.centerWCSPoint.y : ""}
                    onBlur={this.handleCenterWCSYChange}
                    onKeyDown={this.handleCenterWCSYChange}
                />
            );
        }
        const infoString = region.coordinate === RegionCoordinate.Image ? `WCS: ${WCSPoint2D.ToString(this.centerWCSPoint)}` : `Image: ${Point2D.ToString(centerPoint, "px", 3)}`;

        // size
        const size = region.controlPoints[1];
        let sizeWidthInput, sizeHeightInput;
        if (region.coordinate === RegionCoordinate.Image) {
            sizeWidthInput = <NumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Semi-major" value={size.x} onBlur={this.handleMajorAxisChange} onKeyDown={this.handleMajorAxisChange}/>;
            sizeHeightInput = <NumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Semi-minor" value={size.y} onBlur={this.handleMinorAxisChange} onKeyDown={this.handleMinorAxisChange}/>;
        } else {
            sizeWidthInput = (
                <NumericInput
                    allowNumericCharactersOnly={false}
                    buttonPosition="none"
                    placeholder="Semi-major"
                    disabled={!this.props.wcsInfo}
                    value={this.sizeWCS ? this.sizeWCS.x : ""}
                    onBlur={this.handleMajorAxisWCSChange}
                    onKeyDown={this.handleMajorAxisWCSChange}
                />
            );
            sizeHeightInput = (
                <NumericInput
                    allowNumericCharactersOnly={false}
                    buttonPosition="none"
                    placeholder="Semi-minor"
                    disabled={!this.props.wcsInfo}
                    value={this.sizeWCS ? this.sizeWCS.y : ""}
                    onBlur={this.handleMinorAxisWCSChange}
                    onKeyDown={this.handleMinorAxisWCSChange}
                />
            );
        }
        const sizeInfoString = region.coordinate === RegionCoordinate.Image ? `(Semi-major, Semi-minor): ${WCSPoint2D.ToString(this.sizeWCS)}` : `Image: ${Point2D.ToString(size, "px", 3)}`;
        const pxUnitSpan = region.coordinate === RegionCoordinate.Image ? <span className={Classes.TEXT_MUTED}>(px)</span> : "";
        return (
            <div className="form-section elliptical-region-form">
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
                        <tr>
                            <td>Coordinate</td>
                            <td colSpan={2}><CoordinateComponent region={region} disableCooridnate={!this.props.wcsInfo}/></td>
                        </tr>
                        <tr>
                            <td>Center {pxUnitSpan}</td>
                            <td>{xInput}</td>
                            <td>{yInput}</td>
                            <td><span className="info-string">{infoString}</span></td>
                        </tr>
                        <tr>
                            <td>Axes {pxUnitSpan}</td>
                            <td>{sizeWidthInput}</td>
                            <td>{sizeHeightInput}</td>
                            <td><span className="info-string">{sizeInfoString}</span></td>
                        </tr>
                        <tr>
                            <td>P.A. <span className={Classes.TEXT_MUTED}>(deg)</span></td>
                            <td>
                                <NumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="P.A." value={region.rotation} onBlur={this.handleRotationChange} onKeyDown={this.handleRotationChange}/>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}