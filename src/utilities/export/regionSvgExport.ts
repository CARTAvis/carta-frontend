import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {Text} from "konva/lib/shapes/Text";

import {type FrameView, type Point2D} from "models";
import {AppStore} from "stores";
import {type CompassAnnotationStore, type FrameStore, type RegionStore, type RulerAnnotationStore, type TextAnnotationStore} from "stores/Frame";
import {getTextCenterFromOffset} from "utilities/region/annotationTextPosition";
import {getScaledEllipseAxes, imageSizeToCanvas, imageToCanvasPos as imageToCanvas} from "utilities/region/geometry";
import {getInterpolatedPathAtDistance} from "utilities/region/region";
import {getRulerDistanceText} from "utilities/region/ruler";
import {getTextAnnotationProps} from "utilities/region/textAnnotation";

import {createSvgElement, createSvgText, svgGroupFromLayer} from "./svgExport";

const SVG_NS = "http://www.w3.org/2000/svg";
const SPATIAL_APPROXIMATION_REGION_TYPES = new Set<CARTA.RegionType>([
    CARTA.RegionType.LINE,
    CARTA.RegionType.ANNLINE,
    CARTA.RegionType.RECTANGLE,
    CARTA.RegionType.ANNRECTANGLE,
    CARTA.RegionType.ELLIPSE,
    CARTA.RegionType.ANNELLIPSE,
    CARTA.RegionType.POLYGON,
    CARTA.RegionType.ANNPOLYGON,
    CARTA.RegionType.POLYLINE,
    CARTA.RegionType.ANNPOLYLINE,
    CARTA.RegionType.ANNVECTOR
]);

function transformImagePoint(transform: AST.FrameSet | AST.Mapping, point: Point2D, isForward = true): Point2D {
    const transformed = AST.transformPoint(transform, point.x, point.y, isForward);
    return {x: transformed.x, y: transformed.y};
}

function transformedImageToCanvas(point: Point2D, frame: FrameStore | undefined, frameView: FrameView, layerWidth: number, layerHeight: number): Point2D {
    if (frame?.spatialReference && frame.spatialTransformAST && frame.spatialTransform) {
        const secondaryPoint = transformImagePoint(frame.spatialTransformAST, point, false);
        return secondaryImageToCanvas(secondaryPoint, frame, frameView, layerWidth, layerHeight);
    }
    return imageToCanvas(point.x, point.y, frameView, layerWidth, layerHeight);
}

function secondaryImageToCanvas(point: Point2D, frame: FrameStore | undefined, frameView: FrameView, layerWidth: number, layerHeight: number): Point2D {
    if (frame?.spatialReference && frame.spatialTransform) {
        const referencePoint = frame.spatialTransform.transformCoordinate(point, true);
        return imageToCanvas(referencePoint.x, referencePoint.y, frameView, layerWidth, layerHeight);
    }
    return imageToCanvas(point.x, point.y, frameView, layerWidth, layerHeight);
}

function getSpatialRegionCanvasPoints(region: RegionStore, frame: FrameStore, frameView: FrameView, layerWidth: number, layerHeight: number): Point2D[] | null {
    if (!frame.spatialReference || !frame.spatialTransformAST || !frame.spatialTransform) {
        return null;
    }

    return region.getRegionApproximation(frame.spatialTransformAST).map(point => {
        return secondaryImageToCanvas(point, frame, frameView, layerWidth, layerHeight);
    });
}

function getStrokeAttrs(region: RegionStore, pixelRatio = 1, dashLength = region.dashLength): Record<string, string | number> {
    const attrs: Record<string, string | number> = {
        stroke: region.color,
        "stroke-width": region.lineWidth * pixelRatio,
        fill: "none"
    };
    if (dashLength > 0) {
        const scaledDashLength = dashLength * pixelRatio;
        attrs["stroke-dasharray"] = `${scaledDashLength},${scaledDashLength}`;
    }
    return attrs;
}

