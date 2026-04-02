import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {action, computed, flow, makeObservable, observable} from "mobx";

import {BeamType, ContourGeneratorType, CursorInfoVisibility, FileFilteringType, FileFilterMode, FrameScaling, ImagePanelMode, PreferenceKeys, SpectralType, TelemetryMode, WCSMatchingType} from "enums";
import {CARTA_INFO, CompressionQuality, CursorPosition, Event, getEventList, PresetLayout, RegionCreationMode, Theme, TileCache, WCSMatching, WCSType, Zoom, ZoomPoint} from "models";
import {ApiService} from "services";

const defaults = {
    SILENT: {
        fileSortingString: "-date",
        fileFilteringType: FileFilteringType.Fuzzy,
        isPixelGridVisible: false,
        pixelGridColor: "#ffffff",
        isImageMultiPanelEnabled: false,
        imagePanelMode: ImagePanelMode.Dynamic,
        imagePanelColumns: 2,
        imagePanelRows: 2,
        shouldCheckNewRelease: true,
        latestRelease: "v" + CARTA_INFO.version,
        pvAxesOrderReverse: false
    },
    GLOBAL: {
        theme: Theme.AUTO,
        isAutoLaunch: true,
        fileFilterMode: FileFilterMode.Content,
        cursorPosition: CursorPosition.TRACKING,
        zoomMode: Zoom.FIT,
        zoomPoint: ZoomPoint.CURSOR,
        isDragPanning: true,
        spectralMatchingType: SpectralType.VRAD,
        autoWCSMatching: WCSMatchingType.NONE,
        isTransparentImageBackground: false,
        isCodeSnippetsEnabled: false,
        shouldKeepLastUsedFolder: false,
        lastUsedFolder: ""
    },
    RENDER_CONFIG: {
        scaling: FrameScaling.LINEAR,
        colormap: "inferno",
        colormapHex: "#FFFFFF",
        colormapHexStart: "#000000",
        percentile: 99.9,
        scalingAlpha: 1000,
        scalingGamma: 1,
        nanColorHex: "#137CBD",
        nanAlpha: 1,
        shouldUseSmoothedBiasContrast: true
    },
    CONTOUR_CONFIG: {
        contourGeneratorType: ContourGeneratorType.StartStepMultiplier,
        contourSmoothingMode: CARTA.SmoothingMode.GaussianBlur,
        contourSmoothingFactor: 4,
        contourNumLevels: 5,
        contourThickness: 1,
        isContourColormapEnabled: false,
        contourColor: Colors.GREEN3,
        contourColormap: "viridis"
    },
    VECTOR_OVERLAY: {
        vectorOverlayPixelAveraging: 4,
        isVectorOverlayFractionalIntensity: false,
        vectorOverlayThickness: 1,
        isVectorOverlayColormapEnabled: false,
        vectorOverlayColor: Colors.GREEN3,
        vectorOverlayColormap: "viridis"
    },
    WCS_OVERLAY: {
        astColor: "auto-blue",
        isAstGridVisible: false,
        isAstLabelsVisible: true,
        wcsType: WCSType.AUTOMATIC,
        isColorbarVisible: true,
        isColorbarInteractive: true,
        colorbarPosition: "right",
        colorbarWidth: 15,
        colorbarTicksDensity: 1,
        isColorbarLabelVisible: false,
        isBeamVisible: true,
        beamColor: "auto-gray",
        beamType: BeamType.Open,
        beamWidth: 1,
        cursorInfoVisible: CursorInfoVisibility.ActiveImage
    },
    LAYOUT: {
        layout: PresetLayout.DEFAULT,
        isDynamicLayoutEnabled: false,
        isHighDimPriority: true,
        existLayoutMapping: {}
    },
    REGION: {
        regionColor: "#2ee6d6",
        regionLineWidth: 2,
        regionDashLength: 0,
        regionType: CARTA.RegionType.RECTANGLE,
        regionCreationMode: RegionCreationMode.CENTER,
        regionSize: 30
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
        shouldStreamContoursWhileZooming: false,
        isLowBandwidthMode: false,
        stopAnimationPlaybackMinutes: 5,
        shouldLimitOverlayRedraw: true,
        pvPreviewCubeSizeLimit: 1
    },
    LOG_EVENT: {
        eventLoggingEnabled: []
    },
    CATALOG: {
        catalogDisplayedColumnSize: 10,
        catalogTableSeparatorPosition: "60%"
    },
    STATS_PANEL: {
        isStatsPanelEnabled: false,
        statsPanelMode: 0
    },
    TELEMETRY: {
        isTelemetryConsentShown: false,
        telemetryMode: TelemetryMode.Usage,
        isTelemetryLogging: false
    },
    COMPATIBILITY: {
        hasAipsBeamSupport: false
    }
};

