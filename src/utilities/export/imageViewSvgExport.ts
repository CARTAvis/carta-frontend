import {Colors} from "@blueprintjs/core";

import {AstFonts} from "components/Shared";
import {BeamType, ContourDashMode, ImageType, VectorOverlaySource} from "enums";
import {type FrameView, type ImageViewItem, type Point2D} from "models";
import {AppStore, type CatalogDisplayStore, type OverlayColorbarSettings, type Padding} from "stores";
import {type FrameStore} from "stores/Frame";
import {ceilToPower, getChannelMapCell, getColorForTheme} from "utilities";

import {renderAstOverlayToSvg} from "./astSvgExport";
import {type BeamPlotProps, renderBeamToSvg} from "./beamSvgExport";
import {type CatalogPointStyle, getCatalogSizeFromArea, getCatalogSizeTuning, isCatalogPointVisible, renderCatalogToSvg} from "./catalogSvgExport";
import {renderColorbarToSvg} from "./colorbarSvgExport";
import {renderContoursToSvg} from "./contourSvgExport";
import {findElementInAllDocuments} from "./imageExportDom";
import {renderRegionsToSvg} from "./regionSvgExport";
import {sampleSvgColormapColor} from "./svgColor";
import {buildSvgDocument, createSvgElement, createSvgText, embedRasterAsSvgImage, svgGroupFromLayer} from "./svgExport";
import {renderVectorOverlayToSvg} from "./vectorOverlaySvgExport";

export function getImageViewSvg(padding: Padding, backgroundColor: string = "rgba(255, 255, 255, 0)"): SVGSVGElement | null {
    const appStore = AppStore.Instance;
    const config = appStore.imageViewConfigStore;

    const totalWidth = appStore.fullViewWidth * appStore.pixelRatio;
    const totalHeight = appStore.fullViewHeight * appStore.pixelRatio;
    const svgDoc = buildSvgDocument(totalWidth, totalHeight, backgroundColor);

    config.visibleImages.forEach((image, index) => {
        const frame = image?.type === ImageType.COLOR_BLENDING ? image.store?.baseFrame : image?.store;
        if (!frame) {
            return;
        }
        const column = index % config.numImageColumns;
        const row = Math.floor(index / config.numImageColumns);
        const viewHeight = (appStore.channelMapStore.isChannelMapEnabled ? frame.channelMapOuterOverlayStore.viewHeight : frame.overlayStore.viewHeight) * appStore.pixelRatio;
        const panelSvg = getPanelSvg(column, row, viewHeight, padding, image);
        if (panelSvg) {
            const offsetX = frame.overlayStore.viewWidth * column * appStore.pixelRatio;
            const offsetY = frame.overlayStore.viewHeight * row * appStore.pixelRatio;
            if (offsetX !== 0 || offsetY !== 0) {
                panelSvg.setAttribute("transform", `translate(${offsetX},${offsetY})`);
            }
            svgDoc.appendChild(panelSvg);
        }
    });

    return svgDoc;
}

const DEFAULT_CONTOUR_DASH_LENGTH = 8;

function clampValue(value: number, minValue: number, maxValue: number): number {
    return Math.min(Math.max(value, minValue), maxValue);
}

function getDestinationFrameView(frame: FrameStore): FrameView | null {
    return frame.spatialReference ? frame.spatialReference.requiredFrameView : frame.requiredFrameView;
}

function imageToCanvasPoint(imagePoint: Point2D, frameView: FrameView, layerWidth: number, layerHeight: number): Point2D {
    const viewWidth = frameView.xMax - frameView.xMin;
    const viewHeight = frameView.yMax - frameView.yMin;

    return {
        x: ((imagePoint.x - frameView.xMin) / viewWidth) * layerWidth,
        y: layerHeight - ((imagePoint.y - frameView.yMin) / viewHeight) * layerHeight
    };
}

function imageSizeToCanvasSize(sizeX: number, sizeY: number, frameView: FrameView, layerWidth: number, layerHeight: number): Point2D {
    const viewWidth = frameView.xMax - frameView.xMin;
    const viewHeight = frameView.yMax - frameView.yMin;

    return {
        x: (sizeX / viewWidth) * layerWidth,
        y: (sizeY / viewHeight) * layerHeight
    };
}

