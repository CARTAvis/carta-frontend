import * as React from "react";
import {observable, action, makeObservable} from "mobx";
import {observer} from "mobx-react";
import {ColorResult} from "react-color";
import {FormGroup, IDialogProps, NonIdealState} from "@blueprintjs/core";
import {AppStore, DialogStore} from "stores";
import {RegionCoordinate} from "stores/Frame";
import {SafeNumericInput, ColorPickerComponent, CoordinateComponent} from "components/Shared";
import {DraggableDialogComponent} from "components/Dialogs";
import {WCSPoint2D, Point2D} from "models";
import {getPixelValueFromWCS, getFormattedWCSPoint, isWCSStringFormatValid, SWATCH_COLORS} from "utilities";
import {ImageViewLayer} from "components";

@observer
export class DistanceMeasuringDialog extends React.Component {
    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @observable WCSMode: boolean = false;
    @observable WCSStart: WCSPoint2D;
    @observable WCSFinish: WCSPoint2D;
    @observable error: boolean = false;

    @action setWCSMode(bool?: boolean) {
        this.WCSMode = bool === undefined ? !this.WCSMode : bool;
    }

    @action setWCSStart = (point: WCSPoint2D) => {
        this.WCSStart = point;
    };

    @action setWCSFinish = (point: WCSPoint2D) => {
        this.WCSFinish = point;
    };

    @action setWCSPoint = (value: string, isX: boolean, finish?: boolean) => {
        if (isX && finish) {
            this.WCSFinish.x = value;
        } else if (finish) {
            this.WCSFinish.y = value;
        } else if (isX) {
            this.WCSStart.x = value;
        } else {
            this.WCSStart.y = value;
        }
    };

    @action setError = (err: boolean) => {
        this.error = err;
    };

