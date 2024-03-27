import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {action, computed, flow, makeObservable, observable} from "mobx";

import {MemoryUnit} from "components/Dialogs";
import {
    CARTA_INFO,
    CompressionQuality,
    CursorInfoVisibility,
    CursorPosition,
    Event,
    FileFilterMode,
    getEventList,
    ImagePanelMode,
    PresetLayout,
    RegionCreationMode,
    SpectralType,
    Theme,
    TileCache,
    WCSMatching,
    WCSMatchingType,
    WCSType,
    Zoom,
    ZoomPoint
} from "models";
import {ApiService} from "services";
import {TelemetryMode} from "services/TelemetryService";
import {BeamType, FileFilteringType} from "stores";
import {ContourGeneratorType, FrameScaling} from "stores/Frame";
import {parseBoolean} from "utilities";

export enum PreferenceKeys {
    SILENT_FILE_SORTING_STRING = "fileSortingString",
    SILENT_FILE_FILTERING_TYPE = "fileFilteringType",
    SILENT_PIXEL_GRID_VISIBLE = "pixelGridVisible",
    SILENT_PIXEL_GRID_COLOR = "pixelGridColor",
    SILENT_IMAGE_MULTI_PANEL_ENABLED = "imageMultiPanelEnabled",
    SILENT_IMAGE_PANEL_MODE = "imagePanelMode",
    SILENT_IMAGE_PANEL_COLUMNS = "imagePanelColumns",
    SILENT_IMAGE_PANEL_ROWS = "imagePanelRows",
    SILENT_STATS_PANEL_ENABLED = "statsPanelEnabled",
    SILENT_STATS_PANEL_MODE = "statsPanelMode",
    SILENT_CHECK_NEW_RELEASE = "checkNewRelease",
    SILENT_LATEST_RELEASE = "latestRelease",

    GLOBAL_THEME = "theme",
    GLOBAL_AUTOLAUNCH = "autoLaunch",
    GLOBAL_FILE_FILTER_MODE = "fileFilterMode",
    GLOBAL_LAYOUT = "layout",
    GLOBAL_CURSOR_POSITION = "cursorPosition",
    GLOBAL_ZOOM_MODE = "zoomMode",
    GLOBAL_ZOOM_POINT = "zoomPoint",
    GLOBAL_DRAG_PANNING = "dragPanning",
    GLOBAL_SPECTRAL_MATCHING_TYPE = "spectralMatchingType",
    GLOBAL_AUTO_WCS_MATCHING = "autoWCSMatching",
    GLOBAL_TRANSPARENT_IMAGE_BACKGROUND = "transparentImageBackground",
    GLOBAL_CODE_SNIPPETS_ENABLED = "codeSnippetsEnabled",
    GLOBAL_KEEP_LAST_USED_FOLDER = "keepLastUsedFolder",
    GLOBAL_SAVED_LAST_FOLDER = "lastUsedFolder",

    RENDER_CONFIG_SCALING = "scaling",
    RENDER_CONFIG_COLORMAP = "colormap",
    RENDER_CONFIG_COLORMAP_HEX = "colormapHex",
    RENDER_CONFIG_COLORMAP_HEX_START = "colormapHexStart",
    RENDER_CONFIG_PERCENTILE = "percentile",
    RENDER_CONFIG_SCALING_ALPHA = "scalingAlpha",
    RENDER_CONFIG_SCALING_GAMMA = "scalingGamma",
    RENDER_CONFIG_NAN_COLOR_HEX = "nanColorHex",
    RENDER_CONFIG_NAN_ALPHA = "nanAlpha",
    RENDER_CONFIG_USE_SMOOTHED_BIAS_CONTRAST = "useSmoothedBiasContrast",

    CONTOUR_CONFIG_GENERATOR_TYPE = "contourGeneratorType",
    CONTOUR_CONFIG_SMOOTHING_MODE = "contourSmoothingMode",
    CONTOUR_CONFIG_SMOOTHING_FACTOR = "contourSmoothingFactor",
    CONTOUR_CONFIG_NUM_LEVELS = "contourNumLevels",
    CONTOUR_CONFIG_THICKNESS = "contourThickness",
    CONTOUR_CONFIG_COLORMAP_ENABLED = "contourColormapEnabled",
    CONTOUR_CONFIG_COLOR = "contourColor",
    CONTOUR_CONFIG_COLORMAP = "contourColormap",

    VECTOR_OVERLAY_PIXEL_AVERAGING = "vectorOverlayPixelAveraging",
    VECTOR_OVERLAY_FRACTIONAL_INTENSITY = "vectorOverlayFractionalIntensity",
    VECTOR_OVERLAY_THICKNESS = "vectorOverlayThickness",
    VECTOR_OVERLAY_COLORMAP_ENABLED = "vectorOverlayColormapEnabled",
    VECTOR_OVERLAY_COLOR = "vectorOverlayColor",
    VECTOR_OVERLAY_COLORMAP = "vectorOverlayColormap",

