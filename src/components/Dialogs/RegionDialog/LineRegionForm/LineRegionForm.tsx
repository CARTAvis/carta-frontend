import * as React from "react";
import {FormGroup, InputGroup} from "@blueprintjs/core";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {computed} from "mobx";
import {observer} from "mobx-react";

import {CoordinateComponent, CoordNumericInput, ImageCoordNumericInput, InputType} from "components/Shared";
import {Point2D, WCSPoint2D} from "models";
import {AppStore} from "stores";
import {CoordinateMode, FrameStore, RegionStore, WCS_PRECISION} from "stores/Frame";
import {closeTo, formattedArcsec, getFormattedWCSPoint, getPixelValueFromWCS, getValueFromArcsecString, isWCSStringFormatValid, length2D} from "utilities";

import "./LineRegionForm.scss";

@observer
export class LineRegionForm extends React.Component<{region: RegionStore; frame: FrameStore; wcsInfo: AST.FrameSet}> {
    @computed get startPoint(): Point2D {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2) {
            return {x: NaN, y: NaN};
        }

        return {x: region.controlPoints[0].x, y: region.controlPoints[0].y};
    }

    @computed get endPoint(): Point2D {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2) {
            return {x: NaN, y: NaN};
        }

        return {x: region.controlPoints[1].x, y: region.controlPoints[1].y};
    }

    // size determined by reference frame
    @computed get lengthWCS(): string {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || !region.size || !this.props.frame) {
            return null;
        }
        const size = this.props.region.size;
        const wcsSize = this.props.frame.getWcsSizeInArcsec(size);
        if (wcsSize) {
            return formattedArcsec(length2D(wcsSize), WCS_PRECISION);
        }
        return null;
    }

    @computed get centerWCS(): WCSPoint2D {
        const region = this.props.region;
        if (!region || !this.props.wcsInfo) {
            return null;
        }
        return getFormattedWCSPoint(this.props.wcsInfo, region.center);
    }

    @computed get startWCS(): WCSPoint2D {
        const region = this.props.region;
        if (!region || !this.props.wcsInfo) {
            return null;
        }
        return getFormattedWCSPoint(this.props.wcsInfo, this.startPoint);
    }

    @computed get endWCS(): WCSPoint2D {
        const region = this.props.region;
        if (!region || !this.props.wcsInfo) {
            return null;
        }
        return getFormattedWCSPoint(this.props.wcsInfo, this.endPoint);
    }

    private static readonly REGION_PIXEL_EPS = 1.0e-3;

    private handleNameChange = ev => {
        this.props.region.setName(ev.currentTarget.value);
    };

    private handleCenterXChange = (value: number): boolean => {
        const existingValue = this.props.region.center.x;
        if (isFinite(value) && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setCenter({x: value, y: this.props.region.center.y});
            return true;
        }
        return false;
    };

    private handleCenterYChange = (value: number): boolean => {
        const existingValue = this.props.region.center.y;
        if (isFinite(value) && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setCenter({x: this.props.region.center.x, y: value});
            return true;
        }
        return false;
    };

    private handleCenterWCSXChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, this.props.frame.overlayStore.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.centerWCS.y});
            const existingValue = this.props.region.center.x;
            if (isFinite(newPoint?.x) && !closeTo(newPoint.x, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setCenter(newPoint);
                return true;
            }
        }
        return false;
    };

    private handleCenterWCSYChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, this.props.frame.overlayStore.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: this.centerWCS.x, y: wcsString});
            const existingValue = this.props.region.center.y;
            if (isFinite(newPoint?.y) && !closeTo(newPoint.y, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setCenter(newPoint);
                return true;
            }
        }
        return false;
    };

    private handleLengthChange = (value: number): boolean => {
        const existingValue = length2D(this.props.region.size);
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const rotation = (region.rotation * Math.PI) / 180.0;
            // the rotation angle is defined to be 0 at North (mostly in +y axis) and increases counter-clockwisely. This is
            // different from the usual definition in math where 0 degree is in the +x axis. The extra 90-degree offset swaps
            // cos and sin with a proper +/-1 constant applied.
            region.setSize({x: value * Math.sin(rotation), y: -1 * value * Math.cos(rotation)});
            return true;
        }
        return false;
    };

    private handleLengthWCSChange = (wcsString: string): boolean => {
        const existingValue = length2D(this.props.region.size);
        const value = (existingValue * getValueFromArcsecString(wcsString)) / length2D(this.props.frame.getWcsSizeInArcsec(this.props.region.size));
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const rotation = (region.rotation * Math.PI) / 180.0;
            // the rotation angle is defined to be 0 at North (mostly in +y axis) and increases counter-clockwisely. This is
            // different from the usual definition in math where 0 degree is in the +x axis. The extra 90-degree offset swaps
            // cos and sin with a proper +/-1 constant applied.
            region.setSize({x: value * Math.sin(rotation), y: -1 * value * Math.cos(rotation)});
            return true;
        }
        return false;
    };

    private handleStartXValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const newDims = {x: Math.abs(value - region.controlPoints[1].x), y: region.size.y};
            if (newDims.x > 0 || newDims.y > 0) {
                region.setControlPoint(0, {x: value, y: region.controlPoints[0].y});
                return true;
            }
        }
        return false;
    };

    private handleStartXChange = (value: number): boolean => {
        const existingValue = this.startPoint.x;
        return this.handleStartXValueChange(value, existingValue);
    };

    private handleStartXWCSChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, this.props.frame.overlayStore.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.startWCS.y});
            const value = newPoint.x;
            const existingValue = this.startPoint.x;
            return this.handleStartXValueChange(value, existingValue);
        }
        return false;
    };

    private handleStartYValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const newDims = {x: region.size.x, y: Math.abs(value - region.controlPoints[1].y)};
            if (newDims.x > 0 || newDims.y > 0) {
                region.setControlPoint(0, {x: region.controlPoints[0].x, y: value});
                return true;
            }
        }
        return false;
    };

    private handleStartYChange = (value: number): boolean => {
        const existingValue = this.startPoint.y;
        return this.handleStartYValueChange(value, existingValue);
    };

    private handleStartYWCSChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, this.props.frame.overlayStore.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: this.startWCS.x, y: wcsString});
            const value = newPoint.y;
            const existingValue = this.startPoint.y;
            return this.handleStartYValueChange(value, existingValue);
        }
        return false;
    };

    private handleEndXValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const newDims = {x: Math.abs(value - region.controlPoints[0].x), y: region.size.y};
            if (newDims.x > 0 || newDims.y > 0) {
                region.setControlPoint(1, {x: value, y: region.controlPoints[1].y});
                return true;
            }
        }
        return false;
    };

    private handleEndXChange = (value: number): boolean => {
        const existingValue = this.endPoint.x;
        return this.handleEndXValueChange(value, existingValue);
    };

    private handleEndXWCSChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, this.props.frame.overlayStore.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.endWCS.y});
            const value = newPoint.x;
            const existingValue = this.endPoint.x;
            return this.handleEndXValueChange(value, existingValue);
        }
        return false;
    };

    private handleEndYValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const newDims = {x: region.size.x, y: Math.abs(value - region.controlPoints[0].y)};
            if (newDims.x > 0 || newDims.y > 0) {
                region.setControlPoint(1, {x: region.controlPoints[1].x, y: value});
                return true;
            }
        }
        return false;
    };

    private handleEndYChange = (value: number): boolean => {
        const existingValue = this.endPoint.y;
        return this.handleEndYValueChange(value, existingValue);
    };

    private handleEndYWCSChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, this.props.frame.overlayStore.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: this.endWCS.x, y: wcsString});
            const value = newPoint.y;
            const existingValue = this.endPoint.y;
            return this.handleEndYValueChange(value, existingValue);
        }
        return false;
    };

    private handleRotationChange = (value: number): boolean => {
        const existingValue = this.props.region.rotation;

        if (isFinite(value) && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setRotation(value);
            return true;
        }
        return false;
    };

    public render() {
        // dummy variables related to wcs to trigger re-render
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const system = this.props.frame.overlayStore.global.explicitSystem;
        const formatX = this.props.frame.overlayStore.numbers.formatTypeX;
        const formatY = this.props.frame.overlayStore.numbers.formatTypeY;
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || (region.regionType !== CARTA.RegionType.LINE && region.regionType !== CARTA.RegionType.ANNLINE && region.regionType !== CARTA.RegionType.ANNVECTOR)) {
            return null;
        }

        // start
        const startPoint = this.startPoint;
        const startWCSPoint = this.startWCS;
        const startInputX = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.XCoord}
                value={startPoint?.x}
                onChange={this.handleStartXChange}
                valueWcs={startWCSPoint?.x}
                onChangeWcs={this.handleStartXWCSChange}
                wcsDisabled={!this.props.wcsInfo || !startWCSPoint}
            />
        );
        const startInputY = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.YCoord}
                value={startPoint?.y}
                onChange={this.handleStartYChange}
                valueWcs={startWCSPoint?.y}
                onChangeWcs={this.handleStartYWCSChange}
                wcsDisabled={!this.props.wcsInfo || !startWCSPoint}
            />
        );
        const startInfoString = region.coordinate === CoordinateMode.Image ? `WCS: ${WCSPoint2D.ToString(startWCSPoint)}` : `Image: ${Point2D.ToString(this.startPoint, "px", 3)}`;

        // end
        const endPoint = this.endPoint;
        const endWCSPoint = this.endWCS;
        const endInputX = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.XCoord}
                value={endPoint?.x}
                onChange={this.handleEndXChange}
                valueWcs={endWCSPoint?.x}
                onChangeWcs={this.handleEndXWCSChange}
                wcsDisabled={!this.props.wcsInfo || !endWCSPoint}
            />
        );
        const endInputY = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.YCoord}
                value={endPoint?.y}
                onChange={this.handleEndYChange}
                valueWcs={endWCSPoint?.y}
                onChangeWcs={this.handleEndYWCSChange}
                wcsDisabled={!this.props.wcsInfo || !endWCSPoint}
            />
        );
        const endInfoString = region.coordinate === CoordinateMode.Image ? `WCS: ${WCSPoint2D.ToString(endWCSPoint)}` : `Image: ${Point2D.ToString(this.endPoint, "px", 3)}`;

        // center
        const centerPoint = region.center;
        const centerWCSPoint = this.centerWCS;
        const centerInputX = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.XCoord}
                value={centerPoint?.x}
                onChange={this.handleCenterXChange}
                valueWcs={centerWCSPoint?.x}
                onChangeWcs={this.handleCenterWCSXChange}
                wcsDisabled={!this.props.wcsInfo || !centerWCSPoint}
            />
        );
        const centerInputY = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.YCoord}
                value={centerPoint?.y}
                onChange={this.handleCenterYChange}
                valueWcs={centerWCSPoint?.y}
                onChangeWcs={this.handleCenterWCSYChange}
                wcsDisabled={!this.props.wcsInfo || !centerWCSPoint}
            />
        );
        const centerInfoString = region.coordinate === CoordinateMode.Image ? `WCS: ${WCSPoint2D.ToString(centerWCSPoint)}` : `Image: ${Point2D.ToString(centerPoint, "px", 3)}`;

        // length

        const length = length2D(region.size);
        const lengthWCS = this.lengthWCS;
        const lengthInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.Size}
                value={length}
                onChange={this.handleLengthChange}
                valueWcs={lengthWCS}
                onChangeWcs={this.handleLengthWCSChange}
                wcsDisabled={!this.props.wcsInfo}
                customPlaceholder="Length"
            />
        );
        const lengthInfoString = region.coordinate === CoordinateMode.Image ? `WCS: ${this.lengthWCS}` : `Image: ${length.toFixed(3)} px`;

        const pxUnit = region.coordinate === CoordinateMode.Image ? "(px)" : "";
        return (
            <div className="region-form">
                <FormGroup label={region.isAnnotation ? "Annotation name" : "Region name"} inline={true}>
                    <InputGroup placeholder={region.isAnnotation ? "Enter an annotation name" : "Enter a region name"} value={region.name} onChange={this.handleNameChange} />
                </FormGroup>
                <FormGroup label="Coordinate" inline={true}>
                    <CoordinateComponent selectedValue={region.coordinate} onChange={region.setCoordinate} disableCoordinate={!this.props.wcsInfo} />
                </FormGroup>
                <FormGroup label="Start" labelInfo={pxUnit} inline={true}>
                    {startInputX}
                    {startInputY}
                    <span className="info-string">{startInfoString}</span>
                </FormGroup>
                <FormGroup label="End" labelInfo={pxUnit} inline={true}>
                    {endInputX}
                    {endInputY}
                    <span className="info-string">{endInfoString}</span>
                </FormGroup>
                <FormGroup label="Center" labelInfo={pxUnit} inline={true}>
                    {centerInputX}
                    {centerInputY}
                    <span className="info-string">{centerInfoString}</span>
                </FormGroup>
                {this.props.frame?.hasSquarePixels ? (
                    <>
                        <FormGroup className="length-form" label="Length" labelInfo={pxUnit} inline={true}>
                            {lengthInput}
                            <span className="info-string">{lengthInfoString}</span>
                        </FormGroup>
                        <FormGroup label="P.A." labelInfo="(deg)" inline={true}>
                            <ImageCoordNumericInput value={region.rotation} onChange={this.handleRotationChange} customPlaceholder="P.A." />
                        </FormGroup>
                    </>
                ) : null}
            </div>
        );
    }
}