function renderPointRegion(center: Point2D, region: RegionStore, pixelRatio: number, rotation = 0): SVGElement {
    const point = region as RegionStore & {pointShape?: CARTA.PointAnnotationShape; pointWidth?: number};
    const width = (point.pointWidth || 6) * pixelRatio;
    const halfWidth = width / 2;
    const shape = point.pointShape ?? CARTA.PointAnnotationShape.SQUARE;
    const isLined = shape === CARTA.PointAnnotationShape.BOX || shape === CARTA.PointAnnotationShape.CIRCLE_LINED || shape === CARTA.PointAnnotationShape.DIAMOND_LINED;
    const strokeAttrs = {stroke: region.color, "stroke-width": region.lineWidth * pixelRatio, fill: isLined ? "none" : region.color};
    let element: SVGElement;

    switch (shape) {
        case CARTA.PointAnnotationShape.CIRCLE:
        case CARTA.PointAnnotationShape.CIRCLE_LINED:
            element = createSvgElement("circle", {cx: center.x, cy: center.y, r: halfWidth, ...strokeAttrs});
            break;
        case CARTA.PointAnnotationShape.DIAMOND:
        case CARTA.PointAnnotationShape.DIAMOND_LINED:
            element = createSvgElement("polygon", {
                points: `${center.x},${center.y - halfWidth} ${center.x + halfWidth},${center.y} ${center.x},${center.y + halfWidth} ${center.x - halfWidth},${center.y}`,
                ...strokeAttrs
            });
            break;
        case CARTA.PointAnnotationShape.CROSS:
        case CARTA.PointAnnotationShape.X: {
            const isDiagonal = shape === CARTA.PointAnnotationShape.X;
            const group = document.createElementNS(SVG_NS, "g");
            const lines = isDiagonal
                ? [
                      [center.x - halfWidth, center.y - halfWidth, center.x + halfWidth, center.y + halfWidth],
                      [center.x + halfWidth, center.y - halfWidth, center.x - halfWidth, center.y + halfWidth]
                  ]
                : [
                      [center.x, center.y - halfWidth, center.x, center.y + halfWidth],
                      [center.x - halfWidth, center.y, center.x + halfWidth, center.y]
                  ];
            for (const [x1, y1, x2, y2] of lines) {
                group.appendChild(createSvgElement("line", {x1, y1, x2, y2, ...strokeAttrs}));
            }
            element = group;
            break;
        }
        case CARTA.PointAnnotationShape.BOX:
            element = createSvgElement("rect", {x: center.x - halfWidth, y: center.y - halfWidth, width, height: width, ...strokeAttrs});
            break;
        case CARTA.PointAnnotationShape.SQUARE:
        default:
            element = createSvgElement("rect", {x: center.x - halfWidth, y: center.y - halfWidth, width, height: width, fill: region.color, stroke: region.color, "stroke-width": region.lineWidth * pixelRatio});
            break;
    }

    if (rotation !== 0) {
        element.setAttribute("transform", `rotate(${rotation},${center.x},${center.y})`);
    }
    return element;
}

function renderLineRegion(start: Point2D, end: Point2D, region: RegionStore, pixelRatio: number): SVGElement {
    return createSvgElement("line", {
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        ...getStrokeAttrs(region, pixelRatio)
    });
}

function renderRectangleRegion(center: Point2D, size: Point2D, rotation: number, region: RegionStore, pixelRatio: number, axisScaleX: number): SVGElement {
    if (rotation !== 0 && Math.abs(axisScaleX - 1) > 1e-10) {
        const theta = (-rotation * Math.PI) / 180;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        // The viewer rotates the local rectangle before the stage's independent zoom.
        const halfWidth = size.x / axisScaleX / 2;
        const halfHeight = size.y / 2;
        const points = [
            [-halfWidth, -halfHeight],
            [halfWidth, -halfHeight],
            [halfWidth, halfHeight],
            [-halfWidth, halfHeight]
        ].map(([x, y]) => ({
            x: center.x + axisScaleX * (x * cos - y * sin),
            y: center.y + x * sin + y * cos
        }));
        return renderPolygonRegion(points, region, true, pixelRatio);
    }
    const rect = createSvgElement("rect", {
        x: center.x - size.x / 2,
        y: center.y - size.y / 2,
        width: size.x,
        height: size.y,
        ...getStrokeAttrs(region, pixelRatio)
    });
    if (rotation !== 0) {
        rect.setAttribute("transform", `rotate(${-rotation},${center.x},${center.y})`);
    }
    return rect;
}

