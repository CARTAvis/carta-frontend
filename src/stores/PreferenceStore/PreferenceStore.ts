import {Colors} from "@blueprintjs/core";
import Ajv from "ajv";
import {CARTA} from "carta-protobuf";
import * as _ from "lodash";
import {action, computed, flow, makeObservable, observable} from "mobx";

import {
    BeamType,
    ColorMap,
    ContourGeneratorType,
    CursorInfoVisibility,
    FileFilteringType,
    FileFilterMode,
    FrameScaling,
    ImagePanelMode,
    PasteOffsetUnit,
    PreferenceKeys,
    RestFrameShiftMode,
    SpectralType,
    TelemetryMode,
    VelocityConvention,
    WCSMatchingType
} from "enums";
import {CARTA_INFO, CompressionQuality, CursorPosition, Event, getEventList, PresetLayout, RegionCreationMode, Theme, TileCache, WCSMatching, WCSType, Zoom, ZoomPoint} from "models";
import {ApiService} from "services";
import {getScalingForParameterPreference, getScalingParameterConfig, isSupportedFrameScaling, sanitizeScalingParameter} from "utilities/scaling/scaling";

import {SESSION_PREFERENCES} from "./SessionPreferences";

const PREFERENCES_SCHEMA = require("carta-schemas/preferences_schema_2.json");

const PreferencesValidator = new Ajv({strictTypes: false}).compile(PREFERENCES_SCHEMA);

/** A preference that a workspace restore applied for the session, with a value other than the user's own. */
export interface SessionPreferenceChange {
    key: PreferenceKeys;
    /** The value that the workspace saved, which the session uses. */
    value: unknown;
    /** The value that the user's preferences give. */
    ownValue: unknown;
}

const DEFAULTS = {
    SILENT: {
        fileSortingString: "-date",
        fileFilteringType: FileFilteringType.Fuzzy,
        pixelGridVisible: false,
        pixelGridColor: "#ffffff",
        imageMultiPanelEnabled: true,
        imagePanelMode: ImagePanelMode.Dynamic,
        imagePanelColumns: 2,
        imagePanelRows: 2,
        checkNewRelease: true,
        latestRelease: "v" + CARTA_INFO.version,
        pvAxesOrderReverse: false,
        imageViewRestFrameShiftMode: RestFrameShiftMode.RADIAL_VELOCITY,
        imageViewRestFrameVelocityConvention: VelocityConvention.RADIO,
        spectralProfilerRestFrameShiftMode: RestFrameShiftMode.RADIAL_VELOCITY,
        spectralProfilerRestFrameVelocityConvention: VelocityConvention.RADIO
    },
    GLOBAL: {
        theme: Theme.AUTO,
        autoLaunch: true,
        fileFilterMode: FileFilterMode.Content,
        cursorPosition: CursorPosition.TRACKING,
        zoomMode: Zoom.FIT,
        zoomPoint: ZoomPoint.CURSOR,
        dragPanning: true,
        spectralMatchingType: SpectralType.VRAD,
        autoWCSMatching: WCSMatchingType.NONE,
        transparentImageBackground: false,
        codeSnippetsEnabled: false,
        keepLastUsedFolder: false,
        lastUsedFolder: ""
    },
    RENDER_CONFIG: {
        scaling: FrameScaling.LINEAR,
        colormap: ColorMap.Inferno,
        colormapInverted: false,
        colormapHex: "#FFFFFF",
        colormapHexStart: "#000000",
        percentile: 99.9,
        nanColorHex: "#137CBD",
        useSmoothedBiasContrast: true
    },
    CONTOUR_CONFIG: {
        contourGeneratorType: ContourGeneratorType.StartStepMultiplier,
        contourSmoothingMode: CARTA.SmoothingMode.GaussianBlur,
        contourSmoothingFactor: 4,
        contourNumLevels: 5,
        contourThickness: 1,
        contourColormapEnabled: false,
        contourColormapInverted: false,
        contourColor: Colors.GREEN3,
        contourColormap: ColorMap.Viridis
    },
    VECTOR_OVERLAY: {
        vectorOverlayPixelAveraging: 4,
        vectorOverlayFractionalIntensity: false,
        vectorOverlayThickness: 1,
        vectorOverlayColormapEnabled: false,
        vectorOverlayColormapInverted: false,
        vectorOverlayColor: Colors.GREEN3,
        vectorOverlayColormap: ColorMap.Viridis
    },
    WCS_OVERLAY: {
        astColor: "auto-blue",
        astGridVisible: false,
        astLabelsVisible: true,
        wcsType: WCSType.AUTOMATIC,
        colorbarVisible: true,
        colorbarInteractive: true,
        colorbarPosition: "right",
        colorbarWidth: 15,
        colorbarTicksDensity: 1,
        colorbarLabelVisible: false,
        beamVisible: true,
        beamColor: "auto-gray",
        beamType: BeamType.Open,
        beamWidth: 1,
        cursorInfoVisible: CursorInfoVisibility.ActiveImage
    },
    LAYOUT: {
        layout: PresetLayout.DEFAULT,
        dynamicLayoutEnable: false,
        isHighDimPriority: true,
        existLayoutMapping: {}
    },
    REGION: {
        regionColor: "#2ee6d6",
        regionLineWidth: 2,
        regionDashLength: 0,
        regionType: CARTA.RegionType.RECTANGLE,
        regionCreationMode: RegionCreationMode.CENTER,
        regionSize: 30,
        regionPasteOffsetUnit: PasteOffsetUnit.Auto
    },
    ANNOTATION: {
        annotationColor: "#ffba01",
        annotationLineWidth: 2,
        annotationDashLength: 0,
        annotationType: CARTA.RegionType.ANNRECTANGLE,
        pointAnnotationShape: CARTA.PointAnnotationShape.SQUARE,
        pointAnnotationWidth: 6,
        textAnnotationLineWidth: 1
    },
    PERFORMANCE: {
        imageCompressionQuality: CompressionQuality.IMAGE_DEFAULT,
        animationCompressionQuality: CompressionQuality.ANIMATION_DEFAULT,
        GPUTileCache: TileCache.GPU_DEFAULT,
        systemTileCache: TileCache.SYSTEM_DEFAULT,
        contourDecimation: 4,
        contourCompressionLevel: 8,
        contourChunkSize: 100000,
        contourControlMapWidth: 256,
        streamContoursWhileZooming: false,
        lowBandwidthMode: false,
        stopAnimationPlaybackMinutes: 5,
        limitOverlayRedraw: true,
        pvPreviewCubeSizeLimit: 1
    },
    LOG_EVENT: {
        eventLoggingEnabled: []
    },
    CATALOG: {
        catalogDisplayedColumnSize: 10,
        catalogTableSeparatorPosition: "60%",
        catalogAutoSelectImageOverlayColumns: true
    },
    STATS_PANEL: {
        statsPanelEnabled: false,
        statsPanelMode: 0
    },
    TELEMETRY: {
        telemetryConsentShown: false,
        telemetryMode: TelemetryMode.Usage,
        telemetryLogging: false
    },
    COMPATIBILITY: {
        aipsBeamSupport: false
    }
};

