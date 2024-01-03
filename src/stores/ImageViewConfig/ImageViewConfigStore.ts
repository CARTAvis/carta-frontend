import {Utils} from "@blueprintjs/table";
import {action, computed, makeAutoObservable, observable} from "mobx";

import {ImageType, ImageViewItem} from "models";
import {ColorBlendingStore, FrameStore} from "stores";

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
            this.imageList.push({type: ImageType.COLOR_BLENDING, store: newImage});
            return newImage;
        }
        return null;
    };

    @action removeColorBlending = (image: ColorBlendingStore) => {
        const id = image?.id;
        this.imageList = this.imageList.filter(imageItem => (imageItem?.type === ImageType.COLOR_BLENDING ? imageItem?.store?.id !== id : true));
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
        return this.imageList.length;
    }

    @computed get frames(): FrameStore[] {
        return this.imageList.filter(imageItem => imageItem?.type === ImageType.FRAME && imageItem?.store instanceof FrameStore).map(imageItem => imageItem?.store as FrameStore);
    }

    @computed private get colorBlendingImages(): ColorBlendingStore[] {
        return this.imageList.filter(imageItem => imageItem?.type === ImageType.COLOR_BLENDING && imageItem?.store instanceof ColorBlendingStore).map(imageItem => imageItem?.store as ColorBlendingStore);
    }

    @computed get colorBlendingImageMap(): Map<number, ColorBlendingStore> {
        const imageMap = new Map<number, ColorBlendingStore>();
        for (const image of this.colorBlendingImages) {
            imageMap.set(image.id, image);
        }
        return imageMap;
    }

    constructor() {
        makeAutoObservable(this);
    }

    getImageListIndex = (fileId: number): number => {
        return this.imageList.findIndex(imageItem => imageItem?.type === ImageType.FRAME && imageItem?.store?.frameInfo.fileId === fileId);
    };

    getImage = (index: number): ImageViewItem => {
        return this.imageList[index];
    };
}
