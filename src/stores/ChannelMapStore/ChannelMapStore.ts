import {throttle} from "lodash";
import {action, autorun, computed, makeObservable, observable} from "mobx";

import {ImageItem, ImageType} from "models";
import {TileService} from "services";
import {AppStore, FrameStore} from "stores";

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

        autorun(() => {
            if (this.masterFrame && this.masterFrame?.requiredFrameView && this.channelMapEnabled) {
                /* eslint-disable @typescript-eslint/no-unused-vars */
                const startChannel = this.startChannel;
                const numColumns = this.numColumns;
                const numRows = this.numRows;
                const channelRange = this.endChannel;
                const center = this.masterFrame.center;
                const requiredFrameView = this.masterFrame.requiredFrameView;
                const requiredTiles = this.masterFrame.requiredTiles;
                const zoomLevel = this.masterFrame.zoomLevel;
                const spatialReference = this.masterFrame.spatialReference;
                const channel = this.masterFrame.channel;
                /* eslint-disable @typescript-eslint/no-unused-vars */
                this.throttledRequestChannels(this.masterFrame);
            }
        });
    }

    @observable masterFrame: FrameStore;
    @observable startChannel: number = 0;
    @observable numColumns: number;
    @observable numRows: number;
    @observable channelMapEnabled: boolean = false;

    @observable showChannelString: boolean = false;
    @observable showSpectralString: boolean = false;
    @observable showVelocityString: boolean = false;
    @observable showChannelStringLabel: boolean = false;
    @observable showSpectralStringLabel: boolean = false;
    @observable showVelocityStringLabel: boolean = false;

    @action throttledRequestChannels = throttle((frame: FrameStore) => {
        const [tiles, midPointTileCoords] = frame.requiredTiles;
        const preferenceStore = AppStore.Instance.preferenceStore;
        const bunitVariant = ["km/s", "km s-1", "km s^-1", "km.s-1"];
        const compressionQuality = frame.headerUnit && bunitVariant.includes(frame.headerUnit) ? Math.max(preferenceStore.imageCompressionQuality, 32) : preferenceStore.imageCompressionQuality;
        TileService.Instance.requestChannelMapTiles(tiles, this.masterFrame, midPointTileCoords, compressionQuality, {min: this.startChannel, max: this.endChannel});
    }, 100);

    @action setMasterFrame(masterFrame: FrameStore) {
        this.masterFrame = masterFrame;
    }

    @action setChannelMapEnabled = (enabled: boolean) => {
        this.channelMapEnabled = enabled;
    };

    @action setStartChannel(startChannel: number) {
        // Add checks for valid startChannel number for the masterFrame
        if (startChannel < 0 || startChannel > this.masterFrame.frameInfo.fileInfoExtended.depth - 1) {
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

    @action setShowChannelString = (show: boolean) => {
        this.showChannelString = show;
    };

    @action setShowSpectralString = (show: boolean) => {
        this.showSpectralString = show;
    };

    @action setShowVelocityString = (show: boolean) => {
        this.showVelocityString = show;
    };

    @action setShowChannelStringLabel = (show: boolean) => {
        this.showChannelStringLabel = show;
    };

    @action setShowSpectralStringLabel = (show: boolean) => {
        this.showSpectralStringLabel = show;
    };

    @action setShowVelocityStringLabel = (show: boolean) => {
        this.showVelocityStringLabel = show;
    };

    @computed get numChannels(): number {
        return this.numColumns * this.numRows;
    }

    @computed get endChannel(): number {
        return Math.min(this.startChannel + this.numChannels - 1, this.masterFrame?.frameInfo?.fileInfoExtended?.depth - 1);
    }

    @computed get channelArray(): number[] {
        const channelArray: number[] = [];
        for (let i = this.startChannel; i < this.startChannel + this.numChannels; i += 1) {
            if (i > this.masterFrame?.frameInfo?.fileInfoExtended.depth - 1) {
                break;
            }
            channelArray.push(i);
        }
        return channelArray;
    }

    @computed get masterImage(): ImageItem {
        return {
            type: ImageType.FRAME,
            store: this.masterFrame
        };
    }
}