/**
 * The store manages the preference setting
 */
export class PreferenceStore {
    private static staticInstance: PreferenceStore;

    public static get Instance() {
        if (!PreferenceStore.staticInstance) {
            PreferenceStore.staticInstance = new PreferenceStore();
        }
        return PreferenceStore.staticInstance;
    }

    @observable preferences: Map<PreferenceKeys, any> = new Map<PreferenceKeys, any>();

    /**
     * The values that a workspace restore applied for this session only, by key. Each value wins over
     * the stored preference, and the stored preferences do not change. When the user sets or resets a
     * preference, its session value is removed.
     */
    @observable sessionPreferences: Map<PreferenceKeys, unknown> = new Map<PreferenceKeys, unknown>();

    /** Returns the value in effect of a preference: the session value when there is one, otherwise the stored value. */
    private valueInEffect(key: PreferenceKeys): any {
        return this.sessionPreferences.has(key) ? this.sessionPreferences.get(key) : this.preferences.get(key);
    }

    /** Whether some preferences have a value for this session only. */
    @computed get hasSessionPreferences(): boolean {
        return this.sessionPreferences.size > 0;
    }

    /**
     * Applies the preferences that a workspace saved, for this session only, in place of the session
     * values that a previous workspace applied. A key that a workspace does not save, or a value that
     * the preference does not accept, is left out.
     *
     * @param values - the saved values by key. Undefined clears the session values, as for a workspace that saved none.
     * @returns the preferences whose session value differs from the user's own value, and the keys that were left out.
     */
    @action applySessionPreferences = (values: unknown): {changes: SessionPreferenceChange[]; rejectedKeys: string[]} => {
        this.sessionPreferences.clear();
        const changes: SessionPreferenceChange[] = [];
        const rejectedKeys: string[] = [];
        if (!values || typeof values !== "object" || Array.isArray(values)) {
            return {changes, rejectedKeys};
        }
        for (const [key, saved] of Object.entries(values)) {
            const preference = SESSION_PREFERENCES[key as PreferenceKeys];
            const value = this.sessionValueOf(key as PreferenceKeys, saved);
            if (!preference || value === undefined) {
                rejectedKeys.push(key);
                continue;
            }
            const ownValue = preference.valueOf(this);
            this.sessionPreferences.set(key as PreferenceKeys, value);
            if (!_.isEqual(ownValue, value)) {
                changes.push({key: key as PreferenceKeys, value, ownValue});
            }
        }
        return {changes, rejectedKeys};
    };

    /** Returns the value that a session can use for a saved value, or undefined when the preference does not accept it. */
    private sessionValueOf(key: PreferenceKeys, value: unknown): unknown {
        const preference = SESSION_PREFERENCES[key];
        if (!preference || value === undefined || (key in PREFERENCES_SCHEMA.properties && !PreferencesValidator({version: 2, [key]: value})) || preference.isValid?.(value) === false) {
            return undefined;
        }
        const scaling = getScalingForParameterPreference(key);
        return scaling !== undefined ? sanitizeScalingParameter(scaling, value as number) : value;
    }

    /** Removes every session value, so that the user's own preferences are in effect again. */
    @action clearSessionPreferences = () => {
        this.sessionPreferences.clear();
    };

    /**
     * Get the minimum constraint from the schema for a preference key
     */
    public getMinConstraint(key: PreferenceKeys): number | undefined {
        return PREFERENCES_SCHEMA.properties[key]?.minimum;
    }

    /**
     * Get the maximum constraint from the schema for a preference key
     */
    public getMaxConstraint(key: PreferenceKeys): number | undefined {
        return PREFERENCES_SCHEMA.properties[key]?.maximum;
    }

    /**
     * Whether the preference data is initialized from the preference file or localStorage.
     */
    @observable isPreferenceReady: boolean = false;

    // getters for global settings
    @computed get theme(): string {
        return this.valueInEffect(PreferenceKeys.GLOBAL_THEME) ?? DEFAULTS.GLOBAL.theme;
    }

    @computed get shouldAutoLaunch(): boolean {
        return this.valueInEffect(PreferenceKeys.GLOBAL_AUTOLAUNCH) ?? DEFAULTS.GLOBAL.autoLaunch;
    }

    @computed get fileFilterMode(): FileFilterMode {
        return this.valueInEffect(PreferenceKeys.GLOBAL_FILE_FILTER_MODE) ?? DEFAULTS.GLOBAL.fileFilterMode;
    }

    @computed get fileSortingString(): string {
        return this.valueInEffect(PreferenceKeys.SILENT_FILE_SORTING_STRING) ?? DEFAULTS.SILENT.fileSortingString;
    }

    @computed get fileFilteringType(): FileFilteringType {
        return this.valueInEffect(PreferenceKeys.SILENT_FILE_FILTERING_TYPE) ?? DEFAULTS.SILENT.fileFilteringType;
    }

    @computed get cursorPosition(): string {
        return this.valueInEffect(PreferenceKeys.GLOBAL_CURSOR_POSITION) ?? DEFAULTS.GLOBAL.cursorPosition;
    }

    @computed get zoomMode(): string {
        return this.valueInEffect(PreferenceKeys.GLOBAL_ZOOM_MODE) ?? DEFAULTS.GLOBAL.zoomMode;
    }

    @computed get zoomPoint(): string {
        return this.valueInEffect(PreferenceKeys.GLOBAL_ZOOM_POINT) ?? DEFAULTS.GLOBAL.zoomPoint;
    }

    @computed get isDragPanning(): boolean {
        return this.valueInEffect(PreferenceKeys.GLOBAL_DRAG_PANNING) ?? DEFAULTS.GLOBAL.dragPanning;
    }

    @computed get spectralMatchingType(): SpectralType {
        return this.valueInEffect(PreferenceKeys.GLOBAL_SPECTRAL_MATCHING_TYPE) ?? DEFAULTS.GLOBAL.spectralMatchingType;
    }

    @computed get autoWCSMatching(): WCSMatchingType {
        return this.valueInEffect(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING) ?? DEFAULTS.GLOBAL.autoWCSMatching;
    }