function renderEllipseRegion(center: Point2D, size: Point2D, rotation: number, region: RegionStore, pixelRatio: number, axisScaleX: number): SVGElement {
    const axes = rotation !== 0 && Math.abs(axisScaleX - 1) > 1e-10 ? getScaledEllipseAxes(size.x / axisScaleX, size.y, -rotation, {x: axisScaleX, y: 1}) : {rx: size.x, ry: size.y, rotation: -rotation};
    const ellipse = createSvgElement("ellipse", {
        cx: center.x,
        cy: center.y,
        rx: axes.rx,
        ry: axes.ry,
        ...getStrokeAttrs(region, pixelRatio)
    });
    if (axes.rotation !== 0) {
        ellipse.setAttribute("transform", `rotate(${axes.rotation},${center.x},${center.y})`);
    }
    return ellipse;
}

function renderPolygonRegion(points: Point2D[], region: RegionStore, isClosed: boolean, pixelRatio: number): SVGElement {
    const pointsStr = points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    return createSvgElement(isClosed ? "polygon" : "polyline", {
        points: pointsStr,
        ...getStrokeAttrs(region, pixelRatio)
    });
}

function getArrowLineEnd(start: Point2D, tip: Point2D, arrowLength: number, isExtrapolated = false): Point2D {
    const dx = tip.x - start.x;
    const dy = tip.y - start.y;
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength === 0) {
        return tip;
    }

    const offset = isExtrapolated ? arrowLength : Math.min(arrowLength, segmentLength);
    return {
        x: tip.x - (dx / segmentLength) * offset,
        y: tip.y - (dy / segmentLength) * offset
    };
}

function trimPathForArrow(points: Point2D[], arrowLength: number): Point2D[] {
    if (points.length < 2 || arrowLength <= 0) {
        return points.map(point => ({...point}));
    }

    const trimmed = points.slice(0, -1).map(point => ({...point}));
    let tip = points[points.length - 1];
    let remaining = arrowLength;

    for (let index = points.length - 2; index >= 0; index--) {
        const start = points[index];
        const segmentLength = Math.hypot(tip.x - start.x, tip.y - start.y);
        if (segmentLength === 0) {
            tip = start;
            continue;
        }
        if (segmentLength >= remaining) {
            trimmed.splice(index + 1);
            trimmed.push(getArrowLineEnd(start, tip, remaining));
            return trimmed;
        }
        remaining -= segmentLength;
        tip = start;
    }

    return [getArrowLineEnd(points[0], points[points.length - 1], arrowLength)];
}

function getArrowDirectionStart(points: Point2D[]): Point2D | null {
    const tip = points[points.length - 1];
    for (let index = points.length - 2; index >= 0; index--) {
        if (Math.hypot(tip.x - points[index].x, tip.y - points[index].y) > 0) {
            return points[index];
        }
    }
    return null;
}

function getArrowheadPoints(start: Point2D, tip: Point2D, arrowLength: number, arrowWidth: number): string | null {
    const dx = tip.x - start.x;
    const dy = tip.y - start.y;
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength === 0) {
        return null;
    }

    const base = getArrowLineEnd(start, tip, arrowLength, true);
    const perpendicular = {x: (-dy / segmentLength) * (arrowWidth / 2), y: (dx / segmentLength) * (arrowWidth / 2)};
    return `${base.x + perpendicular.x},${base.y + perpendicular.y} ${tip.x},${tip.y} ${base.x - perpendicular.x},${base.y - perpendicular.y}`;
}

function renderArrowhead(start: Point2D, tip: Point2D, region: RegionStore, pixelRatio: number, length: number, width: number): SVGElement | null {
    const points = getArrowheadPoints(start, tip, length, width);
    return points
        ? createSvgElement("polygon", {
              points,
              fill: region.color,
              stroke: region.color,
              "stroke-width": region.lineWidth * pixelRatio
          })
        : null;
}

function renderVectorAnnotation(points: Point2D[], region: RegionStore, pixelRatio: number): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g");
    const vector = region as RegionStore & {pointerLength?: number; pointerWidth?: number};
    const arrowLength = (vector.pointerLength ?? 10) * pixelRatio;
    const arrowWidth = (vector.pointerWidth ?? 7) * pixelRatio;

    const linePoints = trimPathForArrow(points, arrowLength);

    const line = createSvgElement("polyline", {
        points: linePoints.map(point => `${point.x},${point.y}`).join(" "),
        ...getStrokeAttrs(region, pixelRatio)
    });
    group.appendChild(line);
    const arrowStart = points.length > 1 ? getArrowDirectionStart(points) : null;
    if (arrowStart) {
        const arrowhead = renderArrowhead(arrowStart, points[points.length - 1], region, pixelRatio, arrowLength, arrowWidth);
        if (arrowhead) {
            group.appendChild(arrowhead);
        }
    }
    return group;
}

