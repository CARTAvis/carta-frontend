import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";

import {type FrameView, type Point2D} from "models";
import {type CompassAnnotationStore, type FrameStore, type RegionStore, type RulerAnnotationStore} from "stores/Frame";

import {createSvgElement, createSvgText, svgGroupFromLayer} from "./svgExport";

const SVG_NS = "http://www.w3.org/2000/svg";

function transformImagePoint(transform: AST.FrameSet | AST.Mapping, point: Point2D, isForward = true): Point2D {
    const transformed = AST.transformPoint(transform, point.x, point.y, isForward);
    return {x: transformed.x, y: transformed.y};
}

function imageToCanvas(imageX: number, imageY: number, frameView: FrameView, layerWidth: number, layerHeight: number): Point2D {
    const viewWidth = frameView.xMax - frameView.xMin;
    const viewHeight = frameView.yMax - frameView.yMin;
    return {
        x: ((imageX - frameView.xMin) / viewWidth) * layerWidth,
        y: layerHeight - ((imageY - frameView.yMin) / viewHeight) * layerHeight
    };
}

function imageSizeToCanvas(sizeX: number, sizeY: number, frameView: FrameView, layerWidth: number, layerHeight: number): Point2D {
    const viewWidth = frameView.xMax - frameView.xMin;
    const viewHeight = frameView.yMax - frameView.yMin;
    return {
        x: (sizeX / viewWidth) * layerWidth,
        y: (sizeY / viewHeight) * layerHeight
    };
}

function getStrokeAttrs(region: RegionStore): Record<string, string | number> {
    const attrs: Record<string, string | number> = {
        stroke: region.color,
        "stroke-width": region.lineWidth,
        fill: "none"
    };
    if (region.dashLength > 0) {
        attrs["stroke-dasharray"] = `${region.dashLength},${region.dashLength}`;
    }
    return attrs;
}

function renderPointRegion(center: Point2D, region: RegionStore, pixelRatio: number): SVGElement {
    const point = region as RegionStore & {pointShape?: CARTA.PointAnnotationShape; pointWidth?: number};
    const width = (point.pointWidth || 6) * pixelRatio;
    const halfWidth = width / 2;
    const shape = point.pointShape ?? CARTA.PointAnnotationShape.SQUARE;
    const isLined = shape === CARTA.PointAnnotationShape.BOX || shape === CARTA.PointAnnotationShape.CIRCLE_LINED || shape === CARTA.PointAnnotationShape.DIAMOND_LINED;
    const strokeAttrs = {stroke: region.color, "stroke-width": region.lineWidth, fill: isLined ? "none" : region.color};
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
            element = createSvgElement("rect", {x: center.x - halfWidth, y: center.y - halfWidth, width, height: width, fill: region.color, stroke: region.color, "stroke-width": region.lineWidth});
            break;
    }

    return element;
}

function renderLineRegion(start: Point2D, end: Point2D, region: RegionStore): SVGElement {
    return createSvgElement("line", {
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        ...getStrokeAttrs(region)
    });
}

function renderRectangleRegion(center: Point2D, size: Point2D, rotation: number, region: RegionStore): SVGElement {
    const rect = createSvgElement("rect", {
        x: center.x - size.x / 2,
        y: center.y - size.y / 2,
        width: size.x,
        height: size.y,
        ...getStrokeAttrs(region)
    });
    if (rotation !== 0) {
        rect.setAttribute("transform", `rotate(${-rotation},${center.x},${center.y})`);
    }
    return rect;
}

function renderEllipseRegion(center: Point2D, size: Point2D, rotation: number, region: RegionStore): SVGElement {
    const ellipse = createSvgElement("ellipse", {
        cx: center.x,
        cy: center.y,
        // Ellipse control points store the semi-minor radius in x and the
        // semi-major radius in y, while SVG names the horizontal radius rx.
        rx: size.y,
        ry: size.x,
        ...getStrokeAttrs(region)
    });
    if (rotation !== 0) {
        ellipse.setAttribute("transform", `rotate(${-rotation},${center.x},${center.y})`);
    }
    return ellipse;
}

