import {Colors} from "@blueprintjs/core";

import {AstFonts} from "components/Shared";
import {BeamType, CatalogOverlayShape, ContourDashMode, ImageType, VectorOverlaySource} from "enums";
import {type FrameView, type ImageViewItem, type Point2D} from "models";
import {AppStore, type CatalogDisplayStore, type OverlayColorbarSettings, type OverlaySettings, type Padding} from "stores";
import {type FrameStore} from "stores/Frame";
import {ceilToPower, clamp, getChannelMapCell, getColorForTheme} from "utilities";
import {getColorbarStagePosition} from "utilities/colorbarLayout";
import {getBeamGeometry} from "utilities/region/beam";

import {renderAstOverlayToSvg} from "./astSvgExport";
import {type BeamPlotProps, renderBeamToSvg} from "./beamSvgExport";
import {type CatalogPointStyle, getCatalogShapeSize, getCatalogSizeFromArea, getCatalogSizeTuning, isCatalogPointVisible, renderCatalogToSvg} from "./catalogSvgExport";
import {renderColorbarToSvg} from "./colorbarSvgExport";
import {renderContoursToSvg} from "./contourSvgExport";
import {findElementInAllDocuments} from "./imageExportDom";
import {renderRegionsToSvg} from "./regionSvgExport";
import {sampleSvgColormapColor} from "./svgColor";
import {buildSvgDocument, createSvgElement, createSvgText, embedRasterAsSvgImage, namespaceSvgIds, svgGroupFromLayer} from "./svgExport";
import {renderVectorOverlayToSvg} from "./vectorOverlaySvgExport";

export function getImageViewSvg(backgroundColor: string = "rgba(255, 255, 255, 0)"): SVGSVGElement | null {
    const appStore = AppStore.Instance;
    const config = appStore.imageViewConfigStore;
    const catalogMappedArrays = new WeakMap<CatalogDisplayStore, CatalogMappedArrays>();

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
        const panelSvg = getPanelSvg(column, row, viewHeight, image, catalogMappedArrays);
        if (panelSvg) {
            const offsetX = frame.overlayStore.viewWidth * column * appStore.pixelRatio;
            const offsetY = frame.overlayStore.viewHeight * row * appStore.pixelRatio;
            if (offsetX !== 0 || offsetY !== 0) {
                panelSvg.setAttribute("transform", `translate(${offsetX},${offsetY})`);
            }
            namespaceSvgIds(panelSvg, `panel-${column}-${row}`);
            svgDoc.appendChild(panelSvg);
        }
    });

    return svgDoc;
}

const DEFAULT_CONTOUR_DASH_LENGTH = 8;

function getDestinationFrameView(frame: FrameStore): FrameView | null {
    return frame.spatialReference ? frame.spatialReference.requiredFrameView : frame.requiredFrameView;
}

