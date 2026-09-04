import * as React from "react";
import {Colors, NonIdealState, Spinner} from "@blueprintjs/core";
import {action, autorun, type IReactionDisposer, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ResizeDetector} from "components/Shared";
import {BeamType, ContourDashMode, HelpType, ImageType, VectorOverlaySource} from "enums";
import {type FrameView, type ImageViewItem, type Point2D, Zoom} from "models";
import {AppStore, type DefaultWidgetConfig, type Padding, type WidgetProps} from "stores";
import {LayoutStore} from "stores";
import {type FrameStore} from "stores/Frame";
import {ceilToPower, getColorForTheme, getColorsForValues, toFixed} from "utilities";
import {renderAstOverlayToSvg} from "utilities/export/astSvgExport";
import {renderBeamToSvg} from "utilities/export/beamSvgExport";
import {renderCatalogToSvg} from "utilities/export/catalogSvgExport";
import {renderColorbarToSvg} from "utilities/export/colorbarSvgExport";
import {renderContoursToSvg} from "utilities/export/contourSvgExport";
import {renderRegionsToSvg} from "utilities/export/regionSvgExport";
import {buildSvgDocument, createSvgElement, createSvgText, embedRasterAsSvgImage, svgGroupFromLayer} from "utilities/export/svgExport";
import {renderVectorOverlayToSvg} from "utilities/export/vectorOverlaySvgExport";

import {ChannelMapViewComponent} from "./ChannelMapView/ChannelMapViewComponent";
import {ImagePanelComponent} from "./ImagePanel/ImagePanelComponent";

import "./ImageViewComponent.scss";

/**
 * Search for an element by id in the main document and all FlexLayout popout
 * windows' documents. This is needed because when a widget is rendered in a
 * FlexLayout popout the DOM lives in a different document from the main window.
 */
function findElementInAllDocuments(id: string): HTMLElement | null {
    const el = document.getElementById(id);
    if (el) {
        return el;
    }
    const model = LayoutStore.Instance.layoutModel;
    if (model) {
        for (const [, layoutConfig] of model.getLayouts()) {
            const win = layoutConfig.getWindow();
            if (win && !win.closed) {
                const found = win.document.getElementById(id);
                if (found) {
                    return found;
                }
            }
        }
    }
    return null;
}

export function getImageViewCanvas(padding: Padding, colorbarPosition: string, backgroundColor: string = "rgba(255, 255, 255, 0)") {
    const appStore = AppStore.Instance;
    const config = appStore.imageViewConfigStore;

    const imageViewCanvas = document.createElement("canvas") as HTMLCanvasElement;
    imageViewCanvas.width = appStore.fullViewWidth * appStore.pixelRatio;
    imageViewCanvas.height = appStore.fullViewHeight * appStore.pixelRatio;
    const ctx = imageViewCanvas.getContext("2d");
    if (!ctx) {
        return imageViewCanvas;
    }
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, imageViewCanvas.width, imageViewCanvas.height);
    config.visibleImages.forEach((image, index) => {
        const frame = image?.type === ImageType.COLOR_BLENDING ? image.store?.baseFrame : image?.store;
        if (!frame) {
            return;
        }
        const column = index % config.numImageColumns;
        const row = Math.floor(index / config.numImageColumns);
        const viewWidth = (appStore.channelMapStore.isChannelMapEnabled ? frame.channelMapOuterOverlayStore.viewWidth : frame.overlayStore.viewWidth) * appStore.pixelRatio;
        const viewHeight = (appStore.channelMapStore.isChannelMapEnabled ? frame.channelMapOuterOverlayStore.viewHeight : frame.overlayStore.viewHeight) * appStore.pixelRatio;
        const panelCanvas = getPanelCanvas(column, row, viewWidth, viewHeight, padding, colorbarPosition, backgroundColor);
        if (panelCanvas) {
            ctx.drawImage(panelCanvas, frame.overlayStore.viewWidth * column * appStore.pixelRatio, frame.overlayStore.viewHeight * row * appStore.pixelRatio);
        }
    });

    return imageViewCanvas;
}