    WCS_OVERLAY_AST_COLOR = "astColor",
    WCS_OVERLAY_AST_GRID_VISIBLE = "astGridVisible",
    WCS_OVERLAY_AST_LABELS_VISIBLE = "astLabelsVisible",
    WCS_OVERLAY_WCS_TYPE = "wcsType",
    WCS_OVERLAY_COLORBAR_VISIBLE = "colorbarVisible",
    WCS_OVERLAY_COLORBAR_INTERACTIVE = "colorbarInteractive",
    WCS_OVERLAY_COLORBAR_POSITION = "colorbarPosition",
    WCS_OVERLAY_COLORBAR_WIDTH = "colorbarWidth",
    WCS_OVERLAY_COLORBAR_TICKS_DENSITY = "colorbarTicksDensity",
    WCS_OVERLAY_COLORBAR_LABEL_VISIBLE = "colorbarLabelVisible",
    WCS_OVERLAY_BEAM_VISIBLE = "beamVisible",
    WCS_OVERLAY_BEAM_COLOR = "beamColor",
    WCS_OVERLAY_BEAM_TYPE = "beamType",
    WCS_OVERLAY_BEAM_WIDTH = "beamWidth",
    WCS_OVERLAY_CURSOR_INFO = "cursorInfoVisible",

    CATALOG_DISPLAYED_COLUMN_SIZE = "catalogDisplayedColumnSize",
    CATALOG_TABLE_SEPARATOR_POSITION = "catalogTableSeparatorPosition",

    REGION_COLOR = "regionColor",
    REGION_LINE_WIDTH = "regionLineWidth",
    REGION_DASH_LENGTH = "regionDashLength",
    REGION_TYPE = "regionType",
    REGION_CREATION_MODE = "regionCreationMode",
    REGION_SIZE = "regionSize",

    ANNOTATION_COLOR = "annotationColor",
    ANNOTATION_LINE_WIDTH = "annotationLineWidth",
    ANNOTATION_DASH_LENGTH = "annotationDashLength",
    POINT_ANNOTATION_SHAPE = "pointAnnotationShape",
    POINT_ANNOTATION_WIDTH = "pointAnnotationWidth",
    TEXT_ANNOTATION_LINE_WIDTH = "textAnnotationLineWidth",

    PERFORMANCE_IMAGE_COMPRESSION_QUALITY = "imageCompressionQuality",
    PERFORMANCE_ANIMATION_COMPRESSION_QUALITY = "animationCompressionQuality",
    PERFORMANCE_GPU_TILE_CACHE = "GPUTileCache",
    PERFORMANCE_SYSTEM_TILE_CACHE = "systemTileCache",
    PERFORMANCE_CONTOUR_DECIMATION = "contourDecimation",
    PERFORMANCE_CONTOUR_COMPRESSION_LEVEL = "contourCompressionLevel",
    PERFORMANCE_CONTOUR_CHUNK_SIZE = "contourChunkSize",
    PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH = "contourControlMapWidth",
    PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING = "streamContoursWhileZooming",
    PERFORMANCE_LOW_BAND_WIDTH_MODE = "lowBandwidthMode",
    PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES = "stopAnimationPlaybackMinutes",
    PERFORMANCE_LIMIT_OVERLAY_REDRAW = "limitOverlayRedraw",
    PERFORMANCE_PV_PREVIEW_CUBE_SIZE_LIMIT = "pvPreviewCubeSizeLimit",
    PERFORMANCE_PV_PREVIEW_CUBE_SIZE_LIMIT_UNIT = "pvPreviewCubeSizeLimitUnit",

    LOG_EVENT = "logEventList",

    TELEMETRY_UUID = "telemetryUuid",
    TELEMETRY_MODE = "telemetryMode",
    TELEMETRY_CONSENT_SHOWN = "telemetryConsentShown",
    TELEMETRY_LOGGING = "telemetryLogging",

    COMPATIBILITY_AIPS_BEAM_SUPPORT = "compatibilityAipsBeamSupport"
}

