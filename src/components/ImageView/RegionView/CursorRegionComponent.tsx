import React from "react";
import {observer} from "mobx-react";
import {Group, Line, Rect} from "react-konva";
import {FrameStore, RegionStore} from "stores";
import {transformedImageToCanvasPos} from "./shared";

interface CursorRegionComponentProps {
    region: RegionStore;
    frame: FrameStore;
    layerWidth: number;
    layerHeight: number;
    stageRef: any;
}

@observer
export class CursorRegionComponent extends React.Component<CursorRegionComponentProps> {
    render() {
        const region = this.props.region;
        const frame = this.props.frame;
        const stageOrigin = this.props.stageRef.position();

        if (region && frame) {
            let cursorCanvasSpace = transformedImageToCanvasPos(region.center.x, region.center.y, frame, this.props.layerWidth, this.props.layerHeight);
            cursorCanvasSpace = {x: cursorCanvasSpace.x - stageOrigin.x, y: cursorCanvasSpace.y - stageOrigin.y};

            if (cursorCanvasSpace?.x >= 0 && cursorCanvasSpace?.x <= this.props.layerWidth && cursorCanvasSpace?.y >= 0 && cursorCanvasSpace?.y <= this.props.layerHeight) {
                const crosshairLength = 20;
                const crosshairThicknessWide = 3;
                const crosshairThicknessNarrow = 1;
                const crosshairGap = 7;
                const rotation = frame.spatialReference ? (frame.spatialTransform.rotation * 180.0) / Math.PI : 0.0;
                return (
                    <Group x={Math.floor(cursorCanvasSpace.x) + 0.5} y={Math.floor(cursorCanvasSpace.y) + 0.5} rotation={-rotation}>
                        <Line listening={false} points={[-crosshairLength / 2 - crosshairThicknessWide / 2, 0, -crosshairGap / 2, 0]} strokeWidth={crosshairThicknessWide} stroke="black" />
                        <Line listening={false} points={[crosshairGap / 2, 0, crosshairLength / 2 + crosshairThicknessWide / 2, 0]} strokeWidth={crosshairThicknessWide} stroke="black" />
                        <Line listening={false} points={[0, -crosshairLength / 2 - crosshairThicknessWide / 2, 0, -crosshairGap / 2]} strokeWidth={crosshairThicknessWide} stroke="black" />
                        <Line listening={false} points={[0, crosshairGap / 2, 0, crosshairLength / 2 + crosshairThicknessWide / 2]} strokeWidth={crosshairThicknessWide} stroke="black" />
                        <Rect listening={false} width={crosshairGap - 1} height={crosshairGap - 1} offsetX={crosshairGap / 2 - 0.5} offsetY={crosshairGap / 2 - 0.5} strokeWidth={1} stroke="black" />
                        <Line listening={false} points={[-crosshairLength / 2 - crosshairThicknessNarrow / 2, 0, -crosshairGap / 2, 0]} strokeWidth={crosshairThicknessNarrow} stroke="white" />
                        <Line listening={false} points={[crosshairGap / 2, 0, crosshairLength / 2 + crosshairThicknessNarrow / 2, 0]} strokeWidth={crosshairThicknessNarrow} stroke="white" />
                        <Line listening={false} points={[0, -crosshairLength / 2 - crosshairThicknessNarrow / 2, 0, -crosshairGap / 2]} strokeWidth={crosshairThicknessNarrow} stroke="white" />
                        <Line listening={false} points={[0, crosshairGap / 2, 0, crosshairLength / 2 + crosshairThicknessNarrow / 2]} strokeWidth={crosshairThicknessNarrow} stroke="white" />
                    </Group>
                );
            }
        }
        return null;
    }
}
