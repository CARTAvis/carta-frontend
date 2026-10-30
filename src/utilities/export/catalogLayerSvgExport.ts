import {CatalogOverlayShape} from "enums";
import {AppStore, type CatalogDisplayStore, type Padding} from "stores";
import {type FrameStore} from "stores/Frame";

import {type CatalogPointStyle, getCatalogShapeSize, getCatalogSizeFromArea, getCatalogSizeTuning, isCatalogPointVisible, renderCatalogToSvg} from "./catalogSvgExport";
import {createImageToCanvasMapper, createOverlayPointTransform, getDestinationFrameView} from "./imageViewSvgGeometry";
import {sampleSvgColormapColor} from "./svgColor";

export interface CatalogMappedArrays {
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
    const areaScale = store.isImagePixelSize ? getCatalogSizeTuning(store.catalogShape) * zoomY : 1;
    const frameView = getDestinationFrameView(frame);
    // Screen-pixel dimensions follow the exported frame view; image-pixel areas follow shader Y zoom.
    const imagePixelScale = frameView ? (frame.renderHeight * pixelRatio) / (frameView.yMax - frameView.yMin) : 1;
    const defaultSize = shapeSize * (store.isImagePixelSize ? imagePixelScale : pixelRatio);
    const scaleDiameter = (size: number) => size * (store.isImagePixelSize ? getCatalogSizeTuning(store.catalogShape) : 1);
    const lineWidth = (isFinite(store.thickness) ? store.thickness : 1) * (store.shapeSettings?.thicknessBase ?? 1) * pixelRatio;

    return (index, isSelected) => {
        const mappedSize = mappedSizes[index];
        const hasMappedSize = isFinite(mappedSize);
        // Mapped screen sizes are already device-pixel dimensions in the shader's size texture.
        let size = hasMappedSize ? mappedSize * (store.isImagePixelSize ? imagePixelScale : 1) : defaultSize;
        if (store.isSizeAreaMode) {
            const area = hasMappedSize ? mappedSize * areaScale : shapeSize * (store.isImagePixelSize ? areaScale : pixelRatio);
            size = getCatalogSizeFromArea(area, store.catalogShape);
        } else {
            size = scaleDiameter(size);
        }
        size = getCatalogShapeSize(size, store.catalogShape);
        const mappedMinorSize = mappedMinorSizes[index];
        let minorSize: number | undefined;
        if (isFinite(mappedMinorSize)) {
            minorSize = mappedMinorSize * (store.isImagePixelSize ? imagePixelScale : 1);
            if (store.isSizeMinorAreaMode) {
                // The shader's minor-area branch uses the resolved major dimension and scaled minor value.
                minorSize = getCatalogSizeFromArea(size, store.catalogShape, mappedMinorSize * areaScale);
            } else {
                minorSize = scaleDiameter(minorSize);
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

export function buildCatalogSvg(frame: FrameStore, padding: Padding, pixelRatio: number, mappedArrays: WeakMap<CatalogDisplayStore, CatalogMappedArrays>): SVGGElement | null {
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
