import {action, computed, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {AppStore, FrameStore} from "stores";
import {clamp} from "utilities";
import {FrameView} from "models";

export enum AnimationMode {
    CHANNEL = 0,
    STOKES = 1,
    FRAME = 2
}

export enum AnimationState {
    STOPPED = 0,
    PLAYING = 1
}

export enum PlayMode {
    FORWARD = 0,
    BACKWARD = 1,
    BOUNCING = 2,
    BLINK = 3
}

export class AnimatorStore {
    @observable frameRate: number;
    @observable maxFrameRate: number;
    @observable minFrameRate: number;
    @observable animationMode: AnimationMode;
    @observable animationState: AnimationState;
    @observable playMode: PlayMode;

    @action setAnimationMode = (val: AnimationMode) => {
        // Prevent animation mode changes during playback
        if (this.animationState === AnimationState.PLAYING) {
            return;
        }
        this.animationMode = val;
    };

    @action setFrameRate = (val: number) => {
        this.frameRate = val;
    };

    @action startAnimation = () => {
        const frame = this.appStore.activeFrame;
        if (!frame) {
            return;
        }

        if (this.animationMode === AnimationMode.FRAME) {
            clearInterval(this.animateHandle);
            this.animationState = AnimationState.PLAYING;
            this.animate();
            this.animateHandle = setInterval(this.animate, this.frameInterval);
            return;
        }

        const animationFrames = this.genAnimationFrames(frame);
        if (!animationFrames) {
            return;
        }

        const imageView = this.genImageView(frame);
        if (!imageView) {
            return;
        }

        const animationMessage: CARTA.IStartAnimation = {
            fileId: frame.frameInfo.fileId,
            startFrame: animationFrames.startFrame,
            firstFrame: animationFrames.firstFrame,
            lastFrame: animationFrames.lastFrame,
            deltaFrame: animationFrames.deltaFrame,
            imageView: imageView,
            looping: true,
            reverse: this.playMode === PlayMode.BOUNCING,
            frameRate: this.frameRate
        };

        this.appStore.backendService.startAnimation(animationMessage).subscribe(ack => {
            if (ack.success) {
                console.log("Animation started successfully");
            }
        });

        this.animationState = AnimationState.PLAYING;

        clearTimeout(this.stopHandle);
        this.stopHandle = setTimeout(this.stopAnimation, 1000 * 60 * this.appStore.preferenceStore.stopAnimationPlaybackMinutes);
    };

    @action stopAnimation = () => {
        const frame = this.appStore.activeFrame;
        if (!frame) {
            return;
        }

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
            this.appStore.backendService.stopAnimation(stopMessage);
        }
        this.animationState = AnimationState.STOPPED;
    };

    @action animate = () => {
        if (this.animationState === AnimationState.PLAYING && this.animationMode === AnimationMode.FRAME) {
            // Do animation
            this.appStore.nextFrame();
        }
    };

    private readonly appStore: AppStore;
    private animateHandle;
    private stopHandle;

    constructor(appStore: AppStore) {
        this.frameRate = 5;
        this.maxFrameRate = 15;
        this.minFrameRate = 1;
        this.animationMode = AnimationMode.CHANNEL;
        this.animationState = AnimationState.STOPPED;
        this.animateHandle = null;
        this.playMode = PlayMode.FORWARD;
        this.appStore = appStore;
    }

    @computed get frameInterval() {
        return 1000.0 / clamp(this.frameRate, this.minFrameRate, this.maxFrameRate);
    }

    private genAnimationFrames = (frame: FrameStore): {
        startFrame: CARTA.IAnimationFrame,
        firstFrame: CARTA.IAnimationFrame,
        lastFrame: CARTA.IAnimationFrame,
        deltaFrame: CARTA.IAnimationFrame,
    } => {
        if (!frame) {
            return null;
        }

        let startFrame: CARTA.IAnimationFrame = {
            channel: frame.channel,
            stokes: frame.stokes
        };
        let firstFrame: CARTA.IAnimationFrame, lastFrame: CARTA.IAnimationFrame, deltaFrame: CARTA.IAnimationFrame;

        if (this.animationMode === AnimationMode.CHANNEL) {
            firstFrame = {
                channel: frame.animationChannelRange[0],
                stokes: frame.stokes,
            };
            lastFrame = {
                channel: frame.animationChannelRange[1],
                stokes: frame.stokes
            };
            deltaFrame = {
                channel: 1,
                stokes: 0
            };
        } else if (this.animationMode === AnimationMode.STOKES) {
            firstFrame = {
                channel: frame.channel,
                stokes: 0,
            };
            lastFrame = {
                channel: frame.channel,
                stokes: frame.frameInfo.fileInfoExtended.stokes - 1
            };
            deltaFrame = {
                channel: 0,
                stokes: 1
            };
        }

        // determine start frame & delta
        switch (this.playMode) {
            case PlayMode.FORWARD:
            case PlayMode.BOUNCING:
            default:
                if (this.animationMode === AnimationMode.CHANNEL) {
                    startFrame.channel = Math.max((startFrame.channel + 1) % frame.frameInfo.fileInfoExtended.depth, firstFrame.channel);
                    if (startFrame.channel > lastFrame.channel) {
                        startFrame.channel = firstFrame.channel;
                    }
                } else if (this.animationMode === AnimationMode.STOKES) {
                    startFrame.stokes = Math.max((startFrame.stokes + 1) % frame.frameInfo.fileInfoExtended.depth, firstFrame.stokes);
                    if (startFrame.stokes > lastFrame.stokes) {
                        startFrame.stokes = firstFrame.stokes;
                    }
                }
                break;
            case PlayMode.BACKWARD:
                if (this.animationMode === AnimationMode.CHANNEL) {
                    startFrame.channel = Math.min((startFrame.channel - 1) % frame.frameInfo.fileInfoExtended.depth, lastFrame.channel);
                    if (startFrame.channel < firstFrame.channel) {
                        startFrame.channel = lastFrame.channel;
                    }
                    deltaFrame.channel = -1;
                } else if (this.animationMode === AnimationMode.STOKES) {
                    startFrame.stokes = Math.min((startFrame.stokes - 1) % frame.frameInfo.fileInfoExtended.depth, lastFrame.stokes);
                    if (startFrame.stokes < firstFrame.stokes) {
                        startFrame.stokes = lastFrame.stokes;
                    }
                    deltaFrame.stokes = -1;
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
            deltaFrame: deltaFrame,
        };
    };

    private genImageView = (frame: FrameStore): CARTA.ISetImageView => {
        if (!frame) {
            return null;
        }

        const reqView = frame.requiredFrameView;

        const croppedReq: FrameView = {
            xMin: Math.max(0, reqView.xMin),
            xMax: Math.min(frame.frameInfo.fileInfoExtended.width, reqView.xMax),
            yMin: Math.max(0, reqView.yMin),
            yMax: Math.min(frame.frameInfo.fileInfoExtended.height, reqView.yMax),
            mip: reqView.mip
        };

        const imageView: CARTA.ISetImageView = {
            imageBounds: {
                xMin: croppedReq.xMin,
                xMax: croppedReq.xMax,
                yMin: croppedReq.yMin,
                yMax: croppedReq.yMax
            },
            mip: croppedReq.mip,
            compressionType: CARTA.CompressionType.ZFP,
            compressionQuality: this.appStore.preferenceStore.animationCompressionQuality,
        };

        return imageView;
    };
}