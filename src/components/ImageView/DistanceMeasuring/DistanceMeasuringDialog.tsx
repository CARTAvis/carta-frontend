import * as React from "react";
import {observable, action, makeObservable, reaction} from "mobx";
import {observer} from "mobx-react";
import {FormGroup, IDialogProps, Switch, InputGroup, Button} from "@blueprintjs/core";
import {AppStore, DialogStore} from "stores";
import {DistanceMeasuringStore} from "stores/Frame";
import {SafeNumericInput} from "components/Shared";
import {DraggableDialogComponent} from "components/Dialogs";
import {WCSPoint2D} from "models";
import {getPixelValueFromWCS} from "utilities";

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

    render() {
        reaction(
            () => this.distanceMeasuringStore.transformedStart,
            () => {
                this.setWCSStart(this.distanceMeasuringStore.formattedStartWCSPoint);
            }
        );

        reaction(
            () => this.distanceMeasuringStore.transformedFinish,
            () => {
                this.setWCSFinish(this.distanceMeasuringStore.formattedFinishWCSPoint);
            }
        );

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

        const roundPoint = function (point: number) {
            return Math.round(point);
        };

        const handleToggleWCSMode = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
            this.setWCSMode(changeEvent.target.checked);
        };

        const handleValueChange = (value: number | string, isX: boolean, finish?: boolean, pixel?: boolean) => {
            if (pixel) {
                if (isX && finish) {
                    this.distanceMeasuringStore.setTransformedFinish(value as number, this.distanceMeasuringStore.transformedFinish.y);
                } else if (finish) {
                    this.distanceMeasuringStore.setTransformedFinish(this.distanceMeasuringStore.transformedFinish.x, value as number);
                } else if (isX) {
                    this.distanceMeasuringStore.setTransformedStart(value as number, this.distanceMeasuringStore.transformedStart.y);
                } else {
                    this.distanceMeasuringStore.setTransformedStart(this.distanceMeasuringStore.transformedStart.x, value as number);
                }
            } else if (this.appStore.activeFrame) {
                this.setWCSPoint(value as string, isX, finish);
            }
        };

        const handleSubmitWCS = () => {
            const startPixelFromWCS = getPixelValueFromWCS(this.appStore.activeFrame.wcsInfo, this.WCSStart);
            const finishPixelFromWCS = getPixelValueFromWCS(this.appStore.activeFrame.wcsInfo, this.WCSFinish);

            this.distanceMeasuringStore.setTransformedStart(startPixelFromWCS.x, startPixelFromWCS.y);
            this.distanceMeasuringStore.setTransformedFinish(finishPixelFromWCS.x, finishPixelFromWCS.y);
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={300} minHeight={300} defaultWidth={300} defaultHeight={350} enableResizing={true}>
                <div className="distance-measuring-settings">
                    <FormGroup inline={true} label={`Use WCS Coordinate`} style={style}>
                        <Switch checked={this.WCSMode} onChange={handleToggleWCSMode} />
                    </FormGroup>

                    {this.WCSMode ? (
                        <>
                            <FormGroup>
                                <FormGroup label={"x-WCS"} inline={true} style={style}>
                                    <InputGroup value={this.WCSStart?.x} onChange={event => handleValueChange(event.target.value, true, false, false)} />
                                </FormGroup>
                                <FormGroup label={"y-WCS"} inline={true} style={style}>
                                    <InputGroup value={this.WCSStart?.y} onChange={event => handleValueChange(event.target.value, false, false, false)} />
                                </FormGroup>
                                <FormGroup label={"x-WCS"} inline={true} style={style}>
                                    <InputGroup value={this.WCSFinish?.x} onChange={event => handleValueChange(event.target.value, true, true, false)} />
                                </FormGroup>
                                <FormGroup label={"y-WCS"} inline={true} style={style}>
                                    <InputGroup value={this.WCSFinish?.y} onChange={event => handleValueChange(event.target.value, false, true, false)} />
                                </FormGroup>
                                <Button style={style} type="submit" text="Submit" onClick={handleSubmitWCS}></Button>
                            </FormGroup>
                        </>
                    ) : (
                        <>
                            <FormGroup label={"x-Pixel"} inline={true} style={style}>
                                <SafeNumericInput stepSize={1} value={roundPoint(this.distanceMeasuringStore.transformedStart.x)} onValueChange={value => handleValueChange(value, true, false, true)} />
                            </FormGroup>
                            <FormGroup label={"y-Pixel"} inline={true} style={style}>
                                <SafeNumericInput stepSize={1} value={roundPoint(this.distanceMeasuringStore.transformedStart.y)} onValueChange={value => handleValueChange(value, false, false, true)} />
                            </FormGroup>
                            <FormGroup label={"x-Pixel"} inline={true} style={style}>
                                <SafeNumericInput stepSize={1} value={roundPoint(this.distanceMeasuringStore.transformedFinish.x)} onValueChange={value => handleValueChange(value, true, true, true)} />
                            </FormGroup>
                            <FormGroup label={"y-Pixel"} inline={true} style={style}>
                                <SafeNumericInput stepSize={1} value={roundPoint(this.distanceMeasuringStore.transformedFinish.y)} onValueChange={value => handleValueChange(value, false, true, true)} />
                            </FormGroup>
                        </>
                    )}
                </div>
            </DraggableDialogComponent>
        );
    }
}
