import {observable, computed, action} from "mobx";
import {Colors} from "@blueprintjs/core";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {AppStore, BeamType, ContourGeneratorType, FrameScaling, RenderConfigStore, RegionStore} from "stores";
import {Theme, PresetLayout, CursorPosition, Zoom, ZoomPoint, WCSType, RegionCreationMode, CompressionQuality, TileCache, Event} from "models";
import {isColorValid, parseBoolean} from "utilities";
import {ControlMap} from "../models/ControlMap";

export enum PreferenceKeys {
    GLOBAL_THEME = 1,
    GLOBAL_AUTOLAUNCH,
    GLOBAL_LAYOUT,
    GLOBAL_CURSOR_POSITION,
    GLOBAL_ZOOM_MODE,
    GLOBAL_ZOOM_POINT,
    GLOBAL_DRAG_PANNING,

    RENDER_CONFIG_SCALING,
    RENDER_CONFIG_COLORMAP,
    RENDER_CONFIG_PERCENTILE,
    RENDER_CONFIG_SCALING_ALPHA,
    RENDER_CONFIG_SCALING_GAMMA,
    RENDER_CONFIG_NAN_COLOR_HEX,
    RENDER_CONFIG_NAN_ALPHA,

    CONTOUR_CONFIG_CONTOUR_GENERATOR_TYPE,
    CONTOUR_CONFIG_CONTOUR_SMOOTHING_MODE,
    CONTOUR_CONFIG_CONTOUR_SMOOTHING_FACTOR,
    CONTOUR_CONFIG_CONTOUR_NUM_LEVELS,
    CONTOUR_CONFIG_CONTOUR_THICKNESS,
    CONTOUR_CONFIG_CONTOUR_COLORMAP_ENABLED,
    CONTOUR_CONFIG_CONTOUR_COLOR,
    CONTOUR_CONFIG_CONTOUR_COLORMAP,

    WCS_OVERLAY_AST_COLOR,
    WCS_OVERLAY_AST_GRID_VISIBLE,
    WCS_OVERLAY_AST_LABELS_VISIBLE,
    WCS_OVERLAY_WCS_TYPE,
    WCS_OVERLAY_BEAM_VISIBLE,
    WCS_OVERLAY_BEAM_COLOR,
    WCS_OVERLAY_BEAM_TYPE,
    WCS_OVERLAY_BEAM_WIDTH,

    REGION_COLOR,
    REGION_LINE_WIDTH,
    REGION_DASH_LENGTH,
    REGION_TYPE,
    REGION_CREATION_MODE,

    PERFORMANCE_IMAGE_COMPRESSION_QUALITY,
    PERFORMANCE_ANIMATION_COMPRESSION_QUALITY,
    PERFORMANCE_GPU_TILE_CACHE,
    PERFORMANCE_SYSTEM_TILE_CACHE,
    PERFORMANCE_CONTOUR_DECIMATION,
    PERFORMANCE_CONTOUR_COMPRESSION_LEVEL,
    PERFORMANCE_CONTOUR_CHUNK_SIZE,
    PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH,
    PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING,
    PERFORMANCE_LOW_BAND_WIDTH_MODE,
    PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES,

    LOG_EVENT
}

const KEY_TO_STRING = new Map<PreferenceKeys, string>([
    [PreferenceKeys.GLOBAL_THEME, "theme"],
    [PreferenceKeys.GLOBAL_AUTOLAUNCH, "autoLaunch"],
    [PreferenceKeys.GLOBAL_LAYOUT, "layout"],
    [PreferenceKeys.GLOBAL_CURSOR_POSITION, "cursorPosition"],
    [PreferenceKeys.GLOBAL_ZOOM_MODE, "zoomMode"],
    [PreferenceKeys.GLOBAL_ZOOM_POINT, "zoomPoint"],
    [PreferenceKeys.GLOBAL_DRAG_PANNING, "dragPanning"],

    [PreferenceKeys.RENDER_CONFIG_SCALING, "scaling"],
    [PreferenceKeys.RENDER_CONFIG_COLORMAP, "colormap"],
    [PreferenceKeys.RENDER_CONFIG_PERCENTILE, "percentile"],
    [PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA, "scalingAlpha"],
    [PreferenceKeys.RENDER_CONFIG_SCALING_GAMMA, "scalingGamma"],
    [PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX, "nanColorHex"],
    [PreferenceKeys.RENDER_CONFIG_NAN_ALPHA, "nanAlpha"],

    [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_GENERATOR_TYPE, "contourGeneratorType"],
    [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_MODE, "contourSmoothingMode"],
    [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_FACTOR, "contourSmoothingFactor"],
    [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_NUM_LEVELS, "contourNumLevels"],
    [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_THICKNESS, "contourThickness"],
    [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP_ENABLED, "contourColormapEnabled"],
    [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLOR, "contourColor"],
    [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP, "contourColormap"],

    [PreferenceKeys.WCS_OVERLAY_AST_COLOR, "astColor"],
    [PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE, "astGridVisible"],
    [PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE, "astLabelsVisible"],
    [PreferenceKeys.WCS_OVERLAY_WCS_TYPE, "wcsType"],
    [PreferenceKeys.WCS_OVERLAY_BEAM_VISIBLE, "beamVisible"],
    [PreferenceKeys.WCS_OVERLAY_BEAM_COLOR, "beamColor"],
    [PreferenceKeys.WCS_OVERLAY_BEAM_TYPE, "beamType"],
    [PreferenceKeys.WCS_OVERLAY_BEAM_WIDTH, "beamWidth"],

    [PreferenceKeys.REGION_COLOR, "regionColor"],
    [PreferenceKeys.REGION_LINE_WIDTH, "regionLineWidth"],
    [PreferenceKeys.REGION_DASH_LENGTH, "regionDashLength"],
    [PreferenceKeys.REGION_TYPE, "regionType"],
    [PreferenceKeys.REGION_CREATION_MODE, "regionCreationMode"],

    [PreferenceKeys.PERFORMANCE_IMAGE_COMPRESSION_QUALITY, "imageCompressionQuality"],
    [PreferenceKeys.PERFORMANCE_ANIMATION_COMPRESSION_QUALITY, "animationCompressionQuality"],
    [PreferenceKeys.PERFORMANCE_GPU_TILE_CACHE, "GPUTileCache"],
    [PreferenceKeys.PERFORMANCE_SYSTEM_TILE_CACHE, "systemTileCache"],
    [PreferenceKeys.PERFORMANCE_CONTOUR_DECIMATION, "contourDecimation"],
    [PreferenceKeys.PERFORMANCE_CONTOUR_COMPRESSION_LEVEL, "contourCompressionLevel"],
    [PreferenceKeys.PERFORMANCE_CONTOUR_CHUNK_SIZE, "contourChunkSize"],
    [PreferenceKeys.PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH, "contourControlMapWidth"],
    [PreferenceKeys.PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING, "streamContoursWhileZooming"],
    [PreferenceKeys.PERFORMANCE_LOW_BAND_WIDTH_MODE, "lowBandwidthMode"],
    [PreferenceKeys.PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES, "stopAnimationPlaybackMinutes"],

    [PreferenceKeys.LOG_EVENT, "logEventList"]
]);