    @computed get imageViewRestFrameShiftMode(): RestFrameShiftMode {
        const mode = this.valueInEffect(PreferenceKeys.SILENT_IMAGE_VIEW_REST_FRAME_SHIFT_MODE);
        return Object.values(RestFrameShiftMode).includes(mode) ? mode : DEFAULTS.SILENT.imageViewRestFrameShiftMode;
    }

    @computed get imageViewRestFrameVelocityConvention(): VelocityConvention {
        const convention = this.valueInEffect(PreferenceKeys.SILENT_IMAGE_VIEW_REST_FRAME_VELOCITY_CONVENTION);
        return Object.values(VelocityConvention).includes(convention) ? convention : DEFAULTS.SILENT.imageViewRestFrameVelocityConvention;
    }

    @computed get spectralProfilerRestFrameShiftMode(): RestFrameShiftMode {
        const mode = this.valueInEffect(PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_SHIFT_MODE);
        return Object.values(RestFrameShiftMode).includes(mode) ? mode : DEFAULTS.SILENT.spectralProfilerRestFrameShiftMode;
    }

    @computed get spectralProfilerRestFrameVelocityConvention(): VelocityConvention {
        const convention = this.valueInEffect(PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_VELOCITY_CONVENTION);
        return Object.values(VelocityConvention).includes(convention) ? convention : DEFAULTS.SILENT.spectralProfilerRestFrameVelocityConvention;
    }

    public isWCSMatchingEnabled = (matchingType: WCSMatchingType): boolean => {
        if (WCSMatching.isTypeValid(matchingType) && matchingType & this.valueInEffect(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING)) {
            return true;
        }
        return false;
    };

    @computed get hasTransparentImageBackground(): boolean {
        return this.valueInEffect(PreferenceKeys.GLOBAL_TRANSPARENT_IMAGE_BACKGROUND) ?? DEFAULTS.GLOBAL.transparentImageBackground;
    }

    @computed get isCodeSnippetsEnabled(): boolean {
        return this.valueInEffect(PreferenceKeys.GLOBAL_CODE_SNIPPETS_ENABLED) ?? DEFAULTS.GLOBAL.codeSnippetsEnabled;
    }

    /**
     * Whether code snippets are on for this session only, while the preference is off. A workspace
     * restore turns this on when the workspace has the Snippet dialog open. A change of the
     * preference turns it off again.
     */
    @observable isCodeSnippetsEnabledForSession = false;

    @action setCodeSnippetsEnabledForSession = (isEnabled: boolean) => {
        this.isCodeSnippetsEnabledForSession = isEnabled;
    };

    /** Whether the menus offer code snippets: when the preference is on, or when they are on for this session. */
    @computed get areCodeSnippetsShown(): boolean {
        return this.isCodeSnippetsEnabled || this.isCodeSnippetsEnabledForSession;
    }

    @computed get shouldKeepLastUsedFolder(): boolean {
        return this.valueInEffect(PreferenceKeys.GLOBAL_KEEP_LAST_USED_FOLDER) ?? DEFAULTS.GLOBAL.keepLastUsedFolder;
    }

    @computed get lastUsedFolder(): string {
        return this.valueInEffect(PreferenceKeys.GLOBAL_SAVED_LAST_FOLDER) ?? DEFAULTS.GLOBAL.lastUsedFolder;
    }

    // getters for render config
    @computed get scaling(): FrameScaling {
        const scaling = this.valueInEffect(PreferenceKeys.RENDER_CONFIG_SCALING);
        return isSupportedFrameScaling(scaling) ? scaling : DEFAULTS.RENDER_CONFIG.scaling;
    }

    @computed get colormap(): string {
        return this.valueInEffect(PreferenceKeys.RENDER_CONFIG_COLORMAP) ?? DEFAULTS.RENDER_CONFIG.colormap;
    }

    @computed get isColormapInverted(): boolean {
        return this.valueInEffect(PreferenceKeys.RENDER_CONFIG_COLORMAP_INVERTED) ?? DEFAULTS.RENDER_CONFIG.colormapInverted;
    }

    @computed get colormapHex(): string {
        return this.valueInEffect(PreferenceKeys.RENDER_CONFIG_COLORMAP_HEX) ?? DEFAULTS.RENDER_CONFIG.colormapHex;
    }

    @computed get colormapHexStart(): string {
        return this.valueInEffect(PreferenceKeys.RENDER_CONFIG_COLORMAP_HEX_START) ?? DEFAULTS.RENDER_CONFIG.colormapHexStart;
    }

    @computed get percentile(): number {
        return this.valueInEffect(PreferenceKeys.RENDER_CONFIG_PERCENTILE) ?? DEFAULTS.RENDER_CONFIG.percentile;
    }

    @computed get scalingAlphaLog(): number {
        return this.getScalingParameter(FrameScaling.LOG);
    }

    @computed get scalingAlphaPower(): number {
        return this.getScalingParameter(FrameScaling.POWER);
    }

    @computed get scalingAlphaSinh(): number {
        return this.getScalingParameter(FrameScaling.SINH);
    }

    @computed get scalingAlphaAsinh(): number {
        return this.getScalingParameter(FrameScaling.ASINH);
    }

    @computed get scalingGamma(): number {
        return this.getScalingParameter(FrameScaling.GAMMA);
    }

    public getScalingParameter(scaling: FrameScaling): number {
        const config = getScalingParameterConfig(scaling);
        if (!config) {
            return 1;
        }

        const value = this.valueInEffect(config.preferenceKey);
        if (value !== undefined) {
            return value;
        }

        const legacyAlpha = this.valueInEffect(PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA_LEGACY);
        const isLegacyAlphaSupported = scaling === FrameScaling.LOG || scaling === FrameScaling.POWER;
        return isLegacyAlphaSupported && legacyAlpha !== undefined ? legacyAlpha : config.defaultValue;
    }

    @computed get nanColorHex(): string {
        return this.valueInEffect(PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX) ?? DEFAULTS.RENDER_CONFIG.nanColorHex;
    }

    @computed get shouldUseSmoothedBiasContrast(): boolean {
        return this.valueInEffect(PreferenceKeys.RENDER_CONFIG_USE_SMOOTHED_BIAS_CONTRAST) ?? DEFAULTS.RENDER_CONFIG.useSmoothedBiasContrast;
    }

    // getters for Contour Config
    @computed get contourGeneratorType(): ContourGeneratorType {
        return this.valueInEffect(PreferenceKeys.CONTOUR_CONFIG_GENERATOR_TYPE) ?? DEFAULTS.CONTOUR_CONFIG.contourGeneratorType;
    }

    @computed get isContourColormapEnabled(): boolean {
        return this.valueInEffect(PreferenceKeys.CONTOUR_CONFIG_COLORMAP_ENABLED) ?? DEFAULTS.CONTOUR_CONFIG.contourColormapEnabled;
    }