export function getPanelCanvas(column: number, row: number, viewWidth: number, viewHeight: number, padding: Padding, colorbarPosition: string, backgroundColor: string = "rgba(255, 255, 255, 0)") {
    const panelElement = findElementInAllDocuments(`image-panel-${column}-${row}`);
    if (!panelElement) {
        return null;
    }
    // Derive the document from the panel element so that the composited canvas is
    // created in the same browsing context as the source canvases (important when
    // the image viewer is rendered in a FlexLayout popout window).
    const ownerDoc = panelElement.ownerDocument;
    const rasterCanvas = panelElement.querySelector(".raster-canvas") as HTMLCanvasElement;
    const contourCanvas = panelElement.querySelector(".contour-canvas") as HTMLCanvasElement;
    const overlayCanvasArray = panelElement.querySelectorAll(".overlay-canvas") as NodeListOf<HTMLCanvasElement>;
    const catalogCanvas = panelElement.querySelector(".catalog-canvas") as HTMLCanvasElement;
    const vectorOverlayCanvas = panelElement.querySelector(".vector-overlay-canvas") as HTMLCanvasElement;

    if (!rasterCanvas || !overlayCanvasArray?.length) {
        return null;
    }

    const colorbarCanvas = panelElement.querySelector(".colorbar-stage canvas") as HTMLCanvasElement;
    const beamProfileCanvas = panelElement.querySelector(".beam-profile-stage canvas") as HTMLCanvasElement;
    const regionDivArray = panelElement.querySelectorAll(".region-stage") as NodeListOf<HTMLDivElement>;
    const channelMapLabelArray = panelElement.querySelectorAll(".channel-map-label-span") as NodeListOf<HTMLSpanElement>;

    const appStore = AppStore.Instance;
    const composedCanvas = ownerDoc.createElement("canvas") as HTMLCanvasElement;
    composedCanvas.width = viewWidth;
    composedCanvas.height = viewHeight;

    const ctx = composedCanvas.getContext("2d");
    if (!ctx) {
        return null;
    }
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, composedCanvas.width, composedCanvas.height);
    ctx.drawImage(rasterCanvas, padding.left * appStore.pixelRatio, padding.top * appStore.pixelRatio);

    if (contourCanvas) {
        ctx.drawImage(contourCanvas, padding.left * appStore.pixelRatio, padding.top * appStore.pixelRatio);
    }

    if (vectorOverlayCanvas) {
        ctx.drawImage(vectorOverlayCanvas, padding.left * appStore.pixelRatio, padding.top * appStore.pixelRatio);
    }

    if (colorbarCanvas) {
        let xPos, yPos;
        switch (colorbarPosition) {
            case "top":
                xPos = 0;
                yPos = padding.top * appStore.pixelRatio - colorbarCanvas.height;
                break;
            case "bottom":
                xPos = 0;
                yPos = viewHeight - colorbarCanvas.height - AppStore.Instance.overlaySettings.colorbarHoverInfoHeight * appStore.pixelRatio;
                break;
            case "right":
            default:
                xPos = padding.left * appStore.pixelRatio + rasterCanvas.width;
                yPos = 0;
                break;
        }
        ctx.drawImage(colorbarCanvas, xPos, yPos);
    }

    if (beamProfileCanvas) {
        const beamProfileDiv = panelElement.querySelector(".beam-profile-stage") as HTMLDivElement;
        const offsetLeft = beamProfileDiv?.offsetLeft * appStore.pixelRatio || 0;
        const offsetTop = beamProfileDiv?.offsetTop * appStore.pixelRatio || 0;
        ctx.drawImage(beamProfileCanvas, offsetLeft, offsetTop);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const overlayCanvas of overlayCanvasArray) {
        ctx.drawImage(overlayCanvas, overlayCanvas.offsetLeft * appStore.pixelRatio, overlayCanvas.offsetTop * appStore.pixelRatio);
    }

    if (catalogCanvas) {
        ctx.drawImage(catalogCanvas, padding.left * appStore.pixelRatio, padding.top * appStore.pixelRatio);
    }

    if (channelMapLabelArray?.length) {
        for (const channelMapLabel of channelMapLabelArray) {
            const style = getComputedStyle(channelMapLabel);
            const offsetLeft = (channelMapLabel.offsetLeft + parseFloat(style.paddingLeft)) * appStore.pixelRatio;
            const offsetTop = (channelMapLabel.offsetTop + parseFloat(style.paddingTop)) * appStore.pixelRatio;

            const fontSize = parseFloat(style.fontSize);
            const scaledFontSize = fontSize * appStore.pixelRatio;
            const fontStyle = style.fontStyle;
            const fontVariant = style.fontVariant;
            const fontWeight = style.fontWeight;
            const fontFamily = style.fontFamily;
            ctx.font = `${fontStyle} ${fontVariant} ${fontWeight} ${scaledFontSize}px ${fontFamily}`;

            ctx.fillStyle = style.color;
            ctx.textBaseline = "bottom";

            const divElementArray = channelMapLabel.querySelectorAll("div");
            let line = 1;
            const lineHeight = parseFloat(style.lineHeight) * appStore.pixelRatio;
            for (const divElement of divElementArray) {
                if (divElement.textContent) {
                    ctx.fillText(divElement.textContent, offsetLeft, offsetTop + lineHeight * line);
                    line++;
                }
            }
        }
    }

    if (regionDivArray?.length) {
        for (const regionDiv of regionDivArray) {
            const regionCanvas = regionDiv?.children[0]?.querySelector("canvas");
            if (regionCanvas) {
                ctx.drawImage(regionCanvas, regionDiv.offsetLeft * appStore.pixelRatio, regionDiv.offsetTop * appStore.pixelRatio);
            }
        }
    }

    return composedCanvas;
}

