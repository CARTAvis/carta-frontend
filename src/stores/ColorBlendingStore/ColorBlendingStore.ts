import {action, computed, makeAutoObservable, observable} from "mobx";

import {AppStore, type FrameStore} from "stores";

export class ColorBlendingStore {
    readonly id: number;
    readonly filename: string;

    @observable titleCustomText: string;

    @action setTitleCustomText = (text: string) => {
        this.titleCustomText = text;
    };

    @computed get baseFrame(): FrameStore {
        return AppStore.Instance.spatialReference;
    }

    @computed get selectedFrames(): FrameStore[] {
        return this.baseFrame ? this.baseFrame.secondarySpatialImages : [];
    }

    @computed get frames(): FrameStore[] {
        return [this.baseFrame, ...this.selectedFrames];
    }

    constructor(id: number) {
        this.id = id;
        this.filename = `Color Blending ${id + 1}`;
        this.titleCustomText = this.filename;
        makeAutoObservable(this);
    }
}
