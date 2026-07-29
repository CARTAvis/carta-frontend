import * as ort from "onnxruntime-web";

import {type FrameStore} from "stores/Frame";

import {type RawRasterROI, TileService} from "./TileService";

const MODEL_SIZE = 640;
const RAW_CANDIDATE_THRESHOLD = 0.0001;
const NMS_IOU_THRESHOLD = 0.45;
const RAW_CONFIDENCE_KEEP_PRIORITY = 0.9;
const HIGH_RAW_NMS_IOU_THRESHOLD = 0.65;
const MAX_ONNX_CANDIDATES = 1000;
const MAX_DISPLAY_DETECTIONS = 20;
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
        const detectionsWithFits = this.parseOutput(output, roi).map(detection => this.applyCosmosPostProcessing(detection, roi));
        const extendedRegions = this.detectExtendedSources(tensorData.subarray(0, MODEL_SIZE * MODEL_SIZE), roi);
        const maximumPeakFlux = detectionsWithFits.reduce((maximum, detection) => Math.max(maximum, detection.peakFlux), 0);
        const minimumPeakFlux = maximumPeakFlux * 0.0001;
        const fluxFiltered = detectionsWithFits.filter(detection => detection.peakFlux >= minimumPeakFlux);
        // The original detector's extended-region pass consolidates repeated
        // proposals belonging to the same connected source. Its display path
        // then ranks proposals by fitted peak flux. Keep one such
        // representative per region instead of globally rejecting a real,
        // extended source merely because its raw ONNX confidence is low.
        const regionFiltered = this.selectRegionRepresentatives(fluxFiltered, extendedRegions);
        // Ported from Source-detection commit bf5daae ("remove overlap"):
        // first remove smaller sources contained by an equally/more confident
        // parent, then suppress candidates whose fitted ellipse centres overlap.
        const containmentFiltered = this.suppressInsideLargeConfident(regionFiltered);
        const overlapFiltered = this.suppressCenterOverlaps(containmentFiltered);
        const detections = overlapFiltered.sort((a, b) => b.peakFlux - a.peakFlux).slice(0, MAX_DISPLAY_DETECTIONS);
        console.info(
            `[SourceDetection] Post-processing fitted=${detectionsWithFits.length}, flux=${fluxFiltered.length}, regions=${extendedRegions.length}, representatives=${regionFiltered.length}, containment=${containmentFiltered.length}, overlap=${overlapFiltered.length}, displayed=${detections.length}`
        );
        console.debug(
            `[SourceDetection] Displayed candidates ${JSON.stringify(
                detections.map(detection => ({
                    center: detection.ellipsePx.slice(0, 2).map(value => Number(value.toFixed(1))),
                    radii: detection.ellipsePx.slice(2, 4).map(value => Number(value.toFixed(1))),
                    rawConfidence: Number((detection.rawConfidence ?? 0).toFixed(5)),
                    confidence: Number(detection.confidence.toFixed(3)),
                    peakFlux: Number(detection.peakFlux.toPrecision(4))
                }))
            )}`
        );
        this.resultCache.set(cacheKey, detections);
        this.trimCache();
        return {cacheKey, detections};
    }

    /**
     * Uses the connected regions produced by the original
     * OnnxDetector.detectExtendedSources pass to consolidate repeated ONNX
     * boxes. The original display path ranks detections by fitted peak flux,
     * so the brightest fitted proposal becomes the region representative.
     */
    private selectRegionRepresentatives(detections: SourceDetection[], regions: SourceDetection[]): SourceDetection[] {
        if (!regions.length) {
            return detections;
        }

        const representatives: SourceDetection[] = [];
        for (const region of regions) {
            const candidates = detections.filter(detection => this.ellipseContainsPoint(region.ellipsePx, detection.ellipsePx[0], detection.ellipsePx[1], 1.05)).sort((a, b) => b.peakFlux - a.peakFlux || this.compareDetectionPriority(a, b));
            if (candidates.length && !representatives.includes(candidates[0])) {
                representatives.push(candidates[0]);
            }
        }
        return representatives.length ? representatives : detections;
    }

    private getSession(): Promise<ort.InferenceSession> {
        if (!this.sessionPromise) {
            const modelUrl = new URL("models/acdc_point_galaxy.onnx", document.baseURI).toString();
            this.sessionPromise = ort.InferenceSession.create(modelUrl, {executionProviders: ["wasm"]}).then(session => {
                console.info("[SourceDetection] posh/cosmos ACDC model loaded");
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

    private prepareTensor(roi: RawRasterROI, inputChannels: number): Float32Array {
        const sampled = new Float32Array(MODEL_SIZE * MODEL_SIZE);
        const finite: number[] = [];
        for (let y = 0; y < MODEL_SIZE; y++) {
            const sourceY = Math.min(roi.height - 1, Math.floor((y / MODEL_SIZE) * roi.height));
            for (let x = 0; x < MODEL_SIZE; x++) {
                const sourceX = Math.min(roi.width - 1, Math.floor((x / MODEL_SIZE) * roi.width));
                const value = roi.data[sourceY * roi.width + sourceX];
                sampled[y * MODEL_SIZE + x] = value;
                if (Number.isFinite(value)) {
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
            const normalized = !Number.isFinite(raw) || raw < floor ? 0 : Math.max(0, Math.min(1, (raw - floor) / range));
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

    /**
     * Port of detector.ts detectExtendedROI. It finds connected components in
     * the normalized scientific ROI and measures their intensity moments.
     */
    private detectExtendedSources(plane: Float32Array, roi: RawRasterROI): SourceDetection[] {
        const finite = Array.from(plane)
            .filter(value => Number.isFinite(value) && value > 0)
            .sort((a, b) => a - b);
        if (!finite.length) {
            return [];
        }

        const quantiles = [0.985, 0.975, 0.95, 0.9, 0.85];
        const background = finite[Math.floor(finite.length * 0.5)];
        const candidates: SourceDetection[] = [];
        for (const quantile of quantiles) {
            const threshold = finite[Math.floor((finite.length - 1) * quantile)];
            const seen = new Uint8Array(MODEL_SIZE * MODEL_SIZE);
            for (let y = 1; y < MODEL_SIZE - 1; y++) {
                for (let x = 1; x < MODEL_SIZE - 1; x++) {
                    const start = y * MODEL_SIZE + x;
                    if (seen[start] || plane[start] < threshold) {
                        continue;
                    }

                    const stack = [start];
                    const points: number[] = [];
                    seen[start] = 1;
                    while (stack.length) {
                        const index = stack.pop();
                        if (index === undefined) {
                            continue;
                        }
                        points.push(index);
                        const currentX = index % MODEL_SIZE;
                        const currentY = Math.floor(index / MODEL_SIZE);
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dx === 0 && dy === 0) {
                                    continue;
                                }
                                const nextX = currentX + dx;
                                const nextY = currentY + dy;
                                if (nextX < 1 || nextX >= MODEL_SIZE - 1 || nextY < 1 || nextY >= MODEL_SIZE - 1) {
                                    continue;
                                }
                                const nextIndex = nextY * MODEL_SIZE + nextX;
                                if (!seen[nextIndex] && plane[nextIndex] >= threshold) {
                                    seen[nextIndex] = 1;
                                    stack.push(nextIndex);
                                }
                            }
                        }
                    }
                    if (points.length < 30) {
                        continue;
                    }

                    let sumIntensity = 0;
                    let sumX = 0;
                    let sumY = 0;
                    let sumXX = 0;
                    let sumYY = 0;
                    let sumXY = 0;
                    for (const index of points) {
                        const pointX = index % MODEL_SIZE;
                        const pointY = Math.floor(index / MODEL_SIZE);
                        const intensity = Math.max(0, plane[index] - Math.min(background, threshold));
                        sumIntensity += intensity;
                        sumX += intensity * pointX;
                        sumY += intensity * pointY;
                        sumXX += intensity * pointX * pointX;
                        sumYY += intensity * pointY * pointY;
                        sumXY += intensity * pointX * pointY;
                    }
                    if (sumIntensity <= 0) {
                        continue;
                    }

                    const centerX = sumX / sumIntensity;
                    const centerY = sumY / sumIntensity;
                    const varianceX = Math.max(0, sumXX / sumIntensity - centerX * centerX);
                    const varianceY = Math.max(0, sumYY / sumIntensity - centerY * centerY);
                    const covarianceXY = sumXY / sumIntensity - centerX * centerY;
                    const discriminant = Math.sqrt(Math.max(0, ((varianceX - varianceY) / 2) ** 2 + covarianceXY ** 2));
                    const sigmaMajor = Math.sqrt(Math.max((varianceX + varianceY) / 2 + discriminant, 0.25));
                    const sigmaMinor = Math.sqrt(Math.max((varianceX + varianceY) / 2 - discriminant, 0.04));
                    const imageCenterX = roi.xMin + (centerX / MODEL_SIZE) * roi.imageWidth;
                    const imageCenterY = roi.yMin + (centerY / MODEL_SIZE) * roi.imageHeight;
                    const radiusX = Math.max(4, (sigmaMajor * 3.2 * roi.imageWidth) / MODEL_SIZE);
                    const radiusY = Math.max(4, (sigmaMinor * 3.2 * roi.imageHeight) / MODEL_SIZE);
                    candidates.push({
                        id: `extended:${quantile}:${imageCenterX.toFixed(1)}:${imageCenterY.toFixed(1)}`,
                        classId: 1,
                        className: "galaxy",
                        confidence: Math.min(0.99, 0.5 + points.length / (MODEL_SIZE * MODEL_SIZE * 0.02)),
                        bboxPx: [imageCenterX - radiusX, imageCenterY - radiusY, radiusX * 2, radiusY * 2],
                        ellipsePx: [imageCenterX, imageCenterY, radiusX, radiusY, 0],
                        peakFlux: 0
                    });
                }
            }
        }

        const consolidated: SourceDetection[] = [];
        const minimumMajor = Math.max(24, Math.min(roi.imageWidth, roi.imageHeight) * 0.08);
        const bySize = candidates.filter(candidate => Math.max(candidate.bboxPx[2], candidate.bboxPx[3]) >= minimumMajor).sort((a, b) => Math.max(b.bboxPx[2], b.bboxPx[3]) - Math.max(a.bboxPx[2], a.bboxPx[3]));
        for (const candidate of bySize) {
            const centerX = candidate.bboxPx[0] + candidate.bboxPx[2] / 2;
            const centerY = candidate.bboxPx[1] + candidate.bboxPx[3] / 2;
            const isDuplicate = consolidated.some(existing => {
                const hasContainedCenter = centerX >= existing.bboxPx[0] && centerX <= existing.bboxPx[0] + existing.bboxPx[2] && centerY >= existing.bboxPx[1] && centerY <= existing.bboxPx[1] + existing.bboxPx[3];
                return hasContainedCenter || this.intersectionOverUnion(existing.bboxPx, candidate.bboxPx) > 0.35;
            });
            if (!isDuplicate) {
                const className = consolidated.length === 0 ? "galaxy" : "diffuse";
                consolidated.push({...candidate, className});
            }
            if (consolidated.length >= 12) {
                break;
            }
        }
        console.info(`[SourceDetection] Extended components=${consolidated.length}`);
        return consolidated;
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

    private applyCosmosPostProcessing(detection: SourceDetection, roi: RawRasterROI): SourceDetection {
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
                    backgroundSamples.push(roi.data[y * roi.width + x]);
                }
            }
        }
        backgroundSamples.sort((a, b) => a - b);
        const localBackground = backgroundSamples.length ? backgroundSamples[Math.floor(backgroundSamples.length / 2)] : 0;
        let maximumSignal = 0;
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                maximumSignal = Math.max(maximumSignal, roi.data[y * roi.width + x] - localBackground);
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
                    const signal = roi.data[y * roi.width + x] - localBackground;
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
                confidence: this.calibrateDisplayConfidence(detection.confidence)
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
            peakFlux
        };
    }

    /** Port of Source-detection/src/main.ts suppressInsideLargeConfident. */
    private suppressInsideLargeConfident(detections: SourceDetection[]): SourceDetection[] {
        return detections.filter(detection => {
            const [centerX, centerY, radiusX, radiusY] = detection.ellipsePx;
            const major = Math.max(radiusX, radiusY);
            const rawConfidence = detection.rawConfidence ?? detection.confidence ?? 0;
            return !detections.some(parent => {
                if (parent === detection) {
                    return false;
                }
                const parentMajor = Math.max(parent.ellipsePx[2], parent.ellipsePx[3]);
                const parentRawConfidence = parent.rawConfidence ?? parent.confidence ?? 0;
                return parentMajor > major && parentRawConfidence >= rawConfidence && this.ellipseContainsPoint(parent.ellipsePx, centerX, centerY);
            });
        });
    }

    /** Port of Source-detection/src/main.ts suppressCenterOverlaps. */
    private suppressCenterOverlaps(detections: SourceDetection[]): SourceDetection[] {
        const kept: SourceDetection[] = [];
        const sorted = [...detections].sort((a, b) => this.compareDetectionPriority(a, b));
        for (const detection of sorted) {
            if (kept.some(parent => this.detectionsShareCenterOverlap(parent, detection))) {
                continue;
            }
            kept.push(detection);
        }
        return kept;
    }

    private detectionsShareCenterOverlap(a: SourceDetection, b: SourceDetection): boolean {
        const [aCenterX, aCenterY] = a.ellipsePx;
        const [bCenterX, bCenterY] = b.ellipsePx;
        return this.ellipseContainsPoint(a.ellipsePx, bCenterX, bCenterY) || this.ellipseContainsPoint(b.ellipsePx, aCenterX, aCenterY);
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

    private compareDetectionPriority(a: SourceDetection, b: SourceDetection): number {
        const aRawConfidence = a.rawConfidence ?? a.confidence ?? 0;
        const bRawConfidence = b.rawConfidence ?? b.confidence ?? 0;
        if (aRawConfidence !== bRawConfidence) {
            return bRawConfidence - aRawConfidence;
        }
        const aSize = Math.max(a.ellipsePx[2], a.ellipsePx[3]);
        const bSize = Math.max(b.ellipsePx[2], b.ellipsePx[3]);
        if (Math.abs(aSize - bSize) > 1e-6) {
            return bSize - aSize;
        }
        return (b.confidence ?? 0) - (a.confidence ?? 0);
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