    @computed get isContourColormapInverted(): boolean {
        return this.valueInEffect(PreferenceKeys.CONTOUR_CONFIG_COLORMAP_INVERTED) ?? DEFAULTS.CONTOUR_CONFIG.contourColormapInverted;
    }

    @computed get contourColormap(): string {
        return this.valueInEffect(PreferenceKeys.CONTOUR_CONFIG_COLORMAP) ?? DEFAULTS.CONTOUR_CONFIG.contourColormap;
    }

    @computed get contourColor(): string {
        return this.valueInEffect(PreferenceKeys.CONTOUR_CONFIG_COLOR) ?? DEFAULTS.CONTOUR_CONFIG.contourColor;
    }

    @computed get contourSmoothingMode(): CARTA.SmoothingMode {
        return this.valueInEffect(PreferenceKeys.CONTOUR_CONFIG_SMOOTHING_MODE) ?? DEFAULTS.CONTOUR_CONFIG.contourSmoothingMode;
    }

    @computed get contourSmoothingFactor(): number {
        return this.valueInEffect(PreferenceKeys.CONTOUR_CONFIG_SMOOTHING_FACTOR) ?? DEFAULTS.CONTOUR_CONFIG.contourSmoothingFactor;
    }

    @computed get contourNumLevels(): number {
        return this.valueInEffect(PreferenceKeys.CONTOUR_CONFIG_NUM_LEVELS) ?? DEFAULTS.CONTOUR_CONFIG.contourNumLevels;
    }

    @computed get contourThickness(): number {
        return this.valueInEffect(PreferenceKeys.CONTOUR_CONFIG_THICKNESS) ?? DEFAULTS.CONTOUR_CONFIG.contourThickness;
    }

    @computed get contourDecimation(): number {
        return this.valueInEffect(PreferenceKeys.PERFORMANCE_CONTOUR_DECIMATION) ?? DEFAULTS.PERFORMANCE.contourDecimation;
    }

    @computed get contourCompressionLevel(): number {
        return this.valueInEffect(PreferenceKeys.PERFORMANCE_CONTOUR_COMPRESSION_LEVEL) ?? DEFAULTS.PERFORMANCE.contourCompressionLevel;
    }

    @computed get contourChunkSize(): number {
        return this.valueInEffect(PreferenceKeys.PERFORMANCE_CONTOUR_CHUNK_SIZE) ?? DEFAULTS.PERFORMANCE.contourChunkSize;
    }

    // getters for vector overlay
    @computed get vectorOverlayPixelAveraging(): number {
        return this.valueInEffect(PreferenceKeys.VECTOR_OVERLAY_PIXEL_AVERAGING) ?? DEFAULTS.VECTOR_OVERLAY.vectorOverlayPixelAveraging;
    }

    @computed get isVectorOverlayFractionalIntensity(): boolean {
        return this.valueInEffect(PreferenceKeys.VECTOR_OVERLAY_FRACTIONAL_INTENSITY) ?? DEFAULTS.VECTOR_OVERLAY.vectorOverlayFractionalIntensity;
    }

    @computed get vectorOverlayThickness(): number {
        return this.valueInEffect(PreferenceKeys.VECTOR_OVERLAY_THICKNESS) ?? DEFAULTS.VECTOR_OVERLAY.vectorOverlayThickness;
    }

    @computed get isVectorOverlayColormapEnabled(): boolean {
        return this.valueInEffect(PreferenceKeys.VECTOR_OVERLAY_COLORMAP_ENABLED) ?? DEFAULTS.VECTOR_OVERLAY.vectorOverlayColormapEnabled;
    }

    @computed get isVectorOverlayColormapInverted(): boolean {
        return this.valueInEffect(PreferenceKeys.VECTOR_OVERLAY_COLORMAP_INVERTED) ?? DEFAULTS.VECTOR_OVERLAY.vectorOverlayColormapInverted;
    }

    @computed get vectorOverlayColor(): string {
        return this.valueInEffect(PreferenceKeys.VECTOR_OVERLAY_COLOR) ?? DEFAULTS.VECTOR_OVERLAY.vectorOverlayColor;
    }

    @computed get vectorOverlayColormap(): string {
        return this.valueInEffect(PreferenceKeys.VECTOR_OVERLAY_COLORMAP) ?? DEFAULTS.VECTOR_OVERLAY.vectorOverlayColormap;
    }

    // getters for WCS overlay
    @computed get astColor(): string {
        return this.valueInEffect(PreferenceKeys.WCS_OVERLAY_AST_COLOR) ?? DEFAULTS.WCS_OVERLAY.astColor;
    }

    @computed get isAstGridVisible(): boolean {
        return this.valueInEffect(PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE) ?? DEFAULTS.WCS_OVERLAY.astGridVisible;
    }

    @computed get isAstLabelsVisible(): boolean {
        return this.valueInEffect(PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE) ?? DEFAULTS.WCS_OVERLAY.astLabelsVisible;
    }

    @computed get wcsType(): string {
        return this.valueInEffect(PreferenceKeys.WCS_OVERLAY_WCS_TYPE) ?? DEFAULTS.WCS_OVERLAY.wcsType;
    }

    @computed get isColorbarVisible(): boolean {
        return this.valueInEffect(PreferenceKeys.WCS_OVERLAY_COLORBAR_VISIBLE) ?? DEFAULTS.WCS_OVERLAY.colorbarVisible;
    }

    @computed get isColorbarInteractive(): boolean {
        return this.valueInEffect(PreferenceKeys.WCS_OVERLAY_COLORBAR_INTERACTIVE) ?? DEFAULTS.WCS_OVERLAY.colorbarInteractive;
    }

    @computed get colorbarPosition(): "right" | "top" | "bottom" {
        return this.valueInEffect(PreferenceKeys.WCS_OVERLAY_COLORBAR_POSITION) ?? DEFAULTS.WCS_OVERLAY.colorbarPosition;
    }

    @computed get colorbarWidth(): number {
        return this.valueInEffect(PreferenceKeys.WCS_OVERLAY_COLORBAR_WIDTH) ?? DEFAULTS.WCS_OVERLAY.colorbarWidth;
    }

    @computed get colorbarTicksDensity(): number {
        return this.valueInEffect(PreferenceKeys.WCS_OVERLAY_COLORBAR_TICKS_DENSITY) ?? DEFAULTS.WCS_OVERLAY.colorbarTicksDensity;
    }

    @computed get isColorbarLabelVisible(): boolean {
        return this.valueInEffect(PreferenceKeys.WCS_OVERLAY_COLORBAR_LABEL_VISIBLE) ?? DEFAULTS.WCS_OVERLAY.colorbarLabelVisible;
    }

