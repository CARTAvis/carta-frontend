import {action, autorun, computed, observable, makeObservable, reaction} from "mobx";
import {NumberRange} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {AnimatorStore, AppStore, ASTSettingsString, LogStore, OverlayStore, PreferenceStore} from "stores";
import {
    CENTER_POINT_INDEX,
    SIZE_POINT_INDEX,
    ColorbarStore,
    ContourConfigStore,
    ContourStore,
    DistanceMeasuringStore,
    OverlayBeamStore,
    RegionSetStore,
    RegionStore,
    RenderConfigStore,
    RestFreqStore,
    VectorOverlayConfigStore,
    VectorOverlayStore
} from "stores/Frame";
import {
    CatalogControlMap,
    ChannelInfo,
    ControlMap,
    CursorInfo,
    FrameView,
    GenCoordinateLabel,
    IsSpectralSystemSupported,
    IsSpectralTypeSupported,
    IsSpectralUnitSupported,
    Point2D,
    SPECTRAL_COORDS_SUPPORTED,
    SPECTRAL_DEFAULT_UNIT,
    SPECTRAL_TYPE_STRING,
    SpectralInfo,
    SpectralSystem,
    SpectralType,
    SpectralTypeSet,
    SpectralUnit,
    STANDARD_POLARIZATIONS,
    COMPUTED_POLARIZATIONS,
    FULL_POLARIZATIONS,
    STANDARD_SPECTRAL_TYPE_SETS,
    POLARIZATION_LABELS,
    POLARIZATIONS,
    Transform2D,
    ZoomPoint
} from "models";
import {
    clamp,
    formattedArcsec,
    formattedFrequency,
    getFormattedWCSPoint,
    getHeaderNumericValue,
    getPixelSize,
    getTransformedChannel,
    isAstBadPoint,
    minMax2D,
    multiply2D,
    ProtobufProcessing,
    rotate2D,
    round2D,
    subtract2D,
    toFixed,
    transformPoint,
    trimFitsComment
} from "utilities";
import {BackendService, CatalogWebGLService, ContourWebGLService, TILE_SIZE} from "services";
import {RegionId} from "stores/widgets";

export interface FrameInfo {
    fileId: number;
    directory: string;
    hdu: string;
    fileInfo: CARTA.FileInfo;
    fileInfoExtended: CARTA.FileInfoExtended;
    fileFeatureFlags: number;
    renderMode: CARTA.RenderMode;
    beamTable: CARTA.IBeam[];
}

export const WCS_PRECISION = 10;

export class FrameStore {
    private static readonly CursorInfoMaxPrecision = 25;
    private static readonly ZoomInertiaDuration = 250;
    private static readonly CursorMovementDuration = 250;

    private readonly spectralFrame: AST.SpecFrame;
    private readonly controlMaps: Map<FrameStore, ControlMap>;
    private readonly catalogControlMaps: Map<FrameStore, CatalogControlMap>;
    private readonly framePixelRatio: number;
    private readonly backendService: BackendService;
    private readonly overlayStore: OverlayStore;
    private readonly logStore: LogStore;
    private readonly initialCenter: Point2D;
    public readonly pixelUnitSizeArcsec: Point2D;

    private spectralTransformAST: AST.FrameSet;
    private cachedTransformedWcsInfo: AST.FrameSet = -1;
    private zoomTimeoutHandler;

    public requiredFrameViewForRegionRender: FrameView;

    public wcsInfo: AST.FrameSet;
    public readonly wcsInfoForTransformation: AST.FrameSet;
    public readonly wcsInfo3D: AST.FrameSet;
    public readonly wcsInfoSwappedAxes: AST.FrameSet;
    public readonly validWcs: boolean;
    public readonly frameInfo: FrameInfo;
    public readonly colorbarStore: ColorbarStore;

    public spectralCoordsSupported: Map<string, {type: SpectralType; unit: SpectralUnit}>;
    public spectralSystemsSupported: Array<SpectralSystem>;
    public spatialTransformAST: AST.FrameSet;
    private cursorMovementHandle: NodeJS.Timeout;

    public distanceMeasuring: DistanceMeasuringStore;
    public restFreqStore: RestFreqStore;

    public readonly renderConfig: RenderConfigStore;
    public readonly contourConfig: ContourConfigStore;
    public readonly vectorOverlayConfig: VectorOverlayConfigStore;
    public readonly vectorOverlayStore: VectorOverlayStore;

    // Region set for the current frame. Accessed via regionSet, to take into account region sharing
    @observable private readonly frameRegionSet: RegionSetStore;

    @observable renderHiDPI: boolean;
    @observable spectralType: SpectralType;
    @observable spectralUnit: SpectralUnit;
    @observable spectralSystem: SpectralSystem;
    @observable channelValues: Array<number>;
    @observable center: Point2D;
    @observable cursorInfo: CursorInfo;
    @observable cursorValue: {position: Point2D; channel: number; value: number};
    @observable cursorMoving: boolean;
    @observable zoomLevel: number;
    @observable stokes: number;
    @observable channel: number;
    @observable requiredStokes: number;
    @observable requiredChannel: number;
    @observable animationChannelRange: NumberRange;
    @observable currentFrameView: FrameView;
    @observable currentCompressionQuality: number;
    @observable contourStores: Map<number, ContourStore>;
    @observable moving: boolean;
    @observable zooming: boolean;

    @observable colorbarLabelCustomText: string;
    @observable titleCustomText: string;
    @observable overlayBeamSettings: OverlayBeamStore;
    @observable spatialReference: FrameStore;
    @observable spectralReference: FrameStore;
    @observable rasterScalingReference: FrameStore;
    @observable secondarySpatialImages: FrameStore[];
    @observable secondarySpectralImages: FrameStore[];
    @observable secondaryRasterScalingImages: FrameStore[];
    @observable momentImages: FrameStore[];
    @observable pvImage: FrameStore;
    @observable generatedPVRegionId: number;
    @observable fittingResult: string;
    @observable fittingLog: string;

    @observable isRequestingMoments: boolean;
    @observable requestingMomentsProgress: number;
    @observable isRequestingPV: boolean;
    @observable requestingPVProgress: number;
    @observable isRequestPVCancelling: boolean;

    @observable stokesFiles: CARTA.StokesFile[];

    @computed get filename(): string {
        // hdu extension name is in field 3 of fileInfoExtended computed entries
        const extName =
            this.frameInfo?.fileInfoExtended?.computedEntries?.length >= 3 && this.frameInfo?.fileInfoExtended?.computedEntries[2]?.name === "Extension name" ? `_${this.frameInfo.fileInfoExtended.computedEntries[2]?.value}` : "";
        return this.frameInfo.hdu && this.frameInfo.hdu !== "" && this.frameInfo.hdu !== "0" ? `${this.frameInfo.fileInfo.name}.HDU_${this.frameInfo.hdu}${extName}` : this.frameInfo.fileInfo.name;
    }

    @computed get centerMovement(): Point2D {
        return subtract2D(this.initialCenter, this.center);
    }

    @computed get regionSet(): RegionSetStore {
        if (this.spatialReference) {
            return this.spatialReference.regionSet;
        } else {
            return this.frameRegionSet;
        }
    }

    @computed get sharedRegions(): boolean {
        return !!this.spatialReference;
    }

    @computed get maxMip(): number {
        if (this.frameInfo.fileInfoExtended.width < TILE_SIZE) {
            return 1;
        } else {
            return Math.pow(2, Math.ceil(Math.log2(this.frameInfo.fileInfoExtended.width / TILE_SIZE)));
        }
    }

    @computed get aspectRatio(): number {
        if (isFinite(this.framePixelRatio)) {
            return this.framePixelRatio;
        }

        return this.overlayStore.renderWidth / this.frameInfo.fileInfoExtended.width / (this.overlayStore.renderHeight / this.frameInfo.fileInfoExtended.height);
    }

    get hasSquarePixels(): boolean {
        if (isFinite(this.framePixelRatio)) {
            return this.framePixelRatio === 1.0;
        }
        return false;
    }

