import {action, computed, makeAutoObservable, observable} from "mobx";

import {AppStore, type FrameStore} from "stores";

export class ColorBlendingStore {
    readonly id: number;
    readonly filename: string;

    @observable titleCustomText: string;
    @observable selectedFrames: FrameStore[];

    @action setTitleCustomText = (text: string) => {
        this.titleCustomText = text;
    };

    @action addSelectedFrame = (frame: FrameStore) => {
        if (!this.isValidFrame(frame)) {
            return;
        }
        this.selectedFrames.push(frame);
    };

    @action setSelectedFrame = (index: number, frame: FrameStore) => {
        if (!this.isValidFrame(frame) || !this.isValidIndex(index)) {
            return;
        }
        this.selectedFrames[index] = frame;
    };

    @action deleteSelectedFrame = (index: number) => {
        if (!this.isValidIndex(index)) {
            return;
        }
        this.selectedFrames.splice(index, 1);
    };

    @computed get baseFrame(): FrameStore {
        return AppStore.Instance.spatialReference;
    }

    @computed get frames(): FrameStore[] {
        return [this.baseFrame, ...this.selectedFrames];
    }

    constructor(id: number) {
        this.id = id;
        this.filename = `Color Blending ${id + 1}`;
        this.titleCustomText = this.filename;
        this.selectedFrames = this.baseFrame?.secondarySpatialImages?.slice(0, 2) ?? [];
        makeAutoObservable(this);
    }

    private isValidFrame = (frame: FrameStore): boolean => {
        if (!frame || !this.baseFrame?.secondarySpatialImages?.includes(frame)) {
            console.error("The selected frame is not matched to the base frame.");
            return false;
        }

        if (this.frames.includes(frame)) {
            console.error("The selected frame is selected in other layers.");
            return false;
        }

        return true;
    };

    private isValidIndex = (index: number): boolean => {
        if (index < 0 || index > this.selectedFrames.length - 1) {
            console.error("Invalid layer index.");
            return false;
        }
        return true;
    };
}
