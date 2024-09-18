import type {ColorBlendingStore, FrameStore} from "stores";

export enum ImageType {
    FRAME,
    COLOR_BLENDING,
    PV_PREVIEW,
    RENDER3D
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

export type ImageItem = ImageViewItem | {type: ImageType.PV_PREVIEW; store: FrameStore};

export type ImageItem3D = ImageViewItem | {type: ImageType.RENDER3D; store: FrameStore};