interface RegionSvgOptions {
    frame?: FrameStore;
    pixelRatio: number;
}

function toCanvasPoints(points: number[], frameView: FrameView, layerWidth: number, layerHeight: number, frame?: FrameStore): Point2D[] {
    const canvasPoints: Point2D[] = [];
    for (let i = 0; i + 1 < points.length; i += 2) {
        canvasPoints.push(secondaryImageToCanvas({x: points[i], y: points[i + 1]}, frame, frameView, layerWidth, layerHeight));
    }
    return canvasPoints;
}

function getAnnotationPath(origin: Point2D, approximatePoints: number[], frameView: FrameView, layerWidth: number, layerHeight: number, length: number, frame?: FrameStore): Point2D[] {
    const points = toCanvasPoints(approximatePoints, frameView, layerWidth, layerHeight, frame);
    return getInterpolatedPathAtDistance(origin, points, length);
}

function renderAnnotationText(text: string, position: Point2D, region: RegionStore & {fontSize?: number; font?: string; fontStyle?: string}, pixelRatio: number): SVGTextElement {
    const fontStyle = region.fontStyle?.toLowerCase() ?? "";
    return createSvgText(text, position.x, position.y, {
        fill: region.color,
        "font-size": (region.fontSize ?? 20) * pixelRatio,
        "font-family": region.font ?? "Helvetica",
        "font-style": fontStyle.includes("italic") ? "italic" : "normal",
        "font-weight": fontStyle.includes("bold") ? "bold" : "normal",
        "text-anchor": "middle",
        "dominant-baseline": "central"
    });
}

function renderCompassAnnotation(region: CompassAnnotationStore, frameView: FrameView, layerWidth: number, layerHeight: number, options: RegionSvgOptions): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g");
    const originImage = options.frame?.spatialReference && options.frame.spatialTransformAST ? transformImagePoint(options.frame.spatialTransformAST, region.controlPoints[0], false) : region.controlPoints[0];
    const origin = secondaryImageToCanvas(originImage, options.frame, frameView, layerWidth, layerHeight);
    const length = region.length * options.pixelRatio;
    let northPath: Point2D[];
    let eastPath: Point2D[];

    if (options.frame?.isValidWcs) {
        try {
            const approx = region.getCompassApproximation(options.frame.wcsInfoForTransformation, Boolean(options.frame.spatialReference), options.frame.spatialTransformAST || undefined);
            northPath = getAnnotationPath(origin, approx.northApproximatePoints, frameView, layerWidth, layerHeight, length, options.frame);
            eastPath = getAnnotationPath(origin, approx.eastApproximatePoints, frameView, layerWidth, layerHeight, length, options.frame);
        } catch {
            northPath = [origin, {x: origin.x, y: origin.y - length}];
            eastPath = [origin, {x: origin.x - length, y: origin.y}];
        }
    } else {
        northPath = [origin, {x: origin.x, y: origin.y - length}];
        eastPath = [origin, {x: origin.x - length, y: origin.y}];
    }

    const addArrow = (points: Point2D[], hasArrowhead: boolean) => {
        const tip = points[points.length - 1];
        const arrowStart = hasArrowhead ? getArrowDirectionStart(points) : null;
        const linePoints = hasArrowhead ? trimPathForArrow(points, region.pointerLength * options.pixelRatio) : points;
        const line =
            linePoints.length === 2
                ? renderLineRegion(linePoints[0], linePoints[1], region, options.pixelRatio)
                : createSvgElement("polyline", {points: linePoints.map(point => `${point.x},${point.y}`).join(" "), ...getStrokeAttrs(region, options.pixelRatio)});
        group.appendChild(line);
        if (hasArrowhead) {
            const arrowhead = arrowStart ? renderArrowhead(arrowStart, tip, region, options.pixelRatio, region.pointerLength * options.pixelRatio, region.pointerWidth * options.pixelRatio) : null;
            if (arrowhead) {
                group.appendChild(arrowhead);
            }
        }
    };

    addArrow(northPath, region.hasNorthArrowhead);
    addArrow(eastPath, region.hasEastArrowhead);

    const getLabelCenter = (text: string, tip: Point2D, offset: Point2D): Point2D => {
        const layout = new Text({text, fontSize: region.fontSize, fontFamily: region.font, fontStyle: region.fontStyle});
        const center = getTextCenterFromOffset(tip, offset, layout.width(), layout.height(), options.pixelRatio);
        layout.destroy();
        return center;
    };
    const northText = renderAnnotationText(region.northLabel, getLabelCenter(region.northLabel, northPath[northPath.length - 1], region.northTextOffset), region, options.pixelRatio);
    const eastText = renderAnnotationText(region.eastLabel, getLabelCenter(region.eastLabel, eastPath[eastPath.length - 1], region.eastTextOffset), region, options.pixelRatio);
    group.append(northText, eastText);
    return group;
}

