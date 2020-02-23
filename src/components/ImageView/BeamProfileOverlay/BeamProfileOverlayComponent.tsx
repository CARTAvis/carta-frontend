import * as React from "react";
import {observer} from "mobx-react";
import {Ellipse, Group, Layer, Line, Stage} from "react-konva";
import {Colors} from "@blueprintjs/core";
import {BeamType, FrameStore, OverlayBeamStore} from "stores";
import "./BeamProfileOverlayComponent.css";

interface BeamProfileOverlayComponentProps {
    frame: FrameStore;
    docked: boolean;
    width: number;
    height: number;
    top: number;
    left: number;
    overlayBeamSettings: OverlayBeamStore;
    padding?: number;
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

        const zoomLevel = frame.spatialReference ? frame.spatialReference.zoomLevel * frame.spatialTransform.scale : frame.zoomLevel;
        const beamSettings = this.props.overlayBeamSettings;
        const color = beamSettings.color;
        const axisColor = beamSettings.type === BeamType.Solid ? Colors.WHITE : color;
        const type = beamSettings.type;
        const strokeWidth = beamSettings.width;
        const paddingOffset = this.props.padding ? this.props.padding * devicePixelRatio : 0;
        const shiftX = beamSettings.shiftX;
        const shiftY = beamSettings.shiftY;
        const a = frame.beamProperties.x / 2.0 * zoomLevel / devicePixelRatio;
        const b = frame.beamProperties.y / 2.0 * zoomLevel / devicePixelRatio;
        let theta = (90.0 - frame.beamProperties.angle) * Math.PI / 180.0;
        if (frame.spatialTransform) {
            theta -= frame.spatialTransform.rotation;
        }

        // Bounding box of a rotated ellipse: https://math.stackexchange.com/questions/91132/how-to-get-the-limits-of-rotated-ellipse
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        const boundingBox = {
            x: 2 * Math.sqrt(a * a * cosTheta * cosTheta + b * b * sinTheta * sinTheta),
            y: 2 * Math.sqrt(a * a * sinTheta * sinTheta + b * b * cosTheta * cosTheta)
        };

        // limit the beam inside the beam overlay
        const rightMost = this.props.width - boundingBox.x / 2.0;
        let positionX = boundingBox.x / 2.0 + paddingOffset + shiftX;
        if (positionX > rightMost) {
            positionX = rightMost;
        }
        const upMost = boundingBox.y / 2.0;
        let positionY = this.props.height - boundingBox.y / 2.0 - paddingOffset - shiftY;
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
            <Stage className={className} width={this.props.width} height={this.props.height} style={{left: this.props.left, top: this.props.top}}>
                <Layer hitGraphEnabled={false}>
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