    // Frame view of center = initial center && zoom = 1
    @computed get unitFrameView(): FrameView {
        const pixelRatio = this.renderHiDPI ? devicePixelRatio * AppStore.Instance.imageRatio : 1.0;
        // Required image dimensions
        const imageWidth = (pixelRatio * this.renderWidth) / this.aspectRatio;
        const imageHeight = pixelRatio * this.renderHeight;

        const mipAdjustment = PreferenceStore.Instance.lowBandwidthMode ? 2.0 : 1.0;
        const mipExact = Math.max(1.0, mipAdjustment);
        const mipLog2 = Math.log2(mipExact);
        const mipLog2Rounded = Math.round(mipLog2);
        const mipRoundedPow2 = Math.pow(2, mipLog2Rounded);
        return {
            xMin: this.initialCenter.x - imageWidth / 2.0,
            xMax: this.initialCenter.x + imageWidth / 2.0,
            yMin: this.initialCenter.y - imageHeight / 2.0,
            yMax: this.initialCenter.y + imageHeight / 2.0,
            mip: mipRoundedPow2
        };
    }

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
            const mipAdjustment = (PreferenceStore.Instance.lowBandwidthMode ? 2.0 : 1.0) / this.spatialTransform.scale;
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
                    mip: 1
                };
            }

            const pixelRatio = this.renderHiDPI ? devicePixelRatio * AppStore.Instance.imageRatio : 1.0;
            // Required image dimensions
            const imageWidth = (pixelRatio * this.renderWidth) / this.zoomLevel / this.aspectRatio;
            const imageHeight = (pixelRatio * this.renderHeight) / this.zoomLevel;

            const mipAdjustment = PreferenceStore.Instance.lowBandwidthMode ? 2.0 : 1.0;
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
            const center = transformPoint(this.spatialTransformAST, this.spatialReference.center, false);
            // Try use center of the screen as a reference point
            if (!isAstBadPoint(center)) {
                return new Transform2D(this.spatialTransformAST, center);
            } else {
                // Otherwise use the center of the image
                return new Transform2D(this.spatialTransformAST, {x: this.frameInfo.fileInfoExtended.width / 2.0 + 0.5, y: this.frameInfo.fileInfoExtended.height / 2.0 + 0.5});
            }
        }
        return null;
    }

    @computed get transformedWcsInfo() {
        if (this.spatialTransform) {
            let adjTranslation: Point2D = {
                x: -this.spatialTransform.translation.x / this.spatialTransform.scale,
                y: -this.spatialTransform.translation.y / this.spatialTransform.scale
            };
            adjTranslation = rotate2D(adjTranslation, -this.spatialTransform.rotation);
            if (this.cachedTransformedWcsInfo > 0) {
                AST.deleteObject(this.cachedTransformedWcsInfo);
            }

            this.cachedTransformedWcsInfo = AST.createTransformedFrameset(
                this.wcsInfo,
                adjTranslation.x,
                adjTranslation.y,
                -this.spatialTransform.rotation,
                this.spatialTransform.origin.x,
                this.spatialTransform.origin.y,
                1.0 / this.spatialTransform.scale,
                1.0 / this.spatialTransform.scale
            );
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

    get headerUnit() {
        if (!this.frameInfo || !this.frameInfo.fileInfoExtended || !this.frameInfo.fileInfoExtended.headerEntries) {
            return undefined;
        } else {
            const unitHeader = this.frameInfo.fileInfoExtended.headerEntries.filter(entry => entry.name === "BUNIT");
            if (unitHeader.length) {
                // Trim leading/tailing quotation marks
                return trimFitsComment(unitHeader[0].value)?.replace(/^"+|"+$/g, "");
            } else {
                return undefined;
            }
        }
    }

    @computed get requiredUnit() {
        if (this.headerUnit) {
            if (this.requiredPolarization === POLARIZATIONS.Pangle) {
                return "degree";
            } else if (this.requiredPolarization === POLARIZATIONS.PFtotal || this.requiredPolarization === POLARIZATIONS.PFlinear) {
                return "%";
            } else {
                return this.headerUnit;
            }
        }
        return undefined;
    }

    @computed get beamProperties(): {x: number; y: number; majorAxis: number; minorAxis: number; angle: number; overlayBeamSettings: OverlayBeamStore} {
        const unitHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf("CUNIT1") !== -1);
        const deltaHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf("CDELT1") !== -1);

        if (unitHeader && deltaHeader) {
            const unit = unitHeader.value.trim();
            const delta = getHeaderNumericValue(deltaHeader);
            if (isFinite(delta) && (unit === "deg" || unit === "rad")) {
                if (this.frameInfo.beamTable && this.frameInfo.beamTable.length > 0) {
                    let beam: CARTA.IBeam;
                    if (this.frameInfo.beamTable.length === 1 && this.frameInfo.beamTable[0].channel === -1 && this.frameInfo.beamTable[0].stokes === -1) {
                        beam = this.frameInfo.beamTable[0];
                    } else {
                        if (this.frameInfo.fileInfoExtended.depth > 1 && this.frameInfo.fileInfoExtended.stokes > 1) {
                            beam = this.frameInfo.beamTable.find(beam => beam.channel === this.requiredChannel && beam.stokes === this.requiredStokes);
                        } else if (this.frameInfo.fileInfoExtended.depth > 1 && this.frameInfo.fileInfoExtended.stokes <= 1) {
                            beam = this.frameInfo.beamTable.find(beam => beam.channel === this.requiredChannel);
                        } else if (this.frameInfo.fileInfoExtended.depth <= 1 && this.frameInfo.fileInfoExtended.stokes > 1) {
                            beam = this.frameInfo.beamTable.find(beam => beam.stokes === this.requiredStokes);
                        }
                    }

                    if (beam && isFinite(beam.majorAxis) && beam.majorAxis > 0 && isFinite(beam.minorAxis) && beam.minorAxis > 0 && isFinite(beam.pa)) {
                        return {
                            x: beam.majorAxis / (unit === "deg" ? 3600 : (180 * 3600) / Math.PI) / Math.abs(delta),
                            y: beam.minorAxis / (unit === "deg" ? 3600 : (180 * 3600) / Math.PI) / Math.abs(delta),
                            majorAxis: beam.majorAxis,
                            minorAxis: beam.minorAxis,
                            angle: beam.pa,
                            overlayBeamSettings: this.overlayBeamSettings
                        };
                    }
                }
            }
        }
        return null;
    }

    @computed get hasVisibleBeam(): boolean {
        return this.beamProperties?.overlayBeamSettings?.visible;
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
            return ceil - value < value - floor ? ceil : floor;
        };

        // By default, we try to use the WCS information to determine channel info.
        if (this.spectralAxis) {
            const refPixHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`CRPIX${this.spectralAxis.dimension}`) !== -1);
            const refValHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`CRVAL${this.spectralAxis.dimension}`) !== -1);
            const deltaHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`CDELT${this.spectralAxis.dimension}`) !== -1);

            if (refPixHeader && refValHeader && deltaHeader) {
                // Shift pixel coordinates by -1 to start at zero instead of 1
                const refPix = getHeaderNumericValue(refPixHeader) - 1;
                const refVal = getHeaderNumericValue(refValHeader);
                const delta = getHeaderNumericValue(deltaHeader);
                if (isFinite(refPix) && isFinite(refVal) && isFinite(delta)) {
                    for (let i = 0; i < N; i++) {
                        const channelOffset = i - refPix;
                        indexes[i] = i;
                        rawValues[i] = channelOffset * delta + refVal;
                        values[i] = rawValues[i];
                    }
                    return {
                        fromWCS: true,
                        indexes,
                        delta,
                        values,
                        rawValues,
                        getChannelIndexWCS: (value: number): number => {
                            if (!value) {
                                return null;
                            }

                            const index = (value - refVal) / delta + refPix;
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
            fromWCS: false,
            delta: undefined,
            indexes,
            values,
            rawValues,
            getChannelIndexWCS: null,
            getChannelIndexSimple: getChannelIndexSimple
        };
    }

    @computed get spectralInfo(): SpectralInfo {
        const spectralInfo: SpectralInfo = {
            channel: this.channel,
            spectralString: ""
        };

        if (this.frameInfo.fileInfoExtended.depth > 1) {
            const channelInfo = this.channelInfo;
            const spectralType = this.spectralAxis?.type;
            if (spectralType) {
                spectralInfo.spectralString = `${spectralType.name} (${this.spectralAxis?.specsys ?? ""}): ${toFixed(channelInfo.values[this.channel], 4)} ${spectralType.unit ?? ""}`;
                if (spectralType.code === "FREQ") {
                    // dummy variable to update velocity when the rest freq for spectral transform is changed
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const restFreq = this.restFreqStore.restFreqInHz;

                    const freqVal = channelInfo.rawValues[this.channel];
                    // convert frequency value to unit in GHz
                    if (this.isSpectralCoordinateConvertible && spectralType.unit !== SPECTRAL_DEFAULT_UNIT.get(SpectralType.FREQ)) {
                        const freqGHz = this.astSpectralTransform(SpectralType.FREQ, SpectralUnit.GHZ, this.spectralSystem, freqVal);
                        if (isFinite(freqGHz)) {
                            spectralInfo.spectralString = `Frequency (${this.spectralSystem}): ${formattedFrequency(freqGHz)}`;
                        }
                    }
                    // convert frequency to volecity
                    const velocityVal = this.astSpectralTransform(SpectralType.VRAD, SpectralUnit.KMS, this.spectralSystem, freqVal);
                    if (isFinite(velocityVal)) {
                        spectralInfo.velocityString = `Velocity: ${toFixed(velocityVal, 4)} km/s`;
                    }
                } else if (spectralType.code === "VRAD") {
                    const velocityVal = channelInfo.rawValues[this.channel];
                    // convert velocity value to unit in km/s
                    if (this.isSpectralCoordinateConvertible && spectralType.unit !== SPECTRAL_DEFAULT_UNIT.get(SpectralType.VRAD)) {
                        const volecityKMS = this.astSpectralTransform(SpectralType.VRAD, SpectralUnit.KMS, this.spectralSystem, velocityVal);
                        if (isFinite(volecityKMS)) {
                            spectralInfo.spectralString = `Velocity (${this.spectralSystem}): ${toFixed(volecityKMS, 4)} km/s`;
                        }
                    }
                    // convert velocity to frequency
                    const freqGHz = this.astSpectralTransform(SpectralType.FREQ, SpectralUnit.GHZ, this.spectralSystem, velocityVal);
                    if (isFinite(freqGHz)) {
                        spectralInfo.freqString = `Frequency: ${formattedFrequency(freqGHz)}`;
                    }
                }
            }
        }

        return spectralInfo;
    }

    @computed get simpleSpectralInfo(): string {
        const infoString = this.spectralInfo.freqString ? this.spectralInfo.freqString : this.spectralInfo.velocityString;
        return `${this.spectralInfo.spectralString?.replace(/\w+\s\(/, "")?.replace(/\):\s/, "\u000A")}${infoString?.replace(/\w+:\s/, "\u000A")}`;
    }

    @computed get isPVImage(): boolean {
        if (this.frameInfo?.fileInfoExtended?.headerEntries) {
            const entries = this.frameInfo.fileInfoExtended.headerEntries;
            const axis1 = entries.find(entry => entry.name.includes("CTYPE1"));
            return axis1?.value?.match(/offset|position|offset position/i) ? true : false;
        }
        return false;
    }

    @computed get isSwappedImage(): boolean {
        const spectral = this.frameInfo.fileInfoExtended.axesNumbers.spectral;
        const dirX = this.frameInfo.fileInfoExtended.axesNumbers.dirX;
        const dirY = this.frameInfo.fileInfoExtended.axesNumbers.dirY;
        return (spectral === 0 && (dirX === 1 || dirY === 1)) || (spectral === 1 && (dirX === 0 || dirY === 0));
    }

    @computed get isUVImage(): boolean {
        return this.uvAxis !== undefined;
    }

    @computed get uvAxis(): number {
        if (this.frameInfo?.fileInfoExtended?.headerEntries) {
            const entries = this.frameInfo.fileInfoExtended.headerEntries;
            const axis1 = entries.find(entry => entry.name.includes("CTYPE1"));
            const axis2 = entries.find(entry => entry.name.includes("CTYPE2"));
            if (axis1?.value?.match(/uu/i)) {
                return 1;
            } else if (axis2?.value?.match(/uu/i)) {
                return 2;
            }
        }
        return undefined;
    }

    @computed get spectralAxis(): {valid: boolean; dimension: number; type: SpectralTypeSet; specsys: string; value: number} {
        if (this.frameInfo?.fileInfoExtended?.headerEntries) {
            const entries = this.frameInfo.fileInfoExtended.headerEntries;

            // Locate spectral dimension from axis 1~4
            let dimension = undefined;
            const spectralAxis = this.frameInfo.fileInfoExtended.axesNumbers.spectral + 1;
            if (spectralAxis > 0) {
                dimension = spectralAxis;
            }

            // Fill up spectral dimension & type/unit/system
            if (dimension) {
                const spectralHeader = entries.find(entry => entry.name.includes(`CTYPE${dimension}`));
                const spectralValue = spectralHeader?.value.trim().toUpperCase();
                const spectralType = STANDARD_SPECTRAL_TYPE_SETS.find(type => spectralValue === type.code);
                const valueHeader = entries.find(entry => entry.name.includes(`CRVAL${dimension}`));
                const unitHeader = entries.find(entry => entry.name.includes(`CUNIT${dimension}`));
                const specSysHeader = entries.find(entry => entry.name.includes("SPECSYS"));
                const specsys = specSysHeader?.value ? trimFitsComment(specSysHeader.value)?.toUpperCase() : undefined;
                if (spectralType) {
                    return {
                        valid: true,
                        dimension: dimension,
                        type: {name: spectralType.name, code: spectralType.code, unit: unitHeader?.value?.trim() ?? spectralType.unit},
                        specsys: specsys,
                        value: getHeaderNumericValue(valueHeader)
                    };
                } else {
                    return {
                        valid: false,
                        dimension: dimension,
                        type: {name: spectralValue, code: spectralValue, unit: unitHeader?.value?.trim() ?? undefined},
                        specsys: specsys,
                        value: getHeaderNumericValue(valueHeader)
                    };
                }
            }
        }
        return undefined;
    }

    @computed get depthAxis(): {dimension: number; type: string; unit: string} {
        if (this.frameInfo?.fileInfoExtended?.headerEntries) {
            const entries = this.frameInfo.fileInfoExtended.headerEntries;

            // Locate depth dimension from axis 1~4
            let dimension = undefined;
            const depthAxis = this.frameInfo.fileInfoExtended.axesNumbers.depth + 1;
            if (depthAxis > 0) {
                dimension = depthAxis;
            }

            if (dimension) {
                const typeHeader = entries.find(entry => entry.name.includes(`CTYPE${dimension}`));
                const type = typeHeader ? typeHeader.value.trim().toUpperCase() : "";
                const unit = entries.find(entry => entry.name.includes(`CUNIT${dimension}`));
                return {
                    dimension: dimension,
                    type: type,
                    unit: unit?.value?.trim() ?? undefined
                };
            }
        }
        return undefined;
    }

    @computed get isSpectralCoordinateConvertible(): boolean {
        if (!this.spectralAxis || (this.spectralAxis && !this.spectralAxis.valid) || !this.spectralFrame) {
            return false;
        }
        return IsSpectralTypeSupported(this.spectralAxis.type.code as string) && IsSpectralUnitSupported(this.spectralAxis.type.unit as string);
    }

    @computed get isSpectralSystemConvertible(): boolean {
        if (!this.spectralAxis || !this.spectralFrame) {
            return false;
        }
        return IsSpectralSystemSupported(this.spectralAxis.specsys as string);
    }

    @computed get isSpectralPropsEqual(): boolean {
        let result = false;
        if (this.spectralAxis?.type && this.spectralAxis?.specsys) {
            const isTypeEqual = this.spectralAxis.type.code === (this.spectralType as string);
            const isUnitEqual = this.spectralAxis.type.unit === (this.spectralUnit as string);
            const isSpecsysEqual = this.spectralAxis.specsys === (this.spectralSystem as string);
            result = isTypeEqual && isUnitEqual && isSpecsysEqual;
        }
        return result;
    }

    @computed get isRestFreqEditable(): boolean {
        return (
            (this.frameInfo?.fileInfoExtended?.depth > 1 || this.isPVImage) &&
            (this.spectralAxis?.type?.code === SpectralType.FREQ || this.spectralAxis?.type?.code === SpectralType.WAVE || this.spectralAxis?.type?.code === SpectralType.AWAV)
        );
    }

    @computed get isCoordChannel(): boolean {
        return this.spectralType === SpectralType.CHANNEL;
    }

    @computed get isCoordVelocity(): boolean {
        return this.spectralType === SpectralType.VRAD || this.spectralType === SpectralType.VOPT;
    }

    @computed get nativeSpectralCoordinate(): string {
        return this.spectralAxis ? `${this.spectralAxis.type.name}${this.spectralAxis.type.unit ? ` (${this.spectralAxis.type.unit})` : ""}` : undefined;
    }

    @computed get spectralCoordinate(): string {
        return !this.spectralType && !this.spectralUnit ? this.nativeSpectralCoordinate : GenCoordinateLabel(this.spectralType, this.spectralUnit);
    }

    @computed get spectralLabel(): string {
        let label = undefined;
        if (this.spectralAxis) {
            const spectralSystem = this.isSpectralSystemConvertible ? this.spectralSystem : this.spectralAxis.specsys;
            label = `${spectralSystem ? `[${spectralSystem}] ` : ""}${this.spectralCoordinate ?? ""}`;
        }
        return label;
    }

    @computed get spectralUnitStr(): string {
        if (this.spectralAxis && !this.spectralType && !this.spectralUnit) {
            return this.spectralAxis.type.unit;
        }
        return this.isCoordChannel ? SPECTRAL_TYPE_STRING.get(SpectralType.CHANNEL) : (this.spectralUnit as string);
    }

    @computed get depthLabel(): string {
        let label = undefined;
        if (this.depthAxis) {
            label = `${this.depthAxis.type} ${this.depthAxis.unit ? `(${this.depthAxis.unit})` : ""}`;
        }
        return label;
    }

    @computed get hasStokes(): boolean {
        return this.frameInfo && this.frameInfo.fileInfoExtended && this.frameInfo.fileInfoExtended.stokes > 1;
    }

    @computed get numChannels(): number {
        return this.frameInfo.fileInfoExtended.depth;
    }

    @computed get channelValueBounds(): CARTA.FloatBounds {
        if (this.numChannels > 1 && this.channelValues) {
            const head = this.channelValues[0];
            const tail = this.channelValues[this.numChannels - 1];
            return new CARTA.FloatBounds(head <= tail ? {min: head, max: tail} : {min: tail, max: head});
        }
        return null;
    }

    @computed get spectralSiblings(): FrameStore[] {
        if (this.spectralReference) {
            let siblings = [];
            siblings.push(this.spectralReference);
            siblings.push(...this.spectralReference.secondarySpectralImages.slice().filter(f => f !== this));
            return siblings;
        } else {
            return this.secondarySpectralImages.slice();
        }
    }

    @computed get spatialSiblings(): FrameStore[] {
        if (this.spatialReference) {
            let siblings = [];
            siblings.push(this.spatialReference);
            siblings.push(...this.spatialReference.secondarySpatialImages.slice().filter(f => f !== this));
            return siblings;
        } else {
            return this.secondarySpatialImages.slice();
        }
    }

    @computed get renderConfigSiblings(): FrameStore[] {
        if (this.rasterScalingReference) {
            let siblings = [];
            siblings.push(this.rasterScalingReference);
            siblings.push(...this.rasterScalingReference.secondaryRasterScalingImages.slice().filter(f => f !== this));
            return siblings;
        } else {
            return this.secondaryRasterScalingImages.slice();
        }
    }

    @computed get isCursorValueCurrent(): boolean {
        if (!this.cursorValue || !this.cursorInfo) {
            return false;
        }

        const roundedPosInfo = round2D(this.cursorInfo.posImageSpace);
        const roundedPosValue = round2D(this.cursorValue.position);

        return this.cursorValue.channel === this.channel && roundedPosInfo.x === roundedPosValue.x && roundedPosInfo.y === roundedPosValue.y;
    }

    @computed
    private get zoomLevelForFit() {
        return Math.min(this.calculateZoomX, this.calculateZoomY);
    }

    @computed
    private get calculateZoomX() {
        const imageWidth = this.frameInfo.fileInfoExtended.width;
        const pixelRatio = (this.renderHiDPI ? devicePixelRatio * AppStore.Instance.imageRatio : 1.0) / this.aspectRatio;

        if (imageWidth <= 0) {
            return 1.0;
        }
        return (this.renderWidth * pixelRatio) / imageWidth;
    }

    @computed
    private get calculateZoomY() {
        const imageHeight = this.frameInfo.fileInfoExtended.height;
        const pixelRatio = this.renderHiDPI ? devicePixelRatio * AppStore.Instance.imageRatio : 1.0;
        if (imageHeight <= 0) {
            return 1.0;
        }
        return (this.renderHeight * pixelRatio) / imageHeight;
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

    @computed get stokesOptions(): {value: number; label: string}[] {
        let stokesOptions = [];
        if (this.frameInfo && this.frameInfo.fileInfoExtended && this.frameInfo.fileInfoExtended.headerEntries) {
            const ctype = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.value.toUpperCase() === "STOKES");
            if (ctype && ctype.name.indexOf("CTYPE") !== -1) {
                const index = ctype.name.substring(5);
                const naxisHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`NAXIS${index}`) !== -1);
                const crpixHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`CRPIX${index}`) !== -1);
                const crvalHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`CRVAL${index}`) !== -1);
                const cdeltHeader = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf(`CDELT${index}`) !== -1);

                // Skip if any headers are missing
                if (!naxisHeader || !crpixHeader || !crvalHeader || !cdeltHeader) {
                    return [];
                }

                for (let i = 0; i < parseInt(naxisHeader.value); i++) {
                    const stokesVal = getHeaderNumericValue(crvalHeader) + (i + 1 - getHeaderNumericValue(crpixHeader)) * getHeaderNumericValue(cdeltHeader);
                    if (STANDARD_POLARIZATIONS.has(stokesVal)) {
                        stokesOptions.push({value: stokesVal, label: POLARIZATION_LABELS.get(STANDARD_POLARIZATIONS.get(stokesVal))});
                    }
                }
            }
        }
        return stokesOptions;
    }

    @computed get hasLinearStokes(): boolean {
        const options = this.stokesOptions;
        const labelQ = POLARIZATION_LABELS.get("Q");
        const labelU = POLARIZATION_LABELS.get("U");
        return !!options.find(o => o.label === labelQ) && !!options.find(o => o.label === labelU);
    }

    @computed get stokesInfo(): string[] {
        return this.stokesOptions?.map(option => {
            return option?.label;
        });
    }

    // including standard and computed polarizations eg.[1, 2, 3, 4, 13, 14, 15, 16, 17]
    @computed get polarizations(): number[] {
        const polarizations = this.stokesOptions?.map(option => {
            return option.value;
        });
        const hasI: boolean = polarizations.includes(POLARIZATIONS.I);
        const hasQ: boolean = polarizations.includes(POLARIZATIONS.Q);
        const hasU: boolean = polarizations.includes(POLARIZATIONS.U);
        const hasV: boolean = polarizations.includes(POLARIZATIONS.V);

        if (hasQ && hasU) {
            if (hasV) {
                polarizations.push(POLARIZATIONS.Ptotal);
            }
            polarizations.push(POLARIZATIONS.Plinear);
            if (hasI && hasV) {
                polarizations.push(POLARIZATIONS.PFtotal);
            }
            if (hasI) {
                polarizations.push(POLARIZATIONS.PFlinear);
            }
            polarizations.push(POLARIZATIONS.Pangle);
        }

        return polarizations;
    }

    @computed get polarizationInfo(): string[] {
        return this.polarizations?.map(polarization => {
            return POLARIZATION_LABELS.get(FULL_POLARIZATIONS.get(polarization));
        });
    }

    @computed get coordinateOptions(): {value: string; label: string}[] {
        return this.polarizations?.map(polarization => {
            return {value: FULL_POLARIZATIONS.get(polarization), label: POLARIZATION_LABELS.get(FULL_POLARIZATIONS.get(polarization))};
        });
    }

    @computed get coordinateOptionsZ(): {value: string; label: string}[] {
        return this.polarizations?.map(polarization => {
            return {value: FULL_POLARIZATIONS.get(polarization) + "z", label: POLARIZATION_LABELS.get(FULL_POLARIZATIONS.get(polarization))};
        });
    }

    @computed get requiredPolarization(): number {
        return this.polarizations?.[this.requiredPolarizationIndex];
    }

    @computed get requiredPolarizationInfo(): string {
        return this.polarizationInfo?.[this.requiredPolarizationIndex];
    }

    @computed get requiredPolarizationIndex(): number {
        if (COMPUTED_POLARIZATIONS.has(this.requiredStokes) && this.polarizations.includes(this.requiredStokes)) {
            return this.polarizations.indexOf(this.requiredStokes);
        } else {
            return this.requiredStokes;
        }
    }

    get headerRestFreq(): number {
        return this.frameInfo?.fileInfoExtended?.headerEntries?.find(entry => entry.name === "RESTFRQ")?.numericValue;
    }

    constructor(frameInfo: FrameInfo) {
        makeObservable(this);
        this.overlayStore = OverlayStore.Instance;
        this.logStore = LogStore.Instance;
        this.backendService = BackendService.Instance;
        const preferenceStore = PreferenceStore.Instance;

        this.spectralFrame = null;
        this.spectralType = null;
        this.spectralUnit = null;
        this.spectralSystem = null;
        this.channelValues = null;
        this.spectralCoordsSupported = null;
        this.spectralSystemsSupported = null;
        this.wcsInfo = null;
        this.wcsInfoForTransformation = null;
        this.wcsInfo3D = null;
        this.validWcs = false;
        this.frameInfo = frameInfo;
        this.initialCenter = {x: (this.frameInfo.fileInfoExtended.width - 1) / 2.0, y: (this.frameInfo.fileInfoExtended.height - 1) / 2.0};
        this.renderHiDPI = true;
        this.center = {x: 0, y: 0};
        this.stokes = 0;
        this.channel = 0;
        this.requiredStokes = 0;
        this.requiredChannel = 0;
        this.renderConfig = new RenderConfigStore(preferenceStore, this);
        this.colorbarStore = new ColorbarStore(this);
        this.contourConfig = new ContourConfigStore(preferenceStore);
        this.contourStores = new Map<number, ContourStore>();
        this.vectorOverlayConfig = new VectorOverlayConfigStore(preferenceStore, this);
        this.vectorOverlayStore = new VectorOverlayStore(this);
        this.moving = false;
        this.zooming = false;
        this.colorbarLabelCustomText = this.requiredUnit === undefined || !this.requiredUnit.length ? "arbitrary units" : this.requiredUnit;
        this.titleCustomText = "";
        this.overlayBeamSettings = new OverlayBeamStore();
        this.spatialReference = null;
        this.spatialTransformAST = null;
        this.catalogControlMaps = new Map<FrameStore, CatalogControlMap>();
        this.controlMaps = new Map<FrameStore, ControlMap>();
        this.secondarySpatialImages = [];
        this.secondarySpectralImages = [];
        this.secondaryRasterScalingImages = [];
        this.momentImages = [];
        this.pvImage = null;
        this.fittingResult = "";
        this.fittingLog = "";

        this.isRequestingMoments = false;
        this.requestingMomentsProgress = 0;
        this.isRequestingPV = false;
        this.requestingPVProgress = 0;
        this.cursorMovementHandle = null;

        this.stokesFiles = [];

        this.distanceMeasuring = new DistanceMeasuringStore();

        // synchronize AST overlay's color/grid/label with preference when frame is created
        const astColor = preferenceStore.astColor;
        if (astColor !== this.overlayStore.global.color) {
            this.overlayStore.global.setColor(astColor);
        }
        const astGridVisible = preferenceStore.astGridVisible;
        if (astGridVisible !== this.overlayStore.grid.visible) {
            this.overlayStore.grid.setVisible(astGridVisible);
        }
        const astLabelsVisible = preferenceStore.astLabelsVisible;
        if (astLabelsVisible !== this.overlayStore.labels.visible) {
            this.overlayStore.labels.setVisible(astLabelsVisible);
        }
        const colorbarVisible = preferenceStore.colorbarVisible;
        if (colorbarVisible !== this.overlayStore.colorbar.visible) {
            this.overlayStore.colorbar.setVisible(colorbarVisible);
        }
        const colorbarInteractive = preferenceStore.colorbarInteractive;
        if (colorbarInteractive !== this.overlayStore.colorbar.interactive) {
            this.overlayStore.colorbar.setInteractive(colorbarInteractive);
        }
        const colorbarPosition = preferenceStore.colorbarPosition;
        if (colorbarPosition !== this.overlayStore.colorbar.position) {
            this.overlayStore.colorbar.setPosition(colorbarPosition);
        }
        const colorbarWidth = preferenceStore.colorbarWidth;
        if (colorbarWidth !== this.overlayStore.colorbar.width) {
            this.overlayStore.colorbar.setWidth(colorbarWidth);
        }
        const colorbarTicksDensity = preferenceStore.colorbarTicksDensity;
        if (colorbarTicksDensity !== this.overlayStore.colorbar.tickDensity) {
            this.overlayStore.colorbar.setTickDensity(colorbarTicksDensity);
        }
        const colorbarLabelVisible = preferenceStore.colorbarLabelVisible;
        if (colorbarLabelVisible !== this.overlayStore.colorbar.labelVisible) {
            this.overlayStore.colorbar.setLabelVisible(colorbarLabelVisible);
        }

        this.frameRegionSet = new RegionSetStore(this, PreferenceStore.Instance, BackendService.Instance);
        this.currentFrameView = {
            xMin: 0,
            xMax: 0,
            yMin: 0,
            yMax: 0,
            mip: 999
        };
        this.animationChannelRange = [0, frameInfo.fileInfoExtended.depth - 1];

        if (this.isPVImage && this.spectralAxis?.valid) {
            const astFrameSet = this.initPVFrame();
            if (astFrameSet) {
                this.spectralFrame = AST.getSpectralFrame(astFrameSet);
                this.wcsInfo = AST.copy(astFrameSet);
                AST.deleteObject(astFrameSet);
            }
        } else if (this.isPVImage || this.isSwappedImage) {
            const astFrameSet = this.initSwappedFrame();
            if (astFrameSet) {
                AST.set(astFrameSet, "Equinox=J2010"); // To avoid negative angles on the RA axis
                this.spectralFrame = AST.getSpectralFrame(astFrameSet);
                this.wcsInfoSwappedAxes = AST.copy(astFrameSet);
                this.updateSwappedFrameSet();
                AST.deleteObject(astFrameSet);
            }
        } else if (this.isUVImage) {
            // TODO: Refactor the code to avoid redundancy between astFrameSet and astFrameSet2D
            const astFrameSet = this.initFrame(false);
            const astFrameSet2D = this.initFrame2D();
            if (astFrameSet && astFrameSet2D) {
                this.spectralFrame = AST.getSpectralFrame(astFrameSet);
                if (frameInfo.fileInfoExtended.depth > 1) {
                    // 3D frame
                    this.wcsInfo3D = AST.copy(astFrameSet);
                    this.wcsInfo = AST.copy(astFrameSet2D);
                } else {
                    // 2D frame
                    this.wcsInfo = AST.copy(astFrameSet);
                }
            }
            AST.deleteObject(astFrameSet);
            AST.deleteObject(astFrameSet2D);
        } else {
            // init WCS
            const astFrameSet = this.initFrame();
            if (astFrameSet) {
                this.spectralFrame = AST.getSpectralFrame(astFrameSet);
                if (frameInfo.fileInfoExtended.depth > 1) {
                    // 3D frame
                    this.wcsInfo3D = AST.copy(astFrameSet);
                    this.wcsInfo = AST.getSkyFrameSet(this.wcsInfo3D);
                } else {
                    // 2D frame
                    this.wcsInfo = AST.copy(astFrameSet);
                }
                AST.deleteObject(astFrameSet);

                if (this.wcsInfo) {
                    // init 2D(Sky) wcs copy for the precision of region coordinate transformation
                    this.wcsInfoForTransformation = AST.copy(this.wcsInfo);
                    AST.set(this.wcsInfoForTransformation, `Format(1)=${AppStore.Instance.overlayStore.numbers.formatTypeX}.${WCS_PRECISION}`);
                    AST.set(this.wcsInfoForTransformation, `Format(2)=${AppStore.Instance.overlayStore.numbers.formatTypeY}.${WCS_PRECISION}`);
                    this.validWcs = true;
                    this.overlayStore.setDefaultsFromAST(this);
                }
            }
        }

        if (!this.wcsInfo) {
            this.logStore.addWarning(`Problem processing headers in file ${this.filename} for AST`, ["ast"]);
            this.wcsInfo = AST.initDummyFrame();
        }

        const cUnit1 = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name === "CUNIT1");
        const cUnit2 = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name === "CUNIT2");
        const hasUnits = cUnit1 && cUnit2;
        const sameUnits = hasUnits && trimFitsComment(cUnit1.value) === trimFitsComment(cUnit2.value);

        // If the two units are different, there's no fixed aspect ratio
        if (hasUnits && !sameUnits) {
            this.framePixelRatio = NaN;
        } else {
            // Assumes non-rotated pixels
            const cDelt1 = getPixelSize(this, 1);
            const cDelt2 = getPixelSize(this, 2);
            this.framePixelRatio = Math.abs(cDelt1 / cDelt2);
            // Correct for numerical errors in CDELT values if they're within 0.1% of each other
            if (Math.abs(this.framePixelRatio - 1.0) < 0.001) {
                this.framePixelRatio = 1.0;
            }
        }

        const headerRestFreq = this.headerRestFreq;
        this.restFreqStore = new RestFreqStore(headerRestFreq);
        this.initSupportedSpectralConversion();
        this.initCenter();
        this.zoomLevel = preferenceStore.isZoomRAWMode ? 1.0 : this.zoomLevelForFit;
        this.pixelUnitSizeArcsec = this.getPixelUnitSize();

        // init spectral settings
        if (this.spectralAxis && IsSpectralTypeSupported(this.spectralAxis.type.code as string) && IsSpectralUnitSupported(this.spectralAxis.type.unit as string)) {
            if (this.isPVImage) {
                this.spectralType = SpectralType.VRAD;
            } else {
                this.spectralType = this.spectralAxis.type.code as SpectralType;
            }
            this.spectralUnit = SPECTRAL_DEFAULT_UNIT.get(this.spectralType);
        }
        if (this.isSpectralSystemConvertible) {
            this.spectralSystem = this.spectralAxis.specsys as SpectralSystem;
        }

        // need initialized wcs to get correct cursor info
        this.cursorInfo = this.getCursorInfo(this.center);
        this.cursorValue = {position: {x: NaN, y: NaN}, channel: 0, value: NaN};
        this.cursorMoving = false;

        reaction(
            () => this.restFreqStore.restFreqInHz,
            restFreq => {
                if (this.restFreqStore.inValidInput || !isFinite(restFreq)) {
                    return;
                }

                if (this.wcsInfo3D) {
                    AST.set(this.wcsInfo3D, `RestFreq=${restFreq} Hz`);
                }
                if (this.spectralFrame) {
                    AST.set(this.spectralFrame, `RestFreq=${restFreq} Hz`);
                }

                if (this.spectralReference) {
                    const spectralReference = this.spectralReference;
                    this.clearSpectralReference();
                    this.setSpectralReference(spectralReference);
                } else if (this.secondarySpectralImages.length > 0) {
                    for (const frame of this.secondarySpectralImages) {
                        frame.clearSpectralReference();
                        frame.setSpectralReference(this);
                    }
                }
            }
        );

        // requiredFrameViewForRegionRender is a copy of requiredFrameView in non-observable version,
        // to avoid triggering wasted render() in PointRegionComponent/SimpleShapeRegionComponent/LineSegmentRegionComponent
        autorun(() => {
            if (this.requiredFrameView) {
                this.requiredFrameViewForRegionRender = this.requiredFrameView;
            }
        });

        autorun(() => {
            // update zoomLevel when image viewer is available for drawing
            if (this.isRenderable && this.zoomLevel <= 0) {
                this.setZoom(this.zoomLevelForFit);
            }
        });

        // if type/unit/specsys/restFreq changes, trigger spectral conversion
        autorun(() => {
            const type = this.spectralType;
            const unit = this.spectralUnit;
            /* eslint-disable @typescript-eslint/no-unused-vars */
            const specsys = this.spectralSystem;
            const restFreq = this.restFreqStore.restFreqInHz;
            /* eslint-enable @typescript-eslint/no-unused-vars */
            if (this.channelInfo) {
                if (!type && !unit) {
                    this.setChannelValues(this.channelInfo.values);
                } else if (this.isCoordChannel) {
                    this.setChannelValues(this.channelInfo.indexes);
                } else {
                    this.setChannelValues(this.isSpectralPropsEqual ? this.channelInfo.values : this.convertSpectral(this.channelInfo.values));
                }
            }
        });

        autorun(() => {
            this.distanceMeasuring.updateTransformedPos(this.spatialTransform);
        });
    }

    // This function shifts the pixel axis by 1, so that it starts at 0, rather than 1
    // For entries that are not related to the reference pixel location, the current value is returned
    private static ShiftASTCoords = (entry: CARTA.IHeaderEntry, currentValue: string) => {
        if (entry.name.match(/CRPIX\d+/)) {
            const numericValue = parseFloat(entry.value);
            if (isFinite(numericValue)) {
                return (numericValue - 1).toString();
            }
        }
        return currentValue;
    };

    private convertSpectral = (values: Array<number>): Array<number> => {
        const N = values?.length;
        if (!N || !this.spectralFrame) {
            return null;
        }

        const convertedArray = AST.transformSpectralPointArray(this.spectralFrame, this.spectralType, this.spectralUnit, this.spectralSystem, values);
        return Array.from(convertedArray);
    };

    private astSpectralTransform = (type: SpectralType, unit: SpectralUnit, system: SpectralSystem, value: number): number => {
        if (!this.spectralFrame || !isFinite(value)) {
            return undefined;
        }
        return AST.transformSpectralPoint(this.spectralFrame, type, unit, system, value);
    };

    private initPVFrame = (): AST.FrameSet => {
        const spectralDimension = this.spectralAxis?.dimension;
        if (!this.isPVImage || !(spectralDimension === 2 || spectralDimension === 3)) {
            return undefined;
        }

        const fitsChan = AST.emptyFitsChan();
        for (let entry of this.frameInfo.fileInfoExtended.headerEntries) {
            if (entry.name.match(/(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)[4-9]/)) {
                continue;
            }

            let name = entry.name;
            if (spectralDimension === 2) {
                if (entry.name.match(/(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)[3]/)) {
                    continue;
                }
            } else {
                // spectralDimension === 3
                if (entry.name.match(/(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)[2]/)) {
                    continue;
                } else if (entry.name.match(/(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)[3]/)) {
                    name = entry.name.replace("3", "2");
                }
            }

            let value = trimFitsComment(entry.value);
            if (entry.name.toUpperCase() === "NAXIS" || entry.name.toUpperCase() === "WCSAXES") {
                value = "2";
            }
            if (entry.entryType === CARTA.EntryType.STRING) {
                value = `'${value}'`;
            } else {
                value = FrameStore.ShiftASTCoords(entry, value);
            }

            // For the case y-axis is not the spectral axis
            if (value.match(/DEC--*/)) {
                value = "'Declination'";
            } else if (value.match(/RA---*/)) {
                value = "'Right ascension'";
            } else if (value.match(/GLON-*/)) {
                value = "'Galactic longitude'";
            } else if (value.match(/GLAT-*/)) {
                value = "'Galactic latitude'";
            }

            while (name.length < 8) {
                name += " ";
            }

            const entryString = `${name}=  ${value}`;
            AST.putFits(fitsChan, entryString);
        }
        return AST.getFrameFromFitsChan(fitsChan, false);
    };

    private initFrame2D = (): AST.FrameSet => {
        const fitsChan = AST.emptyFitsChan();
        for (let entry of this.frameInfo.fileInfoExtended.headerEntries) {
            if (entry.name.match(/(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)[3-9]/)) {
                continue;
            }

            let name = entry.name;
            let value = trimFitsComment(entry.value);
            if (entry.name.toUpperCase() === "NAXIS" || entry.name.toUpperCase() === "WCSAXES") {
                value = "2";
            }
            if (entry.entryType === CARTA.EntryType.STRING) {
                value = `'${value}'`;
            } else {
                value = FrameStore.ShiftASTCoords(entry, value);
            }

            while (name.length < 8) {
                name += " ";
            }

            const entryString = `${name}=  ${value}`;
            AST.putFits(fitsChan, entryString);
        }
        return AST.getFrameFromFitsChan(fitsChan, false);
    };

    private initFrame = (checkSkyDomain: boolean = true): AST.FrameSet => {
        const dimension = this.frameInfo.fileInfoExtended.depth > 1 ? "3" : "2";
        const fitsChan = AST.emptyFitsChan();
        for (let entry of this.frameInfo.fileInfoExtended.headerEntries) {
            let name = entry.name;

            // Skip higher dimensions
            if (dimension === "2") {
                if (entry.name.match(/(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)[3-9]/)) {
                    continue;
                }
            } else {
                // check whether spectral axis is axis 3 or 4
                if (
                    entry.name.match(/(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)[5-9]/) ||
                    (this.spectralAxis?.dimension === 3 && entry.name.match(/(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)4/)) ||
                    (this.spectralAxis?.dimension === 4 && entry.name.match(/(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)3/))
                ) {
                    continue;
                }
                if (this.spectralAxis?.dimension === 4 && entry.name.match(/(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)4/)) {
                    name = entry.name.replace("4", "3");
                }
            }

            // Skip empty header entries
            if (!entry.value.length) {
                continue;
            }

            let value = trimFitsComment(entry.value);
            if (entry.name.toUpperCase() === "NAXIS" || entry.name.toUpperCase() === "WCSAXES") {
                value = dimension;
            }
            if (entry.entryType === CARTA.EntryType.STRING) {
                value = `'${value}'`;
            } else {
                value = FrameStore.ShiftASTCoords(entry, value);
            }

            while (name.length < 8) {
                name += " ";
            }

            const entryString = `${name}=  ${value}`;
            AST.putFits(fitsChan, entryString);
        }
        return AST.getFrameFromFitsChan(fitsChan, checkSkyDomain);
    };

    private initSwappedFrame = (): AST.FrameSet => {
        const fitsChan = AST.emptyFitsChan();
        const stokesAxis = this.frameInfo.fileInfoExtended.axesNumbers.stokes + 1;
        let regStokesAxis = new RegExp(`(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)${stokesAxis}`);

        for (let entry of this.frameInfo.fileInfoExtended.headerEntries) {
            let name = entry.name;
            if (name === "HISTORY") {
                continue;
            }

            if (entry.name.match(/(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)[5-9]/)) {
                continue;
            }

            if (stokesAxis > 0 && entry.name.match(regStokesAxis)) {
                continue;
            }

            if (entry.name.match(/(CTYPE|CDELT|CRPIX|CRVAL|CUNIT|NAXIS|CROTA)4/)) {
                if (stokesAxis > 0) {
                    name = entry.name.replace("4", `${stokesAxis}`);
                } else {
                    continue;
                }
            }

            if (!entry.value.length) {
                continue;
            }

            let value = trimFitsComment(entry.value);
            if (entry.name.toUpperCase() === "NAXIS" || entry.name.toUpperCase() === "WCSAXES") {
                value = "3";
            }

            if (entry.entryType === CARTA.EntryType.STRING) {
                value = `'${value}'`;
            } else {
                value = FrameStore.ShiftASTCoords(entry, value);
            }

            while (name.length < 8) {
                name += " ";
            }

            const entryString = `${name}=  ${value}`;
            AST.putFits(fitsChan, entryString);
        }
        return AST.getFrameFromFitsChan(fitsChan, false);
    };

    public updateSwappedFrameSet = () => {
        if (this.wcsInfoSwappedAxes) {
            const spectralAxis = this.frameInfo.fileInfoExtended.axesNumbers.spectral + 1;
            const dirXAxis = this.frameInfo.fileInfoExtended.axesNumbers.dirX + 1;
            const dirYAxis = this.frameInfo.fileInfoExtended.axesNumbers.dirY + 1;
            const dirAxis = dirXAxis < dirYAxis ? dirXAxis : dirYAxis;
            let dirAxisSize;
            if (dirAxis === 1) {
                dirAxisSize = this.frameInfo.fileInfoExtended.width;
            } else {
                // For dirAxis === 2
                dirAxisSize = this.frameInfo.fileInfoExtended.height;
            }
            const requiredChannel = this.requiredChannel + 1;
            this.wcsInfo = AST.make2DSwappedFrameSet(this.wcsInfoSwappedAxes, dirAxis, spectralAxis, requiredChannel, dirAxisSize, 3);
        }
    };

    private sanitizeChannelNumber(channel: number) {
        if (!isFinite(channel)) {
            return this.requiredChannel;
        }

        return Math.round(clamp(channel, 0, this.frameInfo.fileInfoExtended.depth - 1));
    }

    private replaceZoomTimeoutHandler = () => {
        if (this.zoomTimeoutHandler) {
            clearTimeout(this.zoomTimeoutHandler);
        }

        this.zoomTimeoutHandler = setTimeout(this.endZoom, FrameStore.ZoomInertiaDuration);
    };

    @action private endZoom = () => {
        this.zooming = false;
    };

    private getPixelUnitSize = () => {
        if (this.isPVImage || this.isUVImage) {
            return null;
        }
        const crpix1 = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf("CRPIX1") !== -1);
        const crpix2 = this.frameInfo.fileInfoExtended.headerEntries.find(entry => entry.name.indexOf("CRPIX2") !== -1);
        if (crpix1 && crpix2) {
            const crpix1Val = getHeaderNumericValue(crpix1);
            const crpix2Val = getHeaderNumericValue(crpix2);
            const xUnitSize = Math.round(AST.geodesicDistance(this.wcsInfo, crpix1Val, crpix2Val, crpix1Val + 1, crpix2Val) * 1e6) / 1e6;
            const yUnitSize = Math.round(AST.geodesicDistance(this.wcsInfo, crpix1Val, crpix2Val, crpix1Val, crpix2Val + 1) * 1e6) / 1e6;
            if (isFinite(xUnitSize) && isFinite(yUnitSize)) {
                return {x: xUnitSize, y: yUnitSize};
            }
        }
        return null;
    };

    public getRegion = (regionId: number): RegionStore => {
        return this.regionSet?.regions?.find(r => r.regionId === regionId);
    };

    public convertToNativeWCS = (value: number): number => {
        if (!this.spectralFrame || !isFinite(value)) {
            return undefined;
        }
        return AST.transformSpectralPoint(this.spectralFrame, this.spectralType, this.spectralUnit, this.spectralSystem, value, false);
    };

    public convertFreqMHzToSettingWCS = (value: number): number => {
        if (!this.spectralFrame || !isFinite(value)) {
            return undefined;
        }

        if (this.spectralType === SpectralType.FREQ && this.spectralUnit === SpectralUnit.MHZ) {
            return value;
        }

        const nativeWCSValue = AST.transformSpectralPoint(this.spectralFrame, SpectralType.FREQ, SpectralUnit.MHZ, this.spectralSystem, value, false);
        if (!isFinite(nativeWCSValue)) {
            return undefined;
        }

        const settingWCSValue = this.astSpectralTransform(this.spectralType, this.spectralUnit, this.spectralSystem, nativeWCSValue);
        return isFinite(settingWCSValue) ? settingWCSValue : undefined;
    };

    public getCursorInfo(cursorPosImageSpace: Point2D) {
        let cursorPosWCS, cursorPosFormatted;
        if (this.validWcs || this.isPVImage || this.isUVImage) {
            // We need to compare X and Y coordinates in both directions
            // to avoid a confusing drop in precision at rounding threshold
            const offsetBlock = [
                [0, 0],
                [1, 1],
                [-1, -1]
            ];

            // Shift image space coordinates to 1-indexed when passing to AST
            const cursorNeighbourhood = offsetBlock.map(offset => transformPoint(this.wcsInfo, {x: cursorPosImageSpace.x + offset[0], y: cursorPosImageSpace.y + offset[1]}));

            cursorPosWCS = cursorNeighbourhood[0];

            const normalizedNeighbourhood = cursorNeighbourhood.map(pos => AST.normalizeCoordinates(this.wcsInfo, pos.x, pos.y));

            let precisionX = 0;
            let precisionY = 0;

            while (precisionX < FrameStore.CursorInfoMaxPrecision && precisionY < FrameStore.CursorInfoMaxPrecision) {
                let astString = new ASTSettingsString();
                astString.add("Format(1)", this.isPVImage || this.isUVImage ? undefined : this.overlayStore.numbers.cursorFormatStringX(precisionX));
                astString.add("Format(2)", this.isPVImage || this.isUVImage ? undefined : this.overlayStore.numbers.cursorFormatStringY(precisionY));
                astString.add("System", this.isPVImage || this.isUVImage ? "cartesian" : this.overlayStore.global.explicitSystem);

                let formattedNeighbourhood = normalizedNeighbourhood.map(pos => AST.getFormattedCoordinates(this.wcsInfo, pos.x, pos.y, astString.toString(), true));
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

        const imageX = Math.round(cursorPosImageSpace.x);
        const imageY = Math.round(cursorPosImageSpace.y);
        const isInsideImage = imageX >= 0 && imageX < this.frameInfo.fileInfoExtended.width && imageY >= 0 && imageY < this.frameInfo.fileInfoExtended.height;

        return {
            posImageSpace: cursorPosImageSpace,
            isInsideImage: isInsideImage,
            posWCS: cursorPosWCS,
            infoWCS: cursorPosFormatted
        };
    }

    @action setColorbarLabelCustomText = (text: string) => {
        this.colorbarLabelCustomText = text;
    };

    @action setTitleCustomText = (text: string) => {
        this.titleCustomText = text;
    };

    public getControlMap(frame: FrameStore) {
        const preferenceStore = PreferenceStore.Instance;
        let controlMap = this.controlMaps.get(frame);
        if (!controlMap) {
            const tStart = performance.now();
            controlMap = new ControlMap(this, frame, -1, preferenceStore.contourControlMapWidth, preferenceStore.contourControlMapWidth);
            this.controlMaps.set(frame, controlMap);
            const tEnd = performance.now();
            const dt = tEnd - tStart;
            console.log(`Created ${preferenceStore.contourControlMapWidth}x${preferenceStore.contourControlMapWidth} transform grid for ${this.frameInfo.fileId} -> ${frame.frameInfo.fileId} in ${dt} ms`);
        }

        return controlMap;
    }

    public removeControlMap(frame: FrameStore) {
        const gl = ContourWebGLService.Instance.gl;
        const controlMap = this.controlMaps.get(frame);
        if (controlMap && gl && controlMap.hasTextureForContext(gl)) {
            const texture = controlMap.getTextureX(gl);
            gl.deleteTexture(texture);
        }
        this.controlMaps.delete(frame);
    }

    public getCatalogControlMap(frame: FrameStore) {
        const preferenceStore = PreferenceStore.Instance;
        let controlMap = this.catalogControlMaps.get(frame);
        if (!controlMap) {
            const tStart = performance.now();
            controlMap = new CatalogControlMap(this, frame, -1, preferenceStore.contourControlMapWidth, preferenceStore.contourControlMapWidth);
            this.catalogControlMaps.set(frame, controlMap);
            const tEnd = performance.now();
            const dt = tEnd - tStart;
            console.log(`Created ${preferenceStore.contourControlMapWidth}x${preferenceStore.contourControlMapWidth} transform grid for ${this.frameInfo.fileId} -> ${frame.frameInfo.fileId} in ${dt} ms`);
        }

        return controlMap;
    }

    public removeCatalogControlMap(frame: FrameStore) {
        const gl2 = CatalogWebGLService.Instance.gl;
        const controlMap = this.catalogControlMaps.get(frame);
        if (controlMap && gl2 && controlMap.hasTextureForContext(gl2)) {
            const texture = controlMap.getTextureX(gl2);
            gl2.deleteTexture(texture);
        }
        this.catalogControlMaps.delete(frame);
    }

    public getWcsSizeInArcsec(size: Point2D): Point2D {
        if (size && this.pixelUnitSizeArcsec) {
            return multiply2D(size, this.pixelUnitSizeArcsec);
        }
        return null;
    }

    public getImageXValueFromArcsec(arcsecValue: number): number {
        if (isFinite(arcsecValue) && isFinite(this.pixelUnitSizeArcsec?.x)) {
            return arcsecValue / this.pixelUnitSizeArcsec.x;
        }
        return null;
    }

    public getImageYValueFromArcsec(arcsecValue: number): number {
        if (isFinite(arcsecValue) && isFinite(this.pixelUnitSizeArcsec?.y)) {
            return arcsecValue / this.pixelUnitSizeArcsec.y;
        }
        return null;
    }

    public findChannelIndexByValue = (x: number): number => {
        if (x === null || x === undefined || !isFinite(x)) {
            return undefined;
        }

        if (this.channelInfo) {
            if (this.isCoordChannel) {
                return this.channelInfo.getChannelIndexSimple(x);
            } else {
                if ((this.spectralAxis && !this.spectralAxis.valid) || this.isSpectralPropsEqual) {
                    return this.channelInfo.getChannelIndexWCS(x);
                } else {
                    // invert x in selected widget wcs to frame's default wcs
                    const tx = AST.transformSpectralPoint(this.spectralFrame, this.spectralType, this.spectralUnit, this.spectralSystem, x, false);
                    return this.channelInfo.getChannelIndexWCS(tx);
                }
            }
        }
        return undefined;
    };

    public getRegionProperties(regionId: number): string[] {
        let propertyString = [];
        const region = this.getRegion(regionId);
        if (region) {
            propertyString.push(region.regionProperties);
            if (this.validWcs) {
                propertyString.push(this.getRegionWcsProperties(region));
            }
        }
        return propertyString;
    }

    public getRegionWcsProperties = (region: RegionStore): string => {
        return this.genRegionWcsProperties(region.regionType, region.controlPoints, region.rotation, region.regionId);
    };

    public genRegionWcsProperties = (regionType: CARTA.RegionType, controlPoints: Point2D[], rotation: number, regionId: number = -1): string => {
        const centerPoint = controlPoints[CENTER_POINT_INDEX];
        if (!this.validWcs || !isFinite(centerPoint.x) || !isFinite(centerPoint.y)) {
            return "Invalid";
        }

        const wcsCenter = getFormattedWCSPoint(this.wcsInfoForTransformation, centerPoint);
        if (!wcsCenter) {
            return "Invalid";
        }

        const center = regionId === RegionId.CURSOR ? `${this.cursorInfo?.infoWCS?.x}, ${this.cursorInfo?.infoWCS?.y}` : `${wcsCenter.x}, ${wcsCenter.y}`;
        const systemType = OverlayStore.Instance.global.explicitSystem;

        switch (regionType) {
            case CARTA.RegionType.POINT:
                return `Point (wcs:${systemType}) [${center}]`;
            case CARTA.RegionType.LINE:
                const wcsStartPoint = getFormattedWCSPoint(this.wcsInfoForTransformation, controlPoints[0]);
                const wcsEndPoint = getFormattedWCSPoint(this.wcsInfoForTransformation, controlPoints[1]);
                return `Line (wcs:${systemType}) [[${wcsStartPoint.x}, ${wcsStartPoint.y}], [${wcsEndPoint.x}, ${wcsEndPoint.y}]]`;
            case CARTA.RegionType.RECTANGLE:
                const recSizePoint = controlPoints[SIZE_POINT_INDEX];
                const recWcsSize = this.getWcsSizeInArcsec(recSizePoint);
                const recSize = {x: formattedArcsec(recWcsSize?.x, WCS_PRECISION), y: formattedArcsec(recWcsSize?.y, WCS_PRECISION)};
                return `rotbox(wcs:${systemType})[[${center}], [${recSize.x ?? ""}, ${recSize.y ?? ""}], ${toFixed(rotation, 6)}deg]`;
            case CARTA.RegionType.ELLIPSE:
                const ellipseSizePoint = controlPoints[SIZE_POINT_INDEX];
                const ellipseWcsSize = this.getWcsSizeInArcsec(ellipseSizePoint);
                const ellipseSize = {x: formattedArcsec(ellipseWcsSize?.x, WCS_PRECISION), y: formattedArcsec(ellipseWcsSize?.y, WCS_PRECISION)};
                return `ellipse(wcs:${systemType})[[${center}], [${ellipseSize.x ?? ""}, ${ellipseSize.y ?? ""}], ${toFixed(rotation, 6)}deg]`;
            case CARTA.RegionType.POLYGON:
                let polygonWcsProperties = `poly(wcs:${systemType})[`;
                controlPoints.forEach((point, index) => {
                    const wcsPoint = isFinite(point.x) && isFinite(point.y) ? getFormattedWCSPoint(this.wcsInfoForTransformation, point) : null;
                    polygonWcsProperties += wcsPoint ? `[${wcsPoint.x}, ${wcsPoint.y}]` : "[Invalid]";
                    polygonWcsProperties += index !== controlPoints.length - 1 ? ", " : "]";
                });
                return polygonWcsProperties;
            case CARTA.RegionType.POLYLINE:
                let polylineWcsProperties = `Polyline (wcs:${systemType})[`;
                controlPoints.forEach((point, index) => {
                    const wcsPoint = isFinite(point.x) && isFinite(point.y) ? getFormattedWCSPoint(this.wcsInfoForTransformation, point) : null;
                    polylineWcsProperties += wcsPoint ? `[${wcsPoint.x}, ${wcsPoint.y}]` : "[Invalid]";
                    polylineWcsProperties += index !== controlPoints.length - 1 ? ", " : "]";
                });
                return polylineWcsProperties;
            default:
                return "Not Implemented";
        }
    };

    @action
    private setChannelValues(values: number[]) {
        this.channelValues = values;
    }

    @action private initSupportedSpectralConversion = () => {
        if (this.channelInfo && this.spectralAxis && !this.spectralAxis.valid) {
            this.setChannelValues(this.channelInfo.values);
            this.spectralCoordsSupported = new Map<string, {type: SpectralType; unit: SpectralUnit}>([
                [this.nativeSpectralCoordinate, {type: null, unit: null}],
                [SPECTRAL_TYPE_STRING.get(SpectralType.CHANNEL), {type: SpectralType.CHANNEL, unit: null}]
            ]);
            this.spectralSystemsSupported = [];
            return;
        } else if (!this.spectralAxis || !this.spectralFrame) {
            this.spectralCoordsSupported = null;
            this.spectralSystemsSupported = null;
            return;
        }

        // generate spectral coordinate options
        const entries = this.frameInfo.fileInfoExtended.headerEntries;
        const spectralType = this.spectralAxis.type.code;
        if (IsSpectralTypeSupported(spectralType)) {
            // check RESTFRQ
            if (isFinite(this.headerRestFreq)) {
                this.spectralCoordsSupported = SPECTRAL_COORDS_SUPPORTED;
            } else {
                this.spectralCoordsSupported = new Map<string, {type: SpectralType; unit: SpectralUnit}>();
                Array.from(SPECTRAL_COORDS_SUPPORTED.keys()).forEach((key: string) => {
                    const value = SPECTRAL_COORDS_SUPPORTED.get(key);
                    const isVolecity = spectralType === SpectralType.VRAD || spectralType === SpectralType.VOPT;
                    const isValueVolecity = value.type === SpectralType.VRAD || value.type === SpectralType.VOPT;
                    if (isVolecity && isValueVolecity) {
                        // VRAD, VOPT
                        this.spectralCoordsSupported.set(key, value);
                    }
                    if (!isVolecity && !isValueVolecity) {
                        // FREQ, WAVE, AWAV
                        this.spectralCoordsSupported.set(key, value);
                    }
                });
                this.spectralCoordsSupported.set(SPECTRAL_TYPE_STRING.get(SpectralType.CHANNEL), {type: SpectralType.CHANNEL, unit: null});
            }
        } else {
            this.spectralCoordsSupported = new Map<string, {type: SpectralType; unit: SpectralUnit}>([[SPECTRAL_TYPE_STRING.get(SpectralType.CHANNEL), {type: SpectralType.CHANNEL, unit: null}]]);
        }

        // generate spectral system options
        const spectralSystem = this.spectralAxis.specsys;
        if (IsSpectralSystemSupported(spectralSystem)) {
            const dateObsHeader = entries.find(entry => entry.name.indexOf("DATE-OBS") !== -1);
            const obsgeoxHeader = entries.find(entry => entry.name.indexOf("OBSGEO-X") !== -1);
            const obsgeoyHeader = entries.find(entry => entry.name.indexOf("OBSGEO-Y") !== -1);
            const obsgeozHeader = entries.find(entry => entry.name.indexOf("OBSGEO-Z") !== -1);
            if (spectralSystem === SpectralSystem.LSRK || spectralSystem === SpectralSystem.LSRD) {
                // LSRK, LSRD
                if (dateObsHeader && obsgeoxHeader && obsgeoyHeader && obsgeozHeader) {
                    this.spectralSystemsSupported = [SpectralSystem.LSRK, SpectralSystem.LSRD, SpectralSystem.BARY, SpectralSystem.TOPO];
                } else if (dateObsHeader && !(obsgeoxHeader && obsgeoyHeader && obsgeozHeader)) {
                    this.spectralSystemsSupported = [SpectralSystem.LSRK, SpectralSystem.LSRD, SpectralSystem.BARY];
                } else {
                    this.spectralSystemsSupported = [SpectralSystem.LSRK, SpectralSystem.LSRD];
                }
            } else if (spectralSystem === SpectralSystem.BARY) {
                // BARY
                if (dateObsHeader && obsgeoxHeader && obsgeoyHeader && obsgeozHeader) {
                    this.spectralSystemsSupported = [SpectralSystem.LSRK, SpectralSystem.LSRD, SpectralSystem.BARY, SpectralSystem.TOPO];
                } else if (dateObsHeader && !(obsgeoxHeader && obsgeoyHeader && obsgeozHeader)) {
                    this.spectralSystemsSupported = [SpectralSystem.LSRK, SpectralSystem.LSRD, SpectralSystem.BARY];
                } else {
                    this.spectralSystemsSupported = [SpectralSystem.BARY];
                }
            } else {
                // TOPO
                if (dateObsHeader && obsgeoxHeader && obsgeoyHeader && obsgeozHeader) {
                    this.spectralSystemsSupported = [SpectralSystem.LSRK, SpectralSystem.LSRD, SpectralSystem.BARY, SpectralSystem.TOPO];
                } else {
                    this.spectralSystemsSupported = [SpectralSystem.TOPO];
                }
            }
        } else {
            this.spectralSystemsSupported = [];
        }
    };

    @action private initCenter = () => {
        this.center.x = (this.frameInfo.fileInfoExtended.width - 1) / 2.0;
        this.center.y = (this.frameInfo.fileInfoExtended.height - 1) / 2.0;
    };

    @action setSpectralCoordinateToRadioVelocity = () => {
        const coordStr = GenCoordinateLabel(SpectralType.VRAD, SPECTRAL_DEFAULT_UNIT.get(SpectralType.VRAD));
        if (this.spectralCoordsSupported?.has(coordStr)) {
            this.setSpectralCoordinate(coordStr);
        }
    };

    @action setSpectralCoordinate = (coordStr: string, alignSpectralSiblings: boolean = true): boolean => {
        if (this.spectralCoordsSupported?.has(coordStr)) {
            const coord: {type: SpectralType; unit: SpectralUnit} = this.spectralCoordsSupported.get(coordStr);
            this.spectralType = coord.type;
            this.spectralUnit = coord.unit;

            if (alignSpectralSiblings) {
                (!this.spectralReference ? this.secondarySpectralImages : this.spectralSiblings)?.forEach(spectrallyMatchedFrame => spectrallyMatchedFrame.setSpectralCoordinate(coordStr, false));
            }
            return true;
        }
        return false;
    };

    @action setSpectralSystem = (spectralSystem: SpectralSystem, alignSpectralSiblings: boolean = true): boolean => {
        if (this.spectralSystemsSupported?.includes(spectralSystem)) {
            this.spectralSystem = spectralSystem;

            if (alignSpectralSiblings) {
                (!this.spectralReference ? this.secondarySpectralImages : this.spectralSiblings)?.forEach(spectrallyMatchedFrame => spectrallyMatchedFrame.setSpectralSystem(spectralSystem, false));
            }
            return true;
        }
        return false;
    };

    @action updateFromContourData(contourImageData: CARTA.ContourImageData) {
        const processedData = ProtobufProcessing.ProcessContourData(contourImageData);
        this.stokes = processedData.stokes;
        this.channel = processedData.channel;

        const animatorStore = AnimatorStore.Instance;
        if (animatorStore.serverAnimationActive) {
            this.requiredChannel = processedData.channel;
            this.requiredStokes = processedData.stokes;
        }

        for (const contourSet of processedData.contourSets) {
            let contourStore = this.contourStores.get(contourSet.level);
            if (!contourStore) {
                contourStore = new ContourStore();
                this.contourStores.set(contourSet.level, contourStore);
            }

            if (!contourStore.isComplete && processedData.progress > 0) {
                contourStore.addContourData(contourSet.indexOffsets, contourSet.coordinates, processedData.progress);
            } else {
                contourStore.setContourData(contourSet.indexOffsets, contourSet.coordinates, processedData.progress);
            }
        }

        // Clear up stale contour levels by checking against the config, and update total contour progress
        this.contourStores.forEach((contourStore, level) => {
            if (this.contourConfig.levels.indexOf(level) === -1) {
                this.contourStores.delete(level);
            }
        });
    }

    @action updateFromVectorOverlayData(vectorOverlayData: CARTA.IVectorOverlayTileData) {
        if (!this.vectorOverlayStore.isComplete && vectorOverlayData.progress > 0) {
            this.vectorOverlayStore.addData(vectorOverlayData.intensityTiles, vectorOverlayData.angleTiles, vectorOverlayData.progress);
        } else {
            this.vectorOverlayStore.setData(vectorOverlayData.intensityTiles, vectorOverlayData.angleTiles, vectorOverlayData.progress);
        }
    }

    @action setChannels(channel: number, stokes: number, recursive: boolean) {
        if (stokes < 0) {
            stokes += this.frameInfo.fileInfoExtended.stokes;
        }
        if (stokes >= this.frameInfo.fileInfoExtended.stokes && !COMPUTED_POLARIZATIONS.get(stokes)) {
            stokes = 0;
        }

        const sanitizedChannel = this.sanitizeChannelNumber(channel);
        // Automatically switch to per-channel histograms when Stokes parameter changes
        if (this.requiredStokes !== stokes) {
            this.renderConfig.setUseCubeHistogram(false);
            this.renderConfig.setUseCubeHistogramContours(false);
            this.renderConfig.updateCubeHistogram(null, 0);
        }

        this.requiredChannel = sanitizedChannel;
        this.requiredStokes = stokes;

        if (recursive) {
            this.spectralSiblings.forEach(frame => {
                const siblingChannel = getTransformedChannel(this.wcsInfo3D, frame.wcsInfo3D, PreferenceStore.Instance.spectralMatchingType, sanitizedChannel);
                frame.setChannels(siblingChannel, frame.requiredStokes, false);
            });
        }

        // Update the wcsInfo for swapped-axes cube image, since its rendering coordinate may dependent on channels
        if (this.isSwappedImage) {
            this.updateSwappedFrameSet();
        }
    }

    @action incrementChannels(deltaChannel: number, deltaStokes: number, wrap: boolean = true) {
        const depth = Math.max(1, this.frameInfo.fileInfoExtended.depth);
        const numStokes = Math.max(1, this.polarizations?.length);

        let newChannel = this.requiredChannel + deltaChannel;
        let newStokes = this.requiredPolarizationIndex + deltaStokes;
        if (wrap) {
            newChannel = (newChannel + depth) % depth;
            newStokes = (newStokes + numStokes) % numStokes;
        } else {
            newChannel = clamp(newChannel, 0, depth - 1);
            newStokes = clamp(newStokes, 0, numStokes - 1);
        }
        const isComputedPolarization = newStokes >= this.frameInfo.fileInfoExtended.stokes;
        // request standard polarization by the stokes index of image. (eg. "I": 0)
        // request computed polarization by PolarizationDefinition. (eg. "Pangle": 17)
        this.setChannels(newChannel, isComputedPolarization ? this.polarizations[newStokes] : newStokes, true);
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

    @action setCenter(x: number, y: number, enableSpatialTransform: boolean = true) {
        if (this.spatialReference) {
            let centerPointRefImage = {x, y};
            if (enableSpatialTransform) {
                centerPointRefImage = this.spatialTransform.transformCoordinate({x, y}, true);
            }
            this.spatialReference.setCenter(centerPointRefImage.x, centerPointRefImage.y);
        } else {
            this.center = {x, y};
        }
    }

    @action setCursorPosition(posImageSpace: Point2D) {
        if (this.spatialReference) {
            this.spatialReference.setCursorPosition(transformPoint(this.spatialTransformAST, posImageSpace, true));
        } else {
            this.cursorInfo = this.getCursorInfo(posImageSpace);
            for (const frame of this.secondarySpatialImages) {
                const posSecondaryImage = transformPoint(frame.spatialTransformAST, posImageSpace, false);
                frame.cursorInfo = frame.getCursorInfo(posSecondaryImage);
            }
        }
        this.cursorMoving = true;
        clearTimeout(this.cursorMovementHandle);
        this.cursorMovementHandle = setTimeout(this.endCursorMove, FrameStore.CursorMovementDuration);
    }

    @action private endCursorMove = () => {
        this.cursorMoving = false;
    };

    @action setCursorValue(position: Point2D, channel: number, value: number) {
        this.cursorValue = {position, channel, value};
    }

    @action updateCursorRegion = (pos: Point2D) => {
        const isHoverImage = pos.x + 0.5 >= 0 && pos.x + 0.5 <= this.frameInfo.fileInfoExtended.width && pos.y + 0.5 >= 0 && pos.y + 0.5 <= this.frameInfo.fileInfoExtended.height;
        if (this.spatialReference) {
            const pointRefImage = transformPoint(this.spatialTransformAST, pos, true);
            this.spatialReference.updateCursorRegion(pointRefImage);
        } else if (isHoverImage) {
            this.frameRegionSet.updateCursorRegionPosition(pos);
        }

        for (const frame of this.secondarySpatialImages) {
            const pointSecondaryImage = transformPoint(frame.spatialTransformAST, pos, false);
            const isHoverSecondaryImage =
                pointSecondaryImage.x + 0.5 >= 0 && pointSecondaryImage.x + 0.5 <= frame.frameInfo.fileInfoExtended.width && pointSecondaryImage.y + 0.5 >= 0 && pointSecondaryImage.y + 0.5 <= frame.frameInfo.fileInfoExtended.height;
            if (isHoverSecondaryImage) {
                frame.frameRegionSet.updateCursorRegionPosition(pointSecondaryImage);
            }
        }
    };

    // Sets a new zoom level and pans to keep the given point fixed
    @action zoomToPoint(x: number, y: number, zoom: number, absolute: boolean = false) {
        if (this.spatialReference) {
            // Adjust zoom by scaling factor if zoom level is not absolute
            const adjustedZoom = absolute ? zoom : zoom / this.spatialTransform.scale;
            const pointRefImage = transformPoint(this.spatialTransformAST, {x, y}, true);
            this.spatialReference.zoomToPoint(pointRefImage.x, pointRefImage.y, adjustedZoom);
        } else {
            if (PreferenceStore.Instance.zoomPoint === ZoomPoint.CURSOR) {
                this.center = {
                    x: x + (this.zoomLevel / zoom) * (this.center.x - x),
                    y: y + (this.zoomLevel / zoom) * (this.center.y - y)
                };
            }
            this.setZoom(zoom);
        }
    }

    @action fitZoom = (): number => {
        if (this.spatialReference) {
            // Calculate midpoint of image
            this.initCenter();
            const imageCenterReferenceSpace = transformPoint(this.spatialTransformAST, this.center, true);
            this.spatialReference.setCenter(imageCenterReferenceSpace.x, imageCenterReferenceSpace.y);
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
            const pixelRatio = this.renderHiDPI ? devicePixelRatio * AppStore.Instance.imageRatio : 1.0;
            const zoomX = (this.spatialReference.renderWidth * pixelRatio) / rangeX;
            const zoomY = (this.spatialReference.renderHeight * pixelRatio) / rangeY;
            const zoom = Math.min(zoomX, zoomY);
            this.spatialReference.setZoom(zoom, true);
            return zoom;
        } else {
            this.zoomLevel = this.zoomLevelForFit;
            this.initCenter();
            return this.zoomLevel;
        }
    };

    @action setAnimationRange = (range: NumberRange) => {
        this.animationChannelRange = range;
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

        const preferenceStore = PreferenceStore.Instance;
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
                yMax: this.frameInfo.fileInfoExtended.height
            },
            decimationFactor: preferenceStore.contourDecimation,
            compressionLevel: preferenceStore.contourCompressionLevel,
            contourChunkSize: preferenceStore.contourChunkSize
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
                referenceFileId: this.frameInfo.fileId
            };
            this.backendService.setContourParameters(contourParameters);
        }
        this.contourConfig.setEnabled(false);
    };

    @action applyVectorOverlay = () => {
        const config = this.vectorOverlayConfig;
        if (!config || !this.renderConfig) {
            return;
        }

        const preferenceStore = PreferenceStore.Instance;
        config.setEnabled(true);

        const parameters: CARTA.ISetVectorOverlayParameters = {
            fileId: this.frameInfo.fileId,
            imageBounds: {
                xMin: 0,
                xMax: this.frameInfo.fileInfoExtended.width,
                yMin: 0,
                yMax: this.frameInfo.fileInfoExtended.height
            },
            smoothingFactor: config.pixelAveragingEnabled ? config.pixelAveraging : 1,
            fractional: config.fractionalIntensity,
            threshold: config.thresholdEnabled ? config.threshold : NaN,
            debiasing: config.debiasing,
            qError: config.qError,
            uError: config.uError,
            stokesIntensity: config.intensitySource,
            stokesAngle: config.angularSource,
            compressionType: CARTA.CompressionType.NONE,
            compressionQuality: preferenceStore.contourCompressionLevel
        };
        this.backendService.setVectorOverlayParameters(parameters);
    };

    @action clearVectorOverlay = (updateBackend: boolean = true) => {
        // Clear up GPU resources
        this.vectorOverlayStore.clearData();

        if (updateBackend) {
            // Send clearing vector overlay parameter message to the backend, to prevent overlay from being automatically updated
            const parameters: CARTA.ISetVectorOverlayParameters = {
                fileId: this.frameInfo.fileId,
                stokesAngle: -1,
                stokesIntensity: -1
            };
            this.backendService.setVectorOverlayParameters(parameters);
        }
        this.vectorOverlayConfig.setEnabled(false);
    };

    // Spatial WCS Matching
    @action setSpatialReference = (frame: FrameStore) => {
        if (frame === this) {
            console.log(`Skipping spatial self-reference`);
            this.clearSpatialReference();
            return false;
        }

        if (!frame.hasSquarePixels || !this.hasSquarePixels) {
            console.log("Cannot perform spatial transform between images with non-square pixels");
            this.spatialReference = null;
            return false;
        }

        if (this.validWcs !== frame.validWcs) {
            console.log(`Error creating spatial transform between files ${this.frameInfo.fileId} and ${frame.frameInfo.fileId}`);
            this.spatialReference = null;
            return false;
        }
        this.spatialReference = frame;
        console.log(`Setting spatial reference for file ${this.frameInfo.fileId} to ${frame.frameInfo.fileId}`);

        const copySrc = AST.copy(this.wcsInfo);
        const copyDest = AST.copy(frame.wcsInfo);
        AST.invert(copySrc);
        AST.invert(copyDest);
        this.spatialTransformAST = AST.convert(copySrc, copyDest, "");
        AST.deleteObject(copySrc);
        AST.deleteObject(copyDest);
        if (!this.spatialTransformAST) {
            console.log(`Error creating spatial transform between files ${this.frameInfo.fileId} and ${frame.frameInfo.fileId}`);
            this.spatialReference = null;
            return false;
        }
        const currentTransform = this.spatialTransform;
        if (
            !currentTransform ||
            !isFinite(currentTransform.rotation) ||
            !isFinite(currentTransform.scale) ||
            !isFinite(currentTransform.translation.x) ||
            !isFinite(currentTransform.translation.y) ||
            !isFinite(currentTransform.origin.x) ||
            !isFinite(currentTransform.origin.y) ||
            !this.transformedWcsInfo
        ) {
            console.log(`Error creating spatial transform between files ${this.frameInfo.fileId} and ${frame.frameInfo.fileId}`);
            this.spatialReference = null;
            AST.deleteObject(this.spatialTransformAST);
            this.spatialTransformAST = null;
            return false;
        }

        this.spatialReference.addSecondarySpatialImage(this);
        // Update cursor position
        const spatialRefCursorPos = this.spatialReference.cursorInfo?.posImageSpace;
        if (spatialRefCursorPos) {
            const cursorPosImage = transformPoint(this.spatialTransformAST, spatialRefCursorPos, false);
            this.cursorInfo = this.getCursorInfo(cursorPosImage);
        }

        this.spatialReference.frameRegionSet.migrateRegionsFromExistingSet(this.frameRegionSet, this.spatialTransformAST, true);
        // Remove old regions after migration
        for (const region of this.frameRegionSet.regions) {
            this.frameRegionSet.deleteRegion(region);
        }

        AppStore.Instance.widgetsStore.removeRegionsFromRegionWidgetsByFrame(this.frameInfo.fileId);
        return true;
    };

    @action clearSpatialReference = () => {
        // Adjust center and zoom based on existing spatial reference
        if (this.spatialReference) {
            this.frameRegionSet.migrateRegionsFromExistingSet(this.spatialReference.frameRegionSet, this.spatialTransformAST);
            this.center = this.spatialTransform.transformCoordinate(this.spatialReference.center, false);
            this.zoomLevel = this.spatialReference.zoomLevel;
            this.spatialReference.removeSecondarySpatialImage(this);
            this.spatialReference = null;
        }

        if (this.spatialTransformAST) {
            AST.deleteObject(this.spatialTransformAST);
        }
        this.spatialTransformAST = null;
        const gl = ContourWebGLService.Instance.gl;
        if (gl) {
            this.controlMaps.forEach(controlMap => {
                if (controlMap.hasTextureForContext(gl)) {
                    const texture = controlMap.getTextureX(gl);
                    gl.deleteTexture(texture);
                }
            });
        }
        this.controlMaps.forEach((controlMap, frame) => {
            this.removeControlMap(frame);
        });
        this.controlMaps.clear();
        // clear catalog control map
        const gl2 = CatalogWebGLService.Instance.gl;
        if (gl2) {
            this.catalogControlMaps.forEach(controlMap => {
                if (controlMap.hasTextureForContext(gl)) {
                    const texture = controlMap.getTextureX(gl2);
                    gl2.deleteTexture(texture);
                }
            });
        }
        this.catalogControlMaps.forEach((controlMap, frame) => {
            this.removeCatalogControlMap(frame);
        });
        this.catalogControlMaps.clear();

        AppStore.Instance.widgetsStore.removeRegionsFromRegionWidgetsByFrame(this.frameInfo.fileId);
    };

    @action addSecondarySpatialImage = (frame: FrameStore) => {
        if (!this.secondarySpatialImages.find(f => f.frameInfo.fileId === frame.frameInfo.fileId)) {
            this.secondarySpatialImages.push(frame);
        }
    };

    @action removeSecondarySpatialImage = (frame: FrameStore) => {
        this.secondarySpatialImages = this.secondarySpatialImages.filter(f => f.frameInfo.fileId !== frame.frameInfo.fileId);
    };

    // Spectral WCS matching
    @action setSpectralReference = (frame: FrameStore) => {
        if (frame === this) {
            this.clearSpatialReference();
            console.log(`Skipping spectral self-reference`);
            return false;
        }
        console.log(`Setting spectral reference for file ${this.frameInfo.fileId} to ${frame.frameInfo.fileId}`);

        if (!this.wcsInfo3D || !frame.wcsInfo3D) {
            console.log(`Error creating spectral transform between files ${this.frameInfo.fileId} and ${frame.frameInfo.fileId}. One of the files is missing spectral information`);
            this.spectralReference = null;
            return false;
        }

        // For now, this is just done to ensure a mapping can be constructed
        const copySrc = AST.copy(this.wcsInfo3D);
        const copyDest = AST.copy(frame.wcsInfo3D);
        const preferenceStore = PreferenceStore.Instance;
        const spectralMatchingType = preferenceStore.spectralMatchingType;
        // Ensure that a mapping for the current alignment system is possible
        if (spectralMatchingType !== SpectralType.CHANNEL) {
            AST.set(copySrc, `AlignSystem=${preferenceStore.spectralMatchingType}`);
            AST.set(copyDest, `AlignSystem=${preferenceStore.spectralMatchingType}`);
        }
        AST.invert(copySrc);
        AST.invert(copyDest);
        this.spectralTransformAST = AST.convert(copySrc, copyDest, "");
        AST.deleteObject(copySrc);
        AST.deleteObject(copyDest);

        if (!this.spectralTransformAST) {
            console.log(`Error creating spatial transform between files ${this.frameInfo.fileId} and ${frame.frameInfo.fileId}. Could not create AST transform`);
            this.spectralReference = null;
            return false;
        }

        this.spectralReference = frame;
        this.spectralReference.addSecondarySpectralImage(this);
        const matchedChannel = getTransformedChannel(frame.wcsInfo3D, this.wcsInfo3D, preferenceStore.spectralMatchingType, frame.requiredChannel);
        this.setChannels(matchedChannel, this.requiredStokes, false);

        // Align spectral settings to spectral reference
        this.setSpectralCoordinate(frame.spectralCoordinate, false);

        return true;
    };

    @action clearSpectralReference = () => {
        if (this.spectralReference) {
            this.spectralReference.removeSecondarySpectralImage(this);
            this.spectralReference = null;
        }

        if (this.spectralTransformAST) {
            AST.deleteObject(this.spectralTransformAST);
        }
        this.spectralTransformAST = null;
    };

    @action addSecondarySpectralImage = (frame: FrameStore) => {
        if (!this.secondarySpectralImages.find(f => f.frameInfo.fileId === frame.frameInfo.fileId)) {
            this.secondarySpectralImages.push(frame);
        }
    };

    @action removeSecondarySpectralImage = (frame: FrameStore) => {
        this.secondarySpectralImages = this.secondarySpectralImages.filter(f => f.frameInfo.fileId !== frame.frameInfo.fileId);
    };

    @action setRasterScalingReference = (frame: FrameStore) => {
        if (frame === this) {
            this.clearRasterScalingReference();
            console.log(`Skipping RenderConfig self-reference`);
            return;
        }

        this.rasterScalingReference = frame;
        this.rasterScalingReference.addSecondaryRasterScalingImage(this);
        this.renderConfig.updateFrom(frame.renderConfig);
    };

    @action clearRasterScalingReference() {
        if (this.rasterScalingReference) {
            this.rasterScalingReference.removeSecondaryRasterScalingImage(this);
            this.rasterScalingReference = null;
        }
    }

    @action addSecondaryRasterScalingImage = (frame: FrameStore) => {
        if (!this.secondaryRasterScalingImages.find(f => f.frameInfo.fileId === frame.frameInfo.fileId)) {
            this.secondaryRasterScalingImages.push(frame);
        }
    };

    @action removeSecondaryRasterScalingImage = (frame: FrameStore) => {
        this.secondaryRasterScalingImages = this.secondaryRasterScalingImages.filter(f => f.frameInfo.fileId !== frame.frameInfo.fileId);
    };

    @action addMomentImage = (frame: FrameStore) => {
        if (frame && !this.momentImages.find(f => f.frameInfo.fileId === frame.frameInfo.fileId)) {
            this.momentImages.push(frame);
        }
    };

    @action removeMomentImage = () => {
        this.momentImages = [];
    };

    @action setIsRequestingMoments = (val: boolean) => {
        this.isRequestingMoments = val;
    };

    @action updateRequestingMomentsProgress = (progress: number) => {
        this.requestingMomentsProgress = progress;
    };

    @action resetMomentRequestState = () => {
        this.setIsRequestingMoments(false);
        this.updateRequestingMomentsProgress(0);
    };

    @action setStokesFiles = (stokesFiles: CARTA.StokesFile[]) => {
        this.stokesFiles = stokesFiles;
    };

    @action addPvImage = (frame: FrameStore) => {
        if (frame && (!this.pvImage || this.pvImage.frameInfo.fileId !== frame.frameInfo.fileId)) {
            this.pvImage = frame;
        }
    };

    @action removePvImage = () => {
        this.pvImage = null;
    };

    @action setIsRequestingPV = (val: boolean) => {
        this.isRequestingPV = val;
    };

    @action updateRequestingPvProgress = (progress: number) => {
        this.requestingPVProgress = progress;
    };

    @action resetPvRequestState = () => {
        this.setIsRequestingPV(false);
        this.updateRequestingPvProgress(0);
    };

    @action setGeneratedPVRegionId = (regionId: number) => {
        this.generatedPVRegionId = regionId;
    };

    @action setIsRequestPVCancelling = (val: boolean) => {
        this.isRequestPVCancelling = val;
    };

    @action setFittingResult = (results: string) => {
        this.fittingResult = results;
    };

    @action setFittingLog = (log: string) => {
        this.fittingLog = log;
    };
}