const DEFAULTS = {
    SILENT: {
        fileSortingString: "-date",
        fileFilteringType: FileFilteringType.Fuzzy,
        pixelGridVisible: false,
        pixelGridColor: "#FFFFFF",
        imageMultiPanelEnabled: false,
        imagePanelMode: ImagePanelMode.Dynamic,
        imagePanelColumns: 2,
        imagePanelRows: 2,
        statsPanelEnabled: false,
        statsPanelMode: 0,
        checkNewRelease: true,
        latestRelease: "v" + CARTA_INFO.version
    },
    GLOBAL: {
        theme: Theme.AUTO,
        autoLaunch: true,
        fileFilterMode: FileFilterMode.Content,
        layout: PresetLayout.DEFAULT,
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
        colormap: "inferno",
        colormapHex: "#FFFFFF",
        colormapHexStart: "#000000",
        percentile: 99.9,
        scalingAlpha: 1000,
        scalingGamma: 1,
        nanColorHex: "#137CBD",
        nanAlpha: 1,
        useSmoothedBiasContrast: true
    },
    CONTOUR_CONFIG: {
        contourGeneratorType: ContourGeneratorType.StartStepMultiplier,
        contourSmoothingMode: CARTA.SmoothingMode.GaussianBlur,
        contourSmoothingFactor: 4,
        contourNumLevels: 5,
        contourThickness: 1,
        contourColormapEnabled: false,
        contourColor: Colors.GREEN3,
        contourColormap: "viridis"
    },
    VECTOR_OVERLAY: {
        vectorOverlayPixelAveraging: 4,
        vectorOverlayFractionalIntensity: false,
        vectorOverlayThickness: 1,
        vectorOverlayColormapEnabled: false,
        vectorOverlayColor: Colors.GREEN3,
        vectorOverlayColormap: "viridis"
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
    REGION: {
        regionColor: "#2EE6D6",
        regionLineWidth: 2,
        regionDashLength: 0,
        regionType: CARTA.RegionType.RECTANGLE,
        regionCreationMode: RegionCreationMode.CENTER,
        regionSize: 30
    },
    ANNOTATION: {
        annotationColor: "#FFBA01",
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
        pvPreviewCubeSizeLimit: 1,
        pvPreviewCubeSizeLimitUnit: MemoryUnit.GB
    },
    LOG_EVENT: {
        eventLoggingEnabled: []
    },
    CATALOG: {
        catalogDisplayedColumnSize: 10,
        catalogTableSeparatorPosition: "60%"
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
 * All the preferences NOT in the preference dialog
 */
export class PreferenceSilentSettings {
    @computed get fileSortingString(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.SILENT_FILE_SORTING_STRING) ?? DEFAULTS.SILENT.fileSortingString;
    }

    @computed get fileFilteringType(): FileFilteringType {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.SILENT_FILE_FILTERING_TYPE) ?? DEFAULTS.SILENT.fileFilteringType;
    }

    @computed get pixelGridVisible(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.SILENT_PIXEL_GRID_VISIBLE) ?? DEFAULTS.SILENT.pixelGridVisible;
    }

    @computed get pixelGridColor(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.SILENT_PIXEL_GRID_COLOR) ?? DEFAULTS.SILENT.pixelGridColor;
    }

    @computed get imageMultiPanelEnabled(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.SILENT_IMAGE_MULTI_PANEL_ENABLED) ?? DEFAULTS.SILENT.imagePanelMode;
    }

    @computed get imagePanelMode(): ImagePanelMode {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.SILENT_IMAGE_PANEL_MODE) ?? DEFAULTS.SILENT.imagePanelMode;
    }

    @computed get imagePanelColumns(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.SILENT_IMAGE_PANEL_COLUMNS) ?? DEFAULTS.SILENT.imagePanelColumns;
    }

    @computed get imagePanelRows(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.SILENT_IMAGE_PANEL_ROWS) ?? DEFAULTS.SILENT.imagePanelRows;
    }

    @computed get statsPanelEnabled(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.SILENT_STATS_PANEL_ENABLED) ?? DEFAULTS.SILENT.statsPanelEnabled;
    }

    @computed get statsPanelMode(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.SILENT_STATS_PANEL_MODE) ?? DEFAULTS.SILENT.statsPanelMode;
    }

    // getters for showing new release
    @computed get checkNewRelease(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.SILENT_CHECK_NEW_RELEASE) ?? DEFAULTS.SILENT.checkNewRelease;
    }

    @computed get latestRelease(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.SILENT_LATEST_RELEASE) ?? DEFAULTS.SILENT.latestRelease;
    }

    /**
     * Reset the Silent preference settings
     */
    @action resetSilentSettings = () => {
        PreferenceStore.Instance.clearPreferences([
            PreferenceKeys.SILENT_FILE_SORTING_STRING,
            PreferenceKeys.SILENT_FILE_FILTERING_TYPE,
            PreferenceKeys.SILENT_PIXEL_GRID_VISIBLE,
            PreferenceKeys.SILENT_PIXEL_GRID_COLOR,
            PreferenceKeys.SILENT_IMAGE_MULTI_PANEL_ENABLED,
            PreferenceKeys.SILENT_IMAGE_PANEL_MODE,
            PreferenceKeys.SILENT_IMAGE_PANEL_COLUMNS,
            PreferenceKeys.SILENT_IMAGE_PANEL_ROWS
        ]);
    };
}