    render() {
        const appStore = AppStore.Instance;
        // dummy variables related to wcs to trigger re-render
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const system = appStore.overlayStore.global.explicitSystem;
        const frame = appStore.activeFrame;
        const distanceMeasuringStore = frame?.distanceMeasuring;
        const wcsInfo = frame?.validWcs ? frame.wcsInfoForTransformation : 0;
        const WCSStart = getFormattedWCSPoint(wcsInfo, distanceMeasuringStore?.transformedStart);
        const WCSFinish = getFormattedWCSPoint(wcsInfo, distanceMeasuringStore?.transformedFinish);
        const dialogStore = DialogStore.Instance;

        const style = {
            margin: 10
        };

        const dialogProps: IDialogProps = {
            icon: "wrench",
            backdropClassName: "minimal-dialog-backdrop",
            className: "distance-measurement-dialog",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: dialogStore.distanceMeasuringDialogVisible,
            onClose: dialogStore.hideDistanceMeasuringDialog,
            title: `Measure Distance (${frame?.filename})`
        };

        const MissingFrame = <NonIdealState icon={"error"} title={"Distance Measurement is not turned on"} description={"Please turn on distance measurement at menu toolbar located at the bottom of the image viewer"} />;

        const handleChangeWCSMode = (formEvent: React.FormEvent<HTMLInputElement>) => {
            if (this.error) this.setError(false);
            const WCSMode = formEvent.currentTarget.value === RegionCoordinate.Image ? false : true;
            this.setWCSMode(WCSMode);
        };

        const handleValueChange = (event: React.FocusEvent<HTMLInputElement>, isX: boolean, finish?: boolean, pixel?: boolean) => {
            if (pixel) {
                const value = parseFloat(event.target.value);
                if (isX && finish) {
                    distanceMeasuringStore?.setTransformedFinish(value, distanceMeasuringStore?.transformedFinish.y);
                } else if (finish) {
                    distanceMeasuringStore?.setTransformedFinish(distanceMeasuringStore?.transformedFinish.x, value);
                } else if (isX) {
                    distanceMeasuringStore?.setTransformedStart(value, distanceMeasuringStore?.transformedStart.y);
                } else {
                    distanceMeasuringStore?.setTransformedStart(distanceMeasuringStore?.transformedStart.x, value);
                }
            } else if (frame) {
                const value = event.target.value;
                if (this.error) this.setError(false);
                if (isX && isWCSStringFormatValid(value as string, appStore.overlayStore.numbers.formatTypeX)) {
                    if (finish) {
                        const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSFinish, x: value as string});
                        distanceMeasuringStore?.setTransformedFinish(finishPixelFromWCS.x, finishPixelFromWCS.y);
                    } else {
                        const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, x: value as string});
                        distanceMeasuringStore?.setTransformedStart(startPixelFromWCS.x, startPixelFromWCS.y);
                    }
                } else if (!isX && isWCSStringFormatValid(value as string, appStore.overlayStore.numbers.formatTypeY)) {
                    if (finish) {
                        const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSFinish, y: value as string});
                        distanceMeasuringStore?.setTransformedFinish(finishPixelFromWCS.x, finishPixelFromWCS.y);
                    } else {
                        const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, y: value as string});
                        distanceMeasuringStore?.setTransformedStart(startPixelFromWCS.x, startPixelFromWCS.y);
                    }
                } else {
                    this.setError(true);
                }
            }
        };

        const startInput = this.WCSMode ? (
            <>
                <FormGroup helperText={this.error ? "Invalid Input" : ""} label={"X-Coordinate"} inline={true} style={style}>
                    <SafeNumericInput selectAllOnFocus intent={this.error ? "danger" : "none"} allowNumericCharactersOnly={false} buttonPosition="none" value={WCSStart.x} onBlur={event => handleValueChange(event, true, false, false)} />
                </FormGroup>
                <FormGroup helperText={this.error ? "Invalid Input" : ""} label={"Y-Coordinate"} inline={true} style={style}>
                    <SafeNumericInput selectAllOnFocus intent={this.error ? "danger" : "none"} allowNumericCharactersOnly={false} buttonPosition="none" value={WCSStart.y} onBlur={event => handleValueChange(event, false, false, false)} />
                </FormGroup>
            </>
        ) : (
            <>
                <FormGroup label={"x-Pixel"} inline={true} style={style}>
                    <SafeNumericInput selectAllOnFocus buttonPosition="none" value={distanceMeasuringStore?.transformedStart.x} onBlur={event => handleValueChange(event, true, false, true)} />
                </FormGroup>
                <FormGroup label={"y-Pixel"} inline={true} style={style}>
                    <SafeNumericInput selectAllOnFocus buttonPosition="none" value={distanceMeasuringStore?.transformedStart.y} onBlur={event => handleValueChange(event, false, false, true)} />
                </FormGroup>
            </>
        );

        const finishInput = this.WCSMode ? (
            <>
                <FormGroup helperText={this.error ? "Invalid Input" : ""} label={"X-Coordinate"} inline={true} style={style}>
                    <SafeNumericInput selectAllOnFocus intent={this.error ? "danger" : "none"} allowNumericCharactersOnly={false} buttonPosition="none" value={WCSFinish.x} onBlur={event => handleValueChange(event, true, true, false)} />
                </FormGroup>
                <FormGroup helperText={this.error ? "Invalid Input" : ""} label={"Y-Coordinate"} inline={true} style={style}>
                    <SafeNumericInput selectAllOnFocus intent={this.error ? "danger" : "none"} allowNumericCharactersOnly={false} buttonPosition="none" value={WCSFinish.y} onBlur={event => handleValueChange(event, false, true, false)} />
                </FormGroup>
            </>
        ) : (
            <>
                <FormGroup label={"x-Pixel"} inline={true} style={style}>
                    <SafeNumericInput selectAllOnFocus buttonPosition="none" value={distanceMeasuringStore?.transformedFinish.x} onBlur={event => handleValueChange(event, true, true, true)} />
                </FormGroup>
                <FormGroup label={"y-Pixel"} inline={true} style={style}>
                    <SafeNumericInput selectAllOnFocus buttonPosition="none" value={distanceMeasuringStore?.transformedFinish.y} onBlur={event => handleValueChange(event, false, true, true)} />
                </FormGroup>
            </>
        );

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={775} defaultHeight={475} minHeight={300} minWidth={700} enableResizing={true}>
                <div className="distance-measuring-settings">
                    {appStore.activeLayer === ImageViewLayer.DistanceMeasuring ? (
                        <table>
                            <tbody>
                                <tr>
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
                                    <td>
                                        <FormGroup inline={true} label="Line Width" labelInfo="(px)">
                                            <SafeNumericInput placeholder="Line Width" min={0.5} max={20} value={distanceMeasuringStore?.lineWidth} stepSize={0.5} onValueChange={value => distanceMeasuringStore?.setLineWidth(value)} />
                                        </FormGroup>
                                    </td>
                                    <td>
                                        <FormGroup inline={true} label="Font Size" labelInfo="(px)">
                                            <SafeNumericInput placeholder="Font Size" min={0.5} max={50} value={distanceMeasuringStore?.fontSize} stepSize={1} onValueChange={value => distanceMeasuringStore?.setFontSize(value)} />
                                        </FormGroup>
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={2}>
                                        <CoordinateComponent onChange={(ev: React.FormEvent<HTMLInputElement>) => handleChangeWCSMode(ev)} selectedValue={this.WCSMode ? RegionCoordinate.World : RegionCoordinate.Image} />
                                    </td>
                                </tr>
                                <tr>
                                    <td>Start</td>
                                    <td>{startInput}</td>
                                    <td>
                                        <span className="info-string">{this.WCSMode ? `Image: ${Point2D.ToString(distanceMeasuringStore?.transformedStart, "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSStart)}`}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>Finish</td>
                                    <td>{finishInput}</td>
                                    <td>
                                        <span className="info-string">{this.WCSMode ? `Image: ${Point2D.ToString(distanceMeasuringStore?.transformedFinish, "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSFinish)}`}</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    ) : (
                        MissingFrame
                    )}
                </div>
            </DraggableDialogComponent>
        );
    }
}
