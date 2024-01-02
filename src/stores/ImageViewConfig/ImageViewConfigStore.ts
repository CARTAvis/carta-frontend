import {Utils} from "@blueprintjs/table";
import {action, computed, makeAutoObservable, observable} from "mobx";

import {FrameStore} from "stores";

enum ImageType {
    FRAME,
    COLOR_BLENDING
}

type ImageItem =
    | {
          type: ImageType.FRAME;
          store: FrameStore;
      }
    | {
          type: ImageType.COLOR_BLENDING;
          store: any;
      };

export class ImageViewConfigStore {
    private static staticInstance: ImageViewConfigStore;

    static get Instance() {
        if (!ImageViewConfigStore.staticInstance) {
            ImageViewConfigStore.staticInstance = new ImageViewConfigStore();
        }
        return ImageViewConfigStore.staticInstance;
    }

    @observable private imageList: ImageItem[] = [];

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

    @action removeAllFrames = () => {
        this.imageList = [];
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

    @computed get frames(): FrameStore[] {
        return this.imageList.filter(imageItem => imageItem?.type === ImageType.FRAME).map(imageItem => imageItem?.store);
    }

    constructor() {
        makeAutoObservable(this);
    }

    getImageListIndex = (fileId: number): number => {
        return this.imageList.findIndex(imageItem => imageItem?.type === ImageType.FRAME && imageItem?.store?.frameInfo.fileId === fileId);
    };
}
