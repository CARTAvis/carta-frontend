import * as React from "react";
import {observer} from "mobx-react";
import {computed} from "mobx";
import {H5, InputGroup, NumericInput, Classes} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {FrameStore, RegionCoordinate, RegionStore} from "stores";
import {Point2D, WCSPoint2D} from "models";
import {closeTo, formattedArcsec, getFormattedWCSPoint, getPixelValueFromWCS} from "utilities";
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
        const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.centerWCSPoint.y});
        const existingValue = this.props.region.controlPoints[0].x;

        if (newPoint && isFinite(newPoint.x) && !closeTo(newPoint.x, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(0, newPoint);
            return;
        }

        ev.currentTarget.value = wcsString;
    };

    private handleCenterWCSYChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        if (!this.centerWCSPoint) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: this.centerWCSPoint.x, y: wcsString});
        const existingValue = this.props.region.controlPoints[0].y;

        if (newPoint && isFinite(newPoint.y) && !closeTo(newPoint.y, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(0, newPoint);
            return;
        }

        ev.currentTarget.value = wcsString;
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

    private getSizeString(size: Point2D) {
        const wcsSize = this.props.frame.getWcsSizeInArcsec(size);
        if (wcsSize) {
            return `Semi-major: ${formattedArcsec(wcsSize.x)}; Semi-minor: ${formattedArcsec(wcsSize.y)}`;
        }
        return null;
    }

    public render() {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || region.regionType !== CARTA.RegionType.ELLIPSE) {
            return null;
        }

        const commonProps = {
            selectAllOnFocus: true,
            allowNumericCharactersOnly: true
        };

        const centerPoint = region.controlPoints[0];
        const xInput = region.coordinate === RegionCoordinate.Image ?
            <NumericInput {...commonProps} buttonPosition="none" placeholder="X Coordinate" value={centerPoint.x} onBlur={this.handleCenterXChange} onKeyDown={this.handleCenterXChange}/> :
            <InputGroup className="wcs-input" placeholder="X WCS Coordinate" disabled={!this.props.wcsInfo || !this.centerWCSPoint} value={this.centerWCSPoint ? this.centerWCSPoint.x : ""} onChange={this.handleCenterWCSXChange}/>;
        const yInput = region.coordinate === RegionCoordinate.Image ?
            <NumericInput {...commonProps} buttonPosition="none" placeholder="Y Coordinate" value={centerPoint.y} onBlur={this.handleCenterYChange} onKeyDown={this.handleCenterYChange}/> :
            <InputGroup className="wcs-input" placeholder="Y WCS Coordinate" disabled={!this.props.wcsInfo || !this.centerWCSPoint} value={this.centerWCSPoint ? this.centerWCSPoint.y : ""} onChange={this.handleCenterWCSYChange}/>;
        const infoString = region.coordinate === RegionCoordinate.Image ? `WCS: ${WCSPoint2D.ToString(this.centerWCSPoint)}` : `Image: ${Point2D.ToString(centerPoint, "px", 3)}`;
        const pxUnitSpan = region.coordinate === RegionCoordinate.Image ? <span className={Classes.TEXT_MUTED}>(px)</span> : "";
        const sizeDims = region.controlPoints[1];
        // CRTF uses north/south for major axis
        const wcsStringSize = this.getSizeString(sizeDims);
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
                            <td colSpan={2}><CoordinateComponent region={region}/></td>
                        </tr>
                        <tr>
                            <td>Center {pxUnitSpan}</td>
                            <td>{xInput}</td>
                            <td>{yInput}</td>
                            <td><span className="info-string">{infoString}</span></td>
                        </tr>
                        <tr>
                            <td>Axes {<span className={Classes.TEXT_MUTED}>(px)</span>}</td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="Semi-Major Axis" value={sizeDims.x} onBlur={this.handleMajorAxisChange} onKeyDown={this.handleMajorAxisChange}/>
                            </td>
                            <td>
                                <NumericInput{...commonProps} buttonPosition="none" placeholder="Semi-Minor Axis" value={sizeDims.y} onBlur={this.handleMinorAxisChange} onKeyDown={this.handleMinorAxisChange}/>
                            </td>
                            <td>
                                <span className="info-string">{wcsStringSize}</span>
                            </td>
                        </tr>
                        <tr>
                            <td>P.A. <span className={Classes.TEXT_MUTED}>(deg)</span></td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="P.A." value={region.rotation} onBlur={this.handleRotationChange} onKeyDown={this.handleRotationChange}/>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}