import {Colors} from "@blueprintjs/core";
import * as CARTACompute from "carta_computation";
import {action, computed, type IReactionDisposer, makeObservable, observable, reaction} from "mobx";

import {
    AngularSizeUnit,
    CatalogDisplayMode,
    CatalogMapType,
    CatalogOverlay,
    CatalogOverlayShape,
    CatalogPlotType,
    CatalogSettingsTabs,
    CatalogSizeUnits,
    type CatalogSourceRadiusMode,
    type CatalogSystemType,
    CatalogTextureType,
    CatalogUpdateMode,
    ColorMap,
    FrameScaling
} from "enums";
import {FACTOR_TO_ARCSEC, type WorkspaceCatalogAxisConfig, type WorkspaceCatalogColorAxisConfig, type WorkspaceCatalogConfig, type WorkspaceCatalogOrientationAxisConfig, type WorkspaceCatalogSizeAxisConfig} from "models";
import {CatalogWebGLService} from "services";
import {AppStore, type CatalogOnlineQueryProfileStore, type CatalogProfileStore, CatalogStore, PreferenceStore} from "stores";
import {
    CatalogAxisEligibility,
    type CatalogAxisEligibilityResult,
    clamp,
    COORDINATE_SNIFF_SCAN_LIMIT,
    createScalingParameters,
    getAutoSelectedCatalogAxisColumn,
    getScalingParameter,
    isCatalogNumericDataType,
    isSupportedFrameScaling,
    minMaxArray,
    rankCatalogAxisColumns,
    sanitizeScalingParameter,
    scalingParametersFromConfig,
    scalingParametersToConfig,
    type TypedArray
} from "utilities";

/** A bound to put in place, and whether it was chosen rather than taken from the data. */
interface ClipValue {
    value: number | undefined;
    isExplicit: boolean;
}

/** The clipped bounds of one mapped column, held while the data-derived defaults are recomputed. */
interface ClipRestore {
    min: ClipValue;
    max: ClipValue;
}

type ClipGroup = "sizeMajor" | "sizeMinor" | "color" | "orientation";

/**
 * One end of a mapped column's range: the bound derived from the data, and the one in force.
 *
 * `isExplicit` records whether the bound in force was chosen rather than taken from the data. A
 * chosen bound is kept when the data changes; one taken from the data follows it. The two cannot be
 * told apart by value, because a chosen bound may happen to equal the one the data implies.
 */
type ClipBound = {default: number | undefined; clipd: number | undefined; isExplicit: boolean};

interface ColumnRangeCache {
    profileStore: CatalogProfileStore | CatalogOnlineQueryProfileStore;
    data: TypedArray | undefined;
    rowsScanned: number;
    min: number;
    max: number;
    hasValue: boolean;
    dataState: string;
}

const CATALOG_OVERLAY_SHAPE_VALUES: readonly CatalogOverlayShape[] = [
    CatalogOverlayShape.BOX_LINED,
    CatalogOverlayShape.CIRCLE_FILLED,
    CatalogOverlayShape.CIRCLE_LINED,
    CatalogOverlayShape.HEXAGON_LINED,
    CatalogOverlayShape.RHOMB_LINED,
    CatalogOverlayShape.TRIANGLE_LINED_UP,
    CatalogOverlayShape.ELLIPSE_LINED,
    CatalogOverlayShape.TRIANGLE_LINED_DOWN,
    CatalogOverlayShape.HEXAGON_LINED_2,
    CatalogOverlayShape.CROSS_FILLED,
    CatalogOverlayShape.X_FILLED,
    CatalogOverlayShape.LineSegment_FILLED
];

function enumValueOrDefault<T>(value: unknown, values: readonly T[], fallback: T): T {
    return values.includes(value as T) ? (value as T) : fallback;
}