function renderPolygonRegion(points: Point2D[], region: RegionStore, isClosed: boolean): SVGElement {
    const pointsStr = points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    return createSvgElement(isClosed ? "polygon" : "polyline", {
        points: pointsStr,
        ...getStrokeAttrs(region)
    });
}

function renderVectorAnnotation(start: Point2D, end: Point2D, region: RegionStore, defsElement: SVGDefsElement): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g");
    const markerId = `arrowhead-${region.regionId}`;

    // Create arrowhead marker
    const marker = createSvgElement("marker", {
        id: markerId,
        markerWidth: 10,
        markerHeight: 7,
        refX: 10,
        refY: 3.5,
        orient: "auto"
    });
    const arrowPath = createSvgElement("polygon", {
        points: "0 0, 10 3.5, 0 7",
        fill: region.color
    });
    marker.appendChild(arrowPath);
    defsElement.appendChild(marker);

    const line = createSvgElement("line", {
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        "marker-end": `url(#${markerId})`,
        ...getStrokeAttrs(region)
    });
    group.appendChild(line);
    return group;
}

interface RegionSvgOptions {
    frame?: FrameStore;
    pixelRatio: number;
}

function toCanvasPoints(points: number[], frameView: FrameView, layerWidth: number, layerHeight: number): Point2D[] {
    const canvasPoints: Point2D[] = [];
    for (let i = 0; i + 1 < points.length; i += 2) {
        canvasPoints.push(imageToCanvas(points[i], points[i + 1], frameView, layerWidth, layerHeight));
    }
    return canvasPoints;
}

function pointAtDistance(start: Point2D, points: Point2D[], distance: number): Point2D {
    let previous = start;
    let remaining = distance;
    for (const point of points) {
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const segmentLength = Math.hypot(dx, dy);
        if (segmentLength >= remaining && segmentLength > 0) {
            const fraction = remaining / segmentLength;
            return {x: previous.x + dx * fraction, y: previous.y + dy * fraction};
        }
        remaining -= segmentLength;
        previous = point;
    }
    return previous;
}

function getAnnotationPath(origin: Point2D, approximatePoints: number[], frameView: FrameView, layerWidth: number, layerHeight: number, length: number): [Point2D, Point2D] {
    const points = toCanvasPoints(approximatePoints, frameView, layerWidth, layerHeight);
    return [origin, pointAtDistance(origin, points, length)];
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

function getCompassLabelPosition(origin: Point2D, tip: Point2D, region: CompassAnnotationStore, pixelRatio: number, fallbackDirection: Point2D): Point2D {
    let direction = {x: tip.x - origin.x, y: tip.y - origin.y};
    const length = Math.hypot(direction.x, direction.y);
    if (length === 0) {
        direction = fallbackDirection;
    } else {
        direction = {x: direction.x / length, y: direction.y / length};
    }
    const labelGap = Math.max(4, (region.fontSize ?? 20) * 0.75) * pixelRatio;
    return {
        x: tip.x + direction.x * labelGap,
        y: tip.y + direction.y * labelGap
    };
}

function renderCompassAnnotation(region: CompassAnnotationStore, frameView: FrameView, layerWidth: number, layerHeight: number, defsElement: SVGDefsElement, options: RegionSvgOptions): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g");
    const originImage = options.frame?.spatialReference && options.frame.spatialTransformAST ? transformImagePoint(options.frame.spatialTransformAST, region.controlPoints[0], false) : region.controlPoints[0];
    const origin = imageToCanvas(originImage.x, originImage.y, frameView, layerWidth, layerHeight);
    const length = region.length * options.pixelRatio;
    let northEnd: Point2D;
    let eastEnd: Point2D;

    if (options.frame?.isValidWcs) {
        try {
            const approx = region.getCompassApproximation(options.frame.wcsInfoForTransformation, Boolean(options.frame.spatialReference), options.frame.spatialTransformAST || undefined);
            [, northEnd] = getAnnotationPath(origin, approx.northApproximatePoints, frameView, layerWidth, layerHeight, length);
            [, eastEnd] = getAnnotationPath(origin, approx.eastApproximatePoints, frameView, layerWidth, layerHeight, length);
        } catch {
            northEnd = {x: origin.x, y: origin.y - length};
            eastEnd = {x: origin.x - length, y: origin.y};
        }
    } else {
        northEnd = {x: origin.x, y: origin.y - length};
        eastEnd = {x: origin.x - length, y: origin.y};
    }

    const addArrow = (start: Point2D, end: Point2D, hasArrowhead: boolean, markerSuffix: string) => {
        const lineAttrs = {x1: start.x, y1: start.y, x2: end.x, y2: end.y, ...getStrokeAttrs(region)};
        if (hasArrowhead) {
            const markerId = `compass-${region.regionId}-${markerSuffix}`;
            const marker = createSvgElement("marker", {
                id: markerId,
                markerWidth: region.pointerLength * options.pixelRatio,
                markerHeight: region.pointerWidth * options.pixelRatio,
                refX: region.pointerLength * options.pixelRatio,
                refY: (region.pointerWidth * options.pixelRatio) / 2,
                markerUnits: "userSpaceOnUse",
                orient: "auto"
            });
            marker.appendChild(
                createSvgElement("polygon", {
                    points: `0 0, ${region.pointerLength * options.pixelRatio} ${(region.pointerWidth * options.pixelRatio) / 2}, 0 ${region.pointerWidth * options.pixelRatio}`,
                    fill: region.color
                })
            );
            defsElement.appendChild(marker);
            lineAttrs["marker-end"] = `url(#${markerId})`;
        }
        group.appendChild(createSvgElement("line", lineAttrs));
    };

    addArrow(origin, northEnd, region.hasNorthArrowhead, "north");
    addArrow(origin, eastEnd, region.hasEastArrowhead, "east");

    const northText = renderAnnotationText(region.northLabel, getCompassLabelPosition(origin, northEnd, region, options.pixelRatio, {x: 0, y: -1}), region, options.pixelRatio);
    const eastText = renderAnnotationText(region.eastLabel, getCompassLabelPosition(origin, eastEnd, region, options.pixelRatio, {x: -1, y: 0}), region, options.pixelRatio);
    group.append(northText, eastText);
    return group;
}

