import {debounce, throttle} from "lodash";
import {action, autorun, computed, makeObservable, observable, reaction} from "mobx";

import {ImageType, ImageViewItem} from "models";
import {TileService} from "services";
import {AppStore, FrameStore} from "stores";

export class ChannelMapStore {
    private static staticInstance: ChannelMapStore;

    static get Instance() {
        if (!ChannelMapStore.staticInstance) {
            ChannelMapStore.staticInstance = new ChannelMapStore();
        }
        return ChannelMapStore.staticInstance;
    }

    /** The default color used for rendering the channel map label. */
    static readonly DefaultLabelColor = "auto-light_gray";

    constructor() {
        makeObservable(this);
        ChannelMapStore.staticInstance = this;

        autorun(() => {
            if (this.displayedFrame?.requiredFrameView && this.channelMapEnabled) {
                /* eslint-disable @typescript-eslint/no-unused-vars */
                const startChannel = this.startChannel;
                const numColumns = this.numColumns;
                const numRows = this.numRows;
                const endChannel = this.endChannel;
                const center = this.displayedFrame.center;
                const requiredFrameView = this.displayedFrame.requiredFrameView;
                const requiredTiles = this.displayedFrame.requiredTiles;
                const zoomLevel = this.displayedFrame.zoomLevel;
                const spatialReference = this.displayedFrame.spatialReference;
                const channel = this.displayedFrame.channel;
                /* eslint-disable @typescript-eslint/no-unused-vars */
                this.throttledRequestChannels(this.displayedFrame);
            }
        });

        reaction(
            () => this.channelArray,
            channelArray => {
                const channel = this.displayedFrame?.channel;
                if (this.channelMapEnabled && channel !== undefined && !channelArray.includes(channel)) {
                    this.debouncedSetActiveChannel(channelArray[0]);
                }
            }
        );

        reaction(
            () => this.displayedFrame?.channel,
            channel => {
                if (channel === undefined) {
                    this.setStartChannel(0);
                } else if (!this.channelArray.includes(channel)) {
                    this.setStartChannel(channel);
                }
            }
        );
    }

    /** The threshold value below which pixels are displayed in grayscale. */
    @observable pixelHighlightValue: number = NaN;
    /** The first channel at the top-left corner. */
    @observable startChannel: number = 0;
    /** The number of columns in the image view. */
    @observable numColumns: number = 2;
    /** The number of rows in the image view. */
    @observable numRows: number = 2;
    /** Indicates whether the channel map mode is enabled. */
    @observable channelMapEnabled: boolean = false;
    /** Indicates whether to show the channel string. */
    @observable showChannelString: boolean = false;
    /** Indicates whether to show the frequency string. */
    @observable showFrequencyString: boolean = false;
    /** Indicates whether to show the velocity string. */
    @observable showVelocityString: boolean = false;
    /** Indicates whether to show the unit of the frequency string. */
    @observable showFrequencyStringUnit: boolean = true;
    /** Indicates whether to show the unit of the velocity string. */
    @observable showVelocityStringUnit: boolean = true;
    /** Font index used for rendering the channel map label. */
    @observable font: number = 0;
    /** Font size in pixels used for rendering the channel map label. */
    @observable fontSize: number = 12;
    /** Indicates whether to use a custom color for rendering the channel map label. */
    @observable customColor: boolean = false;
    /** The custom color used for rendering the channel map label. */
    @observable color: string = ChannelMapStore.DefaultLabelColor;

    private throttledRequestChannels = throttle((frame: FrameStore) => this.requestChannels(frame), 100);
    private debouncedSetActiveChannel = debounce((channel: number) => this.displayedFrame?.setChannel(channel), 200);

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
     * Sets the number of columns in the image view.
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

    /**
     * Sets the threshold value below which pixels are displayed in grayscale.
     * @param val - Threshold value.
     */
    @action setPixelHighlightValue = (val: number) => {
        if (!AppStore.Instance.isExportingImage) {
            this.pixelHighlightValue = val;
        }
    };

    /**
     * Show or hide the channel string.
     * @param show - True to show, false to hide.
     */
    @action setShowChannelString = (show: boolean) => {
        this.showChannelString = show;
    };

    /**
     * Show or hide the frequency string.
     * @param show - True to show, false to hide.
     */
    @action setShowFrequencyString = (show: boolean) => {
        this.showFrequencyString = show;
    };

    /**
     * Show or hide the velocity string.
     * @param show - True to show, false to hide.
     */
    @action setShowVelocityString = (show: boolean) => {
        this.showVelocityString = show;
    };

    /**
     * Show or hide the unit of the frequency string.
     * @param show - True to show, false to hide.
     */
    @action setShowFrequencyStringUnit = (show: boolean) => {
        this.showFrequencyStringUnit = show;
    };

    /**
     * Show or hide the unit of the velocity string.
     * @param show - True to show, false to hide.
     */
    @action setShowVelocityStringUnit = (show: boolean) => {
        this.showVelocityStringUnit = show;
    };

    /**
     * Sets the font index used for rendering the channel map label.
     * @param font - Font index.
     */
    @action setFont = (font: number) => {
        this.font = font;
    };

    /**
     * Sets the font size in pixels used for rendering the channel map label.
     * @param fontSize - Font size in pixels.
     */
    @action setFontSize = (fontSize: number) => {
        this.fontSize = fontSize;
    };

    /**
     * Sets whether to use a custom color for rendering the channel map label.
     * @param customColor - True to use a custom color, false to use the default color.
     */
    @action setCustomColor = (customColor: boolean) => {
        this.customColor = customColor;
    };

    /**
     * Sets the color used for rendering the channel map label.
     * @param color - The custom color.
     */
    @action setColor = (color: string) => {
        this.color = color;
    };

    /** The displayed image in the image view. */
    @computed get displayedImage(): ImageViewItem | null {
        const visibleImages = AppStore.Instance.imageViewConfigStore.visibleImages;
        return visibleImages.length > 0 ? visibleImages[0] : null;
    }

    /** The frame of the displayed image in the image view. */
    @computed get displayedFrame(): FrameStore | null {
        if (!this.displayedImage) {
            return null;
        }

        const type = this.displayedImage.type;
        if (type === ImageType.FRAME) {
            return this.displayedImage.store;
        } else if (type === ImageType.COLOR_BLENDING) {
            return this.displayedImage.store.baseFrame;
        }

        return null;
    }

    /** The number of channels of the displayed image. Returns 1 if the information is unavailable. */
    @computed get totalChannelNum(): number {
        return this.displayedFrame?.frameInfo?.fileInfoExtended?.depth ?? 1;
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
