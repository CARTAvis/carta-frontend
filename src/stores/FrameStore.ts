import {action, autorun, computed, observable} from "mobx";
import {NumberRange} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {ASTSettingsString, ContourConfigStore, ContourStore, LogStore, OverlayBeamStore, OverlayStore, PreferenceStore, RegionSetStore, RenderConfigStore} from "stores";
import {ChannelInfo, CursorInfo, FrameView, Point2D, ProtobufProcessing, SpectralInfo, Transform2D, ZoomPoint} from "models";
import {
    clamp, findChannelType, frequencyStringFromVelocity, getHeaderNumericValue, getTransformedCoordinates,
    minMax2D, rotate2D, toFixed, trimFitsComment, velocityStringFromFrequency
} from "utilities";
import {BackendService} from "services";
import {ControlMap} from "../models/ControlMap";

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
    TILED
}

export class FrameStore {
    @observable frameInfo: FrameInfo;
    @observable renderHiDPI: boolean;
    @observable wcsInfo: number;
    @observable spectralFrame: number;
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
    @observable valid: boolean;
    @observable moving: boolean;
    @observable zooming: boolean;
    @observable regionSet: RegionSetStore;
    @observable overlayBeamSettings: OverlayBeamStore;
    @observable spatialReference: FrameStore;

    @observable secondaryImages: FrameStore[];

    @computed get requiredFrameView(): FrameView {
        // use spatial reference frame to calculate frame view, if it exists
        if (this.spatialReference) {
            // Required view of reference frame
            const refView = this.spatialReference.requiredFrameView;
            // Get the position of the ref frame's view in the secondary frame's pixel space
            const corners = [
                this.spatialTransform.transformCoordinate({x: refView.xMin, y: refView.yMin}, false),
                this.spatialTransform.transformCoordinate({x: refView.xMin, y: refView.yMax}, false),
                this.spatialTransform.transformCoordinate({x: refView.xMax, y: refView.yMax}, false),
                this.spatialTransform.transformCoordinate({x: refView.xMax, y: refView.yMin}, false)
            ];

            const {minPoint, maxPoint} = minMax2D(corners);
            // Manually get adjusted zoom level and round to a power of 2
            const mipAdjustment = (this.preference.lowBandwidthMode ? 2.0 : 1.0) / this.spatialTransform.scale;
            const mipExact = Math.max(1.0, mipAdjustment / this.spatialReference.zoomLevel);
            const mipLog2 = Math.log2(mipExact);
            const mipLog2Rounded = Math.round(mipLog2);

            return {
                xMin: minPoint.x,
                xMax: maxPoint.x,
                yMin: minPoint.y,
                yMax: maxPoint.y,
                mip: Math.pow(2, mipLog2Rounded)
            };
        } else {
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

            return {
                xMin: this.center.x - imageWidth / 2.0,
                xMax: this.center.x + imageWidth / 2.0,
                yMin: this.center.y - imageHeight / 2.0,
                yMax: this.center.y + imageHeight / 2.0,
                mip: mipRoundedPow2
            };
        }
    }

    @computed get spatialTransform() {
        if (this.spatialReference && this.spatialTransformAST) {
            const center = getTransformedCoordinates(this.spatialTransformAST, this.spatialReference.center, false);
            return new Transform2D(this.spatialTransformAST, center);
        }
        return null;
    }