function createImageToCanvasMapper(frameView: FrameView, layerWidth: number, layerHeight: number): (imagePoint: Point2D) => Point2D {
    const scaleX = layerWidth / (frameView.xMax - frameView.xMin);
    const scaleY = layerHeight / (frameView.yMax - frameView.yMin);
    const canvasPoint = {x: 0, y: 0};
    // The returned point is borrowed and reused; callers must consume or copy its coordinates immediately.
    return imagePoint => {
        canvasPoint.x = (imagePoint.x - frameView.xMin) * scaleX;
        canvasPoint.y = layerHeight - (imagePoint.y - frameView.yMin) * scaleY;
        return canvasPoint;
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

function createVectorStyleResolver(sourceFrame: FrameStore, destinationFrame: FrameStore, pixelRatio: number) {
    const config = sourceFrame.vectorOverlayConfig;
    const {angularSource, intensitySource, isColormapEnabled, colormap, colormapBias, colormapContrast, isColormapInverted} = config;
    const intensityMin = intensitySource === VectorOverlaySource.None ? 0 : isFinite(config.intensityMin ?? NaN) ? config.intensityMin : sourceFrame.vectorOverlayStore.intensityMin;
    const intensityMax = intensitySource === VectorOverlaySource.None ? 1 : isFinite(config.intensityMax ?? NaN) ? config.intensityMax : sourceFrame.vectorOverlayStore.intensityMax;
    const hasIntensityRange = isFinite(intensityMin ?? NaN) && isFinite(intensityMax ?? NaN) && intensityMin !== intensityMax;
    const minIntensity = intensityMin ?? 0;
    const intensityRange = (intensityMax ?? minIntensity) - minIntensity;
    const lengthMin = config.lengthMin * pixelRatio;
    const lengthMax = config.lengthMax * pixelRatio;
    const rotationOffset = isFinite(config.rotationOffset) ? config.rotationOffset : 0;
    const zoomFrame = destinationFrame.spatialReference ?? destinationFrame;
    const zoom = zoomFrame.effectiveZoomLevel ?? {x: zoomFrame.zoomLevel, y: zoomFrame.zoomLevel};
    const scaleX = zoom.x * (sourceFrame.aspectRatio ?? 1);
    const scaleY = zoom.y;
    const fallbackColor = rgbColorToCss(config.color);

    return {
        getLength: (intensity: number): number => {
            if (intensitySource === VectorOverlaySource.None || !hasIntensityRange) return lengthMax;
            const scaledIntensity = clamp((intensity - minIntensity) / intensityRange, 0, 1);
            return lengthMin + (lengthMax - lengthMin) * scaledIntensity;
        },
        getAngle: (angleDegrees: number): number => {
            const angle = angularSource === VectorOverlaySource.None ? 0 : ((-angleDegrees - rotationOffset) * Math.PI) / 180;
            // The shader maps the center, then normalizes this screen-space direction.
            return Math.atan2(Math.cos(angle) * scaleY, -Math.sin(angle) * scaleX);
        },
        getColor: (intensity: number): string => {
            if (!isColormapEnabled) return fallbackColor;
            const fraction = hasIntensityRange ? (intensity - minIntensity) / intensityRange : 1;
            return sampleSvgColormapColor(colormap, fraction, colormapBias, colormapContrast, fallbackColor, isColormapInverted);
        }
    };
}

function createOverlayPointTransform(sourceFrame: FrameStore, destinationFrame: FrameStore, isCatalog = false): (point: Point2D) => Point2D | null {
    const catalogMap = isCatalog && sourceFrame !== destinationFrame ? sourceFrame.getCatalogControlMap(destinationFrame) : null;
    catalogMap?.updateCatalogBoundary();
    const controlMap = sourceFrame !== destinationFrame ? (catalogMap ?? sourceFrame.getControlMap(destinationFrame)) : null;
    return point => {
        const mapped = controlMap ? controlMap.transformPoint(point) : point;
        return mapped && destinationFrame.spatialReference ? (destinationFrame.spatialTransform?.transformCoordinate(mapped, true) ?? null) : mapped;
    };
}

function buildContoursSvg(frame: FrameStore, padding: Padding, pixelRatio: number): SVGGElement | null {
    const contourFrames = AppStore.Instance.contourFrames.get(frame);
    const frameView = getDestinationFrameView(frame);
    if (!contourFrames?.length || !frameView) {
        return null;
    }

    const layerWidth = frame.renderWidth * pixelRatio;
    const layerHeight = frame.renderHeight * pixelRatio;
    const toCanvasPoint = createImageToCanvasMapper(frameView, layerWidth, layerHeight);
    const group = svgGroupFromLayer("contours");

    for (let frameIndex = contourFrames.length - 1; frameIndex >= 0; --frameIndex) {
        const contourFrame = contourFrames[frameIndex];
        if (!contourFrame.contourConfig.isVisible || !contourFrame.contourStores.size) {
            continue;
        }
        const transformPoint = createOverlayPointTransform(contourFrame, frame);

        let minLevel = Infinity;
        let maxLevel = -Infinity;
        contourFrame.contourStores.forEach((_, level) => {
            minLevel = Math.min(minLevel, level);
            maxLevel = Math.max(maxLevel, level);
        });
        contourFrame.contourStores.forEach((contourStore, level) => {
            const pointScratch = {x: 0, y: 0};
            const contourSvg = renderContoursToSvg(
                contourStore.exportChunks,
                getContourStrokeColor(contourFrame, level, minLevel, maxLevel),
                getContourStrokeWidth(contourFrame, pixelRatio),
                getContourDashLength(frame, contourFrame.contourConfig.dashMode, level, pixelRatio),
                padding.left * pixelRatio,
                padding.top * pixelRatio,
                point => {
                    // Match vertex_shader_contours: server contour coordinates are pixel-edge based.
                    pointScratch.x = point.x - 0.5;
                    pointScratch.y = point.y - 0.5;
                    const transformed = transformPoint(pointScratch);
                    return transformed ? toCanvasPoint(transformed) : null;
                }
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
    const toCanvasPoint = createImageToCanvasMapper(frameView, layerWidth, layerHeight);
    const group = svgGroupFromLayer("vector-overlays");

    for (let frameIndex = vectorOverlayFrames.length - 1; frameIndex >= 0; --frameIndex) {
        const vectorFrame = vectorOverlayFrames[frameIndex];
        if (!vectorFrame.vectorOverlayConfig.isVisible || !vectorFrame.vectorOverlayStore.tiles?.length) {
            continue;
        }

        const exportPositions: number[] = [];
        const strokeColors: string[] = [];
        const transformPoint = createOverlayPointTransform(vectorFrame, frame);
        const style = createVectorStyleResolver(vectorFrame, frame, pixelRatio);
        const lineWidth = pixelRatio * vectorFrame.vectorOverlayConfig.thickness;
        const featherWidth = pixelRatio / (frame.spatialTransform?.scale ?? 1);
        const isIntensityPlot = vectorFrame.vectorOverlayConfig.angularSource === VectorOverlaySource.None;
        const centerScratch = {x: 0, y: 0};
        vectorFrame.vectorOverlayStore.tiles.forEach(tile => {
            for (let vectorIndex = 0; vectorIndex < tile.numVertices; vectorIndex++) {
                const offset = vectorIndex * 4;
                centerScratch.x = tile.vertexData[offset];
                centerScratch.y = tile.vertexData[offset + 1];
                const intensity = tile.vertexData[offset + 2];
                const rawAngleDegrees = tile.vertexData[offset + 3];
                const lineLength = style.getLength(intensity);
                if (!isFinite(lineLength) || lineLength <= 0) {
                    continue;
                }

                const transformedCenter = transformPoint(centerScratch);
                if (!transformedCenter) {
                    continue;
                }
                const canvasCenter = toCanvasPoint(transformedCenter);
                const angle = style.getAngle(rawAngleDegrees);
                if (!isFinite(canvasCenter.x) || !isFinite(canvasCenter.y) || !isFinite(angle)) continue;
                // Retain edge-crossing geometry, including stroke/feather width.
                // Allow for rounding when SVG coordinates are serialized.
                const halfWidth = (isIntensityPlot ? (lineLength + featherWidth) / 2 : (Math.abs(Math.cos(angle)) * lineLength) / 2 + (lineWidth + featherWidth) / 2) + 0.01;
                const halfHeight = (isIntensityPlot ? (lineLength + featherWidth) / 2 : (Math.abs(Math.sin(angle)) * lineLength) / 2 + (lineWidth + featherWidth) / 2) + 0.01;
                if (canvasCenter.x + halfWidth < 0 || canvasCenter.x - halfWidth > layerWidth || canvasCenter.y + halfHeight < 0 || canvasCenter.y - halfHeight > layerHeight) continue;
                exportPositions.push(canvasCenter.x, canvasCenter.y, lineLength, angle);
                strokeColors.push(style.getColor(intensity));
            }
        });

        if (exportPositions.length) {
            const vectorSvg = renderVectorOverlayToSvg(exportPositions, exportPositions.length / 4, 1, lineWidth, strokeColors, padding.left * pixelRatio, padding.top * pixelRatio, isIntensityPlot, featherWidth);
            group.appendChild(vectorSvg);
        }
    }

    return group.childNodes.length ? group : null;
}

interface CatalogMappedArrays {
    sizes: Float32Array;
    minorSizes: Float32Array;
    colors: Float32Array;
    orientations: Float32Array;
}

function getCatalogMappedArrays(store: CatalogDisplayStore, cache: WeakMap<CatalogDisplayStore, CatalogMappedArrays>): CatalogMappedArrays {
    const cached = cache.get(store);
    if (cached) return cached;
    const mapped = {
        sizes: store.sizeArray?.() ?? new Float32Array(),
        minorSizes: store.catalogShape === CatalogOverlayShape.ELLIPSE_LINED ? (store.sizeMinorArray?.() ?? new Float32Array()) : new Float32Array(),
        colors: store.colorArray?.() ?? new Float32Array(),
        orientations: store.orientationArray?.() ?? new Float32Array()
    };
    cache.set(store, mapped);
    return mapped;
}

function createCatalogStyleResolver(store: CatalogDisplayStore, frame: FrameStore, pixelRatio: number, cache: WeakMap<CatalogDisplayStore, CatalogMappedArrays>): (index: number, isSelected: boolean) => CatalogPointStyle {
    const {sizes: mappedSizes, minorSizes: mappedMinorSizes, colors: mappedColors, orientations: mappedOrientations} = getCatalogMappedArrays(store, cache);
    const shapeSize = store.isImagePixelSize ? store.catalogSize : store.catalogSize + (store.shapeSettings?.diameterBase ?? 0);
    const zoomFrame = frame.spatialReference ?? frame;
    const zoomY = zoomFrame.effectiveZoomLevel?.y ?? zoomFrame.zoomLevel;
    const sizeTuning = store.isImagePixelSize ? getCatalogSizeTuning(store.catalogShape) : 1;
    const areaScale = store.isImagePixelSize ? sizeTuning * zoomY : 1;
    const frameView = getDestinationFrameView(frame);
    // The catalog shader sizes glyphs with Y zoom and cancels X zoom/pixel aspect ratio.
    const imagePixelScale = frameView ? (frame.renderHeight * pixelRatio) / (frameView.yMax - frameView.yMin) : 1;
    const imagePixelSizeScale = imagePixelScale * sizeTuning;
    const defaultSize = shapeSize * (store.isImagePixelSize ? imagePixelSizeScale : pixelRatio);
    const lineWidth = (isFinite(store.thickness) ? store.thickness : 1) * (store.shapeSettings?.thicknessBase ?? 1) * pixelRatio;

    return (index, isSelected) => {
        const mappedSize = mappedSizes[index];
        const hasMappedSize = isFinite(mappedSize);
        // Mapped screen sizes are already device-pixel dimensions in the shader's size texture.
        let size = hasMappedSize ? mappedSize * (store.isImagePixelSize ? imagePixelSizeScale : 1) : defaultSize;
        if (store.isSizeAreaMode) {
            const area = hasMappedSize ? mappedSize * areaScale : shapeSize * (store.isImagePixelSize ? areaScale : pixelRatio);
            size = getCatalogSizeFromArea(area, store.catalogShape);
        }
        size = getCatalogShapeSize(size, store.catalogShape, store.isImagePixelSize, store.isSizeAreaMode);
        const mappedMinorSize = mappedMinorSizes[index];
        let minorSize: number | undefined;
        if (isFinite(mappedMinorSize)) {
            minorSize = mappedMinorSize * (store.isImagePixelSize ? imagePixelSizeScale : 1);
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

function buildCatalogSvg(frame: FrameStore, padding: Padding, pixelRatio: number, mappedArrays: WeakMap<CatalogDisplayStore, CatalogMappedArrays>): SVGGElement | null {
    const catalogFileIds = AppStore.Instance.catalogStore.visibleCatalogFiles.get(frame);
    const frameView = getDestinationFrameView(frame);
    if (!catalogFileIds?.length || !frameView) {
        return null;
    }

    const positionArrays = new Map<number, number[]>();
    const layerWidth = frame.renderWidth * pixelRatio;
    const layerHeight = frame.renderHeight * pixelRatio;
    const toCanvasPoint = createImageToCanvasMapper(frameView, layerWidth, layerHeight);
    const shapes = new Map<number, string | number>();
    const sizes = new Map<number, number>();
    const colors = new Map<number, string>();
    const styles = new Map<number, CatalogPointStyle[]>();

    catalogFileIds.forEach(fileId => {
        const catalog = AppStore.Instance.catalogStore.catalogGLData.get(fileId);
        const catalogWidgetStore = AppStore.Instance.catalogStore.getCatalogDisplayStore(fileId);
        const count = AppStore.Instance.catalogStore.catalogCounts.get(fileId) ?? 0;
        const sourceFrame = AppStore.Instance.getFrame(AppStore.Instance.catalogStore.getFrameIdByCatalogId(fileId));
        if (!catalog || !catalogWidgetStore?.isSourceSizeDefined || !count || !sourceFrame) {
            return;
        }

        const profile = AppStore.Instance.catalogStore.catalogProfileStores?.get(fileId);
        const selectedIndices = profile?.selectedPointIndices.length ? new Set(profile.getSortedIndices(profile.selectedPointIndices)) : undefined;
        if (catalogWidgetStore.isShowingSelectedData && !selectedIndices?.size) return;
        const transformPoint = createOverlayPointTransform(sourceFrame, frame, true);
        const resolveStyle = createCatalogStyleResolver(catalogWidgetStore, frame, pixelRatio, mappedArrays);
        const featherWidth = (catalogWidgetStore.shapeSettings?.featherWidth ?? 0) * pixelRatio;
        const pointScratch = {x: 0, y: 0};
        const points: number[] = [];
        const pointStyles: CatalogPointStyle[] = [];
        for (let index = 0; index < count; index++) {
            const isSelected = selectedIndices?.has(index) ?? false;
            if (catalogWidgetStore.isShowingSelectedData && !isSelected) continue;
            pointScratch.x = catalog.x[index];
            pointScratch.y = catalog.y[index];
            const transformedPoint = transformPoint(pointScratch);
            if (!transformedPoint) {
                continue;
            }

            const canvasPoint = toCanvasPoint(transformedPoint);
            const style = resolveStyle(index, isSelected);
            if (!isCatalogPointVisible(canvasPoint, style, layerWidth, layerHeight, featherWidth)) continue;
            points.push(canvasPoint.x, canvasPoint.y);
            pointStyles.push(style);
        }

        if (!points.length) {
            return;
        }

        positionArrays.set(fileId, points);
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

function getFrameChannelMapLayout(frame: FrameStore) {
    const inner = frame.channelMapInnerOverlayStore;
    return {
        numColumns: AppStore.Instance.channelMapStore.numColumns,
        outerPadding: frame.channelMapOuterOverlayStore.padding,
        tileWidth: inner.renderWidth,
        tileHeight: inner.renderHeight,
        gapX: inner.gapX,
        gapY: inner.gapY
    };
}

function buildChannelMapAstSvg(frame: FrameStore, image: ImageViewItem, overlaySettings: OverlaySettings, pixelRatio: number): SVGGElement | null {
    const source = renderAstOverlayToSvg(frame.channelMapInnerOverlayStore, image, overlaySettings, pixelRatio);
    if (!source) {
        return null;
    }

    const channelMapStore = AppStore.Instance.channelMapStore;
    const overlayStore = frame.channelMapInnerOverlayStore;
    const innerPadding = overlayStore.padding;
    const channelMapLayout = getFrameChannelMapLayout(frame);
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

export function getPanelSvg(column: number, row: number, viewHeight: number, image: ImageViewItem, catalogMappedArrays = new WeakMap<CatalogDisplayStore, CatalogMappedArrays>()): SVGGElement | null {
    const panelElement = findElementInAllDocuments(`image-panel-${column}-${row}`);
    if (!panelElement) {
        return null;
    }

    const appStore = AppStore.Instance;
    const pixelRatio = appStore.pixelRatio;
    const isColorBlending = image?.type === ImageType.COLOR_BLENDING;
    const colorBlendingStore = image?.type === ImageType.COLOR_BLENDING ? image.store : null;
    const frame = image?.type === ImageType.COLOR_BLENDING ? image.store?.baseFrame : image?.store;
    if (!frame) {
        return null;
    }

    const isChannelMap = appStore.channelMapStore.isChannelMapEnabled;
    const padding = (isChannelMap ? frame.channelMapOuterOverlayStore : frame.overlayStore).padding;

    const panelGroup = svgGroupFromLayer(`panel-${column}-${row}`);
    const defs = createSvgElement("defs", {});
    const clipIds = new Map<string, string>();
    const appendClippedLayer = (layer: SVGGElement | null, name: string, bounds?: {x: number; y: number; width: number; height: number}) => {
        if (!layer) return;
        if (bounds) {
            const key = `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`;
            let clipId = clipIds.get(key);
            if (!clipId) {
                clipId = `${name}-clip-${column}-${row}`;
                const clip = createSvgElement("clipPath", {id: clipId});
                clip.appendChild(createSvgElement("rect", bounds));
                defs.appendChild(clip);
                clipIds.set(key, clipId);
            }
            layer.setAttribute("clip-path", `url(#${clipId})`);
        }
        panelGroup.appendChild(layer);
    };

    // 1. Raster — embed as PNG <image>
    const rasterCanvas = colorBlendingStore?.isRasterVisible === false ? null : (panelElement.querySelector(".raster-canvas") as HTMLCanvasElement);
    const rasterBounds = {x: padding.left * pixelRatio, y: padding.top * pixelRatio, width: rasterCanvas?.width ?? frame.renderWidth * pixelRatio, height: rasterCanvas?.height ?? frame.renderHeight * pixelRatio};
    const localBounds = {...rasterBounds, x: 0, y: 0};
    if (rasterCanvas) {
        const rasterImage = embedRasterAsSvgImage(rasterCanvas, padding.left * pixelRatio, padding.top * pixelRatio, rasterCanvas.width, rasterCanvas.height);
        panelGroup.appendChild(rasterImage);
    }

    // 2. AST overlay — keep the coordinate grid beneath contours and vectors.
    const channelMapAstSvg = isChannelMap ? buildChannelMapAstSvg(frame, image, appStore.overlaySettings, pixelRatio) : null;
    if (channelMapAstSvg) {
        panelGroup.appendChild(channelMapAstSvg);
    }
    const astSvg = renderAstOverlayToSvg(isChannelMap ? frame.channelMapOuterOverlayStore : frame.overlayStore, image, appStore.overlaySettings, pixelRatio, isChannelMap);
    appendClippedLayer(astSvg, "ast", {x: 0, y: 0, width: (isChannelMap ? frame.channelMapOuterOverlayStore : frame.overlayStore).viewWidth * pixelRatio, height: viewHeight});

    // 3. Beam — vector SVG from store data
    const beamGroup = isColorBlending ? null : buildBeamsSvg(frame, padding, pixelRatio);
    const beamView = isChannelMap ? frame.channelMapInnerOverlayStore : frame;
    appendClippedLayer(beamGroup, "beam", {x: 0, y: 0, width: beamView.renderWidth * pixelRatio, height: beamView.renderHeight * pixelRatio});

    // 4. Contour — vector SVG from store data
    const contoursSvg = isChannelMap || colorBlendingStore?.isContourVisible === false ? null : buildContoursSvg(frame, padding, pixelRatio);
    appendClippedLayer(contoursSvg, "contour", rasterBounds);

    // 5. Vector overlay — vector SVG from store data
    const vectorOverlaySvg = isChannelMap || colorBlendingStore?.isVectorOverlayVisible === false ? null : buildVectorOverlaySvg(frame, padding, pixelRatio);
    appendClippedLayer(vectorOverlaySvg, "vector", rasterBounds);

    // 6. Colorbar — vector SVG from store data
    const colorbarSettings = appStore.overlaySettings.colorbar;
    if (!isColorBlending && colorbarSettings.isVisible && frame.renderConfig?.colorscaleArray?.length) {
        const colorbarSvg = buildColorbarSvg(frame, colorbarSettings, viewHeight, padding, pixelRatio, rasterCanvas?.width, rasterCanvas?.height);
        if (colorbarSvg) {
            panelGroup.appendChild(colorbarSvg);
        }
    }

    // 7. Catalog — vector SVG from store data
    const catalogSvg = isChannelMap ? null : buildCatalogSvg(frame, padding, pixelRatio, catalogMappedArrays);
    appendClippedLayer(catalogSvg, "catalog", localBounds);

    // 8. Channel map labels — SVG text
    const channelMapLabelArray = panelElement.querySelectorAll(".channel-map-label-span") as NodeListOf<HTMLSpanElement>;
    if (channelMapLabelArray?.length) {
        const labelGroup = buildChannelMapLabelsSvg(channelMapLabelArray, pixelRatio);
        panelGroup.appendChild(labelGroup);
    }

    // 9. Regions — vector SVG from store data
    const regionsSvg = buildRegionsSvg(frame, padding, pixelRatio);
    appendClippedLayer(regionsSvg, "regions", isChannelMap ? undefined : localBounds);

    // Definitions are document-scoped; collect layer resources without changing draw order.
    panelGroup.querySelectorAll("defs").forEach(layerDefs => {
        while (layerDefs.firstChild) defs.appendChild(layerDefs.firstChild);
        layerDefs.remove();
    });
    if (defs.childNodes.length) panelGroup.prepend(defs);

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
    const stagePosition = getColorbarStagePosition({
        position: colorbarSettings.position,
        viewHeight: viewHeight / pixelRatio,
        renderWidth: imageWidth / pixelRatio,
        padding,
        stageWidth: colorbarSettings.stageWidth,
        hoverInfoHeight: appStore.overlaySettings.colorbarHoverInfoHeight,
        isTitleVisible: Boolean(appStore.overlaySettings.title?.isShown)
    });

    if (isVertical) {
        barX = stagePosition.left * pixelRatio + offset;
        barY = (stagePosition.top + padding.top) * pixelRatio;
        barHeight = imageHeight;
    } else {
        barX = (stagePosition.left + padding.left) * pixelRatio;
        barHeight = barWidth;
        if (colorbarSettings.position === "top") {
            barY = (stagePosition.top + colorbarSettings.stageWidth - colorbarSettings.offset - colorbarSettings.width) * pixelRatio;
        } else {
            barY = (stagePosition.top + colorbarSettings.offset) * pixelRatio;
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
            width: colorbarSettings.tickWidth * appStore.imageRatio,
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
            width: colorbarSettings.borderWidth * appStore.imageRatio
        }
    });
}

function getBeamPlotProps(frame: FrameStore, basePosition?: Point2D): BeamPlotProps | null {
    if (!frame.hasVisibleBeam || !frame.beamProperties || !frame.overlayBeamSettings?.isVisible) {
        return null;
    }

    const appStore = AppStore.Instance;
    const beamSettings = frame.overlayBeamSettings;
    const geometry = getBeamGeometry(frame, {imageRatio: appStore.imageRatio, devicePixelRatio, padding: 10, basePosition});
    if (!geometry) return null;
    const color = getColorForTheme(beamSettings.color);
    const axisColor = beamSettings.type === BeamType.Solid ? Colors.WHITE : color;
    const strokeWidth = beamSettings.width;

    const isFilled = beamSettings.type === BeamType.Solid;

    return {
        position: geometry.position,
        scale: {x: geometry.scale.x / geometry.scale.y, y: 1},
        semiMajor: geometry.a * geometry.scale.y,
        semiMinor: geometry.b * geometry.scale.y,
        rotationDegrees: (geometry.theta * 180.0) / Math.PI,
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
        const channelMapStore = appStore.channelMapStore;
        const channelMapLayout = getFrameChannelMapLayout(frame);
        const lastCell = getChannelMapCell(channelMapStore.channelArray.length - 1, channelMapLayout);

        beamPadding = channelMapLayout.outerPadding;
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

    return group.childNodes.length ? group : null;
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
                    "dominant-baseline": "text-after-edge"
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

    if (AppStore.Instance.channelMapStore.isChannelMapEnabled) {
        const channelMap = AppStore.Instance.channelMapStore;
        const channelMapLayout = getFrameChannelMapLayout(frame);
        const group = svgGroupFromLayer("channel-map-regions");
        const source = renderRegionsToSvg(regions, frameView, channelMapLayout.tileWidth * pixelRatio, channelMapLayout.tileHeight * pixelRatio, 0, 0, {frame, pixelRatio});
        if (!source.childNodes.length) return null;
        source.id = `channel-map-region-source-${frame.frameInfo.fileId}`;
        const defs = createSvgElement("defs", {});
        defs.appendChild(source);
        group.appendChild(defs);
        channelMap.channelArray.forEach((channel, index) => {
            if (channel >= frame.frameInfo.fileInfoExtended.depth) return;
            const {left, top} = getChannelMapCell(index, channelMapLayout);
            const viewport = createSvgElement("svg", {x: left * pixelRatio, y: top * pixelRatio, width: channelMapLayout.tileWidth * pixelRatio, height: channelMapLayout.tileHeight * pixelRatio, overflow: "hidden"});
            viewport.appendChild(createSvgElement("use", {href: `#${source.id}`}));
            group.appendChild(viewport);
        });
        return group.querySelector("use") ? group : null;
    }
    const group = renderRegionsToSvg(regions, frameView, frame.renderWidth * pixelRatio, frame.renderHeight * pixelRatio, padding.left * pixelRatio, padding.top * pixelRatio, {frame, pixelRatio});
    return group.childNodes.length ? group : null;
}
