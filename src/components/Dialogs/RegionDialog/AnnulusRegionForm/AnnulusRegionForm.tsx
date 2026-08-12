import * as React from "react";
import {FormGroup, InputGroup} from "@blueprintjs/core";
import type * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {observer} from "mobx-react";

import {CoordinateComponent, CoordNumericInput, ImageCoordNumericInput} from "components/Shared";
import {CoordinateMode, InputType} from "enums";
import {IsValidWcsPoint, Point2D} from "models";
import {AppStore} from "stores";
import {type FrameStore, type RegionStore, WCS_PRECISION} from "stores/Frame";
import {closeTo, formattedArcsec, getFormattedWCSPoint, getPixelValueFromWCS, getValueFromArcsecString, isWCSStringFormatValid} from "utilities";

import {WCSPoint2D} from "../../../../models/Point2D/Point2D";

@observer
export class AnnulusRegionForm extends React.Component<{region: RegionStore; frame: FrameStore; wcsInfo: AST.FrameSet}> {
    private static readonly RegionPixelEps = 1.0e-3;

    get outerSizeWCS(): WCSPoint2D | null {
        const region = this.props.region;
        if (!region || region.controlPoints.length < 3 || !region.size || !this.props.frame) {
            return null;
        }
        const size = region.size;
        const wcsSize = this.props.frame.getWcsSizeInArcsec(size);
        if (IsValidWcsPoint(wcsSize)) {
            const formattedX = formattedArcsec(wcsSize.x, WCS_PRECISION);
            const formattedY = formattedArcsec(wcsSize.y, WCS_PRECISION);
            if (formattedX && formattedY) {
                return {x: formattedX, y: formattedY};
            }
        }
        return null;
    }

    get innerSizeWCS(): WCSPoint2D | null {
        const region = this.props.region;
        if (!region || region.controlPoints.length < 3 || !region.innerSize || !this.props.frame) {
            return null;
        }
        const size = region.innerSize;
        const wcsSize = this.props.frame.getWcsSizeInArcsec(size);
        if (IsValidWcsPoint(wcsSize)) {
            const formattedX = formattedArcsec(wcsSize.x, WCS_PRECISION);
            const formattedY = formattedArcsec(wcsSize.y, WCS_PRECISION);
            if (formattedX && formattedY) {
                return {x: formattedX, y: formattedY};
            }
        }
        return null;
    }

    get centerWCS(): WCSPoint2D | null {
        const region = this.props.region;
        if (!region || !this.props.wcsInfo) {
            return null;
        }
        return getFormattedWCSPoint(this.props.wcsInfo, region.center);
    }

    private handleNameChange = ev => {
        this.props.region.setName(ev.currentTarget.value);
    };

    private handleCenterXChange = (value: number): boolean => {
        const existingValue = this.props.region.center.x;
        if (isFinite(value) && !closeTo(value, existingValue, AnnulusRegionForm.RegionPixelEps)) {
            this.props.region.setCenter({x: value, y: this.props.region.center.y});
            return true;
        }
        return false;
    };

    private handleCenterYChange = (value: number): boolean => {
        const existingValue = this.props.region.center.y;
        if (isFinite(value) && !closeTo(value, existingValue, AnnulusRegionForm.RegionPixelEps)) {
            this.props.region.setCenter({x: this.props.region.center.x, y: value});
            return true;
        }
        return false;
    };