function finiteNumberOrDefault(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalFiniteNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Outcome of applying a display config. A rejected config leaves the store untouched. */
export interface CatalogConfigApplyResult {
    success: boolean;
    /** Why the config was rejected. Empty when it applied. */
    errors: string[];
}

/** The mapped column, clipped range and scaling every axis config holds, with defaults filled in. */
function normalizeAxis(axis: WorkspaceCatalogAxisConfig | undefined) {
    return {
        mapColumn: typeof axis?.mapColumn === "string" ? axis.mapColumn : CatalogOverlay.NONE,
        columnMinClip: optionalFiniteNumber(axis?.columnMinClip),
        columnMaxClip: optionalFiniteNumber(axis?.columnMaxClip),
        scalingType: isSupportedFrameScaling(axis?.scalingType) ? axis.scalingType : FrameScaling.LINEAR,
        scalingParameters: scalingParametersFromConfig(axis?.scalingParameters)
    };
}

type NormalizedAxis = ReturnType<typeof normalizeAxis>;

function normalizeSizeAxis(axis: WorkspaceCatalogSizeAxisConfig | undefined) {
    return {
        ...normalizeAxis(axis),
        min: {area: finiteNumberOrDefault(axis?.min?.area, 100), diameter: finiteNumberOrDefault(axis?.min?.diameter, 5)},
        max: {area: finiteNumberOrDefault(axis?.max?.area, 200), diameter: finiteNumberOrDefault(axis?.max?.diameter, 20)},
        areaMode: axis?.areaMode === true,
        columnMinLocked: axis?.columnMinLocked === true,
        columnMaxLocked: axis?.columnMaxLocked === true
    };
}

function normalizeColorAxis(axis: WorkspaceCatalogColorAxisConfig | undefined) {
    return {
        ...normalizeAxis(axis),
        colorMap: enumValueOrDefault(axis?.colorMap, Object.values(ColorMap), ColorMap.Viridis),
        inverted: axis?.inverted === true
    };
}

function normalizeOrientationAxis(axis: WorkspaceCatalogOrientationAxisConfig | undefined) {
    return {
        ...normalizeAxis(axis),
        angleMin: clamp(finiteNumberOrDefault(axis?.angleMin, CatalogDisplayStore.MIN_ANGLE), CatalogDisplayStore.MIN_ANGLE, CatalogDisplayStore.MAX_ANGLE),
        angleMax: clamp(finiteNumberOrDefault(axis?.angleMax, CatalogDisplayStore.MAX_ANGLE), CatalogDisplayStore.MIN_ANGLE, CatalogDisplayStore.MAX_ANGLE)
    };
}

function normalizeSizeBounds(axis: ReturnType<typeof normalizeSizeAxis>, minDiameter: number, maxDiameter: number) {
    const min = {
        area: clamp(axis.min.area, CatalogDisplayStore.SIZE_MAP_MIN, CatalogDisplayStore.MAX_AREA_SIZE),
        diameter: clamp(axis.min.diameter, minDiameter, maxDiameter)
    };
    return {
        min,
        max: {
            area: clamp(axis.max.area, min.area, CatalogDisplayStore.MAX_AREA_SIZE),
            diameter: clamp(axis.max.diameter, min.diameter, maxDiameter)
        }
    };
}

/**
 * Whether the clipped bounds a config asks for are the config's own. An unmapped column has no
 * bounds, and a config that states bounds authored them, so both survive a recompute. A mapped
 * column with no stated bounds asks for the bounds of the catalog data instead, which the store
 * recomputes for itself, so those must not be held across the recompute.
 */
function configDefinesClip(axis: NormalizedAxis): boolean {
    return axis.mapColumn === CatalogOverlay.NONE || axis.columnMinClip !== undefined || axis.columnMaxClip !== undefined;
}

/**
 * The clipped bound worth keeping in a config. Until the user clips a bound it holds the range of
 * the catalog data, which the store recomputes whenever that data changes, so only a bound that
 * differs from its data-derived default was authored by the user and belongs in a config.
 */
function authoredClip(bound: ClipBound): number | undefined {
    return bound.isExplicit ? bound.clipd : undefined;
}

/**
 * How a config uses a column. The two roles differ in the rule a column must satisfy, in whether
 * its data must already have arrived, and in the verb that names the setting in an error message.
 */
type ColumnRole = "mapped" | "coordinate";

/**
 * Why one column a config names cannot be used, or undefined when it can.
 *
 * A mapped column is read as a plain number, so its declared type settles it. An image overlay
 * coordinate is not so limited -- a string column holding a sexagesimal value is a coordinate too
 * -- so it is judged by {@link AbstractCatalogProfileStore.getCoordinateEligibility}, the same
 * authority the axis menu and the plotting path use. Deciding it here instead would let a workspace
 * reject a column the user was offered and successfully plotted before saving it.
 *
 * `Unknown` passes: it means the column's values have not been fetched yet, not that they were read
 * and found wanting, and a coordinate column need not hold data at restore time anyway.
 */
function getColumnError(profileStore: CatalogProfileStore | CatalogOnlineQueryProfileStore, axis: string, column: string, role: ColumnRole): string | undefined {
    const subject = `The ${axis} axis is ${role === "mapped" ? "mapped to" : "set to"} "${column}", which`;
    const header = profileStore.getColumnHeader(column);
    if (!header) {
        return `${subject} this catalog does not have`;
    }
    if (role === "coordinate") {
        return profileStore.getCoordinateEligibility(column).status === CatalogAxisEligibility.Ineligible ? `${subject} cannot be read as a coordinate` : undefined;
    }
    if (!isCatalogNumericDataType(header.dataType)) {
        return `${subject} is not a numeric column`;
    }
    if (!profileStore.get1DPlotData(column).wcsData?.length) {
        return `${subject} has no data to map`;
    }
    return undefined;
}

function getDefaultRange(column: Float32Array): {minVal: number; maxVal: number} {
    const result = minMaxArray(column);
    return {minVal: isFinite(result.minVal) ? result.minVal : 0, maxVal: isFinite(result.maxVal) ? result.maxVal : 0};
}

export class CatalogDisplayStore {
    public static readonly MIN_OVERLAY_SIZE = 1;
    public static readonly MAX_OVERLAY_SIZE = 50;
    public static readonly MAX_AREA_SIZE = 4000;
    public static readonly MIN_TABLE_SEPARATOR_POSITION = 0;
    public static readonly MAX_TABLE_SEPARATOR_POSITION = 100;
    public static readonly MIN_THICKNESS = 1.0;
    public static readonly MAX_THICKNESS = 10;
    public static readonly MIN_ANGLE = 0;
    public static readonly MAX_ANGLE = 720;
    public static readonly SIZE_MAP_MIN = 0;

    private overlaySize = new Map<string, {min: number; max: number}>([
        [CatalogSizeUnits.SCREENPIXEL, {min: 1, max: 50}],
        [CatalogSizeUnits.IMAGEPIXEL, {min: 1, max: 50}],
        [CatalogSizeUnits.MILLIARCSEC, {min: 0.01, max: 200}],
        [CatalogSizeUnits.ARCMIN, {min: 0.01, max: 120}],
        [CatalogSizeUnits.ARCSEC, {min: 0.01, max: 120}],
        [CatalogSizeUnits.DEG, {min: 0.01, max: 10}]
    ]);

    catalogSourceRadiusTypes = new Map<CatalogSourceRadiusMode, {label: string; value: number}>([
        ["diameter", {label: "Diameter", value: 1}],
        ["radius", {label: "Radius", value: 2}]
    ]);

    // -1 : apply different featherWidth according shape size
    private overlayShapeSettings = new Map<number, {featherWidth: number; diameterBase: number; areaBase: number; thicknessBase: number}>([
        [CatalogOverlayShape.BOX_LINED, {featherWidth: 0.35, diameterBase: 1.5, areaBase: 100, thicknessBase: 1.5}],
        [CatalogOverlayShape.CIRCLE_FILLED, {featherWidth: 0.35, diameterBase: 1.5, areaBase: 70, thicknessBase: 1}],
        [CatalogOverlayShape.CIRCLE_LINED, {featherWidth: 0.5, diameterBase: 1.5, areaBase: 70, thicknessBase: 1}],
        [CatalogOverlayShape.ELLIPSE_LINED, {featherWidth: -1.0, diameterBase: 8, areaBase: 100, thicknessBase: 1.5}],
        [CatalogOverlayShape.HEXAGON_LINED, {featherWidth: 0.35, diameterBase: 0, areaBase: 50, thicknessBase: 1.3}],
        [CatalogOverlayShape.RHOMB_LINED, {featherWidth: 0.35, diameterBase: 1.5, areaBase: 100, thicknessBase: 1.5}],
        [CatalogOverlayShape.TRIANGLE_LINED_UP, {featherWidth: 0.35, diameterBase: 0, areaBase: 20, thicknessBase: 2}],
        [CatalogOverlayShape.TRIANGLE_LINED_DOWN, {featherWidth: 0.35, diameterBase: 0, areaBase: 20, thicknessBase: 2}],
        [CatalogOverlayShape.HEXAGON_LINED_2, {featherWidth: 0.35, diameterBase: 0, areaBase: 50, thicknessBase: 1.3}],
        [CatalogOverlayShape.CROSS_FILLED, {featherWidth: 0.5, diameterBase: 3.5, areaBase: 150, thicknessBase: 1}],
        [CatalogOverlayShape.X_FILLED, {featherWidth: 0.5, diameterBase: 3.5, areaBase: 150, thicknessBase: 1}],
        [CatalogOverlayShape.LineSegment_FILLED, {featherWidth: 0.35, diameterBase: 3, areaBase: 100, thicknessBase: 1}]
    ]);

    @observable catalogFileId: number = 0;
    @observable dataTableColumnWidths: Array<number> = [];
    @observable isShowingSelectedData: boolean = false;
    @observable isCatalogTableAutoScrollEnabled: boolean = false;
    @observable catalogPlotType: CatalogPlotType = CatalogPlotType.ImageOverlay;
    @observable hasAttemptedAutoSelectImageOverlayAxes: boolean = false;
    @observable catalogSize: number = 10.0; // in pixel
    @observable showedCatalogSize: number = 10.0;
    @observable catalogColor: string = Colors.TURQUOISE3;
    @observable catalogShape: CatalogOverlayShape = CatalogOverlayShape.CIRCLE_LINED;
    @observable xAxis: string = CatalogOverlay.NONE;
    @observable yAxis: string = CatalogOverlay.NONE;
    @observable hasPlottedImageOverlay: boolean = false;
    @observable plottedImageOverlayXAxis: string = CatalogOverlay.NONE;
    @observable plottedImageOverlayYAxis: string = CatalogOverlay.NONE;
    @observable plottedImageOverlaySystem: CatalogSystemType | undefined = undefined;
    @observable plottedImageOverlayMaxRows: number | undefined = undefined;
    @observable highlightColor: string = Colors.RED2;
    @observable thickness: number = 2.0;
    @observable catalogDisplayMode: CatalogDisplayMode = CatalogDisplayMode.CANVAS;
    // size map
    @observable sizeMapColumn: string = CatalogOverlay.NONE;
    @observable sizeColumnMax: ClipBound = {default: undefined, clipd: undefined, isExplicit: false};
    @observable sizeColumnMin: ClipBound = {default: undefined, clipd: undefined, isExplicit: false};
    @observable sizeMax: {area: number; diameter: number} = {area: 200, diameter: 20};
    @observable sizeMin: {area: number; diameter: number} = {area: 100, diameter: 5};
    @observable isSizeAreaMode: boolean = false;
    @observable sizeScalingType: FrameScaling = FrameScaling.LINEAR;
    @observable private sizeScalingParameters = createScalingParameters();
    @observable sizeAxisTabId: CatalogSettingsTabs.SIZE_MINOR | CatalogSettingsTabs.SIZE_MAJOR = CatalogSettingsTabs.SIZE_MAJOR;
    @observable isSizeColumnMinLocked: boolean = false;
    @observable isSizeColumnMaxLocked: boolean = false;
    @observable canvasSizeUnit: CatalogSizeUnits = CatalogSizeUnits.SCREENPIXEL;
    @observable worldSizeUnit: AngularSizeUnit = AngularSizeUnit.ARCSEC;
    @observable catalogSourceRadiusType: CatalogSourceRadiusMode = "diameter";
    // size map minor
    @observable sizeMinorMapColumn: string = CatalogOverlay.NONE;
    @observable sizeMinorColumnMax: ClipBound = {default: undefined, clipd: undefined, isExplicit: false};
    @observable sizeMinorColumnMin: ClipBound = {default: undefined, clipd: undefined, isExplicit: false};
    @observable sizeMinorMax: {area: number; diameter: number} = {area: 200, diameter: 20};
    @observable sizeMinorMin: {area: number; diameter: number} = {area: 100, diameter: 5};
    @observable isSizeMinorAreaMode: boolean = false;
    @observable sizeMinorScalingType: FrameScaling = FrameScaling.LINEAR;
    @observable private sizeMinorScalingParameters = createScalingParameters();
    @observable isSizeMinorColumnMinLocked: boolean = false;
    @observable isSizeMinorColumnMaxLocked: boolean = false;
    // color map
    @observable colorMapColumn: string = CatalogOverlay.NONE;
    @observable colorColumnMax: ClipBound = {default: undefined, clipd: undefined, isExplicit: false};
    @observable colorColumnMin: ClipBound = {default: undefined, clipd: undefined, isExplicit: false};
    @observable colorMap: string = ColorMap.Viridis;
    @observable colorScalingType: FrameScaling = FrameScaling.LINEAR;
    @observable private colorScalingParameters = createScalingParameters();
    @observable isInvertedColorMap: boolean = false;
    // orientation
    @observable orientationMapColumn: string = CatalogOverlay.NONE;
    @observable orientationMax: ClipBound = {default: undefined, clipd: undefined, isExplicit: false};
    @observable orientationMin: ClipBound = {default: undefined, clipd: undefined, isExplicit: false};
    @observable orientationScalingType: FrameScaling = FrameScaling.LINEAR;
    @observable private orientationScalingParameters = createScalingParameters();
    @observable angleMax: number = CatalogDisplayStore.MAX_ANGLE;
    @observable angleMin: number = CatalogDisplayStore.MIN_ANGLE;

    private readonly disposers: IReactionDisposer[] = [];

    /**
     * Clipped bounds supplied by {@link applyConfig} for a column that has just changed. Changing a
     * mapped column makes the data-derived defaults recompute, which resets the clip to the full
     * data range; a clip that came from a config outlives that reset.
     */
    private readonly pendingClipRestore = new Map<ClipGroup, ClipRestore>();
    /** Ranges are accumulated as file-based catalog rows arrive in chunks. */
    private readonly columnRangeCache = new Map<string, ColumnRangeCache>();
    /** Layout display settings waiting for the catalog data they validate against. */
    /** Result from the most recent attempt to apply the pending layout config. */
    /** Request that is fetching the data needed by the pending layout config. */
    /** Number of column-fetch attempts made for the current deferred config. */

    constructor(catalogFileId: number) {
        this.catalogFileId = catalogFileId;
        makeObservable(this);

        this.disposers.push(
            // A catalog carries only its preview rows when it is first loaded, and the rest arrive
            // only once the user plots it or scrolls the table. The bounds a config derives from the
            // data therefore cover that preview subset alone, so they are recomputed whenever a batch
            // of rows finishes arriving. Bounds are held while a batch streams, to recompute once per
            // batch rather than once per chunk.
            reaction(
                () => {
                    const profileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
                    return profileStore && !profileStore.isLoadingOntoImage ? profileStore.numVisibleRows : undefined;
                },
                numVisibleRows => {
                    if (numVisibleRows !== undefined) {
                        this.refreshDataDerivedClips();
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.sizeMapData,
                column => {
                    const {minVal, maxVal} = getDefaultRange(column);
                    const isRangeChanged = minVal !== this.sizeColumnMin.default || maxVal !== this.sizeColumnMax.default;
                    if (minVal !== this.sizeColumnMin.default) {
                        this.setSizeColumnMin(minVal, "default");
                    }
                    if (maxVal !== this.sizeColumnMax.default) {
                        this.setSizeColumnMax(maxVal, "default");
                    }
                    if (isRangeChanged && column.length && this.catalogDisplayMode === CatalogDisplayMode.WORLD) {
                        this.setSizeMax(maxVal);
                        this.setSizeMin(minVal);
                    }
                    this.restorePendingClip("sizeMajor");
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.sizeArray(),
                size => {
                    if (size.length) {
                        CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, size, CatalogTextureType.Size);
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.sizeColumnMin.clipd,
                sizeColumnMin => {
                    if (this.isSizeColumnMinLocked) {
                        this.sizeMinorColumnMin.clipd = sizeColumnMin;
                        this.sizeMinorColumnMin.isExplicit = this.sizeColumnMin.isExplicit;
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.sizeColumnMax.clipd,
                sizeColumnMax => {
                    if (this.isSizeColumnMaxLocked) {
                        this.sizeMinorColumnMax.clipd = sizeColumnMax;
                        this.sizeMinorColumnMax.isExplicit = this.sizeColumnMax.isExplicit;
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.sizeMinorMapData,
                column => {
                    const {minVal, maxVal} = getDefaultRange(column);
                    const isRangeChanged = minVal !== this.sizeMinorColumnMin.default || maxVal !== this.sizeMinorColumnMax.default;
                    if (minVal !== this.sizeMinorColumnMin.default) {
                        this.setSizeMinorColumnMin(minVal, "default");
                    }
                    if (maxVal !== this.sizeMinorColumnMax.default) {
                        this.setSizeMinorColumnMax(maxVal, "default");
                    }
                    if (isRangeChanged && column.length && this.catalogDisplayMode === CatalogDisplayMode.WORLD) {
                        this.setMinorSizeMax(maxVal);
                        this.setMinorSizeMin(minVal);
                    }
                    this.restorePendingClip("sizeMinor");
                    this.propagateLockedSizeBounds();
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.sizeMinorArray(),
                size => {
                    if (size.length) {
                        CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, size, CatalogTextureType.SizeMinor);
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.sizeMinorColumnMin.clipd,
                sizeMinorColumnMin => {
                    if (this.isSizeMinorColumnMinLocked) {
                        this.sizeColumnMin.clipd = sizeMinorColumnMin;
                        this.sizeColumnMin.isExplicit = this.sizeMinorColumnMin.isExplicit;
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.sizeMinorColumnMax.clipd,
                sizeMinorColumnMax => {
                    if (this.isSizeMinorColumnMaxLocked) {
                        this.sizeColumnMax.clipd = sizeMinorColumnMax;
                        this.sizeColumnMax.isExplicit = this.sizeMinorColumnMax.isExplicit;
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.colorMapData,
                column => {
                    const {minVal, maxVal} = getDefaultRange(column);
                    if (minVal !== this.colorColumnMin.default) {
                        this.setColorColumnMin(minVal, "default");
                    }
                    if (maxVal !== this.colorColumnMax.default) {
                        this.setColorColumnMax(maxVal, "default");
                    }
                    this.restorePendingClip("color");
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.colorArray(),
                color => {
                    if (color.length) {
                        CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, color, CatalogTextureType.Color);
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.orientationMapData,
                column => {
                    const {minVal, maxVal} = getDefaultRange(column);
                    const isRangeChanged = minVal !== this.orientationMin.default || maxVal !== this.orientationMax.default;
                    if (minVal !== this.orientationMin.default) {
                        this.setOrientationMin(minVal, "default");
                    }
                    if (maxVal !== this.orientationMax.default) {
                        this.setOrientationMax(maxVal, "default");
                    }
                    if (isRangeChanged && column.length && this.catalogDisplayMode === CatalogDisplayMode.WORLD) {
                        this.setAngleMax(maxVal);
                        this.setAngleMin(minVal);
                    }
                    this.restorePendingClip("orientation");
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.orientationArray(),
                orientation => {
                    if (orientation.length) {
                        CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, orientation, CatalogTextureType.Orientation);
                    }
                }
            )
        );

        this.disposers.push(
            // Choose the image overlay's coordinate columns once per catalog, whether or not a widget
            // is open for it. A catalog a Workspace is restoring waits for the axes it was saved
            // with, and is only given its own once the restore is over and none were applied.
            // While an attempt is still to be made, reading the eligibility statuses subscribes this
            // reaction to them, so a column that is still being sniffed gets another chance once a
            // later response provides enough values. Once it has been made, or cannot be, nothing
            // but the conditions for making it is watched.
            reaction(
                () => {
                    const profileStore = this.profileStore;
                    const canAutoSelectAxes =
                        profileStore !== undefined &&
                        !this.hasAttemptedAutoSelectImageOverlayAxes &&
                        this.catalogPlotType === CatalogPlotType.ImageOverlay &&
                        PreferenceStore.Instance.shouldAutoSelectImageOverlayCoordinateColumns &&
                        !AppStore.Instance.isLoadingWorkspace;
                    if (!canAutoSelectAxes) {
                        return undefined;
                    }
                    const eligibilityStatuses = Array.from(this.axisColumnEligibility.values(), result => result.status);
                    return [profileStore.isUpdatingDataStream, profileStore.isLoadingData, profileStore.shouldUpdateData, eligibilityStatuses];
                },
                autoSelectState => {
                    if (autoSelectState === undefined) {
                        return;
                    }

                    // Keep the attempt open while the file still has rows to stream and the
                    // visible coordinate candidates are unresolved. This prevents a noisy first
                    // chunk from permanently suppressing auto-selection for a later valid chunk.
                    const isWaitingForStreamedAxes = this.autoSelectAxes();
                    if (!isWaitingForStreamedAxes) {
                        this.setAutoSelectImageOverlayAxesAttempted(true);
                    }
                },
                {fireImmediately: true}
            )
        );
    }

    private get profileStore(): CatalogProfileStore | CatalogOnlineQueryProfileStore | undefined {
        return CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
    }

    public dispose = () => {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    };

    /**
     * Reset all settings of catalog source plot to default
     */
    @action resetMaps() {
        this.columnRangeCache.clear();
        this.clearPendingRestoreState();
        this.clearPlottedImageOverlayState();
        // size
        this.sizeMapColumn = CatalogOverlay.NONE;
        this.isSizeAreaMode = false;
        this.sizeScalingType = FrameScaling.LINEAR;
        this.sizeScalingParameters = createScalingParameters();
        this.sizeMin = {area: 50, diameter: 5};
        this.sizeMax = {area: 200, diameter: 20};
        this.sizeColumnMin = {default: undefined, clipd: undefined, isExplicit: false};
        this.sizeColumnMax = {default: undefined, clipd: undefined, isExplicit: false};
        this.sizeAxisTabId = CatalogSettingsTabs.SIZE_MAJOR;
        this.isSizeColumnMinLocked = false;
        this.isSizeColumnMaxLocked = false;
        // size minor
        this.sizeMinorMapColumn = CatalogOverlay.NONE;
        this.isSizeMinorAreaMode = false;
        this.sizeMinorScalingType = FrameScaling.LINEAR;
        this.sizeMinorScalingParameters = createScalingParameters();
        this.sizeMinorMin = {area: 50, diameter: 5};
        this.sizeMinorMax = {area: 200, diameter: 20};
        this.sizeMinorColumnMin = {default: undefined, clipd: undefined, isExplicit: false};
        this.sizeMinorColumnMax = {default: undefined, clipd: undefined, isExplicit: false};
        this.isSizeMinorColumnMinLocked = false;
        this.isSizeMinorColumnMaxLocked = false;
        // color
        this.colorMapColumn = CatalogOverlay.NONE;
        this.colorColumnMax = {default: undefined, clipd: undefined, isExplicit: false};
        this.colorColumnMin = {default: undefined, clipd: undefined, isExplicit: false};
        this.colorMap = ColorMap.Jet;
        this.colorScalingType = FrameScaling.LINEAR;
        this.colorScalingParameters = createScalingParameters();
        this.isInvertedColorMap = false;
        // orientation
        this.orientationMapColumn = CatalogOverlay.NONE;
        this.orientationMax = {default: undefined, clipd: undefined, isExplicit: false};
        this.orientationMin = {default: undefined, clipd: undefined, isExplicit: false};
        this.orientationScalingType = FrameScaling.LINEAR;
        this.orientationScalingParameters = createScalingParameters();
        this.angleMax = CatalogDisplayStore.MAX_ANGLE;
        this.angleMin = CatalogDisplayStore.MIN_ANGLE;
    }

    /**
     * Set the maximum orientation value
     * @param max - max degree of orientation
     */
    @action setAngleMax(max: number) {
        this.angleMax = clamp(max, CatalogDisplayStore.MIN_ANGLE, CatalogDisplayStore.MAX_ANGLE);
    }

    /**
     * Set the minimum orientation value
     * @param min - min degree of orientation
     */
    @action setAngleMin(min: number) {
        this.angleMin = clamp(min, CatalogDisplayStore.MIN_ANGLE, CatalogDisplayStore.MAX_ANGLE);
    }

    /**
     * Set the maximum value for orientation mapping data
     * @param val - maximum orientation degree for mapping data
     * @param type - "default" or "clipd"
     */
    @action setOrientationMax(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.orientationMax.default = val;
            if (!this.orientationMax.isExplicit) {
                this.orientationMax.clipd = val;
            }
        } else {
            this.orientationMax.clipd = val;
            this.orientationMax.isExplicit = true;
        }
    }

    /**
     * Set the minimum value for orientation mapping data
     * @param val - minimum orientation degree for mapping data
     * @param type - "default" or "clipd"
     */
    @action setOrientationMin(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.orientationMin.default = val;
            if (!this.orientationMin.isExplicit) {
                this.orientationMin.clipd = val;
            }
        } else {
            this.orientationMin.clipd = val;
            this.orientationMin.isExplicit = true;
        }
    }

    /**
     * Reset the orientation value for mapping data to default
     * @param type - "min" or "max"
     */
    @action resetOrientationValue(type: "min" | "max") {
        if (type === "min") {
            this.orientationMin.clipd = this.orientationMin.default;
            this.orientationMin.isExplicit = false;
        } else {
            this.orientationMax.clipd = this.orientationMax.default;
            this.orientationMax.isExplicit = false;
        }
    }

    /**
     * Select the column for orientation data
     * @param column - column name of orientation data
     */
    @action setOrientationMapColumn(column: string) {
        if (this.orientationMapColumn !== column) {
            this.columnRangeCache.clear();
            this.orientationMapColumn = column;
            this.orientationMin = {default: undefined, clipd: undefined, isExplicit: false};
            this.orientationMax = {default: undefined, clipd: undefined, isExplicit: false};

            if (this.catalogDisplayMode === CatalogDisplayMode.WORLD) {
                const result = minMaxArray(this.orientationMapData);
                this.setAngleMax(result.maxVal);
                this.setAngleMin(result.minVal);
            }
        }
    }

    /**
     * Set the scaling type for orientation data
     * @param type - scaling type for orientation data
     */
    @action setOrientationScalingType(type: FrameScaling) {
        this.orientationScalingType = type;
    }

    @computed get orientationScalingParameter(): number {
        return getScalingParameter(this.orientationScalingParameters, this.orientationScalingType);
    }

    @action setOrientationScalingParameter(value: number) {
        this.orientationScalingParameters.set(this.orientationScalingType, sanitizeScalingParameter(this.orientationScalingType, value));
    }

    /**
     * Set the colormap direction
     * @param isInvertedColorMap - true for inverted colormap, false for normal colormap
     */
    @action setColorMapDirection(isInvertedColorMap: boolean) {
        this.isInvertedColorMap = isInvertedColorMap;
    }

    /**
     * Set the maximum value for color mapping data
     * @param val - maximum value for color mapping data
     * @param type - "default" or "clipd"
     */
    @action setColorColumnMax(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.colorColumnMax.default = val;
            if (!this.colorColumnMax.isExplicit) {
                this.colorColumnMax.clipd = val;
            }
        } else {
            this.colorColumnMax.clipd = val;
            this.colorColumnMax.isExplicit = true;
        }
    }

    /**
     * Set the minimum value for color mapping data
     * @param val - minimum value for color mapping data
     * @param type - "default" or "clipd"
     */
    @action setColorColumnMin(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.colorColumnMin.default = val;
            if (!this.colorColumnMin.isExplicit) {
                this.colorColumnMin.clipd = val;
            }
        } else {
            this.colorColumnMin.clipd = val;
            this.colorColumnMin.isExplicit = true;
        }
    }

    /**
     * Reset the maximum or minimum values for color mapping data to default
     * @param type - "min" or "max"
     */
    @action resetColorColumnValue(type: "min" | "max") {
        if (type === "min") {
            this.colorColumnMin.clipd = this.colorColumnMin.default;
            this.colorColumnMin.isExplicit = false;
        } else {
            this.colorColumnMax.clipd = this.colorColumnMax.default;
            this.colorColumnMax.isExplicit = false;
        }
    }

    /**
     * Select the column for color mapping data
     * @param column - column name of color mapping data
     */
    @action setColorMapColumn(column: string) {
        if (this.colorMapColumn !== column) {
            this.columnRangeCache.clear();
            this.colorMapColumn = column;
            this.colorColumnMin = {default: undefined, clipd: undefined, isExplicit: false};
            this.colorColumnMax = {default: undefined, clipd: undefined, isExplicit: false};
        }
    }

    /**
     * Set the scaling type for color mapping data
     * @param type - scaling type for color mapping data
     */
    @action setColorScalingType(type: FrameScaling) {
        this.colorScalingType = type;
    }

    @computed get colorScalingParameter(): number {
        return getScalingParameter(this.colorScalingParameters, this.colorScalingType);
    }

    @action setColorScalingParameter(value: number) {
        this.colorScalingParameters.set(this.colorScalingType, sanitizeScalingParameter(this.colorScalingType, value));
    }

    /**
     * Set the colormap
     * @param colorMap - colormap name
     */
    @action setColorMap(colorMap: string) {
        this.colorMap = colorMap;
    }

    /**
     * Set the maximum catalog source size
     * @param val - maximum size of catalog source in pixel or square pixel
     */
    @action setSizeMax(val: number) {
        const isAreaMode = this.isSizeAreaMode;
        if (isAreaMode) {
            this.sizeMax.area = val;
        } else {
            if (val >= this.minOverlaySize && val <= this.maxOverlaySize) {
                this.sizeMax.diameter = val;
            }
        }
    }

    /**
     * Set the minimum catalog source size
     * @param val - minimum size of catalog source in pixel or square pixel
     */
    @action setSizeMin(val: number) {
        const isAreaMode = this.isSizeAreaMode;
        if (isAreaMode) {
            this.sizeMin.area = val;
        } else {
            if (val >= this.minOverlaySize && val <= this.maxOverlaySize) {
                this.sizeMin.diameter = val;
            }
        }
    }

    /**
     * Reset the maximum and minimum values for catalog source size to default
     */
    @action resetSize() {
        this.clearPendingRestoreState();
        this.resetSizeValues();
    }

    private resetSizeValues() {
        this.sizeMin = {area: 100, diameter: 5};
        this.sizeMax = {area: 200, diameter: 20};
        this.sizeMinorMin = {area: 100, diameter: 5};
        this.sizeMinorMax = {area: 200, diameter: 20};
    }

    /**
     * Set the maximum value for size mapping data
     * @param val - maximum value for size mapping data
     * @param type - "default" or "clipd"
     */
    @action setSizeColumnMax(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.sizeColumnMax.default = val;
            if (!this.sizeColumnMax.isExplicit) {
                this.sizeColumnMax.clipd = val;
            }
        } else {
            this.sizeColumnMax.clipd = val;
            this.sizeColumnMax.isExplicit = true;
        }
    }

    /**
     * Set the minimum value for size mapping data
     * @param val - minimum value for size mapping data
     * @param type - "default" or "clipd"
     */
    @action setSizeColumnMin(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.sizeColumnMin.default = val;
            if (!this.sizeColumnMin.isExplicit) {
                this.sizeColumnMin.clipd = val;
            }
        } else {
            this.sizeColumnMin.clipd = val;
            this.sizeColumnMin.isExplicit = true;
        }
    }

    /**
     * Reset the maximum or minimum values for size mapping data to default
     * @param type - "min" or "max"
     */
    @action resetSizeColumnValue(type: "min" | "max") {
        if (type === "min") {
            this.sizeColumnMin.clipd = this.sizeColumnMin.default;
            this.sizeColumnMin.isExplicit = false;
        } else {
            this.sizeColumnMax.clipd = this.sizeColumnMax.default;
            this.sizeColumnMax.isExplicit = false;
        }
    }

    /**
     * Set the scaling type for size mapping
     * @param type - scaling type for size mapping
     */
    @action setSizeScalingType(type: FrameScaling) {
        this.sizeScalingType = type;
    }

    @computed get sizeScalingParameter(): number {
        return getScalingParameter(this.sizeScalingParameters, this.sizeScalingType);
    }

    @action setSizeScalingParameter(value: number) {
        this.sizeScalingParameters.set(this.sizeScalingType, sanitizeScalingParameter(this.sizeScalingType, value));
    }

    /**
     * Set the size mapping depending on the area or diameter
     * @param isSizeAreaMode - true for area, false for diameter
     */
    @action setSizeArea(isSizeAreaMode: boolean) {
        this.isSizeAreaMode = isSizeAreaMode;
    }

    /**
     * Select the size mapping column
     * @param column - column name for size mapping
     */
    @action setSizeMap(column: string) {
        if (this.sizeMapColumn !== column) {
            this.columnRangeCache.clear();
            this.sizeMapColumn = column;
            this.sizeColumnMin = {default: undefined, clipd: undefined, isExplicit: false};
            this.sizeColumnMax = {default: undefined, clipd: undefined, isExplicit: false};
            if (this.catalogDisplayMode === CatalogDisplayMode.WORLD) {
                const result = minMaxArray(this.sizeMapData);
                this.setSizeMax(result.maxVal);
                this.setSizeMin(result.minVal);
            }
            if (column === CatalogOverlay.NONE) {
                this.isSizeAreaMode = false;
                this.isSizeColumnMinLocked = false;
                this.isSizeColumnMaxLocked = false;
                this.isSizeMinorColumnMinLocked = false;
                this.isSizeMinorColumnMaxLocked = false;
                this.sizeMinorMapColumn = CatalogOverlay.NONE;
            }
        }
    }

    @action setSizeAxisTab(tab: CatalogSettingsTabs.SIZE_MINOR | CatalogSettingsTabs.SIZE_MAJOR) {
        this.sizeAxisTabId = tab;
    }

    /**
     * Set the maximum minor axis of catalog source
     * @param val - maximum minor axis of catalog source in pixel or square pixel
     */
    @action setMinorSizeMax(val: number) {
        const isAreaMode = this.isSizeMinorAreaMode;
        if (isAreaMode) {
            this.sizeMinorMax.area = val;
        } else {
            this.sizeMinorMax.diameter = val;
        }
    }

    /**
     * Set the minimum minor axis of catalog source
     * @param val - minimum minor axis of catalog source in pixel or square pixel
     */
    @action setMinorSizeMin(val: number) {
        const isAreaMode = this.isSizeMinorAreaMode;
        if (isAreaMode) {
            this.sizeMinorMin.area = val;
        } else {
            this.sizeMinorMin.diameter = val;
        }
    }

    /**
     * Set the maximum value for minor size mapping data
     * @param val - maximum value for minor size mapping data
     * @param type - "default" or "clipd"
     */
    @action setSizeMinorColumnMax(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.sizeMinorColumnMax.default = val;
            if (!this.sizeMinorColumnMax.isExplicit) {
                this.sizeMinorColumnMax.clipd = val;
            }
        } else {
            this.sizeMinorColumnMax.clipd = val;
            this.sizeMinorColumnMax.isExplicit = true;
        }
    }

    /**
     * Set the minimum value of minor axis for size mapping data
     * @param val - minimum value of minor axis for size mapping data
     * @param type - "default" or "clipd"
     */
    @action setSizeMinorColumnMin(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.sizeMinorColumnMin.default = val;
            if (!this.sizeMinorColumnMin.isExplicit) {
                this.sizeMinorColumnMin.clipd = val;
            }
        } else {
            this.sizeMinorColumnMin.clipd = val;
            this.sizeMinorColumnMin.isExplicit = true;
        }
    }

    /**
     * Reset the maximum or minimum values of minor axis for size mapping data to default
     * @param type - "min" or "max"
     */
    @action resetSizeMinorColumnValue(type: "min" | "max") {
        if (type === "min") {
            this.sizeMinorColumnMin.clipd = this.sizeMinorColumnMin.default;
            this.sizeMinorColumnMin.isExplicit = false;
        } else {
            this.sizeMinorColumnMax.clipd = this.sizeMinorColumnMax.default;
            this.sizeMinorColumnMax.isExplicit = false;
        }
    }

    @action toggleSizeColumnMinLock = () => {
        this.isSizeColumnMinLocked = !this.isSizeColumnMinLocked;
        if (this.isSizeColumnMinLocked) {
            this.sizeMinorColumnMin.clipd = this.sizeColumnMin.clipd;
        }
    };

    @action toggleSizeColumnMaxLock = () => {
        this.isSizeColumnMaxLocked = !this.isSizeColumnMaxLocked;
        if (this.isSizeColumnMaxLocked) {
            this.sizeMinorColumnMax.clipd = this.sizeColumnMax.clipd;
        }
    };

    @action toggleSizeMinorColumnMinLock = () => {
        this.isSizeMinorColumnMinLocked = !this.isSizeMinorColumnMinLocked;
        if (this.isSizeMinorColumnMinLocked) {
            this.sizeColumnMin.clipd = this.sizeMinorColumnMin.clipd;
        }
    };

    @action toggleSizeMinorColumnMaxLock = () => {
        this.isSizeMinorColumnMaxLocked = !this.isSizeMinorColumnMaxLocked;
        if (this.isSizeMinorColumnMaxLocked) {
            this.sizeColumnMax.clipd = this.sizeMinorColumnMax.clipd;
        }
    };

    /**
     * Set the scaling type of minor axis for size mapping
     * @param type - scaling type of minor axis for size mapping
     */
    @action setSizeMinorScalingType(type: FrameScaling) {
        this.sizeMinorScalingType = type;
    }

    @computed get sizeMinorScalingParameter(): number {
        return getScalingParameter(this.sizeMinorScalingParameters, this.sizeMinorScalingType);
    }

    @action setSizeMinorScalingParameter(value: number) {
        this.sizeMinorScalingParameters.set(this.sizeMinorScalingType, sanitizeScalingParameter(this.sizeMinorScalingType, value));
    }

    /**
     * Set the minor axis mapping depending on the area or diameter
     * @param isSizeMinorAreaMode - true for area, false for diameter
     */
    @action setSizeMinorArea(isSizeMinorAreaMode: boolean) {
        this.isSizeMinorAreaMode = isSizeMinorAreaMode;
    }

    /**
     * Select the column for minor axis size mapping
     * @param column - column name for minor axis size mapping
     */
    @action setSizeMinorMap(column: string) {
        if (this.sizeMinorMapColumn !== column) {
            this.columnRangeCache.clear();
            this.sizeMinorMapColumn = column;
            this.sizeMinorColumnMin = {default: undefined, clipd: undefined, isExplicit: false};
            this.sizeMinorColumnMax = {default: undefined, clipd: undefined, isExplicit: false};
            if (this.catalogDisplayMode === CatalogDisplayMode.WORLD) {
                const result = minMaxArray(this.sizeMinorMapData);
                this.setMinorSizeMax(result.maxVal);
                this.setMinorSizeMin(result.minVal);
            }
            if (column === CatalogOverlay.NONE) {
                this.isSizeMinorAreaMode = false;
                this.isSizeMinorColumnMinLocked = false;
                this.isSizeMinorColumnMaxLocked = false;
                this.isSizeColumnMinLocked = false;
                this.isSizeColumnMaxLocked = false;
            }
        }
    }

    /**
     * Set the catalog source display mode
     * @param value - display mode of catalog source
     */
    @action setCatalogDisplayMode(value: CatalogDisplayMode) {
        this.catalogDisplayMode = value;
        if (this.catalogDisplayMode === CatalogDisplayMode.WORLD) {
            this.isSizeAreaMode = false;

            const result = minMaxArray(this.sizeMapData);
            this.setSizeMax(result.maxVal);
            this.setSizeMin(result.minVal);
            const minorResult = minMaxArray(this.sizeMinorMapData);
            this.setMinorSizeMax(minorResult.maxVal);
            this.setMinorSizeMin(minorResult.minVal);
            const resultOrientation = minMaxArray(this.orientationMapData);
            this.setAngleMax(resultOrientation.maxVal);
            this.setAngleMin(resultOrientation.minVal);

            if (this.catalogShape !== CatalogOverlayShape.ELLIPSE_LINED) {
                this.catalogShape = CatalogOverlayShape.CIRCLE_LINED;
            }
        } else {
            this.resetSizeValues();
        }
        this.setCatalogSize(this.showedCatalogSize);
    }

    /**
     * Set unit for catalog source size
     * @param unit - unit of catalog source size ({@link CatalogSizeUnits})
     */
    @action setCanvasSizeUnit(unit: CatalogSizeUnits) {
        this.canvasSizeUnit = unit;
        this.setCatalogSize(clamp(this.showedCatalogSize, this.minOverlaySize, this.maxOverlaySize));
    }

    /**
     * Set angular unit for catalog source size in world coordinates
     * @param unit - unit of catalog source size ({@link AngularSizeUnit})
     */
    @action setWorldSizeUnit(unit: AngularSizeUnit) {
        this.worldSizeUnit = unit;
        this.setCatalogSize(this.showedCatalogSize);
    }

    @action setDataTableColumnWidths(vals: Array<number>) {
        this.dataTableColumnWidths = vals;
    }

    @action setShowSelectedData(isShowingSelectedData: boolean) {
        this.isShowingSelectedData = isShowingSelectedData;
    }

    @action setCatalogTableAutoScroll(isCatalogTableAutoScrollEnabled: boolean) {
        this.isCatalogTableAutoScrollEnabled = isCatalogTableAutoScrollEnabled;
    }

    @action setCatalogPlotType(type: CatalogPlotType) {
        this.catalogPlotType = type;
    }

    @computed get minOverlaySize(): number {
        return this.overlaySize.get(this.canvasSizeUnit)?.min ?? CatalogDisplayStore.MIN_OVERLAY_SIZE;
    }

    @computed get maxOverlaySize(): number {
        return this.overlaySize.get(this.canvasSizeUnit)?.max ?? CatalogDisplayStore.MAX_OVERLAY_SIZE;
    }

    /**
     * Set the size of catalog source
     * @param size - size of catalog source in pixel or arcsec
     */
    @action setCatalogSize(size: number) {
        if (size >= this.minOverlaySize && size <= this.maxOverlaySize) {
            this.catalogSize = size * this.pixelSizeFactor;
            this.showedCatalogSize = size;
        }
    }

    @action setCatalogSourceRadiusType(type: CatalogSourceRadiusMode) {
        if (this.catalogSourceRadiusTypes.has(type)) {
            this.catalogSourceRadiusType = type;
            this.setCatalogSize(this.showedCatalogSize);
        }
    }

    /**
     * Set the color of catalog source
     * @param color - color of catalog source
     */
    @action setCatalogColor(color: string) {
        this.catalogColor = color;
    }

    /**
     * Set the shape of catalog source
     * @param shape - shape of catalog source
     */
    @action setCatalogShape(shape: CatalogOverlayShape) {
        this.catalogShape = shape;
        if (shape !== CatalogOverlayShape.ELLIPSE_LINED && this.sizeAxisTabId === CatalogSettingsTabs.SIZE_MINOR) {
            this.sizeAxisTabId = CatalogSettingsTabs.SIZE_MAJOR;
        }
    }

    @action setxAxis(xColumnName: string) {
        this.xAxis = xColumnName;
    }

    @action setyAxis(yColumnName: string) {
        this.yAxis = yColumnName;
    }

    @action setAutoSelectImageOverlayAxesAttempted(hasAttemptedAutoSelectImageOverlayAxes: boolean) {
        this.hasAttemptedAutoSelectImageOverlayAxes = hasAttemptedAutoSelectImageOverlayAxes;
    }

    /** Show or hide a column, keeping the image overlay's axes on displayed columns. */
    @action setColumnDisplayed(columnName: string, isDisplayed: boolean) {
        const profileStore = this.profileStore;
        if (!profileStore) {
            return;
        }
        const header = profileStore.catalogControlHeader.get(columnName);
        profileStore.setHeaderDisplay(isDisplayed, columnName);

        const shouldAutoSelect = PreferenceStore.Instance.shouldAutoSelectImageOverlayCoordinateColumns;
        if (shouldAutoSelect && isDisplayed && (this.xAxis === CatalogOverlay.NONE || this.yAxis === CatalogOverlay.NONE)) {
            this.setAutoSelectedAxes(this.getAutoSelectableAxisOptions());
        }

        if ((isDisplayed || header?.filter !== "") && profileStore.isFileBasedCatalog) {
            this.requestColumnUpdate();
        }

        const isXAxisRemoved = this.xAxis === columnName;
        const isYAxisRemoved = this.yAxis === columnName;
        if (isXAxisRemoved) {
            this.setxAxis(CatalogOverlay.NONE);
        }
        if (isYAxisRemoved) {
            this.setyAxis(CatalogOverlay.NONE);
        }
        if (shouldAutoSelect && (isXAxisRemoved || isYAxisRemoved)) {
            this.setAutoSelectedAxes(this.getAutoSelectableAxisOptions(), isXAxisRemoved, isYAxisRemoved);
        }
    }

    /** Read the catalog's coordinates in another system, choosing the overlay's axes for it again. */
    @action changeCoordinateSystem(system: CatalogSystemType) {
        const profileStore = this.profileStore;
        if (!profileStore || profileStore.catalogCoordinateSystem.system === system) {
            return;
        }

        const previousSystem = profileStore.activedSystem;
        profileStore.setCatalogCoordinateSystem(system);
        if (PreferenceStore.Instance.shouldAutoSelectImageOverlayCoordinateColumns) {
            this.setAutoSelectImageOverlayAxesAttempted(false);
            const isWaitingForStreamedAxes = this.autoSelectAxes(true);
            if (!isWaitingForStreamedAxes) {
                this.setAutoSelectImageOverlayAxesAttempted(true);
            }
            return;
        }

        const shouldClearAxes = previousSystem?.x !== profileStore.activedSystem?.x || previousSystem?.y !== profileStore.activedSystem?.y;
        if (this.catalogPlotType === CatalogPlotType.ImageOverlay && shouldClearAxes) {
            this.setxAxis(CatalogOverlay.NONE);
            this.setyAxis(CatalogOverlay.NONE);
        }
    }

    /** Switch what the axes are chosen for, dropping axes the new plot type cannot draw. */
    @action changePlotType(plotType: CatalogPlotType) {
        const didLeaveImageOverlay = plotType !== CatalogPlotType.ImageOverlay && this.catalogPlotType === CatalogPlotType.ImageOverlay;
        this.setCatalogPlotType(plotType);
        const profileStore = this.profileStore;
        if (!profileStore || !didLeaveImageOverlay) {
            return;
        }

        // Image overlays accept coordinate strings, while scatter plots and histograms consume
        // raw numeric arrays. Do not leave a string coordinate selected when leaving the overlay:
        // the plot button would otherwise stay enabled and the new plot would be empty.
        if (!profileStore.isNumericColumn(this.xAxis)) {
            this.setxAxis(CatalogOverlay.NONE);
        }
        if (!profileStore.isNumericColumn(this.yAxis)) {
            this.setyAxis(CatalogOverlay.NONE);
        }
    }

    /** What the x axis stands for: a coordinate of the catalog's system on an image overlay. */
    @computed get xAxisLabel(): CatalogOverlay {
        return this.catalogPlotType === CatalogPlotType.ImageOverlay ? (this.profileStore?.activedSystem?.x ?? CatalogOverlay.X) : CatalogOverlay.X;
    }

    @computed get yAxisLabel(): CatalogOverlay {
        return this.catalogPlotType === CatalogPlotType.ImageOverlay ? (this.profileStore?.activedSystem?.y ?? CatalogOverlay.Y) : CatalogOverlay.Y;
    }

    /**
     * Eligibility is per column, not per axis: whether a column can be read as a number has
     * nothing to do with which slot it lands in. Only the ordering of the axis options is
     * axis-specific.
     */
    @computed get axisColumnEligibility(): Map<string, CatalogAxisEligibilityResult> {
        const eligibility = new Map<string, CatalogAxisEligibilityResult>();
        const profileStore = this.profileStore;
        if (!profileStore) {
            return eligibility;
        }

        profileStore.catalogControlHeader.forEach((header, columnName) => {
            if (header?.dataIndex === undefined || !header.display) {
                return;
            }
            eligibility.set(columnName, profileStore.getCoordinateEligibility(columnName));
        });
        return eligibility;
    }

    @computed get xAxisOptions(): string[] {
        return this.getAxisOptions(this.xAxisLabel);
    }

    @computed get yAxisOptions(): string[] {
        return this.getAxisOptions(this.yAxisLabel);
    }

    private getAxisOptions(axis: CatalogOverlay): string[] {
        const profileStore = this.profileStore;
        if (!profileStore) {
            return [CatalogOverlay.NONE];
        }

        // Scatter plots and histograms consume raw numeric arrays, so only a column that is
        // already numeric belongs in their menus.
        if (this.catalogPlotType !== CatalogPlotType.ImageOverlay) {
            return [CatalogOverlay.NONE, ...profileStore.displayedNumericColumnNames];
        }

        // Numeric columns are selectable, and so are string columns whose values parse as a
        // coordinate; ranking pushes the unlikely candidates down the list rather than hiding
        // them, so a mislabelled catalog is still usable.
        const selectableColumns: string[] = [];
        this.axisColumnEligibility.forEach((result, columnName) => {
            if (result.status !== CatalogAxisEligibility.Ineligible) {
                selectableColumns.push(columnName);
            }
        });

        return [CatalogOverlay.NONE, ...rankCatalogAxisColumns(axis, selectableColumns, profileStore.catalogCoordinateSystem.system)];
    }

    /**
     * @param shouldIncludeUnknown - also offer columns whose values have not been fetched, so their
     * format is still unknown. Only a last resort: the name is all there is to go on, and a wrong
     * guess costs a round trip. It degrades safely, because a column that turns out not to be a
     * coordinate yields no data and simply leaves the overlay unplotted.
     */
    private getAutoSelectableAxisOptions(shouldIncludeHidden = false, shouldIncludeUnknown = false): string[] {
        const profileStore = this.profileStore;
        if (!profileStore) {
            return [];
        }

        const axisOptions: string[] = [];
        profileStore.catalogControlHeader.forEach((header, columnName) => {
            if (header?.dataIndex === undefined || (!shouldIncludeHidden && !header.display)) {
                return;
            }

            const status = profileStore.getCoordinateEligibility(columnName).status;
            if (status === CatalogAxisEligibility.Eligible || (shouldIncludeUnknown && status === CatalogAxisEligibility.Unknown)) {
                axisOptions.push(columnName);
            }
        });
        return axisOptions;
    }

    private enableAxisColumns(columnNames: Array<string | undefined>): boolean {
        const profileStore = this.profileStore;
        if (!profileStore) {
            return false;
        }

        let didEnableColumns = false;
        for (const columnName of columnNames) {
            if (!columnName) {
                continue;
            }
            const header = profileStore.catalogControlHeader.get(columnName);
            if (header && !header.display) {
                profileStore.setHeaderDisplay(true, columnName);
                didEnableColumns = true;
            }
        }
        return didEnableColumns;
    }

    private setAutoSelectedAxes(axisOptions: string[], shouldSelectXAxis = true, shouldSelectYAxis = true, shouldEnableHiddenColumns = false): {didSelectX: boolean; didSelectY: boolean; enabledHiddenColumns: boolean} {
        if (this.catalogPlotType !== CatalogPlotType.ImageOverlay) {
            return {didSelectX: false, didSelectY: false, enabledHiddenColumns: false};
        }

        const system = this.profileStore?.catalogCoordinateSystem.system;
        const xColumnName = shouldSelectXAxis && this.xAxis === CatalogOverlay.NONE ? getAutoSelectedCatalogAxisColumn(this.xAxisLabel, axisOptions, system) : undefined;
        const yColumnName = shouldSelectYAxis && this.yAxis === CatalogOverlay.NONE ? getAutoSelectedCatalogAxisColumn(this.yAxisLabel, axisOptions, system) : undefined;

        let areHiddenColumnsEnabled = false;
        if (shouldEnableHiddenColumns) {
            areHiddenColumnsEnabled = this.enableAxisColumns([xColumnName, yColumnName]);
        }

        if (xColumnName) {
            this.setxAxis(xColumnName);
        }
        if (yColumnName) {
            this.setyAxis(yColumnName);
        }

        return {didSelectX: Boolean(xColumnName), didSelectY: Boolean(yColumnName), enabledHiddenColumns: areHiddenColumnsEnabled};
    }

    /** Whether a streamed file may still settle the format of a name-matched coordinate column. */
    private hasPendingStreamedAxisEligibility(): boolean {
        const profileStore = this.profileStore;
        if (!profileStore?.isFileBasedCatalog || !profileStore.shouldUpdateData) {
            return false;
        }

        let loadedRowCount = 0;
        profileStore.catalogData.forEach(columnData => {
            loadedRowCount = Math.max(loadedRowCount, columnData.data?.length ?? 0);
        });
        if (loadedRowCount >= COORDINATE_SNIFF_SCAN_LIMIT) {
            return false;
        }

        for (const [columnName, result] of this.axisColumnEligibility) {
            if (result.status === CatalogAxisEligibility.Unknown && this.isCoordinateNameCandidate(columnName)) {
                return true;
            }
        }
        return false;
    }

    private isCoordinateNameCandidate(columnName: string): boolean {
        const system = this.profileStore?.catalogCoordinateSystem.system;
        return Boolean(getAutoSelectedCatalogAxisColumn(this.xAxisLabel, [columnName], system) || getAutoSelectedCatalogAxisColumn(this.yAxisLabel, [columnName], system));
    }

    /** Returns true when auto-selection should be retried after another streamed response. */
    @action private autoSelectAxes(shouldForceReset = false): boolean {
        const profileStore = this.profileStore;
        if (!PreferenceStore.Instance.shouldAutoSelectImageOverlayCoordinateColumns || this.catalogPlotType !== CatalogPlotType.ImageOverlay) {
            return false;
        }

        if (shouldForceReset) {
            this.setxAxis(CatalogOverlay.NONE);
            this.setyAxis(CatalogOverlay.NONE);
        }

        // Widening passes: the columns already on screen, then the hidden ones whose units or
        // values identify them, and only then the hidden ones nothing but their name suggests.
        const selected = this.setAutoSelectedAxes(this.getAutoSelectableAxisOptions());
        if (selected.didSelectX && selected.didSelectY) {
            return false;
        }

        // Do not spend the one-shot attempt on a partial answer. In particular, a first chunk
        // containing one coordinate and one placeholder is Unknown, not a final rejection.
        if (this.hasPendingStreamedAxisEligibility()) {
            // The preview is only the first chunk. Keep fetching the displayed candidates so a
            // later response can settle a unitless string format and wake the reaction again.
            CatalogStore.Instance.requestMoreRows(this.catalogFileId);
            return true;
        }

        const fallback = this.setAutoSelectedAxes(this.getAutoSelectableAxisOptions(true), !selected.didSelectX, !selected.didSelectY, true);
        let didEnableHiddenColumns = fallback.enabledHiddenColumns;

        const isXAxisUnfilled = !selected.didSelectX && !fallback.didSelectX;
        const isYAxisUnfilled = !selected.didSelectY && !fallback.didSelectY;
        if (isXAxisUnfilled || isYAxisUnfilled) {
            const unknownFallback = this.setAutoSelectedAxes(this.getAutoSelectableAxisOptions(true, true), isXAxisUnfilled, isYAxisUnfilled, true);
            didEnableHiddenColumns = didEnableHiddenColumns || unknownFallback.enabledHiddenColumns;
        }

        if (didEnableHiddenColumns && profileStore?.isFileBasedCatalog) {
            this.requestColumnUpdate();
        }
        return false;
    }

    /** Fetch the columns just displayed, keeping the rows already in the table. */
    private requestColumnUpdate() {
        const profileStore = this.profileStore;
        profileStore?.setUpdateMode(CatalogUpdateMode.TableUpdate);
        profileStore?.setIsUpdateColumn(true);
        CatalogStore.Instance.requestFilteredRows(this.catalogFileId);
    }

    @action setPlottedImageOverlayState(xColumnName: string, yColumnName: string, system: CatalogSystemType, maxRows?: number) {
        this.hasPlottedImageOverlay = true;
        this.plottedImageOverlayXAxis = xColumnName;
        this.plottedImageOverlayYAxis = yColumnName;
        this.plottedImageOverlaySystem = system;
        if (maxRows !== undefined) {
            this.plottedImageOverlayMaxRows = maxRows;
        }
    }

    @action clearPlottedImageOverlayState() {
        this.hasPlottedImageOverlay = false;
        this.plottedImageOverlayXAxis = CatalogOverlay.NONE;
        this.plottedImageOverlayYAxis = CatalogOverlay.NONE;
        this.plottedImageOverlaySystem = undefined;
        this.plottedImageOverlayMaxRows = undefined;
    }

    /**
     * Set the color of highlighted catalog source
     * @param color - color of highlight
     */
    @action setHighlightColor(color: string) {
        this.highlightColor = color;
    }

    /**
     * Set the thickness of catalog source
     * @param val - thickness of catalog source
     */
    @action setThickness(val: number) {
        this.thickness = clamp(val, CatalogDisplayStore.MIN_THICKNESS, CatalogDisplayStore.MAX_THICKNESS);
    }

    /**
     * If the catalog source is in image pixel
     */
    @computed get isImagePixelSize(): boolean {
        return this.canvasSizeUnit !== CatalogSizeUnits.SCREENPIXEL || this.catalogDisplayMode === CatalogDisplayMode.WORLD;
    }

    /**
     * If the catalog source is in angular size
     */
    @computed get isAngularSize(): boolean {
        return (this.canvasSizeUnit !== CatalogSizeUnits.SCREENPIXEL && this.canvasSizeUnit !== CatalogSizeUnits.IMAGEPIXEL) || this.catalogDisplayMode === CatalogDisplayMode.WORLD;
    }

    /**
     * Column data of a size, color, or orientation map for the plotted catalog sources
     */
    private getMapColumnData(column: string, isDisabled: boolean): Float32Array {
        const catalogStore = CatalogStore.Instance;
        // dummy value to trigger update when the overlay positions are rebuilt, since profileStore.catalogData is not observable
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const plottedSourceCount = catalogStore.catalogCounts.get(this.catalogFileId);
        const catalogProfileStore = catalogStore.catalogProfileStores.get(this.catalogFileId);
        if (!isDisabled && catalogProfileStore) {
            const data = catalogProfileStore.get1DPlotData(column).wcsData;
            return data ? Float32Array.from(data) : new Float32Array(0);
        }
        return new Float32Array(0);
    }

    /**
     * Orientation data for catalog sources
     */
    @computed get orientationMapData(): Float32Array {
        return this.getMapColumnData(this.orientationMapColumn, this.isOrientationMapDisabled);
    }

    orientationArray(): Float32Array {
        const column = this.orientationMapData;
        if (!this.isOrientationMapDisabled && column?.length && this.orientationMin.clipd !== undefined && this.orientationMax.clipd !== undefined) {
            return CARTACompute.CalculateCatalogOrientation(
                column,
                this.orientationMin.clipd,
                this.orientationMax.clipd,
                this.angleMin,
                this.angleMax,
                this.orientationScalingType,
                this.orientationScalingParameter,
                this.orientationScalingParameter
            );
        }
        return new Float32Array(0);
    }

    /**
     * Color data for catalog sources
     */
    @computed get colorMapData(): Float32Array {
        return this.getMapColumnData(this.colorMapColumn, this.isColorMapDisabled);
    }

    colorArray(): Float32Array {
        const column = this.colorMapData;
        if (!this.isColorMapDisabled && column?.length && this.colorColumnMin.clipd !== undefined && this.colorColumnMax.clipd !== undefined) {
            return CARTACompute.CalculateCatalogColor(column, this.isInvertedColorMap, this.colorColumnMin.clipd, this.colorColumnMax.clipd, this.colorScalingType, this.colorScalingParameter, this.colorScalingParameter);
        }
        return new Float32Array(0);
    }

    /**
     * Size data for catalog sources
     */
    @computed get sizeMapData(): Float32Array {
        return this.getMapColumnData(this.sizeMapColumn, this.isSizeMapDisabled);
    }

    /**
     * Minor size data for catalog sources
     */
    @computed get sizeMinorMapData(): Float32Array {
        return this.getMapColumnData(this.sizeMinorMapColumn, this.isSizeMinorMapDisabled);
    }

    /**
     * The pixel size factor if plotting angular size (factor-to-arcsec / arcsec)
     */
    @computed get pixelSizeFactor(): number {
        if (!this.isAngularSize) {
            return 1;
        } else {
            const catalogStore = CatalogStore.Instance;
            const frame = catalogStore.frameOf(this.catalogFileId);
            const pixelAngularSize = (frame?.spatialReference?.pixelUnitSizeArcsec && frame?.spatialReference?.pixelUnitSizeArcsec.x) ?? (frame?.pixelUnitSizeArcsec && frame?.pixelUnitSizeArcsec.x) ?? 1;
            const sizeUnit = this.catalogDisplayMode === CatalogDisplayMode.WORLD ? this.worldSizeUnit : this.canvasSizeUnit;
            const radiusFactor = this.catalogDisplayMode === CatalogDisplayMode.WORLD ? (this.catalogSourceRadiusTypes.get(this.catalogSourceRadiusType)?.value ?? 1) : 1;
            return ((FACTOR_TO_ARCSEC.get(sizeUnit as AngularSizeUnit) ?? 1) / pixelAngularSize) * radiusFactor;
        }
    }

    sizeArray(): Float32Array {
        const column = this.sizeMapData;
        if (!this.isSizeMapDisabled && column?.length && this.sizeColumnMin.clipd !== undefined && this.sizeColumnMax.clipd !== undefined) {
            const pointSize = this.pointSizebyType;
            const min = (this.isImagePixelSize ? 0 : this.isSizeAreaMode ? this.shapeSettings?.areaBase : this.shapeSettings?.diameterBase) ?? NaN;
            const sizeMapType = this.catalogDisplayMode === CatalogDisplayMode.WORLD ? CatalogMapType.SIZE_DIAMETER_ANGULAR : this.isSizeAreaMode ? CatalogMapType.SIZE_AREA : CatalogMapType.SIZE_DIAMETER;

            return CARTACompute.CalculateCatalogSize(
                column,
                this.sizeColumnMin.clipd,
                this.sizeColumnMax.clipd,
                pointSize.min + min,
                pointSize.max + min,
                this.sizeScalingType,
                sizeMapType,
                this.pixelSizeFactor,
                this.sizeScalingParameter,
                this.sizeScalingParameter
            );
        }
        return new Float32Array(0);
    }

    sizeMinorArray(): Float32Array {
        const column = this.sizeMinorMapData;
        if (!this.isSizeMinorMapDisabled && column?.length && this.sizeMinorColumnMin.clipd !== undefined && this.sizeMinorColumnMax.clipd !== undefined) {
            const pointSize = this.minorPointSizebyType;
            const min = (this.isImagePixelSize ? 0 : this.isSizeAreaMode ? this.shapeSettings?.areaBase : this.shapeSettings?.diameterBase) ?? NaN;
            const sizeMapType = this.catalogDisplayMode === CatalogDisplayMode.WORLD ? CatalogMapType.SIZE_DIAMETER_ANGULAR : this.isSizeMinorAreaMode ? CatalogMapType.SIZE_AREA : CatalogMapType.SIZE_DIAMETER;

            return CARTACompute.CalculateCatalogSize(
                column,
                this.sizeMinorColumnMin.clipd,
                this.sizeMinorColumnMax.clipd,
                pointSize.min + min,
                pointSize.max + min,
                this.sizeMinorScalingType,
                sizeMapType,
                this.pixelSizeFactor,
                this.sizeMinorScalingParameter,
                this.sizeMinorScalingParameter
            );
        }
        return new Float32Array(0);
    }

    @computed get isSizeMapDisabled(): boolean {
        return this.sizeMapColumn === CatalogOverlay.NONE;
    }

    /**
     * Whether the sources have a size to be drawn at. An angular size is the size the source has on
     * the sky, which only the mapped column states, so without one there is nothing to draw.
     */
    @computed get isSourceSizeDefined(): boolean {
        return this.catalogDisplayMode !== CatalogDisplayMode.WORLD || !this.isSizeMapDisabled;
    }

    @computed get isSizeMinorMapDisabled(): boolean {
        return this.sizeMinorMapColumn === CatalogOverlay.NONE;
    }

    @computed get isSizeMinorTabEnabled(): boolean {
        return this.sizeMapColumn !== CatalogOverlay.NONE && this.catalogShape === CatalogOverlayShape.ELLIPSE_LINED;
    }

    @computed get maxPointSizebyType(): number {
        let isAreaMode = this.isSizeAreaMode;
        if (this.sizeAxisTabId === CatalogSettingsTabs.SIZE_MINOR) {
            isAreaMode = this.isSizeMinorAreaMode;
        }
        if (isAreaMode) {
            return CatalogDisplayStore.MAX_AREA_SIZE;
        } else {
            return this.maxOverlaySize;
        }
    }

    @computed get pointSizebyType(): {min: number; max: number} {
        if (this.isSizeAreaMode) {
            return {min: this.sizeMin.area, max: this.sizeMax.area};
        } else {
            return {min: this.sizeMin.diameter, max: this.sizeMax.diameter};
        }
    }

    @computed get minorPointSizebyType(): {min: number; max: number} {
        if (this.isSizeMinorAreaMode) {
            return {min: this.sizeMinorMin.area, max: this.sizeMinorMax.area};
        } else {
            return {min: this.sizeMinorMin.diameter, max: this.sizeMinorMax.diameter};
        }
    }

    @computed get isSizeMajor(): boolean {
        return this.sizeAxisTabId === CatalogSettingsTabs.SIZE_MAJOR;
    }

    @computed get isColorMapDisabled(): boolean {
        return this.colorMapColumn === CatalogOverlay.NONE;
    }

    @computed get isOrientationMapDisabled(): boolean {
        return this.orientationMapColumn === CatalogOverlay.NONE;
    }

    @computed get shapeSettings(): {featherWidth: number | undefined; diameterBase: number; areaBase: number; thicknessBase: number | undefined} | undefined {
        const pointSize = this.isSizeMajor ? this.pointSizebyType : this.minorPointSizebyType;
        const config = this.overlayShapeSettings.get(this.catalogShape);
        if (pointSize.min === 0) {
            return {featherWidth: config?.featherWidth, diameterBase: 0, areaBase: 0, thicknessBase: config?.thicknessBase};
        }
        return config;
    }

    /**
     * Apply a complete display config. The assignment order is deliberate and load bearing:
     *
     * 1. display mode and size units, because the allowed source size depends on both
     * 2. mapped columns, whose change resets the clipped bounds of their own group
     * 3. scaling, sizes and the clipped bounds themselves
     * 4. the column locks last, so that restoring the minor axis is not overwritten by the major
     * Data-derived values and widget presentation state are not part of a config and are left alone.
     */
    @action applyConfig = (config: WorkspaceCatalogConfig | undefined | null): CatalogConfigApplyResult => {
        const profileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
        if (!profileStore) {
            return {success: false, errors: ["The catalog data has not been loaded"]};
        }
        if (profileStore.isLoadingOntoImage) {
            return {success: false, errors: ["The catalog data is still loading"]};
        }

        const sizeAxis = normalizeSizeAxis(config?.sizeAxis);
        const rawSizeMinorAxis = normalizeSizeAxis(config?.sizeMinorAxis);
        const canLockSizeBounds = sizeAxis.mapColumn !== CatalogOverlay.NONE && rawSizeMinorAxis.mapColumn !== CatalogOverlay.NONE;
        const sizeMinorAxis = {
            ...rawSizeMinorAxis,
            mapColumn: sizeAxis.mapColumn === CatalogOverlay.NONE ? CatalogOverlay.NONE : rawSizeMinorAxis.mapColumn,
            // A major lock makes the major clip the source of truth for that bound. Do not retain
            // a contradictory minor clip that could be restored after the lock reaction runs.
            columnMinClip: canLockSizeBounds && sizeAxis.columnMinLocked ? sizeAxis.columnMinClip : rawSizeMinorAxis.columnMinClip,
            columnMaxClip: canLockSizeBounds && sizeAxis.columnMaxLocked ? sizeAxis.columnMaxClip : rawSizeMinorAxis.columnMaxClip,
            columnMinLocked: canLockSizeBounds && rawSizeMinorAxis.columnMinLocked,
            columnMaxLocked: canLockSizeBounds && rawSizeMinorAxis.columnMaxLocked
        };
        const colorAxis = normalizeColorAxis(config?.colorAxis);
        const orientationAxis = normalizeOrientationAxis(config?.orientationAxis);

        // A mapped column must have data loaded before its range can be derived. The image overlay
        // dereferences its x and y columns' headers directly, so a config naming a column this
        // catalog does not have, or one that cannot hold a coordinate, is rejected rather than left
        // to fail when the overlay is drawn; its data alone need not have arrived yet, because the
        // overlay is plotted from whatever streams in later.
        const columnsToValidate: ReadonlyArray<[axis: string, column: string, role: ColumnRole]> = [
            ["size", sizeAxis.mapColumn, "mapped"],
            ["minor size", sizeMinorAxis.mapColumn, "mapped"],
            ["color", colorAxis.mapColumn, "mapped"],
            ["orientation", orientationAxis.mapColumn, "mapped"],
            ["x", typeof config?.xAxis === "string" ? config.xAxis : CatalogOverlay.NONE, "coordinate"],
            ["y", typeof config?.yAxis === "string" ? config.yAxis : CatalogOverlay.NONE, "coordinate"]
        ];
        const errors = columnsToValidate
            .filter(([, column]) => column !== CatalogOverlay.NONE)
            .map(([axis, column, role]) => getColumnError(profileStore, axis, column, role))
            .filter((error): error is string => error !== undefined);

        if (errors.length) {
            return {success: false, errors};
        }

        this.columnRangeCache.clear();
        const catalogDisplayMode = enumValueOrDefault(config?.displayMode, Object.values(CatalogDisplayMode), CatalogDisplayMode.CANVAS);
        const canvasSizeUnit = enumValueOrDefault(config?.canvasSizeUnit, Object.values(CatalogSizeUnits), CatalogSizeUnits.SCREENPIXEL);
        const worldSizeUnit = enumValueOrDefault(config?.worldSizeUnit, Object.values(AngularSizeUnit), AngularSizeUnit.ARCSEC);
        const catalogPlotType = enumValueOrDefault(config?.plotType, Object.values(CatalogPlotType), CatalogPlotType.ImageOverlay);
        const catalogShape = enumValueOrDefault(config?.shape, CATALOG_OVERLAY_SHAPE_VALUES, CatalogOverlayShape.CIRCLE_LINED);
        this.setCanvasSizeUnit(canvasSizeUnit);
        this.setWorldSizeUnit(worldSizeUnit);
        this.setCatalogDisplayMode(catalogDisplayMode);
        // Restored before the size below, which is scaled by the radius type through pixelSizeFactor.
        const sourceRadiusType = config?.sourceRadiusType;
        this.catalogSourceRadiusType = sourceRadiusType && this.catalogSourceRadiusTypes.has(sourceRadiusType) ? sourceRadiusType : "diameter";

        this.setCatalogPlotType(catalogPlotType);
        this.setCatalogColor(typeof config?.color === "string" ? config.color : Colors.TURQUOISE3);
        this.setHighlightColor(typeof config?.highlightColor === "string" ? config.highlightColor : Colors.RED2);
        this.setCatalogShape(catalogShape);
        this.setThickness(clamp(finiteNumberOrDefault(config?.thickness, 2.0), CatalogDisplayStore.MIN_THICKNESS, CatalogDisplayStore.MAX_THICKNESS));
        this.setxAxis(typeof config?.xAxis === "string" ? config.xAxis : CatalogOverlay.NONE);
        this.setyAxis(typeof config?.yAxis === "string" ? config.yAxis : CatalogOverlay.NONE);
        const showedCatalogSize = clamp(finiteNumberOrDefault(config?.size, 10.0), this.minOverlaySize, this.maxOverlaySize);
        this.setCatalogSize(showedCatalogSize);

        const sizeBounds = normalizeSizeBounds(sizeAxis, this.minOverlaySize, this.maxOverlaySize);
        sizeAxis.min = sizeBounds.min;
        sizeAxis.max = sizeBounds.max;
        const sizeMinorBounds = normalizeSizeBounds(sizeMinorAxis, this.minOverlaySize, this.maxOverlaySize);
        sizeMinorAxis.min = sizeMinorBounds.min;
        sizeMinorAxis.max = sizeMinorBounds.max;

        const hasSizeColumnChanged = this.sizeMapColumn !== sizeAxis.mapColumn;
        const hasSizeMinorColumnChanged = this.sizeMinorMapColumn !== sizeMinorAxis.mapColumn;
        const hasColorColumnChanged = this.colorMapColumn !== colorAxis.mapColumn;
        const hasOrientationColumnChanged = this.orientationMapColumn !== orientationAxis.mapColumn;

        this.isSizeAreaMode = sizeAxis.areaMode;
        this.isSizeMinorAreaMode = sizeMinorAxis.mapColumn === CatalogOverlay.NONE ? false : sizeMinorAxis.areaMode;
        this.setSizeMap(sizeAxis.mapColumn);
        this.setSizeMinorMap(sizeMinorAxis.mapColumn);
        this.setColorMapColumn(colorAxis.mapColumn);
        this.setOrientationMapColumn(orientationAxis.mapColumn);

        this.sizeScalingType = sizeAxis.scalingType;
        this.sizeScalingParameters = sizeAxis.scalingParameters;
        this.sizeMin = sizeAxis.min;
        this.sizeMax = sizeAxis.max;

        this.sizeMinorScalingType = sizeMinorAxis.scalingType;
        this.sizeMinorScalingParameters = sizeMinorAxis.scalingParameters;
        this.sizeMinorMin = sizeMinorAxis.min;
        this.sizeMinorMax = sizeMinorAxis.max;

        this.setColorMap(colorAxis.colorMap);
        this.isInvertedColorMap = colorAxis.inverted;
        this.colorScalingType = colorAxis.scalingType;
        this.colorScalingParameters = colorAxis.scalingParameters;

        this.orientationScalingType = orientationAxis.scalingType;
        this.orientationScalingParameters = orientationAxis.scalingParameters;
        this.angleMin = orientationAxis.angleMin;
        this.angleMax = orientationAxis.angleMax;

        this.setClip("sizeMajor", this.resolveClip(profileStore, sizeAxis), hasSizeColumnChanged && configDefinesClip(sizeAxis));
        this.setClip("sizeMinor", this.resolveClip(profileStore, sizeMinorAxis), hasSizeMinorColumnChanged && configDefinesClip(sizeMinorAxis));
        this.setClip("color", this.resolveClip(profileStore, colorAxis), hasColorColumnChanged && configDefinesClip(colorAxis));
        this.setClip("orientation", this.resolveClip(profileStore, orientationAxis), hasOrientationColumnChanged && configDefinesClip(orientationAxis));

        this.isSizeColumnMinLocked = canLockSizeBounds && sizeAxis.columnMinLocked;
        this.isSizeColumnMaxLocked = canLockSizeBounds && sizeAxis.columnMaxLocked;
        this.isSizeMinorColumnMinLocked = sizeMinorAxis.columnMinLocked;
        this.isSizeMinorColumnMaxLocked = sizeMinorAxis.columnMaxLocked;
        this.propagateLockedSizeBounds();

        // The axes are what the Workspace was saved with, None included; choosing them again would
        // replace them.
        this.setAutoSelectImageOverlayAxesAttempted(true);

        return {success: true, errors: []};
    };

    private clearPendingRestoreState() {
        this.pendingClipRestore.clear();
    }

    private propagateLockedSizeBounds() {
        if (this.isSizeColumnMinLocked) {
            this.sizeMinorColumnMin.clipd = this.sizeColumnMin.clipd;
            this.sizeMinorColumnMin.isExplicit = this.sizeColumnMin.isExplicit;
        }
        if (this.isSizeColumnMaxLocked) {
            this.sizeMinorColumnMax.clipd = this.sizeColumnMax.clipd;
            this.sizeMinorColumnMax.isExplicit = this.sizeColumnMax.isExplicit;
        }
    }

    public toConfig = (): WorkspaceCatalogConfig => {
        return {
            color: this.catalogColor,
            highlightColor: this.highlightColor,
            shape: this.catalogShape,
            size: this.showedCatalogSize,
            thickness: this.thickness,
            displayMode: this.catalogDisplayMode,
            canvasSizeUnit: this.canvasSizeUnit,
            worldSizeUnit: this.worldSizeUnit,
            sourceRadiusType: this.catalogSourceRadiusType,
            plotType: this.catalogPlotType,
            xAxis: this.xAxis,
            yAxis: this.yAxis,
            imageOverlay:
                this.hasPlottedImageOverlay && this.plottedImageOverlaySystem !== undefined
                    ? {
                          xAxis: this.plottedImageOverlayXAxis,
                          yAxis: this.plottedImageOverlayYAxis,
                          system: this.plottedImageOverlaySystem,
                          maxRows: this.plottedImageOverlayMaxRows
                      }
                    : undefined,
            sizeAxis: {
                mapColumn: this.sizeMapColumn,
                columnMinClip: authoredClip(this.sizeColumnMin),
                columnMaxClip: authoredClip(this.sizeColumnMax),
                min: {...this.sizeMin},
                max: {...this.sizeMax},
                areaMode: this.isSizeAreaMode,
                scalingType: this.sizeScalingType,
                scalingParameters: scalingParametersToConfig(this.sizeScalingParameters),
                columnMinLocked: this.isSizeColumnMinLocked,
                columnMaxLocked: this.isSizeColumnMaxLocked
            },
            sizeMinorAxis: {
                mapColumn: this.sizeMinorMapColumn,
                columnMinClip: authoredClip(this.sizeMinorColumnMin),
                columnMaxClip: authoredClip(this.sizeMinorColumnMax),
                min: {...this.sizeMinorMin},
                max: {...this.sizeMinorMax},
                areaMode: this.isSizeMinorAreaMode,
                scalingType: this.sizeMinorScalingType,
                scalingParameters: scalingParametersToConfig(this.sizeMinorScalingParameters),
                columnMinLocked: this.isSizeMinorColumnMinLocked,
                columnMaxLocked: this.isSizeMinorColumnMaxLocked
            },
            colorAxis: {
                mapColumn: this.colorMapColumn,
                columnMinClip: authoredClip(this.colorColumnMin),
                columnMaxClip: authoredClip(this.colorColumnMax),
                colorMap: this.colorMap,
                inverted: this.isInvertedColorMap,
                scalingType: this.colorScalingType,
                scalingParameters: scalingParametersToConfig(this.colorScalingParameters)
            },
            orientationAxis: {
                mapColumn: this.orientationMapColumn,
                columnMinClip: authoredClip(this.orientationMin),
                columnMaxClip: authoredClip(this.orientationMax),
                angleMin: this.angleMin,
                angleMax: this.angleMax,
                scalingType: this.orientationScalingType,
                scalingParameters: scalingParametersToConfig(this.orientationScalingParameters)
            }
        };
    };

    /**
     * The clipped bounds a config asks for. A mapped column with no stated bounds is clipped to the
     * full range of its data, so that the result depends on the config and the data alone, rather
     * than on whether a reaction happened to fill the bounds in.
     */
    private resolveClip(profileStore: CatalogProfileStore | CatalogOnlineQueryProfileStore, axis: NormalizedAxis): ClipRestore {
        if (axis.mapColumn === CatalogOverlay.NONE) {
            return {min: {value: undefined, isExplicit: false}, max: {value: undefined, isExplicit: false}};
        }
        if (axis.columnMinClip !== undefined && axis.columnMaxClip !== undefined) {
            return {min: {value: axis.columnMinClip, isExplicit: true}, max: {value: axis.columnMaxClip, isExplicit: true}};
        }

        const range = this.columnRange(profileStore, axis.mapColumn);
        return {
            min: {value: axis.columnMinClip ?? range.min, isExplicit: axis.columnMinClip !== undefined},
            max: {value: axis.columnMaxClip ?? range.max, isExplicit: axis.columnMaxClip !== undefined}
        };
    }

    /**
     * The range of the rows of one column loaded so far. The column is read the same way
     * {@link sizeMapData} and its siblings read it, so that a bound derived here and one derived by
     * the reaction on those is the same number, and a bound that still follows the data stays
     * recognisable as one.
     */
    private columnRange(profileStore: CatalogProfileStore | CatalogOnlineQueryProfileStore, column: string, dataState = this.catalogDataState(profileStore)): {min: number; max: number} {
        const data = profileStore.catalogControlHeader.has(column) ? profileStore.get1DPlotData(column).wcsData : undefined;
        const visibleRows = Math.min(data?.length ?? 0, profileStore.numVisibleRows);
        const cached = this.columnRangeCache.get(column);
        const canExtend = cached?.profileStore === profileStore && cached.dataState === dataState && cached.rowsScanned <= visibleRows && (cached.rowsScanned < visibleRows || cached.data === data);
        let min = canExtend ? cached.min : Number.MAX_VALUE;
        let max = canExtend ? cached.max : -Number.MAX_VALUE;
        let hasValue = canExtend ? cached.hasValue : false;
        const firstRow = canExtend ? cached.rowsScanned : 0;
        for (let i = firstRow; i < visibleRows; i++) {
            const value = Math.fround(data?.[i] ?? NaN);
            if (!isNaN(value)) {
                min = Math.min(min, value);
                max = Math.max(max, value);
                hasValue = true;
            }
        }
        this.columnRangeCache.set(column, {profileStore, data, rowsScanned: visibleRows, min, max, hasValue, dataState});
        return {
            min: hasValue && isFinite(min) ? min : 0,
            max: hasValue && isFinite(max) ? max : 0
        };
    }

    private catalogDataState(profileStore: CatalogProfileStore | CatalogOnlineQueryProfileStore): string {
        const sortingInfo = profileStore.sortingInfo;
        return JSON.stringify([sortingInfo.columnName, sortingInfo.sortingType, Array.from(profileStore.catalogControlHeader.entries(), ([name, header]) => [name, header.filter, header.display])]);
    }

    /**
     * Widen the data-derived bounds of every mapped column to the rows loaded so far. A bound the
     * user has clipped away from its default is theirs to keep, so only its default follows the
     * data; the rest are moved with it.
     */
    @action private refreshDataDerivedClips() {
        const profileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
        if (!profileStore) {
            return;
        }
        const hasDataDerivedClip = (group: ClipGroup) => {
            const {column} = this.clipGroupState(group);
            return column !== CatalogOverlay.NONE && !this.pendingClipRestore.has(group);
        };
        if (!hasDataDerivedClip("sizeMajor") && !hasDataDerivedClip("sizeMinor") && !hasDataDerivedClip("color") && !hasDataDerivedClip("orientation")) {
            return;
        }
        const dataState = this.catalogDataState(profileStore);
        this.refreshDataDerivedClip(profileStore, "sizeMajor", dataState);
        // A locked minor bound follows the major axis rather than its own column.
        this.refreshDataDerivedClip(profileStore, "sizeMinor", dataState, this.isSizeColumnMinLocked, this.isSizeColumnMaxLocked);
        this.refreshDataDerivedClip(profileStore, "color", dataState);
        this.refreshDataDerivedClip(profileStore, "orientation", dataState);
    }

    private refreshDataDerivedClip(profileStore: CatalogProfileStore | CatalogOnlineQueryProfileStore, group: ClipGroup, dataState: string, isMinLocked: boolean = false, isMaxLocked: boolean = false) {
        const {column, min, max} = this.clipGroupState(group);
        // A clip a config authored is restored by the reaction that is still to run; leave it to it.
        if (column === CatalogOverlay.NONE || this.pendingClipRestore.has(group)) {
            return;
        }

        const range = this.columnRange(profileStore, column, dataState);
        if (!isMinLocked && !min.isExplicit) {
            min.clipd = range.min;
        }
        min.default = range.min;
        if (!isMaxLocked && !max.isExplicit) {
            max.clipd = range.max;
        }
        max.default = range.max;
    }

    /**
     * Set the clipped bounds of one mapped column. Bounds a config authored are also held while the
     * column's data-derived defaults recompute, so that the recompute does not overwrite them.
     */
    private setClip(group: ClipGroup, clip: ClipRestore, shouldHoldForRecompute: boolean) {
        this.applyClip(group, clip);
        if (shouldHoldForRecompute) {
            this.pendingClipRestore.set(group, clip);
        } else {
            this.pendingClipRestore.delete(group);
        }
    }

    @action private restorePendingClip(group: ClipGroup) {
        const pending = this.pendingClipRestore.get(group);
        if (!pending) {
            return;
        }
        this.pendingClipRestore.delete(group);
        this.applyClip(group, pending);
    }

    private applyClip(group: ClipGroup, clip: ClipRestore) {
        const {min, max} = this.clipGroupState(group);
        min.clipd = clip.min.value;
        min.isExplicit = clip.min.isExplicit;
        max.clipd = clip.max.value;
        max.isExplicit = clip.max.isExplicit;
    }

    /** The mapped column of one clip group, together with the two bounds that follow it. */
    private clipGroupState(group: ClipGroup): {column: string; min: ClipBound; max: ClipBound} {
        switch (group) {
            case "sizeMajor":
                return {column: this.sizeMapColumn, min: this.sizeColumnMin, max: this.sizeColumnMax};
            case "sizeMinor":
                return {column: this.sizeMinorMapColumn, min: this.sizeMinorColumnMin, max: this.sizeMinorColumnMax};
            case "color":
                return {column: this.colorMapColumn, min: this.colorColumnMin, max: this.colorColumnMax};
            case "orientation":
                return {column: this.orientationMapColumn, min: this.orientationMin, max: this.orientationMax};
        }
    }
}
