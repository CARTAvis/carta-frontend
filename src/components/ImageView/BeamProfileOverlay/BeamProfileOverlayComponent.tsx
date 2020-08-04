import * as React from "react";
import {observer} from "mobx-react";
import {Ellipse, Group, Layer, Line, Stage} from "react-konva";
import {Colors} from "@blueprintjs/core";
import {BeamType, FrameStore} from "stores";
import {Point2D} from "models";
import "./BeamProfileOverlayComponent.css";

interface BeamProfileOverlayComponentProps {
    frame: FrameStore;
    docked: boolean;
    top: number;
    left: number;
    padding?: number;
    referencedCenter?: Point2D;
}

@observer
export class BeamProfileOverlayComponent extends React.Component<BeamProfileOverlayComponentProps> {
    render() {
        let className = "beam-profile-stage";
        if (this.props.docked) {
            className += " docked";
        }

        const frame = this.props.frame;

        if (!frame.beamProperties) {
            return null;
        }

        const beamSettings = frame.overlayBeamSettings;
        const color = beamSettings.color;
        const axisColor = beamSettings.type === BeamType.Solid ? Colors.WHITE : color;
        const type = beamSettings.type;
        const strokeWidth = beamSettings.width;
        const paddingOffset = this.props.padding ? this.props.padding * devicePixelRatio : 0;
        const shiftX = beamSettings.shiftX;
        const shiftY = beamSettings.shiftY;

        const a = frame.beamPlotProps.a;
        const b = frame.beamPlotProps.b;
        let theta = frame.beamPlotProps.theta;

        let positionX, positionY;
        if (this.props.referencedCenter) {
            positionX = this.props.referencedCenter.x + paddingOffset + shiftX;
            positionY = this.props.referencedCenter.y - paddingOffset - shiftY;
        } else {
            positionX = frame.beamPlotProps.center.x + paddingOffset + shiftX;
            positionY = frame.beamPlotProps.center.y - paddingOffset - shiftY;
        }

        // limit the beam inside the beam overlay
        const rightMost = frame.renderWidth - frame.beamPlotProps.boundingBox.x / 2;
        if (positionX > rightMost) {
            positionX = rightMost;
        }
        const upMost = frame.beamPlotProps.boundingBox.y / 2;
        if (positionY < upMost) {
            positionY = upMost;
        }

        let ellipse;
        switch (type) {
            case BeamType.Open:
            default:
                ellipse = <Ellipse radiusX={a} radiusY={b} stroke={color} strokeWidth={strokeWidth}/>;
                break;
            case  BeamType.Solid:
                ellipse = <Ellipse radiusX={a} radiusY={b} fill={color} stroke={color} strokeWidth={strokeWidth}/>;
                break;
        }

        return (
            <Stage className={className} width={frame.renderWidth} height={frame.renderHeight} style={{left: this.props.left, top: this.props.top}}>
                <Layer listening={false}>
                    <Group
                        x={positionX}
                        y={positionY}
                        rotation={theta * 180.0 / Math.PI}
                    >
                        {a > 0 && b > 0 && ellipse}
                        <Line points={[-a, 0, a, 0]} stroke={axisColor} strokeWidth={strokeWidth}/>
                        <Line points={[0, -b, 0, b]} stroke={axisColor} strokeWidth={strokeWidth}/>
                    </Group>
                </Layer>
            </Stage>
        );
    }
}