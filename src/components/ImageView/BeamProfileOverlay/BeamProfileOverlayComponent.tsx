import * as React from "react";
import {observer} from "mobx-react";
import {Ellipse, Group, Layer, Line, Stage} from "react-konva";
import {BeamType, OverlayBeamStore} from "stores";
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

        const beamSettings = this.props.overlayBeamSettings;
        const color =  beamSettings.color;
        const axisColor = beamSettings.type === BeamType.Solid ? "#FFFFFF" : color;
        const type = beamSettings.type;
        const strokeWidth = beamSettings.width;
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

        let ellipse;
        switch (type) {
            case BeamType.Open: default:
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
                        x={boundingBox.x / 2.0 + paddingOffset}
                        y={this.props.height - boundingBox.y / 2.0 - paddingOffset}
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