const DEFAULTS = {
    GLOBAL: {
        theme: Theme.LIGHT,
        autoLaunch: true,
        layout: PresetLayout.DEFAULT,
        cursorPosition: CursorPosition.TRACKING,
        zoomMode: Zoom.FIT,
        zoomPoint: ZoomPoint.CURSOR,
        dragPanning: true,
    },
    RENDER_CONFIG: {
        scaling: FrameScaling.LINEAR,
        colormap: "inferno",
        percentile: 99.9,
        scalingAlpha: 1000,
        scalingGamma: 1,
        nanColorHex: "#137CBD",
        nanAlpha: 1,
    },
    CONTOUR_CONFIG: {
        contourGeneratorType: ContourGeneratorType.StartStepMultiplier,
        contourSmoothingMode: CARTA.SmoothingMode.BlockAverage,
        contourSmoothingFactor: 4,
        contourNumLevels: 5,
        contourThickness: 1,
        contourColormapEnabled: false,
        contourColor: Colors.GREEN3,
        contourColormap: "viridis",
    },
    WCS_OVERLAY: {
        astColor: 4,
        astGridVisible: false,
        astLabelsVisible: true,
        wcsType: WCSType.AUTOMATIC,
        beamVisible: true,
        beamColor: Colors.GRAY3,
        beamType: BeamType.Open,
        beamWidth: 1,
    },
    REGION: {
        regionColor: "#2EE6D6",
        regionLineWidth: 2,
        regionDashLength: 0,
        regionType: CARTA.RegionType.RECTANGLE,
        regionCreationMode: RegionCreationMode.CENTER,
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
        stopAnimationPlaybackMinutes: 5
    },
    LOG_EVENT: {
        eventLoggingEnabled: false
    }
};

export class PreferenceStore {
    private readonly appStore: AppStore;

    @observable preferences: Map<PreferenceKeys, any>;
    @observable supportsServer: boolean;

