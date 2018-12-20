import * as React from "react";
import {Ellipse, Group, Layer, Line, Stage} from "react-konva";
import {Colors} from "@blueprintjs/core";
import "./BeamProfileOverlayComponent.css";

interface BeamProfileOverlayComponentProps {
    docked: boolean;
    width: number;
    height: number;
    top: number;
    left: number;
    beamMajor: number;
    beamMinor: number;
    beamAngle: number;
    zoomLevel: number;
    color?: string;
    padding?: number;
}

export class BeamProfileOverlayComponent extends React.PureComponent<BeamProfileOverlayComponentProps> {

    render() {
        let className = "beam-profile-stage";
        if (this.props.docked) {
            className += " docked";
        }
        const renderColor = this.props.color || Colors.GRAY4;
        const paddingOffset = this.props.padding ? this.props.padding * devicePixelRatio : 0;
        const a = this.props.beamMajor / 2.0 * this.props.zoomLevel;
        const b = this.props.beamMinor / 2.0 * this.props.zoomLevel;
        const theta = (90.0 - this.props.beamAngle) * Math.PI / 180.0;

        // Bounding box of a rotated ellipse: https://math.stackexchange.com/questions/91132/how-to-get-the-limits-of-rotated-ellipse
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        const boundingBox = {
            x: 2 * Math.sqrt(a * a * cosTheta * cosTheta + b * b * sinTheta * sinTheta),
            y: 2 * Math.sqrt(a * a * sinTheta * sinTheta + b * b * cosTheta * cosTheta)
        };
        return (
            <Stage className={className} width={this.props.width} height={this.props.height} style={{left: this.props.left, top: this.props.top}}>
                <Layer hitGraphEnabled={false}>
                    <Group
                        x={boundingBox.x / 2.0 + paddingOffset}
                        y={this.props.height - boundingBox.y / 2.0 - paddingOffset}
                        rotation={theta * 180.0 / Math.PI}
                    >
                        <Ellipse radius={{x: a, y: b}} stroke={renderColor} strokeWidth={1}/>
                        <Line points={[-a, 0, a, 0]} stroke={renderColor} strokeWidth={1}/>
                        <Line points={[0, -b, 0, b]} stroke={renderColor} strokeWidth={1}/>
                    </Group>
                </Layer>
            </Stage>
        );
    }
}