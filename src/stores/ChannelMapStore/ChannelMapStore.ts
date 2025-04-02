import {debounce, throttle} from "lodash";
import {action, autorun, computed, makeObservable, observable, reaction} from "mobx";

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

        autorun(() => {
            const activeFrame = AppStore.Instance.activeFrame;
            if (activeFrame?.requiredFrameView && this.channelMapEnabled) {
                /* eslint-disable @typescript-eslint/no-unused-vars */
                const startChannel = this.startChannel;
                const numColumns = this.numColumns;
                const numRows = this.numRows;
                const endChannel = this.endChannel;
                const center = activeFrame.center;
                const requiredFrameView = activeFrame.requiredFrameView;
                const requiredTiles = activeFrame.requiredTiles;
                const zoomLevel = activeFrame.zoomLevel;
                const spatialReference = activeFrame.spatialReference;
                const channel = activeFrame.channel;
                /* eslint-disable @typescript-eslint/no-unused-vars */
                this.throttledRequestChannels(activeFrame);
            }
        });

        reaction(
            () => this.channelArray,
            channelArray => {
                const channel = AppStore.Instance.activeFrame?.channel;
                if (this.channelMapEnabled && Number.isFinite(channel) && !channelArray.includes(channel)) {
                    this.debouncedSetAciveChannel(channelArray[0]);
                }
            }
        );

        reaction(
            () => AppStore.Instance.activeFrame?.channel,
            channel => {
                if (Number.isFinite(channel) && !this.channelArray.includes(channel)) {
                    this.setStartChannel(channel);
                }
            }
        );
    }

    /** The first channel at the top-left corner. */
    @observable startChannel: number = 0;
    /** The number of columns in the image view. */
    @observable numColumns: number = 2;
    /** The number of rows in the image view. */
    @observable numRows: number = 2;
    /** Indicates whether the channel map mode is enabled. */
    @observable channelMapEnabled: boolean = false;

    @observable showChannelString: boolean = false;
    @observable showSpectralString: boolean = false;
    @observable showVelocityString: boolean = false;
    @observable showChannelStringLabel: boolean = false;
    @observable showSpectralStringLabel: boolean = false;
    @observable showVelocityStringLabel: boolean = false;

    private throttledRequestChannels = throttle((frame: FrameStore) => this.requestChannels(frame), 100);
    private debouncedSetAciveChannel = debounce((channel: number) => AppStore.Instance.activeFrame?.setChannel(channel), 200);

    /**
     * Clears the cache and requests new tiles when the polarization changes.
     * @param frame - the frame to request tiles for.
     */
    handlePolarizationChanged = (frame: FrameStore) => this.requestChannels(frame, true);

    private requestChannels = (frame: FrameStore, polarizationChanged: boolean = false) => {
        const [tiles, midPointTileCoords] = frame.requiredTiles;
        const preferenceStore = AppStore.Instance.preferenceStore;
        const bunitVariant = ["km/s", "km s-1", "km s^-1", "km.s-1"];
        const compressionQuality = frame.headerUnit && bunitVariant.includes(frame.headerUnit) ? Math.max(preferenceStore.imageCompressionQuality, 32) : preferenceStore.imageCompressionQuality;
        TileService.Instance.requestChannelMapTiles(tiles, frame, midPointTileCoords, compressionQuality, {min: this.startChannel, max: this.endChannel}, polarizationChanged);
    };

    /**
     * Enables or disables the channel map mode.
     * @param enabled - Whether to enable the channel map mode.
     */
    @action setChannelMapEnabled = (enabled: boolean) => {
        this.channelMapEnabled = enabled;
    };

    /**
     * Sets the first channel at the top-left corner. Skips when the channel is out of range.
     * @param startChannel - The first channel at the top-left corner.
     */
    @action setStartChannel(startChannel: number) {
        // Add checks for valid startChannel number for the masterFrame
        if (startChannel < 0 || startChannel > this.totalChannelNum - 1) {
            return;
        }
        this.startChannel = startChannel;
    }

    /** Sets the first channel at the top-left corner to the previous channel. */
    @action setPrevChannel() {
        this.setStartChannel(this.startChannel - 1);
    }

    /** Sets the first channel at the top-left corner to the next channel. */
    @action setNextChannel() {
        this.setStartChannel(this.startChannel + 1);
    }

    /** Moves to the previous page of channels. */
    @action setPrevPage() {
        const newStart = this.startChannel - this.numChannels;

        if (newStart >= 0) {
            this.setStartChannel(newStart);
        }
    }

    /** Moves to the next page of channels. */
    @action setNextPage() {
        const newStart = this.startChannel + this.numChannels;

        if (newStart >= 0) {
            this.setStartChannel(newStart);
        }
    }

    /**
     * Sets the number of columns in the image vew.
     * @param numColumns - The number of columns in the image view.
     */
    @action setNumColumns(numColumns: number) {
        if (isFinite(numColumns) && numColumns > 0) {
            this.numColumns = numColumns;
        }
    }

    /**
     * Sets the number of rows in the image view.
     * @param numRows - The number of rows in the image view.
     */
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

    /** The number of channels of the active image. Returns 1 if the information is unavailable. */
    @computed private get totalChannelNum(): number {
        return AppStore.Instance.activeFrame?.frameInfo?.fileInfoExtended?.depth ?? 1;
    }

    /** The number of panels in the image view. */
    @computed get numChannels(): number {
        return this.numColumns * this.numRows;
    }

    /** The last channel in the image view. */
    @computed get endChannel(): number {
        return Math.min(this.startChannel + this.numChannels - 1, this.totalChannelNum - 1);
    }

    /** The displayed channels in the image view. */
    @computed get channelArray(): number[] {
        return Array.from({length: this.endChannel - this.startChannel + 1}, (_, i) => this.startChannel + i);
    }
}