    @computed get isBeamVisible(): boolean {
        return this.valueInEffect(PreferenceKeys.WCS_OVERLAY_BEAM_VISIBLE) ?? DEFAULTS.WCS_OVERLAY.beamVisible;
    }

    @computed get beamColor(): string {
        return this.valueInEffect(PreferenceKeys.WCS_OVERLAY_BEAM_COLOR) ?? DEFAULTS.WCS_OVERLAY.beamColor;
    }

    @computed get beamType(): BeamType {
        return this.valueInEffect(PreferenceKeys.WCS_OVERLAY_BEAM_TYPE) ?? DEFAULTS.WCS_OVERLAY.beamType;
    }

    @computed get beamWidth(): number {
        return this.valueInEffect(PreferenceKeys.WCS_OVERLAY_BEAM_WIDTH) ?? DEFAULTS.WCS_OVERLAY.beamWidth;
    }

    @computed get cursorInfoVisible(): string {
        return this.valueInEffect(PreferenceKeys.WCS_OVERLAY_CURSOR_INFO) ?? DEFAULTS.WCS_OVERLAY.cursorInfoVisible;
    }

    // getters for region
    @computed get regionColor(): string {
        return this.valueInEffect(PreferenceKeys.REGION_COLOR) ?? DEFAULTS.REGION.regionColor;
    }

    @computed get regionLineWidth(): number {
        return this.valueInEffect(PreferenceKeys.REGION_LINE_WIDTH) ?? DEFAULTS.REGION.regionLineWidth;
    }

    @computed get regionDashLength(): number {
        return this.valueInEffect(PreferenceKeys.REGION_DASH_LENGTH) ?? DEFAULTS.REGION.regionDashLength;
    }

    @computed get regionType(): CARTA.RegionType {
        return this.valueInEffect(PreferenceKeys.REGION_TYPE) ?? DEFAULTS.REGION.regionType;
    }

    @computed get regionCreationMode(): string {
        return this.valueInEffect(PreferenceKeys.REGION_CREATION_MODE) ?? DEFAULTS.REGION.regionCreationMode;
    }

    @computed get regionSize(): number {
        return this.valueInEffect(PreferenceKeys.REGION_SIZE) ?? DEFAULTS.REGION.regionSize;
    }

    @computed get regionPasteOffsetUnit(): PasteOffsetUnit {
        return this.valueInEffect(PreferenceKeys.REGION_PASTE_OFFSET_UNIT) ?? DEFAULTS.REGION.regionPasteOffsetUnit;
    }

    // getters for annotation
    @computed get annotationColor(): string {
        return this.valueInEffect(PreferenceKeys.ANNOTATION_COLOR) ?? DEFAULTS.ANNOTATION.annotationColor;
    }

    @computed get annotationLineWidth(): number {
        return this.valueInEffect(PreferenceKeys.ANNOTATION_LINE_WIDTH) ?? DEFAULTS.ANNOTATION.annotationLineWidth;
    }

    @computed get annotationDashLength(): number {
        return this.valueInEffect(PreferenceKeys.ANNOTATION_DASH_LENGTH) ?? DEFAULTS.ANNOTATION.annotationDashLength;
    }

    @computed get pointAnnotationShape(): CARTA.PointAnnotationShape {
        return this.valueInEffect(PreferenceKeys.POINT_ANNOTATION_SHAPE) ?? DEFAULTS.ANNOTATION.pointAnnotationShape;
    }

    @computed get pointAnnotationWidth(): number {
        return this.valueInEffect(PreferenceKeys.POINT_ANNOTATION_WIDTH) ?? DEFAULTS.ANNOTATION.pointAnnotationWidth;
    }

    @computed get textAnnotationLineWidth(): number {
        return this.valueInEffect(PreferenceKeys.TEXT_ANNOTATION_LINE_WIDTH) ?? DEFAULTS.ANNOTATION.textAnnotationLineWidth;
    }

    // getters for performance
    @computed get imageCompressionQuality(): number {
        return this.valueInEffect(PreferenceKeys.PERFORMANCE_IMAGE_COMPRESSION_QUALITY) ?? DEFAULTS.PERFORMANCE.imageCompressionQuality;
    }

    @computed get animationCompressionQuality(): number {
        return this.valueInEffect(PreferenceKeys.PERFORMANCE_ANIMATION_COMPRESSION_QUALITY) ?? DEFAULTS.PERFORMANCE.animationCompressionQuality;
    }

    @computed get gpuTileCache(): number {
        return this.valueInEffect(PreferenceKeys.PERFORMANCE_GPU_TILE_CACHE) ?? DEFAULTS.PERFORMANCE.GPUTileCache;
    }

    @computed get systemTileCache(): number {
        return this.valueInEffect(PreferenceKeys.PERFORMANCE_SYSTEM_TILE_CACHE) ?? DEFAULTS.PERFORMANCE.systemTileCache;
    }

    @computed get contourControlMapWidth(): number {
        return this.valueInEffect(PreferenceKeys.PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH) ?? DEFAULTS.PERFORMANCE.contourControlMapWidth;
    }

    @computed get shouldStreamContoursWhileZooming(): boolean {
        return this.valueInEffect(PreferenceKeys.PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING) ?? DEFAULTS.PERFORMANCE.streamContoursWhileZooming;
    }

    @computed get isLowBandwidthMode(): boolean {
        return this.valueInEffect(PreferenceKeys.PERFORMANCE_LOW_BAND_WIDTH_MODE) ?? DEFAULTS.PERFORMANCE.lowBandwidthMode;
    }

    @computed get stopAnimationPlaybackMinutes(): number {
        return this.valueInEffect(PreferenceKeys.PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES) ?? DEFAULTS.PERFORMANCE.stopAnimationPlaybackMinutes;
    }

    @computed get pvPreviewCubeSizeLimit(): number {
        return this.valueInEffect(PreferenceKeys.PERFORMANCE_PV_PREVIEW_CUBE_SIZE_LIMIT) ?? DEFAULTS.PERFORMANCE.pvPreviewCubeSizeLimit;
    }

    @computed get isPVAxesOrderReverse(): boolean {
        return this.valueInEffect(PreferenceKeys.SILENT_PV_AXES_ORDER_REVERSE) ?? DEFAULTS.SILENT.pvAxesOrderReverse;
    }

    @computed get isSelectingAllLogEvents(): boolean {
        return this.valueInEffect(PreferenceKeys.LOG_EVENT)?.length === Event.EVENT_NUMBER;
    }

    @computed get isSelectingIndeterminateLogEvents(): boolean {
        const selected = this.valueInEffect(PreferenceKeys.LOG_EVENT)?.length;
        return selected > 0 && selected < Event.EVENT_NUMBER;
    }

