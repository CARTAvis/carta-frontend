import {CARTA} from "carta-protobuf";

import {type FrameView, type Point2D} from "models";
import {type RegionStore, TextAnnotationStore} from "stores/Frame";

import {createSvgElement, createSvgText, svgGroupFromLayer} from "./svgExport";

const SVG_NS = "http://www.w3.org/2000/svg";

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

function renderPointRegion(center: Point2D, region: RegionStore): SVGElement {
    return createSvgElement("circle", {
        cx: center.x,
        cy: center.y,
        r: 5,
        fill: region.color,
        stroke: region.color,
        "stroke-width": region.lineWidth
    });
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
        rx: size.x,
        ry: size.y,
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

function renderTextAnnotation(center: Point2D, size: Point2D, region: RegionStore): SVGElement {
    const textContent = region instanceof TextAnnotationStore ? region.text : "";
    return createSvgText(textContent, center.x, center.y, {
        fill: region.color,
        "font-size": Math.abs(size.y),
        "text-anchor": "middle",
        "dominant-baseline": "central"
    });
}

/**
 * Converts all regions and annotations for a frame to SVG elements.
 */
export function renderRegionsToSvg(regions: RegionStore[], frameView: FrameView, layerWidth: number, layerHeight: number, offsetX: number, offsetY: number): SVGGElement {
    const group = svgGroupFromLayer("regions");
    const defs = document.createElementNS(SVG_NS, "defs");
    group.appendChild(defs);

    if (offsetX !== 0 || offsetY !== 0) {
        group.setAttribute("transform", `translate(${offsetX},${offsetY})`);
    }

    for (const region of regions) {
        if (!region.isTemporary && region.controlPoints.length > 0) {
            const svgElement = renderSingleRegion(region, frameView, layerWidth, layerHeight, defs);
            if (svgElement) {
                group.appendChild(svgElement);
            }
        }
    }

    return group;
}

function renderSingleRegion(region: RegionStore, frameView: FrameView, layerWidth: number, layerHeight: number, defsElement: SVGDefsElement): SVGElement | null {
    const cp = region.controlPoints;

    switch (region.regionType) {
        case CARTA.RegionType.POINT:
        case CARTA.RegionType.ANNPOINT: {
            const center = imageToCanvas(cp[0].x, cp[0].y, frameView, layerWidth, layerHeight);
            return renderPointRegion(center, region);
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
            return renderTextAnnotation(center, size, region);
        }
        case CARTA.RegionType.ANNCOMPASS:
        case CARTA.RegionType.ANNRULER:
            // TODO: These annotations require complex AST coordinate transformations
            // and are not yet supported in SVG export. They will be omitted.
            return null;
        default:
            return null;
    }
}
