import {action, computed, observable} from "mobx";
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
        clearInterval(this.animateHandle);
        this.requestQueue = [];
        this.animationState = AnimationState.PLAYING;
        this.animate();
        this.animateHandle = setInterval(this.animate, this.frameInterval);
    };
    @action stopAnimation = () => {
        this.animationState = AnimationState.STOPPED;
        clearInterval(this.animateHandle);
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