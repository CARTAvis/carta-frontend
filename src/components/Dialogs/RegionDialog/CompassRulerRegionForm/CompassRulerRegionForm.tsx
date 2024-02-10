import * as React from "react";
import {FormGroup, InputGroup} from "@blueprintjs/core";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {observer} from "mobx-react";

import {CoordinateComponent, CoordNumericInput, InputType, SafeNumericInput} from "components/Shared";
import {Point2D, WCSPoint2D} from "models";
import {CompassAnnotationStore, CoordinateMode, FrameStore, RegionStore} from "stores/Frame";
import {getFormattedWCSPoint, getPixelValueFromWCS, isWCSStringFormatValid} from "utilities";

const KEYCODE_ENTER = 13;

@observer
export class CompassRulerRegionForm extends React.Component<{region: RegionStore; frame: FrameStore; wcsInfo: AST.FrameSet}> {
    private handleNameChange = (formEvent: React.FormEvent<HTMLInputElement>) => {
        this.props.region.setName(formEvent.currentTarget.value);
    };

    private handleLengthValueChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        } else {
            (this.props.region as CompassAnnotationStore).setLength(Number(ev.target.value));
        }
    };

    private handleValueChange = (WCSStart: WCSPoint2D, WCSFinish: WCSPoint2D, isX: boolean, finish?: boolean, pixel?: boolean) => {
        const region = this.props.region;
        const wcsInfo = this.props.wcsInfo;
        if (pixel) {
            return (value: number): boolean => {
                if (!isFinite(value)) {
                    return false;
                }
                if (isX && finish) {
                    region?.setControlPoint(1, {x: value, y: region?.controlPoints[1].y});
                } else if (finish) {
                    region?.setControlPoint(1, {x: region?.controlPoints[1].x, y: value});
                } else if (isX) {
                    region?.setControlPoint(0, {x: value, y: region?.controlPoints[0].y});
                } else {
                    region?.setControlPoint(0, {x: region?.controlPoints[0].x, y: value});
                }
                return true;
            };
        } else {
            return (value: string): boolean => {
                if (!wcsInfo) {
                    return false;
                }
                if (isX && isWCSStringFormatValid(value, this.props.frame.overlayStore.numbers.formatTypeX)) {
                    if (finish) {
                        const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSFinish, x: value});
                        region?.setControlPoint(1, finishPixelFromWCS);
                    } else {
                        const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, x: value});
                        region?.setControlPoint(0, startPixelFromWCS);
                    }
                    return true;
                } else if (!isX && isWCSStringFormatValid(value, this.props.frame.overlayStore.numbers.formatTypeY)) {
                    if (finish) {
                        const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSFinish, y: value});
                        region?.setControlPoint(1, finishPixelFromWCS);
                    } else {
                        const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, y: value});
                        region?.setControlPoint(0, startPixelFromWCS);
                    }
                    return true;
                }
                return false;
            };
        }
    };

    private coordinateInput = (WCSStart, WCSFinish, finish: boolean) => {
        const region = this.props.region;
        return (
            <>
                <CoordNumericInput
                    coord={region.coordinate}
                    inputType={InputType.XCoord}
                    value={finish ? region?.controlPoints[1].x : region?.controlPoints[0].x}
                    onChange={this.handleValueChange(WCSStart, WCSFinish, true, finish, true) as (val: number) => boolean}
                    valueWcs={finish ? WCSFinish?.x : WCSStart?.x}
                    onChangeWcs={this.handleValueChange(WCSStart, WCSFinish, true, finish, false) as (val: string) => boolean}
                    wcsDisabled={!this.props.wcsInfo || !(finish ? WCSFinish : WCSStart)}
                />
                <CoordNumericInput
                    coord={region.coordinate}
                    inputType={InputType.YCoord}
                    value={finish ? region?.controlPoints[1].y : region?.controlPoints[0].y}
                    onChange={this.handleValueChange(WCSStart, WCSFinish, false, finish, true) as (val: number) => boolean}
                    valueWcs={finish ? WCSFinish?.y : WCSStart?.y}
                    onChangeWcs={this.handleValueChange(WCSStart, WCSFinish, false, finish, false) as (val: string) => boolean}
                    wcsDisabled={!this.props.wcsInfo || !(finish ? WCSFinish : WCSStart)}
                />
            </>
        );
    };

    render() {
        // dummy variables related to wcs to trigger re-render
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const system = this.props.frame.overlayStore.global.explicitSystem;
        const formatX = this.props.frame.overlayStore.numbers.formatTypeX;
        const formatY = this.props.frame.overlayStore.numbers.formatTypeY;
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const region = this.props.region;
        const wcsInfo = this.props.wcsInfo;
        const isWCS = region.coordinate === CoordinateMode.World;
        const WCSStart = getFormattedWCSPoint(wcsInfo, region?.controlPoints[0]);
        const WCSFinish = getFormattedWCSPoint(wcsInfo, region?.controlPoints[1]);
        const compassLength = (region as CompassAnnotationStore).length;

        return (
            <div className="region-form">
                <FormGroup label="Annotation name" inline={true}>
                    <InputGroup placeholder="Enter an annotation name" value={region.name} onChange={this.handleNameChange} />
                </FormGroup>
                {region.regionType === CARTA.RegionType.ANNCOMPASS && (
                    <>
                        <FormGroup label="North label" inline={true}>
                            <InputGroup placeholder="Enter north label" value={(region as CompassAnnotationStore).northLabel} onChange={event => (region as CompassAnnotationStore).setLabel(event.currentTarget.value, true)} />
                        </FormGroup>
                        <FormGroup label="East label" inline={true}>
                            <InputGroup placeholder="Enter east label" value={(region as CompassAnnotationStore).eastLabel} onChange={event => (region as CompassAnnotationStore).setLabel(event.currentTarget.value, false)} />
                        </FormGroup>
                    </>
                )}
                <FormGroup label="Coordinate" inline={true}>
                    <CoordinateComponent selectedValue={region.coordinate} onChange={region.setCoordinate} disableCoordinate={!this.props.wcsInfo} />
                </FormGroup>
                {region.regionType === CARTA.RegionType.ANNCOMPASS && (
                    <FormGroup label="Length" labelInfo="(canvas px)" inline={true}>
                        <SafeNumericInput selectAllOnFocus buttonPosition="none" value={compassLength} onBlur={this.handleLengthValueChange} onKeyDown={this.handleLengthValueChange} />
                    </FormGroup>
                )}
                <FormGroup label={region.regionType === CARTA.RegionType.ANNCOMPASS ? "Origin" : "Start"} labelInfo={wcsInfo ? "" : " (px)"} inline={true}>
                    {this.coordinateInput(WCSStart, WCSFinish, false)}
                    {wcsInfo ? <span className="info-string">{isWCS && wcsInfo ? `Image: ${Point2D.ToString(region?.controlPoints[0], "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSStart)}`}</span> : ""}
                </FormGroup>
                {region.regionType === CARTA.RegionType.ANNRULER && (
                    <FormGroup label="Finish" labelInfo={wcsInfo ? "" : " (px)"} inline={true}>
                        {this.coordinateInput(WCSStart, WCSFinish, true)}
                        {wcsInfo ? <span className="info-string">{isWCS && wcsInfo ? `Image: ${Point2D.ToString(region?.controlPoints[1], "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSFinish)}`}</span> : ""}
                    </FormGroup>
                )}
            </div>
        );
    }
}
