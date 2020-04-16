import * as React from "react";
import * as AST from "ast_wrapper";
import {observer} from "mobx-react";
import {H5, InputGroup, NumericInput, Classes} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {RegionStore} from "stores";
import {Point2D} from "models";
import {closeTo} from "utilities";
import "./EllipticalRegionForm.css";

const KEYCODE_ENTER = 13;

@observer
export class EllipticalRegionForm extends React.Component<{ region: RegionStore, wcsInfo: number }> {
    private static readonly REGION_PIXEL_EPS = 1.0e-3;

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

    private handleMajorAxisChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const semiValue = parseFloat(valueString) / 2;
        const existingValue = this.props.region.controlPoints[1].x;

        if (isFinite(semiValue) && semiValue > 0 && !closeTo(semiValue, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(1, {x: semiValue, y: this.props.region.controlPoints[1].y});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleMinorAxisChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const semiValue = parseFloat(valueString) / 2;
        const existingValue = this.props.region.controlPoints[1].y;

        if (isFinite(semiValue) && semiValue > 0 && !closeTo(semiValue, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(1, {x: this.props.region.controlPoints[1].x, y: semiValue});
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

    private getFormattedString(wcsInfo: number, pixelCoords: Point2D) {
        if (wcsInfo) {
            const pointWCS = AST.transformPoint(this.props.wcsInfo, pixelCoords.x, pixelCoords.y);
            const normVals = AST.normalizeCoordinates(this.props.wcsInfo, pointWCS.x, pointWCS.y);
            const wcsCoords = AST.getFormattedCoordinates(this.props.wcsInfo, normVals.x, normVals.y);
            if (wcsCoords) {
                return `WCS: (${wcsCoords.x}, ${wcsCoords.y})`;
            }
        }
        return null;
    }

    private getSizeString(wcsInfo: number, centerPixel: Point2D, cornerPixel: Point2D) {
        if (wcsInfo) {
            const centerWCS = AST.transformPoint(this.props.wcsInfo, centerPixel.x, centerPixel.y);
            const horizontalEdgeWCS = AST.transformPoint(this.props.wcsInfo, cornerPixel.x, centerPixel.y);
            const verticalEdgeWCS = AST.transformPoint(this.props.wcsInfo, centerPixel.x, cornerPixel.y);
            const hDist = Math.abs(AST.axDistance(this.props.wcsInfo, 1, centerWCS.x, horizontalEdgeWCS.x));
            const vDist = Math.abs(AST.axDistance(this.props.wcsInfo, 2, centerWCS.y, verticalEdgeWCS.y));
            const wcsDistStrings = AST.getFormattedCoordinates(this.props.wcsInfo, hDist, vDist, "Format(1)=m.5, Format(2)=m.5", true);
            return `maj: ${wcsDistStrings.y}; min: ${wcsDistStrings.x}'`;
        }
        return null;
    }

    public render() {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || region.regionType !== CARTA.RegionType.ELLIPSE) {
            return null;
        }

        const centerPoint = region.controlPoints[0];
        const sizeDims = region.controlPoints[1];
        // CRTF uses north/south for major axis
        const topRightPoint = {x: centerPoint.x + sizeDims.y, y: centerPoint.y + sizeDims.x};
        const wcsStringCenter = this.getFormattedString(this.props.wcsInfo, centerPoint);
        const wcsStringSize = this.getSizeString(this.props.wcsInfo, centerPoint, topRightPoint);

        const commonProps = {
            selectAllOnFocus: true,
            allowNumericCharactersOnly: true
        };

        const pxUnitSpan = <span className={Classes.TEXT_MUTED}>(px)</span>;
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
                            <td>Center {pxUnitSpan}</td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="X Coordinate" value={centerPoint.x} onBlur={this.handleCenterXChange} onKeyDown={this.handleCenterXChange}/>
                            </td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="Y Coordinate" value={centerPoint.y} onBlur={this.handleCenterYChange} onKeyDown={this.handleCenterYChange}/>
                            </td>
                            <td>
                                <span className="wcs-string">{wcsStringCenter}</span>
                            </td>
                        </tr>
                        <tr>
                            <td>Axes {pxUnitSpan}</td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="Major Axis" value={sizeDims.x * 2} onBlur={this.handleMajorAxisChange} onKeyDown={this.handleMajorAxisChange}/>
                            </td>
                            <td>
                                <NumericInput{...commonProps} buttonPosition="none" placeholder="Minor Axis" value={sizeDims.y * 2} onBlur={this.handleMinorAxisChange} onKeyDown={this.handleMinorAxisChange}/>
                            </td>
                            <td>
                                <span className="wcs-string">{wcsStringSize}</span>
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