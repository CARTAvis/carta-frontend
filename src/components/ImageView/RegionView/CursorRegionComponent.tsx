import React from "react";
import {observer} from "mobx-react";
import {AppStore, FrameStore} from "stores";
import {transformedImageToCanvasPos} from "./shared";
import {CursorMarker} from "./InvariantShapes";

interface CursorRegionComponentProps {
    frame: FrameStore;
    width: number;
    height: number;
    stageRef: any;
}

@observer
export class CursorRegionComponent extends React.Component<CursorRegionComponentProps> {
    render() {
        const frame = this.props.frame;
        const posImageSpace = frame?.cursorInfo?.posImageSpace;

        if (AppStore.Instance.cursorFrozen && posImageSpace) {
            const rotation = frame.spatialReference ? (frame.spatialTransform.rotation * 180.0) / Math.PI : 0.0;
            const cursorCanvasSpace = transformedImageToCanvasPos(posImageSpace, frame, this.props.width, this.props.height, this.props.stageRef.current);
            return <CursorMarker x={cursorCanvasSpace.x} y={cursorCanvasSpace.y} rotation={-rotation} />;
        }

        return null;
    }
}
