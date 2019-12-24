import {action, computed, observable, autorun} from "mobx";
import {NumberRange} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {ASTSettingsString, PreferenceStore, OverlayBeamStore, OverlayStore, LogStore, RegionSetStore, RenderConfigStore, ContourConfigStore, ContourStore} from "stores";
import {CursorInfo, Point2D, FrameView, SpectralInfo, ChannelInfo, CHANNEL_TYPES, ProtobufProcessing} from "models";
import {clamp, frequencyStringFromVelocity, velocityStringFromFrequency, toFixed, hexStringToRgba, trimFitsComment} from "utilities";
import {BackendService} from "services";

export interface FrameInfo {
    fileId: number;
    directory: string;
    hdu: string;
    fileInfo: CARTA.FileInfo;
    fileInfoExtended: CARTA.FileInfoExtended;
    fileFeatureFlags: number;
    renderMode: CARTA.RenderMode;
}

export enum RasterRenderType {
    NONE,
    ANIMATION,
    TILED
}

export class FrameStore {
    @observable frameInfo: FrameInfo;
    @observable renderHiDPI: boolean;
    @observable wcsInfo: number;
    @observable validWcs: boolean;
    @observable center: Point2D;
    @observable cursorInfo: CursorInfo;
    @observable cursorValue: number;
    @observable cursorFrozen: boolean;
    @observable zoomLevel: number;
    @observable stokes: number;
    @observable channel: number;
    @observable requiredStokes: number;
    @observable requiredChannel: number;
    @observable animationChannelRange: NumberRange;
    @observable renderType: RasterRenderType;
    @observable currentFrameView: FrameView;
    @observable currentCompressionQuality: number;
    @observable renderConfig: RenderConfigStore;
    @observable contourConfig: ContourConfigStore;
    @observable contourStores: Map<number, ContourStore>;
    @observable rasterData: Float32Array;
    @observable overviewRasterData: Float32Array;
    @observable overviewRasterView: FrameView;
    @observable valid: boolean;
    @observable moving: boolean;
    @observable zooming: boolean;
    @observable regionSet: RegionSetStore;
    @observable overlayBeamSettings: OverlayBeamStore;

