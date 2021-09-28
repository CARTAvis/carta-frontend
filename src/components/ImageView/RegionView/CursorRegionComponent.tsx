import React from "react";
import {observer} from "mobx-react";
import {AppStore, FrameStore, RegionStore} from "stores";
import {adjustPosToMutatedStage, transformedImageToCanvasPos} from "./shared";
import {CursorMarker} from "./InvariantShapes";

interface CursorRegionComponentProps {
    region: RegionStore;
    frame: FrameStore;
    width: number;
    height: number;
    stageRef: any;
}

@observer
export class CursorRegionComponent extends React.Component<CursorRegionComponentProps> {
    render() {
        const region = this.props.region;
        const frame = this.props.frame;

        if (AppStore.Instance.cursorFrozen && frame && region) {
            const rotation = frame.spatialReference ? (frame.spatialTransform.rotation * 180.0) / Math.PI : 0.0;
            let cursorCanvasSpace = transformedImageToCanvasPos(region.center.x, region.center.y, frame, this.props.width, this.props.height);

            // For the scenario of initially fixed cursor, stage is not ready in render(), but the scale is correct
            // and will be adjusted in the stageZoomToPoint() of componentDidMount() in RegionViewComponent accordingly.
            const stage = this.props.stageRef?.current;
            if (stage) {
                cursorCanvasSpace = adjustPosToMutatedStage(cursorCanvasSpace, stage.getPosition(), stage.scaleX());
            }

            return (
                <CursorMarker
                    x={cursorCanvasSpace.x}
                    y={cursorCanvasSpace.y}
                    rotation={-rotation}
                />
            );
        }

        return null;
    }
}
