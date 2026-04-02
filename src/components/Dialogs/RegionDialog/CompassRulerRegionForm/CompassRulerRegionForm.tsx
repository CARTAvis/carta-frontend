import * as React from "react";
import {FormGroup, InputGroup} from "@blueprintjs/core";
import type * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {observer} from "mobx-react";

import {CoordinateComponent, CoordNumericInput, SafeNumericInput} from "components/Shared";
import {CoordinateMode, InputType} from "enums";
import {Point2D, WCSPoint2D} from "models";
import {AppStore} from "stores";
import {type CompassAnnotationStore, type RegionStore} from "stores/Frame";
import {getFormattedWCSPoint, getPixelValueFromWCS, isWCSStringFormatValid} from "utilities";

const KEYCODE_ENTER = 13;

@observer
export class CompassRulerRegionForm extends React.Component<{region: RegionStore; wcsInfo: AST.FrameSet}> {
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

    // eslint-disable-next-line @typescript-eslint/naming-convention
    private handleValueChange = (wcsStart: WCSPoint2D, wcsFinish: WCSPoint2D, isX: boolean, finish?: boolean, pixel?: boolean) => {
        const region = this.props.region;
        const wcsInfo = this.props.wcsInfo;
        const appStore = AppStore.Instance;
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
                if (isX && isWCSStringFormatValid(value, appStore.overlaySettings.numbers.formatTypeX)) {
                    if (finish) {
                        const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...wcsFinish, x: value});
                        if (finishPixelFromWCS) {
                            region?.setControlPoint(1, finishPixelFromWCS);
                        }
                    } else {
                        const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...wcsStart, x: value});
                        if (startPixelFromWCS) {
                            region?.setControlPoint(0, startPixelFromWCS);
                        }
                    }
                    return true;
                } else if (!isX && isWCSStringFormatValid(value, appStore.overlaySettings.numbers.formatTypeY)) {
                    if (finish) {
                        const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...wcsFinish, y: value});
                        if (finishPixelFromWCS) {
                            region?.setControlPoint(1, finishPixelFromWCS);
                        }
                    } else {
                        const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...wcsStart, y: value});
                        if (startPixelFromWCS) {
                            region?.setControlPoint(0, startPixelFromWCS);
                        }
                    }
                    return true;
                }
                return false;
            };
        }
    };

    private coordinateInput = (wcsStart, wcsFinish, isFinish: boolean) => {
        const region = this.props.region;
        return (
            <>
                <CoordNumericInput
                    coord={region.coordinate}
                    inputType={InputType.XCoord}
                    value={isFinish ? region?.controlPoints[1].x : region?.controlPoints[0].x}
                    onChange={this.handleValueChange(wcsStart, wcsFinish, true, isFinish, true) as (val: number) => boolean}
                    valueWcs={isFinish ? wcsFinish?.x : wcsStart?.x}
                    onChangeWcs={this.handleValueChange(wcsStart, wcsFinish, true, isFinish, false) as (val: string) => boolean}
                    wcsDisabled={!this.props.wcsInfo || !(isFinish ? wcsFinish : wcsStart)}
                />
                <CoordNumericInput
                    coord={region.coordinate}
                    inputType={InputType.YCoord}
                    value={isFinish ? region?.controlPoints[1].y : region?.controlPoints[0].y}
                    onChange={this.handleValueChange(wcsStart, wcsFinish, false, isFinish, true) as (val: number) => boolean}
                    valueWcs={isFinish ? wcsFinish?.y : wcsStart?.y}
                    onChangeWcs={this.handleValueChange(wcsStart, wcsFinish, false, isFinish, false) as (val: string) => boolean}
                    wcsDisabled={!this.props.wcsInfo || !(isFinish ? wcsFinish : wcsStart)}
                />
            </>
        );
    };

    render() {
        const overlaySettings = AppStore.Instance.overlaySettings;
        // dummy variables related to wcs to trigger re-render
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const system = overlaySettings.global.explicitSystem;
        const formatX = overlaySettings.numbers.formatTypeX;
        const formatY = overlaySettings.numbers.formatTypeY;
        /* eslint-enable @typescript-eslint/no-unused-vars */
        const isImgCoordinates = overlaySettings.isImgCoordinates;

        const region = this.props.region;
        const wcsInfo = this.props.wcsInfo;
        const isWCS = region.coordinate === CoordinateMode.World;
        const wcsStart = getFormattedWCSPoint(wcsInfo, region?.controlPoints[0]);
        const wcsFinish = getFormattedWCSPoint(wcsInfo, region?.controlPoints[1]);
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
                    {this.coordinateInput(wcsStart, wcsFinish, false)}
                    {wcsInfo ? (
                        <span className="info-string">{isWCS && wcsInfo ? `Image: ${Point2D.ToString(region?.controlPoints[0], "px", 3)}` : `WCS: ${isImgCoordinates ? "-" : wcsStart ? WCSPoint2D.ToString(wcsStart) : ""}`}</span>
                    ) : (
                        ""
                    )}
                </FormGroup>
                {region.regionType === CARTA.RegionType.ANNRULER && (
                    <FormGroup label="Finish" labelInfo={wcsInfo ? "" : " (px)"} inline={true}>
                        {this.coordinateInput(wcsStart, wcsFinish, true)}
                        {wcsInfo ? (
                            <span className="info-string">{isWCS && wcsInfo ? `Image: ${Point2D.ToString(region?.controlPoints[1], "px", 3)}` : `WCS: ${isImgCoordinates ? "-" : wcsFinish ? WCSPoint2D.ToString(wcsFinish) : ""}`}</span>
                        ) : (
                            ""
                        )}
                    </FormGroup>
                )}
            </div>
        );
    }
}
