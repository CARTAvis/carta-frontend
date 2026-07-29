import * as React from "react";
import {type IReactionDisposer, makeObservable, observable, reaction} from "mobx";
import {observer} from "mobx-react";
import {type Subscription} from "rxjs";

import {type SourceDetection, SourceDetectionService, TileService} from "services";
import {AppStore} from "stores";
import {type FrameStore} from "stores/Frame";

import "./SourceDetectionOverlayComponent.scss";

interface SourceDetectionOverlayComponentProps {
    frame: FrameStore;
    width: number;
    height: number;
    top: number;
    left: number;
}

const DETECTION_DEBOUNCE_MS = 350;

@observer
export class SourceDetectionOverlayComponent extends React.Component<SourceDetectionOverlayComponentProps> {
    @observable.ref private detections: SourceDetection[] = [];
    @observable private isDetecting = false;

    private canvas: HTMLCanvasElement | null = null;
    private debounceHandle: ReturnType<typeof setTimeout> | undefined;
    private watchdogHandle: ReturnType<typeof setInterval> | undefined;
    private requestGeneration = 0;
    private rawTileRetryCount = 0;
    private shouldRerun = false;
    private lastCompletedCacheKey: string | undefined;
    private frameDisposer: IReactionDisposer | undefined;
    private tileSubscription: Subscription | undefined;

    constructor(props: SourceDetectionOverlayComponentProps) {
        super(props);
        makeObservable(this);
    }

    componentDidMount() {
        AppStore.Instance.logStore.addInfo("Automatic source detection armed.", ["source-detection"]);
        this.frameDisposer = reaction(
            () => {
                const frame = this.props.frame;
                const view = frame.requiredFrameView;
                // Keep the scheduling callback outside the tracked expression.
                // Otherwise its isDetecting read becomes an autorun dependency and
                // every detection completion immediately schedules another run.
                return [frame.zoomLevel, frame.spatialReference?.zoomLevel, frame.center.x, frame.center.y, frame.channel, frame.stokes, view.xMin, view.yMin, view.xMax, view.yMax, view.mip];
            },
            this.scheduleDetection,
            {fireImmediately: true}
        );

        this.tileSubscription = TileService.Instance.tileStream.subscribe(message => {
            if (message.fileId === this.props.frame.id && message.channel === this.props.frame.channel && message.stokes === this.props.frame.stokes) {
                this.scheduleDetection();
            }
        });
        this.watchdogHandle = setInterval(() => {
            const cacheKey = SourceDetectionService.Instance.getCacheKey(this.props.frame);
            if (cacheKey !== this.lastCompletedCacheKey) {
                this.scheduleDetection();
            }
        }, 1500);
        this.drawOverlay();
    }

    componentDidUpdate() {
        this.drawOverlay();
    }

    componentWillUnmount() {
        this.requestGeneration++;
        clearTimeout(this.debounceHandle);
        clearInterval(this.watchdogHandle);
        this.frameDisposer?.();
        this.tileSubscription?.unsubscribe();
    }

    private setCanvasRef = (canvas: HTMLCanvasElement | null) => {
        this.canvas = canvas;
    };

    private scheduleDetection = () => {
        if (this.isDetecting) {
            this.shouldRerun = true;
            return;
        }
        clearTimeout(this.debounceHandle);
        const generation = ++this.requestGeneration;
        this.rawTileRetryCount = 0;

        this.debounceHandle = setTimeout(() => {
            void this.runDetection(generation);
        }, DETECTION_DEBOUNCE_MS);
    };

