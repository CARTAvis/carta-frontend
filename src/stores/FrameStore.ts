import {action, computed, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {OverlayStore} from "./OverlayStore";
import {RenderConfigStore} from "./RenderConfigStore";
import {Point2D, FrameView, SpectralInfo, ChannelInfo, CHANNEL_TYPES} from "models";
import {clamp, frequencyStringFromVelocity, velocityStringFromFrequency} from "utilities";

export class FrameInfo {
    fileId: number;
    fileInfo: CARTA.FileInfo;
    fileInfoExtended: CARTA.FileInfoExtended;
    renderMode: CARTA.RenderMode;
}

export class FrameStore {
    @observable frameInfo: FrameInfo;
    @observable renderHiDPI: boolean;
    @observable wcsInfo: number;
    @observable validWcs: boolean;
    @observable center: Point2D;
    @observable centerY: number;
    @observable zoomLevel: number;
    @observable stokes: number;
    @observable channel: number;
    @observable requiredStokes: number;
    @observable requiredChannel: number;
    @observable currentFrameView: FrameView;
    @observable currentCompressionQuality: number;
    @observable renderConfig: RenderConfigStore;
    @observable rasterData: Float32Array;
    @observable overviewRasterData: Float32Array;
    @observable overviewRasterView: FrameView;
    @observable valid: boolean;

    private overlayStore: OverlayStore;

    constructor(overlay: OverlayStore) {
        this.overlayStore = overlay;
        this.renderHiDPI = false;
        this.center = {x: 0, y: 0};
        this.stokes = 0;
        this.channel = 0;
        this.requiredStokes = 0;
        this.requiredChannel = 0;
        this.renderConfig = new RenderConfigStore();
    }

    @computed get requiredFrameView(): FrameView {
        // If there isn't a valid zoom, return a dummy view
        if (this.zoomLevel <= 0 || this.renderWidth <= 0 || this.renderHeight <= 0) {
            return {
                xMin: 0,
                xMax: 1,
                yMin: 0,
                yMax: 1,
                mip: 1,
            };
        }

        const pixelRatio = this.renderHiDPI ? devicePixelRatio : 1.0;
        // Required image dimensions
        const imageWidth = pixelRatio * this.renderWidth / this.zoomLevel;
        const imageHeight = pixelRatio * this.renderHeight / this.zoomLevel;

        const mipExact = Math.max(1.0, 1.0 / this.zoomLevel);
        const mipRounded = (mipExact % 1.0 < 0.25) ? Math.floor(mipExact) : Math.ceil(mipExact);

        const requiredView = {
            xMin: this.center.x - imageWidth / 2.0,
            xMax: this.center.x + imageWidth / 2.0,
            yMin: this.center.y - imageHeight / 2.0,
            yMax: this.center.y + imageHeight / 2.0,
            mip: mipRounded
        };
        return requiredView;
    }

    @computed get renderWidth() {
        return this.overlayStore.viewWidth - this.overlayStore.padding.left - this.overlayStore.padding.right;
    }

    @computed get renderHeight() {
        return this.overlayStore.viewHeight - this.overlayStore.padding.top - this.overlayStore.padding.bottom;
    }

    @computed get unit() {
        if (!this.frameInfo || !this.frameInfo.fileInfoExtended || !this.frameInfo.fileInfoExtended.headerEntries) {
            return undefined;
        } else {
            const unitHeader = this.frameInfo.fileInfoExtended.headerEntries.filter(entry => entry.name === "BUNIT");
            if (unitHeader.length) {
                return unitHeader[0].value;
            } else {
                return undefined;
            }
        }
    }

    @computed get beamProperties(): { x: number, y: number, angle: number } {
        const bMajHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf("BMAJ") !== -1);
        const bMinHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf("BMIN") !== -1);
        const bpaHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf("BPA") !== -1);
        const unitHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf("CUNIT1") !== -1);
        const deltaHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf("CDELT1") !== -1);

        if (bMajHeader && bMinHeader && bpaHeader && unitHeader && deltaHeader) {
            let bMaj = parseFloat(bMajHeader.value);
            let bMin = parseFloat(bMinHeader.value);
            const bpa = parseFloat(bpaHeader.value);
            const unit = unitHeader.value.trim();
            const delta = parseFloat(deltaHeader.value);

            if (isFinite(bMaj) && bMaj > 0 && isFinite(bMin) && bMin > 0 && isFinite(bpa) && isFinite(delta) && unit === "deg" || unit === "rad") {
                return {
                    x: bMaj / Math.abs(delta),
                    y: bMin / Math.abs(delta),
                    angle: bpa
                };
            }
            return null;
        }
        return null;
    }

    @computed get referenceFrequency(): number {
        if (!this.frameInfo || !this.frameInfo.fileInfoExtended || this.frameInfo.fileInfoExtended.depth <= 1 || !this.frameInfo.fileInfoExtended.headerEntries) {
            return undefined;
        }
        const restFreqHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`RESTFRQ`) !== -1);
        if (restFreqHeader) {
            const restFreqVal = parseFloat(restFreqHeader.value);
            if (isFinite(restFreqVal)) {
                return restFreqVal;
            }
        }

        return undefined;
    }

    @computed get channelInfo(): ChannelInfo {
        if (!this.frameInfo || !this.frameInfo.fileInfoExtended || this.frameInfo.fileInfoExtended.depth <= 1 || !this.frameInfo.fileInfoExtended.headerEntries) {
            return undefined;
        }
        const N = this.frameInfo.fileInfoExtended.depth;
        const values = new Array<number>(N);
        const rawValues = new Array<number>(N);

        // By default, we try to use the WCS information to determine channel info.
        const channelTypeInfo = FrameStore.FindChannelType(this.frameInfo.fileInfoExtended.headerEntries);
        if (channelTypeInfo) {
            const refPixHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`CRPIX${channelTypeInfo.dimension}`) !== -1);
            const refValHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`CRVAL${channelTypeInfo.dimension}`) !== -1);
            const deltaHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`CDELT${channelTypeInfo.dimension}`) !== -1);
            const unitHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`CUNIT${channelTypeInfo.dimension}`) !== -1);

            if (refPixHeader && refValHeader && deltaHeader) {
                const refPix = parseFloat(refPixHeader.value);
                const refVal = parseFloat(refValHeader.value);
                const delta = parseFloat(deltaHeader.value);
                const unit = unitHeader ? unitHeader.value.trim() : "";
                if (isFinite(refPix) && isFinite(refVal) && isFinite(delta)) {
                    // Override unit if it's specified by a header
                    if (unit.length) {
                        channelTypeInfo.type.unit = unit;
                    }

                    let scalingFactor = 1.0;
                    // Use km/s by default for m/s values
                    if (channelTypeInfo.type.unit === "m/s") {
                        scalingFactor = 1e-3;
                        channelTypeInfo.type.unit = "km/s";
                    }
                    // Use GHz by default for Hz values
                    if (channelTypeInfo.type.unit === "Hz") {
                        scalingFactor = 1e-9;
                        channelTypeInfo.type.unit = "GHz";
                    }

                    for (let i = 0; i < N; i++) {
                        // FITS standard uses 1 for the first pixel
                        const channelOffset = i + 1 - refPix;
                        rawValues[i] = (channelOffset * delta + refVal);
                        values[i] = rawValues[i] * scalingFactor;
                    }
                    return {fromWCS: true, channelType: channelTypeInfo.type, values, rawValues};
                }
            }
        }

        // return channels
        for (let i = 0; i < N; i++) {
            values[i] = i;
            rawValues[i] = i;
        }
        return {fromWCS: false, channelType: {code: "", name: "Channel"}, values, rawValues};
    }

    @computed get spectralInfo(): SpectralInfo {
        const spectralInfo: SpectralInfo = {
            channel: this.channel,
            channelType: {code: "", name: "Channel"},
            spectralString: ""
        };

        if (this.frameInfo.fileInfoExtended.depth > 1) {
            const channelInfo = this.channelInfo;
            if (channelInfo.channelType.code) {
                let specSysValue = "";
                const specSysHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`SPECSYS`) !== -1);
                if (specSysHeader && specSysHeader.value) {
                    specSysValue = specSysHeader.value;
                }
                spectralInfo.channelType = channelInfo.channelType;
                let spectralName;
                if (specSysValue) {
                    spectralName = `${channelInfo.channelType.name}\u00a0(${specSysValue})`;
                } else {
                    spectralName = channelInfo.channelType.name;
                }
                spectralInfo.spectralString = `${spectralName}:\u00a0${channelInfo.values[this.channel].toFixed(4)}\u00a0${channelInfo.channelType.unit}`;

                const refFreq = this.referenceFrequency;
                // Add velocity conversion
                if (channelInfo.channelType.code === "FREQ" && isFinite(refFreq)) {
                    const freqVal = channelInfo.rawValues[this.channel];
                    spectralInfo.velocityString = velocityStringFromFrequency(freqVal, refFreq);
                } else if (channelInfo.channelType.code === "VRAD") {
                    const velocityVal = channelInfo.rawValues[this.channel];
                    spectralInfo.freqString = frequencyStringFromVelocity(velocityVal, refFreq);
                }
            }
        }

        return spectralInfo;
    }

    @action updateFromRasterData(rasterImageData: CARTA.RasterImageData) {
        this.stokes = rasterImageData.stokes;
        this.channel = rasterImageData.channel;
        this.currentCompressionQuality = rasterImageData.compressionQuality;
        // if there's a valid channel histogram bundled into the message, update it
        if (rasterImageData.channelHistogramData) {
            // Update channel histograms
            if (rasterImageData.channelHistogramData.regionId === -1 && rasterImageData.channelHistogramData.histograms.length) {
                this.renderConfig.updateChannelHistogram(rasterImageData.channelHistogramData.histograms[0] as CARTA.Histogram);
            }
        }

        this.currentFrameView = {
            xMin: rasterImageData.imageBounds.xMin,
            xMax: rasterImageData.imageBounds.xMax,
            yMin: rasterImageData.imageBounds.yMin,
            yMax: rasterImageData.imageBounds.yMax,
            mip: rasterImageData.mip
        };

        const rawData = rasterImageData.imageData[0];
        // Don't need to copy buffer when dealing with compressed data
        if (rasterImageData.compressionType !== CARTA.CompressionType.NONE) {
            this.rasterData = new Float32Array(rawData.buffer);
        } else {
            this.rasterData = new Float32Array(rawData.buffer.slice(rawData.byteOffset, rawData.byteOffset + rawData.byteLength));
        }

        // Cache a copy of the approximate full image data
        if (rasterImageData.imageBounds.xMin === 0 && rasterImageData.imageBounds.yMin === 0
            && rasterImageData.imageBounds.xMax === this.frameInfo.fileInfoExtended.width
            && rasterImageData.imageBounds.yMax === this.frameInfo.fileInfoExtended.height) {
            this.overviewRasterData = this.rasterData.slice(0);
            this.overviewRasterView = {
                xMin: rasterImageData.imageBounds.xMin,
                xMax: rasterImageData.imageBounds.xMax,
                yMin: rasterImageData.imageBounds.yMin,
                yMax: rasterImageData.imageBounds.yMax,
                mip: rasterImageData.mip
            };
        }
    }

    @action setChannels(channel: number, stokes: number) {
        // Automatically switch to per-channel histograms when Stokes parameter changes
        if (this.requiredStokes !== stokes) {
            this.renderConfig.setUseCubeHistogram(false);
            this.renderConfig.updateCubeHistogram(null, 0);
        }

        this.requiredChannel = channel;
        this.requiredStokes = stokes;
    }

    @action incrementChannels(deltaChannel: number, deltaStokes: number, wrap: boolean = true) {
        const depth = Math.max(1, this.frameInfo.fileInfoExtended.depth);
        const numStokes = Math.max(1, this.frameInfo.fileInfoExtended.stokes);

        let newChannel = this.requiredChannel + deltaChannel;
        let newStokes = this.requiredStokes + deltaStokes;
        if (wrap) {
            newChannel = (newChannel + depth) % depth;
            newStokes = (newStokes + numStokes) % numStokes;
        } else {
            newChannel = clamp(newChannel, 0, depth - 1);
            newStokes = clamp(newStokes, 0, numStokes - 1);
        }
        this.setChannels(newChannel, newStokes);
    }

    @action setZoom(zoom: number) {
        this.zoomLevel = zoom;
    }

    @action setCenter(x: number, y: number) {
        this.center = {x, y};
    }

    // Sets a new zoom level and pans to keep the given point fixed
    @action zoomToPoint(x: number, y: number, zoom: number) {
        const newCenter = {
            x: x + this.zoomLevel / zoom * (this.center.x - x),
            y: y + this.zoomLevel / zoom * (this.center.y - y)
        };
        this.zoomLevel = zoom;
        this.center = newCenter;
    }

    @action zoomToSelection(xMin: number, xMax: number, yMin: number, yMax: number) {
        // TODO
    }

    @action fitZoomX = () => {
        this.zoomLevel = this.calculateZoomX();
        this.center.x = this.frameInfo.fileInfoExtended.width / 2.0 + 0.5;
        this.center.y = this.frameInfo.fileInfoExtended.height / 2.0 + 0.5;
    };

    @action fitZoomY = () => {
        this.zoomLevel = this.calculateZoomY();
        this.center.x = this.frameInfo.fileInfoExtended.width / 2.0 + 0.5;
        this.center.y = this.frameInfo.fileInfoExtended.height / 2.0 + 0.5;
    };

    @action fitZoom = () => {
        const zoomX = this.calculateZoomX();
        const zoomY = this.calculateZoomY();
        this.zoomLevel = Math.min(zoomX, zoomY);
        this.center.x = this.frameInfo.fileInfoExtended.width / 2.0 + 0.5;
        this.center.y = this.frameInfo.fileInfoExtended.height / 2.0 + 0.5;
    };

    private calculateZoomX() {
        const imageWidth = this.frameInfo.fileInfoExtended.width;
        const pixelRatio = this.renderHiDPI ? devicePixelRatio : 1.0;

        if (imageWidth <= 0) {
            return 1.0;
        }
        return this.renderWidth * pixelRatio / imageWidth;
    }

    private calculateZoomY() {
        const imageHeight = this.frameInfo.fileInfoExtended.height;
        const pixelRatio = this.renderHiDPI ? devicePixelRatio : 1.0;
        if (imageHeight <= 0) {
            return 1.0;
        }
        return this.renderHeight * pixelRatio / imageHeight;
    }

    // Tests a list of headers for valid channel information in either 3rd or 4th axis
    private static FindChannelType(entries: CARTA.IHeaderEntry[]) {
        if (!entries || !entries.length) {
            return undefined;
        }

        const typeHeader3 = entries.find(entry => entry.name.includes("CTYPE3"));
        const typeHeader4 = entries.find(entry => entry.name.includes("CTYPE4"));
        if (!typeHeader3 && !typeHeader4) {
            return undefined;
        }

        // Test each header entry to see if it has a valid channel type
        if (typeHeader3) {
            const headerVal = typeHeader3.value.trim().toUpperCase();
            const channelType = CHANNEL_TYPES.find(type => headerVal.indexOf(type.code) !== -1);
            if (channelType) {
                return {dimension: 3, type: {name: channelType.name, code: channelType.code, unit: channelType.unit}};
            }
        }

        if (typeHeader4) {
            const headerVal = typeHeader4.value.trim().toUpperCase();
            const channelType = CHANNEL_TYPES.find(type => headerVal.indexOf(type.code) !== -1);
            if (channelType) {
                return {dimension: 4, type: {name: channelType.name, code: channelType.code, unit: channelType.unit}};
            }
        }

        return undefined;
    }
}