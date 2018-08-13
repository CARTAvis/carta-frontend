import {action, observable} from "mobx";

export enum AnimationMode {
    CHANNEL = 0,
    STOKES = 1,
    FRAME = 2
}

export class AnimatorStore {
    @observable frameRate: number;
    @observable maxFrameRate: number;
    @observable minFrameRate: number;
    @observable animationMode: AnimationMode;

    @action setAnimationMode(val: AnimationMode) {
        this.animationMode = val;
    }

    @action setFrameRate(val: number) {
        this.frameRate = val;
    }

    constructor() {
        this.frameRate = 5;
        this.maxFrameRate = 15;
        this.minFrameRate = 1;
        this.animationMode = AnimationMode.CHANNEL;
    }
}