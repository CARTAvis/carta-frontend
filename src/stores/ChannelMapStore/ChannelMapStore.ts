import {debounce, throttle} from "lodash";
import {action, autorun, computed, makeObservable, observable, reaction} from "mobx";

import {ImageType} from "enums";
import {type ImageViewItem} from "models";
import {TileService} from "services";
import {AppStore, type FrameStore} from "stores";

export class ChannelMapStore {
    private static staticInstance: ChannelMapStore;

    public static get Instance() {
        if (!ChannelMapStore.staticInstance) {
            ChannelMapStore.staticInstance = new ChannelMapStore();
        }
        return ChannelMapStore.staticInstance;
    }

    /** The default color used for rendering the channel map label. */
    public static readonly DEFAULT_LABEL_COLOR = "auto-light_gray";

    constructor() {
        makeObservable(this);
        ChannelMapStore.staticInstance = this;

        autorun(() => {
            if (this.displayedFrame?.requiredFrameView && this.isChannelMapEnabled) {
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

                this.throttledRequestChannels(this.displayedFrame);
            }
        });

        reaction(
            () => this.channelArray,
            channelArray => {
                const channel = this.displayedFrame?.channel;
                if (this.isChannelMapEnabled && channel !== undefined && !channelArray.includes(channel)) {
                    this.debouncedSetActiveChannel(channelArray[0]);
                }
            }
        );

        reaction(
            () => this.displayedFrame?.requiredChannel,
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
    @observable isChannelMapEnabled: boolean = false;
    /** Indicates whether to show the channel string. */
    @observable shouldShowChannelString: boolean = false;
    /** Indicates whether to show the frequency string. */
    @observable shouldShowFrequencyString: boolean = false;
    /** Indicates whether to show the velocity string. */
    @observable shouldShowVelocityString: boolean = false;
    /** Indicates whether to show the unit of the frequency string. */
    @observable shouldShowFrequencyStringUnit: boolean = true;
    /** Indicates whether to show the unit of the velocity string. */
    @observable shouldShowVelocityStringUnit: boolean = true;
    /** Font index used for rendering the channel map label. */
    @observable font: number = 0;
    /** Font size in pixels used for rendering the channel map label. */
    @observable fontSize: number = 12;
    /** Indicates whether to use a custom color for rendering the channel map label. */
    @observable hasCustomColor: boolean = false;
    /** The custom color used for rendering the channel map label. */
    @observable color: string = ChannelMapStore.DEFAULT_LABEL_COLOR;

    /** The increment between displayed channels, shared with the animator. */
    get channelStep(): number {
        return AppStore.Instance.animatorStore.step;
    }

    private throttledRequestChannels = throttle((frame: FrameStore) => this.requestChannels(frame), 100);
    private debouncedSetActiveChannel = debounce((channel: number) => this.displayedFrame?.setChannel(channel), 200);

    /**
     * Clears the cache and requests new tiles when the polarization changes.
     * @param frame - the frame to request tiles for.
     */
    handlePolarizationChanged = (frame: FrameStore) => this.requestChannels(frame, true);

    private requestChannels = (frame: FrameStore, isPolarizationChanged: boolean = false) => {
        if (!this.isChannelMapEnabled) {
            return;
        }
        const [tiles, midPointTileCoords] = frame.requiredTiles;
        const preferenceStore = AppStore.Instance.preferenceStore;
        const bunitVariant = ["km/s", "km s-1", "km s^-1", "km.s-1"];
        const compressionQuality = frame.headerUnit && bunitVariant.includes(frame.headerUnit) ? Math.max(preferenceStore.imageCompressionQuality, 32) : preferenceStore.imageCompressionQuality;
        TileService.Instance.requestChannelMapTiles(tiles, frame, midPointTileCoords, compressionQuality, this.channelArray, isPolarizationChanged);
    };

    requestTilesAfterSessionResume = () => {
        if (this.displayedFrame) {
            this.requestChannels(this.displayedFrame);
        }
    };

    /**
     * Enables or disables the channel map mode.
     * @param isEnabled - Whether to enable the channel map mode.
     */
    @action setChannelMapEnabled = (isEnabled: boolean) => {
        const isDisablingChannelMap = this.isChannelMapEnabled && !isEnabled;
        this.isChannelMapEnabled = isEnabled;
        if (!isEnabled) {
            this.throttledRequestChannels.cancel();
            this.debouncedSetActiveChannel.cancel();
            TileService.Instance.cancelChannelMapRequests();
            if (isDisablingChannelMap) {
                const updates = AppStore.Instance.imageViewConfigStore.visibleFrames.map(frame => ({frame, channel: frame.channel, stokes: frame.stokes}));
                AppStore.Instance.updateChannels(updates);
            }
        }
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
        this.setStartChannel(this.startChannel - this.channelStep);
    }

    /** Sets the first channel at the top-left corner to the next channel. */
    @action setNextChannel() {
        this.setStartChannel(this.startChannel + this.channelStep);
    }

    /** Moves to the previous page of channels. */
    @action setPrevPage() {
        const newStart = this.startChannel - this.numChannels * this.channelStep;

        if (newStart >= 0) {
            this.setStartChannel(newStart);
        }
    }

    /** Moves to the next page of channels. */
    @action setNextPage() {
        const newStart = this.startChannel + this.numChannels * this.channelStep;

        if (newStart >= 0) {
            this.setStartChannel(newStart);
        }
    }

    /** Sets the increment between displayed channels. */
    @action setChannelStep(channelStep: number) {
        if (Number.isInteger(channelStep) && channelStep > 0 && channelStep <= this.totalChannelNum && channelStep <= AppStore.Instance.animatorStore.maxStep) {
            AppStore.Instance.animatorStore.setStep(channelStep);
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
     * @param shouldShow - True to show, false to hide.
     */
    @action setShowChannelString = (shouldShow: boolean) => {
        this.shouldShowChannelString = shouldShow;
    };

    /**
     * Show or hide the frequency string.
     * @param shouldShow - True to show, false to hide.
     */
    @action setShowFrequencyString = (shouldShow: boolean) => {
        this.shouldShowFrequencyString = shouldShow;
    };

    /**
     * Show or hide the velocity string.
     * @param shouldShow - True to show, false to hide.
     */
    @action setShowVelocityString = (shouldShow: boolean) => {
        this.shouldShowVelocityString = shouldShow;
    };

    /**
     * Show or hide the unit of the frequency string.
     * @param shouldShow - True to show, false to hide.
     */
    @action setShowFrequencyStringUnit = (shouldShow: boolean) => {
        this.shouldShowFrequencyStringUnit = shouldShow;
    };

    /**
     * Show or hide the unit of the velocity string.
     * @param shouldShow - True to show, false to hide.
     */
    @action setShowVelocityStringUnit = (shouldShow: boolean) => {
        this.shouldShowVelocityStringUnit = shouldShow;
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
     * @param hasCustomColor - True to use a custom color, false to use the default color.
     */
    @action setCustomColor = (hasCustomColor: boolean) => {
        this.hasCustomColor = hasCustomColor;
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
        const availableChannels = Math.max(0, this.totalChannelNum - this.startChannel);
        const displayedChannelCount = Math.min(this.numChannels, Math.ceil(availableChannels / this.channelStep));
        return this.startChannel + Math.max(0, displayedChannelCount - 1) * this.channelStep;
    }

    /** The displayed channels in the image view. */
    @computed get channelArray(): number[] {
        return Array.from({length: this.endChannel >= this.startChannel ? Math.floor((this.endChannel - this.startChannel) / this.channelStep) + 1 : 0}, (_, i) => this.startChannel + i * this.channelStep);
    }
}
