import {action, computed, observable, makeObservable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {BeamType, ContourGeneratorType, FileFilteringType, FrameScaling} from "stores";
import {CompressionQuality, CursorInfoVisibility, CursorPosition, Event, ImagePanelMode, PresetLayout, RegionCreationMode, SpectralType, Theme, TileCache, WCSMatchingType, WCSType, Zoom, ZoomPoint} from "models";
import {parseBoolean} from "utilities";
import {ApiService} from "services";

export enum PreferenceKeys {
    SILENT_FILE_SORTING_STRING = "fileSortingString",
    SILENT_FILE_FILTERING_TYPE = "fileFilteringType",

    GLOBAL_THEME = "theme",
    GLOBAL_AUTOLAUNCH = "autoLaunch",
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
    RENDER_CONFIG_PERCENTILE = "percentile",
    RENDER_CONFIG_SCALING_ALPHA = "scalingAlpha",
    RENDER_CONFIG_SCALING_GAMMA = "scalingGamma",
    RENDER_CONFIG_NAN_COLOR_HEX = "nanColorHex",
    RENDER_CONFIG_NAN_ALPHA = "nanAlpha",
    RENDER_CONFIG_USE_SMOOTHED_BIAS_CONTRAST = "useSmoothedBiasContrast",

    CONTOUR_CONFIG_CONTOUR_GENERATOR_TYPE = "contourGeneratorType",
    CONTOUR_CONFIG_CONTOUR_SMOOTHING_MODE = "contourSmoothingMode",
    CONTOUR_CONFIG_CONTOUR_SMOOTHING_FACTOR = "contourSmoothingFactor",
    CONTOUR_CONFIG_CONTOUR_NUM_LEVELS = "contourNumLevels",
    CONTOUR_CONFIG_CONTOUR_THICKNESS = "contourThickness",
    CONTOUR_CONFIG_CONTOUR_COLORMAP_ENABLED = "contourColormapEnabled",
    CONTOUR_CONFIG_CONTOUR_COLOR = "contourColor",
    CONTOUR_CONFIG_CONTOUR_COLORMAP = "contourColormap",

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

    REGION_COLOR = "regionColor",
    REGION_LINE_WIDTH = "regionLineWidth",
    REGION_DASH_LENGTH = "regionDashLength",
    REGION_TYPE = "regionType",
    REGION_CREATION_MODE = "regionCreationMode",
    REGION_SIZE = "regionSize",

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

    LOG_EVENT = "logEventList",

    CATALOG_DISPLAYED_COLUMN_SIZE = "catalogDisplayedColumnSize",
    CATALOG_TABLE_SEPARATOR_POSITION = "catalogTableSeparatorPosition",

    PIXEL_GRID_VISIBLE = "pixelGridVisible",
    PIXEL_GRID_COLOR = "pixelGridColor",
    IMAGE_MULTI_PANEL_ENABLED = "imageMultiPanelEnabled",
    IMAGE_PANEL_MODE = "imagePanelMode",
    IMAGE_PANEL_COLUMNS = "imagePanelColumns",
    IMAGE_PANEL_ROWS = "imagePanelRows"
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
        imagePanelRows: 2
    },
    GLOBAL: {
        theme: Theme.AUTO,
        autoLaunch: true,
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
        limitOverlayRedraw: true
    },
    LOG_EVENT: {
        eventLoggingEnabled: []
    },
    CATALOG: {
        catalogDisplayedColumnSize: 10,
        catalogTableSeparatorPosition: "60%"
    }
};

export class PreferenceStore {
    private static staticInstance: PreferenceStore;

    static get Instance() {
        if (!PreferenceStore.staticInstance) {
            PreferenceStore.staticInstance = new PreferenceStore();
        }
        return PreferenceStore.staticInstance;
    }

    @observable preferences: Map<PreferenceKeys, any>;
    @observable supportsServer: boolean;

