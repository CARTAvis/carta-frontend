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
export class EllipticalRegionForm extends React.Component<{region: RegionStore; frame: FrameStore; wcsInfo: AST.FrameSet}> {
    private static readonly RegionPixelEps = 1.0e-3;

    // size determined by reference frame
    get sizeWCS(): WCSPoint2D | null {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || !region.size || !this.props.frame) {
            return null;
        }
        const size = this.props.region.size;
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
        if (isFinite(value) && !closeTo(value, existingValue, EllipticalRegionForm.RegionPixelEps)) {
            this.props.region.setCenter({x: value, y: this.props.region.center.y});
            return true;
        }
        return false;
    };

    private handleCenterYChange = (value: number): boolean => {
        const existingValue = this.props.region.center.y;
        if (isFinite(value) && !closeTo(value, existingValue, EllipticalRegionForm.RegionPixelEps)) {
            this.props.region.setCenter({x: this.props.region.center.x, y: value});
            return true;
        }
        return false;
    };

    private handleCenterWCSXChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlaySettings.numbers.formatTypeX) && this.centerWCS) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.centerWCS.y});
            const existingValue = this.props.region.center.x;
            if (newPoint && isFinite(newPoint.x) && !closeTo(newPoint.x, existingValue, EllipticalRegionForm.RegionPixelEps)) {
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
            if (newPoint && isFinite(newPoint.y) && !closeTo(newPoint.y, existingValue, EllipticalRegionForm.RegionPixelEps)) {
                this.props.region.setCenter(newPoint);
                return true;
            }
        }
        return false;
    };

    private handleMajorAxisChange = (value: number): boolean => {
        const existingValue = this.props.region.size.x;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.RegionPixelEps)) {
            this.props.region.setSize({x: value, y: this.props.region.size.y});
            return true;
        }
        return false;
    };

    private handleMajorAxisWCSChange = (wcsString: string): boolean => {
        const arcsecValue = getValueFromArcsecString(wcsString);
        if (arcsecValue !== null) {
            const value = this.props.frame.getImageXValueFromArcsec(arcsecValue);
            const existingValue = this.props.region.size.x;
            if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.RegionPixelEps)) {
                this.props.region.setSize({x: value, y: this.props.region.size.y});
                return true;
            }
        }
        return false;
    };

    private handleMinorAxisChange = (value: number): boolean => {
        const existingValue = this.props.region.size.y;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.RegionPixelEps)) {
            this.props.region.setSize({x: this.props.region.size.x, y: value});
            return true;
        }
        return false;
    };

    private handleMinorAxisWCSChange = (wcsString: string): boolean => {
        const arcsecValue = getValueFromArcsecString(wcsString);
        if (arcsecValue !== null) {
            const value = this.props.frame.getImageYValueFromArcsec(arcsecValue);
            const existingValue = this.props.region.size.y;
            if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.RegionPixelEps)) {
                this.props.region.setSize({x: this.props.region.size.x, y: value});
                return true;
            }
        }
        return false;
    };

    private handleRotationChange = (value: number): boolean => {
        const existingValue = this.props.region.rotation;
        if (isFinite(value) && !closeTo(value, existingValue, EllipticalRegionForm.RegionPixelEps)) {
            this.props.region.setRotation(value);
            return true;
        }
        return false;
    };

    public render() {
        const overlaySettings = AppStore.Instance.overlaySettings;
        // dummy variables related to wcs to trigger re-render
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const system = overlaySettings.global.explicitSystem;
        const formatX = overlaySettings.numbers.formatTypeX;
        const formatY = overlaySettings.numbers.formatTypeY;
        /* eslint-enable @typescript-eslint/no-unused-vars */
        const isImgCoordinates = overlaySettings.isImgCoordinates;

        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || (region.regionType !== CARTA.RegionType.ELLIPSE && region.regionType !== CARTA.RegionType.ANNELLIPSE)) {
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
                valueWcs={centerWCSPoint?.x ?? null}
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
                valueWcs={centerWCSPoint?.y ?? null}
                onChangeWcs={this.handleCenterWCSYChange}
                wcsDisabled={!this.props.wcsInfo || !centerWCSPoint}
            />
        );
        const infoString = region.coordinate === CoordinateMode.Image ? `WCS: ${isImgCoordinates ? "-" : centerWCSPoint ? WCSPoint2D.toString(centerWCSPoint) : ""}` : `Image: ${Point2D.toString(centerPoint, "px", 3)}`;

        const size = region.size;
        const sizeWCS = this.sizeWCS;
        const sizeWidthInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.Size}
                value={size.x}
                onChange={this.handleMajorAxisChange}
                valueWcs={sizeWCS?.x ?? null}
                onChangeWcs={this.handleMajorAxisWCSChange}
                wcsDisabled={!this.props.wcsInfo}
                customPlaceholder="Semi-major"
            />
        );
        const sizeHeightInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.Size}
                value={size.y}
                onChange={this.handleMinorAxisChange}
                valueWcs={sizeWCS?.y ?? null}
                onChangeWcs={this.handleMinorAxisWCSChange}
                wcsDisabled={!this.props.wcsInfo}
                customPlaceholder="Semi-minor"
            />
        );
        const sizeInfoString = region.coordinate === CoordinateMode.Image ? `(Semi-major, Semi-minor): ${isImgCoordinates ? "-" : sizeWCS ? WCSPoint2D.toString(sizeWCS) : ""}` : `Image: ${Point2D.toString(size, "px", 3)}`;
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
                <FormGroup label="Semi-axes" labelInfo={pxUnit} inline={true}>
                    {sizeWidthInput}
                    {sizeHeightInput}
                    <span className="info-string">{sizeInfoString}</span>
                </FormGroup>
                <FormGroup label="P.A." labelInfo="(deg)" inline={true}>
                    <ImageCoordNumericInput value={region.rotation} onChange={this.handleRotationChange} disabled={!this.props.frame?.hasSquarePixels} customPlaceholder="P.A." />
                </FormGroup>
            </div>
        );
    }
}
