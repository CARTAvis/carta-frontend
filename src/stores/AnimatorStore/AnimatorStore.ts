import {CARTA} from "carta-protobuf";
import {action, computed, flow, makeObservable, observable} from "mobx";

import {AnimationMode, PlayMode} from "enums";
import {type FrameView, getNextPlaybackState, type PlaybackDirection, type Point2D} from "models";
import {AppStore, PreferenceStore, TimeSeriesStore} from "stores";
import {type FrameStore} from "stores/Frame";
import {clamp, GetRequiredTiles, getTransformedChannelList, mapToObject} from "utilities";

type AnimationFrames = {
    startFrame: CARTA.AnimationFrame.$Properties;
    firstFrame: CARTA.AnimationFrame.$Properties;
    lastFrame: CARTA.AnimationFrame.$Properties;
    deltaFrame: CARTA.AnimationFrame.$Properties;
};

export class AnimatorStore {
    private static staticInstance: AnimatorStore;

    public static get Instance() {
        if (!AnimatorStore.staticInstance) {
            AnimatorStore.staticInstance = new AnimatorStore();
        }
        return AnimatorStore.staticInstance;
    }

    @observable frameRate: number = 5;
    @observable maxFrameRate: number = 15;
    @observable minFrameRate: number = 1;
    @observable step: number = 1;
    @observable maxStep: number = 50;
    @observable minStep: number = 1;
    @observable animationMode: AnimationMode = AnimationMode.CHANNEL;
    @observable isAnimationActive: boolean = false;
    @observable playMode: PlayMode = PlayMode.FORWARD;

    private get isFrontendAnimationMode(): boolean {
        return this.animationMode === AnimationMode.FRAME || this.animationMode === AnimationMode.TIME;
    }

    @action setAnimationMode = (val: AnimationMode) => {
        // Prevent animation mode changes during playback
        if (this.isAnimationActive) {
            return;
        }

        if (val === AnimationMode.TIME) {
            const timeSeriesStore = TimeSeriesStore.Instance;
            if (timeSeriesStore.elements.length < 2) {
                return;
            }
            timeSeriesStore.ensureActiveElement();
        }
        this.animationMode = val;
    };

    /** Selects the first available Animator control, following the order shown in the widget. */
    @action selectFirstAvailableAnimationMode = (excludedModes: readonly AnimationMode[] = []): boolean => {
        if (this.isAnimationActive) {
            return false;
        }

        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const fileInfo = frame?.frameInfo.fileInfoExtended;
        const candidates = [
            {mode: AnimationMode.FRAME, isAvailable: appStore.imageViewConfigStore.imageNum > 1 && appStore.activeImageIndex !== -1},
            {mode: AnimationMode.CHANNEL, isAvailable: (fileInfo?.depth ?? 0) > 1},
            {mode: AnimationMode.STOKES, isAvailable: (fileInfo?.stokes ?? 0) > 1},
            {mode: AnimationMode.TIME, isAvailable: TimeSeriesStore.Instance.elements.length > 1}
        ];
        const candidate = candidates.find(({mode, isAvailable}) => isAvailable && !excludedModes.includes(mode));
        if (!candidate) {
            this.animationMode = AnimationMode.NONE;
            return false;
        }

        this.setAnimationMode(candidate.mode);
        return this.animationMode === candidate.mode;
    };

    @action setFrameRate = (val: number) => {
        this.frameRate = val;
    };

    @action setStep = (val: number) => {
        this.step = val;
    };