    private PREFERENCE_VALIDATORS = new Map<PreferenceKeys, (values: string) => any>([
        [PreferenceKeys.GLOBAL_THEME, (value: string): string => { return value && Theme.isValid(value) ? value : DEFAULTS.GLOBAL.theme; }],
        [PreferenceKeys.GLOBAL_AUTOLAUNCH, (value: string): boolean => { return parseBoolean(value, DEFAULTS.GLOBAL.autoLaunch); }],
        [PreferenceKeys.GLOBAL_LAYOUT, (value: string): string => { return value && this.appStore.layoutStore.layoutExist(value) ? value : DEFAULTS.GLOBAL.layout; }],
        [PreferenceKeys.GLOBAL_CURSOR_POSITION, (value: string): string => { return value && CursorPosition.isValid(value) ? value : DEFAULTS.GLOBAL.cursorPosition; }],
        [PreferenceKeys.GLOBAL_ZOOM_MODE, (value: string): string => { return value && Zoom.isValid(value) ? value : DEFAULTS.GLOBAL.zoomMode; }],
        [PreferenceKeys.GLOBAL_ZOOM_POINT, (value: string): string => { return value && ZoomPoint.isValid(value) ? value : DEFAULTS.GLOBAL.zoomPoint; }],
        [PreferenceKeys.GLOBAL_DRAG_PANNING, (value: string): boolean => { return value === "false" ? false : DEFAULTS.GLOBAL.dragPanning; }],

        [PreferenceKeys.RENDER_CONFIG_SCALING, (value: string): number => { return value && isFinite(Number(value)) && RenderConfigStore.IsScalingValid(Number(value)) ? Number(value) : DEFAULTS.RENDER_CONFIG.scaling; }],
        [PreferenceKeys.RENDER_CONFIG_COLORMAP, (value: string): string => { return value && RenderConfigStore.IsColormapValid(value) ? value : DEFAULTS.RENDER_CONFIG.colormap; }],
        [PreferenceKeys.RENDER_CONFIG_PERCENTILE, (value: string): number => { return value && isFinite(Number(value)) && RenderConfigStore.IsPercentileValid(Number(value)) ? Number(value) : DEFAULTS.RENDER_CONFIG.percentile; }],
        [PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA, (value: string): number => { return value && isFinite(Number(value)) ? Number(value) : DEFAULTS.RENDER_CONFIG.scalingAlpha; }],
        [PreferenceKeys.RENDER_CONFIG_SCALING_GAMMA, (value: string): number => { return value && isFinite(Number(value)) && RenderConfigStore.IsGammaValid(Number(value)) ? Number(value) : DEFAULTS.RENDER_CONFIG.scalingGamma; }],
        [PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX, (value: string): string => { return value && isColorValid(value) ? value : DEFAULTS.RENDER_CONFIG.nanColorHex; }],
        [PreferenceKeys.RENDER_CONFIG_NAN_ALPHA, (value: string): number => { return value && isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1 ? Number(value) : DEFAULTS.RENDER_CONFIG.nanAlpha; }],

        [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_GENERATOR_TYPE, (value: ContourGeneratorType): ContourGeneratorType => {
            return value && (value === ContourGeneratorType.StartStepMultiplier || value === ContourGeneratorType.MinMaxNScaling || value === ContourGeneratorType.PercentagesRefValue ||
                value === ContourGeneratorType.MeanSigmaList) ? value : DEFAULTS.CONTOUR_CONFIG.contourGeneratorType;
        }],
        [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_MODE,
            (value: string): number => { return value && isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 2 ? Number(value) : DEFAULTS.CONTOUR_CONFIG.contourSmoothingMode; }],
        [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_FACTOR,
            (value: string): number => { return value && (isFinite(parseInt(value)) && parseInt(value) >= 1 && parseInt(value) <= 33) ? parseInt(value) : DEFAULTS.CONTOUR_CONFIG.contourSmoothingFactor; }],
        [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_NUM_LEVELS,
            (value: string): number => { return value && (isFinite(parseInt(value)) && parseInt(value) >= 1 && parseInt(value) <= 15) ? parseInt(value) : DEFAULTS.CONTOUR_CONFIG.contourNumLevels; }],
        [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_THICKNESS,
            (value: string): number => { return value && (isFinite(parseFloat(value)) && parseFloat(value) > 0 && parseFloat(value) <= 10) ? parseFloat(value) : DEFAULTS.CONTOUR_CONFIG.contourThickness; }],
        [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP_ENABLED, (value: string): boolean => { return parseBoolean(value, DEFAULTS.CONTOUR_CONFIG.contourColormapEnabled); }],
        [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLOR, (value: string): string => { return value && isColorValid(value) ? value : DEFAULTS.CONTOUR_CONFIG.contourColor; }],
        [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP, (value: string): string => { return value && RenderConfigStore.IsColormapValid(value) ? value : DEFAULTS.CONTOUR_CONFIG.contourColormap; }],

        [PreferenceKeys.WCS_OVERLAY_AST_COLOR, (value: string): number => { return value && isFinite(Number(value)) && Number(value) >= 0 && Number(value) < AST.colors.length ? Number(value) : DEFAULTS.WCS_OVERLAY.astColor; }],
        [PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE, (value: string): boolean => { return parseBoolean(value, DEFAULTS.WCS_OVERLAY.astGridVisible); }],
        [PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE, (value: string): boolean => { return parseBoolean(value, DEFAULTS.WCS_OVERLAY.astLabelsVisible); }],
        [PreferenceKeys.WCS_OVERLAY_WCS_TYPE, (value: string): string => { return value && WCSType.isValid(value) ? value : DEFAULTS.WCS_OVERLAY.wcsType; }],
        [PreferenceKeys.WCS_OVERLAY_BEAM_VISIBLE, (value: string): boolean => { return parseBoolean(value, DEFAULTS.WCS_OVERLAY.beamVisible); }],
        [PreferenceKeys.WCS_OVERLAY_BEAM_COLOR, (value: string): string => { return value && isColorValid(value) ? value : DEFAULTS.WCS_OVERLAY.beamColor; }],
        [PreferenceKeys.WCS_OVERLAY_BEAM_TYPE, (value: BeamType): BeamType => { return value && (value === BeamType.Open || value === BeamType.Solid) ? value : DEFAULTS.WCS_OVERLAY.beamType; }],
        [PreferenceKeys.WCS_OVERLAY_BEAM_WIDTH, (value: string): number => { return value && (isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 10) ? Number(value) : DEFAULTS.WCS_OVERLAY.beamWidth; }],

        [PreferenceKeys.REGION_COLOR, (value: string): string => { return value && isColorValid(value) ? value : DEFAULTS.REGION.regionColor; }],
        [PreferenceKeys.REGION_LINE_WIDTH, (value: string): number => { return value && isFinite(Number(value)) && RegionStore.IsRegionLineWidthValid(Number(value)) ? Number(value) : DEFAULTS.REGION.regionLineWidth; }],
        [PreferenceKeys.REGION_DASH_LENGTH, (value: string): number => { return value && isFinite(Number(value)) && RegionStore.IsRegionDashLengthValid(Number(value)) ? Number(value) : DEFAULTS.REGION.regionDashLength; }],
        [PreferenceKeys.REGION_TYPE, (value: string): number => { return value && isFinite(Number(value)) && RegionStore.IsRegionTypeValid(Number(value)) ? Number(value) : DEFAULTS.REGION.regionType; }],
        [PreferenceKeys.REGION_CREATION_MODE, (value: string): string => { return value && RegionCreationMode.isValid(value) ? value : DEFAULTS.REGION.regionCreationMode; }],

        [PreferenceKeys.PERFORMANCE_IMAGE_COMPRESSION_QUALITY,
            (value: string): number => { return value && isFinite(Number(value)) && CompressionQuality.isImageCompressionQualityValid(Number(value)) ? Number(value) : DEFAULTS.PERFORMANCE.imageCompressionQuality; }],
        [PreferenceKeys.PERFORMANCE_ANIMATION_COMPRESSION_QUALITY,
            (value: string): number => { return value && isFinite(Number(value)) && CompressionQuality.isAnimationCompressionQualityValid(Number(value)) ? Number(value) : DEFAULTS.PERFORMANCE.animationCompressionQuality; }],
        [PreferenceKeys.PERFORMANCE_GPU_TILE_CACHE, (value: string): number => { return value && isFinite(Number(value)) && TileCache.isGPUTileCacheValid(Number(value)) ? Number(value) : DEFAULTS.PERFORMANCE.GPUTileCache; }],
        [PreferenceKeys.PERFORMANCE_SYSTEM_TILE_CACHE, (value: string): number => { return value && isFinite(Number(value)) && TileCache.isSystemTileCacheValid(Number(value)) ? Number(value) : DEFAULTS.PERFORMANCE.systemTileCache; }],
        [PreferenceKeys.PERFORMANCE_CONTOUR_DECIMATION,
            (value: string): number => { return value && (isFinite(parseInt(value)) && parseInt(value) >= 1 && parseInt(value) <= 32) ? parseInt(value) : DEFAULTS.PERFORMANCE.contourDecimation; }],
        [PreferenceKeys.PERFORMANCE_CONTOUR_COMPRESSION_LEVEL,
            (value: string): number => { return value && (isFinite(parseInt(value)) && parseInt(value) >= 0 && parseInt(value) <= 19) ? parseInt(value) : DEFAULTS.PERFORMANCE.contourCompressionLevel; }],
        [PreferenceKeys.PERFORMANCE_CONTOUR_CHUNK_SIZE,
            (value: string): number => { return value && (isFinite(parseInt(value)) && parseInt(value) >= 1000 && parseInt(value) <= 1000000) ? parseInt(value) : DEFAULTS.PERFORMANCE.contourChunkSize; }],
        [PreferenceKeys.PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH,
            (value: string): number => { return value && isFinite(parseInt(value)) && ControlMap.IsWidthValid(parseInt(value)) ? parseInt(value) : DEFAULTS.PERFORMANCE.contourControlMapWidth; }],
        [PreferenceKeys.PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING, (value: string): boolean => { return parseBoolean(value, DEFAULTS.PERFORMANCE.streamContoursWhileZooming); }],
        [PreferenceKeys.PERFORMANCE_LOW_BAND_WIDTH_MODE, (value: string): boolean => { return parseBoolean(value, DEFAULTS.PERFORMANCE.lowBandwidthMode); }],
        [PreferenceKeys.PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES,
            (value: string): number => { return value && (isFinite(parseInt(value)) && parseInt(value) > 0  && parseInt(value) <= 30) ? parseInt(value) : DEFAULTS.PERFORMANCE.stopAnimationPlaybackMinutes; }]
    ]);

