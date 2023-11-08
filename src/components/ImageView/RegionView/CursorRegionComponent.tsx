import React from "react";
import {observer} from "mobx-react";

import {AppStore} from "stores";
import {FrameStore} from "stores/Frame";

import {UserPresence} from "../../../services";

import {CursorMarker} from "./InvariantShapes";
import {transformedImageToCanvasPos} from "./shared";

interface CursorRegionComponentProps {
    frame: FrameStore;
    width: number;
    height: number;
    stageRef: any;
}

@observer
export class CursorRegionComponent extends React.Component<CursorRegionComponentProps> {
    render() {
        const appStore = AppStore.Instance;
        const frame = this.props.frame;
        const posImageSpace = frame?.cursorInfo?.posImageSpace;
        //check the current frame is the spatialRef
        const isSpatialMatchingOn: boolean = frame.secondarySpatialImages?.length ? true : false;

        if ((appStore.cursorFrozen || (appStore.cursorMirror && (frame?.spatialReference || isSpatialMatchingOn || frame === appStore.activeFrame))) && posImageSpace) {
            const rotation = frame.spatialReference ? (frame.spatialTransform.rotation * 180.0) / Math.PI : 0.0;
            const cursorCanvasSpace = transformedImageToCanvasPos(posImageSpace, frame, this.props.width, this.props.height, this.props.stageRef.current);
            return isFinite(cursorCanvasSpace.x) && isFinite(cursorCanvasSpace.y) && <CursorMarker x={cursorCanvasSpace.x} y={cursorCanvasSpace.y} rotation={-rotation} color={appStore.cursorFrozen ? "white" : "yellow"} />;
        }

        return null;
    }
}

export const PresenceCursor = observer(({presence, width, height, stageRef, interpolated}: {presence: UserPresence; width: number; height: number; stageRef: any; interpolated?: boolean}) => {
    const appStore = AppStore.Instance;
    const frame = appStore.frames?.find(f => f.replicatedId === presence.cursor?.id);
    const key = `${presence.id}-${presence.cursor.id}`;
    const cursorPosition = interpolated ? appStore.workspaceService?.interpolatedCursorPoints?.get(key) : presence.cursor;

    if (!frame || !stageRef || !presence?.cursor || !cursorPosition) {
        return null;
    }
    const posImageSpace = {x: cursorPosition.x, y: cursorPosition.y};

    if (!posImageSpace) {
        return null;
    }
    const rotation = frame.spatialReference ? (frame.spatialTransform.rotation * 180.0) / Math.PI : 0.0;
    const cursorCanvasSpace = transformedImageToCanvasPos(posImageSpace, frame, width, height, stageRef.current);
    return isFinite(cursorCanvasSpace.x) && isFinite(cursorCanvasSpace.y) && <CursorMarker x={cursorCanvasSpace.x} y={cursorCanvasSpace.y} rotation={-rotation} color={presence.color ?? "white"} />;
});