    @flow.bound *startAnimation() {
        if (this.shouldStartAnimationDisable) {
            return;
        }

        const appStore = AppStore.Instance;
        const preferenceStore = PreferenceStore.Instance;
        const activeFrame = appStore.activeFrame;

        if (this.isFrontendAnimationMode) {
            if (this.animateHandle !== undefined) {
                clearInterval(this.animateHandle);
                this.animateHandle = undefined;
            }
            this.animationDirection = 1;
            this.isAnimationActive = true;
            this.animate();
            this.animateHandle = setInterval(this.animate, this.frameInterval);
            return;
        }

        if (!activeFrame) {
            console.warn("No active frame to start animation.");
            return;
        }

        const animationFrames = this.genAnimationFrames(activeFrame);
        if (!animationFrames) {
            return;
        }
        // Calculate new required frame view (cropped to file size)
        const reqView = activeFrame.requiredFrameView;

        const croppedReq: FrameView = {
            xMin: Math.max(-0.5, reqView.xMin),
            xMax: Math.min(activeFrame.frameInfo.fileInfoExtended.width - 0.5, reqView.xMax),
            yMin: Math.max(-0.5, reqView.yMin),
            yMax: Math.min(activeFrame.frameInfo.fileInfoExtended.height - 0.5, reqView.yMax),
            mip: reqView.mip
        };
        const imageSize: Point2D = {x: activeFrame.frameInfo.fileInfoExtended.width, y: activeFrame.frameInfo.fileInfoExtended.height};
        const tiles = GetRequiredTiles(croppedReq, imageSize, {x: 256, y: 256}).map(tile => tile.encode());
        const requiredTiles: CARTA.AddRequiredTiles.$Properties = {
            fileId: activeFrame.frameInfo.fileId,
            tiles: tiles,
            compressionType: CARTA.CompressionType.ZFP,
            compressionQuality: preferenceStore.animationCompressionQuality
        };

        // Calculate matched frames for the animation range
        const matchedFrames = new Map<number, CARTA.MatchedFrameList.$Properties>();
        for (const sibling of activeFrame.spectralSiblings) {
            const firstChannel = animationFrames.firstFrame.channel ?? 0;
            const lastChannel = animationFrames.lastFrame.channel ?? 0;
            const frameNumbers = getTransformedChannelList(activeFrame.wcsInfo3D, sibling.wcsInfo3D, appStore.spectralMatchingType, firstChannel, lastChannel);
            matchedFrames.set(sibling.frameInfo.fileId, {frameNumbers});
        }

        const animationMessage: CARTA.StartAnimation.$Properties = {
            fileId: activeFrame.frameInfo.fileId,
            startFrame: animationFrames.startFrame,
            firstFrame: animationFrames.firstFrame,
            lastFrame: animationFrames.lastFrame,
            deltaFrame: animationFrames.deltaFrame,
            requiredTiles: requiredTiles,
            looping: true,
            reverse: this.playMode === PlayMode.BOUNCING,
            frameRate: this.frameRate,
            matchedFrames: mapToObject(matchedFrames),
            stokesIndices: activeFrame.polarizations.map((polarization, i) => {
                return i < activeFrame.frameInfo.fileInfoExtended.stokes && i >= 0 ? i : polarization;
            })
        };

        this.isAnimationActive = true;

        try {
            yield appStore.backendService.startAnimation(animationMessage);
            appStore.tileService.setAnimationEnabled(true);
            console.log("Animation started successfully");
        } catch (err) {
            console.error(err);
            appStore.tileService.setAnimationEnabled(false);
        }
        clearTimeout(this.stopHandle);
        this.stopHandle = undefined;
        this.stopHandle = setTimeout(this.stopAnimation, 1000 * 60 * preferenceStore.stopAnimationPlaybackMinutes);
    }

    @action stopAnimation = () => {
        clearTimeout(this.stopHandle);
        this.stopHandle = undefined;

        // Ignore stop when not playing
        if (!this.isAnimationActive) {
            return;
        }

        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        if (!frame) {
            return;
        }

        this.isAnimationActive = false;
        appStore.tileService.setAnimationEnabled(false);
        if (this.isFrontendAnimationMode) {
            if (this.animateHandle !== undefined) {
                clearInterval(this.animateHandle);
                this.animateHandle = undefined;
            }
        } else {
            const endFrame: CARTA.AnimationFrame.$Properties = {
                channel: frame.channel,
                stokes: frame.stokes
            };

            const stopMessage: CARTA.StopAnimation.$Properties = {
                fileId: frame.frameInfo.fileId,
                endFrame
            };
            appStore.backendService.stopAnimation(stopMessage);

            frame.setChannels(frame.channel, frame.stokes, true);

            const updates = [{frame, channel: frame.requiredChannel, stokes: frame.requiredStokes}];
            // Update any sibling channels
            frame.spectralSiblings.forEach(siblingFrame => {
                updates.push({frame: siblingFrame, channel: siblingFrame.requiredChannel, stokes: siblingFrame.requiredStokes});
            });
            appStore.updateChannels(updates);
        }
    };

    @action animate = () => {
        if (!this.isAnimationActive) {
            return;
        }
        if (this.animationMode === AnimationMode.FRAME) {
            const appStore = AppStore.Instance;
            const nextState = getNextPlaybackState(appStore.activeImageIndex, appStore.imageViewConfigStore.imageNum, this.step, this.playMode, this.animationDirection);
            this.animationDirection = nextState.direction;
            appStore.setActiveImageByIndex(nextState.index);
        } else if (this.animationMode === AnimationMode.TIME) {
            const timeSeriesStore = TimeSeriesStore.Instance;
            const nextState = getNextPlaybackState(timeSeriesStore.currentIndex, timeSeriesStore.elements.length, this.step, this.playMode, this.animationDirection);
            this.animationDirection = nextState.direction;
            timeSeriesStore.setIndex(nextState.index);
        }
    };

