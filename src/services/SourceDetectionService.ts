import * as ort from "onnxruntime-web";

import {type FrameStore} from "stores/Frame";

import {type RawRasterROI, TileService} from "./TileService";

const MODEL_SIZE = 640;
const RAW_CANDIDATE_THRESHOLD = 0.0001;
const NMS_IOU_THRESHOLD = 0.45;
const RAW_CONFIDENCE_KEEP_PRIORITY = 0.9;
const HIGH_RAW_NMS_IOU_THRESHOLD = 0.65;
const MAX_ONNX_CANDIDATES = 1000;
const PEAK_FLUX_FLOOR_FRACTION = 0.01;
const AVERAGE_FLUX_FLOOR_FRACTION = 0.0001;
const RAW_CONFIDENCE_FLOOR = 0.01;
const GALAXY_SAME_CLASS_IOU_THRESHOLD = 0.35;
// CARTA's ZFP worker restores blank/NaN pixels as -FLT_MAX because some
// shader implementations cannot reliably test NaN.
const CARTA_BLANK_PIXEL = -3.402823466e38;
const CLASS_NAMES = ["point", "galaxy"];

export interface SourceDetection {
    id: string;
    classId: number;
    className: string;
    /** Model confidence before display calibration. */
    rawConfidence?: number;
    confidence: number;
    /** [x, y, width, height] in CARTA image-pixel coordinates. */
    bboxPx: [number, number, number, number];
    /** [center x, center y, radius major, radius minor, angle degrees]. */
    ellipsePx: [number, number, number, number, number];
    totalFlux?: number;
    peakFlux: number;
}

export interface SourceDetectionResult {
    cacheKey: string;
    detections: SourceDetection[];
}

export class SourceDetectionService {
    private static staticInstance: SourceDetectionService;

    public static get Instance() {
        if (!SourceDetectionService.staticInstance) {
            SourceDetectionService.staticInstance = new SourceDetectionService();
        }
        return SourceDetectionService.staticInstance;
    }

    private sessionPromise: Promise<ort.InferenceSession> | null = null;
    private readonly resultCache = new Map<string, SourceDetection[]>();

