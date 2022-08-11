import * as React from "react";
// import * as _ from "lodash";
// import * as AST from "ast_wrapper";
// import {CARTA} from "carta-protobuf";
import {observable, computed, action, makeObservable} from "mobx";
import {observer} from "mobx-react";
import {FormGroup, IDialogProps, Switch} from "@blueprintjs/core";
// import {Tick} from "chart.js";
// import ReactResizeDetector from "react-resize-detector";
import {AppStore} from "stores";
import {SafeNumericInput} from "components/Shared";
// import {WidgetProps } from "stores";
import {DraggableDialogComponent} from "components/Dialogs";
import {DialogStore} from "stores";
import {DistanceMeasuringStore} from "stores/Frame";
// import { Point2D } from "models";
// import {FrameStore} from "stores/Frame";
// import {RegionId, SpatialProfileWidgetStore} from "stores/widgets";
import {Point2D, WCSPoint2D} from "models";
import {getPixelValueFromWCS, transformPoint} from "utilities";

@observer
export class DistanceMeasuringDialog extends React.Component {
    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @observable WCSMode: boolean = false;
    @observable start: Point2D = {x: 0, y: 0};
    @observable finish: Point2D = {x: 0, y: 0};

    @observable WCSStart: WCSPoint2D = {x: "0", y: "0"};
    @observable WCSFinish: WCSPoint2D = {x: "0", y: "0"};

    @computed get roundedStart(): Point2D {
        return {x: Math.round(this.start.x), y: Math.round(this.start.y)};
    }

    @computed get roundedFinish(): Point2D {
        return {x: Math.round(this.finish.x), y: Math.round(this.finish.y)};
    }

    @action setWCSMode(bool?: boolean) {
        this.WCSMode = bool === undefined ? !this.WCSMode : bool;
    }

    @action setPoint = (value: number, isX: boolean, finish?: boolean, pixel?: boolean) => {
        if (pixel) {
            if (isX && finish) {
                this.finish.x = value;
            } else if (finish) {
                this.finish.y = value;
            } else if (isX) {
                this.start.x = value;
            } else {
                this.start.y = value;
            }
        } else {
            if (isX && finish) {
                this.WCSFinish.x = value.toString();
            } else if (finish) {
                this.WCSFinish.y = value.toString();
            } else if (isX) {
                this.WCSStart.x = value.toString();
            } else {
                this.WCSStart.y = value.toString();
            }
        }
    };

    render() {
        const dialogStore = DialogStore.Instance;
        const distanceMeasuringStore = DistanceMeasuringStore.Instance;
        const appStore = AppStore.Instance;

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
            distanceMeasuringStore.resetPos();
            this.setWCSMode(changeEvent.target.checked);
        };

        const handleValueChange = (value: number, isX: boolean, finish?: boolean, pixel?: boolean) => {
            this.setPoint(value, isX, finish, pixel);

            if (pixel) {
                distanceMeasuringStore.setTransformedStart(this.start);
                distanceMeasuringStore.setTransformedFinish(this.finish);
            } else if (appStore.activeFrame) {
                const startPixelFromWCS = getPixelValueFromWCS(appStore.activeFrame.wcsInfo, this.WCSStart);
                const finishPixelFromWCS = getPixelValueFromWCS(appStore.activeFrame.wcsInfo, this.WCSFinish);

                distanceMeasuringStore.setTransformedStart(startPixelFromWCS);
                distanceMeasuringStore.setTransformedFinish(finishPixelFromWCS);
            }
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={450} minHeight={300} defaultWidth={775} defaultHeight={500} enableResizing={true}>
                <div className="distance-measuring-settings">
                    <FormGroup inline={true} label={`Use WCS Coordinate`} style={style}>
                        <Switch checked={this.WCSMode} onChange={handleToggleWCSMode} />
                    </FormGroup>

                    {this.WCSMode ? (
                        <>
                            <FormGroup label={"x-WCS"} inline={true} style={style}>
                                <SafeNumericInput
                                    stepSize={1}
                                    value={appStore.activeFrame ? transformPoint(appStore.activeFrame.wcsInfo, distanceMeasuringStore.transformedStart).x : this.WCSStart.x}
                                    onValueChange={value => handleValueChange(value, true, false, false)}
                                />
                            </FormGroup>
                            <FormGroup label={"y-WCS"} inline={true} style={style}>
                                <SafeNumericInput
                                    stepSize={1}
                                    value={appStore.activeFrame ? transformPoint(appStore.activeFrame.wcsInfo, distanceMeasuringStore.transformedStart).y : this.WCSStart.y}
                                    onValueChange={value => handleValueChange(value, false, false, false)}
                                />
                            </FormGroup>
                            <FormGroup label={"x-WCS"} inline={true} style={style}>
                                <SafeNumericInput
                                    stepSize={1}
                                    value={appStore.activeFrame ? transformPoint(appStore.activeFrame.wcsInfo, distanceMeasuringStore.transformedFinish).x : this.WCSFinish.x}
                                    onValueChange={value => handleValueChange(value, true, true, false)}
                                />
                            </FormGroup>
                            <FormGroup label={"y-WCS"} inline={true} style={style}>
                                <SafeNumericInput
                                    stepSize={1}
                                    value={appStore.activeFrame ? transformPoint(appStore.activeFrame.wcsInfo, distanceMeasuringStore.transformedFinish).y : this.WCSFinish.y}
                                    onValueChange={value => handleValueChange(value, false, true, false)}
                                />
                            </FormGroup>
                        </>
                    ) : (
                        <>
                            <FormGroup label={"x-Pixel"} inline={true} style={style}>
                                <SafeNumericInput stepSize={1} value={roundPoint(distanceMeasuringStore.transformedStart.x)} onValueChange={value => handleValueChange(value, true, false, true)} />
                            </FormGroup>
                            <FormGroup label={"y-Pixel"} inline={true} style={style}>
                                <SafeNumericInput stepSize={1} value={roundPoint(distanceMeasuringStore.transformedStart.y)} onValueChange={value => handleValueChange(value, false, false, true)} />
                            </FormGroup>
                            <FormGroup label={"x-Pixel"} inline={true} style={style}>
                                <SafeNumericInput stepSize={1} value={roundPoint(distanceMeasuringStore.transformedFinish.x)} onValueChange={value => handleValueChange(value, true, true, true)} />
                            </FormGroup>
                            <FormGroup label={"y-Pixel"} inline={true} style={style}>
                                <SafeNumericInput stepSize={1} value={roundPoint(distanceMeasuringStore.transformedFinish.y)} onValueChange={value => handleValueChange(value, false, true, true)} />
                            </FormGroup>
                        </>
                    )}
                </div>
            </DraggableDialogComponent>
        );
    }
}
