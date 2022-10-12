import * as React from "react";
import {observer} from "mobx-react";
import {FormGroup, H5, InputGroup} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {AppStore} from "stores";
import {RegionStore, RegionCoordinate, CompassAnnotationStore} from "stores/Frame";
import {SafeNumericInput} from "components/Shared";
import {CoordinateComponent} from "../CoordinateComponent/CoordinateComponent";
import {WCSPoint2D, Point2D} from "models";
import {getPixelValueFromWCS, getFormattedWCSPoint, isWCSStringFormatValid} from "utilities";
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
            if (!isFinite(value)) return;
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
                    region?.setControlPoint(1, {x: finishPixelFromWCS.x, y: finishPixelFromWCS.y});
                } else {
                    const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, x: value});
                    region?.setControlPoint(0, {x: startPixelFromWCS.x, y: startPixelFromWCS.y});
                }
            } else if (!isX && isWCSStringFormatValid(value, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
                if (finish) {
                    const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSFinish, y: value});
                    region?.setControlPoint(1, {x: finishPixelFromWCS.x, y: finishPixelFromWCS.y});
                } else {
                    const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, y: value});
                    region?.setControlPoint(0, {x: startPixelFromWCS.x, y: startPixelFromWCS.y});
                }
            } else {
                event.currentTarget.value = finish ? (isX ? WCSFinish.x : WCSFinish.y) : isX ? WCSStart.x : WCSStart.y;
            }
        }
    };

    private inputWCSMode = (region, wcsInfo, WCSStart, WCSFinish, finish: boolean) => {
        return (
            <>
                <td>
                    <FormGroup inline={true}>
                        <SafeNumericInput
                            selectAllOnFocus
                            allowNumericCharactersOnly={false}
                            buttonPosition="none"
                            value={finish ? WCSFinish?.x : WCSStart?.x}
                            onBlur={event => this.handleValueChange(event, region, wcsInfo, WCSStart, WCSFinish, true, finish, false)}
                            onKeyDown={event => {
                                if (event.type === "keydown" && event.key === KEYCODE_ENTER) this.handleValueChange(event, region, wcsInfo, WCSStart, WCSFinish, true, finish, false);
                            }}
                        />
                    </FormGroup>
                </td>
                <td>
                    <FormGroup inline={true}>
                        <SafeNumericInput
                            selectAllOnFocus
                            allowNumericCharactersOnly={false}
                            buttonPosition="none"
                            value={finish ? WCSFinish?.y : WCSStart?.y}
                            onBlur={event => this.handleValueChange(event, region, wcsInfo, WCSStart, WCSFinish, false, finish, false)}
                            onKeyDown={event => {
                                if (event.type === "keydown" && event.key === KEYCODE_ENTER) this.handleValueChange(event, region, wcsInfo, WCSStart, WCSFinish, false, finish, false);
                            }}
                        />
                    </FormGroup>
                </td>
            </>
        );
    };

    private inputPixelMode = (region, wcsInfo, WCSStart, WCSFinish, finish: boolean) => {
        const handleOnKeyDown = (isX: boolean) => {
            return (event: React.KeyboardEvent<HTMLInputElement>) => {
                if (event.type === "keydown" && event.key === KEYCODE_ENTER) {
                    this.handleValueChange(event, region, wcsInfo, WCSStart, WCSFinish, isX, finish, true);
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
                            value={finish ? region?.controlPoints[1].x : region?.controlPoints[0].x}
                            onBlur={event => this.handleValueChange(event, region, wcsInfo, WCSStart, WCSFinish, true, finish, true)}
                            onKeyDown={handleOnKeyDown(true)}
                        />
                    </FormGroup>
                </td>
                <td>
                    <FormGroup inline={true}>
                        <SafeNumericInput
                            selectAllOnFocus
                            buttonPosition="none"
                            value={finish ? region?.controlPoints[1].y : region?.controlPoints[0].y}
                            onBlur={event => this.handleValueChange(event, region, wcsInfo, WCSStart, WCSFinish, false, finish, true)}
                            onKeyDown={handleOnKeyDown(false)}
                        />
                    </FormGroup>
                </td>
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
                                    <tr>
                                        <td>North Label</td>
                                        <td colSpan={2}>
                                            <InputGroup
                                                placeholder="Enter north label"
                                                value={(region as CompassAnnotationStore).northLabel}
                                                onChange={event => (region as CompassAnnotationStore).setLabel(event.currentTarget.value, true)}
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>East Label</td>
                                        <td colSpan={2}>
                                            <InputGroup placeholder="Enter east label" value={(region as CompassAnnotationStore).eastLabel} onChange={event => (region as CompassAnnotationStore).setLabel(event.currentTarget.value, false)} />
                                        </td>
                                    </tr>
                                </>
                            )}
                            <tr>
                                <td>Coordinate</td>
                                <td colSpan={2}>
                                    <CoordinateComponent region={region} disableCooridnate={!this.props.wcsInfo} />
                                </td>
                            </tr>
                            <tr className="compass-ruler-annotation-table-input">
                                <td>
                                    {region.regionType === CARTA.RegionType.ANNCOMPASS ? "East Axis Tip" : "Start"}
                                    {wcsInfo ? "" : " (px)"}
                                </td>
                                {region.coordinate === RegionCoordinate.World && wcsInfo ? this.inputWCSMode(region, wcsInfo, WCSStart, WCSFinish, false) : this.inputPixelMode(region, wcsInfo, WCSStart, WCSFinish, false)}
                                <td colSpan={3}>
                                    {wcsInfo ? (
                                        <span className="info-string">
                                            {region.coordinate === RegionCoordinate.World && wcsInfo ? `Image: ${Point2D.ToString(region?.controlPoints[0], "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSStart)}`}
                                        </span>
                                    ) : (
                                        ""
                                    )}
                                </td>
                            </tr>
                            <tr className="compass-ruler-annotation-table-input">
                                <td>
                                    {region.regionType === CARTA.RegionType.ANNCOMPASS ? "North Axis Tip" : "Finish"}
                                    {wcsInfo ? "" : " (px)"}
                                </td>
                                {region.coordinate === RegionCoordinate.World && wcsInfo ? this.inputWCSMode(region, wcsInfo, WCSStart, WCSFinish, true) : this.inputPixelMode(region, wcsInfo, WCSStart, WCSFinish, true)}
                                <td colSpan={3}>
                                    {wcsInfo ? (
                                        <span className="info-string">
                                            {region.coordinate === RegionCoordinate.World && wcsInfo ? `Image: ${Point2D.ToString(region?.controlPoints[1], "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSFinish)}`}
                                        </span>
                                    ) : (
                                        ""
                                    )}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}