    @computed get requiredFrameView(): FrameView {
        // If there isn't a valid zoom, return a dummy view
        if (this.zoomLevel <= 0 || !this.isRenderable) {
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

        const mipAdjustment = (this.preference.lowBandwidthMode ? 2.0 : 1.0);
        const mipExact = Math.max(1.0, mipAdjustment / this.zoomLevel);
        const mipLog2 = Math.log2(mipExact);
        const mipLog2Rounded = Math.round(mipLog2);
        const mipRoundedPow2 = Math.pow(2, mipLog2Rounded);
        const frameView = {
            xMin: this.center.x - imageWidth / 2.0,
            xMax: this.center.x + imageWidth / 2.0,
            yMin: this.center.y - imageHeight / 2.0,
            yMax: this.center.y + imageHeight / 2.0,
            mip: mipRoundedPow2
        };

        return frameView;
    }

    @computed get renderWidth() {
        return this.overlayStore.renderWidth;
    }

    @computed get renderHeight() {
        return this.overlayStore.renderHeight;
    }

    @computed get isRenderable() {
        return this.renderWidth > 0 && this.renderHeight > 0;
    }

    @computed get unit() {
        if (!this.frameInfo || !this.frameInfo.fileInfoExtended || !this.frameInfo.fileInfoExtended.headerEntries) {
            return undefined;
        } else {
            const unitHeader = this.frameInfo.fileInfoExtended.headerEntries.filter(entry => entry.name === "BUNIT");
            if (unitHeader.length) {
                return trimFitsComment(unitHeader[0].value);
            } else {
                return undefined;
            }
        }
    }

    @computed get beamProperties(): { x: number, y: number, angle: number, overlayBeamSettings: OverlayBeamStore } {
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
                    angle: bpa,
                    overlayBeamSettings: this.overlayBeamSettings
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
        const indexes = new Array<number>(N);
        const values = new Array<number>(N);
        const rawValues = new Array<number>(N);

        let getChannelIndexSimple = (value: number): number => {
            if (!value) {
                return null;
            }

            if (value < 0) {
                return 0;
            } else if (value > N - 1) {
                return N - 1;
            }

            const ceil = Math.ceil(value);
            const floor = Math.floor(value);
            return (ceil - value) < (value - floor) ? ceil : floor;
        };

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
                        indexes[i] = i;
                        rawValues[i] = (channelOffset * delta + refVal);
                        values[i] = rawValues[i] * scalingFactor;
                    }
                    return {
                        fromWCS: true,
                        channelType: channelTypeInfo.type,
                        indexes,
                        values,
                        rawValues,
                        getChannelIndexWCS: (value: number): number => {
                            if (!value) {
                                return null;
                            }

                            const index = (value / scalingFactor - refVal) / delta + refPix - 1;
                            if (index < 0) {
                                return 0;
                            } else if (index > values.length - 1) {
                                return values.length - 1;
                            }

                            const ceil = Math.ceil(index);
                            const floor = Math.floor(index);
                            return Math.abs(values[ceil] - value) < Math.abs(value - values[floor]) ? ceil : floor;
                        },
                        getChannelIndexSimple: getChannelIndexSimple
                    };
                }
            }
        }

        // return channels
        for (let i = 0; i < N; i++) {
            indexes[i] = i;
            values[i] = i;
            rawValues[i] = i;
        }
        return {
            fromWCS: false, channelType: {code: "", name: "Channel"}, indexes, values, rawValues,
            getChannelIndexWCS: null, getChannelIndexSimple: getChannelIndexSimple
        };
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
                spectralInfo.spectralString = `${spectralName}:\u00a0${toFixed(channelInfo.values[this.channel], 4)}\u00a0${channelInfo.channelType.unit}`;

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

    @computed
    private get zoomLevelForFit() {
        return Math.min(this.calculateZoomX, this.calculateZoomY);
    }

    @computed
    private get calculateZoomX() {
        const imageWidth = this.frameInfo.fileInfoExtended.width;
        const pixelRatio = this.renderHiDPI ? devicePixelRatio : 1.0;

        if (imageWidth <= 0) {
            return 1.0;
        }
        return this.renderWidth * pixelRatio / imageWidth;
    }

    @computed
    private get calculateZoomY() {
        const imageHeight = this.frameInfo.fileInfoExtended.height;
        const pixelRatio = this.renderHiDPI ? devicePixelRatio : 1.0;
        if (imageHeight <= 0) {
            return 1.0;
        }
        return this.renderHeight * pixelRatio / imageHeight;
    }

    @computed get contourProgress(): number {
        // Use -1 when there are no contours required
        if (!this.contourConfig.levels || !this.contourConfig.levels.length || !this.contourConfig.enabled) {
            return -1;
        }

        // Progress is zero if we haven't received any contours yet
        if (!this.contourStores || !this.contourStores.size) {
            return 0;
        }

        let totalProgress = 0;
        this.contourStores.forEach((contourStore, level) => {
            if (this.contourConfig.levels.indexOf(level) !== -1) {
                totalProgress += contourStore.progress;
            }
        });

        return totalProgress / (this.contourConfig.levels ? this.contourConfig.levels.length : 1);
    }

    private readonly overlayStore: OverlayStore;
    private readonly logStore: LogStore;
    private readonly preference: PreferenceStore;
    private readonly backendService: BackendService;
    private readonly contourContext: WebGLRenderingContext;
    private zoomTimeoutHandler;

    private static readonly CursorInfoMaxPrecision = 25;
    private static readonly ZoomInertiaDuration = 250;

    constructor(preference: PreferenceStore, overlay: OverlayStore, logStore: LogStore, frameInfo: FrameInfo, backendService: BackendService, gl: WebGLRenderingContext) {
        this.overlayStore = overlay;
        this.logStore = logStore;
        this.backendService = backendService;
        this.preference = preference;
        this.contourContext = gl;
        this.validWcs = false;
        this.frameInfo = frameInfo;
        this.renderHiDPI = true;
        this.center = {x: 0, y: 0};
        this.stokes = 0;
        this.channel = 0;
        this.requiredStokes = 0;
        this.requiredChannel = 0;
        this.renderConfig = new RenderConfigStore(preference);
        this.contourConfig = new ContourConfigStore(preference);
        this.contourStores = new Map<number, ContourStore>();
        this.renderType = RasterRenderType.NONE;
        this.moving = false;
        this.zooming = false;
        this.overlayBeamSettings = new OverlayBeamStore(preference);

        // synchronize AST overlay's color/grid/label with preference when frame is created
        const astColor = preference.astColor;
        if (astColor !== overlay.global.color) {
            overlay.global.setColor(astColor);
        }
        const astGridVisible = preference.astGridVisible;
        if (astGridVisible !== overlay.grid.visible) {
            overlay.grid.setVisible(astGridVisible);
        }
        const astLabelsVisible = preference.astLabelsVisible;
        if (astLabelsVisible !== overlay.labels.visible) {
            overlay.labels.setVisible(astLabelsVisible);
        }

        this.regionSet = new RegionSetStore(this, preference.regionContainer, backendService);
        this.valid = true;
        this.currentFrameView = {
            xMin: 0,
            xMax: 0,
            yMin: 0,
            yMax: 0,
            mip: 999
        };
        this.animationChannelRange = [0, frameInfo.fileInfoExtended.depth - 1];

        this.initWCS();
        this.initCenter();
        this.zoomLevel = preference.isZoomRAWMode ? 1.0 : this.zoomLevelForFit;

        // need initialized wcs to get correct cursor info
        this.cursorInfo = this.getCursorInfoImageSpace({x: 0, y: 0});
        this.cursorValue = 0;
        this.cursorFrozen = preference.isCursorFrozen;

        autorun(() => {
            // update zoomLevel when image viewer is available for drawing
            if (this.isRenderable && this.zoomLevel <= 0) {
                this.setZoom(this.zoomLevelForFit);
            }
        });
    }

    @action private initWCS = () => {
        let headerString = "";

        for (let entry of this.frameInfo.fileInfoExtended.headerEntries) {
            // Skip empty header entries
            if (!entry.value.length) {
                continue;
            }

            // Skip higher dimensions
            if (entry.name.match(/(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)[3-9]/)) {
                continue;
            }

            let value = entry.value;
            if (entry.name.toUpperCase() === "NAXIS") {
                value = "2";
            }

            if (entry.name.toUpperCase() === "WCSAXES") {
                value = "2";
            }

            if (entry.entryType === CARTA.EntryType.STRING) {
                value = `'${value}'`;
            }

            let name = entry.name;
            while (name.length < 8) {
                name += " ";
            }

            let entryString = `${name}=  ${value}`;
            while (entryString.length < 80) {
                entryString += " ";
            }
            headerString += entryString;
        }
        const initResult = AST.initFrame(headerString);
        if (!initResult) {
            this.logStore.addWarning(`Problem processing WCS info in file ${this.frameInfo.fileInfo.name}`, ["ast"]);
            this.wcsInfo = AST.initDummyFrame();
        } else {
            this.wcsInfo = initResult;
            this.validWcs = true;
            this.overlayStore.setDefaultsFromAST(this);
            console.log("Initialised WCS info from frame");
        }
    };

    public getImagePos(canvasX: number, canvasY: number): Point2D {
        const frameView = this.requiredFrameView;
        return {
            x: (canvasX / this.renderWidth) * (frameView.xMax - frameView.xMin) + frameView.xMin - 1,
            // y coordinate is flipped in image space
            y: (canvasY / this.renderHeight) * (frameView.yMin - frameView.yMax) + frameView.yMax - 1
        };
    }

    public getCursorInfoImageSpace(cursorPosImageSpace: Point2D) {
        let cursorPosWCS, cursorPosFormatted;
        if (this.validWcs) {
            // We need to compare X and Y coordinates in both directions
            // to avoid a confusing drop in precision at rounding threshold
            const offsetBlock = [[0, 0], [1, 1], [-1, -1]];

            // Shift image space coordinates to 1-indexed when passing to AST
            const cursorNeighbourhood = offsetBlock.map((offset) => AST.pixToWCS(this.wcsInfo, cursorPosImageSpace.x + 1 + offset[0], cursorPosImageSpace.y + 1 + offset[1]));

            cursorPosWCS = cursorNeighbourhood[0];

            const normalizedNeighbourhood = cursorNeighbourhood.map((pos) => AST.normalizeCoordinates(this.wcsInfo, pos.x, pos.y));

            let precisionX = 0;
            let precisionY = 0;

            while (precisionX < FrameStore.CursorInfoMaxPrecision && precisionY < FrameStore.CursorInfoMaxPrecision) {
                let astString = new ASTSettingsString();
                astString.add("Format(1)", this.overlayStore.numbers.cursorFormatStringX(precisionX));
                astString.add("Format(2)", this.overlayStore.numbers.cursorFormatStringY(precisionY));
                astString.add("System", this.overlayStore.global.explicitSystem);

                let formattedNeighbourhood = normalizedNeighbourhood.map((pos) => AST.getFormattedCoordinates(this.wcsInfo, pos.x, pos.y, astString.toString()), true);
                let [p, n1, n2] = formattedNeighbourhood;
                if (!p.x || !p.y || p.x === "<bad>" || p.y === "<bad>") {
                    cursorPosFormatted = null;
                    break;
                }

                if (p.x !== n1.x && p.x !== n2.x && p.y !== n1.y && p.y !== n2.y) {
                    cursorPosFormatted = {x: p.x, y: p.y};
                    break;
                }

                if (p.x === n1.x || p.x === n2.x) {
                    precisionX += 1;
                }

                if (p.y === n1.y || p.y === n2.y) {
                    precisionY += 1;
                }
            }
        }

        return {
            posImageSpace: cursorPosImageSpace,
            posWCS: cursorPosWCS,
            infoWCS: cursorPosFormatted,
        };
    }

    public getCursorInfoCanvasSpace(cursorPosCanvasSpace: Point2D): CursorInfo {
        const cursorPosImageSpace = this.getImagePos(cursorPosCanvasSpace.x, cursorPosCanvasSpace.y);
        return this.getCursorInfoImageSpace(cursorPosImageSpace);
    }

    @action updateFromRasterData(rasterImageData: CARTA.RasterImageData) {
        this.stokes = rasterImageData.stokes;
        this.channel = rasterImageData.channel;
        this.currentCompressionQuality = rasterImageData.compressionQuality;
        // if there's a valid channel histogram bundled into the message, update it
        if (rasterImageData.channelHistogramData) {
            // Update channel histograms
            if (rasterImageData.channelHistogramData.regionId === -1 && rasterImageData.channelHistogramData.histograms.length) {
                this.renderConfig.updateChannelHistogram(rasterImageData.channelHistogramData.histograms[0]);
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

    @action updateFromContourData(contourImageData: CARTA.ContourImageData) {
        let vertexCounter = 0;

        const processedData = ProtobufProcessing.ProcessContourData(contourImageData);
        for (const contourSet of processedData.contourSets) {
            vertexCounter += contourSet.coordinates.length / 2;
        }
        this.stokes = processedData.stokes;
        this.channel = processedData.channel;

        for (const contourSet of processedData.contourSets) {
            let contourStore = this.contourStores.get(contourSet.level);
            if (!contourStore) {
                contourStore = new ContourStore(this.contourContext);
                this.contourStores.set(contourSet.level, contourStore);
            }

            if (!contourStore.isComplete && processedData.progress > 0) {
                contourStore.addContourData(contourSet.indexOffsets, contourSet.coordinates, processedData.progress);
            } else {
                contourStore.setContourData(contourSet.indexOffsets, contourSet.coordinates, processedData.progress);
            }
        }

        let totalProgress = 0;
        let totalVertices = 0;
        let totalChunks = 0;
        // Clear up stale contour levels by checking against the config, and update total contour progress
        this.contourStores.forEach((contourStore, level) => {
            if (this.contourConfig.levels.indexOf(level) === -1) {
                this.contourStores.delete(level);
            } else {
                totalProgress += contourStore.progress;
                totalVertices += contourStore.vertexCount;
                totalChunks += contourStore.chunkCount;
            }
        });

        const progress = totalProgress / (this.contourConfig.levels ? this.contourConfig.levels.length : 1);
        if (progress >= 1) {
            console.log(`Contours complete: ${totalVertices} vertices in ${totalChunks} chunks`);
        }
    }

    @action setChannels(channel: number, stokes: number) {
        // Automatically switch to per-channel histograms when Stokes parameter changes
        this.renderConfig.setStokes(stokes);
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
        this.replaceZoomTimeoutHandler();
        this.zooming = true;
    }

    @action setCenter(x: number, y: number) {
        this.center = {x, y};
    }

    @action setCursorInfo(cursorInfo: CursorInfo) {
        if (!this.cursorFrozen) {
            this.cursorInfo = cursorInfo;
        }
    }

    @action setCursorValue(cursorValue: number) {
        this.cursorValue = cursorValue;
    }

    // Sets a new zoom level and pans to keep the given point fixed
    @action zoomToPoint(x: number, y: number, zoom: number) {
        const newCenter = {
            x: x + this.zoomLevel / zoom * (this.center.x - x),
            y: y + this.zoomLevel / zoom * (this.center.y - y)
        };
        this.setZoom(zoom);
        this.center = newCenter;
    }

    private replaceZoomTimeoutHandler = () => {
        if (this.zoomTimeoutHandler) {
            clearTimeout(this.zoomTimeoutHandler);
        }

        this.zoomTimeoutHandler = setTimeout(() => {
            this.zooming = false;
        }, FrameStore.ZoomInertiaDuration);
    };

    @action private initCenter = () => {
        this.center.x = this.frameInfo.fileInfoExtended.width / 2.0 + 0.5;
        this.center.y = this.frameInfo.fileInfoExtended.height / 2.0 + 0.5;
    };

    @action fitZoom = () => {
        this.zoomLevel = this.zoomLevelForFit;
        this.initCenter();
    };

    @action setAnimationRange = (range: NumberRange) => {
        this.animationChannelRange = range;
    };

    @action setRasterRenderType = (renderType: RasterRenderType) => {
        this.renderType = renderType;
    };

    @action startMoving = () => {
        this.moving = true;
    };

    @action endMoving = () => {
        this.moving = false;
    };

    @action applyContours = () => {
        if (!this.contourConfig || !this.renderConfig) {
            return;
        }

        // TODO: This should be defined by the contour config widget
        this.contourConfig.setBounds(this.renderConfig.scaleMinVal, this.renderConfig.scaleMaxVal);
        this.contourConfig.setNumComputedLevels(this.preference.contourNumLevels);
        this.contourConfig.setColor(hexStringToRgba(this.preference.contourColor));
        this.contourConfig.setColormap(this.preference.colormap);
        this.contourConfig.setColormapEnabled(this.preference.contourColormapEnabled);
        this.contourConfig.setEnabled(true);

        // TODO: Allow a different reference frame
        const contourParameters: CARTA.ISetContourParameters = {
            fileId: this.frameInfo.fileId,
            referenceFileId: this.frameInfo.fileId,
            smoothingMode: this.preference.contourSmoothingMode,
            smoothingFactor: this.preference.contourSmoothingFactor,
            levels: this.contourConfig.levels,
            imageBounds: {
                xMin: 0,
                xMax: this.frameInfo.fileInfoExtended.width,
                yMin: 0,
                yMax: this.frameInfo.fileInfoExtended.height,
            },
            decimationFactor: this.preference.contourDecimation,
            compressionLevel: this.preference.contourCompressionLevel,
            contourChunkSize: this.preference.contourChunkSize
        };
        this.backendService.setContourParameters(contourParameters);
    };

    @action clearContours = (updateBackend: boolean = true) => {
        // Clear up GPU resources
        this.contourStores.forEach(contourStore => contourStore.clearData());
        this.contourStores.clear();
        if (updateBackend) {
            // Send empty contour parameter message to the backend, to prevent contours from being automatically updated
            const contourParameters: CARTA.ISetContourParameters = {
                fileId: this.frameInfo.fileId,
                referenceFileId: this.frameInfo.fileId,
            };
            this.backendService.setContourParameters(contourParameters);
        }
        this.contourConfig.setEnabled(false);
    };

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