    public isEventLoggingEnabled = (eventType: CARTA.EventType): boolean => {
        if (Event.isTypeValid(eventType)) {
            const logEvents = this.valueInEffect(PreferenceKeys.LOG_EVENT);
            if (logEvents && Array.isArray(logEvents)) {
                return logEvents.includes(eventType);
            }
        }
        return false;
    };

    @computed get isZoomRAWMode(): boolean {
        return this.zoomMode === Zoom.FULL;
    }

    @computed get isRegionCornerMode(): boolean {
        return this.regionCreationMode === RegionCreationMode.CORNER;
    }

    @computed get isCursorFrozen(): boolean {
        return this.cursorPosition === CursorPosition.FIXED;
    }

    @computed get enabledLoggingEventNames(): string[] {
        return this.valueInEffect(PreferenceKeys.LOG_EVENT) ?? [];
    }

    @computed get catalogDisplayedColumnSize(): number {
        return this.valueInEffect(PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE) ?? DEFAULTS.CATALOG.catalogDisplayedColumnSize;
    }

    @computed get catalogTableSeparatorPosition(): string {
        return this.valueInEffect(PreferenceKeys.CATALOG_TABLE_SEPARATOR_POSITION) ?? DEFAULTS.CATALOG.catalogTableSeparatorPosition;
    }

    @computed get shouldAutoSelectImageOverlayCoordinateColumns(): boolean {
        return this.valueInEffect(PreferenceKeys.CATALOG_AUTO_SELECT_IMAGE_OVERLAY_COLUMNS) ?? DEFAULTS.CATALOG.catalogAutoSelectImageOverlayColumns;
    }

    @computed get isPixelGridVisible(): boolean {
        return this.valueInEffect(PreferenceKeys.PIXEL_GRID_VISIBLE) ?? DEFAULTS.SILENT.pixelGridVisible;
    }

    @computed get pixelGridColor(): string {
        return this.valueInEffect(PreferenceKeys.PIXEL_GRID_COLOR) ?? DEFAULTS.SILENT.pixelGridColor;
    }

    @computed get shouldLimitOverlayRedraw(): boolean {
        return this.valueInEffect(PreferenceKeys.PERFORMANCE_LIMIT_OVERLAY_REDRAW) ?? DEFAULTS.PERFORMANCE.limitOverlayRedraw;
    }

    @computed get isImageMultiPanelEnabled(): boolean {
        return this.valueInEffect(PreferenceKeys.IMAGE_MULTI_PANEL_ENABLED) ?? DEFAULTS.SILENT.imageMultiPanelEnabled;
    }

    @computed get imagePanelMode(): ImagePanelMode {
        return this.valueInEffect(PreferenceKeys.IMAGE_PANEL_MODE) ?? DEFAULTS.SILENT.imagePanelMode;
    }

    @computed get imagePanelColumns(): number {
        return this.valueInEffect(PreferenceKeys.IMAGE_PANEL_COLUMNS) ?? DEFAULTS.SILENT.imagePanelColumns;
    }

    @computed get imagePanelRows(): number {
        return this.valueInEffect(PreferenceKeys.IMAGE_PANEL_ROWS) ?? DEFAULTS.SILENT.imagePanelRows;
    }

    @computed get isStatsPanelEnabled(): boolean {
        return this.valueInEffect(PreferenceKeys.STATS_PANEL_ENABLED) ?? DEFAULTS.STATS_PANEL.statsPanelEnabled;
    }

    @computed get statsPanelMode(): number {
        return this.valueInEffect(PreferenceKeys.STATS_PANEL_MODE) ?? DEFAULTS.STATS_PANEL.statsPanelMode;
    }

    // getters for telemetry
    @computed get hasTelemetryConsentShown(): boolean {
        return this.valueInEffect(PreferenceKeys.TELEMETRY_CONSENT_SHOWN) ?? DEFAULTS.TELEMETRY.telemetryConsentShown;
    }

    @computed get telemetryMode(): TelemetryMode {
        return this.valueInEffect(PreferenceKeys.TELEMETRY_MODE) ?? DEFAULTS.TELEMETRY.telemetryMode;
    }

    @computed get isTelemetryLogging(): boolean {
        return this.valueInEffect(PreferenceKeys.TELEMETRY_LOGGING) ?? DEFAULTS.TELEMETRY.telemetryLogging;
    }

    @computed get telemetryUuid(): string {
        return this.valueInEffect(PreferenceKeys.TELEMETRY_UUID);
    }

    // getters for compatibility
    @computed get hasAipsBeamSupport(): boolean {
        return this.valueInEffect(PreferenceKeys.COMPATIBILITY_AIPS_BEAM_SUPPORT) ?? DEFAULTS.COMPATIBILITY.aipsBeamSupport;
    }

    /**
     * The AIPS beam support that a workspace restore opens an image with, in place of the preference. It is undefined while no
     * restore opens an image. The preference stays as it is.
     */
    hasAipsBeamSupportForRestore: boolean | undefined = undefined;

    // getters for showing new release
    @computed get shouldCheckNewRelease(): boolean {
        return this.valueInEffect(PreferenceKeys.CHECK_NEW_RELEASE) ?? DEFAULTS.SILENT.checkNewRelease;
    }

    @computed get latestRelease(): string {
        return this.valueInEffect(PreferenceKeys.LATEST_RELEASE) ?? DEFAULTS.SILENT.latestRelease;
    }

    @computed get layout(): string {
        return this.valueInEffect(PreferenceKeys.LAYOUT) ?? DEFAULTS.LAYOUT.layout;
    }

    // getter for dynamic layout setting
    @computed get isDynamicLayoutEnabled(): boolean {
        return this.valueInEffect(PreferenceKeys.LAYOUT_DYNAMIC_LAYOUT_ENABLE) ?? DEFAULTS.LAYOUT.dynamicLayoutEnable;
    }

    // getter for file priority for dynamic layout setting
    @computed get isHighDimPriority(): boolean {
        return this.valueInEffect(PreferenceKeys.LAYOUT_IS_HIGH_DIM_PRIORITY) ?? DEFAULTS.LAYOUT.isHighDimPriority;
    }

    // getter for file priority for dynamic layout setting
    @computed get existLayoutMapping(): {[key: string]: string} {
        return this.valueInEffect(PreferenceKeys.LAYOUT_DYNAMIC_LAYOUT) ?? DEFAULTS.LAYOUT.existLayoutMapping;
    }

    /**
     * Sets the preference parameter
     *
     * @param key - The enum of {@link PreferenceKeys}.
     * @param value - The given value to the preference key except {@link PreferenceKeys.LOG_EVENT} and {@link PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING}. For {@link PreferenceKeys.LOG_EVENT}, the input value should be an enum {@link CARTA.EventType}, functioning as a toggle for an element within the {@link PreferenceKeys.LOG_EVENT}. For {@link PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING}, the input value should be a {@link WCSMatchingType} enum or a sum of the enums, functioning as an exclusive OR value for {@link PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING}.
     * @returns false if the key or value is not valid; yield a result using {@link ApiService.Instance.setPreference}
     */

