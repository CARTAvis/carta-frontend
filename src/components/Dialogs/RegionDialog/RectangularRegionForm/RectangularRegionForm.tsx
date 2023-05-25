import * as React from "react";
import {FormGroup, InputGroup, TextArea} from "@blueprintjs/core";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {computed} from "mobx";
import {observer} from "mobx-react";

import {CoordinateComponent, CoordNumericInput, ImageCoordNumericInput, InputType} from "components/Shared";
import {Point2D, WCSPoint2D} from "models";
import {AppStore} from "stores";
import {CoordinateMode, FrameStore, RegionStore, TextAnnotationStore, WCS_PRECISION} from "stores/Frame";
import {closeTo, formattedArcsec, getFormattedWCSPoint, getPixelValueFromWCS, getValueFromArcsecString, isWCSStringFormatValid} from "utilities";

import "./RectangularRegionForm.scss";

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

    @computed get centerWCS(): WCSPoint2D {
        const region = this.props.region;
        if (!region || !this.props.wcsInfo) {
            return null;
        }
        return getFormattedWCSPoint(this.props.wcsInfo, region.center);
    }

    @computed get topRightWCS(): WCSPoint2D {
        const region = this.props.region;
        if (!region || !this.props.wcsInfo) {
            return null;
        }
        return getFormattedWCSPoint(this.props.wcsInfo, this.topRightPoint);
    }

    @computed get bottomLeftWCS(): WCSPoint2D {
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
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.centerWCS.y});
            const existingValue = this.props.region.center.x;
            if (isFinite(newPoint?.x) && !closeTo(newPoint.x, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setCenter(newPoint);
                return true;
            }
        }
        return false;
    };

    private handleCenterWCSYChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: this.centerWCS.x, y: wcsString});
            const existingValue = this.props.region.center.y;
            if (isFinite(newPoint?.y) && !closeTo(newPoint.y, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setCenter(newPoint);
                return true;
            }
        }
        return false;
    };

    private handleWidthChange = (value: number): boolean => {
        const existingValue = this.props.region.size.x;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: value, y: this.props.region.size.y});
            return true;
        }
        return false;
    };

    private handleWidthWCSChange = (wcsString: string): boolean => {
        const value = this.props.frame.getImageXValueFromArcsec(getValueFromArcsecString(wcsString));
        const existingValue = this.props.region.size.x;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: value, y: this.props.region.size.y});
            return true;
        }
        return false;
    };

    private handleHeightChange = (value: number): boolean => {
        const existingValue = this.props.region.size.y;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: this.props.region.size.x, y: value});
            return true;
        }
        return false;
    };

    private handleHeightWCSChange = (wcsString: string): boolean => {
        const value = this.props.frame.getImageYValueFromArcsec(getValueFromArcsecString(wcsString));
        const existingValue = this.props.region.size.y;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, RectangularRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: this.props.region.size.x, y: value});
            return true;
        }
        return false;
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

    private handleLeftChange = (value: number): boolean => {
        const existingValue = this.bottomLeftPoint.x;
        return this.handleLeftValueChange(value, existingValue);
    };

    private handleLeftWCSChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.bottomLeftWCS.y});
            const value = newPoint.x;
            const existingValue = this.bottomLeftPoint.x;
            return this.handleLeftValueChange(value, existingValue);
        }
        return false;
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

    private handleBottomChange = (value: number): boolean => {
        const existingValue = this.bottomLeftPoint.y;
        return this.handleBottomValueChange(value, existingValue);
    };

    private handleBottomWCSChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: this.bottomLeftWCS.x, y: wcsString});
            const value = newPoint.y;
            const existingValue = this.bottomLeftPoint.y;
            return this.handleBottomValueChange(value, existingValue);
        }
        return false;
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

    private handleRightChange = (value: number): boolean => {
        const existingValue = this.topRightPoint.x;
        return this.handleRightValueChange(value, existingValue);
    };

    private handleRightWCSChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.topRightWCS.y});
            const value = newPoint.x;
            const existingValue = this.topRightPoint.x;
            return this.handleRightValueChange(value, existingValue);
        }
        return false;
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

    private handleTopChange = (value: number): boolean => {
        const existingValue = this.topRightPoint.y;
        return this.handleTopValueChange(value, existingValue);
    };

    private handleTopWCSChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: this.topRightWCS.x, y: wcsString});
            const value = newPoint.y;
            const existingValue = this.topRightPoint.y;
            return this.handleTopValueChange(value, existingValue);
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const system = AppStore.Instance.overlayStore.global.explicitSystem;
        const region = this.props.region;
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

        const isRotated = Math.abs(region.rotation) > 1e-3;
        // bottom left
        const bottomLeftPoint = this.bottomLeftPoint;
        const bottomLeftWCSPoint = this.bottomLeftWCS;
        const bottomLeftInputX = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.XCoord}
                value={bottomLeftPoint?.x}
                onChange={this.handleLeftChange}
                valueWcs={bottomLeftWCSPoint?.x}
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
                onChange={this.handleBottomChange}
                valueWcs={bottomLeftWCSPoint?.y}
                onChangeWcs={this.handleBottomWCSChange}
                disabled={isRotated}
                wcsDisabled={!this.props.wcsInfo || !bottomLeftWCSPoint || isRotated}
            />
        );
        const bottomLeftInfoString = region.coordinate === CoordinateMode.Image ? `WCS: ${WCSPoint2D.ToString(bottomLeftWCSPoint)}` : `Image: ${Point2D.ToString(this.bottomLeftPoint, "px", 3)}`;

        // top right
        const topRightPoint = this.topRightPoint;
        const topRightWCSPoint = this.topRightWCS;
        const topRightInputX = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.XCoord}
                value={topRightPoint?.x}
                onChange={this.handleRightChange}
                valueWcs={topRightWCSPoint?.x}
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
                onChange={this.handleTopChange}
                valueWcs={topRightWCSPoint?.y}
                onChangeWcs={this.handleTopWCSChange}
                disabled={isRotated}
                wcsDisabled={!this.props.wcsInfo || !topRightWCSPoint || isRotated}
            />
        );
        const topRightInfoString = region.coordinate === CoordinateMode.Image ? `WCS: ${WCSPoint2D.ToString(topRightWCSPoint)}` : `Image: ${Point2D.ToString(this.topRightPoint, "px", 3)}`;

        // size
        const size = region.size;
        const sizeWCS = this.sizeWCS;
        const sizeWidthInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.Size}
                value={size.x}
                onChange={this.handleWidthChange}
                valueWcs={sizeWCS?.x}
                onChangeWcs={this.handleWidthWCSChange}
                wcsDisabled={!this.props.wcsInfo}
                customPlaceholder="Width"
            />
        );
        const sizeHeightInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.Size}
                value={size.y}
                onChange={this.handleHeightChange}
                valueWcs={sizeWCS?.y}
                onChangeWcs={this.handleHeightWCSChange}
                wcsDisabled={!this.props.wcsInfo}
                customPlaceholder="Height"
            />
        );
        const sizeInfoString = region.coordinate === CoordinateMode.Image ? `WCS: ${WCSPoint2D.ToString(this.sizeWCS)}` : `Image: ${Point2D.ToString(size, "px", 3)}`;
        const pxUnit = region.coordinate === CoordinateMode.Image ? "(px)" : "";
        return (
            <div className="region-form">
                <FormGroup label={region.isAnnotation ? "Annotation name" : "Region name"} inline={true}>
                    <InputGroup placeholder={region.isAnnotation ? "Enter an annotation name" : "Enter a region name"} value={region.name} onChange={this.handleNameChange} spellCheck={false} />
                </FormGroup>
                {region.regionType === CARTA.RegionType.ANNTEXT && (
                    <FormGroup className="ann-text-input" label="Text" inline={true}>
                        <TextArea placeholder="Enter text annotation" value={(region as TextAnnotationStore).text} onChange={event => (region as TextAnnotationStore).setText(event.currentTarget.value)} spellCheck={false} />
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