function rgbColorToCss(color: {r: number; g: number; b: number; a?: number} | undefined): string {
    if (!color) {
        return "rgba(255, 255, 255, 1)";
    }

    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a ?? 1})`;
}

function getContourStrokeWidth(sourceFrame: FrameStore, pixelRatio: number): number {
    return pixelRatio * sourceFrame.contourConfig.thickness;
}

function getContourDashLength(destinationFrame: FrameStore, dashMode: ContourDashMode, level: number, pixelRatio: number): number {
    if (dashMode !== ContourDashMode.Dashed && !(dashMode === ContourDashMode.NegativeOnly && level < 0)) {
        return 0;
    }

    const zoomLevel = destinationFrame.spatialReference ? destinationFrame.spatialReference.zoomLevel : destinationFrame.zoomLevel;
    const zoomScale = destinationFrame.spatialReference ? zoomLevel * (destinationFrame.spatialTransform?.scale ?? 1) : zoomLevel;
    const dashFactor = ceilToPower(1.0 / zoomLevel, 3.0);
    return pixelRatio * DEFAULT_CONTOUR_DASH_LENGTH * dashFactor * zoomScale;
}

function getContourStrokeColor(frame: FrameStore, level: number, minLevel: number, maxLevel: number): string {
    const fallbackColor = rgbColorToCss(frame.contourConfig.color);
    if (!frame.contourConfig.isColormapEnabled) {
        return fallbackColor;
    }

    const fraction = minLevel === maxLevel ? 1 : (level - minLevel) / (maxLevel - minLevel);

    return sampleSvgColormapColor(frame.contourConfig.colormap, fraction, frame.contourConfig.colormapBias, frame.contourConfig.colormapContrast, fallbackColor, frame.contourConfig.isColormapInverted);
}

function getVectorCanvasLength(frame: FrameStore, intensity: number, pixelRatio: number): number {
    const config = frame.vectorOverlayConfig;
    const intensityMin = isFinite(config.intensityMin ?? NaN) ? config.intensityMin : frame.vectorOverlayStore.intensityMin;
    const intensityMax = isFinite(config.intensityMax ?? NaN) ? config.intensityMax : frame.vectorOverlayStore.intensityMax;
    const lengthMin = config.lengthMin * pixelRatio;
    const lengthMax = config.lengthMax * pixelRatio;

    if (config.intensitySource === VectorOverlaySource.None) {
        return lengthMax;
    }

    if (!isFinite(intensityMin ?? NaN) || !isFinite(intensityMax ?? NaN) || intensityMin === intensityMax) {
        return lengthMax;
    }

    const minIntensity = intensityMin ?? 0;
    const maxIntensity = intensityMax ?? minIntensity;
    const scaledIntensity = clampValue((intensity - minIntensity) / (maxIntensity - minIntensity), 0, 1);
    return lengthMin + (lengthMax - lengthMin) * scaledIntensity;
}

function getVectorCanvasAngle(sourceFrame: FrameStore, destinationFrame: FrameStore, angleDegrees: number): number {
    const config = sourceFrame.vectorOverlayConfig;
    const rotationOffset = isFinite(config.rotationOffset) ? config.rotationOffset : 0;
    const angle = config.angularSource === VectorOverlaySource.None ? 0 : ((-angleDegrees - rotationOffset) * Math.PI) / 180;
    const zoomFrame = destinationFrame.spatialReference ?? destinationFrame;
    const zoom = zoomFrame.effectiveZoomLevel ?? {x: zoomFrame.zoomLevel, y: zoomFrame.zoomLevel};
    // The shader maps the center, then normalizes this screen-space direction.
    return Math.atan2(Math.cos(angle) * zoom.y, -Math.sin(angle) * zoom.x * (sourceFrame.aspectRatio ?? 1));
}

function getVectorStrokeColor(frame: FrameStore, intensity: number): string {
    const fallbackColor = rgbColorToCss(frame.vectorOverlayConfig.color);
    if (!frame.vectorOverlayConfig.isColormapEnabled) {
        return fallbackColor;
    }

    const intensityMin = frame.vectorOverlayConfig.intensitySource === VectorOverlaySource.None ? 0 : isFinite(frame.vectorOverlayConfig.intensityMin ?? NaN) ? frame.vectorOverlayConfig.intensityMin : frame.vectorOverlayStore.intensityMin;
    const intensityMax = frame.vectorOverlayConfig.intensitySource === VectorOverlaySource.None ? 1 : isFinite(frame.vectorOverlayConfig.intensityMax ?? NaN) ? frame.vectorOverlayConfig.intensityMax : frame.vectorOverlayStore.intensityMax;
    const fraction = !isFinite(intensityMin ?? NaN) || !isFinite(intensityMax ?? NaN) || intensityMin === intensityMax ? 1 : (intensity - (intensityMin ?? 0)) / ((intensityMax ?? 0) - (intensityMin ?? 0));

    return sampleSvgColormapColor(frame.vectorOverlayConfig.colormap, fraction, frame.vectorOverlayConfig.colormapBias, frame.vectorOverlayConfig.colormapContrast, fallbackColor, frame.vectorOverlayConfig.isColormapInverted);
}

function transformOverlayPoint(point: Point2D, sourceFrame: FrameStore, destinationFrame: FrameStore, shouldUseCatalogTransform: boolean = false): Point2D | null {
    if (sourceFrame === destinationFrame) {
        return point;
    }

    const controlMap = shouldUseCatalogTransform ? sourceFrame.getCatalogControlMap(destinationFrame) : sourceFrame.getControlMap(destinationFrame);
    return controlMap.transformPoint(point);
}

function transformContourPoint(point: Point2D, sourceFrame: FrameStore, destinationFrame: FrameStore): Point2D | null {
    return transformFramePoint(point, sourceFrame, destinationFrame, false);
}

function transformFramePoint(point: Point2D, sourceFrame: FrameStore, destinationFrame: FrameStore, shouldUseCatalogTransform: boolean): Point2D | null {
    const transformedPoint = transformOverlayPoint(point, sourceFrame, destinationFrame, shouldUseCatalogTransform);
    if (!transformedPoint) {
        return null;
    }

    if (destinationFrame.spatialReference) {
        return destinationFrame.spatialTransform?.transformCoordinate(transformedPoint, true) ?? null;
    }

    return transformedPoint;
}

function transformContourVertexData(vertexDataArrays: (Float32Array | null)[], sourceFrame: FrameStore, destinationFrame: FrameStore, frameView: FrameView, layerWidth: number, layerHeight: number): (Float32Array | null)[] {
    return vertexDataArrays.map(vertexData => {
        if (!vertexData) {
            return null;
        }

        const transformed = new Float32Array(vertexData);
        for (let index = 0; index < transformed.length; index += 8) {
            // Check for degenerate connecting pair BEFORE transformation.
            // In a normal pair, both vertices are at the exact same image coordinate.
            // In a degenerate pair connecting Polyline A to Polyline B, the first
            // vertex is A's last point, and the second is B's first point.
            // (If they are exactly the same point, drawing a line is harmless/invisible).
            const isDegenerate = Math.abs(transformed[index] - transformed[index + 4]) > 1e-6 || Math.abs(transformed[index + 1] - transformed[index + 5]) > 1e-6;

            if (isDegenerate) {
                transformed[index] = Number.NaN;
                transformed[index + 1] = Number.NaN;
                continue;
            }

            const transformedPoint = transformContourPoint({x: transformed[index] - 0.5, y: transformed[index + 1] - 0.5}, sourceFrame, destinationFrame);
            if (!transformedPoint) {
                transformed[index] = Number.NaN;
                transformed[index + 1] = Number.NaN;
                continue;
            }

            const canvasPoint = imageToCanvasPoint(transformedPoint, frameView, layerWidth, layerHeight);
            transformed[index] = canvasPoint.x;
            transformed[index + 1] = canvasPoint.y;
        }

        return transformed;
    });
}

function buildContoursSvg(frame: FrameStore, padding: Padding, pixelRatio: number): SVGGElement | null {
    const contourFrames = AppStore.Instance.contourFrames.get(frame);
    const frameView = getDestinationFrameView(frame);
    if (!contourFrames?.length || !frameView) {
        return null;
    }

    const layerWidth = frame.renderWidth * pixelRatio;
    const layerHeight = frame.renderHeight * pixelRatio;
    const group = svgGroupFromLayer("contours");

    for (let frameIndex = contourFrames.length - 1; frameIndex >= 0; --frameIndex) {
        const contourFrame = contourFrames[frameIndex];
        if (!contourFrame.contourConfig.isVisible || !contourFrame.contourStores.size) {
            continue;
        }

        let minLevel = Infinity;
        let maxLevel = -Infinity;
        contourFrame.contourStores.forEach((_, level) => {
            minLevel = Math.min(minLevel, level);
            maxLevel = Math.max(maxLevel, level);
        });
        contourFrame.contourStores.forEach((contourStore, level) => {
            const contourSvg = renderContoursToSvg(
                transformContourVertexData(contourStore.exportVertexData, contourFrame, frame, frameView, layerWidth, layerHeight),
                getContourStrokeColor(contourFrame, level, minLevel, maxLevel),
                getContourStrokeWidth(contourFrame, pixelRatio),
                getContourDashLength(frame, contourFrame.contourConfig.dashMode, level, pixelRatio),
                padding.left * pixelRatio,
                padding.top * pixelRatio
            );
            group.appendChild(contourSvg);
        });
    }

    return group.childNodes.length ? group : null;
}

function buildVectorOverlaySvg(frame: FrameStore, padding: Padding, pixelRatio: number): SVGGElement | null {
    const vectorOverlayFrames = AppStore.Instance.vectorOverlayFrames.get(frame);
    const frameView = getDestinationFrameView(frame);
    if (!vectorOverlayFrames?.length || !frameView) {
        return null;
    }

    const layerWidth = frame.renderWidth * pixelRatio;
    const layerHeight = frame.renderHeight * pixelRatio;
    const group = svgGroupFromLayer("vector-overlays");

    for (let frameIndex = vectorOverlayFrames.length - 1; frameIndex >= 0; --frameIndex) {
        const vectorFrame = vectorOverlayFrames[frameIndex];
        if (!vectorFrame.vectorOverlayConfig.isVisible || !vectorFrame.vectorOverlayStore.tiles?.length) {
            continue;
        }

        const exportPositions: number[] = [];
        const strokeColors: string[] = [];
        vectorFrame.vectorOverlayStore.tiles.forEach(tile => {
            for (let vectorIndex = 0; vectorIndex < tile.numVertices; vectorIndex++) {
                const offset = vectorIndex * 4;
                const center = {x: tile.vertexData[offset], y: tile.vertexData[offset + 1]};
                const intensity = tile.vertexData[offset + 2];
                const rawAngleDegrees = tile.vertexData[offset + 3];
                const lineLength = getVectorCanvasLength(vectorFrame, intensity, pixelRatio);
                if (lineLength <= 0) {
                    continue;
                }

                const transformedCenter = transformContourPoint(center, vectorFrame, frame);
                if (!transformedCenter) {
                    continue;
                }
                const canvasCenter = imageToCanvasPoint(transformedCenter, frameView, layerWidth, layerHeight);
                exportPositions.push(canvasCenter.x, canvasCenter.y, lineLength, getVectorCanvasAngle(vectorFrame, frame, rawAngleDegrees));
                strokeColors.push(getVectorStrokeColor(vectorFrame, intensity));
            }
        });

        if (exportPositions.length) {
            const vectorSvg = renderVectorOverlayToSvg(
                Float32Array.from(exportPositions),
                exportPositions.length / 4,
                1,
                pixelRatio * vectorFrame.vectorOverlayConfig.thickness,
                strokeColors,
                padding.left * pixelRatio,
                padding.top * pixelRatio,
                vectorFrame.vectorOverlayConfig.angularSource === VectorOverlaySource.None,
                pixelRatio / (frame.spatialTransform?.scale ?? 1)
            );
            group.appendChild(vectorSvg);
        }
    }

    return group.childNodes.length ? group : null;
}

function getCatalogPointSize(frame: FrameStore, size: number, isImagePixelSize: boolean, pixelRatio: number): number {
    if (!isImagePixelSize) {
        // SVG coordinates are device pixels; pixelRatio includes both Retina and export-resolution scaling.
        return size * pixelRatio;
    }

    const frameView = getDestinationFrameView(frame);
    return frameView ? imageSizeToCanvasSize(size, size, frameView, frame.renderWidth * pixelRatio, frame.renderHeight * pixelRatio).x : size;
}

function createCatalogStyleResolver(store: CatalogDisplayStore, frame: FrameStore, pixelRatio: number): (index: number, isSelected: boolean) => CatalogPointStyle {
    const mappedSizes = store.sizeArray?.() ?? new Float32Array();
    const mappedMinorSizes = store.sizeMinorArray?.() ?? new Float32Array();
    const mappedColors = store.colorArray?.() ?? new Float32Array();
    const mappedOrientations = store.orientationArray?.() ?? new Float32Array();
    const shapeSize = store.isImagePixelSize ? store.catalogSize : store.catalogSize + (store.shapeSettings?.diameterBase ?? 0);
    const zoomFrame = frame.spatialReference ?? frame;
    const zoomY = zoomFrame.effectiveZoomLevel?.y ?? zoomFrame.zoomLevel;
    const areaScale = store.isImagePixelSize ? getCatalogSizeTuning(store.catalogShape) * zoomY : 1;
    const defaultSize = getCatalogPointSize(frame, shapeSize, store.isImagePixelSize, pixelRatio);
    const lineWidth = (isFinite(store.thickness) ? store.thickness : 1) * (store.shapeSettings?.thicknessBase ?? 1) * pixelRatio;

    return (index, isSelected) => {
        const mappedSize = mappedSizes[index];
        const hasMappedSize = isFinite(mappedSize);
        let size = hasMappedSize ? getCatalogPointSize(frame, mappedSize, store.isImagePixelSize, pixelRatio) : defaultSize;
        if (store.isSizeAreaMode) {
            const area = hasMappedSize ? mappedSize * areaScale : shapeSize * (store.isImagePixelSize ? areaScale : pixelRatio);
            size = getCatalogSizeFromArea(area, store.catalogShape);
        }
        const mappedMinorSize = mappedMinorSizes[index];
        let minorSize: number | undefined;
        if (isFinite(mappedMinorSize)) {
            minorSize = getCatalogPointSize(frame, mappedMinorSize, store.isImagePixelSize, pixelRatio);
            if (store.isSizeMinorAreaMode) {
                // The shader's minor-area branch uses the resolved major dimension and scaled minor value.
                minorSize = getCatalogSizeFromArea(size, store.catalogShape, mappedMinorSize * areaScale);
            }
        }
        const mappedColor = mappedColors[index];
        return {
            size,
            minorSize,
            color: isFinite(mappedColor) ? sampleSvgColormapColor(store.colorMap, mappedColor, 0, 1, store.catalogColor) : store.catalogColor,
            rotation: isFinite(mappedOrientations[index]) ? mappedOrientations[index] : 0,
            lineWidth,
            highlightColor: isSelected ? store.highlightColor : undefined
        };
    };
}

function buildCatalogSvg(frame: FrameStore, padding: Padding, pixelRatio: number): SVGGElement | null {
    const catalogFileIds = AppStore.Instance.catalogStore.visibleCatalogFiles.get(frame);
    const frameView = getDestinationFrameView(frame);
    if (!catalogFileIds?.length || !frameView) {
        return null;
    }

    const positionArrays = new Map<number, Float32Array>();
    const shapes = new Map<number, string | number>();
    const sizes = new Map<number, number>();
    const colors = new Map<number, string>();
    const styles = new Map<number, CatalogPointStyle[]>();

    catalogFileIds.forEach(fileId => {
        const catalog = AppStore.Instance.catalogStore.catalogGLData.get(fileId);
        const catalogWidgetStore = AppStore.Instance.catalogStore.getCatalogDisplayStore(fileId);
        const count = AppStore.Instance.catalogStore.catalogCounts.get(fileId) ?? 0;
        const sourceFrame = AppStore.Instance.getFrame(AppStore.Instance.catalogStore.getFrameIdByCatalogId(fileId));
        if (!catalog || !catalogWidgetStore || !count || !sourceFrame) {
            return;
        }

        const profile = AppStore.Instance.catalogStore.catalogProfileStores?.get(fileId);
        const selectedIndices = new Set(profile?.getSortedIndices(profile.selectedPointIndices) ?? []);
        if (catalogWidgetStore.isShowingSelectedData && !selectedIndices.size) return;
        const resolveStyle = createCatalogStyleResolver(catalogWidgetStore, frame, pixelRatio);
        const layerWidth = frame.renderWidth * pixelRatio;
        const layerHeight = frame.renderHeight * pixelRatio;
        const featherWidth = (catalogWidgetStore.shapeSettings?.featherWidth ?? 0) * pixelRatio;
        const points: number[] = [];
        const pointStyles: CatalogPointStyle[] = [];
        for (let index = 0; index < count; index++) {
            const isSelected = selectedIndices.has(index);
            if (catalogWidgetStore.isShowingSelectedData && !isSelected) continue;
            const transformedPoint = transformFramePoint({x: catalog.x[index], y: catalog.y[index]}, sourceFrame, frame, true);
            if (!transformedPoint) {
                continue;
            }

            const canvasPoint = imageToCanvasPoint(transformedPoint, frameView, layerWidth, layerHeight);
            const style = resolveStyle(index, isSelected);
            if (!isCatalogPointVisible(canvasPoint, style, layerWidth, layerHeight, featherWidth)) continue;
            points.push(canvasPoint.x, canvasPoint.y);
            pointStyles.push(style);
        }

        if (!points.length) {
            return;
        }

        positionArrays.set(fileId, Float32Array.from(points));
        shapes.set(fileId, catalogWidgetStore.catalogShape);
        sizes.set(fileId, pointStyles[0].size ?? 0);
        colors.set(fileId, catalogWidgetStore.catalogColor);
        styles.set(fileId, pointStyles);
    });

    if (!positionArrays.size) {
        return null;
    }

    return renderCatalogToSvg(positionArrays, shapes, sizes, colors, padding.left * pixelRatio, padding.top * pixelRatio, styles);
}

function buildChannelMapAstSvg(frame: FrameStore, image: ImageViewItem, overlaySettings: any, pixelRatio: number): SVGGElement | null {
    const source = renderAstOverlayToSvg(frame.channelMapInnerOverlayStore, image, overlaySettings, pixelRatio);
    if (!source) {
        return null;
    }

    const channelMapStore = AppStore.Instance.channelMapStore;
    const overlayStore = frame.channelMapInnerOverlayStore;
    const outerPadding = frame.channelMapOuterOverlayStore.padding;
    const innerPadding = overlayStore.padding;
    const channelMapLayout = {
        numColumns: channelMapStore.numColumns,
        outerPadding,
        tileWidth: overlayStore.renderWidth,
        tileHeight: overlayStore.renderHeight,
        gapX: overlayStore.gapX,
        gapY: overlayStore.gapY
    };
    const lastCell = getChannelMapCell(channelMapStore.channelArray.length - 1, channelMapLayout);
    const {row: lastRow, column: columnOfLastFrame} = lastCell;
    const group = svgGroupFromLayer("channel-map-coordinate-overlays");
    const sourceId = `channel-map-coordinate-source-${frame.frameInfo.fileId}`;
    source.setAttribute("id", sourceId);
    const defs = createSvgElement("defs", {});
    defs.appendChild(source);
    group.appendChild(defs);

    channelMapStore.channelArray.forEach((channel, index) => {
        if (channel >= frame.frameInfo.fileInfoExtended.depth) {
            return;
        }

        const {column, row, left, top} = getChannelMapCell(index, channelMapLayout);
        const isBottom = row === channelMapStore.numRows - 1 || row === lastRow || (row === lastRow - 1 && column > columnOfLastFrame);
        const cropLeft = column === 0 ? 0 : innerPadding.left * pixelRatio;
        const cropBottom = isBottom ? 0 : innerPadding.bottom * pixelRatio;
        const x = (left - innerPadding.left) * pixelRatio + cropLeft;
        const y = (top - innerPadding.top) * pixelRatio;
        const width = overlayStore.viewWidth * pixelRatio - cropLeft;
        const height = overlayStore.viewHeight * pixelRatio - cropBottom;
        const viewport = createSvgElement("svg", {x, y, width, height, viewBox: `${cropLeft} 0 ${width} ${height}`, overflow: "hidden"});
        viewport.appendChild(createSvgElement("use", {href: `#${sourceId}`}));
        group.appendChild(viewport);
    });

    return group.querySelector("use") ? group : null;
}

