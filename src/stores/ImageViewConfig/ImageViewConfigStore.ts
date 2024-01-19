import {Utils} from "@blueprintjs/table";
import {action, computed, makeAutoObservable, observable} from "mobx";

import {ImagePanelMode, ImageType, ImageViewItem} from "models";
import {AppStore, ColorBlendingStore, FrameStore, PreferenceStore} from "stores";
import {clamp} from "utilities";

export class ImageViewConfigStore {
    private static staticInstance: ImageViewConfigStore;

    static get Instance() {
        if (!ImageViewConfigStore.staticInstance) {
            ImageViewConfigStore.staticInstance = new ImageViewConfigStore();
        }
        return ImageViewConfigStore.staticInstance;
    }

    @observable private imageList: ImageViewItem[] = [];

    @action addFrame = (frame: FrameStore) => {
        this.imageList.push({type: ImageType.FRAME, store: frame});
    };

    @action replaceFrame = (index: number, frame: FrameStore) => {
        if (index !== -1) {
            const imageItem = this.imageList[index];
            if (imageItem?.type === ImageType.FRAME) {
                imageItem.store?.clearContours(false);
                imageItem.store = frame;
            }
        }
    };

    @action removeFrame = (fileId: number) => {
        this.imageList = this.imageList.filter(imageItem => (imageItem?.type === ImageType.FRAME ? imageItem?.store?.frameInfo.fileId !== fileId : true));
    };

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

    @action removeColorBlending = (image: ColorBlendingStore) => {
        const id = image?.id;
        this.imageList = this.imageList.filter(imageItem => (imageItem?.type === ImageType.COLOR_BLENDING ? imageItem?.store?.id !== id : true));

        if (AppStore.Instance.isActiveImage({type: ImageType.COLOR_BLENDING, store: image})) {
            const firstImage = this.imageNum ? this.getImage(0) : null;
            AppStore.Instance.setActiveImage(firstImage);
        }
    };

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

    @action removeAllImages = () => {
        this.imageList = [];
    };

    @computed get imageNum(): number {
        return this.imageList?.length;
    }

    @computed get frames(): FrameStore[] {
        return this.imageList?.filter(imageItem => imageItem?.type === ImageType.FRAME && imageItem?.store instanceof FrameStore).map(imageItem => imageItem?.store as FrameStore);
    }

    @computed get colorBlendingImages(): ColorBlendingStore[] {
        return this.imageList?.filter(imageItem => imageItem?.type === ImageType.COLOR_BLENDING && imageItem?.store instanceof ColorBlendingStore).map(imageItem => imageItem?.store as ColorBlendingStore);
    }

    @computed get colorBlendingImageMap(): Map<number, ColorBlendingStore> {
        const imageMap = new Map<number, ColorBlendingStore>();
        for (const image of this.colorBlendingImages) {
            imageMap.set(image.id, image);
        }
        return imageMap;
    }

    @computed get numImagePages() {
        if (this.numImageColumns <= 0 || this.numImageRows <= 0 || !this.imageList) {
            return 0;
        }

        return Math.ceil(this.imageNum / this.imagesPerPage);
    }

    @computed get currentImagePage() {
        const activeImage = AppStore.Instance.activeImage;
        if (!this.imageNum || !activeImage || activeImage.type === ImageType.PV_PREVIEW) {
            return 0;
        }

        const index = this.getImageListIndex(activeImage.type, activeImage.store?.id);
        return Math.floor(index / this.imagesPerPage);
    }

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

    @computed get numImageColumns() {
        switch (this.imagePanelMode) {
            case ImagePanelMode.None:
                return 1;
            case ImagePanelMode.Fixed:
                return Math.max(1, PreferenceStore.Instance.imagePanelColumns);
            default:
                return clamp(this.imageNum, 1, PreferenceStore.Instance.imagePanelColumns);
        }
    }

    @computed get numImageRows() {
        switch (this.imagePanelMode) {
            case ImagePanelMode.None:
                return 1;
            case ImagePanelMode.Fixed:
                return Math.max(1, PreferenceStore.Instance.imagePanelRows);
            default:
                return clamp(Math.ceil(this.imageNum / PreferenceStore.Instance.imagePanelColumns), 1, PreferenceStore.Instance.imagePanelRows);
        }
    }

    @computed get imagesPerPage() {
        return this.numImageColumns * this.numImageRows || 1;
    }

    @computed get imagePanelMode() {
        const preferenceStore = PreferenceStore.Instance;
        return preferenceStore.imageMultiPanelEnabled ? preferenceStore.imagePanelMode : ImagePanelMode.None;
    }

    constructor() {
        makeAutoObservable(this);
    }

    getImageListIndex = (type: ImageType.FRAME | ImageType.COLOR_BLENDING, id: number): number => {
        return this.imageList?.findIndex(imageItem => imageItem?.type === type && imageItem?.store?.id === id);
    };

    getImage = (index: number): ImageViewItem => {
        return this.imageList[index];
    };
}
