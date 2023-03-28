import * as React from "react";
import {FormGroup, InputGroup, Position} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {CoordinateComponent, SafeNumericInput} from "components/Shared";
import {Point2D, WCSPoint2D} from "models";
import {AppStore, NUMBER_FORMAT_LABEL} from "stores";
import {CoordinateMode, RegionStore} from "stores/Frame";
import {closeTo, getFormattedWCSPoint, getPixelValueFromWCS, isWCSStringFormatValid} from "utilities";

import "./PolygonRegionForm.scss";

const KEYCODE_ENTER = 13;

@observer
export class PolygonRegionForm extends React.Component<{region: RegionStore; wcsInfo: AST.FrameSet}> {
    private static readonly REGION_PIXEL_EPS = 1.0e-3;

    @observable displayColorPicker: boolean;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    private handleNameChange = ev => {
        this.props.region.setName(ev.currentTarget.value);
    };

    private handlePointChange = (index: number, isXCoordinate: boolean, ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const region = this.props.region;

        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = isXCoordinate ? region.controlPoints[index].x : region.controlPoints[index].y;

        if (isFinite(value) && !closeTo(value, existingValue, PolygonRegionForm.REGION_PIXEL_EPS)) {
            if (isXCoordinate) {
                this.props.region.setControlPoint(index, {x: value, y: this.props.region.controlPoints[index].y});
            } else {
                this.props.region.setControlPoint(index, {x: this.props.region.controlPoints[index].x, y: value});
            }
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleWCSPointChange = (index: number, isXCoordinate: boolean, ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const region = this.props.region;
        const pointWCS = getFormattedWCSPoint(this.props.wcsInfo, region.controlPoints[index]);
        if (!pointWCS) {
            return;
        }

        const wcsString = ev.currentTarget.value;
        if (wcsString === (isXCoordinate ? pointWCS.x : pointWCS.y)) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, isXCoordinate ? AppStore.Instance.overlayStore.numbers.formatTypeX : AppStore.Instance.overlayStore.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, isXCoordinate ? {x: wcsString, y: pointWCS.y} : {x: pointWCS.x, y: wcsString});
            if (!newPoint) {
                return;
            }
            const value = isXCoordinate ? newPoint.x : newPoint.y;
            const existingValue = isXCoordinate ? region.controlPoints[index].x : region.controlPoints[index].y;

            if (isFinite(value) && !closeTo(value, existingValue, PolygonRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setControlPoint(index, newPoint);
                return;
            }
        }

        ev.currentTarget.value = isXCoordinate ? pointWCS.x : pointWCS.y;
    };

    public render() {
        // dummy variables related to wcs to trigger re-render
        // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
        const system = AppStore.Instance.overlayStore.global.explicitSystem;
        const formatX = AppStore.Instance.overlayStore.numbers.formatTypeX;
        const formatY = AppStore.Instance.overlayStore.numbers.formatTypeY;
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
            let xInput, yInput;
            if (region.coordinate === CoordinateMode.Image) {
                xInput = (
                    <SafeNumericInput
                        selectAllOnFocus={true}
                        buttonPosition="none"
                        placeholder="X coordinate"
                        value={point.x}
                        onBlur={evt => this.handlePointChange(index, true, evt)}
                        onKeyDown={evt => this.handlePointChange(index, true, evt)}
                    />
                );
                yInput = (
                    <SafeNumericInput
                        selectAllOnFocus={true}
                        buttonPosition="none"
                        placeholder="Y coordinate"
                        value={point.y}
                        onBlur={evt => this.handlePointChange(index, false, evt)}
                        onKeyDown={evt => this.handlePointChange(index, false, evt)}
                    />
                );
            } else {
                xInput = (
                    <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatX)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <SafeNumericInput
                            allowNumericCharactersOnly={false}
                            buttonPosition="none"
                            placeholder="X WCS coordinate"
                            disabled={!this.props.wcsInfo || !pointWCS}
                            value={pointWCS ? pointWCS.x : ""}
                            onBlur={evt => this.handleWCSPointChange(index, true, evt)}
                            onKeyDown={evt => this.handleWCSPointChange(index, true, evt)}
                        />
                    </Tooltip2>
                );
                yInput = (
                    <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatY)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                        <SafeNumericInput
                            allowNumericCharactersOnly={false}
                            buttonPosition="none"
                            placeholder="Y WCS coordinate"
                            disabled={!this.props.wcsInfo || !pointWCS}
                            value={pointWCS ? pointWCS.y : ""}
                            onBlur={evt => this.handleWCSPointChange(index, false, evt)}
                            onKeyDown={evt => this.handleWCSPointChange(index, false, evt)}
                        />
                    </Tooltip2>
                );
            }
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
            <div className="form-section polygon-region-form">
                <FormGroup label={region.isAnnotation ? "Annotation Name" : "Region Name"} inline={true}>
                    <InputGroup placeholder={region.isAnnotation ? "Enter an annotation name" : "Enter a region name"} value={region.name} onChange={this.handleNameChange} />
                </FormGroup>
                <FormGroup label="Coordinate" inline={true}>
                    <CoordinateComponent selectedValue={region.coordinate} onChange={region.setCoordinate} disableCoordinate={!this.props.wcsInfo} />
                </FormGroup>
                {pointRows}
            </div>
        );
    }
}
