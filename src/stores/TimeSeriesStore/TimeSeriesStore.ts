import {action, computed, makeObservable} from "mobx";

import {ImageType} from "enums";
import {AppStore} from "stores";
import {type FrameStore} from "stores/Frame";
import {formatMjdUtcAsIso} from "utilities";

/** An element of the virtual time-series axis. */
export interface TimeSeriesElement {
    /** The image the element belongs to. */
    frame: FrameStore;
    /** The observation time as MJD in UTC. */
    mjdUtc: number;
    /** The observation time as an ISO-8601 string in UTC. */
    isoUtc: string;
}

/**
 * Manages the virtual time-series axis: an ordered mapping over the spatially matched
 * images, sorted by observation time.
 */
export class TimeSeriesStore {
    private static staticInstance: TimeSeriesStore;

    public static get Instance(): TimeSeriesStore {
        if (!TimeSeriesStore.staticInstance) {
            TimeSeriesStore.staticInstance = new TimeSeriesStore();
        }
        return TimeSeriesStore.staticInstance;
    }

    /** The spatially matched images (reference and secondary images), excluding previews. */
    @computed get matchedFrames(): FrameStore[] {
        const spatialReference = AppStore.Instance.spatialReference;
        if (!spatialReference) {
            return [];
        }
        return [spatialReference, ...spatialReference.secondarySpatialImages].filter(frame => !frame.isPreview);
    }

    /**
     * The virtual time-series axis, sorted by ascending observation time. Spatially matched
     * images without a valid observation time are excluded.
     */
    @computed get elements(): TimeSeriesElement[] {
        return this.matchedFrames
            .flatMap(frame => {
                const mjdUtc = frame.obsTimeMjdUtc;
                return mjdUtc === undefined ? [] : [{frame, mjdUtc, isoUtc: formatMjdUtcAsIso(mjdUtc, 6)}];
            })
            .sort((a, b) => a.mjdUtc - b.mjdUtc || a.frame.id - b.frame.id);
    }

    /** The index of the active loaded image, or -1 when the active item is not in the series. */
    @computed get currentIndex(): number {
        const activeImage = AppStore.Instance.activeImage;
        if (activeImage?.type !== ImageType.FRAME) {
            return -1;
        }
        return this.elements.findIndex(element => element.frame === activeImage.store);
    }

    /** The element matching the active image. */
    @computed get currentElement(): TimeSeriesElement | undefined {
        return this.elements[this.currentIndex];
    }

    /** Switches the active image to the given element of the series. */
    @action setIndex = (index: number) => {
        const element = this.elements[index];
        if (!element) {
            return;
        }
        const appStore = AppStore.Instance;
        const activeImage = appStore.activeImage;
        if (activeImage?.type !== ImageType.FRAME || activeImage.store !== element.frame) {
            appStore.setActiveImageById(ImageType.FRAME, element.frame.id);
        }
    };

    /** Selects the first time-series element when the active image is outside the series. */
    @action ensureActiveElement = () => {
        if (this.currentIndex < 0) {
            this.first();
        }
    };

    @action next = () => {
        const count = this.elements.length;
        if (count > 0) {
            this.setIndex((this.currentIndex + 1) % count);
        }
    };

    @action prev = () => {
        const count = this.elements.length;
        if (count > 0) {
            const index = this.currentIndex <= 0 ? count - 1 : this.currentIndex - 1;
            this.setIndex(index);
        }
    };

    @action first = () => {
        this.setIndex(0);
    };

    @action last = () => {
        this.setIndex(this.elements.length - 1);
    };

    private constructor() {
        makeObservable(this);
    }
}