    private async runDetection(generation: number) {
        const frame = this.props.frame;
        const effectiveZoom = this.getEffectiveZoom(frame);
        if (generation !== this.requestGeneration) {
            return;
        }

        this.isDetecting = true;
        this.drawOverlay();
        if (this.rawTileRetryCount === 0) {
            console.info("Source-detecting...", {
                fileId: frame.id,
                channel: frame.channel,
                stokes: frame.stokes,
                zoom: effectiveZoom,
                viewport: frame.requiredFrameView
            });
            AppStore.Instance.logStore.addInfo("Source-detecting...", ["source-detection"]);
        }
        try {
            const result = await SourceDetectionService.Instance.detectVisibleSources(frame);
            if (generation !== this.requestGeneration) {
                console.info("[SourceDetection] Discarded result for a stale viewport");
                return;
            }
            if (!result) {
                console.warn("[SourceDetection] Visible raw tiles are not ready");
                if (this.rawTileRetryCount < 10) {
                    this.rawTileRetryCount++;
                    this.debounceHandle = setTimeout(() => void this.runDetection(generation), DETECTION_DEBOUNCE_MS);
                } else {
                    AppStore.Instance.logStore.addWarning("Source detection stopped: visible image tiles are not ready.", ["source-detection"]);
                }
                return;
            }
            if (result.cacheKey !== SourceDetectionService.Instance.getCacheKey(frame)) {
                console.info("[SourceDetection] Discarded result because the viewport changed");
                return;
            }
            this.detections = result.detections;
            this.lastCompletedCacheKey = result.cacheKey;
            console.info(`[SourceDetection] Selected ${result.detections.length} source(s)`);
            AppStore.Instance.logStore.addInfo(`Source detection selected ${result.detections.length} source(s).`, ["source-detection"]);
        } catch (error) {
            if (generation === this.requestGeneration) {
                console.error("[SourceDetection] Inference failed", error);
                AppStore.Instance.logStore.addError(`Source detection failed: ${error instanceof Error ? error.message : String(error)}`, ["source-detection"]);
                this.detections = [];
            }
        } finally {
            if (generation === this.requestGeneration) {
                this.isDetecting = false;
                // The canvas is drawn imperatively, and render() does not read
                // detections or isDetecting. Redraw explicitly when inference
                // completes so new results become visible.
                this.drawOverlay();
                if (this.shouldRerun) {
                    this.shouldRerun = false;
                    this.scheduleDetection();
                }
            }
        }
    }

    private getEffectiveZoom = (frame: FrameStore) => {
        return frame.spatialReference?.zoomLevel ?? frame.zoomLevel;
    };

    private drawOverlay = () => {
        const canvas = this.canvas;
        if (!canvas) {
            return;
        }

        const {frame, width, height} = this.props;
        const pixelRatio = AppStore.Instance.pixelRatio;
        const canvasWidth = Math.max(1, Math.round(width * pixelRatio));
        const canvasHeight = Math.max(1, Math.round(height * pixelRatio));
        if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
        }

        const context = canvas.getContext("2d");
        if (!context) {
            return;
        }
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.save();
        context.scale(pixelRatio, pixelRatio);

        const view = frame.requiredFrameView;
        const scaleX = width / (view.xMax - view.xMin);
        const scaleY = height / (view.yMax - view.yMin);
        context.lineWidth = 1.5;
        context.font = "11px sans-serif";
        context.textBaseline = "bottom";

        for (let index = 0; index < this.detections.length; index++) {
            const detection = this.detections[index];
            const [imageCenterX, imageCenterY, imageRadiusX, imageRadiusY, angleDegrees] = detection.ellipsePx;
            const centerX = (imageCenterX - view.xMin) * scaleX;
            const centerY = (view.yMax - imageCenterY) * scaleY;
            const radiusX = imageRadiusX * scaleX;
            const radiusY = imageRadiusY * scaleY;
            if (centerX + radiusX < 0 || centerY + radiusY < 0 || centerX - radiusX > width || centerY - radiusY > height) {
                continue;
            }

            const color = detection.className === "galaxy" ? "#22c55e" : "#00e5ff";
            context.strokeStyle = color;
            context.fillStyle = color;
            context.save();
            context.translate(centerX, centerY);
            context.rotate((-angleDegrees * Math.PI) / 180);
            context.beginPath();
            context.ellipse(0, 0, Math.max(radiusX, 2), Math.max(radiusY, 2), 0, 0, Math.PI * 2);
            context.stroke();
            context.restore();
            context.fillText(detection.className, centerX + Math.max(radiusX, 4) + 2, centerY + 4);
        }

        if (this.isDetecting) {
            context.fillStyle = "rgba(0, 0, 0, 0.65)";
            context.fillRect(8, 8, 92, 22);
            context.fillStyle = "#ffffff";
            context.textBaseline = "middle";
            context.fillText("Detecting…", 16, 19);
        }
        context.restore();
    };

    render() {
        const {width, height, top, left} = this.props;
        return <canvas ref={this.setCanvasRef} className="source-detection-overlay" style={{width, height, top, left}} />;
    }
}
