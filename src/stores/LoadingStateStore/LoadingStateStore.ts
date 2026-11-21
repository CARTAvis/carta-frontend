import {computed, makeObservable} from "mobx";

import {type TileService} from "services";

import {type ChannelMapStore} from "../ChannelMapStore/ChannelMapStore";
import {type FrameStore} from "../Frame";

export class LoadingStateStore {
    constructor(
        private readonly tileService: TileService,
        private readonly channelMapStore: ChannelMapStore,
        private readonly getActiveFrame: () => FrameStore | null,
        private readonly getVisibleFrames: () => FrameStore[]
    ) {
        makeObservable(this);
    }

    @computed get remainingTiles() {
        return this.channelMapStore.isChannelMapEnabled ? this.tileService.channelMapRemainingTiles : this.tileService.normalViewRemainingTiles;
    }

    @computed get isLoadingContours() {
        const progress = this.getActiveFrame()?.contourProgress;
        return progress !== undefined && progress >= 0 && progress < 1;
    }

    @computed get isLoadingVectorOverlay() {
        const progress = this.getActiveFrame()?.vectorOverlayStore.progress;
        return progress !== undefined && progress >= 0 && progress < 1;
    }

    @computed get isLoading() {
        return (
            this.remainingTiles > 0 ||
            this.getVisibleFrames().some(frame => {
                const contourProgress = frame.contourProgress;
                const vectorProgress = frame.vectorOverlayStore.progress;
                return (contourProgress >= 0 && contourProgress < 1) || (vectorProgress >= 0 && vectorProgress < 1);
            })
        );
    }
}
