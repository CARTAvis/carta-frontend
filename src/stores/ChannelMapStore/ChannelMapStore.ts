import {throttle} from "lodash";
import {action, computed, makeObservable, observable} from "mobx";

import {TileService} from "services";
import {AppStore, FrameStore, OverlayStore} from "stores";

export class ChannelMapStore {
    private static staticInstance: ChannelMapStore;
    @observable pixelHighlightValue: number = NaN;

    static get Instance() {
        if (!ChannelMapStore.staticInstance) {
            ChannelMapStore.staticInstance = new ChannelMapStore();
        }
        return ChannelMapStore.staticInstance;
    }

    constructor() {
        makeObservable(this);
        ChannelMapStore.staticInstance = this;
        this.startChannel = 0;
        this.numColumns = 2;
        this.numRows = 2;
        this.overlayStores = {corner: undefined, outer: new OverlayStore(0, 0)};
        this.overlayStores.outer.labels = AppStore.Instance.overlayStore.labels;
        this.overlayStores.outer.setBase(0);
        this.overlayStores.outer.setDefaultGap(0);
        this.overlayStores.outer.isChannelMap = true;
    }

    @observable masterFrame: FrameStore;
    @observable _auxiliaryFrame: FrameStore;
    @observable auxiliaryFrameChannel: number = 0;
    @observable startChannel: number = 0;
    @observable numColumns: number;
    @observable numRows: number;
    @observable showAuxiliaryFrame: boolean = false;
    @observable singleChannelContour: boolean = true;
    @observable singleContourChannel: number = 0;
    @observable overlayStores: {corner: OverlayStore; outer: OverlayStore};

    @action throttledRequestChannels = throttle((frame: FrameStore) => {
        const [tiles, midPointTileCoords] = frame.requiredTiles;
        const preferenceStore = AppStore.Instance.preferenceStore;
        const bunitVariant = ["km/s", "km s-1", "km s^-1", "km.s-1"];
        const compressionQuality = bunitVariant.includes(frame.headerUnit) ? Math.max(preferenceStore.imageCompressionQuality, 32) : preferenceStore.imageCompressionQuality;
        TileService.Instance.requestChannelMapTiles(tiles, midPointTileCoords, compressionQuality);
    }, 100);

    @action setOverlayStores(overlayStore: OverlayStore) {
        this.overlayStores.corner = overlayStore;
    }

    @action updateOverlayStoreSize(width: number, height: number) {
        this.overlayStores?.corner?.setViewDimension(width + this.overlayStores?.corner?.paddingLeft, height + this.overlayStores.corner?.paddingBottom);
    }

    @action setMasterFrame(masterFrame: FrameStore) {
        this.masterFrame = masterFrame;

        const appStore = AppStore.Instance;
        const frames = appStore.frames.filter(frame => frame.frameInfo.fileId !== masterFrame.frameInfo.fileId);
        frames.forEach(frame => appStore.tileService.handleFileClosed(frame.frameInfo.fileId));
    }

    @action setAuxiliaryFrame(frame: FrameStore) {
        this._auxiliaryFrame = frame;
    }

    @action setStartChannel(startChannel: number) {
        // Add checks for valid startChannel number for the masterFrame
        if (startChannel < 0 || startChannel > this.masterFrame.frameInfo.fileInfoExtended.depth) {
            return;
        }
        this.startChannel = startChannel;
    }

    @action setPrevChannel() {
        this.setStartChannel(this.startChannel - 1);
    }

    @action setNextChannel() {
        this.setStartChannel(this.startChannel + 1);
    }

    @action setPrevPage() {
        const newStart = this.startChannel - this.numColumns * this.numRows;

        if (newStart >= 0) {
            this.setStartChannel(newStart);
        }
    }

    @action setNextPage() {
        const newStart = this.startChannel + this.numColumns * this.numRows;

        if (newStart >= 0) {
            this.setStartChannel(newStart);
        }
    }

    @action setAuxiliaryFrameChannel(channel: number) {
        this.auxiliaryFrameChannel = channel;
    }

    @action setNumColumns(numColumns: number) {
        if (isFinite(numColumns) && numColumns > 0) {
            this.numColumns = numColumns;
        }
    }

    @action setNumRows(numRows: number) {
        if (isFinite(numRows) && numRows > 0) {
            this.numRows = numRows;
        }
    }

    @action setPixelHighlightValue = (val: number) => {
        if (!AppStore.Instance.isExportingImage) {
            this.pixelHighlightValue = val;
        }
    };

    @action setShowAuxiliaryFrame = (show: boolean) => {
        this.showAuxiliaryFrame = show;
    };

    @action setSingleChannelContour = (singleChannel: boolean) => {
        this.singleChannelContour = singleChannel;
    };

    @action setSingleContourChannel = (channel: number) => {
        this.singleContourChannel = channel;
    };

    public overlayStore(imageRenderWidth?: number, imageRenderHeight?: number) {
        const overlay = AppStore.Instance.overlayStore;
        if (imageRenderWidth && imageRenderHeight) {
            this.updateOverlayStoreSize(imageRenderWidth, imageRenderHeight);
        }

        if (this.overlayStores?.corner) {
            this.setOverlayStores(this.overlayStores?.corner);
        } else {
            const newOverlay = new OverlayStore(imageRenderWidth, imageRenderHeight);
            newOverlay.setBase(1);
            newOverlay.setDefaultGap(2);
            newOverlay.labels.hidden = true;
            newOverlay.numbers.hidden = false;
            newOverlay.isChannelMap = true;
            newOverlay.global = overlay.global;
            newOverlay.grid = overlay.grid;
            newOverlay.border = overlay.border;
            newOverlay.axes = overlay.axes;
            newOverlay.numbers = overlay.numbers;
            newOverlay.ticks = overlay.ticks;
            newOverlay.colorbar = overlay.colorbar;
            newOverlay.beam = overlay.beam;
            this.setOverlayStores(newOverlay);
        }

        return this.overlayStores.corner;
    }

    @computed get numChannels(): number {
        return this.numColumns * this.numRows;
    }

    @computed get channelRange(): number {
        return Math.min(this.startChannel + this.numChannels - 1, this.masterFrame?.frameInfo?.fileInfoExtended?.depth - 1);
    }

    @computed get channelArray(): number[] {
        const channelArray = [];
        for (let i = this.startChannel; i < this.startChannel + this.numChannels; i += 1) {
            if (i > this.masterFrame.frameInfo.fileInfoExtended.depth - 1) {
                break;
            }
            channelArray.push(i);
        }
        return channelArray;
    }

    @computed get auxiliaryFrame(): FrameStore {
        if (!this._auxiliaryFrame && this.masterFrame?.spatialSiblings[0]) {
            return this.masterFrame?.spatialSiblings[0];
        } else {
            return this._auxiliaryFrame;
        }
    }
}