export class PreferenceGlobalSettings {
    // getters for global settings
    @computed get theme(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.GLOBAL_THEME) ?? DEFAULTS.GLOBAL.theme;
    }

    @computed get autoLaunch(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.GLOBAL_AUTOLAUNCH) ?? DEFAULTS.GLOBAL.autoLaunch;
    }

    @computed get fileFilterMode(): FileFilterMode {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.GLOBAL_FILE_FILTER_MODE) ?? DEFAULTS.GLOBAL.fileFilterMode;
    }

    @computed get layout(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.GLOBAL_LAYOUT) ?? DEFAULTS.GLOBAL.layout;
    }

    @computed get cursorPosition(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.GLOBAL_CURSOR_POSITION) ?? DEFAULTS.GLOBAL.cursorPosition;
    }

    @computed get zoomMode(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.GLOBAL_ZOOM_MODE) ?? DEFAULTS.GLOBAL.zoomMode;
    }

    @computed get zoomPoint(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.GLOBAL_ZOOM_POINT) ?? DEFAULTS.GLOBAL.zoomPoint;
    }

    @computed get dragPanning(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.GLOBAL_DRAG_PANNING) ?? DEFAULTS.GLOBAL.dragPanning;
    }

    @computed get spectralMatchingType(): SpectralType {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.GLOBAL_SPECTRAL_MATCHING_TYPE) ?? DEFAULTS.GLOBAL.spectralMatchingType;
    }

    @computed get autoWCSMatching(): WCSMatchingType {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING) ?? DEFAULTS.GLOBAL.autoWCSMatching;
    }

    public isWCSMatchingEnabled = (matchingType: WCSMatchingType): boolean => {
        if (WCSMatching.isTypeValid(matchingType) && matchingType & PreferenceStore.Instance.preferences.get(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING)) {
            return true;
        }
        return false;
    };

    @computed get transparentImageBackground(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.GLOBAL_TRANSPARENT_IMAGE_BACKGROUND) ?? DEFAULTS.GLOBAL.transparentImageBackground;
    }

    @computed get codeSnippetsEnabled(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.GLOBAL_CODE_SNIPPETS_ENABLED) ?? DEFAULTS.GLOBAL.codeSnippetsEnabled;
    }

    @computed get keepLastUsedFolder(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.GLOBAL_KEEP_LAST_USED_FOLDER) ?? DEFAULTS.GLOBAL.keepLastUsedFolder;
    }

    @computed get lastUsedFolder(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.GLOBAL_SAVED_LAST_FOLDER) ?? DEFAULTS.GLOBAL.lastUsedFolder;
    }

    @computed get isZoomRAWMode(): boolean {
        return this.zoomMode === Zoom.FULL;
    }

    @computed get isCursorFrozen(): boolean {
        return this.cursorPosition === CursorPosition.FIXED;
    }

    /**
     * Reset the Global preference settings
     */
    @action resetGlobalSettings = () => {
        PreferenceStore.Instance.clearPreferences([
            PreferenceKeys.GLOBAL_THEME,
            PreferenceKeys.GLOBAL_AUTOLAUNCH,
            PreferenceKeys.GLOBAL_FILE_FILTER_MODE,
            PreferenceKeys.GLOBAL_LAYOUT,
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
}

export class PreferenceRenderSettings {
    // getters for render config
    @computed get scaling(): FrameScaling {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.RENDER_CONFIG_SCALING) ?? DEFAULTS.RENDER_CONFIG.scaling;
    }

    @computed get colormap(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.RENDER_CONFIG_COLORMAP) ?? DEFAULTS.RENDER_CONFIG.colormap;
    }

    @computed get colormapHex(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.RENDER_CONFIG_COLORMAP_HEX) ?? DEFAULTS.RENDER_CONFIG.colormapHex;
    }

    @computed get colormapHexStart(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.RENDER_CONFIG_COLORMAP_HEX_START) ?? DEFAULTS.RENDER_CONFIG.colormapHexStart;
    }

    @computed get percentile(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.RENDER_CONFIG_PERCENTILE) ?? DEFAULTS.RENDER_CONFIG.percentile;
    }

    @computed get scalingAlpha(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA) ?? DEFAULTS.RENDER_CONFIG.scalingAlpha;
    }

    @computed get scalingGamma(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.RENDER_CONFIG_SCALING_GAMMA) ?? DEFAULTS.RENDER_CONFIG.scalingGamma;
    }

    @computed get nanColorHex(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX) ?? DEFAULTS.RENDER_CONFIG.nanColorHex;
    }

    @computed get nanAlpha(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.RENDER_CONFIG_NAN_ALPHA) ?? DEFAULTS.RENDER_CONFIG.nanAlpha;
    }

    @computed get useSmoothedBiasContrast(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.RENDER_CONFIG_USE_SMOOTHED_BIAS_CONTRAST) ?? DEFAULTS.RENDER_CONFIG.useSmoothedBiasContrast;
    }

    /**
     * Reset the render configuration settings
     */
    @action resetRenderConfigSettings = () => {
        PreferenceStore.Instance.clearPreferences([
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
}

export class PreferenceContourSettings {
    // getters for Contour Config
    @computed get generatorType(): ContourGeneratorType {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.CONTOUR_CONFIG_GENERATOR_TYPE) ?? DEFAULTS.CONTOUR_CONFIG.contourGeneratorType;
    }

    @computed get colormapEnabled(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.CONTOUR_CONFIG_COLORMAP_ENABLED) ?? DEFAULTS.CONTOUR_CONFIG.contourColormapEnabled;
    }

    @computed get colormap(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.CONTOUR_CONFIG_COLORMAP) ?? DEFAULTS.CONTOUR_CONFIG.contourColormap;
    }

    @computed get color(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.CONTOUR_CONFIG_COLOR) ?? DEFAULTS.CONTOUR_CONFIG.contourColor;
    }

    @computed get smoothingMode(): CARTA.SmoothingMode {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.CONTOUR_CONFIG_SMOOTHING_MODE) ?? DEFAULTS.CONTOUR_CONFIG.contourSmoothingMode;
    }

    @computed get smoothingFactor(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.CONTOUR_CONFIG_SMOOTHING_FACTOR) ?? DEFAULTS.CONTOUR_CONFIG.contourSmoothingFactor;
    }

    @computed get numLevels(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.CONTOUR_CONFIG_NUM_LEVELS) ?? DEFAULTS.CONTOUR_CONFIG.contourNumLevels;
    }

    @computed get thickness(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.CONTOUR_CONFIG_THICKNESS) ?? DEFAULTS.CONTOUR_CONFIG.contourThickness;
    }

    @computed get decimation(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_DECIMATION) ?? DEFAULTS.PERFORMANCE.contourDecimation;
    }

    @computed get compressionLevel(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_COMPRESSION_LEVEL) ?? DEFAULTS.PERFORMANCE.contourCompressionLevel;
    }

    @computed get chunkSize(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_CHUNK_SIZE) ?? DEFAULTS.PERFORMANCE.contourChunkSize;
    }

    /**
     * Reset the contour configuration settings
     */
    @action resetContourConfigSettings = () => {
        PreferenceStore.Instance.clearPreferences([
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
}

export class PreferenceVectorOverlaySettings {
    // getters for vector overlay
    @computed get pixelAveraging(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.VECTOR_OVERLAY_PIXEL_AVERAGING) ?? DEFAULTS.VECTOR_OVERLAY.vectorOverlayPixelAveraging;
    }

    @computed get fractionalIntensity(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.VECTOR_OVERLAY_FRACTIONAL_INTENSITY) ?? DEFAULTS.VECTOR_OVERLAY.vectorOverlayFractionalIntensity;
    }

    @computed get thickness(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.VECTOR_OVERLAY_THICKNESS) ?? DEFAULTS.VECTOR_OVERLAY.vectorOverlayThickness;
    }

    @computed get colormapEnabled(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.VECTOR_OVERLAY_COLORMAP_ENABLED) ?? DEFAULTS.VECTOR_OVERLAY.vectorOverlayColormapEnabled;
    }

    @computed get color(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.VECTOR_OVERLAY_COLOR) ?? DEFAULTS.VECTOR_OVERLAY.vectorOverlayColor;
    }

    @computed get colormap(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.VECTOR_OVERLAY_COLORMAP) ?? DEFAULTS.VECTOR_OVERLAY.vectorOverlayColormap;
    }

    /**
     * Reset the vector overlay configuration settings
     */
    @action resetVectorOverlayConfigSettings = () => {
        PreferenceStore.Instance.clearPreferences([
            PreferenceKeys.VECTOR_OVERLAY_PIXEL_AVERAGING,
            PreferenceKeys.VECTOR_OVERLAY_FRACTIONAL_INTENSITY,
            PreferenceKeys.VECTOR_OVERLAY_COLOR,
            PreferenceKeys.VECTOR_OVERLAY_COLORMAP,
            PreferenceKeys.VECTOR_OVERLAY_COLORMAP_ENABLED,
            PreferenceKeys.VECTOR_OVERLAY_THICKNESS
        ]);
    };
}