export function getPanelSvg(column: number, row: number, viewHeight: number, padding: Padding, image: ImageViewItem): SVGGElement | null {
    const panelElement = findElementInAllDocuments(`image-panel-${column}-${row}`);
    if (!panelElement) {
        return null;
    }

    const appStore = AppStore.Instance;
    const pixelRatio = appStore.pixelRatio;
    const isColorBlending = image?.type === ImageType.COLOR_BLENDING;
    const frame = image?.type === ImageType.COLOR_BLENDING ? image.store?.baseFrame : image?.store;
    if (!frame) {
        return null;
    }

    const panelGroup = svgGroupFromLayer(`panel-${column}-${row}`);

    // 1. Raster — embed as PNG <image>
    const rasterCanvas = panelElement.querySelector(".raster-canvas") as HTMLCanvasElement;
    if (rasterCanvas) {
        const rasterImage = embedRasterAsSvgImage(rasterCanvas, padding.left * pixelRatio, padding.top * pixelRatio, rasterCanvas.width, rasterCanvas.height);
        panelGroup.appendChild(rasterImage);
    }

    // 2. AST overlay — keep the coordinate grid beneath contours and vectors.
    const isChannelMap = appStore.channelMapStore.isChannelMapEnabled;
    const channelMapAstSvg = isChannelMap ? buildChannelMapAstSvg(frame, image, appStore.overlaySettings, pixelRatio) : null;
    if (channelMapAstSvg) {
        panelGroup.appendChild(channelMapAstSvg);
    }
    const astSvg = renderAstOverlayToSvg(isChannelMap ? frame.channelMapOuterOverlayStore : frame.overlayStore, image, appStore.overlaySettings, pixelRatio);
    if (astSvg) {
        const clipId = `ast-clip-${column}-${row}`;
        const clipPath = createSvgElement("clipPath", {id: clipId});
        clipPath.appendChild(
            createSvgElement("rect", {
                x: 0,
                y: 0,
                width: frame.overlayStore.viewWidth * pixelRatio,
                height: viewHeight
            })
        );
        const defs = createSvgElement("defs", {});
        defs.appendChild(clipPath);
        panelGroup.appendChild(defs);
        astSvg.setAttribute("clip-path", `url(#${clipId})`);
        panelGroup.appendChild(astSvg);
    }

    // 3. Beam — vector SVG from store data
    const beamGroup = buildBeamsSvg(frame, padding, pixelRatio);
    if (beamGroup) {
        panelGroup.appendChild(beamGroup);
    }

    // 4. Contour — vector SVG from store data
    const contoursSvg = buildContoursSvg(frame, padding, pixelRatio);
    if (contoursSvg) {
        if (rasterCanvas) {
            const clipId = `contour-clip-${column}-${row}`;
            const clipPath = createSvgElement("clipPath", {id: clipId});
            clipPath.appendChild(createSvgElement("rect", {x: padding.left * pixelRatio, y: padding.top * pixelRatio, width: rasterCanvas.width, height: rasterCanvas.height}));
            const defs = createSvgElement("defs", {});
            defs.appendChild(clipPath);
            panelGroup.appendChild(defs);
            contoursSvg.setAttribute("clip-path", `url(#${clipId})`);
        }
        panelGroup.appendChild(contoursSvg);
    }

    // 5. Vector overlay — vector SVG from store data
    const vectorOverlaySvg = buildVectorOverlaySvg(frame, padding, pixelRatio);
    if (vectorOverlaySvg) {
        if (rasterCanvas) {
            const clipId = `vector-clip-${column}-${row}`;
            const clipPath = createSvgElement("clipPath", {id: clipId});
            clipPath.appendChild(createSvgElement("rect", {x: padding.left * pixelRatio, y: padding.top * pixelRatio, width: rasterCanvas.width, height: rasterCanvas.height}));
            const defs = createSvgElement("defs", {});
            defs.appendChild(clipPath);
            panelGroup.appendChild(defs);
            vectorOverlaySvg.setAttribute("clip-path", `url(#${clipId})`);
        }
        panelGroup.appendChild(vectorOverlaySvg);
    }

    // 6. Colorbar — vector SVG from store data
    const colorbarSettings = appStore.overlaySettings.colorbar;
    if (!isColorBlending && colorbarSettings.isVisible && frame.renderConfig?.colorscaleArray?.length) {
        const colorbarSvg = buildColorbarSvg(frame, colorbarSettings, viewHeight, padding, pixelRatio, rasterCanvas?.width, rasterCanvas?.height);
        if (colorbarSvg) {
            panelGroup.appendChild(colorbarSvg);
        }
    }

    // 7. Catalog — vector SVG from store data
    const catalogSvg = buildCatalogSvg(frame, padding, pixelRatio);
    if (catalogSvg) {
        const clipId = `catalog-clip-${column}-${row}`;
        const clipPath = createSvgElement("clipPath", {id: clipId});
        clipPath.appendChild(
            createSvgElement("rect", {
                x: 0,
                y: 0,
                width: rasterCanvas?.width ?? frame.renderWidth * pixelRatio,
                height: rasterCanvas?.height ?? frame.renderHeight * pixelRatio
            })
        );
        const defs = createSvgElement("defs", {});
        defs.appendChild(clipPath);
        panelGroup.appendChild(defs);
        catalogSvg.setAttribute("clip-path", `url(#${clipId})`);
        panelGroup.appendChild(catalogSvg);
    }

    // 8. Channel map labels — SVG text
    const channelMapLabelArray = panelElement.querySelectorAll(".channel-map-label-span") as NodeListOf<HTMLSpanElement>;
    if (channelMapLabelArray?.length) {
        const labelGroup = buildChannelMapLabelsSvg(channelMapLabelArray, pixelRatio);
        panelGroup.appendChild(labelGroup);
    }

    // 9. Regions — vector SVG from store data
    const regionsSvg = buildRegionsSvg(frame, padding, pixelRatio);
    if (regionsSvg) {
        const clipId = `regions-clip-${column}-${row}`;
        const clipPath = createSvgElement("clipPath", {id: clipId});
        clipPath.appendChild(
            createSvgElement("rect", {
                x: 0,
                y: 0,
                width: rasterCanvas?.width ?? frame.renderWidth * pixelRatio,
                height: rasterCanvas?.height ?? frame.renderHeight * pixelRatio
            })
        );
        const defs = createSvgElement("defs", {});
        defs.appendChild(clipPath);
        panelGroup.appendChild(defs);
        regionsSvg.setAttribute("clip-path", `url(#${clipId})`);
        panelGroup.appendChild(regionsSvg);
    }

    return panelGroup;
}

