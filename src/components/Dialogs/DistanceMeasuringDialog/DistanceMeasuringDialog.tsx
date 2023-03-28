import * as React from "react";
import {ColorResult} from "react-color";
import {DialogProps, FormGroup, H5, NonIdealState} from "@blueprintjs/core";
import * as AST from "ast_wrapper";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ImageViewLayer} from "components";
import {DraggableDialogComponent} from "components/Dialogs";
import {ColorPickerComponent, CoordinateComponent, SafeNumericInput} from "components/Shared";
import {CustomIcon} from "icons/CustomIcons";
import {Point2D, WCSPoint2D} from "models";
import {AppStore, DialogStore, HelpType} from "stores";
import {CoordinateMode, DistanceMeasuringStore} from "stores/Frame";
import {getFormattedWCSPoint, getPixelValueFromWCS, isWCSStringFormatValid, SWATCH_COLORS} from "utilities";

import "./DistanceMeasuringDialog.scss";

const KEYCODE_ENTER = "Enter";

@observer
export class DistanceMeasuringDialog extends React.Component {
    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @observable WCSMode: boolean = true;

    @action setWCSMode = (value?: boolean) => {
        this.WCSMode = value === undefined ? !this.WCSMode : value;
    };

    private handleChangeWCSMode = (coord: CoordinateMode) => {
        const WCSMode = coord === CoordinateMode.Image ? false : true;
        this.setWCSMode(WCSMode);
    };

