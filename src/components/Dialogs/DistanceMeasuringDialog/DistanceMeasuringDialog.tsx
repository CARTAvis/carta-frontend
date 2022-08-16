import * as React from "react";
import {observable, action, makeObservable} from "mobx";
import {observer} from "mobx-react";
import {FormGroup, IDialogProps, RadioGroup, Radio, HTMLSelect} from "@blueprintjs/core";
import {AppStore, DialogStore, SystemType} from "stores";
import {DistanceMeasuringStore, RegionCoordinate} from "stores/Frame";
import {SafeNumericInput} from "components/Shared";
import {DraggableDialogComponent} from "components/Dialogs";
import {WCSPoint2D, Point2D} from "models";
import {getPixelValueFromWCS, getFormattedWCSPoint, isWCSStringFormatValid} from "utilities";

@observer
export class DistanceMeasuringDialog extends React.Component {
    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    distanceMeasuringStore = DistanceMeasuringStore.Instance;
    appStore = AppStore.Instance;

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
        const frame = this.appStore.activeFrame?.spatialReference ?? this.appStore.activeFrame;
        const wcsInfo = frame?.validWcs ? frame.wcsInfoForTransformation : 0;
        const WCSStart = getFormattedWCSPoint(wcsInfo, this.distanceMeasuringStore.transformedStart);
        const WCSFinish = getFormattedWCSPoint(wcsInfo, this.distanceMeasuringStore.transformedFinish);
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
            title: "Measure Distance"
        };

        const handleChangeWCSMode = (formEvent: React.FormEvent<HTMLInputElement>) => {
            if (this.error) this.setError(false);
            const WCSMode = formEvent.currentTarget.value === RegionCoordinate.Image ? false : true;
            this.setWCSMode(WCSMode);
        };

        const handleValueChange = (event: React.FocusEvent<HTMLInputElement>, isX: boolean, finish?: boolean, pixel?: boolean) => {
            if (pixel) {
                const value = parseFloat(event.target.value);
                if (isX && finish) {
                    this.distanceMeasuringStore.setTransformedFinish(value, this.distanceMeasuringStore.transformedFinish.y);
                } else if (finish) {
                    this.distanceMeasuringStore.setTransformedFinish(this.distanceMeasuringStore.transformedFinish.x, value);
                } else if (isX) {
                    this.distanceMeasuringStore.setTransformedStart(value, this.distanceMeasuringStore.transformedStart.y);
                } else {
                    this.distanceMeasuringStore.setTransformedStart(this.distanceMeasuringStore.transformedStart.x, value);
                }
            } else if (this.appStore.activeFrame) {
                const value = event.target.value;
                if (this.error) this.setError(false);
                if (isX && isWCSStringFormatValid(value as string, this.appStore.overlayStore.numbers.formatTypeX)) {
                    if (finish) {
                        const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSFinish, x: value as string});
                        this.distanceMeasuringStore.setTransformedFinish(finishPixelFromWCS.x, finishPixelFromWCS.y);
                    } else {
                        const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, x: value as string});
                        this.distanceMeasuringStore.setTransformedStart(startPixelFromWCS.x, startPixelFromWCS.y);
                    }
                } else if (!isX && isWCSStringFormatValid(value as string, this.appStore.overlayStore.numbers.formatTypeY)) {
                    if (finish) {
                        const finishPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSFinish, y: value as string});
                        this.distanceMeasuringStore.setTransformedFinish(finishPixelFromWCS.x, finishPixelFromWCS.y);
                    } else {
                        const startPixelFromWCS = getPixelValueFromWCS(wcsInfo, {...WCSStart, y: value as string});
                        this.distanceMeasuringStore.setTransformedStart(startPixelFromWCS.x, startPixelFromWCS.y);
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
                    <SafeNumericInput selectAllOnFocus buttonPosition="none" value={this.distanceMeasuringStore.transformedStart.x} onBlur={event => handleValueChange(event, true, false, true)} />
                </FormGroup>
                <FormGroup label={"y-Pixel"} inline={true} style={style}>
                    <SafeNumericInput selectAllOnFocus buttonPosition="none" value={this.distanceMeasuringStore.transformedStart.y} onBlur={event => handleValueChange(event, false, false, true)} />
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
                    <SafeNumericInput selectAllOnFocus buttonPosition="none" value={this.distanceMeasuringStore.transformedFinish.x} onBlur={event => handleValueChange(event, true, true, true)} />
                </FormGroup>
                <FormGroup label={"y-Pixel"} inline={true} style={style}>
                    <SafeNumericInput selectAllOnFocus buttonPosition="none" value={this.distanceMeasuringStore.transformedFinish.y} onBlur={event => handleValueChange(event, false, true, true)} />
                </FormGroup>
            </>
        );

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={775} defaultHeight={475} minHeight={300} minWidth={700} enableResizing={true}>
                <div className="distance-measuring-settings">
                    <table>
                        <tbody>
                            <tr>
                                <td colSpan={2}>
                                    <div className="coordinate-panel">
                                        <RadioGroup inline={true} onChange={ev => handleChangeWCSMode(ev)} selectedValue={this.WCSMode ? RegionCoordinate.World : RegionCoordinate.Image}>
                                            <Radio label={RegionCoordinate.Image} value={"Image"} />
                                            <Radio label={RegionCoordinate.World} value={"World"} />
                                        </RadioGroup>
                                        <HTMLSelect
                                            options={Object.keys(SystemType).map(key => ({label: key, value: SystemType[key]}))}
                                            value={this.appStore.overlayStore.global.system}
                                            onChange={ev => {
                                                if (this.error) this.setError(false);
                                                this.appStore.overlayStore.global.setSystem(ev.currentTarget.value as SystemType);
                                            }}
                                        />
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>Start</td>
                                <td>{startInput}</td>
                                <td>
                                    <span className="info-string">{this.WCSMode ? `Image: ${Point2D.ToString(this.distanceMeasuringStore.transformedStart, "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSStart)}`}</span>
                                </td>
                            </tr>
                            <tr>
                                <td>Finish</td>
                                <td>{finishInput}</td>
                                <td>
                                    <span className="info-string">{this.WCSMode ? `Image: ${Point2D.ToString(this.distanceMeasuringStore.transformedFinish, "px", 3)}` : `WCS: ${WCSPoint2D.ToString(WCSFinish)}`}</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </DraggableDialogComponent>
        );
    }
}