    @flow.bound *setPreference(key: PreferenceKeys, value: any) {
        if (!key) {
            return false;
        }

        if (key === PreferenceKeys.RENDER_CONFIG_SCALING && !isSupportedFrameScaling(value)) {
            return false;
        }

        if (key === PreferenceKeys.GLOBAL_CODE_SNIPPETS_ENABLED) {
            this.isCodeSnippetsEnabledForSession = false;
        }

        const scaling = getScalingForParameterPreference(key);
        if (scaling !== undefined) {
            if (typeof value !== "number" || !Number.isFinite(value)) {
                return false;
            }
            value = sanitizeScalingParameter(scaling, value);
        }

        // set preference in variable
        if (key === PreferenceKeys.LOG_EVENT) {
            if (!Event.isTypeValid(value)) {
                return false;
            }
            const eventList = getEventList(this.preferences.get(PreferenceKeys.LOG_EVENT), value);
            this.preferences.set(PreferenceKeys.LOG_EVENT, eventList);
            return yield ApiService.Instance.setPreference(PreferenceKeys.LOG_EVENT, eventList);
        } else if (key === PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING) {
            if (!WCSMatching.isTypeValid(value)) {
                return false;
            }
            // Toggle the value in effect, so that the user sees the change that they asked for.
            let binaryNumber = this.valueInEffect(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING);
            const binaryNumberNew = (binaryNumber ^= value);
            this.sessionPreferences.delete(key);
            this.preferences.set(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING, binaryNumberNew);
            return yield ApiService.Instance.setPreference(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING, binaryNumberNew);
        } else {
            this.sessionPreferences.delete(key);
            this.preferences.set(key, value);
            return yield ApiService.Instance.setPreference(key, value);
        }
    }

    /**
     * Clear the preference setting of the selecting key
     *
     * @param keys - keys of {@link PreferenceKeys}
     */
    @flow.bound *clearPreferences(keys: PreferenceKeys[]) {
        for (const key of keys) {
            this.preferences.delete(key);
            this.sessionPreferences.delete(key);
        }
        if (keys.includes(PreferenceKeys.GLOBAL_CODE_SNIPPETS_ENABLED)) {
            this.isCodeSnippetsEnabledForSession = false;
        }
        yield ApiService.Instance.clearPreferences(keys);
    }

    /**
     * Reset the Silent preference settings
     */
    @action resetSilentSettings = () => {
        this.clearPreferences([
            PreferenceKeys.SILENT_FILE_SORTING_STRING,
            PreferenceKeys.SILENT_FILE_FILTERING_TYPE,
            PreferenceKeys.PIXEL_GRID_VISIBLE,
            PreferenceKeys.PIXEL_GRID_COLOR,
            PreferenceKeys.IMAGE_MULTI_PANEL_ENABLED,
            PreferenceKeys.IMAGE_PANEL_MODE,
            PreferenceKeys.IMAGE_PANEL_COLUMNS,
            PreferenceKeys.IMAGE_PANEL_ROWS,
            PreferenceKeys.SILENT_PV_AXES_ORDER_REVERSE,
            PreferenceKeys.SILENT_IMAGE_VIEW_REST_FRAME_SHIFT_MODE,
            PreferenceKeys.SILENT_IMAGE_VIEW_REST_FRAME_VELOCITY_CONVENTION,
            PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_SHIFT_MODE,
            PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_VELOCITY_CONVENTION
        ]);
    };

    /**
     * Reset the Global preference settings
     */
    @action resetGlobalSettings = () => {
        this.clearPreferences([
            PreferenceKeys.GLOBAL_THEME,
            PreferenceKeys.GLOBAL_AUTOLAUNCH,
            PreferenceKeys.GLOBAL_FILE_FILTER_MODE,
            PreferenceKeys.GLOBAL_CURSOR_POSITION,
            PreferenceKeys.GLOBAL_ZOOM_MODE,
            PreferenceKeys.GLOBAL_ZOOM_POINT,
            PreferenceKeys.GLOBAL_DRAG_PANNING,
            PreferenceKeys.GLOBAL_SPECTRAL_MATCHING_TYPE,
            PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING,
            PreferenceKeys.GLOBAL_TRANSPARENT_IMAGE_BACKGROUND,
            PreferenceKeys.GLOBAL_CODE_SNIPPETS_ENABLED,
            PreferenceKeys.GLOBAL_KEEP_LAST_USED_FOLDER,
            PreferenceKeys.GLOBAL_SAVED_LAST_FOLDER
        ]);
    };

    /**
     * Reset the render configuration settings
     */
    @action resetRenderConfigSettings = () => {
        this.clearPreferences([
            PreferenceKeys.RENDER_CONFIG_COLORMAP,
            PreferenceKeys.RENDER_CONFIG_COLORMAP_INVERTED,
            PreferenceKeys.RENDER_CONFIG_COLORMAP_HEX,
            PreferenceKeys.RENDER_CONFIG_COLORMAP_HEX_START,
            PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX,
            PreferenceKeys.RENDER_CONFIG_PERCENTILE,
            PreferenceKeys.RENDER_CONFIG_SCALING,
            PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA_LEGACY,
            PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA_LOG,
            PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA_POWER,
            PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA_SINH,
            PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA_ASINH,
            PreferenceKeys.RENDER_CONFIG_SCALING_GAMMA,
            PreferenceKeys.RENDER_CONFIG_USE_SMOOTHED_BIAS_CONTRAST
        ]);
    };

    /**
     * Reset the contour configuration settings
     */
    @action resetContourConfigSettings = () => {
        this.clearPreferences([
            PreferenceKeys.CONTOUR_CONFIG_COLOR,
            PreferenceKeys.CONTOUR_CONFIG_COLORMAP,
            PreferenceKeys.CONTOUR_CONFIG_COLORMAP_ENABLED,
            PreferenceKeys.CONTOUR_CONFIG_COLORMAP_INVERTED,
            PreferenceKeys.CONTOUR_CONFIG_GENERATOR_TYPE,
            PreferenceKeys.CONTOUR_CONFIG_NUM_LEVELS,
            PreferenceKeys.CONTOUR_CONFIG_SMOOTHING_FACTOR,
            PreferenceKeys.CONTOUR_CONFIG_SMOOTHING_MODE,
            PreferenceKeys.CONTOUR_CONFIG_THICKNESS
        ]);
    };

