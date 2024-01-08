import {computed, makeAutoObservable} from "mobx";

import {AppStore, type FrameStore} from "stores";

export class ColorBlendingStore {
    readonly id: number;
    readonly filename: string;

    @computed get baseFrame(): FrameStore {
        return AppStore.Instance.spatialReference;
    }

    @computed get selectedFrames(): FrameStore[] {
        return this.baseFrame ? this.baseFrame.secondarySpatialImages : [];
    }

    constructor(id: number) {
        this.id = id;
        this.filename = `Color Blending ${id + 1}`;
        makeAutoObservable(this);
    }
}