    // getters for global settings
    @computed get theme(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_THEME) ?? DEFAULTS.GLOBAL.theme;
    }

    @computed get autoLaunch(): boolean {
        return this.preferences.get(PreferenceKeys.GLOBAL_AUTOLAUNCH) ?? DEFAULTS.GLOBAL.autoLaunch;
    }

    @computed get fileSortingString(): string {
        return this.preferences.get(PreferenceKeys.SILENT_FILE_SORTING_STRING) ?? DEFAULTS.SILENT.fileSortingString;
    }

    @computed get fileFilteringType(): FileFilteringType {
        return this.preferences.get(PreferenceKeys.SILENT_FILE_FILTERING_TYPE) ?? DEFAULTS.SILENT.fileFilteringType;
    }

    @computed get layout(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_LAYOUT) ?? DEFAULTS.GLOBAL.layout;
    }

    @computed get cursorPosition(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_CURSOR_POSITION) ?? DEFAULTS.GLOBAL.cursorPosition;
    }

    @computed get zoomMode(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_ZOOM_MODE) ?? DEFAULTS.GLOBAL.zoomMode;
    }

    @computed get zoomPoint(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_ZOOM_POINT) ?? DEFAULTS.GLOBAL.zoomPoint;
    }

    @computed get dragPanning(): boolean {
        return this.preferences.get(PreferenceKeys.GLOBAL_DRAG_PANNING) ?? DEFAULTS.GLOBAL.dragPanning;
    }

    @computed get spectralMatchingType(): SpectralType {
        return this.preferences.get(PreferenceKeys.GLOBAL_SPECTRAL_MATCHING_TYPE) ?? DEFAULTS.GLOBAL.spectralMatchingType;
    }

    @computed get autoWCSMatching(): WCSMatchingType {
        return this.preferences.get(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING) ?? DEFAULTS.GLOBAL.autoWCSMatching;
    }

    @computed get transparentImageBackground(): boolean {
        return this.preferences.get(PreferenceKeys.GLOBAL_TRANSPARENT_IMAGE_BACKGROUND) ?? DEFAULTS.GLOBAL.transparentImageBackground;
    }

    @computed get codeSnippetsEnabled(): boolean {
        return this.preferences.get(PreferenceKeys.GLOBAL_CODE_SNIPPETS_ENABLED) ?? DEFAULTS.GLOBAL.codeSnippetsEnabled;
    }

    @computed get keepLastUsedFolder(): boolean {
        return this.preferences.get(PreferenceKeys.GLOBAL_KEEP_LAST_USED_FOLDER) ?? DEFAULTS.GLOBAL.keepLastUsedFolder;
    }

    @computed get lastUsedFolder(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_SAVED_LAST_FOLDER) ?? DEFAULTS.GLOBAL.lastUsedFolder;
    }

    // getters for render config
    @computed get scaling(): FrameScaling {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_SCALING) ?? DEFAULTS.RENDER_CONFIG.scaling;
    }

    @computed get colormap(): string {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_COLORMAP) ?? DEFAULTS.RENDER_CONFIG.colormap;
    }

    @computed get percentile(): number {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_PERCENTILE) ?? DEFAULTS.RENDER_CONFIG.percentile;
    }

    @computed get scalingAlpha(): number {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA) ?? DEFAULTS.RENDER_CONFIG.scalingAlpha;
    }

    @computed get scalingGamma(): number {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_SCALING_GAMMA) ?? DEFAULTS.RENDER_CONFIG.scalingGamma;
    }

    @computed get nanColorHex(): string {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX) ?? DEFAULTS.RENDER_CONFIG.nanColorHex;
    }

    @computed get nanAlpha(): number {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_NAN_ALPHA) ?? DEFAULTS.RENDER_CONFIG.nanAlpha;
    }

    @computed get useSmoothedBiasContrast(): boolean {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_USE_SMOOTHED_BIAS_CONTRAST) ?? DEFAULTS.RENDER_CONFIG.useSmoothedBiasContrast;
    }

    // getters for Contour Config
    @computed get contourGeneratorType(): ContourGeneratorType {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_GENERATOR_TYPE) ?? DEFAULTS.CONTOUR_CONFIG.contourGeneratorType;
    }

    @computed get contourColormapEnabled(): boolean {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP_ENABLED) ?? DEFAULTS.CONTOUR_CONFIG.contourColormapEnabled;
    }

    @computed get contourColormap(): string {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP) ?? DEFAULTS.CONTOUR_CONFIG.contourColormap;
    }

    @computed get contourColor(): string {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLOR) ?? DEFAULTS.CONTOUR_CONFIG.contourColor;
    }

    @computed get contourSmoothingMode(): CARTA.SmoothingMode {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_MODE) ?? DEFAULTS.CONTOUR_CONFIG.contourSmoothingMode;
    }

    @computed get contourSmoothingFactor(): number {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_FACTOR) ?? DEFAULTS.CONTOUR_CONFIG.contourSmoothingFactor;
    }

    @computed get contourNumLevels(): number {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_NUM_LEVELS) ?? DEFAULTS.CONTOUR_CONFIG.contourNumLevels;
    }

    @computed get contourThickness(): number {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_THICKNESS) ?? DEFAULTS.CONTOUR_CONFIG.contourThickness;
    }

    @computed get contourDecimation(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_DECIMATION) ?? DEFAULTS.PERFORMANCE.contourDecimation;
    }

    @computed get contourCompressionLevel(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_COMPRESSION_LEVEL) ?? DEFAULTS.PERFORMANCE.contourCompressionLevel;
    }

    @computed get contourChunkSize(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_CHUNK_SIZE) ?? DEFAULTS.PERFORMANCE.contourChunkSize;
    }

    // getters for WCS overlay
    @computed get astColor(): string {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_AST_COLOR) ?? DEFAULTS.WCS_OVERLAY.astColor;
    }

    @computed get astGridVisible(): boolean {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE) ?? DEFAULTS.WCS_OVERLAY.astGridVisible;
    }

    @computed get astLabelsVisible(): boolean {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE) ?? DEFAULTS.WCS_OVERLAY.astLabelsVisible;
    }

    @computed get wcsType(): string {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_WCS_TYPE) ?? DEFAULTS.WCS_OVERLAY.wcsType;
    }

    @computed get colorbarVisible(): boolean {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_VISIBLE) ?? DEFAULTS.WCS_OVERLAY.colorbarVisible;
    }

    @computed get colorbarInteractive(): boolean {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_INTERACTIVE) ?? DEFAULTS.WCS_OVERLAY.colorbarInteractive;
    }

    @computed get colorbarPosition(): string {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_POSITION) ?? DEFAULTS.WCS_OVERLAY.colorbarPosition;
    }

    @computed get colorbarWidth(): number {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_WIDTH) ?? DEFAULTS.WCS_OVERLAY.colorbarWidth;
    }

    @computed get colorbarTicksDensity(): number {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_TICKS_DENSITY) ?? DEFAULTS.WCS_OVERLAY.colorbarTicksDensity;
    }

    @computed get colorbarLabelVisible(): boolean {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_COLORBAR_LABEL_VISIBLE) ?? DEFAULTS.WCS_OVERLAY.colorbarLabelVisible;
    }

    @computed get beamVisible(): boolean {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_VISIBLE) ?? DEFAULTS.WCS_OVERLAY.beamVisible;
    }

    @computed get beamColor(): string {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_COLOR) ?? DEFAULTS.WCS_OVERLAY.beamColor;
    }

    @computed get beamType(): BeamType {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_TYPE) ?? DEFAULTS.WCS_OVERLAY.beamType;
    }

    @computed get beamWidth(): number {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_WIDTH) ?? DEFAULTS.WCS_OVERLAY.beamWidth;
    }

    @computed get cursorInfoVisible(): string {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_CURSOR_INFO) ?? DEFAULTS.WCS_OVERLAY.cursorInfoVisible;
    }

    // getters for region
    @computed get regionColor(): string {
        return this.preferences.get(PreferenceKeys.REGION_COLOR) ?? DEFAULTS.REGION.regionColor;
    }

    @computed get regionLineWidth(): number {
        return this.preferences.get(PreferenceKeys.REGION_LINE_WIDTH) ?? DEFAULTS.REGION.regionLineWidth;
    }

    @computed get regionDashLength(): number {
        return this.preferences.get(PreferenceKeys.REGION_DASH_LENGTH) ?? DEFAULTS.REGION.regionDashLength;
    }

    @computed get regionType(): CARTA.RegionType {
        return this.preferences.get(PreferenceKeys.REGION_TYPE) ?? DEFAULTS.REGION.regionType;
    }

    @computed get regionCreationMode(): string {
        return this.preferences.get(PreferenceKeys.REGION_CREATION_MODE) ?? DEFAULTS.REGION.regionCreationMode;
    }

    @computed get regionSize(): number {
        return this.preferences.get(PreferenceKeys.REGION_SIZE) ?? DEFAULTS.REGION.regionSize;
    }

    // getters for performance
    @computed get imageCompressionQuality(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_IMAGE_COMPRESSION_QUALITY) ?? DEFAULTS.PERFORMANCE.imageCompressionQuality;
    }

    @computed get animationCompressionQuality(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_ANIMATION_COMPRESSION_QUALITY) ?? DEFAULTS.PERFORMANCE.animationCompressionQuality;
    }

    @computed get gpuTileCache(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_GPU_TILE_CACHE) ?? DEFAULTS.PERFORMANCE.GPUTileCache;
    }

    @computed get systemTileCache(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_SYSTEM_TILE_CACHE) ?? DEFAULTS.PERFORMANCE.systemTileCache;
    }

    @computed get contourControlMapWidth(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH) ?? DEFAULTS.PERFORMANCE.contourControlMapWidth;
    }

    @computed get streamContoursWhileZooming(): boolean {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING) ?? DEFAULTS.PERFORMANCE.streamContoursWhileZooming;
    }

    @computed get lowBandwidthMode(): boolean {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_LOW_BAND_WIDTH_MODE) ?? DEFAULTS.PERFORMANCE.lowBandwidthMode;
    }

    @computed get stopAnimationPlaybackMinutes(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES) ?? DEFAULTS.PERFORMANCE.stopAnimationPlaybackMinutes;
    }

    @computed get isSelectingAllLogEvents(): boolean {
        return this.preferences.get(PreferenceKeys.LOG_EVENT)?.length === Event.EVENT_NUMBER;
    }

    @computed get isSelectingIndeterminateLogEvents(): boolean {
        const selected = this.preferences.get(PreferenceKeys.LOG_EVENT)?.length;
        return selected > 0 && selected < Event.EVENT_NUMBER;
    }

    public isEventLoggingEnabled = (eventType: CARTA.EventType): boolean => {
        if (Event.isEventTypeValid(eventType)) {
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
        return this.preferences.get(PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE) ?? DEFAULTS.CATALOG.catalogDisplayedColumnSize;
    }

    @computed get catalogTableSeparatorPosition(): string {
        return this.preferences.get(PreferenceKeys.CATALOG_TABLE_SEPARATOR_POSITION) ?? DEFAULTS.CATALOG.catalogTableSeparatorPosition;
    }

    @computed get pixelGridVisible(): boolean {
        return this.preferences.get(PreferenceKeys.PIXEL_GRID_VISIBLE) ?? DEFAULTS.SILENT.pixelGridVisible;
    }

    @computed get pixelGridColor(): string {
        return this.preferences.get(PreferenceKeys.PIXEL_GRID_COLOR) ?? DEFAULTS.SILENT.pixelGridColor;
    }

    @computed get limitOverlayRedraw(): boolean {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_LIMIT_OVERLAY_REDRAW) ?? DEFAULTS.PERFORMANCE.limitOverlayRedraw;
    }

    @computed get imageMultiPanelEnabled(): boolean {
        return this.preferences.get(PreferenceKeys.IMAGE_MULTI_PANEL_ENABLED) ?? DEFAULTS.SILENT.imagePanelMode;
    }

    @computed get imagePanelMode(): ImagePanelMode {
        return this.preferences.get(PreferenceKeys.IMAGE_PANEL_MODE) ?? DEFAULTS.SILENT.imagePanelMode;
    }

    @computed get imagePanelColumns(): number {
        return this.preferences.get(PreferenceKeys.IMAGE_PANEL_COLUMNS) ?? DEFAULTS.SILENT.imagePanelColumns;
    }

    @computed get imagePanelRows(): number {
        return this.preferences.get(PreferenceKeys.IMAGE_PANEL_ROWS) ?? DEFAULTS.SILENT.imagePanelRows;
    }

    @action setPreference = async (key: PreferenceKeys, value: any) => {
        if (!key) {
            return false;
        }

        // set preference in variable
        if (key === PreferenceKeys.LOG_EVENT) {
            if (!Event.isEventTypeValid(value)) {
                return false;
            }
            let eventList = this.preferences.get(PreferenceKeys.LOG_EVENT);
            if (!eventList || !Array.isArray(eventList)) {
                eventList = [];
            }
            if (eventList.includes(value)) {
                eventList = eventList.filter(e => e !== value);
            } else {
                eventList.push(value);
            }
            this.preferences.set(PreferenceKeys.LOG_EVENT, eventList);
            return await ApiService.Instance.setPreference(PreferenceKeys.LOG_EVENT, eventList);
        } else {
            this.preferences.set(key, value);
        }

        return await ApiService.Instance.setPreference(key, value);
    };

    @action clearPreferences = async (keys: PreferenceKeys[]) => {
        for (const key of keys) {
            this.preferences.delete(key);
        }
        await ApiService.Instance.clearPreferences(keys);
    };

    // reset functions
    @action resetSilentSettings = () => {
        this.clearPreferences([
            PreferenceKeys.SILENT_FILE_SORTING_STRING,
            PreferenceKeys.SILENT_FILE_FILTERING_TYPE,
            PreferenceKeys.PIXEL_GRID_VISIBLE,
            PreferenceKeys.PIXEL_GRID_COLOR,
            PreferenceKeys.IMAGE_MULTI_PANEL_ENABLED,
            PreferenceKeys.IMAGE_PANEL_MODE,
            PreferenceKeys.IMAGE_PANEL_COLUMNS,
            PreferenceKeys.IMAGE_PANEL_ROWS
        ]);
    };

    @action resetGlobalSettings = () => {
        this.clearPreferences([
            PreferenceKeys.GLOBAL_THEME,
            PreferenceKeys.GLOBAL_AUTOLAUNCH,
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

    @action resetRenderConfigSettings = () => {
        this.clearPreferences([
            PreferenceKeys.RENDER_CONFIG_COLORMAP,
            PreferenceKeys.RENDER_CONFIG_NAN_ALPHA,
            PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX,
            PreferenceKeys.RENDER_CONFIG_PERCENTILE,
            PreferenceKeys.RENDER_CONFIG_SCALING,
            PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA,
            PreferenceKeys.RENDER_CONFIG_SCALING_GAMMA,
            PreferenceKeys.RENDER_CONFIG_USE_SMOOTHED_BIAS_CONTRAST
        ]);
    };

    @action resetContourConfigSettings = () => {
        this.clearPreferences([
            PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLOR,
            PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP,
            PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP_ENABLED,
            PreferenceKeys.CONTOUR_CONFIG_CONTOUR_GENERATOR_TYPE,
            PreferenceKeys.CONTOUR_CONFIG_CONTOUR_NUM_LEVELS,
            PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_FACTOR,
            PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_MODE,
            PreferenceKeys.CONTOUR_CONFIG_CONTOUR_THICKNESS
        ]);
    };

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

    @action resetRegionSettings = () => {
        this.clearPreferences([PreferenceKeys.REGION_COLOR, PreferenceKeys.REGION_CREATION_MODE, PreferenceKeys.REGION_DASH_LENGTH, PreferenceKeys.REGION_LINE_WIDTH, PreferenceKeys.REGION_TYPE, PreferenceKeys.REGION_SIZE]);
    };

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
            PreferenceKeys.PERFORMANCE_LIMIT_OVERLAY_REDRAW
        ]);
    };

    @action selectAllLogEvents = () => {
        if (this.isSelectingAllLogEvents || this.isSelectingIndeterminateLogEvents) {
            this.resetLogEventSettings();
        } else {
            Event.EVENT_TYPES.forEach(eventType => this.setPreference(PreferenceKeys.LOG_EVENT, eventType));
        }
    };

    @action resetLogEventSettings = () => {
        this.clearPreferences([PreferenceKeys.LOG_EVENT]);
    };

    @action resetCatalogSettings = () => {
        this.clearPreferences([PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE, PreferenceKeys.CATALOG_TABLE_SEPARATOR_POSITION]);
    };

    @action fetchPreferences = async () => {
        await this.upgradePreferences();
        await this.getPreferences();
    };

    private getPreferences = async () => {
        const preferences = await ApiService.Instance.getPreferences();
        if (preferences) {
            const keys = Object.keys(preferences);
            for (const key of keys) {
                const val = preferences[key];
                this.preferences.set(key as PreferenceKeys, val);
            }
        }
    };

    private upgradePreferences = async () => {
        if (!localStorage.getItem("preferences")) {
            // perform localstorage upgrade by iterating over the old keys. This list consists of keys that were present when CARTA used a single localStorage entry per key

            // Strings
            const stringKeys = [
                PreferenceKeys.GLOBAL_THEME,
                PreferenceKeys.GLOBAL_LAYOUT,
                PreferenceKeys.GLOBAL_CURSOR_POSITION,
                PreferenceKeys.GLOBAL_ZOOM_MODE,
                PreferenceKeys.GLOBAL_ZOOM_POINT,
                PreferenceKeys.GLOBAL_SPECTRAL_MATCHING_TYPE,
                PreferenceKeys.RENDER_CONFIG_COLORMAP,
                PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX,
                PreferenceKeys.CONTOUR_CONFIG_CONTOUR_GENERATOR_TYPE,
                PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLOR,
                PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP,
                PreferenceKeys.WCS_OVERLAY_WCS_TYPE,
                PreferenceKeys.WCS_OVERLAY_COLORBAR_POSITION,
                PreferenceKeys.WCS_OVERLAY_BEAM_COLOR,
                PreferenceKeys.WCS_OVERLAY_BEAM_TYPE,
                PreferenceKeys.REGION_COLOR,
                PreferenceKeys.REGION_CREATION_MODE,
                PreferenceKeys.WCS_OVERLAY_AST_COLOR,
                PreferenceKeys.CATALOG_TABLE_SEPARATOR_POSITION,
                PreferenceKeys.PIXEL_GRID_COLOR
            ];

            const intKeys = [
                PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING,
                PreferenceKeys.RENDER_CONFIG_SCALING,
                PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_MODE,
                PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_FACTOR,
                PreferenceKeys.CONTOUR_CONFIG_CONTOUR_NUM_LEVELS,
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
                PreferenceKeys.CONTOUR_CONFIG_CONTOUR_THICKNESS,
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
                PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP_ENABLED,
                PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE,
                PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE,
                PreferenceKeys.WCS_OVERLAY_COLORBAR_VISIBLE,
                PreferenceKeys.WCS_OVERLAY_COLORBAR_INTERACTIVE,
                PreferenceKeys.WCS_OVERLAY_COLORBAR_LABEL_VISIBLE,
                PreferenceKeys.WCS_OVERLAY_BEAM_VISIBLE,
                PreferenceKeys.PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING,
                PreferenceKeys.PERFORMANCE_LOW_BAND_WIDTH_MODE,
                PreferenceKeys.PIXEL_GRID_VISIBLE
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
    }
}
