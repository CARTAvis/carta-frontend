import {CARTA} from "carta-protobuf";
import {action, computed, flow, makeObservable, observable} from "mobx";

import {FrameView, Point2D} from "models";
import {AppStore, PreferenceStore} from "stores";
import {FrameStore} from "stores/Frame";
import {clamp, GetRequiredTiles, getTransformedChannelList, mapToObject} from "utilities";

export enum AnimationMode {
    CHANNEL = 0,
    STOKES = 1,
    FRAME = 2
}

export enum PlayMode {
    FORWARD = 0,
    BACKWARD = 1,
    BOUNCING = 2,
    BLINK = 3
}

export class AnimatorStore {
    private static staticInstance: AnimatorStore;

    static get Instance() {
        if (!AnimatorStore.staticInstance) {
            AnimatorStore.staticInstance = new AnimatorStore();
        }
        return AnimatorStore.staticInstance;
    }

    @observable frameRate: number;
    @observable maxFrameRate: number;
    @observable minFrameRate: number;
    @observable step: number;
    @observable maxStep: number;
    @observable minStep: number;
    @observable animationMode: AnimationMode;
    @observable animationActive: boolean;
    @observable playMode: PlayMode;

    @action setAnimationMode = (val: AnimationMode) => {
        // Prevent animation mode changes during playback
        if (this.animationActive) {
            return;
        }
        this.animationMode = val;
    };

    @action setFrameRate = (val: number) => {
        this.frameRate = val;
    };

    @action setStep = (val: number) => {
        this.step = val;
    };

    @flow.bound *startAnimation() {
        const appStore = AppStore.Instance;
        const preferenceStore = PreferenceStore.Instance;
        const frame = appStore.activeFrame;
        if (!frame) {
            return;
        }

        if (this.animationMode === AnimationMode.FRAME) {
            clearInterval(this.animateHandle);
            this.animationActive = true;
            this.animate();
            this.animateHandle = setInterval(this.animate, this.frameInterval);
            return;
        }

        const animationFrames = this.genAnimationFrames(frame);
        if (!animationFrames) {
            return;
        }
        // Calculate new required frame view (cropped to file size)
        const reqView = frame.requiredFrameView;

        const croppedReq: FrameView = {
            xMin: Math.max(0, reqView.xMin),
            xMax: Math.min(frame.frameInfo.fileInfoExtended.width, reqView.xMax),
            yMin: Math.max(0, reqView.yMin),
            yMax: Math.min(frame.frameInfo.fileInfoExtended.height, reqView.yMax),
            mip: reqView.mip
        };
        const imageSize: Point2D = {x: frame.frameInfo.fileInfoExtended.width, y: frame.frameInfo.fileInfoExtended.height};
        const tiles = GetRequiredTiles(croppedReq, imageSize, {x: 256, y: 256}).map(tile => tile.encode());
        const requiredTiles: CARTA.IAddRequiredTiles = {
            fileId: frame.frameInfo.fileId,
            tiles: tiles,
            compressionType: CARTA.CompressionType.ZFP,
            compressionQuality: preferenceStore.animationCompressionQuality
        };

        // Calculate matched frames for the animation range
        const matchedFrames = new Map<number, CARTA.IMatchedFrameList>();
        for (const sibling of frame.spectralSiblings) {
            const frameNumbers = getTransformedChannelList(frame.wcsInfo3D, sibling.wcsInfo3D, appStore.spectralMatchingType, animationFrames.firstFrame.channel, animationFrames.lastFrame.channel);
            matchedFrames.set(sibling.frameInfo.fileId, {frameNumbers});
        }

        const animationMessage: CARTA.IStartAnimation = {
            fileId: frame.frameInfo.fileId,
            startFrame: animationFrames.startFrame,
            firstFrame: animationFrames.firstFrame,
            lastFrame: animationFrames.lastFrame,
            deltaFrame: animationFrames.deltaFrame,
            requiredTiles: requiredTiles,
            looping: true,
            reverse: this.playMode === PlayMode.BOUNCING,
            frameRate: this.frameRate,
            matchedFrames: mapToObject(matchedFrames),
            stokesIndices: frame.polarizations.map((polarization, i) => {
                return i < frame.frameInfo.fileInfoExtended.stokes && i >= 0 ? i : polarization;
            })
        };

        this.animationActive = true;

        try {
            yield appStore.backendService.startAnimation(animationMessage);
            appStore.tileService.setAnimationEnabled(true);
            console.log("Animation started successfully");
        } catch (err) {
            console.log(err);
            appStore.tileService.setAnimationEnabled(false);
        }

        clearTimeout(this.stopHandle);
        this.stopHandle = setTimeout(this.stopAnimation, 1000 * 60 * preferenceStore.stopAnimationPlaybackMinutes);
    }

