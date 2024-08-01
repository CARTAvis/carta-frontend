import {action, computed, makeAutoObservable, observable, reaction} from "mobx";
import tinycolor from "tinycolor2";

import {AppStore, type FrameStore, RenderConfigStore} from "stores";
import {getColorsForValues} from "utilities";

/** The configuration of a colormap set. Can either be a single gradient colormap or a collection of multiple colormaps. */
type ColormapSetConfig =
    | {
          type: "gradient";
          colormap: string;
          inverted: boolean;
      }
    | {
          type: "collection";
          colormaps: readonly string[];
      };

/** Configuration of a color blended image. */
export class ColorBlendingStore {
    /** The unique identifier of the color blended image. */
    readonly id: number;
    /** The filename of the color blended image. */
    readonly filename: string;
    /** Available colormap sets used for blending. The keys are the names of the sets, and the values are the configuration of the set. */
    static readonly ColormapSets: ReadonlyMap<string, ColormapSetConfig> = new Map([
        ["RGB", {type: "collection", colormaps: ["Red", "Green", "Blue"]}],
        ["CMY", {type: "collection", colormaps: ["Magenta", "Yellow", "Cyan"]}],
        ["Rainbow", {type: "gradient", colormap: "rainbow", inverted: true}]
    ]);
    /** The default limit for the number of layers during initialization. */
    static readonly DefaultLayerLimit = 10;

    /** The custom title shown in the image view overlay. */
    @observable titleCustomText: string;
    /** The frames from the layers excluding the base layer. */
    @observable selectedFrames: FrameStore[];
    /** The alpha values of all the layers */
    @observable alpha: number[];
    /** The visibility of the blended raster image. */
    @observable rasterVisible = true;
    /** The visibility of all the contours. */
    @observable contourVisible = true;
    /** The visibility of all the vector overlays. */
    @observable vectorOverlayVisible = true;

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

    /** Hides or shows the blended raster image. */
    @action toggleRasterVisible = () => {
        this.rasterVisible = !this.rasterVisible;
    };

    /** Hides or shows all the contours. */
    @action toggleContourVisible = () => {
        this.contourVisible = !this.contourVisible;
    };

    /** Hides or shows all the vector overlays. */
    @action toggleVectorOverlayVisible = () => {
        this.vectorOverlayVisible = !this.vectorOverlayVisible;
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
        this.selectedFrames = this.baseFrame?.secondarySpatialImages?.slice(0, ColorBlendingStore.DefaultLayerLimit - 1) ?? [];
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

    /**
     * Applies the specified colormap set to the layers. Frames with raster scaling matching enabled are skipped.
     * - If the colormap set is a single gradient colormap, it interpolates colors along the gradient for each frame.
     * - If the colormap set is a collection of multiple colormaps, it interpolates between the indexes and selects a colormap from the collection to match the number of frames.
     * @param set - The name of the colormap set to apply. Must be a key in the `ColorBlendingStore.ColormapSets` map.
     */
    applyColormapSet = (set: string) => {
        const colormapSetConfig = ColorBlendingStore.ColormapSets.get(set);
        if (!colormapSetConfig) {
            console.error("Invalid colormap set name.");
            return;
        }

        const rasterUnmatchedFrames = this.frames.filter(f => !f.rasterScalingReference);
        const frameNum = rasterUnmatchedFrames.length;

        if (colormapSetConfig.type === "gradient") {
            const gradient = getColorsForValues(colormapSetConfig.colormap);
            const getHex = (index: number): string => "#" + tinycolor({r: gradient.color[index * 4], g: gradient.color[index * 4 + 1], b: gradient.color[index * 4 + 2], a: gradient.color[index * 4 + 3]}).toHex();

            for (let i = 0; i < frameNum; i++) {
                let index;
                if (frameNum === 1) {
                    index = colormapSetConfig.inverted ? gradient.size - 1 : 0;
                } else {
                    index = Math.round(((colormapSetConfig.inverted ? frameNum - 1 - i : i) * (gradient.size - 1)) / (frameNum - 1));
                }
                const hex = getHex(index);

                let isExistingSingleColor = false;
                for (const [key, val] of RenderConfigStore.COLOR_MAPS_MONO) {
                    if (val === hex) {
                        rasterUnmatchedFrames[i].renderConfig.setColorMap(key);
                        isExistingSingleColor = true;
                        break;
                    }
                }

                if (!isExistingSingleColor) {
                    rasterUnmatchedFrames[i].renderConfig.setCustomHexEnd(hex);
                    rasterUnmatchedFrames[i].renderConfig.setColorMap(RenderConfigStore.COLOR_MAPS_CUSTOM);
                }
            }
        } else {
            const colormaps = colormapSetConfig.colormaps;
            for (let i = 0; i < frameNum; i++) {
                let index;
                if (frameNum === 1) {
                    index = 0;
                } else {
                    index = Math.round((i * (colormaps.length - 1)) / (frameNum - 1));
                }

                rasterUnmatchedFrames[i].renderConfig.setColorMap(colormaps[index]);
            }
        }
    };

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