    private animateHandle: ReturnType<typeof setInterval> | undefined;
    private stopHandle: ReturnType<typeof setTimeout> | undefined;
    private animationDirection: PlaybackDirection = 1;

    constructor() {
        makeObservable(this);
        this.animateHandle = undefined;
        this.stopHandle = undefined;
    }

    @computed get frameInterval() {
        return 1000.0 / clamp(this.frameRate, this.minFrameRate, this.maxFrameRate);
    }

    @computed get isServerAnimationActive() {
        return this.isAnimationActive && !this.isFrontendAnimationMode;
    }

    /** Whether the animation feature should be disabled. It is disabled when no image is loaded or only one animation step is available, e.g., animating channels of a 2D image. */
    @computed get shouldStartAnimationDisable() {
        const frame = AppStore.Instance.activeFrame;
        if (!frame || this.animationMode === AnimationMode.NONE) {
            return true;
        }

        if (this.animationMode === AnimationMode.FRAME && (frame.isPreview || AppStore.Instance.imageViewConfigStore.imageNum <= 1)) {
            return true;
        }

        if (this.animationMode === AnimationMode.CHANNEL && frame.frameInfo.fileInfoExtended.depth <= 1) {
            return true;
        }

        if (this.animationMode === AnimationMode.STOKES && frame.frameInfo.fileInfoExtended.stokes <= 1) {
            return true;
        }

        if (this.animationMode === AnimationMode.TIME && TimeSeriesStore.Instance.elements.length <= 1) {
            return true;
        }

        return false;
    }

    private genAnimationFrames = (frame: FrameStore): AnimationFrames | undefined => {
        const startFrame: CARTA.AnimationFrame.$Properties = {
            channel: frame.channel,
            stokes: frame.requiredPolarizationIndex
        };
        let firstFrame: CARTA.AnimationFrame.$Properties;
        let lastFrame: CARTA.AnimationFrame.$Properties;
        let deltaFrame: CARTA.AnimationFrame.$Properties;
        let valueKey: "channel" | "stokes";

        if (this.animationMode === AnimationMode.CHANNEL) {
            valueKey = "channel";
            firstFrame = {
                channel: frame.animationChannelRange[0],
                stokes: frame.requiredPolarizationIndex
            };
            lastFrame = {
                channel: frame.animationChannelRange[1],
                stokes: frame.requiredPolarizationIndex
            };
            deltaFrame = {
                channel: this.step,
                stokes: 0
            };
        } else if (this.animationMode === AnimationMode.STOKES) {
            valueKey = "stokes";
            firstFrame = {
                channel: frame.channel,
                stokes: 0
            };
            lastFrame = {
                channel: frame.channel,
                stokes: frame.polarizations.length - 1
            };
            deltaFrame = {
                channel: 0,
                stokes: this.step
            };
        } else {
            return undefined;
        }

        const getFrameValue = (animationFrame: CARTA.AnimationFrame.$Properties): number | null | undefined => animationFrame[valueKey];
        const setFrameValue = (animationFrame: CARTA.AnimationFrame.$Properties, value: number): void => {
            animationFrame[valueKey] = value;
        };
        const startValue = getFrameValue(startFrame);
        const firstValue = getFrameValue(firstFrame);
        const lastValue = getFrameValue(lastFrame);
        if (startValue === undefined || startValue === null || firstValue === undefined || firstValue === null || lastValue === undefined || lastValue === null) {
            return undefined;
        }

        switch (this.playMode) {
            case PlayMode.FORWARD:
            case PlayMode.BOUNCING:
            default:
                if (startValue < firstValue || startValue > lastValue) {
                    setFrameValue(startFrame, firstValue);
                }
                break;
            case PlayMode.BACKWARD:
                if (startValue < firstValue || startValue > lastValue) {
                    setFrameValue(startFrame, lastValue);
                }
                setFrameValue(deltaFrame, -this.step);
                break;
            case PlayMode.BLINK:
                setFrameValue(startFrame, firstValue);
                setFrameValue(deltaFrame, Math.abs(firstValue - lastValue));
                break;
        }

        return {startFrame, firstFrame, lastFrame, deltaFrame};
    };
}
