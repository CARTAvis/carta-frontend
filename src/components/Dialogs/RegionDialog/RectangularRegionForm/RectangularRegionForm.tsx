import * as React from "react";
import {FormGroup, InputGroup, TextArea} from "@blueprintjs/core";
import type * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {observer} from "mobx-react";

import {CoordinateComponent, CoordNumericInput, ImageCoordNumericInput} from "components/Shared";
import {CoordinateMode, InputType} from "enums";
import {isValidWcsPoint, Point2D, WCSPoint2D} from "models";
import {AppStore} from "stores";
import {type FrameStore, type RegionStore, type TextAnnotationStore, WCS_PRECISION} from "stores/Frame";
import {closeTo, formattedArcsec, getFormattedWCSPoint, getPixelValueFromWCS, getValueFromArcsecString, isWCSStringFormatValid, scale2D} from "utilities";

import "./RectangularRegionForm.scss";

@observer
export class RectangularRegionForm extends React.Component<{region: RegionStore; frame: FrameStore; wcsInfo: AST.FrameSet}> {
    get topRightPoint(): Point2D {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2) {
            return {x: NaN, y: NaN};
        }

        const centerPoint = region.center;
        const sizeDims = region.regionType === CARTA.RegionType.ANNTEXT ? scale2D(region.size, AppStore.Instance.imageRatio / this.props.frame.zoomLevel) : region.size;
        return {x: centerPoint.x + sizeDims.x / 2.0, y: centerPoint.y + sizeDims.y / 2.0};
    }

    get bottomLeftPoint(): Point2D {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2) {
            return {x: NaN, y: NaN};
        }

        const centerPoint = region.center;
        const sizeDims = region.regionType === CARTA.RegionType.ANNTEXT ? scale2D(region.size, AppStore.Instance.imageRatio / this.props.frame.zoomLevel) : region.size;
        return {x: centerPoint.x - sizeDims.x / 2.0, y: centerPoint.y - sizeDims.y / 2.0};
    }

    // size determined by reference frame
    get sizeWCS(): WCSPoint2D | null {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || !region.size || !this.props.frame) {
            return null;
        }
        const size = region.regionType === CARTA.RegionType.ANNTEXT ? scale2D(region.size, AppStore.Instance.imageRatio / this.props.frame.zoomLevel) : region.size;
        const wcsSize = this.props.frame.getWcsSizeInArcsec(size);
        if (isValidWcsPoint(wcsSize)) {
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

    get topRightWCS(): WCSPoint2D | null {
        const region = this.props.region;
        if (!region || !this.props.wcsInfo) {
            return null;
        }
        return getFormattedWCSPoint(this.props.wcsInfo, this.topRightPoint);
    }

    get bottomLeftWCS(): WCSPoint2D | null {
        const region = this.props.region;
        if (!region || !this.props.wcsInfo) {
            return null;
        }
        return getFormattedWCSPoint(this.props.wcsInfo, this.bottomLeftPoint);
    }

    private static readonly REGION_PIXEL_EPS = 1.0e-3;

    private handleNameChange = ev => {
        this.props.region.setName(ev.currentTarget.value);
    };

    private handleCenterXChange = (value: number): boolean => {
        const existingValue = this.props.region.center.x;
        if (isFinite(value) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setCenter({x: value, y: this.props.region.center.y});
            return true;
        }
        return false;
    };

    private handleCenterYChange = (value: number): boolean => {
        const existingValue = this.props.region.center.y;
        if (isFinite(value) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setCenter({x: this.props.region.center.x, y: value});
            return true;
        }
        return false;
    };

    private handleCenterWCSXChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlaySettings.numbers.formatTypeX)) {
            const centerWCS = this.centerWCS;
            if (centerWCS) {
                const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: centerWCS.y});
                const existingValue = this.props.region.center.x;
                if (newPoint && isFinite(newPoint.x) && !closeTo(newPoint.x, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
                    this.props.region.setCenter(newPoint);
                    return true;
                }
            }
        }
        return false;
    };

    private handleCenterWCSYChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlaySettings.numbers.formatTypeY)) {
            const centerWCS = this.centerWCS;
            if (centerWCS) {
                const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: centerWCS.x, y: wcsString});
                const existingValue = this.props.region.center.y;
                if (newPoint && isFinite(newPoint.y) && !closeTo(newPoint.y, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
                    this.props.region.setCenter(newPoint);
                    return true;
                }
            }
        }
        return false;
    };

    private handleWidthChange = (value: number, fixedScreenSize: boolean = false): boolean => {
        const existingValue = this.props.region.size.x;
        const scale = fixedScreenSize ? AppStore.Instance.imageRatio / this.props.frame.zoomLevel : 1;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: value / scale, y: this.props.region.size.y});
            return true;
        }
        return false;
    };

    private handleWidthWCSChange = (wcsString: string, fixedScreenSize: boolean = false): boolean => {
        const arcsecValue = getValueFromArcsecString(wcsString);
        if (arcsecValue !== null) {
            const value = this.props.frame.getImageXValueFromArcsec(arcsecValue);
            const existingValue = this.props.region.size.x;
            const scale = fixedScreenSize ? AppStore.Instance.imageRatio / this.props.frame.zoomLevel : 1;
            if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setSize({x: value / scale, y: this.props.region.size.y});
                return true;
            }
        }
        return false;
    };

    private handleHeightChange = (value: number, fixedScreenSize: boolean = false): boolean => {
        const existingValue = this.props.region.size.y;
        const scale = fixedScreenSize ? AppStore.Instance.imageRatio / this.props.frame.zoomLevel : 1;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: this.props.region.size.x, y: value / scale});
            return true;
        }
        return false;
    };

    private handleHeightWCSChange = (wcsString: string, fixedScreenSize: boolean = false): boolean => {
        const arcsecValue = getValueFromArcsecString(wcsString);
        if (arcsecValue !== null) {
            const value = this.props.frame.getImageYValueFromArcsec(arcsecValue);
            const existingValue = this.props.region.size.y;
            const scale = fixedScreenSize ? AppStore.Instance.imageRatio / this.props.frame.zoomLevel : 1;
            if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setSize({x: this.props.region.size.x, y: value / scale});
                return true;
            }
        }
        return false;
    };

    private handleLeftValueChange = (value: number, existingValue: number, fixedScreenSize: boolean = false): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.center;
            const scale = fixedScreenSize ? AppStore.Instance.imageRatio / this.props.frame.zoomLevel : 1;
            const sizeDims = scale2D(region.size, scale);
            const rightValue = centerPoint.x + sizeDims.x / 2.0;
            const newCenter = {x: (value + rightValue) / 2.0, y: centerPoint.y};
            const newDims = {x: Math.abs(value - rightValue) / scale, y: sizeDims.y / scale};
            if (newDims.x > 0 && newDims.y > 0) {
                region.setControlPoints([newCenter, newDims]);
                return true;
            }
        }
        return false;
    };

    private handleLeftChange = (value: number, fixedScreenSize: boolean = false): boolean => {
        const existingValue = this.bottomLeftPoint.x;
        return this.handleLeftValueChange(value, existingValue, fixedScreenSize);
    };

    private handleLeftWCSChange = (wcsString: string, fixedScreenSize: boolean = false): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlaySettings.numbers.formatTypeX)) {
            const bottomLeftWCS = this.bottomLeftWCS;
            if (bottomLeftWCS) {
                const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: bottomLeftWCS.y});
                if (newPoint) {
                    const value = newPoint.x;
                    const existingValue = this.bottomLeftPoint.x;
                    return this.handleLeftValueChange(value, existingValue, fixedScreenSize);
                }
            }
        }
        return false;
    };

    private handleBottomValueChange = (value: number, existingValue: number, fixedScreenSize: boolean = false): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.center;
            const scale = fixedScreenSize ? AppStore.Instance.imageRatio / this.props.frame.zoomLevel : 1;
            const sizeDims = scale2D(region.size, scale);
            const topValue = centerPoint.y + sizeDims.y / 2.0;
            const newCenter = {x: centerPoint.x, y: (value + topValue) / 2.0};
            const newDims = {x: sizeDims.x / scale, y: Math.abs(value - topValue) / scale};
            if (newDims.x > 0 && newDims.y > 0) {
                region.setControlPoints([newCenter, newDims]);
                return true;
            }
        }
        return false;
    };

    private handleBottomChange = (value: number, fixedScreenSize: boolean = false): boolean => {
        const existingValue = this.bottomLeftPoint.y;
        return this.handleBottomValueChange(value, existingValue, fixedScreenSize);
    };

    private handleBottomWCSChange = (wcsString: string, fixedScreenSize: boolean = false): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlaySettings.numbers.formatTypeY)) {
            const bottomLeftWCS = this.bottomLeftWCS;
            if (bottomLeftWCS) {
                const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: bottomLeftWCS.x, y: wcsString});
                if (newPoint) {
                    const value = newPoint.y;
                    const existingValue = this.bottomLeftPoint.y;
                    return this.handleBottomValueChange(value, existingValue, fixedScreenSize);
                }
            }
        }
        return false;
    };

    private handleRightValueChange = (value: number, existingValue: number, fixedScreenSize: boolean = false): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.center;
            const scale = fixedScreenSize ? AppStore.Instance.imageRatio / this.props.frame.zoomLevel : 1;
            const sizeDims = scale2D(region.size, scale);
            const leftValue = centerPoint.x - sizeDims.x / 2.0;
            const newCenter = {x: (value + leftValue) / 2.0, y: centerPoint.y};
            const newDims = {x: Math.abs(value - leftValue) / scale, y: sizeDims.y / scale};
            if (newDims.x > 0 && newDims.y > 0) {
                region.setControlPoints([newCenter, newDims]);
                return true;
            }
        }
        return false;
    };

    private handleRightChange = (value: number, fixedScreenSize: boolean = false): boolean => {
        const existingValue = this.topRightPoint.x;
        return this.handleRightValueChange(value, existingValue, fixedScreenSize);
    };

    private handleRightWCSChange = (wcsString: string, fixedScreenSize: boolean = false): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlaySettings.numbers.formatTypeX)) {
            const topRightWCS = this.topRightWCS;
            if (topRightWCS) {
                const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: topRightWCS.y});
                if (newPoint) {
                    const value = newPoint.x;
                    const existingValue = this.topRightPoint.x;
                    return this.handleRightValueChange(value, existingValue, fixedScreenSize);
                }
            }
        }
        return false;
    };

    private handleTopValueChange = (value: number, existingValue: number, fixedScreenSize: boolean = false): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const centerPoint = region.center;
            const scale = fixedScreenSize ? AppStore.Instance.imageRatio / this.props.frame.zoomLevel : 1;
            const sizeDims = scale2D(region.size, scale);
            const bottomValue = centerPoint.y - sizeDims.y / 2.0;
            const newCenter = {x: centerPoint.x, y: (value + bottomValue) / 2.0};
            const newDims = {x: sizeDims.x / scale, y: Math.abs(value - bottomValue) / scale};
            if (newDims.x > 0 && newDims.y > 0) {
                region.setControlPoints([newCenter, newDims]);
                return true;
            }
        }
        return false;
    };

    private handleTopChange = (value: number, fixedScreenSize: boolean = false): boolean => {
        const existingValue = this.topRightPoint.y;
        return this.handleTopValueChange(value, existingValue, fixedScreenSize);
    };

    private handleTopWCSChange = (wcsString: string, fixedScreenSize: boolean = false): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlaySettings.numbers.formatTypeY)) {
            const topRightWCS = this.topRightWCS;
            if (topRightWCS) {
                const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: topRightWCS.x, y: wcsString});
                if (newPoint) {
                    const value = newPoint.y;
                    const existingValue = this.topRightPoint.y;
                    return this.handleTopValueChange(value, existingValue, fixedScreenSize);
                }
            }
        }
        return false;
    };

    private handleRotationChange = (value: number): boolean => {
        const existingValue = this.props.region.rotation;
        if (isFinite(value) && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setRotation(value);
            return true;
        }
        return false;
    };

    public render() {
        // dummy variables related to wcs to trigger re-render
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const system = AppStore.Instance.overlaySettings.global.explicitSystem;
        const formatX = AppStore.Instance.overlaySettings.numbers.formatTypeX;
        const formatY = AppStore.Instance.overlaySettings.numbers.formatTypeY;
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const region = this.props.region;
        const isTextAnnotation = region.regionType === CARTA.RegionType.ANNTEXT;
        if (!region || region.controlPoints.length !== 2 || (region.regionType !== CARTA.RegionType.RECTANGLE && region.regionType !== CARTA.RegionType.ANNRECTANGLE && region.regionType !== CARTA.RegionType.ANNTEXT)) {
            return null;
        }

        // center
        const centerPoint = region.center;
        const centerWCSPoint = this.centerWCS;
        const centerInputX = (
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
        const centerInputY = (
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
        const centerInfoString = region.coordinate === CoordinateMode.Image ? `WCS: ${centerWCSPoint ? WCSPoint2D.ToString(centerWCSPoint) : ""}` : `Image: ${Point2D.ToString(centerPoint, "px", 3)}`;

        const isRotated = Math.abs(region.rotation) > 1e-3;
        // bottom left
        const bottomLeftPoint = this.bottomLeftPoint;
        const bottomLeftWCSPoint = this.bottomLeftWCS;
        const bottomLeftInputX = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.XCoord}
                value={bottomLeftPoint?.x}
                onChange={(value: number) => this.handleLeftChange(value, isTextAnnotation)}
                valueWcs={bottomLeftWCSPoint?.x || null}
                onChangeWcs={this.handleLeftWCSChange}
                disabled={isRotated}
                wcsDisabled={!this.props.wcsInfo || !bottomLeftWCSPoint || isRotated}
            />
        );
        const bottomLeftInputY = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.YCoord}
                value={bottomLeftPoint?.y}
                onChange={(value: number) => this.handleBottomChange(value, isTextAnnotation)}
                valueWcs={bottomLeftWCSPoint?.y || null}
                onChangeWcs={this.handleBottomWCSChange}
                disabled={isRotated}
                wcsDisabled={!this.props.wcsInfo || !bottomLeftWCSPoint || isRotated}
            />
        );
        const bottomLeftInfoString = region.coordinate === CoordinateMode.Image ? `WCS: ${bottomLeftWCSPoint ? WCSPoint2D.ToString(bottomLeftWCSPoint) : ""}` : `Image: ${Point2D.ToString(this.bottomLeftPoint, "px", 3)}`;

        // top right
        const topRightPoint = this.topRightPoint;
        const topRightWCSPoint = this.topRightWCS;
        const topRightInputX = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.XCoord}
                value={topRightPoint?.x}
                onChange={(value: number) => this.handleRightChange(value, isTextAnnotation)}
                valueWcs={topRightWCSPoint?.x || null}
                onChangeWcs={this.handleRightWCSChange}
                disabled={isRotated}
                wcsDisabled={!this.props.wcsInfo || !topRightWCSPoint || isRotated}
            />
        );
        const topRightInputY = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.YCoord}
                value={topRightPoint?.y}
                onChange={(value: number) => this.handleTopChange(value, isTextAnnotation)}
                valueWcs={topRightWCSPoint?.y || null}
                onChangeWcs={this.handleTopWCSChange}
                disabled={isRotated}
                wcsDisabled={!this.props.wcsInfo || !topRightWCSPoint || isRotated}
            />
        );
        const topRightInfoString = region.coordinate === CoordinateMode.Image ? `WCS: ${topRightWCSPoint ? WCSPoint2D.ToString(topRightWCSPoint) : ""}` : `Image: ${Point2D.ToString(this.topRightPoint, "px", 3)}`;

        // size
        const size = isTextAnnotation ? scale2D(region.size, AppStore.Instance.imageRatio / this.props.frame.zoomLevel) : region.size;
        const sizeWCS = this.sizeWCS;
        const sizeWidthInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.Size}
                value={size.x}
                onChange={(value: number) => this.handleWidthChange(value, isTextAnnotation)}
                valueWcs={sizeWCS?.x || null}
                onChangeWcs={(wcsValue: string) => this.handleWidthWCSChange(wcsValue, isTextAnnotation)}
                wcsDisabled={!this.props.wcsInfo}
                customPlaceholder="Width"
            />
        );
        const sizeHeightInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.Size}
                value={size.y}
                onChange={(value: number) => this.handleHeightChange(value, isTextAnnotation)}
                valueWcs={sizeWCS?.y || null}
                onChangeWcs={(wcsValue: string) => this.handleHeightWCSChange(wcsValue, isTextAnnotation)}
                wcsDisabled={!this.props.wcsInfo}
                customPlaceholder="Height"
            />
        );
        const sizeInfoString = region.coordinate === CoordinateMode.Image ? `WCS: ${this.sizeWCS ? WCSPoint2D.ToString(this.sizeWCS) : ""}` : `Image: ${Point2D.ToString(size, "px", 3)}`;
        const pxUnit = region.coordinate === CoordinateMode.Image ? "(px)" : "";

        return (
            <div className="region-form">
                <FormGroup label={region.isAnnotation ? "Annotation name" : "Region name"} inline={true}>
                    <InputGroup placeholder={region.isAnnotation ? "Enter an annotation name" : "Enter a region name"} value={region.name} onChange={this.handleNameChange} />
                </FormGroup>
                {region.regionType === CARTA.RegionType.ANNTEXT && (
                    <FormGroup className="ann-text-input" label="Text" inline={true}>
                        <TextArea placeholder="Enter text annotation" value={(region as TextAnnotationStore).text} onChange={event => (region as TextAnnotationStore).setText(event.currentTarget.value)} />
                    </FormGroup>
                )}
                <FormGroup label="Coordinate" inline={true}>
                    <CoordinateComponent selectedValue={region.coordinate} onChange={region.setCoordinate} disableCoordinate={!this.props.wcsInfo} />
                </FormGroup>
                <FormGroup label="Center" labelInfo={pxUnit} inline={true}>
                    {centerInputX}
                    {centerInputY}
                    <span className="info-string">{centerInfoString}</span>
                </FormGroup>
                <FormGroup label="Size" labelInfo={pxUnit} inline={true}>
                    {sizeWidthInput}
                    {sizeHeightInput}
                    <span className="info-string">{sizeInfoString}</span>
                </FormGroup>
                <FormGroup label="Bottom-left" labelInfo={pxUnit} inline={true}>
                    {bottomLeftInputX}
                    {bottomLeftInputY}
                    <span className="info-string">{bottomLeftInfoString}</span>
                </FormGroup>
                <FormGroup label="Top-right" labelInfo={pxUnit} inline={true}>
                    {topRightInputX}
                    {topRightInputY}
                    <span className="info-string">{topRightInfoString}</span>
                </FormGroup>
                <FormGroup label="P.A." labelInfo="(deg)" inline={true}>
                    <ImageCoordNumericInput value={region.rotation} onChange={this.handleRotationChange} disabled={!this.props.frame?.hasSquarePixels} customPlaceholder="P.A." />
                </FormGroup>
            </div>
        );
    }
}