    private handleCenterWCSXChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlaySettings.numbers.formatTypeX) && this.centerWCS) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.centerWCS.y});
            const existingValue = this.props.region.center.x;
            if (newPoint && isFinite(newPoint.x) && !closeTo(newPoint.x, existingValue, AnnulusRegionForm.RegionPixelEps)) {
                this.props.region.setCenter(newPoint);
                return true;
            }
        }
        return false;
    };

    private handleCenterWCSYChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlaySettings.numbers.formatTypeY) && this.centerWCS) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: this.centerWCS.x, y: wcsString});
            const existingValue = this.props.region.center.y;
            if (newPoint && isFinite(newPoint.y) && !closeTo(newPoint.y, existingValue, AnnulusRegionForm.RegionPixelEps)) {
                this.props.region.setCenter(newPoint);
                return true;
            }
        }
        return false;
    };

    private handleOuterMajorAxisChange = (value: number): boolean => {
        const existingValue = this.props.region.size.x;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, AnnulusRegionForm.RegionPixelEps)) {
            this.props.region.setSize({x: value, y: this.props.region.size.y});
            return true;
        }
        return false;
    };

    private handleOuterMajorAxisWCSChange = (wcsString: string): boolean => {
        const arcsecValue = getValueFromArcsecString(wcsString);
        if (arcsecValue !== null) {
            const value = this.props.frame.getImageXValueFromArcsec(arcsecValue);
            const existingValue = this.props.region.size.x;
            if (isFinite(value) && value > 0 && !closeTo(value, existingValue, AnnulusRegionForm.RegionPixelEps)) {
                this.props.region.setSize({x: value, y: this.props.region.size.y});
                return true;
            }
        }
        return false;
    };

    private handleOuterMinorAxisChange = (value: number): boolean => {
        const existingValue = this.props.region.size.y;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, AnnulusRegionForm.RegionPixelEps)) {
            this.props.region.setSize({x: this.props.region.size.x, y: value});
            return true;
        }
        return false;
    };

    private handleOuterMinorAxisWCSChange = (wcsString: string): boolean => {
        const arcsecValue = getValueFromArcsecString(wcsString);
        if (arcsecValue !== null) {
            const value = this.props.frame.getImageYValueFromArcsec(arcsecValue);
            const existingValue = this.props.region.size.y;
            if (isFinite(value) && value > 0 && !closeTo(value, existingValue, AnnulusRegionForm.RegionPixelEps)) {
                this.props.region.setSize({x: this.props.region.size.x, y: value});
                return true;
            }
        }
        return false;
    };

    private handleInnerMajorAxisChange = (value: number): boolean => {
        const existingValue = this.props.region.innerSize.x;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, AnnulusRegionForm.RegionPixelEps)) {
            this.props.region.setInnerSize({x: value, y: this.props.region.innerSize.y});
            return true;
        }
        return false;
    };

    private handleInnerMajorAxisWCSChange = (wcsString: string): boolean => {
        const arcsecValue = getValueFromArcsecString(wcsString);
        if (arcsecValue !== null) {
            const value = this.props.frame.getImageXValueFromArcsec(arcsecValue);
            const existingValue = this.props.region.innerSize.x;
            if (isFinite(value) && value > 0 && !closeTo(value, existingValue, AnnulusRegionForm.RegionPixelEps)) {
                this.props.region.setInnerSize({x: value, y: this.props.region.innerSize.y});
                return true;
            }
        }
        return false;
    };

    private handleInnerMinorAxisChange = (value: number): boolean => {
        const existingValue = this.props.region.innerSize.y;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, AnnulusRegionForm.RegionPixelEps)) {
            this.props.region.setInnerSize({x: this.props.region.innerSize.x, y: value});
            return true;
        }
        return false;
    };

    private handleInnerMinorAxisWCSChange = (wcsString: string): boolean => {
        const arcsecValue = getValueFromArcsecString(wcsString);
        if (arcsecValue !== null) {
            const value = this.props.frame.getImageYValueFromArcsec(arcsecValue);
            const existingValue = this.props.region.innerSize.y;
            if (isFinite(value) && value > 0 && !closeTo(value, existingValue, AnnulusRegionForm.RegionPixelEps)) {
                this.props.region.setInnerSize({x: this.props.region.innerSize.x, y: value});
                return true;
            }
        }
        return false;
    };

    private handleRotationChange = (value: number): boolean => {
        const existingValue = this.props.region.rotation;
        if (isFinite(value) && !closeTo(value, existingValue, AnnulusRegionForm.RegionPixelEps)) {
            this.props.region.setRotation(value);
            return true;
        }
        return false;
    };

    public render() {
        const overlaySettings = AppStore.Instance.overlaySettings;
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const system = overlaySettings.global.explicitSystem;
        const formatX = overlaySettings.numbers.formatTypeX;
        const formatY = overlaySettings.numbers.formatTypeY;
        /* eslint-enable @typescript-eslint/no-unused-vars */
        const isImgCoordinates = overlaySettings.isImgCoordinates;

        const region = this.props.region;
        if (!region || region.controlPoints.length < 3 || region.regionType !== CARTA.RegionType.ANNULUS) {
            return null;
        }

        const centerPoint = region.center;
        const centerWCSPoint = this.centerWCS;
        const xInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.XCoord}
                value={centerPoint?.x}
                onChange={this.handleCenterXChange}
                valueWcs={centerWCSPoint?.x || null}
                onChangeWcs={this.handleCenterWCSXChange}
                wcsDisabled={!this.props.wcsInfo || !centerWCSPoint}
            />
        );
        const yInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.YCoord}
                value={centerPoint?.y}
                onChange={this.handleCenterYChange}
                valueWcs={centerWCSPoint?.y || null}
                onChangeWcs={this.handleCenterWCSYChange}
                wcsDisabled={!this.props.wcsInfo || !centerWCSPoint}
            />
        );
        const infoString = region.coordinate === CoordinateMode.Image ? `WCS: ${isImgCoordinates ? "-" : centerWCSPoint ? WCSPoint2D.toString(centerWCSPoint, 3) : ""}` : `Image: ${Point2D.toString(centerPoint, "px", 3)}`;

        const outerSize = region.size;
        const outerSizeWCS = this.outerSizeWCS;
        const outerWidthInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.Size}
                value={outerSize.x}
                onChange={this.handleOuterMajorAxisChange}
                valueWcs={outerSizeWCS?.x || null}
                onChangeWcs={this.handleOuterMajorAxisWCSChange}
                wcsDisabled={!this.props.wcsInfo}
                customPlaceholder="Semi-major"
            />
        );
        const outerHeightInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.Size}
                value={outerSize.y}
                onChange={this.handleOuterMinorAxisChange}
                valueWcs={outerSizeWCS?.y || null}
                onChangeWcs={this.handleOuterMinorAxisWCSChange}
                wcsDisabled={!this.props.wcsInfo}
                customPlaceholder="Semi-minor"
            />
        );
        const outerSizeInfoString =
            region.coordinate === CoordinateMode.Image
                ? `WCS (Semi-major, Semi-minor): ${isImgCoordinates ? "-" : outerSizeWCS ? WCSPoint2D.toString(outerSizeWCS, 3) : ""}`
                : `Image (Semi-major, Semi-minor): ${Point2D.toString(outerSize, "px", 3)}`;

        const innerSize = region.innerSize;
        const innerSizeWCS = this.innerSizeWCS;
        const innerWidthInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.Size}
                value={innerSize.x}
                onChange={this.handleInnerMajorAxisChange}
                valueWcs={innerSizeWCS?.x || null}
                onChangeWcs={this.handleInnerMajorAxisWCSChange}
                wcsDisabled={!this.props.wcsInfo}
                customPlaceholder="Semi-major"
            />
        );
        const innerHeightInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.Size}
                value={innerSize.y}
                onChange={this.handleInnerMinorAxisChange}
                valueWcs={innerSizeWCS?.y || null}
                onChangeWcs={this.handleInnerMinorAxisWCSChange}
                wcsDisabled={!this.props.wcsInfo}
                customPlaceholder="Semi-minor"
            />
        );
        const innerSizeInfoString =
            region.coordinate === CoordinateMode.Image
                ? `WCS (Semi-major, Semi-minor): ${isImgCoordinates ? "-" : innerSizeWCS ? WCSPoint2D.toString(innerSizeWCS, 3) : ""}`
                : `Image (Semi-major, Semi-minor): ${Point2D.toString(innerSize, "px", 3)}`;

        const pxUnit = region.coordinate === CoordinateMode.Image ? "(px)" : "";
        return (
            <div className="region-form">
                <FormGroup label={region.isAnnotation ? "Annotation name" : "Region name"} inline={true}>
                    <InputGroup placeholder={region.isAnnotation ? "Enter an annotation name" : "Enter a region name"} value={region.name} onChange={this.handleNameChange} />
                </FormGroup>
                <FormGroup label="Coordinate" inline={true}>
                    <CoordinateComponent selectedValue={region.coordinate} onChange={region.setCoordinate} disableCoordinate={!this.props.wcsInfo} />
                </FormGroup>
                <FormGroup label="Center" labelInfo={pxUnit} inline={true}>
                    {xInput}
                    {yInput}
                    <span className="info-string">{infoString}</span>
                </FormGroup>
                <FormGroup label="Outer ring" labelInfo={pxUnit} inline={true}>
                    {outerWidthInput}
                    {outerHeightInput}
                    <span className="info-string">{outerSizeInfoString}</span>
                </FormGroup>
                <FormGroup label="Inner ring" labelInfo={pxUnit} inline={true}>
                    {innerWidthInput}
                    {innerHeightInput}
                    <span className="info-string">{innerSizeInfoString}</span>
                </FormGroup>
                <FormGroup label="P.A." labelInfo="(deg)" inline={true}>
                    <ImageCoordNumericInput value={region.rotation} onChange={this.handleRotationChange} disabled={!this.props.frame?.hasSquarePixels} customPlaceholder="P.A." />
                </FormGroup>
            </div>
        );
    }
}