/**
 * The store manages the preference setting
 */
export class PreferenceStore {
    private static staticInstance: PreferenceStore;

    static get Instance() {
        if (!PreferenceStore.staticInstance) {
            PreferenceStore.staticInstance = new PreferenceStore();
        }
        return PreferenceStore.staticInstance;
    }

    @observable preferences: Map<PreferenceKeys, any> = new Map<PreferenceKeys, any>();

    /**
     * Whether the preference data is initialized from the preference file or localStorage.
     */
    @observable isPreferenceReady: boolean = false;

    // getters for global settings
    @computed get theme(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_THEME) ?? defaults.GLOBAL.theme;
    }

    @computed get isAutoLaunch(): boolean {
        return this.preferences.get(PreferenceKeys.GLOBAL_AUTOLAUNCH) ?? defaults.GLOBAL.isAutoLaunch;
    }

    @computed get fileFilterMode(): FileFilterMode {
        return this.preferences.get(PreferenceKeys.GLOBAL_FILE_FILTER_MODE) ?? defaults.GLOBAL.fileFilterMode;
    }

    @computed get fileSortingString(): string {
        return this.preferences.get(PreferenceKeys.SILENT_FILE_SORTING_STRING) ?? defaults.SILENT.fileSortingString;
    }

    @computed get fileFilteringType(): FileFilteringType {
        return this.preferences.get(PreferenceKeys.SILENT_FILE_FILTERING_TYPE) ?? defaults.SILENT.fileFilteringType;
    }

    @computed get cursorPosition(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_CURSOR_POSITION) ?? defaults.GLOBAL.cursorPosition;
    }

    @computed get zoomMode(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_ZOOM_MODE) ?? defaults.GLOBAL.zoomMode;
    }

    @computed get zoomPoint(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_ZOOM_POINT) ?? defaults.GLOBAL.zoomPoint;
    }

    @computed get isDragPanning(): boolean {
        return this.preferences.get(PreferenceKeys.GLOBAL_DRAG_PANNING) ?? defaults.GLOBAL.isDragPanning;
    }

    @computed get spectralMatchingType(): SpectralType {
        return this.preferences.get(PreferenceKeys.GLOBAL_SPECTRAL_MATCHING_TYPE) ?? defaults.GLOBAL.spectralMatchingType;
    }

    @computed get autoWCSMatching(): WCSMatchingType {
        return this.preferences.get(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING) ?? defaults.GLOBAL.autoWCSMatching;
    }

    public isWCSMatchingEnabled = (matchingType: WCSMatchingType): boolean => {
        if (WCSMatching.IsTypeValid(matchingType) && matchingType & this.preferences.get(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING)) {
            return true;
        }
        return false;
    };

    @computed get isTransparentImageBackground(): boolean {
        return this.preferences.get(PreferenceKeys.GLOBAL_TRANSPARENT_IMAGE_BACKGROUND) ?? defaults.GLOBAL.isTransparentImageBackground;
    }

    @computed get isCodeSnippetsEnabled(): boolean {
        return this.preferences.get(PreferenceKeys.GLOBAL_CODE_SNIPPETS_ENABLED) ?? defaults.GLOBAL.isCodeSnippetsEnabled;
    }

    @computed get shouldKeepLastUsedFolder(): boolean {
        return this.preferences.get(PreferenceKeys.GLOBAL_KEEP_LAST_USED_FOLDER) ?? defaults.GLOBAL.shouldKeepLastUsedFolder;
    }

    @computed get lastUsedFolder(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_SAVED_LAST_FOLDER) ?? defaults.GLOBAL.lastUsedFolder;
    }

    // getters for render config
    @computed get scaling(): FrameScaling {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_SCALING) ?? defaults.RENDER_CONFIG.scaling;
    }

    @computed get colormap(): string {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_COLORMAP) ?? defaults.RENDER_CONFIG.colormap;
    }

    @computed get colormapHex(): string {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_COLORMAP_HEX) ?? defaults.RENDER_CONFIG.colormapHex;
    }

    @computed get colormapHexStart(): string {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_COLORMAP_HEX_START) ?? defaults.RENDER_CONFIG.colormapHexStart;
    }

    @computed get percentile(): number {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_PERCENTILE) ?? defaults.RENDER_CONFIG.percentile;
    }

    @computed get scalingAlpha(): number {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA) ?? defaults.RENDER_CONFIG.scalingAlpha;
    }

    @computed get scalingGamma(): number {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_SCALING_GAMMA) ?? defaults.RENDER_CONFIG.scalingGamma;
    }

    @computed get nanColorHex(): string {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX) ?? defaults.RENDER_CONFIG.nanColorHex;
    }

    @computed get nanAlpha(): number {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_NAN_ALPHA) ?? defaults.RENDER_CONFIG.nanAlpha;
    }

    @computed get shouldUseSmoothedBiasContrast(): boolean {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_USE_SMOOTHED_BIAS_CONTRAST) ?? defaults.RENDER_CONFIG.shouldUseSmoothedBiasContrast;
    }

    // getters for Contour Config
    @computed get contourGeneratorType(): ContourGeneratorType {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_GENERATOR_TYPE) ?? defaults.CONTOUR_CONFIG.contourGeneratorType;
    }

    @computed get isContourColormapEnabled(): boolean {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_COLORMAP_ENABLED) ?? defaults.CONTOUR_CONFIG.isContourColormapEnabled;
    }

    @computed get contourColormap(): string {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_COLORMAP) ?? defaults.CONTOUR_CONFIG.contourColormap;
    }

    @computed get contourColor(): string {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_COLOR) ?? defaults.CONTOUR_CONFIG.contourColor;
    }

    @computed get contourSmoothingMode(): CARTA.SmoothingMode {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_SMOOTHING_MODE) ?? defaults.CONTOUR_CONFIG.contourSmoothingMode;
    }

    @computed get contourSmoothingFactor(): number {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_SMOOTHING_FACTOR) ?? defaults.CONTOUR_CONFIG.contourSmoothingFactor;
    }

    @computed get contourNumLevels(): number {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_NUM_LEVELS) ?? defaults.CONTOUR_CONFIG.contourNumLevels;
    }

    @computed get contourThickness(): number {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_THICKNESS) ?? defaults.CONTOUR_CONFIG.contourThickness;
    }

    @computed get contourDecimation(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_DECIMATION) ?? defaults.PERFORMANCE.contourDecimation;
    }

    @computed get contourCompressionLevel(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_COMPRESSION_LEVEL) ?? defaults.PERFORMANCE.contourCompressionLevel;
    }

    @computed get contourChunkSize(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_CHUNK_SIZE) ?? defaults.PERFORMANCE.contourChunkSize;
    }

    // getters for vector overlay
    @computed get vectorOverlayPixelAveraging(): number {
        return this.preferences.get(PreferenceKeys.VECTOR_OVERLAY_PIXEL_AVERAGING) ?? defaults.VECTOR_OVERLAY.vectorOverlayPixelAveraging;
    }

    @computed get isVectorOverlayFractionalIntensity(): boolean {
        return this.preferences.get(PreferenceKeys.VECTOR_OVERLAY_FRACTIONAL_INTENSITY) ?? defaults.VECTOR_OVERLAY.isVectorOverlayFractionalIntensity;
    }

    @computed get vectorOverlayThickness(): number {
        return this.preferences.get(PreferenceKeys.VECTOR_OVERLAY_THICKNESS) ?? defaults.VECTOR_OVERLAY.vectorOverlayThickness;
    }

    @computed get isVectorOverlayColormapEnabled(): boolean {
        return this.preferences.get(PreferenceKeys.VECTOR_OVERLAY_COLORMAP_ENABLED) ?? defaults.VECTOR_OVERLAY.isVectorOverlayColormapEnabled;
    }

    @computed get vectorOverlayColor(): string {
        return this.preferences.get(PreferenceKeys.VECTOR_OVERLAY_COLOR) ?? defaults.VECTOR_OVERLAY.vectorOverlayColor;
    }

    @computed get vectorOverlayColormap(): string {
        return this.preferences.get(PreferenceKeys.VECTOR_OVERLAY_COLORMAP) ?? defaults.VECTOR_OVERLAY.vectorOverlayColormap;
    }

    // getters for WCS overlay
    @computed get astColor(): string {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_AST_COLOR) ?? defaults.WCS_OVERLAY.astColor;
    }

    @computed get isAstGridVisible(): boolean {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE) ?? defaults.WCS_OVERLAY.isAstGridVisible;
    }

    @computed get isAstLabelsVisible(): boolean {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE) ?? defaults.WCS_OVERLAY.isAstLabelsVisible;
    }

    @computed get wcsType(): string {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_WCS_TYPE) ?? defaults.WCS_OVERLAY.wcsType;
    }

    @computed get isColorbarVisible(): boolean {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_VISIBLE) ?? defaults.WCS_OVERLAY.isColorbarVisible;
    }

    @computed get isColorbarInteractive(): boolean {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_INTERACTIVE) ?? defaults.WCS_OVERLAY.isColorbarInteractive;
    }

    @computed get colorbarPosition(): "right" | "top" | "bottom" {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_POSITION) ?? defaults.WCS_OVERLAY.colorbarPosition;
    }

    @computed get colorbarWidth(): number {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_WIDTH) ?? defaults.WCS_OVERLAY.colorbarWidth;
    }

    @computed get colorbarTicksDensity(): number {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_TICKS_DENSITY) ?? defaults.WCS_OVERLAY.colorbarTicksDensity;
    }

    @computed get isColorbarLabelVisible(): boolean {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_LABEL_VISIBLE) ?? defaults.WCS_OVERLAY.isColorbarLabelVisible;
    }

    @computed get isBeamVisible(): boolean {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_VISIBLE) ?? defaults.WCS_OVERLAY.isBeamVisible;
    }

    @computed get beamColor(): string {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_COLOR) ?? defaults.WCS_OVERLAY.beamColor;
    }

    @computed get beamType(): BeamType {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_TYPE) ?? defaults.WCS_OVERLAY.beamType;
    }

    @computed get beamWidth(): number {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_WIDTH) ?? defaults.WCS_OVERLAY.beamWidth;
    }

    @computed get cursorInfoVisible(): string {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_CURSOR_INFO) ?? defaults.WCS_OVERLAY.cursorInfoVisible;
    }

    // getters for region
    @computed get regionColor(): string {
        return this.preferences.get(PreferenceKeys.REGION_COLOR) ?? defaults.REGION.regionColor;
    }

    @computed get regionLineWidth(): number {
        return this.preferences.get(PreferenceKeys.REGION_LINE_WIDTH) ?? defaults.REGION.regionLineWidth;
    }

    @computed get regionDashLength(): number {
        return this.preferences.get(PreferenceKeys.REGION_DASH_LENGTH) ?? defaults.REGION.regionDashLength;
    }

    @computed get regionType(): CARTA.RegionType {
        return this.preferences.get(PreferenceKeys.REGION_TYPE) ?? defaults.REGION.regionType;
    }

    @computed get regionCreationMode(): string {
        return this.preferences.get(PreferenceKeys.REGION_CREATION_MODE) ?? defaults.REGION.regionCreationMode;
    }

    @computed get regionSize(): number {
        return this.preferences.get(PreferenceKeys.REGION_SIZE) ?? defaults.REGION.regionSize;
    }

    // getters for annotation
    @computed get annotationColor(): string {
        return this.preferences.get(PreferenceKeys.ANNOTATION_COLOR) ?? defaults.ANNOTATION.annotationColor;
    }

    @computed get annotationLineWidth(): number {
        return this.preferences.get(PreferenceKeys.ANNOTATION_LINE_WIDTH) ?? defaults.ANNOTATION.annotationLineWidth;
    }

    @computed get annotationDashLength(): number {
        return this.preferences.get(PreferenceKeys.ANNOTATION_DASH_LENGTH) ?? defaults.ANNOTATION.annotationDashLength;
    }

    @computed get pointAnnotationShape(): CARTA.PointAnnotationShape {
        return this.preferences.get(PreferenceKeys.POINT_ANNOTATION_SHAPE) ?? defaults.ANNOTATION.pointAnnotationShape;
    }

    @computed get pointAnnotationWidth(): number {
        return this.preferences.get(PreferenceKeys.POINT_ANNOTATION_WIDTH) ?? defaults.ANNOTATION.pointAnnotationWidth;
    }

    @computed get textAnnotationLineWidth(): number {
        return this.preferences.get(PreferenceKeys.TEXT_ANNOTATION_LINE_WIDTH) ?? defaults.ANNOTATION.textAnnotationLineWidth;
    }

    // getters for performance
    @computed get imageCompressionQuality(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_IMAGE_COMPRESSION_QUALITY) ?? defaults.PERFORMANCE.imageCompressionQuality;
    }

    @computed get animationCompressionQuality(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_ANIMATION_COMPRESSION_QUALITY) ?? defaults.PERFORMANCE.animationCompressionQuality;
    }

    @computed get gpuTileCache(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_GPU_TILE_CACHE) ?? defaults.PERFORMANCE.GPUTileCache;
    }

    @computed get systemTileCache(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_SYSTEM_TILE_CACHE) ?? defaults.PERFORMANCE.systemTileCache;
    }

    @computed get contourControlMapWidth(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH) ?? defaults.PERFORMANCE.contourControlMapWidth;
    }

    @computed get shouldStreamContoursWhileZooming(): boolean {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING) ?? defaults.PERFORMANCE.shouldStreamContoursWhileZooming;
    }

    @computed get isLowBandwidthMode(): boolean {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_LOW_BAND_WIDTH_MODE) ?? defaults.PERFORMANCE.isLowBandwidthMode;
    }

    @computed get stopAnimationPlaybackMinutes(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES) ?? defaults.PERFORMANCE.stopAnimationPlaybackMinutes;
    }

    @computed get pvPreviewCubeSizeLimit(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_PV_PREVIEW_CUBE_SIZE_LIMIT) ?? defaults.PERFORMANCE.pvPreviewCubeSizeLimit;
    }

    @computed get isPVAxesOrderReverse(): boolean {
        return this.preferences.get(PreferenceKeys.SILENT_PV_AXES_ORDER_REVERSE) ?? defaults.SILENT.pvAxesOrderReverse;
    }

    @computed get isSelectingAllLogEvents(): boolean {
        return this.preferences.get(PreferenceKeys.LOG_EVENT)?.length === Event.EVENT_NUMBER;
    }

    @computed get isSelectingIndeterminateLogEvents(): boolean {
        const selected = this.preferences.get(PreferenceKeys.LOG_EVENT)?.length;
        return selected > 0 && selected < Event.EVENT_NUMBER;
    }

    public isEventLoggingEnabled = (eventType: CARTA.EventType): boolean => {
        if (Event.IsTypeValid(eventType)) {
            const logEvents = this.preferences.get(PreferenceKeys.LOG_EVENT);
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
        return this.preferences.get(PreferenceKeys.LOG_EVENT) ?? [];
    }

    @computed get catalogDisplayedColumnSize(): number {
        return this.preferences.get(PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE) ?? defaults.CATALOG.catalogDisplayedColumnSize;
    }

    @computed get catalogTableSeparatorPosition(): string {
        return this.preferences.get(PreferenceKeys.CATALOG_TABLE_SEPARATOR_POSITION) ?? defaults.CATALOG.catalogTableSeparatorPosition;
    }

    @computed get isPixelGridVisible(): boolean {
        return this.preferences.get(PreferenceKeys.PIXEL_GRID_VISIBLE) ?? defaults.SILENT.isPixelGridVisible;
    }

    @computed get pixelGridColor(): string {
        return this.preferences.get(PreferenceKeys.PIXEL_GRID_COLOR) ?? defaults.SILENT.pixelGridColor;
    }

    @computed get shouldLimitOverlayRedraw(): boolean {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_LIMIT_OVERLAY_REDRAW) ?? defaults.PERFORMANCE.shouldLimitOverlayRedraw;
    }

    @computed get isImageMultiPanelEnabled(): boolean {
        return this.preferences.get(PreferenceKeys.IMAGE_MULTI_PANEL_ENABLED) ?? defaults.SILENT.imagePanelMode;
    }

    @computed get imagePanelMode(): ImagePanelMode {
        return this.preferences.get(PreferenceKeys.IMAGE_PANEL_MODE) ?? defaults.SILENT.imagePanelMode;
    }

    @computed get imagePanelColumns(): number {
        return this.preferences.get(PreferenceKeys.IMAGE_PANEL_COLUMNS) ?? defaults.SILENT.imagePanelColumns;
    }

    @computed get imagePanelRows(): number {
        return this.preferences.get(PreferenceKeys.IMAGE_PANEL_ROWS) ?? defaults.SILENT.imagePanelRows;
    }

    @computed get isStatsPanelEnabled(): boolean {
        return this.preferences.get(PreferenceKeys.STATS_PANEL_ENABLED) ?? defaults.STATS_PANEL.isStatsPanelEnabled;
    }

    @computed get statsPanelMode(): number {
        return this.preferences.get(PreferenceKeys.STATS_PANEL_MODE) ?? defaults.STATS_PANEL.statsPanelMode;
    }

    // getters for telemetry
    @computed get isTelemetryConsentShown(): boolean {
        return this.preferences.get(PreferenceKeys.TELEMETRY_CONSENT_SHOWN) ?? defaults.TELEMETRY.isTelemetryConsentShown;
    }

    @computed get telemetryMode(): TelemetryMode {
        return this.preferences.get(PreferenceKeys.TELEMETRY_MODE) ?? defaults.TELEMETRY.telemetryMode;
    }

    @computed get isTelemetryLogging(): boolean {
        return this.preferences.get(PreferenceKeys.TELEMETRY_LOGGING) ?? defaults.TELEMETRY.isTelemetryLogging;
    }

    @computed get telemetryUuid(): string {
        return this.preferences.get(PreferenceKeys.TELEMETRY_UUID);
    }

    // getters for compatibility
    @computed get hasAipsBeamSupport(): boolean {
        return this.preferences.get(PreferenceKeys.COMPATIBILITY_AIPS_BEAM_SUPPORT) ?? defaults.COMPATIBILITY.hasAipsBeamSupport;
    }

    // getters for showing new release
    @computed get shouldCheckNewRelease(): boolean {
        return this.preferences.get(PreferenceKeys.CHECK_NEW_RELEASE) ?? defaults.SILENT.shouldCheckNewRelease;
    }

    @computed get latestRelease(): string {
        return this.preferences.get(PreferenceKeys.LATEST_RELEASE) ?? defaults.SILENT.latestRelease;
    }

    @computed get layout(): string {
        return this.preferences.get(PreferenceKeys.LAYOUT) ?? defaults.LAYOUT.layout;
    }

    // getter for dynamic layout setting
    @computed get isDynamicLayoutEnabled(): boolean {
        return this.preferences.get(PreferenceKeys.LAYOUT_DYNAMIC_LAYOUT_ENABLE) ?? defaults.LAYOUT.isDynamicLayoutEnabled;
    }

    // getter for file priority for dynamic layout setting
    @computed get isHighDimPriority(): boolean {
        return this.preferences.get(PreferenceKeys.LAYOUT_IS_HIGH_DIM_PRIORITY) ?? defaults.LAYOUT.isHighDimPriority;
    }

    // getter for file priority for dynamic layout setting
    @computed get existLayoutMapping(): {[key: string]: string} {
        return this.preferences.get(PreferenceKeys.LAYOUT_DYNAMIC_LAYOUT) ?? defaults.LAYOUT.existLayoutMapping;
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

        // set preference in variable
        if (key === PreferenceKeys.LOG_EVENT) {
            if (!Event.IsTypeValid(value)) {
                return false;
            }
            const eventList = getEventList(this.preferences.get(PreferenceKeys.LOG_EVENT), value);
            this.preferences.set(PreferenceKeys.LOG_EVENT, eventList);
            return yield ApiService.Instance.setPreference(PreferenceKeys.LOG_EVENT, eventList);
        } else if (key === PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING) {
            if (!WCSMatching.IsTypeValid(value)) {
                return false;
            }
            let binaryNumber = this.preferences.get(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING);
            const binaryNumberNew = (binaryNumber ^= value);
            this.preferences.set(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING, binaryNumberNew);
            return yield ApiService.Instance.setPreference(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING, binaryNumberNew);
        } else {
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
            PreferenceKeys.SILENT_PV_AXES_ORDER_REVERSE
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
            PreferenceKeys.RENDER_CONFIG_COLORMAP_HEX,
            PreferenceKeys.RENDER_CONFIG_COLORMAP_HEX_START,
            PreferenceKeys.RENDER_CONFIG_NAN_ALPHA,
            PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX,
            PreferenceKeys.RENDER_CONFIG_PERCENTILE,
            PreferenceKeys.RENDER_CONFIG_SCALING,
            PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA,
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
        this.clearPreferences([PreferenceKeys.REGION_COLOR, PreferenceKeys.REGION_CREATION_MODE, PreferenceKeys.REGION_DASH_LENGTH, PreferenceKeys.REGION_LINE_WIDTH, PreferenceKeys.REGION_TYPE, PreferenceKeys.REGION_SIZE]);
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
            PreferenceKeys.PERFORMANCE_PV_PREVIEW_CUBE_SIZE_LIMIT,
            PreferenceKeys.PERFORMANCE_PV_PREVIEW_CUBE_SIZE_LIMIT_UNIT
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
        this.clearPreferences([PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE, PreferenceKeys.CATALOG_TABLE_SEPARATOR_POSITION]);
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
                this.preferences.set(key as PreferenceKeys, val);
            }
        }
        this.isPreferenceReady = true;
    }

    private constructor() {
        makeObservable(this);
    }
}