function getDistanceText(wcsInfo: AST.FrameSet, start: Point2D, finish: Point2D, region: RulerAnnotationStore): string {
    try {
        const distance = ((AST.geodesicDistance(wcsInfo, start.x, start.y, finish.x, finish.y) / 3600) * Math.PI) / 180.0;
        const unit = AST.getString(wcsInfo, "Unit(1)");
        if (unit.includes("degree") || unit.includes("hh:mm:s")) {
            if (distance < Math.PI / 180.0 / 60.0) return `${(((distance * 180) / Math.PI) * 3600).toFixed(region.decimals)}\"`;
            if (distance < Math.PI / 180.0) return `${(((distance * 180) / Math.PI) * 60).toFixed(region.decimals)}'`;
            return `${((distance * 180) / Math.PI).toFixed(region.decimals)}°`;
        }
        return `${distance.toFixed(region.decimals)}${!unit || unit.trim() === "" ? "pix" : ""}`;
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

    const startCanvas = imageToCanvas(start.x, start.y, frameView, layerWidth, layerHeight);
    const finishCanvas = imageToCanvas(finish.x, finish.y, frameView, layerWidth, layerHeight);
    const cornerCanvas = imageToCanvas(corner.x, corner.y, frameView, layerWidth, layerHeight);
    let xPoints: Point2D[] = [startCanvas, cornerCanvas];
    let yPoints: Point2D[] = [cornerCanvas, finishCanvas];
    let hypotenusePoints: Point2D[] = [startCanvas, finishCanvas];

    if (options.frame) {
        const frame = options.frame;
        try {
            const selectedWcsInfo = frame.isOffsetCoord ? frame.wcsInfoOffset : frame.wcsInfoForTransformation;
            const wcsInfo = (frame.isValidWcs ? selectedWcsInfo : undefined) ?? frame.wcsInfo;
            const approx = region.getCurveApproximation(wcsInfo, frame.spatialTransformAST || undefined);
            xPoints = toCanvasPoints(approx.xApproximatePoints, frameView, layerWidth, layerHeight);
            yPoints = toCanvasPoints(approx.yApproximatePoints, frameView, layerWidth, layerHeight);
            hypotenusePoints = toCanvasPoints(approx.hypotenuseApproximatePoints, frameView, layerWidth, layerHeight);
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

    const line = (points: Point2D[], dashLength: number, opacity = 1) => {
        const attrs: Record<string, string | number> = {points: points.map(point => `${point.x},${point.y}`).join(" "), ...getStrokeAttrs(region), opacity};
        if (dashLength > 0) attrs["stroke-dasharray"] = `${dashLength * options.pixelRatio},${dashLength * options.pixelRatio}`;
        return createSvgElement("polyline", attrs);
    };
    group.appendChild(line(hypotenusePoints, region.dashLength));
    if (region.isAuxiliaryLineVisible) {
        group.appendChild(line(xPoints, region.auxiliaryLineDashLength));
        group.appendChild(line(yPoints, region.auxiliaryLineDashLength));
    }

    const midpoint = (points: Point2D[]): Point2D => points[Math.floor((points.length - 1) / 2)] ?? points[0];
    const addText = (text: string, position: Point2D, offset: Point2D) => {
        if (text) group.appendChild(renderAnnotationText(text, {x: position.x + offset.x * options.pixelRatio, y: position.y + offset.y * options.pixelRatio}, region, options.pixelRatio));
    };
    addText(distanceText, midpoint(hypotenusePoints), region.textOffset);
    if (region.isAuxiliaryTextVisible) {
        addText(xDistanceText, midpoint(xPoints), region.xTextOffset);
        addText(yDistanceText, midpoint(yPoints), region.yTextOffset);
    }
    return group;
}

function renderTextAnnotation(center: Point2D, size: Point2D, region: RegionStore, pixelRatio: number): SVGElement {
    const textRegion = region as RegionStore & {text?: string; fontSize?: number; font?: string; fontStyle?: string; position?: CARTA.TextAnnotationPosition};
    const textContent = textRegion.text ?? "";
    const attrs: Record<string, string | number> = {
        fill: region.color,
        "font-size": Math.abs(textRegion.fontSize ?? 20) * pixelRatio,
        "font-family": textRegion.font ?? "Helvetica",
        "font-style": textRegion.fontStyle?.toLowerCase().includes("italic") ? "italic" : "normal",
        "font-weight": textRegion.fontStyle?.toLowerCase().includes("bold") ? "bold" : "normal",
        "text-anchor": "middle",
        "dominant-baseline": "central"
    };
    const position = textRegion.position ?? CARTA.TextAnnotationPosition.CENTER;
    switch (position) {
        case CARTA.TextAnnotationPosition.UPPER_LEFT:
        case CARTA.TextAnnotationPosition.LOWER_LEFT:
        case CARTA.TextAnnotationPosition.LEFT:
            attrs["text-anchor"] = "start";
            break;
        case CARTA.TextAnnotationPosition.UPPER_RIGHT:
        case CARTA.TextAnnotationPosition.LOWER_RIGHT:
        case CARTA.TextAnnotationPosition.RIGHT:
            attrs["text-anchor"] = "end";
            break;
    }
    switch (position) {
        case CARTA.TextAnnotationPosition.UPPER_LEFT:
        case CARTA.TextAnnotationPosition.UPPER_RIGHT:
        case CARTA.TextAnnotationPosition.TOP:
            attrs["dominant-baseline"] = "text-before-edge";
            break;
        case CARTA.TextAnnotationPosition.LOWER_LEFT:
        case CARTA.TextAnnotationPosition.LOWER_RIGHT:
        case CARTA.TextAnnotationPosition.BOTTOM:
            attrs["dominant-baseline"] = "text-after-edge";
            break;
    }
    let textX = center.x;
    let textY = center.y;
    if (attrs["text-anchor"] === "start") textX -= size.x / 2;
    if (attrs["text-anchor"] === "end") textX += size.x / 2;
    if (attrs["dominant-baseline"] === "text-before-edge") textY -= size.y / 2;
    if (attrs["dominant-baseline"] === "text-after-edge") textY += size.y / 2;
    const text = createSvgText(textContent, textX, textY, attrs);
    if (region.rotation !== 0) {
        text.setAttribute("transform", `rotate(${-region.rotation},${center.x},${center.y})`);
    }
    return text;
}

/**
 * Converts all regions and annotations for a frame to SVG elements.
 */
export function renderRegionsToSvg(regions: RegionStore[], frameView: FrameView, layerWidth: number, layerHeight: number, offsetX: number, offsetY: number, options: Partial<RegionSvgOptions> = {}): SVGGElement {
    const renderOptions: RegionSvgOptions = {pixelRatio: options.pixelRatio ?? 1, frame: options.frame};
    const group = svgGroupFromLayer("regions");
    const defs = document.createElementNS(SVG_NS, "defs");
    group.appendChild(defs);

    if (offsetX !== 0 || offsetY !== 0) {
        group.setAttribute("transform", `translate(${offsetX},${offsetY})`);
    }

    for (const region of regions) {
        if (!region.isTemporary && region.controlPoints.length > 0) {
            const svgElement = renderSingleRegion(region, frameView, layerWidth, layerHeight, defs, renderOptions);
            if (svgElement) {
                group.appendChild(svgElement);
            }
        }
    }

    return group;
}

function renderSingleRegion(region: RegionStore, frameView: FrameView, layerWidth: number, layerHeight: number, defsElement: SVGDefsElement, options: RegionSvgOptions): SVGElement | null {
    const cp = region.controlPoints;

    switch (region.regionType) {
        case CARTA.RegionType.POINT:
        case CARTA.RegionType.ANNPOINT: {
            const center = imageToCanvas(cp[0].x, cp[0].y, frameView, layerWidth, layerHeight);
            return renderPointRegion(center, region, options.pixelRatio);
        }
        case CARTA.RegionType.LINE:
        case CARTA.RegionType.ANNLINE: {
            const start = imageToCanvas(cp[0].x, cp[0].y, frameView, layerWidth, layerHeight);
            const end = imageToCanvas(cp[1].x, cp[1].y, frameView, layerWidth, layerHeight);
            return renderLineRegion(start, end, region);
        }
        case CARTA.RegionType.RECTANGLE:
        case CARTA.RegionType.ANNRECTANGLE: {
            const center = imageToCanvas(cp[0].x, cp[0].y, frameView, layerWidth, layerHeight);
            const size = imageSizeToCanvas(cp[1].x, cp[1].y, frameView, layerWidth, layerHeight);
            return renderRectangleRegion(center, size, region.rotation, region);
        }
        case CARTA.RegionType.ELLIPSE:
        case CARTA.RegionType.ANNELLIPSE: {
            const center = imageToCanvas(cp[0].x, cp[0].y, frameView, layerWidth, layerHeight);
            const size = imageSizeToCanvas(cp[1].x, cp[1].y, frameView, layerWidth, layerHeight);
            return renderEllipseRegion(center, size, region.rotation, region);
        }
        case CARTA.RegionType.POLYGON:
        case CARTA.RegionType.ANNPOLYGON: {
            const points = cp.map(p => imageToCanvas(p.x, p.y, frameView, layerWidth, layerHeight));
            return renderPolygonRegion(points, region, true);
        }
        case CARTA.RegionType.POLYLINE:
        case CARTA.RegionType.ANNPOLYLINE: {
            const points = cp.map(p => imageToCanvas(p.x, p.y, frameView, layerWidth, layerHeight));
            return renderPolygonRegion(points, region, false);
        }
        case CARTA.RegionType.ANNVECTOR: {
            const start = imageToCanvas(cp[0].x, cp[0].y, frameView, layerWidth, layerHeight);
            const end = imageToCanvas(cp[1].x, cp[1].y, frameView, layerWidth, layerHeight);
            return renderVectorAnnotation(start, end, region, defsElement);
        }
        case CARTA.RegionType.ANNTEXT: {
            const center = imageToCanvas(cp[0].x, cp[0].y, frameView, layerWidth, layerHeight);
            const size = imageSizeToCanvas(cp[1].x, cp[1].y, frameView, layerWidth, layerHeight);
            return renderTextAnnotation(center, size, region, options.pixelRatio);
        }
        case CARTA.RegionType.ANNCOMPASS:
            return renderCompassAnnotation(region as CompassAnnotationStore, frameView, layerWidth, layerHeight, defsElement, options);
        case CARTA.RegionType.ANNRULER:
            return renderRulerAnnotation(region as RulerAnnotationStore, frameView, layerWidth, layerHeight, options);
        default:
            return null;
    }
}
