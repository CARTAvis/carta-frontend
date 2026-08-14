import {computed, makeObservable} from "mobx";

import {type TileService} from "services";

import {type ChannelMapStore} from "../ChannelMapStore/ChannelMapStore";
import {type FrameStore} from "../Frame";

export class LoadingStateStore {
    constructor(
        private readonly tileService: TileService,
        private readonly channelMapStore: ChannelMapStore,
        private readonly getActiveFrame: () => FrameStore | null
    ) {
        makeObservable(this);
    }

    @computed get isLoadingTiles() {
        return this.channelMapStore.isChannelMapEnabled ? this.tileService.isChannelMapLoading : this.tileService.remainingTiles > 0;
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
        return this.isLoadingTiles || this.isLoadingContours || this.isLoadingVectorOverlay;
    }
}
