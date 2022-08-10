import * as React from "react";
// import * as _ from "lodash";
// import * as AST from "ast_wrapper";
// import {CARTA} from "carta-protobuf";
import { observable} from "mobx";
import {observer} from "mobx-react";
import { FormGroup, IDialogProps } from "@blueprintjs/core";
// import {Tick} from "chart.js";
// import ReactResizeDetector from "react-resize-detector";
import {SafeNumericInput} from "components/Shared";
// import {WidgetProps } from "stores";
import { DraggableDialogComponent } from "components/Dialogs";
import {DialogStore} from "stores";
import { DistanceMeasuringStore } from "stores/Frame";
// import { Point2D } from "models";
// import {FrameStore} from "stores/Frame";
// import {RegionId, SpatialProfileWidgetStore} from "stores/widgets";
import {Point2D} from "models";
// import {binarySearchByX, clamp, formattedExponential, transformPoint, toFixed, getColorForTheme} from "utilities";

// // The fixed size of the settings panel popover (excluding the show/hide button)
// const AUTOSCALE_THROTTLE_TIME = 100;

@observer
export class DistanceMeasuringDialog extends React.Component {

    @observable start: Point2D = {x: null, y: null};
    @observable finish: Point2D = {x: null, y: null};


    render() {
        const dialogStore = DialogStore.Instance;
        const distanceMeasuringStore = DistanceMeasuringStore.Instance;

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

        const handleValueChange = (value: number, isX: boolean, finish?: boolean) => {

            if(isX && finish) {
                this.finish.x = value;
            } else if(finish) {
                this.finish.y = value;
            } else if(isX) {
                this.start.x = value;
            } else {
                this.start.y = value;
            }

        };
        
        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={450} minHeight={300} defaultWidth={775} defaultHeight={500} enableResizing={true}>

            <div className="distance-measuring-settings">
                
                <FormGroup label={"x-Pixel"} inline={true} style={style}>
                    <SafeNumericInput min={1} max={10} stepSize={1} value={distanceMeasuringStore.transformedStart.x} onValueChange={value => handleValueChange(value, true)} />
                </FormGroup>
                <FormGroup label={"y-Pixel"} inline={true} style={style}>
                    <SafeNumericInput min={1} max={10} stepSize={1} value={distanceMeasuringStore.transformedStart.y} onValueChange={value => handleValueChange(value, false)} />
                </FormGroup>
                <FormGroup label={"x-Pixel"} inline={true} style={style}>
                    <SafeNumericInput min={1} max={10} stepSize={1} value={distanceMeasuringStore.transformedFinish.x} onValueChange={value => handleValueChange(value, true, true)} />
                </FormGroup>
                <FormGroup label={"y-Pixel"} inline={true} style={style}>
                    <SafeNumericInput min={1} max={10} stepSize={1} value={distanceMeasuringStore.transformedFinish.y} onValueChange={value => handleValueChange(value, false, true)} />
                </FormGroup>

            </div>
            </DraggableDialogComponent>
        );
    }
}