function getDistanceText(wcsInfo: AST.FrameSet, start: Point2D, finish: Point2D, region: RulerAnnotationStore): string {
    try {
        return getRulerDistanceText(wcsInfo, start, finish, region.decimals);
    } catch {
        return "";
    }
}

function renderRulerAnnotation(region: RulerAnnotationStore, frameView: FrameView, layerWidth: number, layerHeight: number, options: RegionSvgOptions): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g");
    const start = region.controlPoints[0];
    const finish = region.controlPoints[1];
    let corner = {x: finish.x, y: start.y};
    let distanceText = "";
    let xDistanceText = "";
    let yDistanceText = "";

    const startCanvas = transformedImageToCanvas(start, options.frame, frameView, layerWidth, layerHeight);
    const finishCanvas = transformedImageToCanvas(finish, options.frame, frameView, layerWidth, layerHeight);
    const cornerCanvas = transformedImageToCanvas(corner, options.frame, frameView, layerWidth, layerHeight);
    let xPoints: Point2D[] = [startCanvas, cornerCanvas];
    let yPoints: Point2D[] = [cornerCanvas, finishCanvas];
    let hypotenusePoints: Point2D[] = [startCanvas, finishCanvas];

    if (options.frame) {
        const frame = options.frame;
        try {
            const selectedWcsInfo = frame.isOffsetCoord ? frame.wcsInfoOffset : frame.wcsInfoForTransformation;
            const wcsInfo = (frame.isValidWcs && AppStore.Instance.overlaySettings.isWcsCoordinates ? selectedWcsInfo : undefined) ?? frame.wcsInfo;
            const approx = region.getCurveApproximation(wcsInfo, frame.spatialTransformAST || undefined);
            xPoints = toCanvasPoints(approx.xApproximatePoints, frameView, layerWidth, layerHeight, frame);
            yPoints = toCanvasPoints(approx.yApproximatePoints, frameView, layerWidth, layerHeight, frame);
            hypotenusePoints = toCanvasPoints(approx.hypotenuseApproximatePoints, frameView, layerWidth, layerHeight, frame);
            corner = approx.corner;
            const transformedStart = frame.spatialReference && frame.spatialTransformAST ? transformImagePoint(frame.spatialTransformAST, start, false) : start;
            const transformedFinish = frame.spatialReference && frame.spatialTransformAST ? transformImagePoint(frame.spatialTransformAST, finish, false) : finish;
            distanceText = getDistanceText(wcsInfo, transformedStart, transformedFinish, region);
            if (region.isAuxiliaryTextVisible) {
                xDistanceText = getDistanceText(wcsInfo, transformedStart, corner, region);
                yDistanceText = getDistanceText(wcsInfo, corner, transformedFinish, region);
            }
        } catch {
            // Keep the pixel-space fallback when WCS data is unavailable.
        }
    }

    const line = (points: Point2D[], dashLength: number) => {
        const attrs: Record<string, string | number> = {points: points.map(point => `${point.x},${point.y}`).join(" "), ...getStrokeAttrs(region, options.pixelRatio, dashLength)};
        return createSvgElement("polyline", attrs);
    };
    group.appendChild(line(hypotenusePoints, region.dashLength));
    if (region.isAuxiliaryLineVisible) {
        group.appendChild(line(xPoints, region.auxiliaryLineDashLength));
        group.appendChild(line(yPoints, region.auxiliaryLineDashLength));
    }

    const midpoint = (points: Point2D[]): Point2D => (points.length === 2 ? {x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2} : (points[Math.floor(points.length / 2)] ?? startCanvas));
    const addText = (text: string, position: Point2D, offset: Point2D) => {
        if (text) {
            const center = getTextCenterFromOffset(position, offset, 0, region.fontSize ?? 20, options.pixelRatio);
            group.appendChild(renderAnnotationText(text, center, region, options.pixelRatio));
        }
    };
    addText(distanceText, midpoint(hypotenusePoints), region.textOffset);
    if (region.isAuxiliaryTextVisible) {
        addText(xDistanceText, midpoint(xPoints), region.xTextOffset);
        addText(yDistanceText, midpoint(yPoints), region.yTextOffset);
    }
    return group;
}

