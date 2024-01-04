import type {ColorBlendingStore, FrameStore} from "stores";

export enum ImageType {
    FRAME,
    COLOR_BLENDING,
    PV_PREVIEW
}

export type ImageViewItem =
    | {
          type: ImageType.FRAME;
          store: FrameStore;
      }
    | {
          type: ImageType.COLOR_BLENDING;
          store: ColorBlendingStore;
      };

export type ImagePanelItem = ImageViewItem | {type: ImageType.PV_PREVIEW; store: FrameStore};

export type ActiveImage = {
    type: ImageType;
    id: number;
};
