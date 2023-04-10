import * as React from "react";
import {FormGroup, InputGroup} from "@blueprintjs/core";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {observer} from "mobx-react";

import {CoordinateComponent, CoordNumericInput, InputType} from "components/Shared";
import {Point2D, WCSPoint2D} from "models";
import {AppStore} from "stores";
import {CoordinateMode, RegionStore} from "stores/Frame";
import {closeTo, getFormattedWCSPoint, getPixelValueFromWCS, isWCSStringFormatValid} from "utilities";

@observer
export class PolygonRegionForm extends React.Component<{region: RegionStore; wcsInfo: AST.FrameSet}> {
    private static readonly REGION_PIXEL_EPS = 1.0e-3;

    private handleNameChange = ev => {
        this.props.region.setName(ev.currentTarget.value);
    };

    private handlePointChange = (index: number, isXCoordinate: boolean) => {
        return (value: number): boolean => {
            const region = this.props.region;
            const existingValue = isXCoordinate ? region.controlPoints[index].x : region.controlPoints[index].y;
            if (isFinite(value) && !closeTo(value, existingValue, PolygonRegionForm.REGION_PIXEL_EPS)) {
                if (isXCoordinate) {
                    this.props.region.setControlPoint(index, {x: value, y: this.props.region.controlPoints[index].y});
                } else {
                    this.props.region.setControlPoint(index, {x: this.props.region.controlPoints[index].x, y: value});
                }
                return true;
            }
            return false;
        };
    };

    private handleWCSPointChange = (index: number, isXCoordinate: boolean) => {
        return (wcsString: string): boolean => {
            const region = this.props.region;
            const pointWCS = getFormattedWCSPoint(this.props.wcsInfo, region.controlPoints[index]);
            if (isWCSStringFormatValid(wcsString, isXCoordinate ? AppStore.Instance.overlayStore.numbers.formatTypeX : AppStore.Instance.overlayStore.numbers.formatTypeY)) {
                const newPoint = getPixelValueFromWCS(this.props.wcsInfo, isXCoordinate ? {x: wcsString, y: pointWCS.y} : {x: pointWCS.x, y: wcsString});
                if (!newPoint) {
                    return false;
                }
                const value = isXCoordinate ? newPoint.x : newPoint.y;
                const existingValue = isXCoordinate ? region.controlPoints[index].x : region.controlPoints[index].y;

                if (isFinite(value) && !closeTo(value, existingValue, PolygonRegionForm.REGION_PIXEL_EPS)) {
                    this.props.region.setControlPoint(index, newPoint);
                    return true;
                }
            }
            return false;
        };
    };

    public render() {
        // dummy variables related to wcs to trigger re-render
        // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
        const system = AppStore.Instance.overlayStore.global.explicitSystem;
        const region = this.props.region;
        if (
            !region ||
            !region.isValid ||
            (region.regionType !== CARTA.RegionType.POLYGON && region.regionType !== CARTA.RegionType.POLYLINE && region.regionType !== CARTA.RegionType.ANNPOLYLINE && region.regionType !== CARTA.RegionType.ANNPOLYGON)
        ) {
            return null;
        }

        const pxUnit = region.coordinate === CoordinateMode.Image ? "(px)" : "";

        const pointRows = region.controlPoints.map((point, index) => {
            const pointWCS = getFormattedWCSPoint(this.props.wcsInfo, point);
            const xInput = (
                <CoordNumericInput
                    coord={region.coordinate}
                    inputType={InputType.XCoord}
                    value={point.x}
                    onChange={this.handlePointChange(index, true)}
                    valueWcs={pointWCS?.x}
                    onChangeWcs={this.handleWCSPointChange(index, true)}
                    wcsDisabled={!this.props.wcsInfo || !pointWCS}
                />
            );
            const yInput = (
                <CoordNumericInput
                    coord={region.coordinate}
                    inputType={InputType.YCoord}
                    value={point.y}
                    onChange={this.handlePointChange(index, false)}
                    valueWcs={pointWCS?.y}
                    onChangeWcs={this.handleWCSPointChange(index, false)}
                    wcsDisabled={!this.props.wcsInfo || !pointWCS}
                />
            );
            const infoString = region.coordinate === CoordinateMode.Image ? `WCS: ${WCSPoint2D.ToString(pointWCS)}` : `Image: ${Point2D.ToString(point, "px", 3)}`;
            return (
                <FormGroup label={`Point ${index}`} labelInfo={pxUnit} inline={true} key={index}>
                    {xInput}
                    {yInput}
                    <span className="info-string">{infoString}</span>
                </FormGroup>
            );
        });

        return (
            <div className="region-form">
                <FormGroup label={region.isAnnotation ? "Annotation name" : "Region name"} inline={true}>
                    <InputGroup placeholder={region.isAnnotation ? "Enter an annotation name" : "Enter a region name"} value={region.name} onChange={this.handleNameChange} spellCheck={false}/>
                </FormGroup>
                <FormGroup label="Coordinate" inline={true}>
                    <CoordinateComponent selectedValue={region.coordinate} onChange={region.setCoordinate} disableCoordinate={!this.props.wcsInfo} />
                </FormGroup>
                {pointRows}
            </div>
        );
    }
}