function renderTextAnnotation(center: Point2D, size: Point2D, region: RegionStore, pixelRatio: number, rotation = region.rotation): SVGElement {
    const textRegion = region as TextAnnotationStore;
    const layout = new Text(getTextAnnotationProps(textRegion, size));
    const lineHeight = layout.fontSize() * layout.lineHeight() * pixelRatio;
    const width = layout.width() * pixelRatio;
    const height = layout.height() * pixelRatio;
    const lines = layout.textArr.map(line => line.text);
    const align = layout.align();
    const verticalAlign = layout.verticalAlign();
    const textX = center.x + (align === "left" ? -width / 2 : align === "right" ? width / 2 : 0);
    const spareHeight = height - lines.length * lineHeight;
    const alignmentOffset = verticalAlign === "top" ? 0 : verticalAlign === "bottom" ? spareHeight : spareHeight / 2;
    const firstY = center.y - height / 2 + alignmentOffset + lineHeight / 2;
    const attrs = {
        fill: region.color,
        "font-size": layout.fontSize() * pixelRatio,
        "font-family": layout.fontFamily(),
        "font-style": layout.fontStyle().toLowerCase().includes("italic") ? "italic" : "normal",
        "font-weight": layout.fontStyle().toLowerCase().includes("bold") ? "bold" : "normal",
        "text-anchor": align === "left" ? "start" : align === "right" ? "end" : "middle",
        "dominant-baseline": "central"
    };
    layout.destroy();

    const text = createSvgText("", textX, firstY, attrs);
    if (lines.length === 1) {
        text.textContent = lines[0];
    } else {
        lines.forEach((line, index) => {
            const span = createSvgElement("tspan", {x: textX, y: firstY + index * lineHeight});
            span.textContent = line;
            text.appendChild(span);
        });
    }
    if (rotation !== 0) {
        text.setAttribute("transform", `rotate(${-rotation},${center.x},${center.y})`);
    }
    return text;
}

/**
 * Converts all regions and annotations for a frame to SVG elements.
 */
export function renderRegionsToSvg(regions: RegionStore[], frameView: FrameView, layerWidth: number, layerHeight: number, offsetX: number, offsetY: number, options: Partial<RegionSvgOptions> = {}): SVGGElement {
    const renderOptions: RegionSvgOptions = {pixelRatio: options.pixelRatio ?? 1, frame: options.frame};
    const group = svgGroupFromLayer("regions");

    if (offsetX !== 0 || offsetY !== 0) {
        group.setAttribute("transform", `translate(${offsetX},${offsetY})`);
    }

    for (const region of regions) {
        if (!region.isTemporary && region.controlPoints.length > 0) {
            const opacity = region.visualOpacity ?? 1;
            if (opacity === 0) continue;
            const svgElement = renderSingleRegion(region, frameView, layerWidth, layerHeight, renderOptions);
            if (svgElement) {
                svgElement.setAttribute("opacity", `${opacity}`);
                group.appendChild(svgElement);
            }
        }
    }

    return group;
}