    @computed get transformedWcsInfo() {
        if (this.spatialTransform) {
            let adjTranslation: Point2D = {
                x: -this.spatialTransform.translation.x / this.spatialTransform.scale,
                y: -this.spatialTransform.translation.y / this.spatialTransform.scale,
            };
            adjTranslation = rotate2D(adjTranslation, -this.spatialTransform.rotation);
            if (this.cachedTransformedWcsInfo >= 0) {
                AST.delete(this.cachedTransformedWcsInfo);
            }

            this.cachedTransformedWcsInfo = AST.createTransformedFrameset(this.wcsInfo,
                adjTranslation.x, adjTranslation.y,
                -this.spatialTransform.rotation,
                this.spatialTransform.origin.x, this.spatialTransform.origin.y,
                1.0 / this.spatialTransform.scale, 1.0 / this.spatialTransform.scale);
            return this.cachedTransformedWcsInfo;
        }
        return null;
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
            let bMaj = getHeaderNumericValue(bMajHeader);
            let bMin = getHeaderNumericValue(bMinHeader);
            const bpa = getHeaderNumericValue(bpaHeader);
            const unit = unitHeader.value.trim();
            const delta = getHeaderNumericValue(deltaHeader);

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
            const restFreqVal = getHeaderNumericValue(restFreqHeader);
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
        const channelTypeInfo = findChannelType(this.frameInfo.fileInfoExtended.headerEntries);
        if (channelTypeInfo) {
            const refPixHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`CRPIX${channelTypeInfo.dimension}`) !== -1);
            const refValHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`CRVAL${channelTypeInfo.dimension}`) !== -1);
            const deltaHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`CDELT${channelTypeInfo.dimension}`) !== -1);
            const unitHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`CUNIT${channelTypeInfo.dimension}`) !== -1);

            if (refPixHeader && refValHeader && deltaHeader) {
                const refPix = getHeaderNumericValue(refPixHeader);
                const refVal = getHeaderNumericValue(refValHeader);
                const delta = getHeaderNumericValue(deltaHeader);
                const unit = unitHeader ? unitHeader.value.trim() : "";
                if (isFinite(refPix) && isFinite(refVal) && isFinite(delta)) {
                    // Override unit if it's specified by a header
                    if (unit.length) {
                        channelTypeInfo.type.unit = unit;
                    }

                    for (let i = 0; i < N; i++) {
                        // FITS standard uses 1 for the first pixel
                        const channelOffset = i + 1 - refPix;
                        indexes[i] = i;
                        rawValues[i] = (channelOffset * delta + refVal);
                        values[i] = rawValues[i];
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

                            const index = (value - refVal) / delta + refPix - 1;
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
            fromWCS: false, channelType: {code: "", name: "Channel", unit: ""}, indexes, values, rawValues,
            getChannelIndexWCS: null, getChannelIndexSimple: getChannelIndexSimple
        };
    }

    @computed get spectralInfo(): SpectralInfo {
        const spectralInfo: SpectralInfo = {
            channel: this.channel,
            channelType: {code: "", name: "Channel", unit: ""},
            specsys: "",
            spectralString: ""
        };

        if (this.frameInfo.fileInfoExtended.depth > 1) {
            const channelInfo = this.channelInfo;
            if (channelInfo.channelType.code) {
                let specSysValue = "";
                const specSysHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`SPECSYS`) !== -1);
                if (specSysHeader && specSysHeader.value) {
                    specSysValue = trimFitsComment(specSysHeader.value);
                }
                spectralInfo.channelType = channelInfo.channelType;
                let spectralName;
                if (specSysValue) {
                    spectralInfo.specsys = specSysValue.toUpperCase();
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

    @computed get hasStokes(): boolean {
        return this.frameInfo && this.frameInfo.fileInfoExtended && this.frameInfo.fileInfoExtended.stokes > 1;
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
    private readonly controlMaps: Map<FrameStore, ControlMap>;
    private spatialTransformAST: number;
    private cachedTransformedWcsInfo: number = -1;
    private zoomTimeoutHandler;

    private static readonly CursorInfoMaxPrecision = 25;
    private static readonly ZoomInertiaDuration = 250;

    constructor(preference: PreferenceStore, overlay: OverlayStore, logStore: LogStore, frameInfo: FrameInfo, backendService: BackendService, gl: WebGLRenderingContext) {
        this.overlayStore = overlay;
        this.logStore = logStore;
        this.backendService = backendService;
        this.preference = preference;
        this.contourContext = gl;
        this.spectralFrame = null;
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
        this.spatialTransformAST = null;
        this.controlMaps = new Map<FrameStore, ControlMap>();

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

        this.regionSet = new RegionSetStore(this, preference, backendService);
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
        this.initSpectralFrame();
        this.initCenter();
        this.zoomLevel = preference.isZoomRAWMode ? 1.0 : this.zoomLevelForFit;

        // need initialized wcs to get correct cursor info
        this.cursorInfo = this.getCursorInfo(this.center);
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

    @action private initSpectralFrame = () => {
        this.spectralFrame = null;
        const entries = this.frameInfo.fileInfoExtended.headerEntries;
        const channelTypeInfo = findChannelType(entries);
        if (!channelTypeInfo) {
            return;
        }

        const dimension = channelTypeInfo.dimension;
        const skipRegex = new RegExp(`(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)[^1|2|${dimension.toString()}]`, "i");
        const spectralAxisRegex = new RegExp(`(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)[${dimension.toString()}]`, "i");
        let headerString = "";
        for (let entry of entries) {
            // Skip empty header entries
            if (!entry.value.length) {
                continue;
            }
            // Skip other dimensions, however spectral frame still need skyframe's info (RefRA, RefDec), keep NAXIS1 & NAXIS2.
            // skyframe (NAXIS1 & NAXIS2) and spectral frame (NAXIS3 or NAXIS4) headers are provided, unify spectral axis to NAXIS3
            if (entry.name.match(skipRegex)) {
                continue;
            }

            let name = entry.name;
            let value = trimFitsComment(entry.value);
            if (entry.name.toUpperCase() === "NAXIS") {
                value = "3";
            }
            if (entry.name.match(spectralAxisRegex)) {
                name = entry.name.replace(dimension.toString(), "3");
            }
            if (entry.entryType === CARTA.EntryType.STRING) {
                value = `'${value}'`;
            }

            while (name.length < 8) {
                name += " ";
            }

            let entryString = `${name}=  ${value}`;
            while (entryString.length < 80) {
                entryString += " ";
            }
            headerString += entryString;
        }

        const initResult = AST.initSpectralFrame(headerString, channelTypeInfo.type.code, channelTypeInfo.type.unit);
        if (initResult) {
            this.spectralFrame = initResult;
            console.log("Initialised spectral info from frame");
        }
    };

    public getCursorInfo(cursorPosImageSpace: Point2D) {
        let cursorPosWCS, cursorPosFormatted;
        if (this.validWcs) {
            // We need to compare X and Y coordinates in both directions
            // to avoid a confusing drop in precision at rounding threshold
            const offsetBlock = [[0, 0], [1, 1], [-1, -1]];

            // Shift image space coordinates to 1-indexed when passing to AST
            const cursorNeighbourhood = offsetBlock.map((offset) => AST.transformPoint(this.wcsInfo, cursorPosImageSpace.x + 1 + offset[0], cursorPosImageSpace.y + 1 + offset[1]));

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

    public getControlMap(frame: FrameStore) {
        let controlMap = this.controlMaps.get(frame);
        if (!controlMap) {
            const tStart = performance.now();
            controlMap = new ControlMap(this, frame, -1, this.preference.contourControlMapWidth, this.preference.contourControlMapWidth);
            this.controlMaps.set(frame, controlMap);
            const tEnd = performance.now();
            const dt = tEnd - tStart;
            console.log(`Created ${this.preference.contourControlMapWidth}x${this.preference.contourControlMapWidth} transform grid for ${this.frameInfo.fileId} -> ${frame.frameInfo.fileId} in ${dt} ms`);
        }

        return controlMap;
    }

    public removeControlMap(frame: FrameStore) {
        const controlMap = this.controlMaps.get(frame);
        if (controlMap && this.contourContext && controlMap.hasTextureForContext(this.contourContext)) {
            const texture = controlMap.getTextureX(this.contourContext);
            this.contourContext.deleteTexture(texture);
        }
        this.controlMaps.delete(frame);
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

    @action setZoom(zoom: number, absolute: boolean = false) {
        if (this.spatialReference) {
            // Adjust zoom by scaling factor if zoom level is not absolute
            const adjustedZoom = absolute ? zoom : zoom / this.spatialTransform.scale;
            this.spatialReference.setZoom(adjustedZoom);
        } else {
            this.zoomLevel = zoom;
            this.replaceZoomTimeoutHandler();
            this.zooming = true;
        }
    }

    @action setCenter(x: number, y: number) {
        if (this.spatialReference) {
            const centerPointRefImage = this.spatialTransform.transformCoordinate({x, y}, true);
            this.spatialReference.setCenter(centerPointRefImage.x, centerPointRefImage.y);
        } else {
            this.center = {x, y};
        }
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
    @action zoomToPoint(x: number, y: number, zoom: number, absolute: boolean = false) {
        if (this.spatialReference) {
            // Adjust zoom by scaling factor if zoom level is not absolute
            const adjustedZoom = absolute ? zoom : zoom / this.spatialTransform.scale;
            const pointRefImage = this.spatialTransform.transformCoordinate({x, y}, true);
            this.spatialReference.zoomToPoint(pointRefImage.x, pointRefImage.y, adjustedZoom);
        } else {
            if (this.preference.zoomPoint === ZoomPoint.CURSOR) {
                const newCenter = {
                    x: x + this.zoomLevel / zoom * (this.center.x - x),
                    y: y + this.zoomLevel / zoom * (this.center.y - y)
                };
                this.center = newCenter;
            }
            this.setZoom(zoom);
        }
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
        if (this.spatialReference) {
            // Calculate bounding box for transformed image
            const corners = [
                this.spatialTransform.transformCoordinate({x: 0, y: 0}, true),
                this.spatialTransform.transformCoordinate({x: 0, y: this.frameInfo.fileInfoExtended.height}, true),
                this.spatialTransform.transformCoordinate({x: this.frameInfo.fileInfoExtended.width, y: this.frameInfo.fileInfoExtended.height}, true),
                this.spatialTransform.transformCoordinate({x: this.frameInfo.fileInfoExtended.width, y: 0}, true)
            ];
            const {minPoint, maxPoint} = minMax2D(corners);
            const rangeX = maxPoint.x - minPoint.x;
            const rangeY = maxPoint.y - minPoint.y;
            const zoomX = this.spatialReference.renderWidth / rangeX;
            const zoomY = this.spatialReference.renderHeight / rangeY;
            this.spatialReference.setZoom(Math.min(zoomX, zoomY), true);
            this.spatialReference.setCenter((maxPoint.x + minPoint.x) / 2.0 + 0.5, (maxPoint.y + minPoint.y) / 2.0 + 0.5);
        } else {
            this.zoomLevel = this.zoomLevelForFit;
            this.initCenter();
        }
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

        this.contourConfig.setEnabled(true);

        // TODO: Allow a different reference frame
        const contourParameters: CARTA.ISetContourParameters = {
            fileId: this.frameInfo.fileId,
            referenceFileId: this.frameInfo.fileId,
            smoothingMode: this.contourConfig.smoothingMode,
            smoothingFactor: this.contourConfig.smoothingFactor,
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

    // Spatial WCS Matching
    @action setSpatialReference = (frame: FrameStore) => {
        if (frame === this) {
            console.log(`Skipping spatial self-reference`);
            this.clearSpatialReference();
            return false;
        }

        if (this.validWcs !== frame.validWcs) {
            console.log(`Error creating spatial transform between files ${this.frameInfo.fileId} and ${frame.frameInfo.fileId}`);
            this.spatialReference = null;
            return false;
        }

        const copySrc = AST.copy(this.wcsInfo);
        const copyDest = AST.copy(frame.wcsInfo);
        AST.invert(copySrc);
        AST.invert(copyDest);
        this.spatialTransformAST = AST.convert(copySrc, copyDest, "");
        AST.delete(copySrc);
        AST.delete(copyDest);
        if (!this.spatialTransformAST) {
            console.log(`Error creating spatial transform between files ${this.frameInfo.fileId} and ${frame.frameInfo.fileId}`);
            this.spatialReference = null;
            return false;
        }
        this.spatialReference = frame;
        const currentTransform = this.spatialTransform;
        if (!isFinite(currentTransform.rotation) || !isFinite(currentTransform.scale) || !isFinite(currentTransform.translation.x) || !isFinite(currentTransform.translation.y)
            || !isFinite(currentTransform.origin.x) || !isFinite(currentTransform.origin.y)) {
            console.log(`Error creating spatial transform between files ${this.frameInfo.fileId} and ${frame.frameInfo.fileId}`);
            this.spatialReference = null;
            AST.delete(this.spatialTransformAST);
            this.spatialTransformAST = null;
            return false;
        }

        this.spatialReference.addSecondaryImage(this);
        return true;
    };

    @action clearSpatialReference = () => {
        // Adjust center and zoom based on existing spatial reference
        if (this.spatialReference) {
            this.center = this.spatialTransform.transformCoordinate(this.spatialReference.center, false);
            this.zoomLevel = this.spatialReference.zoomLevel * this.spatialTransform.scale;
            this.spatialReference.removeSecondaryImage(this);
            this.spatialReference = null;
        }

        if (this.spatialTransformAST) {
            AST.delete(this.spatialTransformAST);
        }
        this.spatialTransformAST = null;
        if (this.contourContext) {
            this.controlMaps.forEach(controlMap => {
                if (controlMap.hasTextureForContext(this.contourContext)) {
                    const texture = controlMap.getTextureX(this.contourContext);
                    this.contourContext.deleteTexture(texture);
                }
            });
        }
        this.controlMaps.forEach((controlMap, frame) => {
            this.removeControlMap(frame);
        });
        this.controlMaps.clear();
    };

    @action addSecondaryImage = (frame: FrameStore) => {
        if (!this.secondaryImages) {
            this.secondaryImages = [frame];
        } else if (!this.secondaryImages.find(f => f.frameInfo.fileId === frame.frameInfo.fileId)) {
            this.secondaryImages.push(frame);
        }
    };

    @action removeSecondaryImage = (frame: FrameStore) => {
        if (this.secondaryImages) {
            this.secondaryImages = this.secondaryImages.filter(f => f.frameInfo.fileId !== frame.frameInfo.fileId);
        }
    };
}