    @action stopAnimation = () => {
        // Ignore stop when not playing
        if (!this.animationActive) {
            return;
        }

        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        if (!frame) {
            return;
        }

        this.animationActive = false;
        appStore.tileService.setAnimationEnabled(false);

        if (this.animationMode === AnimationMode.FRAME) {
            clearInterval(this.animateHandle);
        } else {
            const endFrame: CARTA.IAnimationFrame = {
                channel: frame.channel,
                stokes: frame.stokes
            };

            const stopMessage: CARTA.IStopAnimation = {
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
        if (this.animationActive && this.animationMode === AnimationMode.FRAME) {
            AppStore.Instance.nextFrame();
        }
    };

    private animateHandle;
    private stopHandle;

    constructor() {
        makeObservable(this);
        this.frameRate = 5;
        this.maxFrameRate = 15;
        this.minFrameRate = 1;
        this.step = 1;
        this.maxStep = 50;
        this.minStep = 1;
        this.animationMode = AnimationMode.CHANNEL;
        this.animationActive = false;
        this.animateHandle = null;
        this.playMode = PlayMode.FORWARD;
    }

    @computed get frameInterval() {
        return 1000.0 / clamp(this.frameRate, this.minFrameRate, this.maxFrameRate);
    }

    @computed get serverAnimationActive() {
        return this.animationActive && this.animationMode !== AnimationMode.FRAME;
    }

    private genAnimationFrames = (
        frame: FrameStore
    ): {
        startFrame: CARTA.IAnimationFrame;
        firstFrame: CARTA.IAnimationFrame;
        lastFrame: CARTA.IAnimationFrame;
        deltaFrame: CARTA.IAnimationFrame;
    } => {
        if (!frame) {
            return null;
        }

        let startFrame: CARTA.IAnimationFrame = {
            channel: frame.channel,
            stokes: frame.requiredPolarizationIndex
        };
        let firstFrame: CARTA.IAnimationFrame, lastFrame: CARTA.IAnimationFrame, deltaFrame: CARTA.IAnimationFrame;

        if (this.animationMode === AnimationMode.CHANNEL) {
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
        }

        // determine start frame & delta
        switch (this.playMode) {
            case PlayMode.FORWARD:
            case PlayMode.BOUNCING:
            default:
                if (this.animationMode === AnimationMode.CHANNEL) {
                    if (startFrame.channel < firstFrame.channel || startFrame.channel > lastFrame.channel) {
                        startFrame.channel = firstFrame.channel;
                    }
                } else if (this.animationMode === AnimationMode.STOKES) {
                    if (startFrame.stokes < firstFrame.stokes || startFrame.stokes > lastFrame.stokes) {
                        startFrame.stokes = firstFrame.stokes;
                    }
                }
                break;
            case PlayMode.BACKWARD:
                if (this.animationMode === AnimationMode.CHANNEL) {
                    if (startFrame.channel < firstFrame.channel || startFrame.channel > lastFrame.channel) {
                        startFrame.channel = lastFrame.channel;
                    }
                    deltaFrame.channel = -1 * this.step;
                } else if (this.animationMode === AnimationMode.STOKES) {
                    if (startFrame.stokes < firstFrame.stokes || startFrame.stokes > lastFrame.stokes) {
                        startFrame.stokes = lastFrame.stokes;
                    }
                    deltaFrame.stokes = -1 * this.step;
                }
                break;
            case PlayMode.BLINK:
                if (this.animationMode === AnimationMode.CHANNEL) {
                    startFrame.channel = firstFrame.channel;
                } else if (this.animationMode === AnimationMode.STOKES) {
                    startFrame.stokes = firstFrame.stokes;
                }
                if (this.animationMode === AnimationMode.CHANNEL) {
                    deltaFrame.channel = Math.abs(firstFrame.channel - lastFrame.channel);
                } else if (this.animationMode === AnimationMode.STOKES) {
                    deltaFrame.stokes = Math.abs(firstFrame.stokes - lastFrame.stokes);
                }
                break;
        }

        return {
            startFrame: startFrame,
            firstFrame: firstFrame,
            lastFrame: lastFrame,
            deltaFrame: deltaFrame
        };
    };
}
