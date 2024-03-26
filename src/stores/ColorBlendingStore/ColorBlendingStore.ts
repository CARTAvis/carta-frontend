import {action, computed, makeAutoObservable, observable, reaction} from "mobx";

import {AppStore, type FrameStore} from "stores";

/** Configuration of a color blended image. */
export class ColorBlendingStore {
    /** The unique identifier of the color blended image. */
    readonly id: number;
    /** The filename of the color blended image. */
    readonly filename: string;

    /** The custom title shown in the image view overlay. */
    @observable titleCustomText: string;
    /** The frames from the layers excluding the base layer. */
    @observable selectedFrames: FrameStore[];
    /** The alpha values of all the layers */
    @observable alpha: number[];

    /**
     * Sets the custom title shown in the image view overlay.
     * @param text - The custom text to set.
     */
    @action setTitleCustomText = (text: string) => {
        this.titleCustomText = text;
    };

    /**
     * Adds a layer to the color blended image.
     * @param frame - The frame used for the layer.
     */
    @action addSelectedFrame = (frame: FrameStore) => {
        if (!this.isValidFrame(frame)) {
            return;
        }
        this.selectedFrames.push(frame);
        this.alpha.push(1);
        // trigger re-render
        this.alpha = this.alpha.slice();
    };

    /**
     * Sets the frame used for the layer.
     * @param index - The layer index excluding the base layer.
     * @param frame - The frame used for the layer.
     */
    @action setSelectedFrame = (index: number, frame: FrameStore) => {
        if (!this.isValidFrame(frame) || !this.isValidIndex(this.selectedFrames, index)) {
            return;
        }
        this.selectedFrames[index] = frame;
    };

    /**
     * Sets the alpha value of the layer.
     * @param index - The layer index.
     * @param alpha - The alpha value.
     */
    @action setAlpha = (index: number, alpha: number) => {
        if (!this.isValidIndex(this.alpha, index)) {
            return;
        }
        if (alpha < 0 || alpha > 1) {
            console.error("Invalid alpha value.");
            return;
        }
        this.alpha[index] = alpha;
        // trigger re-render
        this.alpha = this.alpha.slice();
    };

    /**
     * Deletes a layer from the color blended image.
     * @param index - The layer index excluding the base layer.
     */
    @action deleteSelectedFrame = (index: number) => {
        if (!this.isValidIndex(this.selectedFrames, index)) {
            return;
        }
        this.selectedFrames.splice(index, 1);

        const alphaIndex = index + 1;
        this.alpha.splice(alphaIndex, 1);
        // trigger re-render
        this.alpha = this.alpha.slice();
    };

    /** The frame from the base layer. */
    @computed get baseFrame(): FrameStore {
        return AppStore.Instance.spatialReference;
    }

    /** The frames from all the layers. */
    @computed get frames(): FrameStore[] {
        return [this.baseFrame, ...this.selectedFrames];
    }

    constructor(id: number) {
        this.id = id;
        this.filename = `Color Blending ${id + 1}`;
        this.titleCustomText = this.filename;
        this.selectedFrames = this.baseFrame?.secondarySpatialImages?.slice(0, 2) ?? [];
        this.alpha = new Array(this.selectedFrames.length + 1).fill(1);
        makeAutoObservable(this);

        reaction(
            () => this.baseFrame?.secondarySpatialImages,
            matchedFrames => {
                if (!matchedFrames) {
                    return;
                }

                for (let i = this.selectedFrames.length - 1; i >= 0; i--) {
                    if (!matchedFrames.includes(this.selectedFrames[i])) {
                        this.deleteSelectedFrame(i);
                    }
                }
            }
        );
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

    private isValidIndex = (array: any[], index: number): boolean => {
        if (index < 0 || index > array.length - 1) {
            console.error("Invalid layer index.");
            return false;
        }
        return true;
    };
}