    private handleValueChange = (
        event: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>,
        distanceMeasuringStore: DistanceMeasuringStore,
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
                distanceMeasuringStore?.setFinish(value, distanceMeasuringStore?.finish.y);
            } else if (finish) {
                distanceMeasuringStore?.setFinish(distanceMeasuringStore?.finish.x, value);
            } else if (isX) {
                distanceMeasuringStore?.setStart(value, distanceMeasuringStore?.start.y);
            } else {
                distanceMeasuringStore?.setStart(distanceMeasuringStore?.start.x, value);
            }
        } else if (wcsInfo) {
            const value = target.value as string;
            if (isX && isWCSStringFormatValid(value, AppStore.Instance.overlayStore.numbers.formatTypeX)) {
                if (finish) {
                    const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSFinish, x: value});
                    distanceMeasuringStore?.setFinish(finishPixelFromWCS.x, finishPixelFromWCS.y);
                } else {
                    const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, x: value});
                    distanceMeasuringStore?.setStart(startPixelFromWCS.x, startPixelFromWCS.y);
                }
            } else if (!isX && isWCSStringFormatValid(value, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
                if (finish) {
                    const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSFinish, y: value});
                    distanceMeasuringStore?.setFinish(finishPixelFromWCS.x, finishPixelFromWCS.y);
                } else {
                    const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, y: value});
                    distanceMeasuringStore?.setStart(startPixelFromWCS.x, startPixelFromWCS.y);
                }
            } else {
                event.currentTarget.value = finish ? (isX ? WCSFinish.x : WCSFinish.y) : isX ? WCSStart.x : WCSStart.y;
            }
        }

        distanceMeasuringStore?.updateTransformedPos(AppStore.Instance.activeFrame.spatialTransform);
    };

    private inputWCSMode = (distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, finish: boolean) => {
        return (
            <>
                <td>
                    <FormGroup inline={true}>
                        <SafeNumericInput
                            selectAllOnFocus
                            allowNumericCharactersOnly={false}
                            buttonPosition="none"
                            value={finish ? WCSFinish?.x : WCSStart?.x}
                            onBlur={event => this.handleValueChange(event, distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, true, finish, false)}
                            onKeyDown={event => {
                                if (event.type === "keydown" && event.key === KEYCODE_ENTER) this.handleValueChange(event, distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, true, finish, false);
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
                            onBlur={event => this.handleValueChange(event, distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, false, finish, false)}
                            onKeyDown={event => {
                                if (event.type === "keydown" && event.key === KEYCODE_ENTER) this.handleValueChange(event, distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, false, finish, false);
                            }}
                        />
                    </FormGroup>
                </td>
            </>
        );
    };

    private inputPixelMode = (distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, finish: boolean) => {
        const handleOnKeyDown = (isX: boolean) => {
            return (event: React.KeyboardEvent<HTMLInputElement>) => {
                if (event.type === "keydown" && event.key === KEYCODE_ENTER) {
                    this.handleValueChange(event, distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, isX, finish, true);
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
                            value={finish ? distanceMeasuringStore?.finish.x : distanceMeasuringStore?.start.x}
                            onBlur={event => this.handleValueChange(event, distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, true, finish, true)}
                            onKeyDown={handleOnKeyDown(true)}
                        />
                    </FormGroup>
                </td>
                <td>
                    <FormGroup inline={true}>
                        <SafeNumericInput
                            selectAllOnFocus
                            buttonPosition="none"
                            value={finish ? distanceMeasuringStore?.finish.y : distanceMeasuringStore?.start.y}
                            onBlur={event => this.handleValueChange(event, distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, false, finish, true)}
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
        const frame = appStore.activeFrame;
        const distanceMeasuringStore = frame?.distanceMeasuring;
        const wcsInfo = frame?.validWcs ? frame.wcsInfoForTransformation : 0;
        const WCSStart = getFormattedWCSPoint(wcsInfo, distanceMeasuringStore?.start);
        const WCSFinish = getFormattedWCSPoint(wcsInfo, distanceMeasuringStore?.finish);
        const dialogStore = DialogStore.Instance;

        const dialogProps: DialogProps = {
            icon: <CustomIcon icon="distanceMeasuring" />,
            backdropClassName: "minimal-dialog-backdrop",
            className: "distance-measurement-dialog",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: dialogStore.distanceMeasuringDialogVisible,
            onClose: dialogStore.hideDistanceMeasuringDialog,
            title: `Distance Measurement (${frame?.filename})`
        };

        const MissingFrame = (
            <NonIdealState className={"distance-measuring-settings-nonIdealState"} icon={"error"} title={"Distance measurement tool is not enabled"} description={"Please enable distance measurement tool via the image view toolbar."} />
        );

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.DISTANCE_MEASUREMENT} defaultWidth={775} defaultHeight={320} minHeight={320} minWidth={775} enableResizing={true}>
                <div className="distance-measuring-settings">
                    {appStore.activeLayer === ImageViewLayer.DistanceMeasuring ? (
                        <>
                            <table className="distance-measuring-settings-table">
                                <tbody>
                                    <tr className="distance-measuring-settings-table-title">
                                        <td>
                                            <H5>Line Style</H5>
                                        </td>
                                    </tr>
                                    <tr className="distance-measuring-settings-table-line-style">
                                        <td>
                                            <FormGroup label="Color" inline={true}>
                                                <ColorPickerComponent
                                                    color={distanceMeasuringStore?.color}
                                                    presetColors={SWATCH_COLORS}
                                                    setColor={(color: ColorResult) => distanceMeasuringStore?.setColor(color.hex)}
                                                    disableAlpha={true}
                                                    darkTheme={appStore.darkTheme}
                                                />
                                            </FormGroup>
                                        </td>
                                        <td colSpan={2} className="distance-measuring-settings-table-line-style-numeric-input">
                                            <FormGroup inline={true} label="Line width" labelInfo="(px)">
                                                <SafeNumericInput placeholder="Line width" min={0.5} max={20} value={distanceMeasuringStore?.lineWidth} stepSize={0.5} onValueChange={value => distanceMeasuringStore?.setLineWidth(value)} />
                                            </FormGroup>
                                        </td>
                                        <td width="300px" className="distance-measuring-settings-table-line-style-numeric-input">
                                            <FormGroup inline={true} label="Font size" labelInfo="(px)">
                                                <SafeNumericInput placeholder="Font size" min={0.5} max={50} value={distanceMeasuringStore?.fontSize} stepSize={1} onValueChange={value => distanceMeasuringStore?.setFontSize(value)} />
                                            </FormGroup>
                                        </td>
                                    </tr>
                                    <tr className="distance-measuring-settings-table-title">
                                        <td>
                                            <H5>Properties</H5>
                                        </td>
                                    </tr>
                                    <tr className="distance-measuring-settings-table-coordinate">
                                        <td>Coordinate</td>
                                        <td colSpan={2}>
                                            <CoordinateComponent onChange={this.handleChangeWCSMode} selectedValue={this.WCSMode && wcsInfo ? CoordinateMode.World : CoordinateMode.Image} disableCoordinate={!wcsInfo} />
                                        </td>
                                    </tr>
                                    <tr className="distance-measuring-settings-table-input">
                                        <td>Start{this.WCSMode ? "" : " (px)"}</td>
                                        {this.WCSMode && wcsInfo ? this.inputWCSMode(distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, false) : this.inputPixelMode(distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, false)}
                                        <td colSpan={3}>
                                            {wcsInfo ? <span className="info-string">{this.WCSMode ? `Image: ${Point2D.ToString(distanceMeasuringStore?.start, "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSStart)}`}</span> : ""}
                                        </td>
                                    </tr>
                                    <tr className="distance-measuring-settings-table-input">
                                        <td>Finish{this.WCSMode ? "" : " (px)"}</td>
                                        {this.WCSMode && wcsInfo ? this.inputWCSMode(distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, true) : this.inputPixelMode(distanceMeasuringStore, wcsInfo, WCSStart, WCSFinish, true)}
                                        <td colSpan={3}>
                                            {wcsInfo ? <span className="info-string">{this.WCSMode ? `Image: ${Point2D.ToString(distanceMeasuringStore?.finish, "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSFinish)}`}</span> : ""}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </>
                    ) : (
                        MissingFrame
                    )}
                </div>
            </DraggableDialogComponent>
        );
    }
}
