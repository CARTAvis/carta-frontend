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
import {FrameStore, RegionCoordinate, RegionStore, WCS_PRECISION} from "stores/Frame";
import {closeTo, formattedArcsec, getFormattedWCSPoint, getPixelValueFromWCS, getValueFromArcsecString, isWCSStringFormatValid} from "utilities";

import "./EllipticalRegionForm.scss";

const KEYCODE_ENTER = 13;

@observer
export class EllipticalRegionForm extends React.Component<{region: RegionStore; frame: FrameStore; wcsInfo: AST.FrameSet}> {
    private static readonly REGION_PIXEL_EPS = 1.0e-3;

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

        if (isFinite(value) && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
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

        if (isFinite(value) && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
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
            if (newPoint && isFinite(newPoint.x) && !closeTo(newPoint.x, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
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
            if (newPoint && isFinite(newPoint.y) && !closeTo(newPoint.y, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setCenter(newPoint);
                return;
            }
        }

        ev.currentTarget.value = centerWCSPoint.y;
    };

    private handleMajorAxisChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.size.x;

        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: value, y: this.props.region.size.y});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleMajorAxisWCSChange = ev => {
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
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: value, y: this.props.region.size.y});
            return;
        }

        ev.currentTarget.value = this.sizeWCS.x;
    };

    private handleMinorAxisChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.size.y;

        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: this.props.region.size.x, y: value});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleMinorAxisWCSChange = ev => {
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
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: this.props.region.size.x, y: value});
            return;
        }

        ev.currentTarget.value = this.sizeWCS.y;
    };

    private handleRotationChange = ev => {
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
        // dummy variables related to wcs to trigger re-render
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const system = AppStore.Instance.overlayStore.global.explicitSystem;
        const formatX = AppStore.Instance.overlayStore.numbers.formatTypeX;
        const formatY = AppStore.Instance.overlayStore.numbers.formatTypeY;
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || region.regionType !== CARTA.RegionType.ELLIPSE) {
            return null;
        }

        const centerPoint = region.center;
        const centerWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, centerPoint);
        let xInput, yInput;
        if (region.coordinate === RegionCoordinate.Image) {
            xInput = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="X Coordinate" value={centerPoint.x} onBlur={this.handleCenterXChange} onKeyDown={this.handleCenterXChange} />;
            yInput = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Y Coordinate" value={centerPoint.y} onBlur={this.handleCenterYChange} onKeyDown={this.handleCenterYChange} />;
        } else {
            xInput = (
                <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatX)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="X WCS Coordinate"
                        disabled={!this.props.wcsInfo || !centerWCSPoint}
                        value={centerWCSPoint ? centerWCSPoint.x : ""}
                        onBlur={this.handleCenterWCSXChange}
                        onKeyDown={this.handleCenterWCSXChange}
                    />
                </Tooltip2>
            );
            yInput = (
                <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatY)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="Y WCS Coordinate"
                        disabled={!this.props.wcsInfo || !centerWCSPoint}
                        value={centerWCSPoint ? centerWCSPoint.y : ""}
                        onBlur={this.handleCenterWCSYChange}
                        onKeyDown={this.handleCenterWCSYChange}
                    />
                </Tooltip2>
            );
        }
        const infoString = region.coordinate === RegionCoordinate.Image ? `WCS: ${WCSPoint2D.ToString(centerWCSPoint)}` : `Image: ${Point2D.ToString(centerPoint, "px", 3)}`;

        // size
        const size = region.size;
        let sizeWidthInput, sizeHeightInput;
        if (region.coordinate === RegionCoordinate.Image) {
            sizeWidthInput = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Semi-major" value={size.x} onBlur={this.handleMajorAxisChange} onKeyDown={this.handleMajorAxisChange} />;
            sizeHeightInput = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Semi-minor" value={size.y} onBlur={this.handleMinorAxisChange} onKeyDown={this.handleMinorAxisChange} />;
        } else {
            sizeWidthInput = (
                <Tooltip2 content={"Format: arcsec(\"), arcmin('), or degrees(deg)"} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="Semi-major"
                        disabled={!this.props.wcsInfo}
                        value={this.sizeWCS ? this.sizeWCS.x : ""}
                        onBlur={this.handleMajorAxisWCSChange}
                        onKeyDown={this.handleMajorAxisWCSChange}
                    />
                </Tooltip2>
            );
            sizeHeightInput = (
                <Tooltip2 content={"Format: arcsec(\"), arcmin('), or degrees(deg)"} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="Semi-minor"
                        disabled={!this.props.wcsInfo}
                        value={this.sizeWCS ? this.sizeWCS.y : ""}
                        onBlur={this.handleMinorAxisWCSChange}
                        onKeyDown={this.handleMinorAxisWCSChange}
                    />
                </Tooltip2>
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
                                    <InputGroup placeholder="Enter a region name" value={region.name} onChange={this.handleNameChange} />
                                </td>
                            </tr>
                            <tr>
                                <td>Coordinate</td>
                                <td colSpan={2}>
                                    <CoordinateComponent region={region} disableCoordinate={!this.props.wcsInfo} />
                                </td>
                            </tr>
                            <tr>
                                <td>Center {pxUnitSpan}</td>
                                <td>{xInput}</td>
                                <td>{yInput}</td>
                                <td>
                                    <span className="info-string">{infoString}</span>
                                </td>
                            </tr>
                            <tr>
                                <td>Semi-axes {pxUnitSpan}</td>
                                <td>{sizeWidthInput}</td>
                                <td>{sizeHeightInput}</td>
                                <td>
                                    <span className="info-string">{sizeInfoString}</span>
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