function buildColorbarSvg(frame: FrameStore, colorbarSettings: OverlayColorbarSettings, viewHeight: number, padding: Padding, pixelRatio: number, rasterWidth?: number, rasterHeight?: number): SVGGElement | null {
    const colorbarStore = frame.colorbarStore;
    if (!colorbarStore) {
        return null;
    }

    const appStore = AppStore.Instance;
    const colorscaleArray = frame.renderConfig.colorscaleArray;
    const positions = colorbarStore.positions ?? [];
    const texts = colorbarStore.texts ?? [];
    const isVertical = colorbarSettings.position === "right";

    let barWidth = colorbarSettings.width * pixelRatio;
    const offset = colorbarSettings.offset * pixelRatio;

    let barX: number, barY: number, barHeight: number;
    const imageWidth = rasterWidth ?? frame.renderWidth * pixelRatio;
    const imageHeight = rasterHeight ?? frame.renderHeight * pixelRatio;

    if (isVertical) {
        barX = padding.left * pixelRatio + imageWidth + offset;
        barY = padding.top * pixelRatio;
        barHeight = imageHeight;
    } else {
        barX = padding.left * pixelRatio;
        barHeight = barWidth;
        if (colorbarSettings.position === "top") {
            barY = padding.top * pixelRatio - barHeight - offset;
        } else {
            barY = viewHeight - barHeight - offset - appStore.overlaySettings.colorbarHoverInfoHeight * pixelRatio;
        }
        barWidth = imageWidth;
    }

    const baseColor = colorbarSettings.hasCustomColor ? colorbarSettings.color : appStore.overlaySettings.global.color;
    const resolveColor = (hasCustomColor: boolean, color: string) => getColorForTheme(hasCustomColor ? color : baseColor);
    const numberFont = AstFonts[colorbarSettings.numberFont] ?? AstFonts[0];
    const labelFont = AstFonts[colorbarSettings.labelFont] ?? AstFonts[0];

    // Scale tick positions to SVG coordinates
    const scaledPositions = positions.map((p: number) => p * pixelRatio);

    const frameUnit = frame.requiredUnit === undefined || !frame.requiredUnit.length ? "arbitrary units" : frame.requiredUnit;
    const labelText = colorbarSettings.isLabelVisible ? (colorbarSettings.hasLabelCustomText ? (frame.colorbarLabelCustomText ?? "") : frameUnit) : "";

    return renderColorbarToSvg({
        colorscaleArray,
        position: colorbarSettings.position,
        bar: {
            x: barX,
            y: barY,
            width: isVertical ? barWidth : imageWidth,
            height: isVertical ? barHeight : colorbarSettings.width * pixelRatio,
            gradientVisible: colorbarSettings.isGradientVisible
        },
        ticks: {
            positions: scaledPositions,
            texts,
            visible: colorbarSettings.isTickVisible,
            color: resolveColor(colorbarSettings.hasTickCustomColor, colorbarSettings.tickColor),
            width: colorbarSettings.tickWidth * pixelRatio,
            length: colorbarSettings.tickLen * pixelRatio
        },
        numbers: {
            visible: colorbarSettings.isNumberVisible,
            fontFamily: numberFont.family,
            fontSize: colorbarSettings.numberFontSize * pixelRatio,
            fontStyle: numberFont.style,
            fontWeight: numberFont.weight,
            color: resolveColor(colorbarSettings.hasNumberCustomColor, colorbarSettings.numberColor),
            rotation: colorbarSettings.numberRotation,
            gap: colorbarSettings.textGap * pixelRatio,
            width: colorbarSettings.numberWidth * pixelRatio
        },
        label: {
            text: labelText,
            fontFamily: labelFont.family,
            fontSize: colorbarSettings.labelFontSize * pixelRatio,
            fontStyle: labelFont.style,
            fontWeight: labelFont.weight,
            color: resolveColor(colorbarSettings.hasLabelCustomColor, colorbarSettings.labelColor),
            rotation: colorbarSettings.labelRotation
        },
        border: {
            visible: colorbarSettings.isBorderVisible,
            color: resolveColor(colorbarSettings.hasBorderCustomColor, colorbarSettings.borderColor),
            width: colorbarSettings.borderWidth * pixelRatio
        }
    });
}