export function getImageViewSvg(padding: Padding, colorbarPosition: string, backgroundColor: string = "rgba(255, 255, 255, 0)"): SVGSVGElement | null {
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
        const viewWidth = (appStore.channelMapStore.isChannelMapEnabled ? frame.channelMapOuterOverlayStore.viewWidth : frame.overlayStore.viewWidth) * appStore.pixelRatio;
        const viewHeight = (appStore.channelMapStore.isChannelMapEnabled ? frame.channelMapOuterOverlayStore.viewHeight : frame.overlayStore.viewHeight) * appStore.pixelRatio;
        const panelSvg = getPanelSvg(column, row, viewWidth, viewHeight, padding, colorbarPosition, image, backgroundColor);
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

function sampleColormapColor(colorMap: string, fraction: number, bias: number, contrast: number, fallbackColor: string): string {
    const {color, size} = getColorsForValues(colorMap);
    if (!size || color.length < 4) {
        return fallbackColor;
    }

    let sampledFraction = clampValue(fraction - bias, 0, 1);
    sampledFraction = clampValue((sampledFraction - 0.5) * contrast + 0.5, 0, 1);
    const colorIndex = clampValue(Math.round(sampledFraction * (size - 1)), 0, size - 1);
    const offset = colorIndex * 4;

    return `rgba(${color[offset]}, ${color[offset + 1]}, ${color[offset + 2]}, ${(color[offset + 3] ?? 255) / 255})`;
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

function getContourStrokeColor(frame: FrameStore, level: number, levels: number[]): string {
    const fallbackColor = rgbColorToCss(frame.contourConfig.color);
    if (!frame.contourConfig.isColormapEnabled) {
        return fallbackColor;
    }

    const minLevel = Math.min(...levels);
    const maxLevel = Math.max(...levels);
    const fraction = minLevel === maxLevel ? 1 : (level - minLevel) / (maxLevel - minLevel);

    return sampleColormapColor(frame.contourConfig.colormap, fraction, frame.contourConfig.colormapBias, frame.contourConfig.colormapContrast, fallbackColor);
}

function getVectorZoomScale(frame: FrameStore): number {
    return frame.spatialReference ? frame.spatialReference.zoomLevel * (frame.spatialTransform?.scale ?? 1) : frame.zoomLevel;
}

function getVectorLineLengthInImageSpace(frame: FrameStore, intensity: number, pixelRatio: number): number {
    const config = frame.vectorOverlayConfig;
    const intensityMin = isFinite(config.intensityMin ?? NaN) ? config.intensityMin : frame.vectorOverlayStore.intensityMin;
    const intensityMax = isFinite(config.intensityMax ?? NaN) ? config.intensityMax : frame.vectorOverlayStore.intensityMax;
    const zoomScale = getVectorZoomScale(frame);
    const lengthMin = config.lengthMin * pixelRatio;
    const lengthMax = config.lengthMax * pixelRatio;

    if (config.intensitySource === VectorOverlaySource.None) {
        return lengthMax / zoomScale;
    }

    if (!isFinite(intensityMin ?? NaN) || !isFinite(intensityMax ?? NaN) || intensityMin === intensityMax) {
        return lengthMax / zoomScale;
    }

    const minIntensity = intensityMin ?? 0;
    const maxIntensity = intensityMax ?? minIntensity;
    const scaledIntensity = clampValue((intensity - minIntensity) / (maxIntensity - minIntensity), 0, 1);
    return (lengthMin + (lengthMax - lengthMin) * scaledIntensity) / zoomScale;
}

function getVectorStrokeColor(frame: FrameStore, intensity: number): string {
    const fallbackColor = rgbColorToCss(frame.vectorOverlayConfig.color);
    if (!frame.vectorOverlayConfig.isColormapEnabled) {
        return fallbackColor;
    }

    const intensityMin = isFinite(frame.vectorOverlayConfig.intensityMin ?? NaN) ? frame.vectorOverlayConfig.intensityMin : frame.vectorOverlayStore.intensityMin;
    const intensityMax = isFinite(frame.vectorOverlayConfig.intensityMax ?? NaN) ? frame.vectorOverlayConfig.intensityMax : frame.vectorOverlayStore.intensityMax;
    const fraction = !isFinite(intensityMin ?? NaN) || !isFinite(intensityMax ?? NaN) || intensityMin === intensityMax ? 1 : (intensity - (intensityMin ?? 0)) / ((intensityMax ?? 0) - (intensityMin ?? 0));

    return sampleColormapColor(frame.vectorOverlayConfig.colormap, fraction, frame.vectorOverlayConfig.colormapBias, frame.vectorOverlayConfig.colormapContrast, fallbackColor);
}

function transformOverlayPoint(point: Point2D, sourceFrame: FrameStore, destinationFrame: FrameStore, shouldUseCatalogTransform: boolean = false): Point2D | null {
    if (sourceFrame === destinationFrame) {
        return point;
    }

    const controlMap = shouldUseCatalogTransform ? sourceFrame.getCatalogControlMap(destinationFrame) : sourceFrame.getControlMap(destinationFrame);
    return controlMap.transformPoint(point);
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

            const transformedPoint = transformOverlayPoint({x: transformed[index], y: transformed[index + 1]}, sourceFrame, destinationFrame);
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

        const levels = Array.from(contourFrame.contourStores.keys());
        contourFrame.contourStores.forEach((contourStore, level) => {
            const contourSvg = renderContoursToSvg(
                transformContourVertexData(contourStore.exportVertexData, contourFrame, frame, frameView, layerWidth, layerHeight),
                contourStore.exportIndexOffsets,
                [level],
                [getContourStrokeColor(contourFrame, level, levels)],
                [getContourStrokeWidth(contourFrame, pixelRatio)],
                [getContourDashLength(frame, contourFrame.contourConfig.dashMode, level, pixelRatio)],
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
        const rotationOffset = isFinite(vectorFrame.vectorOverlayConfig.rotationOffset) ? (vectorFrame.vectorOverlayConfig.rotationOffset * Math.PI) / 180.0 : 0;

        vectorFrame.vectorOverlayStore.tiles.forEach(tile => {
            for (let vectorIndex = 0; vectorIndex < tile.numVertices; vectorIndex++) {
                const offset = vectorIndex * 4;
                const center = {x: tile.vertexData[offset], y: tile.vertexData[offset + 1]};
                const intensity = tile.vertexData[offset + 2];
                const rawAngleDegrees = tile.vertexData[offset + 3];
                const lineLength = getVectorLineLengthInImageSpace(frame, intensity, pixelRatio);
                if (lineLength <= 0) {
                    continue;
                }

                const angle = vectorFrame.vectorOverlayConfig.angularSource === VectorOverlaySource.None ? 0 : (-rawAngleDegrees * Math.PI) / 180.0 - rotationOffset;
                const dx = Math.cos(angle) * lineLength * 0.5;
                const dy = Math.sin(angle) * lineLength * 0.5;
                const startPoint = transformOverlayPoint({x: center.x - dx, y: center.y - dy}, vectorFrame, frame);
                const endPoint = transformOverlayPoint({x: center.x + dx, y: center.y + dy}, vectorFrame, frame);
                if (!startPoint || !endPoint) {
                    continue;
                }

                const startCanvas = imageToCanvasPoint(startPoint, frameView, layerWidth, layerHeight);
                const endCanvas = imageToCanvasPoint(endPoint, frameView, layerWidth, layerHeight);
                const exportLength = Math.hypot(endCanvas.x - startCanvas.x, endCanvas.y - startCanvas.y);
                if (exportLength <= 0) {
                    continue;
                }

                exportPositions.push((startCanvas.x + endCanvas.x) * 0.5, (startCanvas.y + endCanvas.y) * 0.5, exportLength, Math.atan2(endCanvas.y - startCanvas.y, endCanvas.x - startCanvas.x));
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
                padding.top * pixelRatio
            );
            group.appendChild(vectorSvg);
        }
    }

    return group.childNodes.length ? group : null;
}

function getCatalogPointSize(frame: FrameStore, size: number, isImagePixelSize: boolean, pixelRatio: number): number {
    const frameView = getDestinationFrameView(frame);
    if (isImagePixelSize && frameView) {
        return imageSizeToCanvasSize(size, size, frameView, frame.renderWidth * pixelRatio, frame.renderHeight * pixelRatio).x;
    }

    return size * pixelRatio;
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

    catalogFileIds.forEach(fileId => {
        const catalog = AppStore.Instance.catalogStore.catalogGLData.get(fileId);
        const catalogWidgetStore = AppStore.Instance.catalogStore.getCatalogWidgetStore(fileId);
        const count = AppStore.Instance.catalogStore.catalogCounts.get(fileId) ?? 0;
        const sourceFrame = AppStore.Instance.getFrame(AppStore.Instance.catalogStore.getFrameIdByCatalogId(fileId));
        if (!catalog || !catalogWidgetStore || !count || !sourceFrame) {
            return;
        }

        const points = new Float32Array(count * 2);
        let pointCount = 0;
        for (let index = 0; index < count; index++) {
            const transformedPoint = transformOverlayPoint({x: catalog.x[index], y: catalog.y[index]}, sourceFrame, frame, true);
            if (!transformedPoint) {
                continue;
            }

            const canvasPoint = imageToCanvasPoint(transformedPoint, frameView, frame.renderWidth * pixelRatio, frame.renderHeight * pixelRatio);
            points[pointCount * 2] = canvasPoint.x;
            points[pointCount * 2 + 1] = canvasPoint.y;
            pointCount++;
        }

        if (!pointCount) {
            return;
        }

        const shapeSize = catalogWidgetStore.isImagePixelSize ? catalogWidgetStore.catalogSize : catalogWidgetStore.catalogSize + (catalogWidgetStore.shapeSettings?.diameterBase ?? 0);
        positionArrays.set(fileId, points.subarray(0, pointCount * 2));
        shapes.set(fileId, catalogWidgetStore.catalogShape);
        sizes.set(fileId, getCatalogPointSize(frame, shapeSize, catalogWidgetStore.isImagePixelSize, pixelRatio));
        colors.set(fileId, catalogWidgetStore.catalogColor);
    });

    if (!positionArrays.size) {
        return null;
    }

    return renderCatalogToSvg(positionArrays, shapes, sizes, colors, padding.left * pixelRatio, padding.top * pixelRatio);
}

export function getPanelSvg(column: number, row: number, viewWidth: number, viewHeight: number, padding: Padding, colorbarPosition: string, image: ImageViewItem, backgroundColor: string = "rgba(255, 255, 255, 0)"): SVGGElement | null {
    const panelElement = findElementInAllDocuments(`image-panel-${column}-${row}`);
    if (!panelElement) {
        return null;
    }

    const appStore = AppStore.Instance;
    const pixelRatio = appStore.pixelRatio;
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

    // 2. Contour — vector SVG from store data
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

    // 3. Vector overlay — vector SVG from store data
    const vectorOverlaySvg = buildVectorOverlaySvg(frame, padding, pixelRatio);
    if (vectorOverlaySvg) {
        panelGroup.appendChild(vectorOverlaySvg);
    }

    // 4. Colorbar — vector SVG from store data
    const colorbarSettings = appStore.overlaySettings.colorbar;
    if (colorbarSettings.isVisible && frame.renderConfig?.colorscaleArray?.length) {
        const colorbarSvg = buildColorbarSvg(frame, colorbarSettings, colorbarPosition, viewWidth, viewHeight, padding, pixelRatio);
        if (colorbarSvg) {
            panelGroup.appendChild(colorbarSvg);
        }
    }

    // 5. Beam — vector SVG from store data
    const beamGroup = buildBeamsSvg(frame, padding, pixelRatio);
    if (beamGroup) {
        panelGroup.appendChild(beamGroup);
    }

    // 6. AST overlay — vector SVG via svgcanvas
    const overlayStore = appStore.channelMapStore.isChannelMapEnabled ? frame.channelMapOuterOverlayStore : frame.overlayStore;
    const astSvg = renderAstOverlayToSvg(overlayStore, image, appStore.overlaySettings, pixelRatio);
    if (astSvg) {
        panelGroup.appendChild(astSvg);
    }

    // 7. Catalog — vector SVG from store data
    const catalogSvg = buildCatalogSvg(frame, padding, pixelRatio);
    if (catalogSvg) {
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
        panelGroup.appendChild(regionsSvg);
    }

    return panelGroup;
}

function buildColorbarSvg(frame: FrameStore, colorbarSettings: any, colorbarPosition: string, viewWidth: number, viewHeight: number, padding: Padding, pixelRatio: number): SVGGElement | null {
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

    if (isVertical) {
        barX = padding.left * pixelRatio + frame.renderWidth * pixelRatio + offset;
        barY = padding.top * pixelRatio;
        barHeight = frame.renderHeight * pixelRatio;
    } else {
        barX = padding.left * pixelRatio;
        barHeight = barWidth;
        if (colorbarPosition === "top") {
            barY = padding.top * pixelRatio - barHeight - offset;
        } else {
            barY = viewHeight - barHeight - offset - appStore.overlaySettings.colorbarHoverInfoHeight * pixelRatio;
        }
        barWidth = frame.renderWidth * pixelRatio;
    }

    const tickColor = getColorForTheme(colorbarSettings.tickCustomColor ? colorbarSettings.tickColor : colorbarSettings.color);
    const numberColor = getColorForTheme(colorbarSettings.numberCustomColor ? colorbarSettings.numberColor : colorbarSettings.color);
    const labelColor = getColorForTheme(colorbarSettings.labelCustomColor ? colorbarSettings.labelColor : colorbarSettings.color);
    const borderColor = getColorForTheme(colorbarSettings.borderCustomColor ? colorbarSettings.borderColor : colorbarSettings.color);

    // Scale tick positions to SVG coordinates
    const scaledPositions = positions.map((p: number) => p * pixelRatio);

    const frameUnit = frame.requiredUnit === undefined || !frame.requiredUnit.length ? "arbitrary units" : frame.requiredUnit;
    const labelText = colorbarSettings.labelVisible ? (colorbarSettings.labelCustomText ? (frame.colorbarLabelCustomText ?? "") : frameUnit) : "";

    return renderColorbarToSvg(
        colorscaleArray,
        colorbarSettings.position,
        barX,
        barY,
        isVertical ? barWidth : frame.renderWidth * pixelRatio,
        isVertical ? barHeight : colorbarSettings.width * pixelRatio,
        scaledPositions,
        texts,
        tickColor,
        colorbarSettings.tickWidth * pixelRatio,
        colorbarSettings.tickLen * pixelRatio,
        "sans-serif",
        colorbarSettings.numberFontSize * pixelRatio,
        numberColor,
        colorbarSettings.numberRotation,
        labelText,
        "sans-serif",
        colorbarSettings.labelFontSize * pixelRatio,
        labelColor,
        colorbarSettings.labelRotation,
        colorbarSettings.borderVisible,
        borderColor,
        colorbarSettings.borderWidth * pixelRatio
    );
}

function getBeamPlotProps(frame: FrameStore, pixelRatio: number, basePosition?: Point2D): {position: Point2D; a: number; b: number; theta: number; color: string; axisColor: string; strokeWidth: number; isFilled: boolean} | null {
    if (!frame.hasVisibleBeam || !frame.beamProperties || !frame.overlayBeamSettings?.isVisible) {
        return null;
    }

    const appStore = AppStore.Instance;
    const beamSettings = frame.overlayBeamSettings;
    const zoomLevel = (frame.spatialReference ? frame.spatialReference.zoomLevel * (frame.spatialTransform?.scale ?? 1) : frame.zoomLevel) / appStore.imageRatio;
    const color = getColorForTheme(beamSettings.color);
    const axisColor = beamSettings.type === BeamType.Solid ? Colors.WHITE : color;
    const strokeWidth = beamSettings.width;

    const a = ((frame.beamProperties.x / 2.0) * zoomLevel) / devicePixelRatio;
    const b = ((frame.beamProperties.y / 2.0) * zoomLevel) / devicePixelRatio;
    let theta = ((90.0 - frame.beamProperties.angle) * Math.PI) / 180.0;
    if (frame.spatialTransform) {
        theta -= frame.spatialTransform.rotation;
    }

    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    const boundingBox = {
        x: 2 * Math.sqrt(a * a * cosTheta * cosTheta + b * b * sinTheta * sinTheta),
        y: 2 * Math.sqrt(a * a * sinTheta * sinTheta + b * b * cosTheta * cosTheta)
    };

    // Match the original BeamProfileOverlayComponent: padding prop is 10, scaled by devicePixelRatio
    const beamPadding = 10;
    const paddingOffset = beamPadding * devicePixelRatio;
    let positionX = basePosition ? basePosition.x : boundingBox.x / 2.0 + paddingOffset + beamSettings.shiftX;
    const rightMost = frame.renderWidth - boundingBox.x / 2.0;
    if (positionX > rightMost) {
        positionX = rightMost;
    }
    let positionY = basePosition ? basePosition.y : frame.renderHeight - boundingBox.y / 2.0 - paddingOffset - beamSettings.shiftY;
    const upMost = boundingBox.y / 2.0;
    if (positionY < upMost) {
        positionY = upMost;
    }

    const isFilled = beamSettings.type === BeamType.Solid;

    return {
        position: {x: positionX * pixelRatio, y: positionY * pixelRatio},
        a: a * pixelRatio,
        b: b * pixelRatio,
        theta,
        color,
        axisColor,
        strokeWidth: strokeWidth * pixelRatio,
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
    // Offset the beam group by padding (beam renders inside the image area)
    group.setAttribute("transform", `translate(${padding.left * pixelRatio},${padding.top * pixelRatio})`);

    // Base frame beam
    const basePlot = frame.hasVisibleBeam ? getBeamPlotProps(frame, pixelRatio) : null;
    if (basePlot) {
        const beamSvg = renderBeamToSvg(basePlot.position.x, basePlot.position.y, basePlot.a, basePlot.b, (basePlot.theta * 180.0) / Math.PI, basePlot.color, basePlot.axisColor, basePlot.strokeWidth, basePlot.isFilled);
        group.appendChild(beamSvg);
    }

    // Contour frame beams (positioned at the same location as the base beam)
    contourFrames?.forEach(contourFrame => {
        const plotProps = getBeamPlotProps(contourFrame, pixelRatio, basePlot?.position);
        if (plotProps) {
            const beamSvg = renderBeamToSvg(plotProps.position.x, plotProps.position.y, plotProps.a, plotProps.b, (plotProps.theta * 180.0) / Math.PI, plotProps.color, plotProps.axisColor, plotProps.strokeWidth, plotProps.isFilled);
            group.appendChild(beamSvg);
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

    return renderRegionsToSvg(regions, frameView, frame.renderWidth * pixelRatio, frame.renderHeight * pixelRatio, padding.left * pixelRatio, padding.top * pixelRatio);
}

@observer
export class ImageViewComponent extends React.Component<WidgetProps> {
    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "image-view",
            type: "image-view",
            minWidth: 500,
            minHeight: 500,
            defaultWidth: 600,
            defaultHeight: 600,
            title: "Image view",
            isCloseable: false,
            helpType: HelpType.IMAGE_VIEW
        };
    }

    private imagePanelRefs: any[];
    private ratioIndicatorTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
    private cachedImageSize: Point2D;
    private cachedGridSize: Point2D;
    private readonly disposers: IReactionDisposer[] = [];

    @observable shouldShowRatioIndicator: boolean = false;

    onResize = (width: number, height: number) => {
        if (width > 0 && height > 0) {
            const appStore = AppStore.Instance;
            const isAutoFitRequired = appStore.preferenceStore.zoomMode === Zoom.FIT && appStore.fullViewWidth <= 1 && appStore.fullViewHeight <= 1;
            appStore.setImageViewDimensions(width, height);
            if (isAutoFitRequired) {
                this.imagePanelRefs?.forEach(imagePanelRef => imagePanelRef?.fitZoomFrameAndRegion());
            }
        }
    };

    @action setRatioIndicatorVisible = (isVisible: boolean) => {
        this.shouldShowRatioIndicator = isVisible;
    };

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        this.imagePanelRefs = [];

        const appStore = AppStore.Instance;

        this.disposers.push(
            autorun(() => {
                const visibleFrames = appStore.imageViewConfigStore.visibleFrames;
                if (!visibleFrames.length) {
                    return;
                }

                const firstFrame = visibleFrames[0];
                if (!firstFrame) {
                    return;
                }

                const imageSize = {x: firstFrame.overlayStore.renderWidth, y: firstFrame.overlayStore.renderHeight};
                const imageGridSize = {x: appStore.imageViewConfigStore.numImageColumns, y: appStore.imageViewConfigStore.numImageRows};
                // Compare to cached image size to prevent duplicate events when changing frames
                const isImageSizeChanged = !this.cachedImageSize || this.cachedImageSize.x !== imageSize.x || this.cachedImageSize.y !== imageSize.y;
                const isGridSizeChanged = !this.cachedGridSize || this.cachedGridSize.x !== imageGridSize.x || this.cachedGridSize.y !== imageGridSize.y;
                if (isImageSizeChanged || isGridSizeChanged) {
                    this.cachedImageSize = imageSize;
                    this.cachedGridSize = imageGridSize;
                    clearTimeout(this.ratioIndicatorTimeoutHandle);
                    this.ratioIndicatorTimeoutHandle = undefined;
                    this.setRatioIndicatorVisible(true);
                    this.ratioIndicatorTimeoutHandle = setTimeout(() => this.setRatioIndicatorVisible(false), 1000);
                }
            })
        );
    }

    componentWillUnmount() {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
        clearTimeout(this.ratioIndicatorTimeoutHandle);
        this.ratioIndicatorTimeoutHandle = undefined;
    }

    private collectImagePanelRef = ref => {
        this.imagePanelRefs.push(ref);
    };

    get panels() {
        const appStore = AppStore.Instance;
        const config = appStore.imageViewConfigStore;
        const visibleImages = config.visibleImages;
        this.imagePanelRefs = [];
        if (!visibleImages) {
            return [];
        }

        return appStore.channelMapStore.isChannelMapEnabled
            ? [<ChannelMapViewComponent isDocked={this.props.docked} key="channel-map-panel" />]
            : visibleImages.map((image, index) => {
                  const column = index % config.numImageColumns;
                  const row = Math.floor(index / config.numImageColumns);

                  return <ImagePanelComponent ref={this.collectImagePanelRef} key={`${image?.type}-${image?.store?.id}`} docked={this.props.docked} image={image} row={row} column={column} />;
              });
    }

    render() {
        const appStore = AppStore.Instance;
        const config = appStore.imageViewConfigStore;

        let divContents: React.ReactNode | React.ReactNode[];
        if (!this.panels.length) {
            divContents = <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />;
        } else if (!appStore.isAstReady) {
            divContents = <NonIdealState icon={<Spinner className="astLoadingSpinner" />} title={"Loading AST Library"} />;
        } else {
            const firstFrame = appStore.imageViewConfigStore.visibleFrames?.[0];
            const effectiveImageSize = {x: Math.floor(firstFrame?.overlayStore?.renderWidth), y: Math.floor(firstFrame?.overlayStore?.renderHeight)};
            const ratio = effectiveImageSize.x / effectiveImageSize.y;
            const gridSize = {x: config.numImageColumns, y: config.numImageRows};

            let gridSizeNode: React.ReactNode;
            if (gridSize.x * gridSize.y > 1) {
                gridSizeNode = (
                    <p>
                        {gridSize.x} &times; {gridSize.y}
                    </p>
                );
            }
            divContents = (
                <React.Fragment>
                    {this.panels}
                    <div style={{opacity: this.shouldShowRatioIndicator ? 1 : 0}} className={"image-ratio-popup"}>
                        <p>
                            {effectiveImageSize.x} &times; {effectiveImageSize.y} ({toFixed(ratio, 2)})
                        </p>
                        {gridSizeNode}
                    </div>
                </React.Fragment>
            );
        }

        return (
            <ResizeDetector onResize={this.onResize} throttleTime={33}>
                <div className="image-view-div" style={{gridTemplateColumns: `repeat(${config.numImageColumns}, 1fr)`, gridTemplateRows: `repeat(${config.numImageRows}, 1fr)`}} data-testid="viewer-div">
                    {divContents}
                </div>
            </ResizeDetector>
        );
    }
}
