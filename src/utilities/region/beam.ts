import {type Point2D} from "models";
import {type FrameStore} from "stores/Frame";

interface BeamGeometryOptions {
    imageRatio: number;
    devicePixelRatio: number;
    padding?: number;
    basePosition?: Point2D;
}

/** Beam radii/rotation in image coordinates, with screen-axis scale and placement. */
export function getBeamGeometry(frame: FrameStore, options: BeamGeometryOptions) {
    if (!frame.beamProperties) return null;
    const zoomFrame = frame.spatialReference ?? frame;
    const zoom = zoomFrame.effectiveZoomLevel ?? {x: zoomFrame.zoomLevel, y: zoomFrame.zoomLevel};
    const factor = (frame.spatialTransform?.scale ?? 1) / options.imageRatio / options.devicePixelRatio;
    const scale = {x: zoom.x * factor, y: zoom.y * factor};
    const a = frame.beamProperties.x / 2;
    const b = frame.beamProperties.y / 2;
    const theta = ((90 - frame.beamProperties.angle) * Math.PI) / 180 - (frame.spatialTransform?.rotation ?? 0);
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);
    const halfWidth = scale.x * Math.sqrt((a * cos) ** 2 + (b * sin) ** 2);
    const halfHeight = scale.y * Math.sqrt((a * sin) ** 2 + (b * cos) ** 2);
    const padding = (options.padding ?? 0) * options.devicePixelRatio;
    const position = options.basePosition ?? {x: halfWidth + padding + frame.overlayBeamSettings.shiftX, y: frame.renderHeight - halfHeight - padding - frame.overlayBeamSettings.shiftY};
    return {a, b, theta, scale, position: {x: Math.min(position.x, frame.renderWidth - halfWidth), y: Math.max(position.y, halfHeight)}};
}