function getBeamPlotProps(frame: FrameStore, basePosition?: Point2D): BeamPlotProps | null {
    if (!frame.hasVisibleBeam || !frame.beamProperties || !frame.overlayBeamSettings?.isVisible) {
        return null;
    }

    const appStore = AppStore.Instance;
    const beamSettings = frame.overlayBeamSettings;
    const zoomLevel = (frame.spatialReference ? frame.spatialReference.zoomLevel * (frame.spatialTransform?.scale ?? 1) : frame.zoomLevel) / appStore.imageRatio;
    const color = getColorForTheme(beamSettings.color);
    const axisColor = beamSettings.type === BeamType.Solid ? Colors.WHITE : color;
    const strokeWidth = beamSettings.width;

    const semiMajor = ((frame.beamProperties.x / 2.0) * zoomLevel) / devicePixelRatio;
    const semiMinor = ((frame.beamProperties.y / 2.0) * zoomLevel) / devicePixelRatio;
    let theta = ((90.0 - frame.beamProperties.angle) * Math.PI) / 180.0;
    if (frame.spatialTransform) {
        theta -= frame.spatialTransform.rotation;
    }

    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    const boundingBox = {
        x: 2 * Math.sqrt(semiMajor * semiMajor * cosTheta * cosTheta + semiMinor * semiMinor * sinTheta * sinTheta),
        y: 2 * Math.sqrt(semiMajor * semiMajor * sinTheta * sinTheta + semiMinor * semiMinor * cosTheta * cosTheta)
    };

    // Match the original BeamProfileOverlayComponent: padding prop is 10, scaled by devicePixelRatio
    const beamPadding = 10;
    const paddingOffset = beamPadding * devicePixelRatio;
    const position = basePosition ?? {
        x: Math.min(frame.renderWidth - boundingBox.x / 2.0, boundingBox.x / 2.0 + paddingOffset + beamSettings.shiftX),
        y: Math.max(boundingBox.y / 2.0, frame.renderHeight - boundingBox.y / 2.0 - paddingOffset - beamSettings.shiftY)
    };

    const isFilled = beamSettings.type === BeamType.Solid;

    return {
        position,
        semiMajor,
        semiMinor,
        rotationDegrees: (theta * 180.0) / Math.PI,
        color,
        axisColor,
        strokeWidth,
        isFilled
    };
}