export class PreferenceWcsOverlaySettings {
    // getters for WCS overlay
    @computed get astColor(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.WCS_OVERLAY_AST_COLOR) ?? DEFAULTS.WCS_OVERLAY.astColor;
    }

    @computed get astGridVisible(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE) ?? DEFAULTS.WCS_OVERLAY.astGridVisible;
    }

    @computed get astLabelsVisible(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE) ?? DEFAULTS.WCS_OVERLAY.astLabelsVisible;
    }

    @computed get wcsType(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.WCS_OVERLAY_WCS_TYPE) ?? DEFAULTS.WCS_OVERLAY.wcsType;
    }

    @computed get colorbarVisible(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_VISIBLE) ?? DEFAULTS.WCS_OVERLAY.colorbarVisible;
    }

    @computed get colorbarInteractive(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_INTERACTIVE) ?? DEFAULTS.WCS_OVERLAY.colorbarInteractive;
    }

    @computed get colorbarPosition(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_POSITION) ?? DEFAULTS.WCS_OVERLAY.colorbarPosition;
    }

    @computed get colorbarWidth(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_WIDTH) ?? DEFAULTS.WCS_OVERLAY.colorbarWidth;
    }

    @computed get colorbarTicksDensity(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_TICKS_DENSITY) ?? DEFAULTS.WCS_OVERLAY.colorbarTicksDensity;
    }

    @computed get colorbarLabelVisible(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_LABEL_VISIBLE) ?? DEFAULTS.WCS_OVERLAY.colorbarLabelVisible;
    }

    @computed get beamVisible(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_VISIBLE) ?? DEFAULTS.WCS_OVERLAY.beamVisible;
    }

    @computed get beamColor(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_COLOR) ?? DEFAULTS.WCS_OVERLAY.beamColor;
    }

    @computed get beamType(): BeamType {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_TYPE) ?? DEFAULTS.WCS_OVERLAY.beamType;
    }

    @computed get beamWidth(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_WIDTH) ?? DEFAULTS.WCS_OVERLAY.beamWidth;
    }

    @computed get cursorInfoVisible(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.WCS_OVERLAY_CURSOR_INFO) ?? DEFAULTS.WCS_OVERLAY.cursorInfoVisible;
    }

    /**
     * Reset the overlay configuration settings
     */
    @action resetOverlayConfigSettings = () => {
        PreferenceStore.Instance.clearPreferences([
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
}

export class PreferenceCatalogSettings {
    @computed get displayedColumnSize(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE) ?? DEFAULTS.CATALOG.catalogDisplayedColumnSize;
    }

    @computed get tableSeparatorPosition(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.CATALOG_TABLE_SEPARATOR_POSITION) ?? DEFAULTS.CATALOG.catalogTableSeparatorPosition;
    }

    /**
     * Reset the catalog settings
     */
    @action resetCatalogSettings = () => {
        PreferenceStore.Instance.clearPreferences([PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE, PreferenceKeys.CATALOG_TABLE_SEPARATOR_POSITION]);
    };
}