    private constructor() {
        ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1)) : 1;
    }

    getCacheKey(frame: FrameStore): string {
        const view = frame.requiredFrameView;
        const zoom = frame.spatialReference?.zoomLevel ?? frame.zoomLevel;
        return [frame.id, frame.channel, frame.stokes, zoom.toFixed(4), view.mip, view.xMin.toFixed(2), view.yMin.toFixed(2), view.xMax.toFixed(2), view.yMax.toFixed(2)].join(":");
    }

    async detectVisibleSources(frame: FrameStore): Promise<SourceDetectionResult | null> {
        const cacheKey = this.getCacheKey(frame);
        const cached = this.resultCache.get(cacheKey);
        if (cached) {
            console.info(`[SourceDetection] Cache hit with ${cached.length} source(s)`);
            return {cacheKey, detections: cached};
        }

        const roi = TileService.Instance.getVisibleRasterROI(frame);
        if (!roi) {
            return null;
        }

        const session = await this.getSession();
        const inputChannels = this.getInputChannels(session);
        const tensorData = this.prepareTensor(roi, inputChannels);
        const tensor = new ort.Tensor("float32", tensorData, [1, inputChannels, MODEL_SIZE, MODEL_SIZE]);
        const results = await session.run({[session.inputNames[0]]: tensor});
        const output = results[session.outputNames[0]];
        // Use only the ACDC point/galaxy ONNX model. The legacy connected-component
        // extended detector is intentionally not part of this pipeline.
        const pointDetections = this.parseOutput(output, roi).map(detection => this.applyModelPostProcessing(detection, roi));
        const galaxyDetections = pointDetections.filter(detection => detection.className === "galaxy");
        // Retain the reference display rule for model-produced galaxy boxes:
        // do not also show point proposals centred inside the same box.
        const spatiallyFiltered = pointDetections.filter(detection => {
            if (detection.className !== "point") {
                return true;
            }
            const [centerX, centerY] = detection.ellipsePx;
            return !galaxyDetections.some(source => this.ellipseContainsPoint(source.ellipsePx, centerX, centerY, 1.05));
        });
        // Port the reference project's confidence/region-size containment
        // suppression, scoped to one detected class. This removes repeated
        // proposals for the same point or extended object without allowing a
        // scene-scale galaxy ellipse to erase resolved point sources.
        const overlapFiltered = this.suppressOverlappingSameClass(spatiallyFiltered);
        // Apply the same raw-confidence and peak-flux quality floors to both
        // point and galaxy proposals.
        const maximumPeakFlux = overlapFiltered.reduce((maximum, detection) => Math.max(maximum, detection.peakFlux), 0);
        const minimumPeakFlux = maximumPeakFlux * PEAK_FLUX_FLOOR_FRACTION;
        const qualityFiltered = overlapFiltered.filter(detection => (detection.rawConfidence ?? detection.confidence) >= RAW_CONFIDENCE_FLOOR && (maximumPeakFlux <= 0 || detection.peakFlux >= minimumPeakFlux));
        // Port the reference project's mean-flux-per-pixel display gate:
        // Gaussian total flux divided by the ellipse area must be at least
        // 0.01% of the brightest average-flux source.
        const averageFlux = (detection: SourceDetection): number => {
            const [, , radiusX, radiusY] = detection.ellipsePx;
            const ellipsePixels = Math.PI * Math.abs(radiusX * radiusY);
            const totalFlux = detection.totalFlux ?? 0;
            return Number.isFinite(totalFlux) && totalFlux > 0 && ellipsePixels > 0 ? totalFlux / ellipsePixels : 0;
        };
        const maximumAverageFlux = qualityFiltered.reduce((maximum, detection) => Math.max(maximum, averageFlux(detection)), 0);
        const minimumAverageFlux = maximumAverageFlux * AVERAGE_FLUX_FLOOR_FRACTION;
        const averageFluxFiltered = maximumAverageFlux > 0 ? qualityFiltered.filter(detection => averageFlux(detection) >= minimumAverageFlux) : qualityFiltered;
        const detections = averageFluxFiltered.sort((a, b) => b.peakFlux - a.peakFlux);
        const overlapGalaxies = overlapFiltered.filter(detection => detection.className === "galaxy").length;
        const displayedGalaxies = detections.filter(detection => detection.className === "galaxy").length;
        console.info(
            `[SourceDetection] ACDC post-processing model=${pointDetections.length}, galaxies=${galaxyDetections.length}, spatial=${spatiallyFiltered.length}, overlap=${overlapFiltered.length} (${overlapGalaxies} galaxies), quality=${qualityFiltered.length}, averageFlux=${averageFluxFiltered.length}, displayed=${detections.length} (${displayedGalaxies} galaxies)`
        );
        console.debug(
            `[SourceDetection] Displayed candidates ${JSON.stringify(
                detections
                    .map(detection => ({
                        className: detection.className,
                        center: detection.ellipsePx.slice(0, 2).map(value => Number(value.toFixed(1))),
                        radii: detection.ellipsePx.slice(2, 4).map(value => Number(value.toFixed(1))),
                        rawConfidence: Number((detection.rawConfidence ?? 0).toFixed(5)),
                        confidence: Number(detection.confidence.toFixed(3)),
                        totalFlux: Number((detection.totalFlux ?? 0).toPrecision(4)),
                        averageFlux: Number(averageFlux(detection).toPrecision(4)),
                        peakFlux: Number(detection.peakFlux.toPrecision(4))
                    }))
                    .slice(0, 30)
            )}`
        );
        this.resultCache.set(cacheKey, detections);
        this.trimCache();
        return {cacheKey, detections};
    }

    private getSession(): Promise<ort.InferenceSession> {
        if (!this.sessionPromise) {
            const modelUrl = new URL("models/acdc_point_galaxy.onnx", document.baseURI).toString();
            this.sessionPromise = ort.InferenceSession.create(modelUrl, {executionProviders: ["wasm"]}).then(session => {
                console.info("[SourceDetection] ACDC point/galaxy model loaded");
                return session;
            });
        }
        return this.sessionPromise;
    }

    private getInputChannels(session: ort.InferenceSession): number {
        const metadata = session.inputMetadata[0];
        const dimensions = metadata && "dimensions" in metadata ? metadata.dimensions : undefined;
        const channels = dimensions?.[1];
        return typeof channels === "number" && channels > 0 ? channels : 3;
    }

    private isValidSciencePixel(value: number): boolean {
        return Number.isFinite(value) && value > CARTA_BLANK_PIXEL / 2;
    }

    private prepareTensor(roi: RawRasterROI, inputChannels: number): Float32Array {
        const sampled = new Float32Array(MODEL_SIZE * MODEL_SIZE);
        const finite: number[] = [];
        for (let y = 0; y < MODEL_SIZE; y++) {
            const sourceY = Math.min(roi.height - 1, Math.floor((y / MODEL_SIZE) * roi.height));
            for (let x = 0; x < MODEL_SIZE; x++) {
                const sourceX = Math.min(roi.width - 1, Math.floor((x / MODEL_SIZE) * roi.width));
                const value = roi.data[sourceY * roi.width + sourceX];
                sampled[y * MODEL_SIZE + x] = value;
                if (this.isValidSciencePixel(value)) {
                    finite.push(value);
                }
            }
        }

        finite.sort((a, b) => a - b);
        const median = finite.length ? finite[Math.floor((finite.length - 1) / 2)] : 0;
        const deviations = finite.map(value => Math.abs(value - median)).sort((a, b) => a - b);
        const floor = deviations.length ? 1.4826 * deviations[Math.floor((deviations.length - 1) / 2)] : 0;
        const ceiling = finite.length ? finite[Math.floor((finite.length - 1) * 0.995)] : 1;
        const range = Math.max(ceiling - floor, 1e-10);
        const tensor = new Float32Array(inputChannels * MODEL_SIZE * MODEL_SIZE);

        for (let index = 0; index < sampled.length; index++) {
            const raw = sampled[index];
            const normalized = !this.isValidSciencePixel(raw) || raw < floor ? 0 : Math.max(0, Math.min(1, (raw - floor) / range));
            for (let channel = 0; channel < inputChannels; channel++) {
                tensor[channel * sampled.length + index] = normalized;
            }
        }
        return tensor;
    }

    private parseOutput(output: ort.Tensor, roi: RawRasterROI): SourceDetection[] {
        const raw = output.data as Float32Array;
        const dims = output.dims;
        const candidates: SourceDetection[] = [];
        const addDetection = (cx: number, cy: number, width: number, height: number, confidence: number, classId: number) => {
            if (confidence < RAW_CANDIDATE_THRESHOLD) {
                return;
            }
            const hasNormalizedCoordinates = Math.max(Math.abs(cx), Math.abs(cy), Math.abs(width), Math.abs(height)) <= 1;
            const modelCx = hasNormalizedCoordinates ? cx : cx / MODEL_SIZE;
            const modelCy = hasNormalizedCoordinates ? cy : cy / MODEL_SIZE;
            const modelWidth = hasNormalizedCoordinates ? Math.abs(width) : Math.abs(width) / MODEL_SIZE;
            const modelHeight = hasNormalizedCoordinates ? Math.abs(height) : Math.abs(height) / MODEL_SIZE;
            // OnnxDetector.buildDetection clamps every viewport proposal to
            // the same 10..640 image-pixel range.
            const boxWidth = Math.max(10, Math.min(MODEL_SIZE, modelWidth * roi.imageWidth));
            const boxHeight = Math.max(10, Math.min(MODEL_SIZE, modelHeight * roi.imageHeight));
            const x = roi.xMin + modelCx * roi.imageWidth - boxWidth / 2;
            const y = roi.yMin + modelCy * roi.imageHeight - boxHeight / 2;
            const safeClassId = Math.max(0, Math.min(CLASS_NAMES.length - 1, classId));
            candidates.push({
                id: `${roi.xMin}:${roi.yMin}:${candidates.length}`,
                classId: safeClassId,
                className: CLASS_NAMES[safeClassId],
                confidence,
                bboxPx: [x, y, boxWidth, boxHeight],
                ellipsePx: [x + boxWidth / 2, y + boxHeight / 2, boxWidth / 2, boxHeight / 2, 0],
                peakFlux: 0
            });
        };

        if (dims.length === 3 && dims[2] <= 8 && dims[1] > dims[2]) {
            const boxCount = dims[1];
            const stride = dims[2];
            for (let index = 0; index < boxCount; index++) {
                const base = index * stride;
                addDetection(raw[base], raw[base + 1], raw[base + 2], raw[base + 3], raw[base + 4] ?? 0, Math.round(raw[base + 5] ?? 0));
            }
        } else if (dims.length === 3 && dims[1] >= 5) {
            const rowCount = dims[1];
            const anchorCount = dims[2];
            const classCount = rowCount - 4;
            for (let anchor = 0; anchor < anchorCount; anchor++) {
                let confidence = -Infinity;
                let classId = 0;
                for (let classIndex = 0; classIndex < classCount; classIndex++) {
                    const score = raw[(4 + classIndex) * anchorCount + anchor];
                    if (score > confidence) {
                        confidence = score;
                        classId = classIndex;
                    }
                }
                addDetection(raw[anchor], raw[anchorCount + anchor], raw[2 * anchorCount + anchor], raw[3 * anchorCount + anchor], confidence, classId % CLASS_NAMES.length);
            }
        } else {
            console.warn(`[SourceDetection] Unsupported ONNX output shape: ${dims.join("x")}`);
        }

        const onnxCandidates = candidates.sort((a, b) => b.confidence - a.confidence).slice(0, MAX_ONNX_CANDIDATES);
        const kept = this.nonMaximumSuppression(onnxCandidates);
        console.info(`[SourceDetection] ONNX candidates=${candidates.length}, threshold=${RAW_CANDIDATE_THRESHOLD}, retained=${kept.length}`);
        return kept;
    }

    private nonMaximumSuppression(candidates: SourceDetection[]): SourceDetection[] {
        const sorted = [...candidates].sort((a, b) => {
            const aHigh = a.confidence >= RAW_CONFIDENCE_KEEP_PRIORITY ? 1 : 0;
            const bHigh = b.confidence >= RAW_CONFIDENCE_KEEP_PRIORITY ? 1 : 0;
            return aHigh !== bHigh ? bHigh - aHigh : b.confidence - a.confidence;
        });
        const kept: SourceDetection[] = [];
        const suppressed = new Set<number>();
        for (let index = 0; index < sorted.length; index++) {
            if (suppressed.has(index)) {
                continue;
            }
            kept.push(sorted[index]);
            for (let childIndex = index + 1; childIndex < sorted.length; childIndex++) {
                const child = sorted[childIndex];
                const overlapThreshold = child.confidence >= RAW_CONFIDENCE_KEEP_PRIORITY ? HIGH_RAW_NMS_IOU_THRESHOLD : NMS_IOU_THRESHOLD;
                if (this.intersectionOverUnion(sorted[index].bboxPx, child.bboxPx) > overlapThreshold) {
                    suppressed.add(childIndex);
                }
            }
        }
        return kept;
    }

    private calibrateDisplayConfidence(rawConfidence: number): number {
        const raw = Math.max(0, rawConfidence);
        return raw <= 0 ? 0 : Math.min(0.99, 1 - Math.exp(-raw * 50));
    }

    private applyModelPostProcessing(detection: SourceDetection, roi: RawRasterROI): SourceDetection {
        const [boxX, boxY, boxWidth, boxHeight] = detection.bboxPx;
        const sampleScaleX = roi.imageWidth / roi.width;
        const sampleScaleY = roi.imageHeight / roi.height;
        const x0 = Math.max(0, Math.floor((boxX - roi.xMin) / sampleScaleX));
        const y0 = Math.max(0, Math.floor((boxY - roi.yMin) / sampleScaleY));
        const x1 = Math.min(roi.width - 1, Math.ceil((boxX + boxWidth - roi.xMin) / sampleScaleX));
        const y1 = Math.min(roi.height - 1, Math.ceil((boxY + boxHeight - roi.yMin) / sampleScaleY));
        const backgroundSamples: number[] = [];
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                if (x === x0 || x === x1 || y === y0 || y === y1) {
                    const value = roi.data[y * roi.width + x];
                    if (this.isValidSciencePixel(value)) {
                        backgroundSamples.push(value);
                    }
                }
            }
        }
        backgroundSamples.sort((a, b) => a - b);
        const localBackground = backgroundSamples.length ? backgroundSamples[Math.floor(backgroundSamples.length / 2)] : 0;
        let maximumSignal = 0;
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const value = roi.data[y * roi.width + x];
                if (this.isValidSciencePixel(value)) {
                    maximumSignal = Math.max(maximumSignal, value - localBackground);
                }
            }
        }

        const accumulateMoments = (minimumSignal: number) => {
            let intensity = 0;
            let weightedX = 0;
            let weightedY = 0;
            let weightedXX = 0;
            let weightedYY = 0;
            let weightedXY = 0;
            for (let y = y0; y <= y1; y++) {
                for (let x = x0; x <= x1; x++) {
                    const rawValue = roi.data[y * roi.width + x];
                    if (!this.isValidSciencePixel(rawValue)) {
                        continue;
                    }
                    const signal = rawValue - localBackground;
                    if (signal <= minimumSignal) {
                        continue;
                    }
                    const value = signal - minimumSignal;
                    const imageX = roi.xMin + x * sampleScaleX;
                    const imageY = roi.yMin + y * sampleScaleY;
                    intensity += value;
                    weightedX += value * imageX;
                    weightedY += value * imageY;
                    weightedXX += value * imageX * imageX;
                    weightedYY += value * imageY * imageY;
                    weightedXY += value * imageX * imageY;
                }
            }
            return {intensity, weightedX, weightedY, weightedXX, weightedYY, weightedXY};
        };

        let moments = accumulateMoments(Math.max(0, maximumSignal * 0.12));
        if (moments.intensity === 0) {
            moments = accumulateMoments(0);
        }
        if (moments.intensity === 0) {
            return {
                ...detection,
                rawConfidence: detection.rawConfidence ?? detection.confidence,
                confidence: this.calibrateDisplayConfidence(detection.confidence),
                totalFlux: 0
            };
        }

        const centerX = moments.weightedX / moments.intensity;
        const centerY = moments.weightedY / moments.intensity;
        const varianceX = moments.weightedXX / moments.intensity - centerX * centerX;
        const varianceY = moments.weightedYY / moments.intensity - centerY * centerY;
        const covarianceXY = moments.weightedXY / moments.intensity - centerX * centerY;
        const discriminant = Math.sqrt(Math.max(0, ((varianceX - varianceY) / 2) ** 2 + covarianceXY ** 2));
        const sigmaMajor = Math.sqrt(Math.max((varianceX + varianceY) / 2 + discriminant, 0.01));
        const sigmaMinor = Math.sqrt(Math.max((varianceX + varianceY) / 2 - discriminant, 0.01));
        const angle = (Math.atan2(2 * covarianceXY, varianceX - varianceY) / 2) * (180 / Math.PI);
        // Match the reference ACDC `source: "onnx"` display path: point
        // regions use 1σ and galaxy regions use 3σ Gaussian radii instead of
        // drawing the raw YOLO proposal box.
        const sigmaFactor = detection.className === "point" ? 1 : 3;
        const radiusMajor = sigmaMajor * sigmaFactor;
        const radiusMinor = sigmaMinor * sigmaFactor;
        const radius = (radiusMajor + radiusMinor) / 2;
        const isNearlyRound = sigmaMajor / Math.max(sigmaMinor, 1e-6) < 1.15;
        const peakFlux = moments.intensity / (2 * Math.PI * Math.max(sigmaMajor, 0.5) * Math.max(sigmaMinor, 0.5));
        return {
            ...detection,
            rawConfidence: detection.rawConfidence ?? detection.confidence,
            confidence: this.calibrateDisplayConfidence(detection.confidence),
            ellipsePx: [centerX, centerY, isNearlyRound ? radius : radiusMajor, isNearlyRound ? radius : radiusMinor, angle],
            totalFlux: moments.intensity,
            peakFlux
        };
    }

    private suppressOverlappingSameClass(detections: SourceDetection[]): SourceDetection[] {
        const sorted = [...detections].sort((a, b) => this.compareDetectionPriority(a, b));
        const kept: SourceDetection[] = [];
        for (const detection of sorted) {
            const [centerX, centerY] = detection.ellipsePx;
            const isRepeatedRegion = kept.some(parent => {
                if (parent.className !== detection.className) {
                    return false;
                }
                const [parentCenterX, parentCenterY] = parent.ellipsePx;
                return (
                    this.ellipseContainsPoint(parent.ellipsePx, centerX, centerY, 1) ||
                    this.ellipseContainsPoint(detection.ellipsePx, parentCenterX, parentCenterY, 1) ||
                    (detection.className === "galaxy" && this.intersectionOverUnion(parent.bboxPx, detection.bboxPx) > GALAXY_SAME_CLASS_IOU_THRESHOLD)
                );
            });
            if (!isRepeatedRegion) {
                kept.push(detection);
            }
        }
        return kept;
    }

    private compareDetectionPriority(a: SourceDetection, b: SourceDetection): number {
        const aRawConfidence = a.rawConfidence ?? a.confidence;
        const bRawConfidence = b.rawConfidence ?? b.confidence;
        if (aRawConfidence !== bRawConfidence) {
            return bRawConfidence - aRawConfidence;
        }
        const aSize = Math.max(a.ellipsePx[2], a.ellipsePx[3]);
        const bSize = Math.max(b.ellipsePx[2], b.ellipsePx[3]);
        return bSize - aSize;
    }

    private ellipseContainsPoint(ellipse: SourceDetection["ellipsePx"], pointX: number, pointY: number, padding = 0.85): boolean {
        const [centerX, centerY, radiusX, radiusY, angleDegrees] = ellipse;
        const angle = angleDegrees * (Math.PI / 180);
        const cosAngle = Math.cos(angle);
        const sinAngle = Math.sin(angle);
        const deltaX = pointX - centerX;
        const deltaY = pointY - centerY;
        const rotatedX = deltaX * cosAngle + deltaY * sinAngle;
        const rotatedY = -deltaX * sinAngle + deltaY * cosAngle;
        const normalizedX = rotatedX / Math.max(radiusX * padding, 1e-6);
        const normalizedY = rotatedY / Math.max(radiusY * padding, 1e-6);
        return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
    }

    private intersectionOverUnion(a: SourceDetection["bboxPx"], b: SourceDetection["bboxPx"]): number {
        const left = Math.max(a[0], b[0]);
        const bottom = Math.max(a[1], b[1]);
        const right = Math.min(a[0] + a[2], b[0] + b[2]);
        const top = Math.min(a[1] + a[3], b[1] + b[3]);
        const intersection = Math.max(0, right - left) * Math.max(0, top - bottom);
        const union = a[2] * a[3] + b[2] * b[3] - intersection;
        return union > 0 ? intersection / union : 0;
    }

    private trimCache() {
        while (this.resultCache.size > 32) {
            const oldestKey = this.resultCache.keys().next().value;
            if (oldestKey === undefined) {
                break;
            }
            this.resultCache.delete(oldestKey);
        }
    }
}
