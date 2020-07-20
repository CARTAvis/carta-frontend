import * as React from "react";
import {observer} from "mobx-react";
import {computed} from "mobx";
import {H5, InputGroup, NumericInput, Classes} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {FrameStore, RegionCoordinate, RegionStore} from "stores";
import {Point2D, WCSPoint2D} from "models";
import {closeTo, formattedArcsec, getFormattedWCSPoint, getPixelValueFromWCS, getValueFromArcsecString, WCS_REGEXP} from "utilities";
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
        if (wcsString === this.centerWCSPoint.x) {
            return;
        }
        if (WCS_REGEXP.test(wcsString)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.centerWCSPoint.y});
            const existingValue = this.props.region.controlPoints[0].x;
            if (newPoint && isFinite(newPoint.x) && !closeTo(newPoint.x, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
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
            if (newPoint && isFinite(newPoint.y) && !closeTo(newPoint.y, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setControlPoint(0, newPoint);
                return;
            }
        }

        ev.currentTarget.value = this.centerWCSPoint.y;
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

    private handleWidthWCSChange = (ev) => {
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
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(1, {x: value, y: this.props.region.controlPoints[1].y});
            return;
        }

        ev.currentTarget.value = this.sizeWCS.x;
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

    private handleHeightWCSChange = (ev) => {
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
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setControlPoint(1, {x: this.props.region.controlPoints[1].x, y: value});
            return;
        }

        ev.currentTarget.value = this.sizeWCS.y;
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
        if (wcsString === this.bottomLeftWCSPoint.x) {
            return;
        }
        if (WCS_REGEXP.test(wcsString)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.bottomLeftWCSPoint.y});
            const value = newPoint.x;
            const existingValue = this.bottomLeftPoint.x;
            if (this.handleLeftValueChange(value, existingValue)) {
                return;
            }
        }

        ev.currentTarget.value = this.bottomLeftWCSPoint.x;
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
        if (wcsString === this.bottomLeftWCSPoint.y) {
            return;
        }
        if (WCS_REGEXP.test(wcsString)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: this.bottomLeftWCSPoint.x, y: wcsString});
            const value = newPoint.y;
            const existingValue = this.bottomLeftPoint.y;
            if (this.handleBottomValueChange(value, existingValue)) {
                return;
            }
        }

        ev.currentTarget.value = this.bottomLeftWCSPoint.y;
    };

    private handleRightValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.controlPoints[0];
            const sizeDims = region.controlPoints[1];
            const leftValue = centerPoint.x - sizeDims.x / 2.0;
            const newCenter = {x: (value + leftValue) / 2.0, y: centerPoint.y};
            const newDims = {x: Math.abs(value - leftValue), y: sizeDims.y};
            if (newDims.x > 0 && newDims.y > 0) {
                region.setControlPoints([newCenter, newDims]);
                return true;
            }
        }
        return false;
    };

    private handleRightChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.topRightPoint.x;
        if (this.handleRightValueChange(value, existingValue)) {
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleRightWCSChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === this.topRightWCSPoint.x) {
            return;
        }
        if (WCS_REGEXP.test(wcsString)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.topRightWCSPoint.y});
            const value = newPoint.x;
            const existingValue = this.topRightPoint.x;
            if (this.handleRightValueChange(value, existingValue)) {
                return;
            }
        }

        ev.currentTarget.value = this.topRightWCSPoint.x;
    };

    private handleTopValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.controlPoints[0];
            const sizeDims = region.controlPoints[1];
            const bottomValue = centerPoint.y - sizeDims.y / 2.0;
            const newCenter = {x: centerPoint.x, y: (value + bottomValue) / 2.0};
            const newDims = {x: sizeDims.x, y: Math.abs(value - bottomValue)};
            if (newDims.x > 0 && newDims.y > 0) {
                region.setControlPoints([newCenter, newDims]);
                return true;
            }
        }
        return false;
    };

    private handleTopChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.topRightPoint.y;
        if (this.handleTopValueChange(value, existingValue)) {
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleTopWCSChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === this.topRightWCSPoint.y) {
            return;
        }
        if (WCS_REGEXP.test(wcsString)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: this.topRightWCSPoint.x, y: wcsString});
            const value = newPoint.y;
            const existingValue = this.topRightPoint.y;
            if (this.handleTopValueChange(value, existingValue)) {
                return;
            }
        }

        ev.currentTarget.value = this.topRightWCSPoint.y;
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

    public render() {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || region.regionType !== CARTA.RegionType.RECTANGLE) {
            return null;
        }

        // center
        const centerPoint = region.controlPoints[0];
        let centerInputX, centerInputY;
        if (region.coordinate === RegionCoordinate.Image) {
            centerInputX = <NumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="X Coordinate" value={centerPoint.x} onBlur={this.handleCenterXChange} onKeyDown={this.handleCenterXChange}/>;
            centerInputY = <NumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Y Coordinate" value={centerPoint.y} onBlur={this.handleCenterYChange} onKeyDown={this.handleCenterYChange}/>;
        } else {
            centerInputX = (
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
            centerInputY = (
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
        const centerInfoString = region.coordinate === RegionCoordinate.Image ? `WCS: ${WCSPoint2D.ToString(this.centerWCSPoint)}` : `Image: ${Point2D.ToString(centerPoint, "px", 3)}`;

        const isRotated = Math.abs(region.rotation) > 1e-3;
        // bottom left
        let bottomLeftInputX, bottomLeftInputY;
        if (region.coordinate === RegionCoordinate.Image) {
            bottomLeftInputX = <NumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="X Coordinate" value={this.bottomLeftPoint.x} onBlur={this.handleLeftChange} onKeyDown={this.handleLeftChange} disabled={isRotated}/>;
            bottomLeftInputY = (
                <NumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Y Coordinate" value={this.bottomLeftPoint.y} onBlur={this.handleBottomChange} onKeyDown={this.handleBottomChange} disabled={isRotated}/>
            );
        } else {
            bottomLeftInputX = (
                <NumericInput
                    allowNumericCharactersOnly={false}
                    buttonPosition="none"
                    placeholder="X WCS Coordinate"
                    disabled={!this.props.wcsInfo || !this.bottomLeftWCSPoint || isRotated}
                    value={this.bottomLeftWCSPoint ? this.bottomLeftWCSPoint.x : ""}
                    onBlur={this.handleLeftWCSChange}
                    onKeyDown={this.handleLeftWCSChange}
                />
            );
            bottomLeftInputY = (
                <NumericInput
                    allowNumericCharactersOnly={false}
                    buttonPosition="none"
                    placeholder="Y WCS Coordinate"
                    disabled={!this.props.wcsInfo || !this.bottomLeftWCSPoint || isRotated}
                    value={this.bottomLeftWCSPoint ? this.bottomLeftWCSPoint.y : ""}
                    onBlur={this.handleBottomWCSChange}
                    onKeyDown={this.handleBottomWCSChange}
                />
            );
        }
        const bottomLeftInfoString = region.coordinate === RegionCoordinate.Image ? `WCS: ${WCSPoint2D.ToString(this.bottomLeftWCSPoint)}` : `Image: ${Point2D.ToString(this.bottomLeftPoint, "px", 3)}`;

        // top right
        let topRightInputX, topRightInputY;
        if (region.coordinate === RegionCoordinate.Image) {
            topRightInputX = <NumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="X Coordinate" value={this.topRightPoint.x} onBlur={this.handleRightChange} onKeyDown={this.handleRightChange} disabled={isRotated}/>;
            topRightInputY = <NumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Y Coordinate" value={this.topRightPoint.y} onBlur={this.handleTopChange} onKeyDown={this.handleTopChange} disabled={isRotated}/>;
        } else {
            topRightInputX = (
                <NumericInput
                    allowNumericCharactersOnly={false}
                    buttonPosition="none"
                    placeholder="X WCS Coordinate"
                    disabled={!this.props.wcsInfo || !this.topRightWCSPoint || isRotated}
                    value={this.topRightWCSPoint ? this.topRightWCSPoint.x : ""}
                    onBlur={this.handleRightWCSChange}
                    onKeyDown={this.handleRightWCSChange}
                />
            );
            topRightInputY = (
                <NumericInput
                    allowNumericCharactersOnly={false}
                    buttonPosition="none"
                    placeholder="Y WCS Coordinate"
                    disabled={!this.props.wcsInfo || !this.topRightWCSPoint || isRotated}
                    value={this.topRightWCSPoint ? this.topRightWCSPoint.y : ""}
                    onBlur={this.handleTopWCSChange}
                    onKeyDown={this.handleTopWCSChange}
                />
            );
        }
        const topRightInfoString = region.coordinate === RegionCoordinate.Image ? `WCS: ${WCSPoint2D.ToString(this.topRightWCSPoint)}` : `Image: ${Point2D.ToString(this.topRightPoint, "px", 3)}`;

        // size
        const size = region.controlPoints[1];
        let sizeWidthInput, sizeHeightInput;
        if (region.coordinate === RegionCoordinate.Image) {
            sizeWidthInput = <NumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Width" value={size.x} onBlur={this.handleWidthChange} onKeyDown={this.handleWidthChange}/>;
            sizeHeightInput = <NumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Height" value={size.y} onBlur={this.handleHeightChange} onKeyDown={this.handleHeightChange}/>;
        } else {
            sizeWidthInput = (
                <NumericInput
                    allowNumericCharactersOnly={false}
                    buttonPosition="none"
                    placeholder="Width"
                    disabled={!this.props.wcsInfo}
                    value={this.sizeWCS ? this.sizeWCS.x : ""}
                    onBlur={this.handleWidthWCSChange}
                    onKeyDown={this.handleWidthWCSChange}
                />
            );
            sizeHeightInput = (
                <NumericInput
                    allowNumericCharactersOnly={false}
                    buttonPosition="none"
                    placeholder="Height"
                    disabled={!this.props.wcsInfo}
                    value={this.sizeWCS ? this.sizeWCS.y : ""}
                    onBlur={this.handleHeightWCSChange}
                    onKeyDown={this.handleHeightWCSChange}
                />
            );
        }
        const sizeInfoString = region.coordinate === RegionCoordinate.Image ? `WCS: ${WCSPoint2D.ToString(this.sizeWCS)}` : `Image: ${Point2D.ToString(size, "px", 3)}`;

        const pxUnitSpan = region.coordinate === RegionCoordinate.Image ? <span className={Classes.TEXT_MUTED}>(px)</span> : "";
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
                            <td colSpan={2}><CoordinateComponent region={region} disableCooridnate={!this.props.wcsInfo}/></td>
                        </tr>
                        <tr>
                            <td>Center {pxUnitSpan}</td>
                            <td>{centerInputX}</td>
                            <td>{centerInputY}</td>
                            <td><span className="info-string">{centerInfoString}</span></td>
                        </tr>
                        <tr>
                            <td>Size {pxUnitSpan}</td>
                            <td>{sizeWidthInput}</td>
                            <td>{sizeHeightInput}</td>
                            <td><span className="info-string">{sizeInfoString}</span></td>
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