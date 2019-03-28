import * as React from "react";
import * as AST from "ast_wrapper";
import {observer} from "mobx-react";
import {computed, observable} from "mobx";
import {H5, InputGroup, NumericInput, Classes} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {RegionStore} from "stores";
import {Point2D} from "models";
import {closeTo} from "utilities";
import "./RectangularRegionForm.css";

@observer
export class RectangularRegionForm extends React.Component<{ region: RegionStore, wcsInfo: number }> {
    @observable displayColorPicker: boolean;

    @computed get topRightPoint(): Point2D {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2) {
            return {x: NaN, y: NaN};
        }

        const centerPoint = region.controlPoints[0];
        const sizeDims = region.controlPoints[1];
        return {x: centerPoint.x + sizeDims.x / 2.0, y: centerPoint.y + sizeDims.y / 2.0};
    }

    @computed get bottomLeftPoint(): Point2D {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2) {
            return {x: NaN, y: NaN};
        }

        const centerPoint = region.controlPoints[0];
        const sizeDims = region.controlPoints[1];
        return {x: centerPoint.x - sizeDims.x / 2.0, y: centerPoint.y - sizeDims.y / 2.0};
    }

    private static readonly REGION_PIXEL_EPS = 1.0e-3;

    private handleNameChange = (ev) => {
        this.props.region.setName(ev.currentTarget.value);
    };

    private handleCenterXChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.controlPoints[0].x;

        if (isFinite(value) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(0, {x: value, y: this.props.region.controlPoints[0].y});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleCenterYChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.controlPoints[0].y;

        if (isFinite(value) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(0, {x: this.props.region.controlPoints[0].x, y: value});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleWidthChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.controlPoints[1].x;

        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(1, {x: value, y: this.props.region.controlPoints[1].y});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleHeightChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.controlPoints[1].y;

        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(1, {x: this.props.region.controlPoints[1].x, y: value});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleLeftChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.bottomLeftPoint.x;

        if (isFinite(value) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.controlPoints[0];
            const sizeDims = region.controlPoints[1];
            const rightValue = centerPoint.x + sizeDims.x / 2.0;
            const newCenter = {x: (value + rightValue) / 2.0, y: centerPoint.y};
            const newDims = {x: Math.abs(value - rightValue), y: sizeDims.y};
            if (newDims.x > 0 && newDims.y > 0) {
                region.setControlPoints([newCenter, newDims]);
                return;
            }
        }

        ev.currentTarget.value = existingValue;
    };

    private handleBottomChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.bottomLeftPoint.y;

        if (isFinite(value) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.controlPoints[0];
            const sizeDims = region.controlPoints[1];
            const topValue = centerPoint.y + sizeDims.y / 2.0;
            const newCenter = {x: centerPoint.x, y: (value + topValue) / 2.0};
            const newDims = {x: sizeDims.x, y: Math.abs(value - topValue)};
            if (newDims.x > 0 && newDims.y > 0) {
                region.setControlPoints([newCenter, newDims]);
                return;
            }
        }

        ev.currentTarget.value = existingValue;
    };

    private handleRightChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.topRightPoint.x;

        if (isFinite(value) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.controlPoints[0];
            const sizeDims = region.controlPoints[1];
            const leftValue = centerPoint.x - sizeDims.x / 2.0;
            const newCenter = {x: (value + leftValue) / 2.0, y: centerPoint.y};
            const newDims = {x: Math.abs(value - leftValue), y: sizeDims.y};
            if (newDims.x > 0 && newDims.y > 0) {
                region.setControlPoints([newCenter, newDims]);
                return;
            }
        }

        ev.currentTarget.value = existingValue;
    };

    private handleTopChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.topRightPoint.y;

        if (isFinite(value) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.controlPoints[0];
            const sizeDims = region.controlPoints[1];
            const bottomValue = centerPoint.y - sizeDims.y / 2.0;
            const newCenter = {x: centerPoint.x, y: (value + bottomValue) / 2.0};
            const newDims = {x: sizeDims.x, y: Math.abs(value - bottomValue)};
            if (newDims.x > 0 && newDims.y > 0) {
                region.setControlPoints([newCenter, newDims]);
                return;
            }
        }

        ev.currentTarget.value = existingValue;
    };

    private handleRotationChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.rotation;

        if (isFinite(value) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setRotation(value);
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private getFormattedString(wcsInfo: number, pixelCoords: Point2D) {
        if (wcsInfo) {
            const pointWCS = AST.pixToWCS(this.props.wcsInfo, pixelCoords.x, pixelCoords.y);
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
            const centerWCS = AST.pixToWCS(this.props.wcsInfo, centerPixel.x, centerPixel.y);
            const horizontalEdgeWCS = AST.pixToWCS(this.props.wcsInfo, cornerPixel.x, centerPixel.y);
            const verticalEdgeWCS = AST.pixToWCS(this.props.wcsInfo, centerPixel.x, cornerPixel.y);
            const hDist = Math.abs(2 * AST.axDistance(this.props.wcsInfo, 1, centerWCS.x, horizontalEdgeWCS.x));
            const vDist = Math.abs(2 * AST.axDistance(this.props.wcsInfo, 2, centerWCS.y, verticalEdgeWCS.y));
            const wcsDistStrings = AST.getFormattedCoordinates(this.props.wcsInfo, hDist, vDist, "Format(1)=m.5, Format(2)=m.5", true);
            return `${wcsDistStrings.x}' \u00D7 ${wcsDistStrings.y}'`;
        }
        return null;
    }

    public render() {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || region.regionType !== CARTA.RegionType.RECTANGLE) {
            return null;
        }

        const centerPoint = region.controlPoints[0];
        const sizeDims = region.controlPoints[1];
        const bottomLeftPoint = this.bottomLeftPoint;
        const topRightPoint = this.topRightPoint;
        const wcsStringCenter = this.getFormattedString(this.props.wcsInfo, centerPoint);
        const wcsStringLeft = this.getFormattedString(this.props.wcsInfo, bottomLeftPoint);
        const wcsStringRight = this.getFormattedString(this.props.wcsInfo, topRightPoint);
        const wcsStringSize = this.getSizeString(this.props.wcsInfo, centerPoint, topRightPoint);

        const commonProps = {
            selectAllOnFocus: true,
            allowNumericCharactersOnly: true
        };

        const isRotated = Math.abs(region.rotation) > 1e-3;

        const pxUnitSpan = <span className={Classes.TEXT_MUTED}>(px)</span>;
        return (
            <div className="form-section rectangular-region-form">
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
                            <td>Size {pxUnitSpan}</td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="Width" value={sizeDims.x} onBlur={this.handleWidthChange} onKeyDown={this.handleWidthChange}/>
                            </td>
                            <td>
                                <NumericInput{...commonProps} buttonPosition="none" placeholder="Height" value={sizeDims.y} onBlur={this.handleHeightChange} onKeyDown={this.handleHeightChange}/>
                            </td>
                            <td>
                                <span className="wcs-string">{wcsStringSize}</span>
                            </td>
                        </tr>
                        <tr>
                            <td>Bottom Left {pxUnitSpan}</td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="X Coordinate" value={bottomLeftPoint.x} onBlur={this.handleLeftChange} onKeyDown={this.handleLeftChange} disabled={isRotated}/>
                            </td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="Y Coordinate" value={bottomLeftPoint.y} onBlur={this.handleBottomChange} onKeyDown={this.handleBottomChange} disabled={isRotated}/>
                            </td>
                            <td><span className="wcs-string">{wcsStringLeft}</span></td>
                        </tr>
                        <tr>
                            <td>Top Right {pxUnitSpan}</td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="X Coordinate" value={topRightPoint.x} onBlur={this.handleRightChange} onKeyDown={this.handleRightChange} disabled={isRotated}/>
                            </td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="Y Coordinate" value={topRightPoint.y} onBlur={this.handleTopChange} onKeyDown={this.handleTopChange} disabled={isRotated}/>
                            </td>
                            <td><span className="wcs-string">{wcsStringRight}</span></td>
                        </tr>
                        <tr>
                            <td>Rotation <span className={Classes.TEXT_MUTED}>(deg)</span></td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="Rotation" value={region.rotation} onBlur={this.handleRotationChange} onKeyDown={this.handleRotationChange}/>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}