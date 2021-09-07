import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {Ellipse, Group, Layer, Line, Stage} from "react-konva";
import {Colors} from "@blueprintjs/core";
import {AppStore, BeamType, FrameStore} from "stores";
import {Point2D} from "models";
import {getColorForTheme} from "utilities";
import "./BeamProfileOverlayComponent.scss";

interface BeamProfileOverlayComponentProps {
    docked: boolean;
    frame: FrameStore;
    top: number;
    left: number;
    padding?: number;
}

interface BeamPlotProps {
    id: number;
    position: Point2D;
    a: number;
    b: number;
    theta: number;
    type: BeamType;
    color: string;
    axisColor: string;
    strokeWidth: number;
}

@observer
export class BeamProfileOverlayComponent extends React.Component<BeamProfileOverlayComponentProps> {
    private layerRef = React.createRef<any>();

    componentDidMount() {
        const pixelRatio = devicePixelRatio * AppStore.Instance.exportImageRatio;
        const canvas = this.layerRef?.current?.getCanvas();
        if (canvas && canvas.pixelRatio !== pixelRatio) {
            canvas.setPixelRatio(pixelRatio);
        }
    }

    private getPlotProps = (frame: FrameStore, basePosition?: Point2D): BeamPlotProps => {
        if (!frame.hasVisibleBeam) {
            return null;
        }

        const id = frame.frameInfo.fileId;
        const zoomLevel = frame.spatialReference ? frame.spatialReference.zoomLevel * frame.spatialTransform.scale : frame.zoomLevel;
        const beamSettings = frame.overlayBeamSettings;
        const color = getColorForTheme(beamSettings.color);
        const axisColor = beamSettings.type === BeamType.Solid ? Colors.WHITE : color;
        const type = beamSettings.type;
        const strokeWidth = beamSettings.width;
        const paddingOffset = this.props.padding ? this.props.padding * devicePixelRatio : 0;
        const shiftX = beamSettings.shiftX;
        const shiftY = beamSettings.shiftY;
        const a = ((frame.beamProperties.x / 2.0) * zoomLevel) / devicePixelRatio;
        const b = ((frame.beamProperties.y / 2.0) * zoomLevel) / devicePixelRatio;
        let theta = ((90.0 - frame.beamProperties.angle) * Math.PI) / 180.0;
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
        const rightMost = frame.renderWidth - boundingBox.x / 2.0;
        let positionX = basePosition ? basePosition.x : boundingBox.x / 2.0 + paddingOffset + shiftX;
        if (positionX > rightMost) {
            positionX = rightMost;
        }
        const upMost = boundingBox.y / 2.0;
        let positionY = basePosition ? basePosition.y : frame.renderHeight - boundingBox.y / 2.0 - paddingOffset - shiftY;
        if (positionY < upMost) {
            positionY = upMost;
        }

        return {id, position: {x: positionX, y: positionY}, a, b, theta, type, color, axisColor, strokeWidth};
    };

    private plotBeam(plotProps: BeamPlotProps) {
        if (!plotProps) {
            return null;
        }

        let ellipse;
        switch (plotProps.type) {
            case BeamType.Open:
            default:
                ellipse = <Ellipse radiusX={plotProps.a} radiusY={plotProps.b} stroke={plotProps.color} strokeWidth={plotProps.strokeWidth} />;
                break;
            case BeamType.Solid:
                ellipse = <Ellipse radiusX={plotProps.a} radiusY={plotProps.b} fill={plotProps.color} stroke={plotProps.color} strokeWidth={plotProps.strokeWidth} />;
                break;
        }
        return (
            <Group x={plotProps.position.x} y={plotProps.position.y} rotation={(plotProps.theta * 180.0) / Math.PI} key={plotProps.id}>
                {plotProps.a > 0 && plotProps.b > 0 && ellipse}
                <Line points={[-plotProps.a, 0, plotProps.a, 0]} stroke={plotProps.axisColor} strokeWidth={plotProps.strokeWidth} />
                <Line points={[0, -plotProps.b, 0, plotProps.b]} stroke={plotProps.axisColor} strokeWidth={plotProps.strokeWidth} />
            </Group>
        );
    }

    render() {
        const appStore = AppStore.Instance;
        const baseFrame = this.props.frame;
        const contourFrames = appStore.contourFrames.get(baseFrame)?.filter(frame => frame !== baseFrame && frame.hasVisibleBeam);

        if (!baseFrame.hasVisibleBeam && !contourFrames.length) {
            return null;
        }

        let baseBeamPlotProps: BeamPlotProps;
        if (baseFrame.hasVisibleBeam) {
            baseBeamPlotProps = this.getPlotProps(baseFrame);
        }

        const contourBeams = [];
        contourFrames.forEach(contourFrame => {
            const plotProps = this.getPlotProps(contourFrame, baseBeamPlotProps ? baseBeamPlotProps.position : null);
            contourBeams.push(this.plotBeam(plotProps));
        });

        const className = classNames("beam-profile-stage", {docked: this.props.docked});

        return (
            <Stage className={className} width={baseFrame.renderWidth} height={baseFrame.renderHeight} style={{left: this.props.left, top: this.props.top}}>
                <Layer listening={false} ref={this.layerRef}>
                    {this.plotBeam(baseBeamPlotProps)}
                    {contourBeams}
                </Layer>
            </Stage>
        );
    }
}
