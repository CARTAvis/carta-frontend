import {Utils} from "@blueprintjs/table";
import {action, computed, makeAutoObservable, observable} from "mobx";

import {ImagePanelMode, ImageType, ImageViewItem} from "models";
import {AppStore, ColorBlendingStore, FrameStore, PreferenceStore} from "stores";
import {clamp} from "utilities";

/** Configuration of the images in the image view widget. */
export class ImageViewConfigStore {
    private static staticInstance: ImageViewConfigStore;

    static get Instance() {
        if (!ImageViewConfigStore.staticInstance) {
            ImageViewConfigStore.staticInstance = new ImageViewConfigStore();
        }
        return ImageViewConfigStore.staticInstance;
    }

    @observable private imageList: ImageViewItem[] = [];

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
     * @returns The new color blended image.
     */
    @action createColorBlending = (): ColorBlendingStore => {
        if (this.frames.length > 0) {
            const id = this.colorBlendingImageMap.size ? Math.max(...this.colorBlendingImageMap.keys()) + 1 : 0;
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
            AppStore.Instance.setActiveImage(firstImage);
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
        this.imageList = Utils.reorderArray(this.imageList, oldIndex, newIndex, length);
    };

    /** Removes all images from the image list. */
    @action removeAllImages = () => {
        this.imageList = [];
    };

    /** Number of images in the image list. */
    @computed get imageNum(): number {
        return this.imageList?.length;
    }

    /** Filenames in the image list. */
    @computed get imageNames(): string[] {
        return this.imageList.map(image => image.store.filename);
    }

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
        const pageImages = [];
        for (let i = firstImageIndex; i < indexUpperBound; i++) {
            pageImages.push(this.imageList[i]);
        }
        return pageImages;
    }

    /** The frames visible on the current page, including the loaded images and the layers of the color blended images. */
    @computed get visibleFrames(): FrameStore[] {
        let frames: Set<FrameStore> = new Set();
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
        if (AppStore.Instance.channelMapStore.channelMapEnabled) {
            return 1;
        }

        switch (this.imagePanelMode) {
            case ImagePanelMode.None:
                return 1;
            case ImagePanelMode.Fixed:
                return Math.max(1, PreferenceStore.Instance.imagePanelColumns);
            default:
                return clamp(this.imageNum, 1, PreferenceStore.Instance.imagePanelColumns);
        }
    }

    /** The number of rows in the image view widget. */
    @computed get numImageRows() {
        if (AppStore.Instance.channelMapStore.channelMapEnabled) {
            return 1;
        }

        switch (this.imagePanelMode) {
            case ImagePanelMode.None:
                return 1;
            case ImagePanelMode.Fixed:
                return Math.max(1, PreferenceStore.Instance.imagePanelRows);
            default:
                return clamp(Math.ceil(this.imageNum / PreferenceStore.Instance.imagePanelColumns), 1, PreferenceStore.Instance.imagePanelRows);
        }
    }

    /** The number of image panels on a page. */
    @computed get imagesPerPage() {
        return this.numImageColumns * this.numImageRows || 1;
    }

    /** The image panel mode. */
    @computed get imagePanelMode() {
        const preferenceStore = PreferenceStore.Instance;
        return preferenceStore.imageMultiPanelEnabled ? preferenceStore.imagePanelMode : ImagePanelMode.None;
    }

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