    /**
     * Reset the vector overlay configuration settings
     */
    @action resetVectorOverlayConfigSettings = () => {
        this.clearPreferences([
            PreferenceKeys.VECTOR_OVERLAY_PIXEL_AVERAGING,
            PreferenceKeys.VECTOR_OVERLAY_FRACTIONAL_INTENSITY,
            PreferenceKeys.VECTOR_OVERLAY_COLOR,
            PreferenceKeys.VECTOR_OVERLAY_COLORMAP,
            PreferenceKeys.VECTOR_OVERLAY_COLORMAP_ENABLED,
            PreferenceKeys.VECTOR_OVERLAY_COLORMAP_INVERTED,
            PreferenceKeys.VECTOR_OVERLAY_THICKNESS
        ]);
    };

    /**
     * Reset the overlay configuration settings
     */
    @action resetOverlayConfigSettings = () => {
        this.clearPreferences([
            PreferenceKeys.WCS_OVERLAY_AST_COLOR,
            PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE,
            PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE,
            PreferenceKeys.WCS_OVERLAY_COLORBAR_VISIBLE,
            PreferenceKeys.WCS_OVERLAY_COLORBAR_INTERACTIVE,
            PreferenceKeys.WCS_OVERLAY_COLORBAR_POSITION,
            PreferenceKeys.WCS_OVERLAY_COLORBAR_WIDTH,
            PreferenceKeys.WCS_OVERLAY_COLORBAR_TICKS_DENSITY,
            PreferenceKeys.WCS_OVERLAY_COLORBAR_LABEL_VISIBLE,
            PreferenceKeys.WCS_OVERLAY_BEAM_COLOR,
            PreferenceKeys.WCS_OVERLAY_BEAM_TYPE,
            PreferenceKeys.WCS_OVERLAY_BEAM_VISIBLE,
            PreferenceKeys.WCS_OVERLAY_BEAM_WIDTH,
            PreferenceKeys.WCS_OVERLAY_WCS_TYPE,
            PreferenceKeys.WCS_OVERLAY_CURSOR_INFO
        ]);
    };

    /**
     * Reset the layout settings
     */
    @action resetLayoutSettings = () => {
        this.clearPreferences([PreferenceKeys.LAYOUT, PreferenceKeys.LAYOUT_DYNAMIC_LAYOUT_ENABLE, PreferenceKeys.LAYOUT_IS_HIGH_DIM_PRIORITY]);
    };

    /**
     * Reset the region settings
     */
    @action resetRegionSettings = () => {
        this.clearPreferences([
            PreferenceKeys.REGION_COLOR,
            PreferenceKeys.REGION_CREATION_MODE,
            PreferenceKeys.REGION_DASH_LENGTH,
            PreferenceKeys.REGION_LINE_WIDTH,
            PreferenceKeys.REGION_TYPE,
            PreferenceKeys.REGION_SIZE,
            PreferenceKeys.REGION_PASTE_OFFSET_UNIT
        ]);
    };

    /**
     * Reset the annotation settings
     */
    @action resetAnnotationSettings = () => {
        this.clearPreferences([
            PreferenceKeys.ANNOTATION_COLOR,
            PreferenceKeys.ANNOTATION_DASH_LENGTH,
            PreferenceKeys.ANNOTATION_LINE_WIDTH,
            PreferenceKeys.POINT_ANNOTATION_SHAPE,
            PreferenceKeys.POINT_ANNOTATION_WIDTH,
            PreferenceKeys.TEXT_ANNOTATION_LINE_WIDTH
        ]);
    };

    /**
     * Reset the preference settings
     */
    @action resetPerformanceSettings = () => {
        this.clearPreferences([
            PreferenceKeys.PERFORMANCE_ANIMATION_COMPRESSION_QUALITY,
            PreferenceKeys.PERFORMANCE_CONTOUR_CHUNK_SIZE,
            PreferenceKeys.PERFORMANCE_CONTOUR_COMPRESSION_LEVEL,
            PreferenceKeys.PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH,
            PreferenceKeys.PERFORMANCE_CONTOUR_DECIMATION,
            PreferenceKeys.PERFORMANCE_GPU_TILE_CACHE,
            PreferenceKeys.PERFORMANCE_IMAGE_COMPRESSION_QUALITY,
            PreferenceKeys.PERFORMANCE_LOW_BAND_WIDTH_MODE,
            PreferenceKeys.PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES,
            PreferenceKeys.PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING,
            PreferenceKeys.PERFORMANCE_SYSTEM_TILE_CACHE,
            PreferenceKeys.PERFORMANCE_LIMIT_OVERLAY_REDRAW,
            PreferenceKeys.PERFORMANCE_PV_PREVIEW_CUBE_SIZE_LIMIT
        ]);
    };

    /**
     * Reset the compatibility settings
     */
    @action resetCompatibilitySettings = () => {
        this.clearPreferences([PreferenceKeys.COMPATIBILITY_AIPS_BEAM_SUPPORT]);
    };

    /**
     * Reset the all log events
     */
    @action selectAllLogEvents = () => {
        if (this.isSelectingAllLogEvents || this.isSelectingIndeterminateLogEvents) {
            this.resetLogEventSettings();
        } else {
            Event.EVENT_TYPES.forEach(eventType => this.setPreference(PreferenceKeys.LOG_EVENT, eventType));
        }
    };

    /**
     * Reset the log event setting
     */
    @action resetLogEventSettings = () => {
        this.clearPreferences([PreferenceKeys.LOG_EVENT]);
    };

    /**
     * Reset the catalog settings
     */
    @action resetCatalogSettings = () => {
        this.clearPreferences([PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE, PreferenceKeys.CATALOG_TABLE_SEPARATOR_POSITION, PreferenceKeys.CATALOG_AUTO_SELECT_IMAGE_OVERLAY_COLUMNS]);
    };

    /**
     * Reset the telemetry settings
     */
    @action resetTelemetrySettings = () => {
        this.clearPreferences([PreferenceKeys.TELEMETRY_CONSENT_SHOWN, PreferenceKeys.TELEMETRY_MODE, PreferenceKeys.TELEMETRY_LOGGING]);
    };

    /**
     * Fetch the values of the preference keys
     */
    @flow.bound *fetchPreferences() {
        const preferences = yield ApiService.Instance.getPreferences();
        if (preferences) {
            const keys = Object.keys(preferences);
            for (const key of keys) {
                const val = preferences[key];
                if (key === PreferenceKeys.RENDER_CONFIG_SCALING && !isSupportedFrameScaling(val)) {
                    continue;
                }
                this.preferences.set(key as PreferenceKeys, val);
            }
        }
        this.isPreferenceReady = true;
    }

    private constructor() {
        makeObservable(this);
    }
}
