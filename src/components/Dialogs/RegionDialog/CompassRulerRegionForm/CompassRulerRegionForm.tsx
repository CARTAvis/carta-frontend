import * as React from "react";
import {FormGroup, H5, InputGroup} from "@blueprintjs/core";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {observer} from "mobx-react";

import {CoordinateComponent, SafeNumericInput} from "components/Shared";
import {Point2D, WCSPoint2D} from "models";
import {AppStore} from "stores";
import {CompassAnnotationStore, CoordinateMode, RegionStore} from "stores/Frame";
import {getFormattedWCSPoint, getPixelValueFromWCS, isWCSStringFormatValid} from "utilities";

import "./CompassRulerRegionForm.scss";

const KEYCODE_ENTER = "Enter";

@observer
export class CompassRulerRegionForm extends React.Component<{region: RegionStore; wcsInfo: AST.FrameSet}> {
    private handleNameChange = (formEvent: React.FormEvent<HTMLInputElement>) => {
        this.props.region.setName(formEvent.currentTarget.value);
    };

    private handleValueChange = (
        event: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>,
        region: RegionStore,
        wcsInfo: AST.FrameSet,
        WCSStart: WCSPoint2D,
        WCSFinish: WCSPoint2D,
        isX: boolean,
        finish?: boolean,
        pixel?: boolean
    ) => {
        const target = event.target as HTMLInputElement;

        if (pixel) {
            const value = parseFloat(target.value);
            if (!isFinite(value)) {
                return;
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
        } else if (wcsInfo) {
            const value = target.value as string;
            if (isX && isWCSStringFormatValid(value, AppStore.Instance.overlayStore.numbers.formatTypeX)) {
                if (finish) {
                    const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSFinish, x: value});
                    region?.setControlPoint(1, finishPixelFromWCS);
                } else {
                    const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, x: value});
                    region?.setControlPoint(0, startPixelFromWCS);
                }
            } else if (!isX && isWCSStringFormatValid(value, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
                if (finish) {
                    const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSFinish, y: value});
                    region?.setControlPoint(1, finishPixelFromWCS);
                } else {
                    const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, y: value});
                    region?.setControlPoint(0, startPixelFromWCS);
                }
            } else {
                event.currentTarget.value = finish ? (isX ? WCSFinish.x : WCSFinish.y) : isX ? WCSStart.x : WCSStart.y;
            }
        }
    };

    private coordinateInput = (region, wcsInfo, WCSStart, WCSFinish, finish: boolean, pixel: boolean) => {
        const handleOnKeyDown = (isX: boolean) => {
            return (event: React.KeyboardEvent<HTMLInputElement>) => {
                if (event.type === "keydown" && event.key === KEYCODE_ENTER) {
                    this.handleValueChange(event, region, wcsInfo, WCSStart, WCSFinish, isX, finish, pixel);
                }
            };
        };

        return (
            <>
                <td>
                    <FormGroup inline={true}>
                        <SafeNumericInput
                            selectAllOnFocus
                            buttonPosition="none"
                            value={pixel ? (finish ? region?.controlPoints[1].x : region?.controlPoints[0].x) : finish ? WCSFinish?.x : WCSStart?.x}
                            onBlur={event => this.handleValueChange(event, region, wcsInfo, WCSStart, WCSFinish, true, finish, pixel)}
                            onKeyDown={handleOnKeyDown(true)}
                        />
                    </FormGroup>
                </td>
                <td>
                    <FormGroup inline={true}>
                        <SafeNumericInput
                            selectAllOnFocus
                            buttonPosition="none"
                            value={pixel ? (finish ? region?.controlPoints[1].y : region?.controlPoints[0].y) : finish ? WCSFinish?.y : WCSStart?.y}
                            onBlur={event => this.handleValueChange(event, region, wcsInfo, WCSStart, WCSFinish, false, finish, pixel)}
                            onKeyDown={handleOnKeyDown(false)}
                        />
                    </FormGroup>
                </td>
            </>
        );
    };

    private compassTextOffsetForm = (isNorth: boolean) => {
        if (this.props.region.regionType !== CARTA.RegionType.ANNCOMPASS) {
            return null;
        }

        return (
            <>
                {isNorth ? (
                    <>
                        <td>
                            <FormGroup inline={true} label="X Offset" labelInfo="(px)">
                                <SafeNumericInput
                                    placeholder="North X Offset"
                                    min={-50}
                                    max={RegionStore.MAX_DASH_LENGTH}
                                    value={(this.props.region as CompassAnnotationStore).northTextOffset.x}
                                    stepSize={0.5}
                                    onValueChange={value => (this.props.region as CompassAnnotationStore).setNorthTextOffset(value, true)}
                                />
                            </FormGroup>
                        </td>
                        <td>
                            <FormGroup inline={true} label="Y Offset" labelInfo="(px)">
                                <SafeNumericInput
                                    placeholder="North Y Offset"
                                    min={-50}
                                    max={RegionStore.MAX_DASH_LENGTH}
                                    value={(this.props.region as CompassAnnotationStore).northTextOffset.y}
                                    stepSize={0.5}
                                    onValueChange={value => (this.props.region as CompassAnnotationStore).setNorthTextOffset(value, false)}
                                />
                            </FormGroup>
                        </td>
                    </>
                ) : (
                    <>
                        <td>
                            <FormGroup inline={true} label="X Offset" labelInfo="(px)">
                                <SafeNumericInput
                                    placeholder="East X Offset"
                                    min={-50}
                                    max={RegionStore.MAX_DASH_LENGTH}
                                    value={(this.props.region as CompassAnnotationStore).eastTextOffset.x}
                                    stepSize={0.5}
                                    onValueChange={value => (this.props.region as CompassAnnotationStore).setEastTextOffset(value, true)}
                                />
                            </FormGroup>
                        </td>
                        <td>
                            <FormGroup inline={true} label="Y Offset" labelInfo="(px)">
                                <SafeNumericInput
                                    placeholder="East Y Offset"
                                    min={-50}
                                    max={RegionStore.MAX_DASH_LENGTH}
                                    value={(this.props.region as CompassAnnotationStore).eastTextOffset.y}
                                    stepSize={0.5}
                                    onValueChange={value => (this.props.region as CompassAnnotationStore).setEastTextOffset(value, false)}
                                />
                            </FormGroup>
                        </td>
                    </>
                )}
                ;
            </>
        );
    };

    render() {
        const appStore = AppStore.Instance;
        // dummy variables related to wcs to trigger re-render
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const system = appStore.overlayStore.global.explicitSystem;
        const region = this.props.region;
        const wcsInfo = this.props.wcsInfo;
        const WCSStart = getFormattedWCSPoint(wcsInfo, region?.controlPoints[0]);
        const WCSFinish = getFormattedWCSPoint(wcsInfo, region?.controlPoints[1]);

        return (
            <>
                <div className="form-section compass-ruler-annotation-form">
                    <H5>Properties</H5>
                    <div className="form-contents">
                        <table>
                            <tbody>
                                <tr>
                                    <td>Annotation Name</td>
                                    <td colSpan={2}>
                                        <InputGroup placeholder="Enter an annotation name" value={region.name} onChange={this.handleNameChange} />
                                    </td>
                                </tr>
                                {region.regionType === CARTA.RegionType.ANNCOMPASS && (
                                    <>
                                        <tr className="compass-label-offset-row">
                                            <td>North Label</td>
                                            <td>
                                                <InputGroup
                                                    placeholder="Enter north label"
                                                    value={(region as CompassAnnotationStore).northLabel}
                                                    onChange={event => (region as CompassAnnotationStore).setLabel(event.currentTarget.value, true)}
                                                />
                                            </td>
                                            {this.compassTextOffsetForm(true)}
                                        </tr>
                                        <tr className="compass-label-offset-row">
                                            <td>East Label</td>
                                            <td>
                                                <InputGroup
                                                    placeholder="Enter east label"
                                                    value={(region as CompassAnnotationStore).eastLabel}
                                                    onChange={event => (region as CompassAnnotationStore).setLabel(event.currentTarget.value, false)}
                                                />
                                            </td>
                                            {this.compassTextOffsetForm(false)}
                                        </tr>
                                    </>
                                )}
                                <tr>
                                    <td>Coordinate</td>
                                    <td colSpan={2}>
                                        <CoordinateComponent selectedValue={region.coordinate} onChange={region.setCoordinate} disableCoordinate={!this.props.wcsInfo} />
                                    </td>
                                </tr>
                                {region.regionType === CARTA.RegionType.ANNCOMPASS && (
                                    <tr className="compass-ruler-annotation-table-input">
                                        <td>Length (px)</td>
                                        <td>
                                            <FormGroup inline={true}>
                                                <SafeNumericInput
                                                    selectAllOnFocus
                                                    buttonPosition="none"
                                                    value={(region as CompassAnnotationStore).length}
                                                    onBlur={event => (region as CompassAnnotationStore).setLength(Number(event.target.value))}
                                                />
                                            </FormGroup>
                                        </td>
                                    </tr>
                                )}
                                <tr className="compass-ruler-annotation-table-input">
                                    <td>
                                        {region.regionType === CARTA.RegionType.ANNCOMPASS ? "Origin" : "Start"}
                                        {wcsInfo ? "" : " (px)"}
                                    </td>
                                    {region.coordinate === CoordinateMode.World && wcsInfo ? this.coordinateInput(region, wcsInfo, WCSStart, WCSFinish, false, false) : this.coordinateInput(region, wcsInfo, WCSStart, WCSFinish, false, true)}
                                    <td colSpan={1}>
                                        {wcsInfo ? (
                                            <span className="info-string">
                                                {region.coordinate === CoordinateMode.World && wcsInfo ? `Image: ${Point2D.ToString(region?.controlPoints[0], "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSStart)}`}
                                            </span>
                                        ) : (
                                            ""
                                        )}
                                    </td>
                                </tr>
                                {region.regionType === CARTA.RegionType.ANNRULER && (
                                    <tr className="compass-ruler-annotation-table-input">
                                        <td>
                                            Finish
                                            {wcsInfo ? "" : " (px)"}
                                        </td>
                                        {region.coordinate === CoordinateMode.World && wcsInfo
                                            ? this.coordinateInput(region, wcsInfo, WCSStart, WCSFinish, true, false)
                                            : this.coordinateInput(region, wcsInfo, WCSStart, WCSFinish, true, true)}
                                        <td>
                                            {wcsInfo ? (
                                                <span className="info-string">
                                                    {region.coordinate === CoordinateMode.World && wcsInfo ? `Image: ${Point2D.ToString(region?.controlPoints[1], "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSFinish)}`}
                                                </span>
                                            ) : (
                                                ""
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        );
    }
}
