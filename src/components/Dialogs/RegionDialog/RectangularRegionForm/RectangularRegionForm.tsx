import * as React from "react";
import {observer} from "mobx-react";
import {computed} from "mobx";
import {H5, InputGroup, NumericInput, Classes} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {FrameStore, RegionCoordinate, RegionStore} from "stores";
import {Point2D, WCSPoint2D} from "models";
import {closeTo, formattedArcsec, getFormattedWCSPoint, getPixelValueFromWCS} from "utilities";
import {CoordinateComponent} from "../CoordinateComponent/CoordinateComponent";
import "./RectangularRegionForm.css";

const KEYCODE_ENTER = 13;

@observer
export class RectangularRegionForm extends React.Component<{ region: RegionStore, frame: FrameStore, wcsInfo: number }> {
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

    @computed get centerWCSPoint(): WCSPoint2D {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || !region.controlPoints[0] || !this.props.wcsInfo) {
            return null;
        }
        const centerPoint = region.controlPoints[0];
        return getFormattedWCSPoint(this.props.wcsInfo, centerPoint);
    }

    @computed get topRightWCSPoint(): WCSPoint2D {
        if (!this.topRightPoint || !this.props.wcsInfo) {
            return null;
        }
        return getFormattedWCSPoint(this.props.wcsInfo, this.topRightPoint);
    }

    @computed get bottomLeftWCSPoint(): WCSPoint2D {
        if (!this.bottomLeftPoint || !this.props.wcsInfo) {
            return null;
        }
        return getFormattedWCSPoint(this.props.wcsInfo, this.bottomLeftPoint);
    }

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

        if (isFinite(value) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
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

        if (isFinite(value) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
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

        if (newPoint && isFinite(newPoint.x) && !closeTo(newPoint.x, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
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

        if (newPoint && isFinite(newPoint.y) && !closeTo(newPoint.y, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(0, newPoint);
            return;
        }

        ev.currentTarget.value = wcsString;
    };

    private handleWidthChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
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
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
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

    private handleLeftValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.controlPoints[0];
            const sizeDims = region.controlPoints[1];
            const rightValue = centerPoint.x + sizeDims.x / 2.0;
            const newCenter = {x: (value + rightValue) / 2.0, y: centerPoint.y};
            const newDims = {x: Math.abs(value - rightValue), y: sizeDims.y};
            if (newDims.x > 0 && newDims.y > 0) {
                region.setControlPoints([newCenter, newDims]);
                return true;
            }
        }
        return false;
    };

    private handleLeftChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.bottomLeftPoint.x;
        if (this.handleLeftValueChange(value, existingValue)) {
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleLeftWCSChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.bottomLeftWCSPoint.y});
        const value = newPoint.x;
        const existingValue = this.bottomLeftPoint.x;
        if (this.handleLeftValueChange(value, existingValue)) {
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleBottomValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.controlPoints[0];
            const sizeDims = region.controlPoints[1];
            const topValue = centerPoint.y + sizeDims.y / 2.0;
            const newCenter = {x: centerPoint.x, y: (value + topValue) / 2.0};
            const newDims = {x: sizeDims.x, y: Math.abs(value - topValue)};
            if (newDims.x > 0 && newDims.y > 0) {
                region.setControlPoints([newCenter, newDims]);
                return true;
            }
        }
        return false;
    };

    private handleBottomChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.bottomLeftPoint.y;
        if (this.handleBottomValueChange(value, existingValue)) {
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleBottomWCSChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: this.bottomLeftWCSPoint.x, y: wcsString});
        const value = newPoint.y;
        const existingValue = this.bottomLeftPoint.y;
        if (this.handleBottomValueChange(value, existingValue)) {
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleRightChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
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

    private handleRightWCSChange = (ev) => {
    };

    private handleTopChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
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

    private handleTopWCSChange = (ev) => {
    };

    private handleRotationChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
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

    private getSizeString(size: Point2D) {
        const wcsSize = this.props.frame.getWcsSizeInArcsec(size);
        if (wcsSize) {
            return `${formattedArcsec(wcsSize.x)} \u00D7 ${formattedArcsec(wcsSize.y)}`;
        }
        return null;
    }

    public render() {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || region.regionType !== CARTA.RegionType.RECTANGLE) {
            return null;
        }

        const commonProps = {
            selectAllOnFocus: true,
            allowNumericCharactersOnly: true
        };

        // center
        const centerPoint = region.controlPoints[0];
        const centerWCSPoint = this.centerWCSPoint;
        const centerInputX = region.coordinate === RegionCoordinate.Image ?
            <NumericInput {...commonProps} buttonPosition="none" placeholder="X Coordinate" value={centerPoint.x} onBlur={this.handleCenterXChange} onKeyDown={this.handleCenterXChange}/> :
            <InputGroup className="wcs-input" placeholder="X WCS Coordinate" disabled={!this.props.wcsInfo || !centerWCSPoint} value={centerWCSPoint ? centerWCSPoint.x : ""} onChange={this.handleCenterWCSXChange}/>;
        const centerInputY = region.coordinate === RegionCoordinate.Image ?
            <NumericInput {...commonProps} buttonPosition="none" placeholder="Y Coordinate" value={centerPoint.y} onBlur={this.handleCenterYChange} onKeyDown={this.handleCenterYChange}/> :
            <InputGroup className="wcs-input" placeholder="Y WCS Coordinate" disabled={!this.props.wcsInfo || !centerWCSPoint} value={centerWCSPoint ? centerWCSPoint.y : ""} onChange={this.handleCenterWCSYChange}/>;
        const centerInfoString = region.coordinate === RegionCoordinate.Image ? `WCS: ${WCSPoint2D.ToString(centerWCSPoint)}` : `Image: ${Point2D.ToString(centerPoint, "px", 3)}`;

        // bottom left
        const bottomLeftPoint = this.bottomLeftPoint;
        const bottomLeftWCSPoint = this.bottomLeftWCSPoint;
        const bottomLeftInputX = region.coordinate === RegionCoordinate.Image ?
            <NumericInput {...commonProps} buttonPosition="none" placeholder="X Coordinate" value={bottomLeftPoint.x} onBlur={this.handleLeftChange} onKeyDown={this.handleLeftChange}/> :
            <InputGroup className="wcs-input" placeholder="X WCS Coordinate" disabled={!this.props.wcsInfo || !bottomLeftWCSPoint} value={bottomLeftWCSPoint ? bottomLeftWCSPoint.x : ""} onChange={this.handleLeftWCSChange}/>;
        const bottomLeftInputY = region.coordinate === RegionCoordinate.Image ?
            <NumericInput {...commonProps} buttonPosition="none" placeholder="Y Coordinate" value={bottomLeftPoint.y} onBlur={this.handleBottomChange} onKeyDown={this.handleBottomChange}/> :
            <InputGroup className="wcs-input" placeholder="Y WCS Coordinate" disabled={!this.props.wcsInfo || !bottomLeftWCSPoint} value={bottomLeftWCSPoint ? bottomLeftWCSPoint.y : ""} onChange={this.handleBottomWCSChange}/>;
        const bottomLeftInfoString = region.coordinate === RegionCoordinate.Image ? `WCS: ${WCSPoint2D.ToString(bottomLeftWCSPoint)}` : `Image: ${Point2D.ToString(bottomLeftPoint, "px", 3)}`;

        // top right
        const topRightPoint = this.topRightPoint;
        const topRightWCSPoint = this.topRightWCSPoint;
        const topRightInputX = region.coordinate === RegionCoordinate.Image ?
            <NumericInput {...commonProps} buttonPosition="none" placeholder="X Coordinate" value={topRightPoint.x} onBlur={this.handleRightChange} onKeyDown={this.handleRightChange}/> :
            <InputGroup className="wcs-input" placeholder="X WCS Coordinate" disabled={!this.props.wcsInfo || !topRightWCSPoint} value={topRightWCSPoint ? topRightWCSPoint.x : ""} onChange={this.handleRightWCSChange}/>;
        const topRightInputY = region.coordinate === RegionCoordinate.Image ?
            <NumericInput {...commonProps} buttonPosition="none" placeholder="Y Coordinate" value={topRightPoint.y} onBlur={this.handleTopChange} onKeyDown={this.handleTopChange}/> :
            <InputGroup className="wcs-input" placeholder="Y WCS Coordinate" disabled={!this.props.wcsInfo || !topRightWCSPoint} value={topRightWCSPoint ? topRightWCSPoint.y : ""} onChange={this.handleTopWCSChange}/>;
        const topRightInfoString = region.coordinate === RegionCoordinate.Image ? `WCS: ${WCSPoint2D.ToString(topRightWCSPoint)}` : `Image: ${Point2D.ToString(topRightPoint, "px", 3)}`;

        // size
        const sizeDims = region.controlPoints[1];
        const wcsStringSize = this.getSizeString(sizeDims);

        const pxUnitSpan = region.coordinate === RegionCoordinate.Image ? <span className={Classes.TEXT_MUTED}>(px)</span> : "";
        const isRotated = Math.abs(region.rotation) > 1e-3;
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
                            <td>Coordinate</td>
                            <td colSpan={2}><CoordinateComponent region={region}/></td>
                        </tr>
                        <tr>
                            <td>Center {pxUnitSpan}</td>
                            <td>{centerInputX}</td>
                            <td>{centerInputY}</td>
                            <td><span className="info-string">{centerInfoString}</span></td>
                        </tr>
                        <tr>
                            <td>Size {<span className={Classes.TEXT_MUTED}>(px)</span>}</td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="Width" value={sizeDims.x} onBlur={this.handleWidthChange} onKeyDown={this.handleWidthChange}/>
                            </td>
                            <td>
                                <NumericInput{...commonProps} buttonPosition="none" placeholder="Height" value={sizeDims.y} onBlur={this.handleHeightChange} onKeyDown={this.handleHeightChange}/>
                            </td>
                            <td>
                                <span className="info-string">{wcsStringSize}</span>
                            </td>
                        </tr>
                        <tr>
                            <td>Bottom Left {pxUnitSpan}</td>
                            <td>{bottomLeftInputX}</td>
                            <td>{bottomLeftInputY}</td>
                            <td><span className="info-string">{bottomLeftInfoString}</span></td>
                        </tr>
                        <tr>
                            <td>Top Right {pxUnitSpan}</td>
                            <td>{topRightInputX}</td>
                            <td>{topRightInputY}</td>
                            <td><span className="info-string">{topRightInfoString}</span></td>
                        </tr>
                        <tr>
                            <td>Bottom Left {<span className={Classes.TEXT_MUTED}>(px)</span>}</td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="X Coordinate" value={bottomLeftPoint.x} onBlur={this.handleLeftChange} onKeyDown={this.handleLeftChange} disabled={isRotated}/>
                            </td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="Y Coordinate" value={bottomLeftPoint.y} onBlur={this.handleBottomChange} onKeyDown={this.handleBottomChange} disabled={isRotated}/>
                            </td>
                            <td><span className="info-string">{WCSPoint2D.ToString(this.bottomLeftWCSPoint)}</span></td>
                        </tr>
                        <tr>
                            <td>Top Right {<span className={Classes.TEXT_MUTED}>(px)</span>}</td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="X Coordinate" value={topRightPoint.x} onBlur={this.handleRightChange} onKeyDown={this.handleRightChange} disabled={isRotated}/>
                            </td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="Y Coordinate" value={topRightPoint.y} onBlur={this.handleTopChange} onKeyDown={this.handleTopChange} disabled={isRotated}/>
                            </td>
                            <td><span className="info-string">{WCSPoint2D.ToString(this.topRightWCSPoint)}</span></td>
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