import {action, computed, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {AppStore} from "./AppStore";
import {clamp} from "utilities";

export enum AnimationMode {
    CHANNEL = 0,
    STOKES = 1,
    FRAME = 2
}

export enum AnimationState {
    STOPPED = 0,
    PLAYING = 1
}

export class AnimatorStore {
    @observable frameRate: number;
    @observable maxFrameRate: number;
    @observable minFrameRate: number;
    @observable animationMode: AnimationMode;
    @observable animationState: AnimationState;
    @observable flowControlCounter: number;

    @action setAnimationMode = (val: AnimationMode) => {
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

        const startFrame: CARTA.IAnimationFrame = {
            channel: frame.channel,
            stokes: frame.stokes
        };

        let firstFrame: CARTA.IAnimationFrame, lastFrame: CARTA.IAnimationFrame, deltaFrame: CARTA.IAnimationFrame;

        if (this.animationMode === AnimationMode.CHANNEL) {
            firstFrame = {
                channel: 0,
                stokes: frame.stokes,
            };

            lastFrame = {
                channel: frame.frameInfo.fileInfoExtended.depth - 1,
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
        } else {
            // TODO: Handle file animations the old way
        }

        const animationMessage: CARTA.IStartAnimation = {
            fileId: frame.frameInfo.fileId,
            startFrame,
            firstFrame,
            lastFrame,
            deltaFrame,
            looping: true,
            reverse: false,
            compressionType: CARTA.CompressionType.ZFP,
            compressionQuality: 9,
            frameRate: this.frameRate
        };

        this.appStore.backendService.startAnimation(animationMessage).subscribe(ack => {
            if (ack.success) {
                console.log("Animation started successfully");
            }
        });

        this.animationState = AnimationState.PLAYING;
        this.flowControlCounter = 0;
    };

    @action stopAnimation = () => {
        const frame = this.appStore.activeFrame;
        if (!frame) {
            return;
        }

        const endFrame: CARTA.IAnimationFrame = {
            channel: frame.channel,
            stokes: frame.stokes
        };

        const stopMessage: CARTA.IStopAnimation = {
            fileId: frame.frameInfo.fileId,
            endFrame
        };

        this.appStore.backendService.stopAnimation(stopMessage);
        this.animationState = AnimationState.STOPPED;
    };

    @action animate = () => {
        if (this.animationState === AnimationState.PLAYING && this.animationMode === AnimationMode.FRAME) {
            // Do animation
            this.appStore.nextFrame();
        }
    };

    @action incrementFlowCounter = (fileId: number, channel: number, stokes: number) => {
        this.flowControlCounter++;
        if (this.flowControlCounter >= this.frameRate) {
            this.flowControlCounter = 0;
            this.appStore.backendService.sendAnimationFlowControl({fileId, receivedFrame: {channel, stokes}});
        }
    };

    private readonly appStore: AppStore;
    private animateHandle;

    constructor(appStore: AppStore) {
        this.frameRate = 5;
        this.maxFrameRate = 15;
        this.minFrameRate = 1;
        this.animationMode = AnimationMode.CHANNEL;
        this.animationState = AnimationState.STOPPED;
        this.flowControlCounter = 0;
        this.animateHandle = null;
        this.appStore = appStore;
    }

    @computed get frameInterval() {
        return 1000.0 / clamp(this.frameRate, this.minFrameRate, this.maxFrameRate);
    }
}