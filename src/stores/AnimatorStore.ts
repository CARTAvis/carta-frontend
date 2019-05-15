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
    @observable requestQueue: Array<{ channel: number, stokes: number }>;

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

        const firstFrame: CARTA.IAnimationFrame = {
            channel: 0,
            stokes: 0
        };

        const lastFrame: CARTA.IAnimationFrame = {
            channel: frame.frameInfo.fileInfoExtended.depth,
            stokes: frame.frameInfo.fileInfoExtended.stokes
        };

        const deltaFrame: CARTA.IAnimationFrame = {
            channel: this.animationMode === AnimationMode.CHANNEL ? 1 : 0,
            stokes: this.animationMode === AnimationMode.STOKES ? 1 : 0,
        };

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
        if (this.animationState === AnimationState.PLAYING && this.appStore && this.requestQueue.length <= Math.max(this.frameRate, 2)) {
            // Do animation
            switch (this.animationMode) {
                case AnimationMode.FRAME:
                    this.appStore.nextFrame();
                    break;
                case AnimationMode.CHANNEL:
                    this.appStore.activeFrame.incrementChannels(1, 0);
                    this.appStore.backendService.setChannels(this.appStore.activeFrame.frameInfo.fileId, this.appStore.activeFrame.requiredChannel, this.appStore.activeFrame.requiredStokes);
                    this.requestQueue.push({channel: this.appStore.activeFrame.requiredChannel, stokes: this.appStore.activeFrame.requiredStokes});
                    break;
                case AnimationMode.STOKES:
                    this.appStore.activeFrame.incrementChannels(0, 1);
                    this.appStore.backendService.setChannels(this.appStore.activeFrame.frameInfo.fileId, this.appStore.activeFrame.requiredChannel, this.appStore.activeFrame.requiredStokes);
                    this.requestQueue.push({channel: this.appStore.activeFrame.requiredChannel, stokes: this.appStore.activeFrame.requiredStokes});
                    break;
                default:
                    break;
            }
        }
    };

    @action removeFromRequestQueue = (channel: number, stokes: number) => {
        const index = this.requestQueue.findIndex(v => v.channel === channel && v.stokes === stokes);
        if (index >= 0) {
            this.requestQueue = this.requestQueue.splice(index, 1);
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
        this.animateHandle = null;
        this.requestQueue = [];
        this.appStore = appStore;
    }

    @computed get frameInterval() {
        return 1000.0 / clamp(this.frameRate, this.minFrameRate, this.maxFrameRate);
    }
}