function buildBeamsSvg(frame: FrameStore, padding: Padding, pixelRatio: number): SVGGElement | null {
    const appStore = AppStore.Instance;
    const contourFrames = appStore.contourFrames.get(frame)?.filter(f => f !== frame && f.hasVisibleBeam);

    if (!frame.hasVisibleBeam && !contourFrames?.length) {
        return null;
    }

    const group = svgGroupFromLayer("beams");
    // Channel-map beam overlays are rendered in the bottom-left channel tile.
    // The regular image view has one image area, so its beam only needs the
    // image padding offset.
    let beamPadding = padding;
    let beamOffsetY = 0;
    if (appStore.channelMapStore.isChannelMapEnabled) {
        const outerOverlay = frame.channelMapOuterOverlayStore;
        const innerOverlay = frame.channelMapInnerOverlayStore;
        const channelMapStore = appStore.channelMapStore;
        const channelMapLayout = {
            numColumns: channelMapStore.numColumns,
            outerPadding: outerOverlay.padding,
            tileWidth: innerOverlay.renderWidth,
            tileHeight: innerOverlay.renderHeight,
            gapX: innerOverlay.gapX,
            gapY: innerOverlay.gapY
        };
        const lastCell = getChannelMapCell(channelMapStore.channelArray.length - 1, channelMapLayout);

        beamPadding = outerOverlay.padding;
        beamOffsetY = lastCell.top - beamPadding.top;
    }
    group.setAttribute("transform", `translate(${beamPadding.left * pixelRatio},${(beamPadding.top + beamOffsetY) * pixelRatio})`);

    // Base frame beam
    const basePlot = frame.hasVisibleBeam ? getBeamPlotProps(frame) : null;
    if (basePlot) {
        group.appendChild(renderBeamToSvg(basePlot, pixelRatio));
    }

    // Contour frame beams (positioned at the same location as the base beam)
    contourFrames?.forEach(contourFrame => {
        const plotProps = getBeamPlotProps(contourFrame, basePlot?.position);
        if (plotProps) {
            group.appendChild(renderBeamToSvg(plotProps, pixelRatio));
        }
    });

    return group;
}

