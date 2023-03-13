import * as React from "react";
import {Classes, H5, InputGroup, Position} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {computed} from "mobx";
import {observer} from "mobx-react";

import {CoordinateComponent, SafeNumericInput} from "components/Shared";
import {Point2D, WCSPoint2D} from "models";
import {AppStore, NUMBER_FORMAT_LABEL} from "stores";
import {CoordinateMode, FrameStore, RegionStore, WCS_PRECISION} from "stores/Frame";
import {closeTo, formattedArcsec, getFormattedWCSPoint, getPixelValueFromWCS, getValueFromArcsecString, isWCSStringFormatValid} from "utilities";

import "./RectangularRegionForm.scss";

const KEYCODE_ENTER = 13;

@observer
export class RectangularRegionForm extends React.Component<{region: RegionStore; frame: FrameStore; wcsInfo: AST.FrameSet}> {
    @computed get topRightPoint(): Point2D {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2) {
            return {x: NaN, y: NaN};
        }

        const centerPoint = region.center;
        const sizeDims = region.size;
        return {x: centerPoint.x + sizeDims.x / 2.0, y: centerPoint.y + sizeDims.y / 2.0};
    }

    @computed get bottomLeftPoint(): Point2D {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2) {
            return {x: NaN, y: NaN};
        }

        const centerPoint = region.center;
        const sizeDims = region.size;
        return {x: centerPoint.x - sizeDims.x / 2.0, y: centerPoint.y - sizeDims.y / 2.0};
    }

    // size determined by reference frame
    @computed get sizeWCS(): WCSPoint2D {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || !region.size || !this.props.frame) {
            return null;
        }
        const size = this.props.region.size;
        const wcsSize = this.props.frame.getWcsSizeInArcsec(size);
        if (wcsSize) {
            return {x: formattedArcsec(wcsSize.x, WCS_PRECISION), y: formattedArcsec(wcsSize.y, WCS_PRECISION)};
        }
        return null;
    }

    private static readonly REGION_PIXEL_EPS = 1.0e-3;

    private handleNameChange = ev => {
        this.props.region.setName(ev.currentTarget.value);
    };

    private handleCenterXChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.center.x;

        if (isFinite(value) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setCenter({x: value, y: this.props.region.center.y});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleCenterYChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.center.y;

        if (isFinite(value) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setCenter({x: this.props.region.center.x, y: value});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleCenterWCSXChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const centerWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.props.region.center);
        if (!centerWCSPoint) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === centerWCSPoint.x) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: centerWCSPoint.y});
            const existingValue = this.props.region.center.x;
            if (newPoint && isFinite(newPoint.x) && !closeTo(newPoint.x, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setCenter(newPoint);
                return;
            }
        }

        ev.currentTarget.value = centerWCSPoint.x;
    };

    private handleCenterWCSYChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const centerWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.props.region.center);
        if (!centerWCSPoint) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === centerWCSPoint.y) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: centerWCSPoint.x, y: wcsString});
            const existingValue = this.props.region.center.y;
            if (newPoint && isFinite(newPoint.y) && !closeTo(newPoint.y, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setCenter(newPoint);
                return;
            }
        }

        ev.currentTarget.value = centerWCSPoint.y;
    };

    private handleWidthChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.size.x;

        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: value, y: this.props.region.size.y});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleWidthWCSChange = ev => {
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
        const value = this.props.frame.getImageXValueFromArcsec(getValueFromArcsecString(wcsString));
        const existingValue = this.props.region.size.x;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: value, y: this.props.region.size.y});
            return;
        }

        ev.currentTarget.value = this.sizeWCS.x;
    };

    private handleHeightChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.size.y;

        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: this.props.region.size.x, y: value});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleHeightWCSChange = ev => {
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
        const value = this.props.frame.getImageYValueFromArcsec(getValueFromArcsecString(wcsString));
        const existingValue = this.props.region.size.y;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: this.props.region.size.x, y: value});
            return;
        }

        ev.currentTarget.value = this.sizeWCS.y;
    };

    private handleLeftValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.center;
            const sizeDims = region.size;
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

    private handleLeftChange = ev => {
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

    private handleLeftWCSChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const bottomLeftWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.bottomLeftPoint);
        const wcsString = ev.currentTarget.value;
        if (wcsString === bottomLeftWCSPoint.x) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: bottomLeftWCSPoint.y});
            const value = newPoint.x;
            const existingValue = this.bottomLeftPoint.x;
            if (this.handleLeftValueChange(value, existingValue)) {
                return;
            }
        }

        ev.currentTarget.value = bottomLeftWCSPoint.x;
    };

    private handleBottomValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.center;
            const sizeDims = region.size;
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

    private handleBottomChange = ev => {
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

    private handleBottomWCSChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const bottomLeftWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.bottomLeftPoint);
        const wcsString = ev.currentTarget.value;
        if (wcsString === bottomLeftWCSPoint.y) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: bottomLeftWCSPoint.x, y: wcsString});
            const value = newPoint.y;
            const existingValue = this.bottomLeftPoint.y;
            if (this.handleBottomValueChange(value, existingValue)) {
                return;
            }
        }

        ev.currentTarget.value = bottomLeftWCSPoint.y;
    };

    private handleRightValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.center;
            const sizeDims = region.size;
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

    private handleRightChange = ev => {
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

    private handleRightWCSChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const topRightWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.topRightPoint);
        const wcsString = ev.currentTarget.value;
        if (wcsString === topRightWCSPoint.x) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: topRightWCSPoint.y});
            const value = newPoint.x;
            const existingValue = this.topRightPoint.x;
            if (this.handleRightValueChange(value, existingValue)) {
                return;
            }
        }

        ev.currentTarget.value = topRightWCSPoint.x;
    };

    private handleTopValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.center;
            const sizeDims = region.size;
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

    private handleTopChange = ev => {
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

    private handleTopWCSChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const topRightWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.topRightPoint);
        const wcsString = ev.currentTarget.value;
        if (wcsString === topRightWCSPoint.y) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: topRightWCSPoint.x, y: wcsString});
            const value = newPoint.y;
            const existingValue = this.topRightPoint.y;
            if (this.handleTopValueChange(value, existingValue)) {
                return;
            }
        }

        ev.currentTarget.value = topRightWCSPoint.y;
    };

    private handleRotationChange = ev => {
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
        // dummy variables related to wcs to trigger re-render
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const system = AppStore.Instance.overlayStore.global.explicitSystem;
        const formatX = AppStore.Instance.overlayStore.numbers.formatTypeX;
        const formatY = AppStore.Instance.overlayStore.numbers.formatTypeY;
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || region.regionType !== CARTA.RegionType.RECTANGLE) {
            return null;
        }

        // center
        const centerPoint = region.center;
        const centerWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, centerPoint);
        let centerInputX, centerInputY;
        if (region.coordinate === CoordinateMode.Image) {
            centerInputX = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="X coordinate" value={centerPoint.x} onBlur={this.handleCenterXChange} onKeyDown={this.handleCenterXChange} />;
            centerInputY = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Y coordinate" value={centerPoint.y} onBlur={this.handleCenterYChange} onKeyDown={this.handleCenterYChange} />;
        } else {
            centerInputX = (
                <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatX)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="X WCS coordinate"
                        disabled={!this.props.wcsInfo || !centerWCSPoint}
                        value={centerWCSPoint ? centerWCSPoint.x : ""}
                        onBlur={this.handleCenterWCSXChange}
                        onKeyDown={this.handleCenterWCSXChange}
                    />
                </Tooltip2>
            );
            centerInputY = (
                <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatY)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="Y WCS coordinate"
                        disabled={!this.props.wcsInfo || !centerWCSPoint}
                        value={centerWCSPoint ? centerWCSPoint.y : ""}
                        onBlur={this.handleCenterWCSYChange}
                        onKeyDown={this.handleCenterWCSYChange}
                    />
                </Tooltip2>
            );
        }
        const centerInfoString = region.coordinate === CoordinateMode.Image ? `WCS: ${WCSPoint2D.ToString(centerWCSPoint)}` : `Image: ${Point2D.ToString(centerPoint, "px", 3)}`;

        const isRotated = Math.abs(region.rotation) > 1e-3;
        // bottom left
        const bottomLeftWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.bottomLeftPoint);
        let bottomLeftInputX, bottomLeftInputY;
        if (region.coordinate === CoordinateMode.Image) {
            bottomLeftInputX = (
                <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="X coordinate" value={this.bottomLeftPoint.x} onBlur={this.handleLeftChange} onKeyDown={this.handleLeftChange} disabled={isRotated} />
            );
            bottomLeftInputY = (
                <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Y coordinate" value={this.bottomLeftPoint.y} onBlur={this.handleBottomChange} onKeyDown={this.handleBottomChange} disabled={isRotated} />
            );
        } else {
            bottomLeftInputX = (
                <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatX)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="X WCS coordinate"
                        disabled={!this.props.wcsInfo || !bottomLeftWCSPoint || isRotated}
                        value={bottomLeftWCSPoint ? bottomLeftWCSPoint.x : ""}
                        onBlur={this.handleLeftWCSChange}
                        onKeyDown={this.handleLeftWCSChange}
                    />
                </Tooltip2>
            );
            bottomLeftInputY = (
                <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatY)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="Y WCS coordinate"
                        disabled={!this.props.wcsInfo || !bottomLeftWCSPoint || isRotated}
                        value={bottomLeftWCSPoint ? bottomLeftWCSPoint.y : ""}
                        onBlur={this.handleBottomWCSChange}
                        onKeyDown={this.handleBottomWCSChange}
                    />
                </Tooltip2>
            );
        }
        const bottomLeftInfoString = region.coordinate === CoordinateMode.Image ? `WCS: ${WCSPoint2D.ToString(bottomLeftWCSPoint)}` : `Image: ${Point2D.ToString(this.bottomLeftPoint, "px", 3)}`;

        // top right
        const topRightWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.topRightPoint);
        let topRightInputX, topRightInputY;
        if (region.coordinate === CoordinateMode.Image) {
            topRightInputX = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="X coordinate" value={this.topRightPoint.x} onBlur={this.handleRightChange} onKeyDown={this.handleRightChange} disabled={isRotated} />;
            topRightInputY = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Y coordinate" value={this.topRightPoint.y} onBlur={this.handleTopChange} onKeyDown={this.handleTopChange} disabled={isRotated} />;
        } else {
            topRightInputX = (
                <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatX)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="X WCS coordinate"
                        disabled={!this.props.wcsInfo || !topRightWCSPoint || isRotated}
                        value={topRightWCSPoint ? topRightWCSPoint.x : ""}
                        onBlur={this.handleRightWCSChange}
                        onKeyDown={this.handleRightWCSChange}
                    />
                </Tooltip2>
            );
            topRightInputY = (
                <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatY)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="Y WCS coordinate"
                        disabled={!this.props.wcsInfo || !topRightWCSPoint || isRotated}
                        value={topRightWCSPoint ? topRightWCSPoint.y : ""}
                        onBlur={this.handleTopWCSChange}
                        onKeyDown={this.handleTopWCSChange}
                    />
                </Tooltip2>
            );
        }
        const topRightInfoString = region.coordinate === CoordinateMode.Image ? `WCS: ${WCSPoint2D.ToString(topRightWCSPoint)}` : `Image: ${Point2D.ToString(this.topRightPoint, "px", 3)}`;

        // size
        const size = region.size;
        let sizeWidthInput, sizeHeightInput;
        if (region.coordinate === CoordinateMode.Image) {
            sizeWidthInput = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Width" value={size.x} onBlur={this.handleWidthChange} onKeyDown={this.handleWidthChange} />;
            sizeHeightInput = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Height" value={size.y} onBlur={this.handleHeightChange} onKeyDown={this.handleHeightChange} />;
        } else {
            sizeWidthInput = (
                <Tooltip2 content={"Format: arcsec(\"), arcmin('), or degrees(deg)"} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="Width"
                        disabled={!this.props.wcsInfo}
                        value={this.sizeWCS ? this.sizeWCS.x : ""}
                        onBlur={this.handleWidthWCSChange}
                        onKeyDown={this.handleWidthWCSChange}
                    />
                </Tooltip2>
            );
            sizeHeightInput = (
                <Tooltip2 content={"Format: arcsec(\"), arcmin('), or degrees(deg)"} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="Height"
                        disabled={!this.props.wcsInfo}
                        value={this.sizeWCS ? this.sizeWCS.y : ""}
                        onBlur={this.handleHeightWCSChange}
                        onKeyDown={this.handleHeightWCSChange}
                    />
                </Tooltip2>
            );
        }
        const sizeInfoString = region.coordinate === CoordinateMode.Image ? `WCS: ${WCSPoint2D.ToString(this.sizeWCS)}` : `Image: ${Point2D.ToString(size, "px", 3)}`;

        const pxUnitSpan = region.coordinate === CoordinateMode.Image ? <span className={Classes.TEXT_MUTED}>(px)</span> : "";
        return (
            <div className="form-section rectangular-region-form">
                <H5>Properties</H5>
                <div className="form-contents">
                    <table>
                        <tbody>
                            <tr>
                                <td>Region name</td>
                                <td colSpan={2}>
                                    <InputGroup placeholder="Enter a region name" value={region.name} onChange={this.handleNameChange} />
                                </td>
                            </tr>
                            <tr>
                                <td>Coordinate</td>
                                <td colSpan={2}>
                                    <CoordinateComponent selectedValue={region.coordinate} onChange={region.setCoordinate} disableCoordinate={!this.props.wcsInfo} />
                                </td>
                            </tr>
                            <tr>
                                <td>Center {pxUnitSpan}</td>
                                <td>{centerInputX}</td>
                                <td>{centerInputY}</td>
                                <td>
                                    <span className="info-string">{centerInfoString}</span>
                                </td>
                            </tr>
                            <tr>
                                <td>Size {pxUnitSpan}</td>
                                <td>{sizeWidthInput}</td>
                                <td>{sizeHeightInput}</td>
                                <td>
                                    <span className="info-string">{sizeInfoString}</span>
                                </td>
                            </tr>
                            <tr>
                                <td>Bottom-left {pxUnitSpan}</td>
                                <td>{bottomLeftInputX}</td>
                                <td>{bottomLeftInputY}</td>
                                <td>
                                    <span className="info-string">{bottomLeftInfoString}</span>
                                </td>
                            </tr>
                            <tr>
                                <td>Top-right {pxUnitSpan}</td>
                                <td>{topRightInputX}</td>
                                <td>{topRightInputY}</td>
                                <td>
                                    <span className="info-string">{topRightInfoString}</span>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    P.A. <span className={Classes.TEXT_MUTED}>(deg)</span>
                                </td>
                                <td>
                                    <SafeNumericInput
                                        disabled={!this.props.frame?.hasSquarePixels}
                                        selectAllOnFocus={true}
                                        buttonPosition="none"
                                        placeholder="P.A."
                                        value={region.rotation}
                                        onBlur={this.handleRotationChange}
                                        onKeyDown={this.handleRotationChange}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}