    // getters for global settings
    @computed get theme(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_THEME);
    }

    @computed get autoLaunch(): boolean {
        return this.preferences.get(PreferenceKeys.GLOBAL_AUTOLAUNCH);
    }

    @computed get layout(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_LAYOUT);
    }

    @computed get cursorPosition(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_CURSOR_POSITION);
    }

    @computed get zoomMode(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_ZOOM_MODE);
    }

    @computed get zoomPoint(): string {
        return this.preferences.get(PreferenceKeys.GLOBAL_ZOOM_POINT);
    }

    @computed get dragPanning(): boolean {
        return this.preferences.get(PreferenceKeys.GLOBAL_DRAG_PANNING);
    }

    // getters for render config
    @computed get scaling(): FrameScaling {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_SCALING);
    }

    @computed get colormap(): string {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_COLORMAP);
    }

    @computed get percentile(): number {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_PERCENTILE);
    }

    @computed get scalingAlpha(): number {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA);
    }

    @computed get scalingGamma(): number {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_SCALING_GAMMA);
    }

    @computed get nanColorHex(): string {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX);
    }

    @computed get nanAlpha(): number {
        return this.preferences.get(PreferenceKeys.RENDER_CONFIG_NAN_ALPHA);
    }

    // getters for Contour Config
    @computed get contourGeneratorType(): ContourGeneratorType {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_GENERATOR_TYPE);
    }

    @computed get contourColormapEnabled(): boolean {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP_ENABLED);
    }

    @computed get contourColormap(): string {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP);
    }

    @computed get contourColor(): string {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLOR);
    }

    @computed get contourSmoothingMode(): CARTA.SmoothingMode {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_MODE);
    }

    @computed get contourSmoothingFactor(): number {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_FACTOR);
    }

    @computed get contourNumLevels(): number {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_NUM_LEVELS);
    }

    @computed get contourThickness(): number {
        return this.preferences.get(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_THICKNESS);
    }

    @computed get contourDecimation(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_DECIMATION);
    }

    @computed get contourCompressionLevel(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_COMPRESSION_LEVEL);
    }

    @computed get contourChunkSize(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_CHUNK_SIZE);
    }

    // getters for WCS overlay
    @computed get astColor(): number {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_AST_COLOR);
    }

    @computed get astGridVisible(): boolean {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE);
    }

    @computed get astLabelsVisible(): boolean {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE);
    }

    @computed get wcsType(): string {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_WCS_TYPE);
    }

    @computed get beamVisible(): boolean {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_VISIBLE);
    }

    @computed get beamColor(): string {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_COLOR);
    }

    @computed get beamType(): BeamType {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_TYPE);
    }

    @computed get beamWidth(): number {
        return this.preferences.get(PreferenceKeys.WCS_OVERLAY_BEAM_WIDTH);
    }

    // getters for region
    @computed get regionColor(): string {
        return this.preferences.get(PreferenceKeys.REGION_COLOR);
    }

    @computed get regionLineWidth(): number {
        return this.preferences.get(PreferenceKeys.REGION_LINE_WIDTH);
    }

    @computed get regionDashLength(): number {
        return this.preferences.get(PreferenceKeys.REGION_DASH_LENGTH);
    }

    @computed get regionType(): CARTA.RegionType {
        return this.preferences.get(PreferenceKeys.REGION_TYPE);
    }

    @computed get regionCreationMode(): string {
        return this.preferences.get(PreferenceKeys.REGION_CREATION_MODE);
    }

    // getters for performance
    @computed get imageCompressionQuality(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_IMAGE_COMPRESSION_QUALITY);
    }

    @computed get animationCompressionQuality(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_ANIMATION_COMPRESSION_QUALITY);
    }

    @computed get gpuTileCache(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_GPU_TILE_CACHE);
    }

    @computed get systemTileCache(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_SYSTEM_TILE_CACHE);
    }

    @computed get contourControlMapWidth(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH);
    }

    @computed get streamContoursWhileZooming(): boolean {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING);
    }

    @computed get lowBandwidthMode(): boolean {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_LOW_BAND_WIDTH_MODE);
    }

    @computed get stopAnimationPlaybackMinutes(): number {
        return this.preferences.get(PreferenceKeys.PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES);
    }

    public isEventLoggingEnabled = (eventType: CARTA.EventType): boolean => {
        return Event.isEventTypeValid(eventType) && this.preferences.get(PreferenceKeys.LOG_EVENT).get(eventType);
    };

    // getters for boolean(convenient)
    @computed get isDarkTheme(): boolean {
        return this.theme === Theme.DARK;
    }

    @computed get isZoomRAWMode(): boolean {
        return this.zoomMode === Zoom.RAW;
    }

    @computed get isRegionCornerMode(): boolean {
        return this.regionCreationMode === RegionCreationMode.CORNER;
    }

    @computed get isCursorFrozen(): boolean {
        return this.cursorPosition === CursorPosition.FIXED;
    }

    @computed get enabledLoggingEventNames(): string[] {
        let eventNames: string[] = [];
        this.preferences.get(PreferenceKeys.LOG_EVENT).forEach((isChecked, eventType) => {
            if (isChecked) {
                eventNames.push(Event.getEventNameFromType(eventType));
            }
        });
        return eventNames;
    }

    @action setPreference = (key: PreferenceKeys, value: any): void => {
        if (key === null || value === null) {
            return;
        }

        if (!this.preferences.has(key)) {
            return;
        }

        // set preference in variable
        if (key === PreferenceKeys.LOG_EVENT) {
            if (!Event.isEventTypeValid(value)) {
                return;
            }
            const eventMap = this.preferences.get(PreferenceKeys.LOG_EVENT);
            eventMap.set(value, !eventMap.get(value));
        } else {
            this.preferences.set(key, value);
        }

        // save prefernce to local storage/server db
        const keyStr: string = KEY_TO_STRING.get(key);
        if (!keyStr) {
            return;
        }
        let valueStr: string;
        if (key === PreferenceKeys.LOG_EVENT) {
            valueStr = JSON.stringify(this.enabledLoggingEventNames);
        } else {
            switch (typeof value) {
                case "boolean":
                    valueStr = value ? "true" : "false";
                    break;
                case "number":
                    valueStr = value.toString(10);
                    break;
                case "string":
                    valueStr = value;
                    break;
                default:
                    return;
            }
        }

        if (this.supportsServer) {
            this.savePreferencesToServer(keyStr, valueStr);
        } else {
            localStorage.setItem(keyStr, valueStr);
        }
    };

    // reset functions
    @action resetGlobalSettings = () => {
        this.setPreference(PreferenceKeys.GLOBAL_THEME, DEFAULTS.GLOBAL.theme);
        this.setPreference(PreferenceKeys.GLOBAL_AUTOLAUNCH, DEFAULTS.GLOBAL.autoLaunch);
        this.setPreference(PreferenceKeys.GLOBAL_LAYOUT, DEFAULTS.GLOBAL.layout);
        this.setPreference(PreferenceKeys.GLOBAL_CURSOR_POSITION, DEFAULTS.GLOBAL.cursorPosition);
        this.setPreference(PreferenceKeys.GLOBAL_ZOOM_MODE, DEFAULTS.GLOBAL.zoomMode);
        this.setPreference(PreferenceKeys.GLOBAL_ZOOM_POINT, DEFAULTS.GLOBAL.zoomPoint);
        this.setPreference(PreferenceKeys.GLOBAL_DRAG_PANNING, DEFAULTS.GLOBAL.dragPanning);
    };

    @action resetRenderConfigSettings = () => {
        this.setPreference(PreferenceKeys.RENDER_CONFIG_SCALING, DEFAULTS.RENDER_CONFIG.scaling);
        this.setPreference(PreferenceKeys.RENDER_CONFIG_COLORMAP, DEFAULTS.RENDER_CONFIG.colormap);
        this.setPreference(PreferenceKeys.RENDER_CONFIG_PERCENTILE, DEFAULTS.RENDER_CONFIG.percentile);
        this.setPreference(PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA, DEFAULTS.RENDER_CONFIG.scalingAlpha);
        this.setPreference(PreferenceKeys.RENDER_CONFIG_SCALING_GAMMA, DEFAULTS.RENDER_CONFIG.scalingGamma);
        this.setPreference(PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX, DEFAULTS.RENDER_CONFIG.nanColorHex);
        this.setPreference(PreferenceKeys.RENDER_CONFIG_NAN_ALPHA, DEFAULTS.RENDER_CONFIG.nanAlpha);
    };

    @action resetContourConfigSettings = () => {
        this.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_GENERATOR_TYPE, DEFAULTS.CONTOUR_CONFIG.contourGeneratorType);
        this.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_MODE, DEFAULTS.CONTOUR_CONFIG.contourSmoothingMode);
        this.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_FACTOR, DEFAULTS.CONTOUR_CONFIG.contourSmoothingFactor);
        this.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_NUM_LEVELS, DEFAULTS.CONTOUR_CONFIG.contourNumLevels);
        this.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_THICKNESS, DEFAULTS.CONTOUR_CONFIG.contourThickness);
        this.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLOR, DEFAULTS.CONTOUR_CONFIG.contourColor);
        this.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP, DEFAULTS.CONTOUR_CONFIG.contourColormap);
        this.setPreference(PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP_ENABLED, DEFAULTS.CONTOUR_CONFIG.contourColormapEnabled);
    };

    @action resetOverlayConfigSettings = () => {
        this.setPreference(PreferenceKeys.WCS_OVERLAY_AST_COLOR, DEFAULTS.WCS_OVERLAY.astColor);
        this.setPreference(PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE, DEFAULTS.WCS_OVERLAY.astGridVisible);
        this.setPreference(PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE, DEFAULTS.WCS_OVERLAY.astLabelsVisible);
        this.setPreference(PreferenceKeys.WCS_OVERLAY_WCS_TYPE, DEFAULTS.WCS_OVERLAY.wcsType);
        this.setPreference(PreferenceKeys.WCS_OVERLAY_BEAM_VISIBLE, DEFAULTS.WCS_OVERLAY.beamVisible);
        this.setPreference(PreferenceKeys.WCS_OVERLAY_BEAM_COLOR, DEFAULTS.WCS_OVERLAY.beamColor);
        this.setPreference(PreferenceKeys.WCS_OVERLAY_BEAM_TYPE, DEFAULTS.WCS_OVERLAY.beamType);
        this.setPreference(PreferenceKeys.WCS_OVERLAY_BEAM_WIDTH, DEFAULTS.WCS_OVERLAY.beamWidth);
    };

    @action resetRegionSettings = () => {
        this.setPreference(PreferenceKeys.REGION_COLOR, DEFAULTS.REGION.regionColor);
        this.setPreference(PreferenceKeys.REGION_LINE_WIDTH, DEFAULTS.REGION.regionLineWidth);
        this.setPreference(PreferenceKeys.REGION_DASH_LENGTH, DEFAULTS.REGION.regionDashLength);
        this.setPreference(PreferenceKeys.REGION_TYPE, DEFAULTS.REGION.regionType);
        this.setPreference(PreferenceKeys.REGION_CREATION_MODE, DEFAULTS.REGION.regionCreationMode);
    };

    @action resetPerformanceSettings = () => {
        this.setPreference(PreferenceKeys.PERFORMANCE_IMAGE_COMPRESSION_QUALITY, DEFAULTS.PERFORMANCE.imageCompressionQuality);
        this.setPreference(PreferenceKeys.PERFORMANCE_ANIMATION_COMPRESSION_QUALITY, DEFAULTS.PERFORMANCE.animationCompressionQuality);
        this.setPreference(PreferenceKeys.PERFORMANCE_GPU_TILE_CACHE, DEFAULTS.PERFORMANCE.GPUTileCache);
        this.setPreference(PreferenceKeys.PERFORMANCE_SYSTEM_TILE_CACHE, DEFAULTS.PERFORMANCE.systemTileCache);
        this.setPreference(PreferenceKeys.PERFORMANCE_CONTOUR_DECIMATION, DEFAULTS.PERFORMANCE.contourDecimation);
        this.setPreference(PreferenceKeys.PERFORMANCE_CONTOUR_COMPRESSION_LEVEL, DEFAULTS.PERFORMANCE.contourCompressionLevel);
        this.setPreference(PreferenceKeys.PERFORMANCE_CONTOUR_CHUNK_SIZE, DEFAULTS.PERFORMANCE.contourChunkSize);
        this.setPreference(PreferenceKeys.PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH, DEFAULTS.PERFORMANCE.contourControlMapWidth);
        this.setPreference(PreferenceKeys.PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING, DEFAULTS.PERFORMANCE.streamContoursWhileZooming);
        this.setPreference(PreferenceKeys.PERFORMANCE_LOW_BAND_WIDTH_MODE, DEFAULTS.PERFORMANCE.lowBandwidthMode);
        this.setPreference(PreferenceKeys.PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES, DEFAULTS.PERFORMANCE.stopAnimationPlaybackMinutes);
    };

    @action resetLogEventSettings = () => {
        this.preferences.get(PreferenceKeys.LOG_EVENT).forEach((value, key, map) => map.set(key, DEFAULTS.LOG_EVENT.eventLoggingEnabled));
        if (this.supportsServer) {
            this.savePreferencesToServer(KEY_TO_STRING.get(PreferenceKeys.LOG_EVENT), JSON.stringify(this.enabledLoggingEventNames));
        } else {
            localStorage.setItem(KEY_TO_STRING.get(PreferenceKeys.LOG_EVENT), JSON.stringify(this.enabledLoggingEventNames));
        }
    };

    public initUserDefinedPreferences = (supportsServer: boolean, serverPreference: { [k: string]: string; }) => {
        this.supportsServer = supportsServer;
        if (supportsServer) {
            this.initPreferenceFromServer(serverPreference);
        } else {
            this.initPreferenceFromLocalStorage();
        }
    }

    private initPreferenceFromDefault = () => {
        this.preferences = new Map<PreferenceKeys, any>([
            [PreferenceKeys.GLOBAL_THEME, DEFAULTS.GLOBAL.theme],
            [PreferenceKeys.GLOBAL_AUTOLAUNCH, DEFAULTS.GLOBAL.autoLaunch],
            [PreferenceKeys.GLOBAL_LAYOUT, DEFAULTS.GLOBAL.layout],
            [PreferenceKeys.GLOBAL_CURSOR_POSITION, DEFAULTS.GLOBAL.cursorPosition],
            [PreferenceKeys.GLOBAL_ZOOM_MODE, DEFAULTS.GLOBAL.zoomMode],
            [PreferenceKeys.GLOBAL_ZOOM_POINT, DEFAULTS.GLOBAL.zoomPoint],
            [PreferenceKeys.GLOBAL_DRAG_PANNING, DEFAULTS.GLOBAL.dragPanning],

            [PreferenceKeys.RENDER_CONFIG_SCALING, DEFAULTS.RENDER_CONFIG.scaling],
            [PreferenceKeys.RENDER_CONFIG_COLORMAP, DEFAULTS.RENDER_CONFIG.colormap],
            [PreferenceKeys.RENDER_CONFIG_PERCENTILE, DEFAULTS.RENDER_CONFIG.percentile],
            [PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA, DEFAULTS.RENDER_CONFIG.scalingAlpha],
            [PreferenceKeys.RENDER_CONFIG_SCALING_GAMMA, DEFAULTS.RENDER_CONFIG.scalingGamma],
            [PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX, DEFAULTS.RENDER_CONFIG.nanColorHex],
            [PreferenceKeys.RENDER_CONFIG_NAN_ALPHA, DEFAULTS.RENDER_CONFIG.nanAlpha],

            [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_GENERATOR_TYPE, DEFAULTS.CONTOUR_CONFIG.contourGeneratorType],
            [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_MODE, DEFAULTS.CONTOUR_CONFIG.contourSmoothingMode],
            [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_SMOOTHING_FACTOR, DEFAULTS.CONTOUR_CONFIG.contourSmoothingFactor],
            [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_NUM_LEVELS, DEFAULTS.CONTOUR_CONFIG.contourNumLevels],
            [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_THICKNESS, DEFAULTS.CONTOUR_CONFIG.contourThickness],
            [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP_ENABLED, DEFAULTS.CONTOUR_CONFIG.contourColormapEnabled],
            [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLOR, DEFAULTS.CONTOUR_CONFIG.contourColor],
            [PreferenceKeys.CONTOUR_CONFIG_CONTOUR_COLORMAP, DEFAULTS.CONTOUR_CONFIG.contourColormap],

            [PreferenceKeys.WCS_OVERLAY_AST_COLOR, DEFAULTS.WCS_OVERLAY.astColor],
            [PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE, DEFAULTS.WCS_OVERLAY.astGridVisible],
            [PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE, DEFAULTS.WCS_OVERLAY.astLabelsVisible],
            [PreferenceKeys.WCS_OVERLAY_WCS_TYPE, DEFAULTS.WCS_OVERLAY.wcsType],
            [PreferenceKeys.WCS_OVERLAY_BEAM_VISIBLE, DEFAULTS.WCS_OVERLAY.beamVisible],
            [PreferenceKeys.WCS_OVERLAY_BEAM_COLOR, DEFAULTS.WCS_OVERLAY.beamColor],
            [PreferenceKeys.WCS_OVERLAY_BEAM_TYPE, DEFAULTS.WCS_OVERLAY.beamType],
            [PreferenceKeys.WCS_OVERLAY_BEAM_WIDTH, DEFAULTS.WCS_OVERLAY.beamWidth],

            [PreferenceKeys.REGION_COLOR, DEFAULTS.REGION.regionColor],
            [PreferenceKeys.REGION_LINE_WIDTH, DEFAULTS.REGION.regionLineWidth],
            [PreferenceKeys.REGION_DASH_LENGTH, DEFAULTS.REGION.regionDashLength],
            [PreferenceKeys.REGION_TYPE, DEFAULTS.REGION.regionType],
            [PreferenceKeys.REGION_CREATION_MODE, DEFAULTS.REGION.regionCreationMode],

            [PreferenceKeys.PERFORMANCE_IMAGE_COMPRESSION_QUALITY, DEFAULTS.PERFORMANCE.imageCompressionQuality],
            [PreferenceKeys.PERFORMANCE_ANIMATION_COMPRESSION_QUALITY, DEFAULTS.PERFORMANCE.animationCompressionQuality],
            [PreferenceKeys.PERFORMANCE_GPU_TILE_CACHE, DEFAULTS.PERFORMANCE.GPUTileCache],
            [PreferenceKeys.PERFORMANCE_SYSTEM_TILE_CACHE, DEFAULTS.PERFORMANCE.systemTileCache],
            [PreferenceKeys.PERFORMANCE_CONTOUR_DECIMATION, DEFAULTS.PERFORMANCE.contourDecimation],
            [PreferenceKeys.PERFORMANCE_CONTOUR_COMPRESSION_LEVEL, DEFAULTS.PERFORMANCE.contourCompressionLevel],
            [PreferenceKeys.PERFORMANCE_CONTOUR_CHUNK_SIZE, DEFAULTS.PERFORMANCE.contourChunkSize],
            [PreferenceKeys.PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH, DEFAULTS.PERFORMANCE.contourControlMapWidth],
            [PreferenceKeys.PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING, DEFAULTS.PERFORMANCE.streamContoursWhileZooming],
            [PreferenceKeys.PERFORMANCE_LOW_BAND_WIDTH_MODE, DEFAULTS.PERFORMANCE.lowBandwidthMode],
            [PreferenceKeys.PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES, DEFAULTS.PERFORMANCE.stopAnimationPlaybackMinutes],

            [PreferenceKeys.LOG_EVENT, new Map<CARTA.EventType, boolean>()]
        ]);
        Event.EVENT_TYPES.forEach(eventType => this.preferences.get(PreferenceKeys.LOG_EVENT).set(eventType, DEFAULTS.LOG_EVENT.eventLoggingEnabled));
    };

    private initPreferenceFromServer = (serverPreference: { [k: string]: string; }) => {
        const keys: PreferenceKeys[] = Object.values(PreferenceKeys).filter(value => typeof value === "number") as PreferenceKeys[];
        keys.forEach((key) => {
            if (key === PreferenceKeys.LOG_EVENT) {
                this.initLogEventsFromServer(serverPreference);
            } else {
                const keyStr: string = KEY_TO_STRING.get(key);
                if (keyStr && serverPreference.hasOwnProperty(keyStr)) {
                    this.setPreference(key, this.PREFERENCE_VALIDATORS.get(key)(serverPreference[keyStr]));
                }
            }
        });
    };

    private initLogEventsFromServer = (serverPreference: { [k: string]: string; }) => {
        const keyStr = KEY_TO_STRING.get(PreferenceKeys.LOG_EVENT);
        if (keyStr && serverPreference.hasOwnProperty(keyStr)) {
            const serverEventList = serverPreference[keyStr];
            try {
                const eventNameList = JSON.parse(serverEventList);
                if (eventNameList && Array.isArray(eventNameList) && eventNameList.length) {
                    eventNameList.forEach((eventName) => {
                        const eventType = Event.getEventTypeFromName(eventName);
                        if (eventType !== undefined) {
                            this.preferences.get(PreferenceKeys.LOG_EVENT).set(eventType, true);
                        }
                    });
                }
            } catch (e) {
                console.log("Invalid event list read from server");
            }
        }
    };

    private initPreferenceFromLocalStorage = () => {
        const keys: PreferenceKeys[] = Object.values(PreferenceKeys).filter(value => typeof value === "number") as PreferenceKeys[];
        keys.forEach((key) => {
            if (key === PreferenceKeys.LOG_EVENT) {
                this.initLogEventsFromLocalStorage();
            } else {
                const value = localStorage.getItem(KEY_TO_STRING.get(key));
                this.setPreference(key, this.PREFERENCE_VALIDATORS.get(key)(value));
            }
        });
    };

    // getters for log event, the list saved in local storage should be a string array like ["REGISTER_VIEWER", "OPEN_FILE_ACK", ...]
    private initLogEventsFromLocalStorage = () => {
        const localStorageEventList = localStorage.getItem(KEY_TO_STRING.get(PreferenceKeys.LOG_EVENT));
        if (localStorageEventList && localStorageEventList.length) {
            try {
                const eventNameList = JSON.parse(localStorageEventList);
                if (eventNameList && Array.isArray(eventNameList) && eventNameList.length) {
                    eventNameList.forEach((eventName) => {
                        const eventType = Event.getEventTypeFromName(eventName);
                        if (eventType !== undefined) {
                            this.preferences.get(PreferenceKeys.LOG_EVENT).set(eventType, true);
                        }
                    });
                }
            } catch (e) {
                console.log("Invalid event list read from local storage");
            }
        }
    };

    private savePreferencesToServer = (key: string, value: string): boolean => {
        let result = false;
        let obj = {};
        obj[key] = value;
        this.appStore.backendService.setUserPreferences(obj).subscribe(ack => {
            if (ack.success) {
                result = true;
            } else {
                this.appStore.alertStore.showAlert("Saving user-defined preferences to server failed! ");
                result = false;
            }
        });
        return result;
    };

    constructor(appStore: AppStore) {
        this.appStore = appStore;
        this.supportsServer = false;
        this.initPreferenceFromDefault();
    }
}
