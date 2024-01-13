import * as React from "react";
import {FormGroup, InputGroup} from "@blueprintjs/core";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {computed} from "mobx";
import {observer} from "mobx-react";

import {CoordinateComponent, CoordNumericInput, InputType} from "components/Shared";
import {Point2D, WCSPoint2D} from "models";
import {AppStore} from "stores";
import {CoordinateMode, FrameStore, PointAnnotationStore, RegionStore} from "stores/Frame";
import {closeTo, getFormattedWCSPoint, getPixelValueFromWCS, isWCSStringFormatValid} from "utilities";

@observer
export class PointRegionForm extends React.Component<{region: RegionStore; frame: FrameStore; wcsInfo: AST.FrameSet}> {
    private static readonly REGION_PIXEL_EPS = 1.0e-3;

    @computed get centerWCS(): WCSPoint2D {
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
        if (isFinite(value) && !closeTo(value, existingValue, PointRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setCenter({x: value, y: this.props.region.center.y});
            return true;
        }
        return false;
    };

    private handleCenterYChange = (value: number): boolean => {
        const existingValue = this.props.region.center.y;
        if (isFinite(value) && !closeTo(value, existingValue, PointRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setCenter({x: this.props.region.center.x, y: value});
            return true;
        }
        return false;
    };

    private handleCenterWCSXChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, this.props.frame.overlayStore.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.centerWCS.y});
            const existingValue = this.props.region.center.x;
            if (isFinite(newPoint?.x) && !closeTo(newPoint.x, existingValue, PointRegionForm.REGION_PIXEL_EPS)) {
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
            if (isFinite(newPoint?.y) && !closeTo(newPoint.y, existingValue, PointRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setCenter(newPoint);
                return true;
            }
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

        const region = this.props.region as PointAnnotationStore;
        if (!region || (region.regionType !== CARTA.RegionType.POINT && region.regionType !== CARTA.RegionType.ANNPOINT)) {
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
                valueWcs={centerWCSPoint?.x}
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
                valueWcs={centerWCSPoint?.y}
                onChangeWcs={this.handleCenterWCSYChange}
                wcsDisabled={!this.props.wcsInfo || !centerWCSPoint}
            />
        );

        const infoString = region.coordinate === CoordinateMode.Image ? `WCS: ${WCSPoint2D.ToString(centerWCSPoint)}` : `Image: ${Point2D.ToString(centerPoint, "px", 3)}`;
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
            </div>
        );
    }
}