export class PreferenceRegionSettings {
    // getters for region
    @computed get color(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.REGION_COLOR) ?? DEFAULTS.REGION.regionColor;
    }

    @computed get lineWidth(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.REGION_LINE_WIDTH) ?? DEFAULTS.REGION.regionLineWidth;
    }

    @computed get dashLength(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.REGION_DASH_LENGTH) ?? DEFAULTS.REGION.regionDashLength;
    }

    @computed get type(): CARTA.RegionType {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.REGION_TYPE) ?? DEFAULTS.REGION.regionType;
    }

    @computed get creationMode(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.REGION_CREATION_MODE) ?? DEFAULTS.REGION.regionCreationMode;
    }

    @computed get size(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.REGION_SIZE) ?? DEFAULTS.REGION.regionSize;
    }

    @computed get isCornerMode(): boolean {
        return this.creationMode === RegionCreationMode.CORNER;
    }

    /**
     * Reset the region settings
     */
    @action resetRegionSettings = () => {
        PreferenceStore.Instance.clearPreferences([
            PreferenceKeys.REGION_COLOR,
            PreferenceKeys.REGION_CREATION_MODE,
            PreferenceKeys.REGION_DASH_LENGTH,
            PreferenceKeys.REGION_LINE_WIDTH,
            PreferenceKeys.REGION_TYPE,
            PreferenceKeys.REGION_SIZE
        ]);
    };
}

export class PreferenceAnnotationSettings {
    // getters for annotation
    @computed get color(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.ANNOTATION_COLOR) ?? DEFAULTS.ANNOTATION.annotationColor;
    }

    @computed get lineWidth(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.ANNOTATION_LINE_WIDTH) ?? DEFAULTS.ANNOTATION.annotationLineWidth;
    }

    @computed get dashLength(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.ANNOTATION_DASH_LENGTH) ?? DEFAULTS.ANNOTATION.annotationDashLength;
    }

    @computed get pointShape(): CARTA.PointAnnotationShape {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.POINT_ANNOTATION_SHAPE) ?? DEFAULTS.ANNOTATION.pointAnnotationShape;
    }

    @computed get pointWidth(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.POINT_ANNOTATION_WIDTH) ?? DEFAULTS.ANNOTATION.pointAnnotationWidth;
    }

    @computed get textLineWidth(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.TEXT_ANNOTATION_LINE_WIDTH) ?? DEFAULTS.ANNOTATION.textAnnotationLineWidth;
    }

    /**
     * Reset the annotation settings
     */
    @action resetAnnotationSettings = () => {
        PreferenceStore.Instance.clearPreferences([
            PreferenceKeys.ANNOTATION_COLOR,
            PreferenceKeys.ANNOTATION_DASH_LENGTH,
            PreferenceKeys.ANNOTATION_LINE_WIDTH,
            PreferenceKeys.POINT_ANNOTATION_SHAPE,
            PreferenceKeys.POINT_ANNOTATION_WIDTH,
            PreferenceKeys.TEXT_ANNOTATION_LINE_WIDTH
        ]);
    };
}