function renderSingleRegion(region: RegionStore, frameView: FrameView, layerWidth: number, layerHeight: number, options: RegionSvgOptions): SVGElement | null {
    const cp = region.controlPoints;
    const frame = options.frame;
    const spatialPoints = frame && SPATIAL_APPROXIMATION_REGION_TYPES.has(region.regionType) ? getSpatialRegionCanvasPoints(region, frame, frameView, layerWidth, layerHeight) : null;
    // Pixel aspect ratio belongs to the local shape; independent axis zoom is
    // applied after rotation by the viewer's stage.
    const screenScale = imageSizeToCanvas(1, 1, frameView, layerWidth, layerHeight);
    const axisScaleX = screenScale.x / screenScale.y / (frame?.aspectRatio ?? 1);

    switch (region.regionType) {
        case CARTA.RegionType.POINT:
        case CARTA.RegionType.ANNPOINT: {
            const center = spatialPoints?.[0] ?? transformedImageToCanvas(cp[0], frame, frameView, layerWidth, layerHeight);
            const rotation = frame?.spatialReference && frame.spatialTransform ? (-frame.spatialTransform.rotation * 180) / Math.PI : 0;
            return renderPointRegion(center, region, options.pixelRatio, rotation);
        }
        case CARTA.RegionType.LINE:
        case CARTA.RegionType.ANNLINE: {
            const points = spatialPoints ?? cp.map(point => transformedImageToCanvas(point, frame, frameView, layerWidth, layerHeight));
            return spatialPoints ? renderPolygonRegion(points, region, false, options.pixelRatio) : renderLineRegion(points[0], points[1], region, options.pixelRatio);
        }
        case CARTA.RegionType.RECTANGLE:
        case CARTA.RegionType.ANNRECTANGLE: {
            if (spatialPoints) {
                return renderPolygonRegion(spatialPoints, region, true, options.pixelRatio);
            }
            const center = imageToCanvas(cp[0].x, cp[0].y, frameView, layerWidth, layerHeight);
            const size = imageSizeToCanvas(cp[1].x, cp[1].y, frameView, layerWidth, layerHeight);
            return renderRectangleRegion(center, size, region.rotation, region, options.pixelRatio, axisScaleX);
        }
        case CARTA.RegionType.ELLIPSE:
        case CARTA.RegionType.ANNELLIPSE: {
            if (spatialPoints) {
                return renderPolygonRegion(spatialPoints, region, true, options.pixelRatio);
            }
            const center = imageToCanvas(cp[0].x, cp[0].y, frameView, layerWidth, layerHeight);
            // Ellipse control points store the vertical radius in x and the horizontal radius in y.
            const size = imageSizeToCanvas(cp[1].y, cp[1].x, frameView, layerWidth, layerHeight);
            return renderEllipseRegion(center, size, region.rotation, region, options.pixelRatio, axisScaleX);
        }
        case CARTA.RegionType.POLYGON:
        case CARTA.RegionType.ANNPOLYGON: {
            const points = spatialPoints ?? cp.map(point => transformedImageToCanvas(point, frame, frameView, layerWidth, layerHeight));
            return renderPolygonRegion(points, region, true, options.pixelRatio);
        }
        case CARTA.RegionType.POLYLINE:
        case CARTA.RegionType.ANNPOLYLINE: {
            const points = spatialPoints ?? cp.map(point => transformedImageToCanvas(point, frame, frameView, layerWidth, layerHeight));
            return renderPolygonRegion(points, region, false, options.pixelRatio);
        }
        case CARTA.RegionType.ANNVECTOR: {
            const points = spatialPoints ?? cp.map(point => transformedImageToCanvas(point, frame, frameView, layerWidth, layerHeight));
            return renderVectorAnnotation(points, region, options.pixelRatio);
        }
        case CARTA.RegionType.ANNTEXT: {
            const center = transformedImageToCanvas(cp[0], frame, frameView, layerWidth, layerHeight);
            const size = {x: (cp[1].x / devicePixelRatio) * (frame?.aspectRatio ?? 1), y: cp[1].y / devicePixelRatio};
            const rotation = frame?.spatialReference && frame.spatialTransform ? region.rotation + (frame.spatialTransform.rotation * 180) / Math.PI : region.rotation;
            return renderTextAnnotation(center, size, region, options.pixelRatio, rotation);
        }
        case CARTA.RegionType.ANNCOMPASS:
            return renderCompassAnnotation(region as CompassAnnotationStore, frameView, layerWidth, layerHeight, options);
        case CARTA.RegionType.ANNRULER:
            return renderRulerAnnotation(region as RulerAnnotationStore, frameView, layerWidth, layerHeight, options);
        default:
            return null;
    }
}
