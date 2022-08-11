import * as React from "react";
// import * as _ from "lodash";
// import * as AST from "ast_wrapper";
// import {CARTA} from "carta-protobuf";
import { observable, computed} from "mobx";
import {observer} from "mobx-react";
import { FormGroup, IDialogProps } from "@blueprintjs/core";
// import {Tick} from "chart.js";
// import ReactResizeDetector from "react-resize-detector";
import {AppStore} from "stores";
import {SafeNumericInput} from "components/Shared";
// import {WidgetProps } from "stores";
import { DraggableDialogComponent } from "components/Dialogs";
import {DialogStore} from "stores";
import { DistanceMeasuringStore } from "stores/Frame";
// import { Point2D } from "models";
// import {FrameStore} from "stores/Frame";
// import {RegionId, SpatialProfileWidgetStore} from "stores/widgets";
import {Point2D, WCSPoint2D} from "models";
// import {transformPoint, getPixelValueFromWCS} from "utilities";
// import {transformPoint} from "utilities";

// // The fixed size of the settings panel popover (excluding the show/hide button)
// const AUTOSCALE_THROTTLE_TIME = 100;

@observer
export class DistanceMeasuringDialog extends React.Component {

    @observable start: Point2D = {x: null, y: null};
    @observable finish: Point2D = {x: null, y: null};

    @observable WCSStart: WCSPoint2D = {x: "0", y: "0"};
    @observable WCSFinish: WCSPoint2D = {x: "0", y: "0"};

    @computed get roundedStart(): Point2D {
        return {x: Math.round(this.start.x), y: Math.round(this.start.y)};
    }

    @computed get roundedFinish(): Point2D {
        return {x: Math.round(this.finish.x), y: Math.round(this.finish.y)};
    }


    render() {
        const dialogStore = DialogStore.Instance;
        const distanceMeasuringStore = DistanceMeasuringStore.Instance;
        const appStore = AppStore.Instance;
        console.log(appStore);

        const style = {
            margin: 10
        }

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

        const roundPoint = function(point: number) {
            return Math.round(point);
        }

        const handleValueChange = (value: number, isX: boolean, finish?: boolean, pixel?: boolean) => {

            if(pixel) {

                console.log('weqrqawfd')

                if(isX && finish) {
                    this.finish.x = value;
                } else if(finish) {
                    this.finish.y = value;
                } else if(isX) {
                    this.start.x = value;
                } else {
                    this.start.y = value;
                }

                distanceMeasuringStore.setTransformedStart(this.start);
                distanceMeasuringStore.setTransformedFinish(this.finish);

            } else {

                if(isX && finish) {
                    this.WCSFinish.x = value.toString();
                } else if(finish) {
                    this.WCSFinish.y = value.toString();
                } else if(isX) {
                    this.WCSStart.x = value.toString();
                } else {
                    this.WCSStart.y = value.toString();
                }

                // distanceMeasuringStore.transformedStart = getPixelValueFromWCS(appStore?.frames[0]?.wcsInfo, this.WCSStart);
                // distanceMeasuringStore.transformedFinish = getPixelValueFromWCS(appStore?.frames[0]?.wcsInfo, this.WCSFinish);

            }


        };
        
        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={450} minHeight={300} defaultWidth={775} defaultHeight={500} enableResizing={true}>

            <div className="distance-measuring-settings">
                
                <FormGroup label={"x-Pixel"} inline={true} style={style}>
                    <SafeNumericInput stepSize={1} value={roundPoint(distanceMeasuringStore.transformedStart.x)} onValueChange={value => handleValueChange(value, true)} />
                </FormGroup>
                <FormGroup label={"y-Pixel"} inline={true} style={style}>
                    <SafeNumericInput stepSize={1} value={roundPoint(distanceMeasuringStore.transformedStart.y)} onValueChange={value => handleValueChange(value, false)} />
                </FormGroup>
                <FormGroup label={"x-Pixel"} inline={true} style={style}>
                    <SafeNumericInput stepSize={1} value={roundPoint(distanceMeasuringStore.transformedFinish.x)} onValueChange={value => handleValueChange(value, true, true)} />
                </FormGroup>
                <FormGroup label={"y-Pixel"} inline={true} style={style}>
                    <SafeNumericInput stepSize={1} value={roundPoint(distanceMeasuringStore.transformedFinish.y)} onValueChange={value => handleValueChange(value, false, true)} />
                </FormGroup>
                <FormGroup label={"x-WCS"} inline={true} style={style}>
                    <SafeNumericInput stepSize={1} value={this.WCSStart.x} onValueChange={value => handleValueChange(value, true, false, true)} />
                </FormGroup>
                <FormGroup label={"y-WCS"} inline={true} style={style}>
                    <SafeNumericInput stepSize={1} value={this.WCSStart.y} onValueChange={value => handleValueChange(value, false, false, true)} />
                </FormGroup>
                <FormGroup label={"x-WCS"} inline={true} style={style}>
                    <SafeNumericInput stepSize={1} value={this.WCSFinish.x} onValueChange={value => handleValueChange(value, true, false, true)} />
                </FormGroup>
                <FormGroup label={"y-WCS"} inline={true} style={style}>
                    <SafeNumericInput stepSize={1} value={this.WCSFinish.y} onValueChange={value => handleValueChange(value, false, true, true)} />
                </FormGroup>

            </div>
            </DraggableDialogComponent>
        );
    }
}