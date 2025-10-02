import type {ColorBlendingStore, FrameStore} from "stores";

import {type ImageType} from "enums";

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
