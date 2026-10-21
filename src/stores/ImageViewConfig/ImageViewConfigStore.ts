import {Utils} from "@blueprintjs/table";
import {action, computed, makeAutoObservable, observable} from "mobx";

import {ImagePanelMode, ImageType, PreferenceKeys} from "enums";
import {type ConfigurableStore, type ImageViewItem, type Persisted} from "models";
import {AppStore, ColorBlendingStore, FrameStore, PreferenceStore} from "stores";
import {clamp} from "utilities";

/** The multi-panel grid of the image view, which a layout saves since it suits any images (ADR-0005). */
export interface ImageViewGridConfig {
    multiPanelEnabled: boolean;
    /** How the grid is sized when multi-panel is enabled. */
    panelMode: ImagePanelMode.Dynamic | ImagePanelMode.Fixed;
    /** The number of columns: the maximum in dynamic mode, the exact count in fixed mode. */
    panelColumns: number;
    /** The number of rows: the maximum in dynamic mode, the exact count in fixed mode. */
    panelRows: number;
}

function isPanelCount(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/** Configuration of the images in the image view widget. */
export class ImageViewConfigStore implements ConfigurableStore<ImageViewGridConfig, Persisted<ImageViewGridConfig>> {
    private static staticInstance: ImageViewConfigStore;

    public static get Instance() {
        if (!ImageViewConfigStore.staticInstance) {
            ImageViewConfigStore.staticInstance = new ImageViewConfigStore();
        }
        return ImageViewConfigStore.staticInstance;
    }

    @observable private imageList: ImageViewItem[] = [];
    private nextColorBlendingId = 0;
    /** The grid of this session; a setting it does not hold follows the user's preference. */
    @observable private grid: Partial<ImageViewGridConfig> = {multiPanelEnabled: undefined, panelMode: undefined, panelColumns: undefined, panelRows: undefined};

    /** Whether multi-panel is enabled in this session. */
    @computed get isMultiPanelEnabled(): boolean {
        return this.grid.multiPanelEnabled ?? PreferenceStore.Instance.isImageMultiPanelEnabled;
    }

    /** How the grid is sized when multi-panel is enabled. */
    @computed get multiPanelMode(): ImagePanelMode {
        return this.grid.panelMode ?? PreferenceStore.Instance.imagePanelMode;
    }

    /** The column setting of the grid. */
    @computed get panelColumns(): number {
        return this.grid.panelColumns ?? PreferenceStore.Instance.imagePanelColumns;
    }

    /** The row setting of the grid. */
    @computed get panelRows(): number {
        return this.grid.panelRows ?? PreferenceStore.Instance.imagePanelRows;
    }

    /** Enables or disables multi-panel, and keeps the choice as the user's default. */
    @action setMultiPanelEnabled = (isEnabled: boolean) => {
        this.grid.multiPanelEnabled = isEnabled;
        PreferenceStore.Instance.setPreference(PreferenceKeys.IMAGE_MULTI_PANEL_ENABLED, isEnabled);
    };

    /** Sets how the grid is sized, and keeps the choice as the user's default. */
    @action setMultiPanelMode = (mode: ImagePanelMode.Dynamic | ImagePanelMode.Fixed) => {
        this.grid.panelMode = mode;
        PreferenceStore.Instance.setPreference(PreferenceKeys.IMAGE_PANEL_MODE, mode);
    };

    /** Sets the column setting of the grid, and keeps it as the user's default. */
    @action setPanelColumns = (columns: number) => {
        if (isPanelCount(columns)) {
            this.grid.panelColumns = columns;
            PreferenceStore.Instance.setPreference(PreferenceKeys.IMAGE_PANEL_COLUMNS, columns);
        }
    };

    /** Sets the row setting of the grid, and keeps it as the user's default. */
    @action setPanelRows = (rows: number) => {
        if (isPanelCount(rows)) {
            this.grid.panelRows = rows;
            PreferenceStore.Instance.setPreference(PreferenceKeys.IMAGE_PANEL_ROWS, rows);
        }
    };

    public toConfig = (): ImageViewGridConfig => ({
        multiPanelEnabled: this.isMultiPanelEnabled,
        panelMode: this.multiPanelMode === ImagePanelMode.Fixed ? ImagePanelMode.Fixed : ImagePanelMode.Dynamic,
        panelColumns: this.panelColumns,
        panelRows: this.panelRows
    });

    /**
     * Applies the grid a layout saved, to this session only: restoring is not a user action, so the
     * user's defaults stay as they were. A setting the layout does not hold, or holds in a shape the
     * controls would not accept, follows the user's preference.
     */
    @action applyConfig = (config: Persisted<ImageViewGridConfig> | null | undefined) => {
        const panelMode = config?.panelMode;
        this.grid = {
            multiPanelEnabled: typeof config?.multiPanelEnabled === "boolean" ? config.multiPanelEnabled : undefined,
            panelMode: panelMode === ImagePanelMode.Dynamic || panelMode === ImagePanelMode.Fixed ? panelMode : undefined,
            panelColumns: isPanelCount(config?.panelColumns) ? config.panelColumns : undefined,
            panelRows: isPanelCount(config?.panelRows) ? config.panelRows : undefined
        };
    };

    /**
     * Adds a loaded image to the image list.
     * @param frame - The loaded image.
     */
    @action addFrame = (frame: FrameStore) => {
        this.imageList.push({type: ImageType.FRAME, store: frame});
    };

    /**
     * Replaces a loaded image in the image list.
     * @param index - The image list index.
     * @param frame - The new loaded image.
     */
    @action replaceFrame = (index: number, frame: FrameStore) => {
        if (index !== -1) {
            const imageItem = this.imageList[index];
            if (imageItem?.type === ImageType.FRAME) {
                imageItem.store?.clearContours(false);
                imageItem.store = frame;
            }
        }
    };

    /**
     * Removes a loaded image from the image list.
     * @param fileId - The file id of the loaded image.
     */
    @action removeFrame = (fileId: number) => {
        this.imageList = this.imageList.filter(imageItem => (imageItem?.type === ImageType.FRAME ? imageItem?.store?.id !== fileId : true));
    };

    /**
     * Creates a new color blended image and adds it to the image list.
     * @returns The new color blended image or null if no frames are loaded.
     */
    @action createColorBlending = (): ColorBlendingStore | null => {
        if (this.frames.length > 0) {
            // Keep ids monotonic within a frontend session.
            const id = this.nextColorBlendingId;
            this.nextColorBlendingId += 1;
            const newImage = new ColorBlendingStore(id);

            const imageItem: ImageViewItem = {type: ImageType.COLOR_BLENDING, store: newImage};
            this.imageList.push(imageItem);
            AppStore.Instance.updateActiveImage(imageItem);

            return newImage;
        }
        return null;
    };

    /**
     * Removes a color blended image from the image list.
     * @param image - The color blended image to remove.
     */
    @action removeColorBlending = (image: ColorBlendingStore) => {
        const id = image?.id;
        this.imageList = this.imageList.filter(imageItem => (imageItem?.type === ImageType.COLOR_BLENDING ? imageItem?.store?.id !== id : true));

        if (AppStore.Instance.isActiveImage({type: ImageType.COLOR_BLENDING, store: image})) {
            const firstImage = this.imageNum ? this.getImage(0) : null;
            if (firstImage) {
                AppStore.Instance.setActiveImage(firstImage);
            }
        }
    };

    /**
     * Reorders images in the image list.
     * @param oldIndex - The first index of the images to move.
     * @param newIndex - The index to move the image to.
     * @param length - The length of the images to move.
     */
    @action reorderImage = (oldIndex: number, newIndex: number, length: number) => {
        const imageNum = this.imageList.length;
        if (
            !Number.isInteger(oldIndex) ||
            oldIndex < 0 ||
            oldIndex >= imageNum ||
            !Number.isInteger(newIndex) ||
            newIndex < 0 ||
            newIndex >= imageNum ||
            !Number.isInteger(length) ||
            length <= 0 ||
            length >= imageNum ||
            oldIndex === newIndex
        ) {
            return;
        }
        const reordered = Utils.reorderArray(this.imageList, oldIndex, newIndex, length);
        this.imageList = reordered ? reordered : this.imageList;
    };

    /**
     * Sorts the image list by ascending observation time, so that the multi-panel view renders
     * the images in time order. Images without a valid observation time (including color blended
     * images) keep their relative order and are placed at the end.
     */
    @action sortImagesByTime = () => {
        const keyedItems = this.imageList.map((item, index) => {
            const frame = item?.type === ImageType.FRAME ? (item.store as FrameStore) : undefined;
            const mjdUtc = frame?.obsTimeMjdUtc;
            return {item, index, key: mjdUtc !== undefined && isFinite(mjdUtc) ? mjdUtc : Number.POSITIVE_INFINITY};
        });
        keyedItems.sort((a, b) => a.key - b.key || a.index - b.index);
        this.imageList = keyedItems.map(keyedItem => keyedItem.item);
    };

    /** Removes all images from the image list. */
    @action removeAllImages = () => {
        this.imageList = [];
    };

    /** Number of images in the image list. */
    @computed get imageNum(): number {
        return this.imageList.length;
    }

    /** Filenames in the image list. */
    @computed get imageNames(): string[] {
        return this.imageList.map(image => image.store.filename);
    }

    /** (carta-python) Serializable snapshot of the image list (type and id per entry). */
    @computed get imageListSummary(): {type: ImageType; id: number}[] {
        return this.imageList.map(item => ({
            type: item.type,
            id: item.store?.id
        }));
    }

    /** Returns the stable IDs of image views matching the requested type, in image list order. */
    getImageIdsByType = (type: ImageType): number[] => {
        return this.imageList.filter(imageItem => imageItem.type === type).map(imageItem => imageItem.store.id);
    };

    /** All the loaded images in the image list. */
    @computed get frames(): FrameStore[] {
        return this.imageList?.filter(imageItem => imageItem?.type === ImageType.FRAME && imageItem?.store instanceof FrameStore).map(imageItem => imageItem?.store as FrameStore);
    }

    /** All the color blended images in the image list. */
    @computed get colorBlendingImages(): ColorBlendingStore[] {
        return this.imageList?.filter(imageItem => imageItem?.type === ImageType.COLOR_BLENDING && imageItem?.store instanceof ColorBlendingStore).map(imageItem => imageItem?.store as ColorBlendingStore);
    }

    /** A map of all the color blended images with their ids as keys. */
    @computed get colorBlendingImageMap(): Map<number, ColorBlendingStore> {
        const imageMap = new Map<number, ColorBlendingStore>();
        for (const image of this.colorBlendingImages) {
            imageMap.set(image.id, image);
        }
        return imageMap;
    }

    /** The total number of pages in the image view widget. */
    @computed get numImagePages() {
        if (this.numImageColumns <= 0 || this.numImageRows <= 0 || !this.imageList) {
            return 0;
        }

        return Math.ceil(this.imageNum / this.imagesPerPage);
    }

    /** The index of the current page in the image view widget. */
    @computed get currentImagePage() {
        const activeImage = AppStore.Instance.activeImage;
        if (!this.imageNum || !activeImage) {
            return 0;
        }

        if (activeImage.type === ImageType.PV_PREVIEW) {
            const sourceFileId = activeImage.store.frameInfo.previewSourceFileId;
            if (sourceFileId !== undefined) {
                const index = this.getImageListIndex(ImageType.FRAME, sourceFileId);
                return Math.floor(index / this.imagesPerPage);
            }
            return 0;
        }

        const index = this.getImageListIndex(activeImage.type, activeImage.store?.id);
        return Math.floor(index / this.imagesPerPage);
    }

    /** The images on the current page in the image view widget. */
    @computed get visibleImages(): ImageViewItem[] {
        if (!this.imageNum) {
            return [];
        }

        const pageIndex = clamp(this.currentImagePage, 0, this.numImagePages);
        const firstImageIndex = pageIndex * this.imagesPerPage;
        const indexUpperBound = Math.min(firstImageIndex + this.imagesPerPage, this.imageNum);
        const pageImages: ImageViewItem[] = [];
        for (let i = firstImageIndex; i < indexUpperBound; i++) {
            pageImages.push(this.imageList[i]);
        }
        return pageImages;
    }

    /** The frames visible on the current page, including the loaded images and the layers of the color blended images. */
    @computed get visibleFrames(): FrameStore[] {
        const frames: Set<FrameStore> = new Set();
        this.visibleImages.forEach(imageItem => {
            if (imageItem?.type === ImageType.FRAME) {
                const frame = imageItem?.store;
                if (frame) {
                    frames.add(imageItem.store);
                }
            } else if (imageItem?.type === ImageType.COLOR_BLENDING) {
                const composedFrames = imageItem?.store?.frames;
                for (const frame of composedFrames) {
                    if (frame) {
                        frames.add(frame);
                    }
                }
            }
        });
        return [...frames];
    }

    /** The number of columns in the image view widget. */
    @computed get numImageColumns() {
        return this.getImagePanelDimension(this.panelColumns, this.imageNum);
    }

    /** The number of rows in the image view widget. */
    @computed get numImageRows() {
        const dynamicRowCount = Math.ceil(this.imageNum / this.panelColumns);
        return this.getImagePanelDimension(this.panelRows, dynamicRowCount);
    }

    /** The number of image panels on a page. */
    @computed get imagesPerPage() {
        return this.numImageColumns * this.numImageRows || 1;
    }

    /** The image panel mode. */
    @computed get imagePanelMode() {
        return this.isMultiPanelEnabled ? this.multiPanelMode : ImagePanelMode.None;
    }

    private getImagePanelDimension = (fixedPanelCount: number, dynamicPanelCount: number) => {
        if (AppStore.Instance.channelMapStore.isChannelMapEnabled) {
            return 1;
        }

        switch (this.imagePanelMode) {
            case ImagePanelMode.None:
                return 1;
            case ImagePanelMode.Fixed:
                return Math.max(1, fixedPanelCount);
            default:
                return clamp(dynamicPanelCount, 1, fixedPanelCount);
        }
    };

    private constructor() {
        makeAutoObservable(this);
    }

    /**
     * Returns the index of an image in the image list.
     * @param type - The type of the image.
     * @param id - The id of the image.
     * @returns The index of the image.
     */
    getImageListIndex = (type: ImageType.FRAME | ImageType.COLOR_BLENDING, id: number): number => {
        return this.imageList?.findIndex(imageItem => imageItem?.type === type && imageItem?.store?.id === id);
    };

    /**
     * Returns an image from the image list by index.
     * @param index - The index of the image.
     * @returns A loaded image or a color blended image.
     */
    getImage = (index: number): ImageViewItem => {
        return this.imageList[index];
    };
}
