import * as React from "react";
import {observable, action, makeObservable} from "mobx";
import {observer} from "mobx-react";
import {ColorResult} from "react-color";
import {FormGroup, IDialogProps, NonIdealState, H5} from "@blueprintjs/core";
import {AppStore, DialogStore, HelpType} from "stores";
import {RegionCoordinate} from "stores/Frame";
import {CustomIcon} from "icons/CustomIcons";
import {SafeNumericInput, ColorPickerComponent, CoordinateComponent} from "components/Shared";
import {DraggableDialogComponent} from "components/Dialogs";
import {WCSPoint2D, Point2D} from "models";
import {getPixelValueFromWCS, getFormattedWCSPoint, isWCSStringFormatValid, SWATCH_COLORS} from "utilities";
import {ImageViewLayer} from "components";
import "./DistanceMeasuringDialog.scss";

const KEYCODE_ENTER = "Enter";

@observer
export class DistanceMeasuringDialog extends React.Component {
    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @observable WCSMode: boolean = true;

    @action setWCSMode = (bool?: boolean) => {
        this.WCSMode = bool === undefined ? !this.WCSMode : bool;
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

        const dialogProps: IDialogProps = {
            icon: <CustomIcon icon="distanceMeasuring" />,
            backdropClassName: "minimal-dialog-backdrop",
            className: "distance-measurement-dialog",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: dialogStore.distanceMeasuringDialogVisible,
            onClose: dialogStore.hideDistanceMeasuringDialog,
            title: `Measure Distance (${frame?.filename})`
        };

        const MissingFrame = (
            <NonIdealState className={"distance-measuring-settings-nonIdealState"} icon={"error"} title={"Distance measurement tool is not enabled"} description={"Please enable distance measurement tool via the image view toolbar."} />
        );

        const handleChangeWCSMode = (formEvent: React.FormEvent<HTMLInputElement>) => {
            const WCSMode = formEvent.currentTarget.value === RegionCoordinate.Image ? false : true;
            this.setWCSMode(WCSMode);
        };

        const handleValueChange = (event: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>, isX: boolean, finish?: boolean, pixel?: boolean) => {
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
                const value = target.value;
                if (isX && isWCSStringFormatValid(value as string, appStore.overlayStore.numbers.formatTypeX)) {
                    if (finish) {
                        const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSFinish, x: value as string});
                        distanceMeasuringStore?.setFinish(finishPixelFromWCS.x, finishPixelFromWCS.y);
                    } else {
                        const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, x: value as string});
                        distanceMeasuringStore?.setStart(startPixelFromWCS.x, startPixelFromWCS.y);
                    }
                } else if (!isX && isWCSStringFormatValid(value as string, appStore.overlayStore.numbers.formatTypeY)) {
                    if (finish) {
                        const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSFinish, y: value as string});
                        distanceMeasuringStore?.setFinish(finishPixelFromWCS.x, finishPixelFromWCS.y);
                    } else {
                        const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, y: value as string});
                        distanceMeasuringStore?.setStart(startPixelFromWCS.x, startPixelFromWCS.y);
                    }
                } else {
                    event.currentTarget.value = finish ? (isX ? WCSFinish.x : WCSFinish.y) : isX ? WCSStart.x : WCSStart.y;
                }
            }

            distanceMeasuringStore.updateTransformedPos(frame.spatialTransform);
        };

        const input = (finish: boolean) => {
            return this.WCSMode ? (
                <>
                    <td>
                        <FormGroup inline={true}>
                            <SafeNumericInput
                                selectAllOnFocus
                                allowNumericCharactersOnly={false}
                                buttonPosition="none"
                                value={finish ? WCSFinish?.x : WCSStart?.x}
                                onBlur={event => handleValueChange(event, true, finish, false)}
                                onKeyDown={event => {
                                    if (event.type === "keydown" && event.key === KEYCODE_ENTER) handleValueChange(event, true, finish, false);
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
                                onBlur={event => handleValueChange(event, false, finish, false)}
                                onKeyDown={event => {
                                    if (event.type === "keydown" && event.key === KEYCODE_ENTER) handleValueChange(event, false, finish, false);
                                }}
                            />
                        </FormGroup>
                    </td>
                </>
            ) : (
                <>
                    <td>
                        <FormGroup inline={true}>
                            <SafeNumericInput
                                selectAllOnFocus
                                buttonPosition="none"
                                value={finish ? distanceMeasuringStore?.finish.x : distanceMeasuringStore?.start.x}
                                onBlur={event => handleValueChange(event, true, finish, true)}
                                onKeyDown={event => {
                                    if (event.type === "keydown" && event.key === KEYCODE_ENTER) handleValueChange(event, true, finish, true);
                                }}
                            />
                        </FormGroup>
                    </td>
                    <td>
                        <FormGroup inline={true}>
                            <SafeNumericInput
                                selectAllOnFocus
                                buttonPosition="none"
                                value={finish ? distanceMeasuringStore?.finish.y : distanceMeasuringStore?.start.y}
                                onBlur={event => handleValueChange(event, false, finish, true)}
                                onKeyDown={event => {
                                    if (event.type === "keydown" && event.key === KEYCODE_ENTER) handleValueChange(event, false, finish, true);
                                }}
                            />
                        </FormGroup>
                    </td>
                </>
            );
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.DISTANCE_MEASUREMENT} defaultWidth={775} defaultHeight={475} minHeight={350} minWidth={775} enableResizing={true}>
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
                                            <FormGroup inline={true} label="Line Width" labelInfo="(px)">
                                                <SafeNumericInput placeholder="Line Width" min={0.5} max={20} value={distanceMeasuringStore?.lineWidth} stepSize={0.5} onValueChange={value => distanceMeasuringStore?.setLineWidth(value)} />
                                            </FormGroup>
                                        </td>
                                        <td width="300px" className="distance-measuring-settings-table-line-style-numeric-input">
                                            <FormGroup inline={true} label="Font Size" labelInfo="(px)">
                                                <SafeNumericInput placeholder="Font Size" min={0.5} max={50} value={distanceMeasuringStore?.fontSize} stepSize={1} onValueChange={value => distanceMeasuringStore?.setFontSize(value)} />
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
                                            <CoordinateComponent onChange={(ev: React.FormEvent<HTMLInputElement>) => handleChangeWCSMode(ev)} selectedValue={this.WCSMode ? RegionCoordinate.World : RegionCoordinate.Image} />
                                        </td>
                                    </tr>
                                    <tr className="distance-measuring-settings-table-input">
                                        <td>Start{this.WCSMode ? "" : " (px)"}</td>
                                        {input(false)}
                                        <td colSpan={3}>
                                            <span className="info-string">{this.WCSMode ? `Image: ${Point2D.ToString(distanceMeasuringStore?.start, "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSStart)}`}</span>
                                        </td>
                                    </tr>
                                    <tr className="distance-measuring-settings-table-input">
                                        <td>Finish{this.WCSMode ? "" : " (px)"}</td>
                                        {input(true)}
                                        <td colSpan={3}>
                                            <span className="info-string">{this.WCSMode ? `Image: ${Point2D.ToString(distanceMeasuringStore?.finish, "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSFinish)}`}</span>
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