export class PreferencePerformanceSettings {
    // getters for performance
    @computed get imageCompressionQuality(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.PERFORMANCE_IMAGE_COMPRESSION_QUALITY) ?? DEFAULTS.PERFORMANCE.imageCompressionQuality;
    }

    @computed get animationCompressionQuality(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.PERFORMANCE_ANIMATION_COMPRESSION_QUALITY) ?? DEFAULTS.PERFORMANCE.animationCompressionQuality;
    }

    @computed get gpuTileCache(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.PERFORMANCE_GPU_TILE_CACHE) ?? DEFAULTS.PERFORMANCE.GPUTileCache;
    }

    @computed get systemTileCache(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.PERFORMANCE_SYSTEM_TILE_CACHE) ?? DEFAULTS.PERFORMANCE.systemTileCache;
    }

    @computed get contourControlMapWidth(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH) ?? DEFAULTS.PERFORMANCE.contourControlMapWidth;
    }

    @computed get streamContoursWhileZooming(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING) ?? DEFAULTS.PERFORMANCE.streamContoursWhileZooming;
    }

    @computed get lowBandwidthMode(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.PERFORMANCE_LOW_BAND_WIDTH_MODE) ?? DEFAULTS.PERFORMANCE.lowBandwidthMode;
    }

    @computed get stopAnimationPlaybackMinutes(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES) ?? DEFAULTS.PERFORMANCE.stopAnimationPlaybackMinutes;
    }

    @computed get pvPreivewCubeSizeLimit(): number {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.PERFORMANCE_PV_PREVIEW_CUBE_SIZE_LIMIT) ?? DEFAULTS.PERFORMANCE.pvPreviewCubeSizeLimit;
    }

    @computed get pvPreivewCubeSizeLimitUnit(): string {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.PERFORMANCE_PV_PREVIEW_CUBE_SIZE_LIMIT_UNIT) ?? DEFAULTS.PERFORMANCE.pvPreviewCubeSizeLimitUnit;
    }

    @computed get limitOverlayRedraw(): boolean {
        return PreferenceStore.Instance.preferences.get(PreferenceKeys.PERFORMANCE_LIMIT_OVERLAY_REDRAW) ?? DEFAULTS.PERFORMANCE.limitOverlayRedraw;
    }

    /**
     * Reset the performance settings
     */
    @action resetPerformanceSettings = () => {
        PreferenceStore.Instance.clearPreferences([
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
}

/**
 * The store manages the preference setting
 */
export class PreferenceStore {
    private static staticInstance: PreferenceStore;
    @observable silent: PreferenceSilentSettings;
    @observable global: PreferenceGlobalSettings;
    @observable render: PreferenceRenderSettings;
    @observable contour: PreferenceContourSettings;
    @observable vectorOverlay: PreferenceVectorOverlaySettings;
    @observable wcsOverlay: PreferenceWcsOverlaySettings;
    @observable catalog: PreferenceCatalogSettings;
    @observable region: PreferenceRegionSettings;
    @observable annotation: PreferenceAnnotationSettings;
    @observable performance: PreferencePerformanceSettings;
    // @observable telemetry: PreferenceTelemetrySettings;

    static get Instance() {
        if (!PreferenceStore.staticInstance) {
            PreferenceStore.staticInstance = new PreferenceStore();
        }
        return PreferenceStore.staticInstance;
    }

    @observable preferences: Map<PreferenceKeys, any>;

    /**
     * Whether the preference data is initialized from the preference file or localStorage.
     */
    @observable preferenceReady: boolean = false;

    @computed get isSelectingAllLogEvents(): boolean {
        return this.preferences.get(PreferenceKeys.LOG_EVENT)?.length === Event.EVENT_NUMBER;
    }

    @computed get isSelectingIndeterminateLogEvents(): boolean {
        const selected = this.preferences.get(PreferenceKeys.LOG_EVENT)?.length;
        return selected > 0 && selected < Event.EVENT_NUMBER;
    }

    public isEventLoggingEnabled = (eventType: CARTA.EventType): boolean => {
        if (Event.isTypeValid(eventType)) {
            const logEvents = this.preferences.get(PreferenceKeys.LOG_EVENT);
            if (logEvents && Array.isArray(logEvents)) {
                return logEvents.includes(eventType);
            }
        }
        return false;
    };

    @computed get enabledLoggingEventNames(): string[] {
        return this.preferences.get(PreferenceKeys.LOG_EVENT) ?? [];
    }

    // getters for telemetry
    @computed get telemetryConsentShown(): boolean {
        return this.preferences.get(PreferenceKeys.TELEMETRY_CONSENT_SHOWN) ?? DEFAULTS.TELEMETRY.telemetryConsentShown;
    }

    @computed get telemetryMode(): TelemetryMode {
        return this.preferences.get(PreferenceKeys.TELEMETRY_MODE) ?? DEFAULTS.TELEMETRY.telemetryMode;
    }

    @computed get telemetryLogging(): boolean {
        return this.preferences.get(PreferenceKeys.TELEMETRY_LOGGING) ?? DEFAULTS.TELEMETRY.telemetryLogging;
    }

    @computed get telemetryUuid(): string {
        return this.preferences.get(PreferenceKeys.TELEMETRY_UUID);
    }

    // getters for compatibility
    @computed get aipsBeamSupport(): boolean {
        return this.preferences.get(PreferenceKeys.COMPATIBILITY_AIPS_BEAM_SUPPORT) ?? DEFAULTS.COMPATIBILITY.aipsBeamSupport;
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
     * Reset the telemetry settings
     */
    @action resetTelemetrySettings = () => {
        this.clearPreferences([PreferenceKeys.TELEMETRY_CONSENT_SHOWN, PreferenceKeys.TELEMETRY_MODE, PreferenceKeys.TELEMETRY_LOGGING]);
    };

    /**
     * Fetch the values of the preference keys
     */
    @flow.bound *fetchPreferences() {
        yield this.upgradePreferences();

        const preferences = yield ApiService.Instance.getPreferences();
        if (preferences) {
            const keys = Object.keys(preferences);
            for (const key of keys) {
                const val = preferences[key];
                this.preferences.set(key as PreferenceKeys, val);
            }
        }
        this.preferenceReady = true;
    }

    /**
     * Perform localStorage upgrade by iterating over the old CARTA version keys. This list consists of keys that were present when CARTA used a single localStorage entry per key
     */
    private upgradePreferences = async () => {
        if (!localStorage.getItem("preferences")) {
            const stringKeys = [
                PreferenceKeys.GLOBAL_THEME,
                PreferenceKeys.GLOBAL_LAYOUT,
                PreferenceKeys.GLOBAL_CURSOR_POSITION,
                PreferenceKeys.GLOBAL_ZOOM_MODE,
                PreferenceKeys.GLOBAL_ZOOM_POINT,
                PreferenceKeys.GLOBAL_SPECTRAL_MATCHING_TYPE,
                PreferenceKeys.RENDER_CONFIG_COLORMAP,
                PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX,
                PreferenceKeys.CONTOUR_CONFIG_GENERATOR_TYPE,
                PreferenceKeys.CONTOUR_CONFIG_COLOR,
                PreferenceKeys.CONTOUR_CONFIG_COLORMAP,
                PreferenceKeys.WCS_OVERLAY_WCS_TYPE,
                PreferenceKeys.WCS_OVERLAY_COLORBAR_POSITION,
                PreferenceKeys.WCS_OVERLAY_BEAM_COLOR,
                PreferenceKeys.WCS_OVERLAY_BEAM_TYPE,
                PreferenceKeys.REGION_COLOR,
                PreferenceKeys.REGION_CREATION_MODE,
                PreferenceKeys.WCS_OVERLAY_AST_COLOR,
                PreferenceKeys.CATALOG_TABLE_SEPARATOR_POSITION,
                PreferenceKeys.SILENT_PIXEL_GRID_COLOR
            ];

            const intKeys = [
                PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING,
                PreferenceKeys.RENDER_CONFIG_SCALING,
                PreferenceKeys.CONTOUR_CONFIG_SMOOTHING_MODE,
                PreferenceKeys.CONTOUR_CONFIG_SMOOTHING_FACTOR,
                PreferenceKeys.CONTOUR_CONFIG_NUM_LEVELS,
                PreferenceKeys.REGION_DASH_LENGTH,
                PreferenceKeys.REGION_TYPE,
                PreferenceKeys.PERFORMANCE_IMAGE_COMPRESSION_QUALITY,
                PreferenceKeys.PERFORMANCE_ANIMATION_COMPRESSION_QUALITY,
                PreferenceKeys.PERFORMANCE_GPU_TILE_CACHE,
                PreferenceKeys.PERFORMANCE_SYSTEM_TILE_CACHE,
                PreferenceKeys.PERFORMANCE_CONTOUR_DECIMATION,
                PreferenceKeys.PERFORMANCE_CONTOUR_COMPRESSION_LEVEL,
                PreferenceKeys.PERFORMANCE_CONTOUR_CHUNK_SIZE,
                PreferenceKeys.PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH,
                PreferenceKeys.PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES,
                PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE
            ];

            const numberKeys = [
                PreferenceKeys.RENDER_CONFIG_PERCENTILE,
                PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA,
                PreferenceKeys.RENDER_CONFIG_SCALING_GAMMA,
                PreferenceKeys.RENDER_CONFIG_NAN_ALPHA,
                PreferenceKeys.CONTOUR_CONFIG_THICKNESS,
                PreferenceKeys.WCS_OVERLAY_COLORBAR_WIDTH,
                PreferenceKeys.WCS_OVERLAY_COLORBAR_TICKS_DENSITY,
                PreferenceKeys.WCS_OVERLAY_BEAM_WIDTH,
                PreferenceKeys.REGION_LINE_WIDTH
            ];

            const booleanKeys = [
                PreferenceKeys.GLOBAL_AUTOLAUNCH,
                PreferenceKeys.GLOBAL_DRAG_PANNING,
                PreferenceKeys.GLOBAL_TRANSPARENT_IMAGE_BACKGROUND,
                PreferenceKeys.RENDER_CONFIG_USE_SMOOTHED_BIAS_CONTRAST,
                PreferenceKeys.CONTOUR_CONFIG_COLORMAP_ENABLED,
                PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE,
                PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE,
                PreferenceKeys.WCS_OVERLAY_COLORBAR_VISIBLE,
                PreferenceKeys.WCS_OVERLAY_COLORBAR_INTERACTIVE,
                PreferenceKeys.WCS_OVERLAY_COLORBAR_LABEL_VISIBLE,
                PreferenceKeys.WCS_OVERLAY_BEAM_VISIBLE,
                PreferenceKeys.PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING,
                PreferenceKeys.PERFORMANCE_LOW_BAND_WIDTH_MODE,
                PreferenceKeys.SILENT_PIXEL_GRID_VISIBLE
            ];

            const preferenceObject = {};

            for (const key of stringKeys) {
                const entry = localStorage.getItem(key);
                if (entry) {
                    preferenceObject[key] = entry;
                }
            }

            for (const key of intKeys) {
                const entry = parseInt(localStorage.getItem(key));
                if (isFinite(entry)) {
                    preferenceObject[key] = entry;
                }
            }

            for (const key of numberKeys) {
                const entry = parseFloat(localStorage.getItem(key));
                if (isFinite(entry)) {
                    preferenceObject[key] = entry;
                }
            }

            for (const key of booleanKeys) {
                const entryString = localStorage.getItem(key);
                if (entryString) {
                    preferenceObject[key] = parseBoolean(localStorage.getItem(key), false);
                }
            }

            const logEntryString = localStorage.getItem(PreferenceKeys.LOG_EVENT);
            if (logEntryString) {
                try {
                    const logEntries = JSON.parse(logEntryString);
                    if (logEntries && Array.isArray(logEntries)) {
                        preferenceObject[PreferenceKeys.LOG_EVENT] = logEntries;
                    }
                } catch (e) {
                    console.log("Problem parsing log events");
                }
            }

            // Manual schema adjustments

            // Beam -> beam and Solid -> solid
            if (preferenceObject[PreferenceKeys.WCS_OVERLAY_BEAM_TYPE]) {
                preferenceObject[PreferenceKeys.WCS_OVERLAY_BEAM_TYPE] = preferenceObject[PreferenceKeys.WCS_OVERLAY_BEAM_TYPE].toLowerCase();
            }

            // 1.0x to full
            if (preferenceObject[PreferenceKeys.GLOBAL_ZOOM_MODE] === "1.0x") {
                preferenceObject[PreferenceKeys.GLOBAL_ZOOM_MODE] = "full";
            }

            for (const key of Object.keys(preferenceObject)) {
                this.preferences.set(key as PreferenceKeys, preferenceObject[key]);
            }

            preferenceObject["version"] = 1;
            await ApiService.Instance.setPreferences(preferenceObject);
        }
    };

    private constructor() {
        makeObservable(this);
        this.preferences = new Map<PreferenceKeys, any>();
        this.silent = new PreferenceSilentSettings();
        this.global = new PreferenceGlobalSettings();
        this.render = new PreferenceRenderSettings();
        this.contour = new PreferenceContourSettings();
        this.vectorOverlay = new PreferenceVectorOverlaySettings();
        this.wcsOverlay = new PreferenceWcsOverlaySettings();
        this.catalog = new PreferenceCatalogSettings();
        this.region = new PreferenceRegionSettings();
        this.annotation = new PreferenceAnnotationSettings();
        this.performance = new PreferencePerformanceSettings();
    }
}