function buildChannelMapLabelsSvg(channelMapLabelArray: NodeListOf<HTMLSpanElement>, pixelRatio: number): SVGGElement {
    const group = svgGroupFromLayer("channel-map-labels");

    for (const channelMapLabel of channelMapLabelArray) {
        const style = getComputedStyle(channelMapLabel);
        const offsetLeft = (channelMapLabel.offsetLeft + parseFloat(style.paddingLeft)) * pixelRatio;
        const offsetTop = (channelMapLabel.offsetTop + parseFloat(style.paddingTop)) * pixelRatio;

        const fontSize = parseFloat(style.fontSize) * pixelRatio;
        const fontFamily = style.fontFamily;
        const fontWeight = style.fontWeight;
        const fontStyle = style.fontStyle;
        const color = style.color;

        const divElementArray = channelMapLabel.querySelectorAll("div");
        let line = 1;
        const lineHeight = parseFloat(style.lineHeight) * pixelRatio;

        for (const divElement of divElementArray) {
            if (divElement.textContent) {
                const textEl = createSvgText(divElement.textContent, offsetLeft, offsetTop + lineHeight * line, {
                    fill: color,
                    "font-family": fontFamily,
                    "font-weight": fontWeight,
                    "font-style": fontStyle,
                    "font-size": fontSize,
                    "dominant-baseline": "auto"
                });
                group.appendChild(textEl);
                line++;
            }
        }
    }

    return group;
}

function buildRegionsSvg(frame: FrameStore, padding: Padding, pixelRatio: number): SVGGElement | null {
    const regions = frame.regionSet?.regionsAndAnnotationsForRender;
    if (!regions?.length) {
        return null;
    }

    const frameView = frame.spatialReference ? frame.spatialReference.requiredFrameView : frame.requiredFrameView;
    if (!frameView) {
        return null;
    }

    return renderRegionsToSvg(regions, frameView, frame.renderWidth * pixelRatio, frame.renderHeight * pixelRatio, padding.left * pixelRatio, padding.top * pixelRatio, {frame, pixelRatio});
}
