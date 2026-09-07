import {debounce, throttle} from "lodash";
import {action, autorun, computed, makeObservable, observable, reaction} from "mobx";

import {ImageType, SpectralType} from "enums";
import {type ImageViewItem} from "models";
import {TileService} from "services";
import {AppStore, type FrameStore} from "stores";
import {getTransformedChannelList} from "utilities";

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
                // Track every value that can change the tiles required by any displayed layer.
                void this.channelArray;
                void this.displayedFrame.spectralSiblings;
                void AppStore.Instance.spectralMatchingType;
                this.displayedFrames.forEach(frame => {
                    void frame.center;
                    void frame.requiredFrameView;
                    void frame.requiredTiles;
                    void frame.zoomLevel;
                    void frame.spatialReference;
                    void frame.channel;
                    void frame.stokes;
                    void frame.wcsInfo3D;
                    void frame.frameInfo.fileInfoExtended.depth;
                });

                this.throttledRequestChannels();
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

    private requestedFileIds = new Set<number>();
    private throttledRequestChannels = throttle(() => this.requestDisplayedChannels(), 100);
    private debouncedSetActiveChannel = debounce((channel: number) => this.displayedFrame?.setChannel(channel), 200);

    /**
     * Clears the cache and requests new tiles when the polarization changes.
     * @param frame - the frame to request tiles for.
     */
    handlePolarizationChanged = (frame: FrameStore) => {
        if (this.displayedFrames.includes(frame)) {
            this.requestChannels(frame, true);
        }
    };

    private requestChannels = (frame: FrameStore, isPolarizationChanged: boolean = false) => {
        if (!this.isChannelMapEnabled) {
            return;
        }
        const requestedChannels = Array.from(new Set(this.getChannelsForFrame(frame).filter((channel): channel is number => channel !== null)));
        if (!requestedChannels.length) {
            TileService.Instance.cancelChannelMapRequests(frame.frameInfo.fileId);
            return;
        }
        const [tiles, midPointTileCoords] = frame.requiredTiles;
        const preferenceStore = AppStore.Instance.preferenceStore;
        const bunitVariant = ["km/s", "km s-1", "km s^-1", "km.s-1"];
        const compressionQuality = frame.headerUnit && bunitVariant.includes(frame.headerUnit) ? Math.max(preferenceStore.imageCompressionQuality, 32) : preferenceStore.imageCompressionQuality;
        TileService.Instance.requestChannelMapTiles(tiles, frame, midPointTileCoords, compressionQuality, requestedChannels, isPolarizationChanged);
    };

    private requestDisplayedChannels = () => {
        if (!this.isChannelMapEnabled) {
            return;
        }

        const displayedFileIds = new Set(this.displayedFrames.map(frame => frame.frameInfo.fileId));
        this.requestedFileIds.forEach(fileId => {
            if (!displayedFileIds.has(fileId)) {
                TileService.Instance.cancelChannelMapRequests(fileId);
            }
        });
        this.requestedFileIds = displayedFileIds;
        this.displayedFrames.forEach(frame => this.requestChannels(frame));
    };

    requestTilesAfterSessionResume = () => {
        this.requestDisplayedChannels();
    };

    /**
     * Enables or disables the channel map mode.
     * @param isEnabled - Whether to enable the channel map mode.
     */
    @action setChannelMapEnabled = (isEnabled: boolean) => {
        if (isEnabled && !this.isChannelMapEnabled) {
            AppStore.Instance.animatorStore.stopAnimation();
        }
        const isDisablingChannelMap = this.isChannelMapEnabled && !isEnabled;
        this.isChannelMapEnabled = isEnabled;
        if (!isEnabled) {
            this.throttledRequestChannels.cancel();
            this.debouncedSetActiveChannel.cancel();
            TileService.Instance.cancelChannelMapRequests();
            this.requestedFileIds.clear();
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
        const frame = this.displayedFrame;
        if (this.isChannelMapEnabled && frame && frame.channel !== startChannel) {
            frame.setChannel(startChannel);
            frame.channel = startChannel;
        }
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
        return this.displayedFrames[0] ?? null;
    }

    /** The frames contributing raster layers to the displayed image. */
    @computed get displayedFrames(): FrameStore[] {
        if (this.displayedImage?.type === ImageType.FRAME) {
            return [this.displayedImage.store];
        }
        if (this.displayedImage?.type === ImageType.COLOR_BLENDING) {
            return this.displayedImage.store.frames;
        }
        return [];
    }

    /**
     * The channel rendered by a frame in each channel-map cell.
     * Spectrally matched frames follow the base frame; unmatched frames keep their selected channel.
     * A null entry means that the matched channel falls outside the frame.
     */
    getChannelsForFrame(frame: FrameStore): Array<number | null> {
        const baseFrame = this.displayedFrame;
        if (!baseFrame || frame === baseFrame) {
            return this.channelArray;
        }
        if (!baseFrame.spectralSiblings.includes(frame)) {
            return this.channelArray.map(() => frame.channel);
        }

        if (AppStore.Instance.spectralMatchingType === SpectralType.CHANNEL) {
            return this.channelArray.map(channel => (channel < frame.frameInfo.fileInfoExtended.depth ? channel : null));
        }

        const depth = frame.frameInfo.fileInfoExtended.depth;
        const firstChannel = this.channelArray[0];
        const lastChannel = this.channelArray[this.channelArray.length - 1];
        const transformedChannels = getTransformedChannelList(baseFrame.wcsInfo3D, frame.wcsInfo3D, AppStore.Instance.spectralMatchingType, firstChannel, lastChannel);
        return this.channelArray.map(channel => {
            const transformedChannel = transformedChannels[channel - firstChannel];
            if (!isFinite(transformedChannel) || transformedChannel < -0.5 || transformedChannel > depth - 0.5) {
                return null;
            }
            return Math.round(transformedChannel);
        });
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
