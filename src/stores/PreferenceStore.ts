import {observable, computed, action, autorun} from "mobx";
import {Colors} from "@blueprintjs/core";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {FrameScaling, RenderConfigStore, RegionStore} from "stores";
import {Theme, PresetLayout, CursorPosition, Zoom, WCSType, RegionCreationMode, CompressionQuality, TileCache, Event} from "models";
import {AppStore, LayoutStore} from "stores";
import {isColorValid, parseBoolean} from "utilities";

const PREFERENCE_KEYS = {
    theme: "theme",
    autoLaunch: "autoLaunch",
    layout: "layout",
    cursorPosition: "cursorPosition",
    zoomMode: "zoomMode",
    dragPanning: "dragPanning",
    scaling: "scaling",
    colormap: "colormap",
    percentile: "percentile",
    scalingAlpha: "scalingAlpha",
    scalingGamma: "scalingGamma",
    nanColorHex: "nanColorHex",
    nanAlpha: "nanAlpha",
    contourSmoothingMode: "contourSmoothingMode",
    contourSmoothingFactor: "contourSmoothingFactor",
    contourNumLevels: "contourNumLevels",
    contourThickness: "contourThickness",
    contourColormapEnabled: "contourColormapEnabled",
    contourColor: "contourColor",
    contourColormap: "contourColormap",
    astColor: "astColor",
    astGridVisible: "astGridVisible",
    astLabelsVisible: "astLabelsVisible",
    wcsType: "wcsType",
    regionColor: "regionColor",
    regionLineWidth: "regionLineWidth",
    regionDashLength: "regionDashLength",
    regionType: "regionType",
    regionCreationMode: "regionCreationMode",
    imageCompressionQuality: "imageCompressionQuality",
    animationCompressionQuality: "animationCompressionQuality",
    GPUTileCache: "GPUTileCache",
    systemTileCache: "systemTileCache",
    contourDecimation: "contourDecimation",
    contourCompressionLevel: "contourCompressionLevel",
    contourChunkSize: "contourChunkSize",
    streamContoursWhileZooming: "streamContoursWhileZooming",
    logEventList: "logEventList"
};

const DEFAULTS = {
    theme: Theme.LIGHT,
    autoLaunch: true,
    layout: PresetLayout.DEFAULT,
    cursorPosition: CursorPosition.TRACKING,
    zoomMode: Zoom.FIT,
    dragPanning: true,
    scaling: FrameScaling.LINEAR,
    colormap: "inferno",
    percentile: 99.9,
    scalingAlpha: 1000,
    scalingGamma: 1,
    nanColorHex: "#137CBD",
    nanAlpha: 1,
    contourSmoothingMode: CARTA.SmoothingMode.BlockAverage,
    contourSmoothingFactor: 4,
    contourNumLevels: 5,
    contourThickness: 1,
    contourColormapEnabled: false,
    contourColor: Colors.GREEN3,
    contourColormap: "viridis",
    astColor: 4,
    astGridVisible: false,
    astLabelsVisible: true,
    wcsType: WCSType.AUTOMATIC,
    regionColor: "#2EE6D6",
    regionLineWidth: 2,
    regionDashLength: 0,
    regionType: CARTA.RegionType.RECTANGLE,
    regionCreationMode: RegionCreationMode.CENTER,
    imageCompressionQuality: CompressionQuality.IMAGE_DEFAULT,
    animationCompressionQuality: CompressionQuality.ANIMATION_DEFAULT,
    GPUTileCache: TileCache.GPU_DEFAULT,
    systemTileCache: TileCache.SYSTEM_DEFAULT,
    contourDecimation: 4,
    contourCompressionLevel: 8,
    contourChunkSize: 100000,
    streamContoursWhileZooming: false,
    eventLoggingEnabled: false
};

export class PreferenceStore {
    private readonly appStore: AppStore;
    private readonly layoutStore: LayoutStore;

    @observable theme: string;
    @observable autoLaunch: boolean;
    @observable layout: string;
    @observable cursorPosition: string;
    @observable zoomMode: string;
    @observable dragPanning: boolean;
    @observable scaling: FrameScaling;
    @observable colormap: string;
    @observable percentile: number;
    @observable scalingAlpha: number;
    @observable scalingGamma: number;
    @observable nanColorHex: string;
    @observable nanAlpha: number;
    @observable contourSmoothingMode: CARTA.SmoothingMode;
    @observable contourSmoothingFactor: number;
    @observable contourNumLevels: number;
    @observable contourThickness: number;
    @observable contourColormapEnabled: boolean;
    @observable contourColor: string;
    @observable contourColormap: string;
    @observable astColor: number;
    @observable astGridVisible: boolean;
    @observable astLabelsVisible: boolean;
    @observable wcsType: string;
    @observable regionContainer: RegionStore;
    @observable regionCreationMode: string;
    @observable imageCompressionQuality: number;
    @observable animationCompressionQuality: number;
    @observable GPUTileCache: number;
    @observable systemTileCache: number;
    @observable contourDecimation: number;
    @observable contourCompressionLevel: number;
    @observable contourChunkSize: number;
    @observable streamTilesWhileZooming: boolean;
    @observable eventsLoggingEnabled: Map<CARTA.EventType, boolean>;

    // getters for global settings
    private getTheme = (): string => {
        const theme = localStorage.getItem(PREFERENCE_KEYS.theme);
        return theme && Theme.isValid(theme) ? theme : DEFAULTS.theme;
    };

    private getAutoLaunch = (): boolean => {
        const autoLaunch = localStorage.getItem(PREFERENCE_KEYS.autoLaunch);
        return parseBoolean(autoLaunch, DEFAULTS.autoLaunch);
    };

    private getLayout = (): string => {
        const layout = localStorage.getItem(PREFERENCE_KEYS.layout);
        return layout && this.layoutStore.layoutExist(layout) ? layout : DEFAULTS.layout;
    };

    private getCursorPosition = (): string => {
        const cursorPosition = localStorage.getItem(PREFERENCE_KEYS.cursorPosition);
        return cursorPosition && CursorPosition.isValid(cursorPosition) ? cursorPosition : DEFAULTS.cursorPosition;
    };

    private getZoomMode = (): string => {
        const zoomMode = localStorage.getItem(PREFERENCE_KEYS.zoomMode);
        return zoomMode && Zoom.isValid(zoomMode) ? zoomMode : DEFAULTS.zoomMode;
    };

    private getDragPanning = (): boolean => {
        const dragPanning = localStorage.getItem(PREFERENCE_KEYS.dragPanning);
        return dragPanning === "false" ? false : DEFAULTS.dragPanning;
    };

    // getters for render config
    private getScaling = (): FrameScaling => {
        const scaling = localStorage.getItem(PREFERENCE_KEYS.scaling);
        if (!scaling) {
            return DEFAULTS.scaling;
        }

        const value = Number(scaling);
        return isFinite(value) && RenderConfigStore.IsScalingValid(value) ? value : DEFAULTS.scaling;
    };

    private getColormap = (): string => {
        const colormap = localStorage.getItem(PREFERENCE_KEYS.colormap);
        return colormap && RenderConfigStore.IsColormapValid(colormap) ? colormap : DEFAULTS.colormap;
    };

    private getPercentile = (): number => {
        const percentile = localStorage.getItem(PREFERENCE_KEYS.percentile);
        if (!percentile) {
            return DEFAULTS.percentile;
        }

        const value = Number(percentile);
        return isFinite(value) && RenderConfigStore.IsPercentileValid(value) ? value : DEFAULTS.percentile;
    };

    private getScalingAlpha = (): number => {
        const scalingAlpha = localStorage.getItem(PREFERENCE_KEYS.scalingAlpha);
        if (!scalingAlpha) {
            return DEFAULTS.scalingAlpha;
        }

        const value = Number(scalingAlpha);
        return isFinite(value) ? value : DEFAULTS.scalingAlpha;
    };

    private getScalingGamma = (): number => {
        const scalingGamma = localStorage.getItem(PREFERENCE_KEYS.scalingGamma);
        if (!scalingGamma) {
            return DEFAULTS.scalingGamma;
        }

        const value = Number(scalingGamma);
        return isFinite(value) && RenderConfigStore.IsGammaValid(value) ? value : DEFAULTS.scalingGamma;
    };

    private getNaNColorHex = (): string => {
        const nanColorHex = localStorage.getItem(PREFERENCE_KEYS.nanColorHex);
        return nanColorHex && isColorValid(nanColorHex) ? nanColorHex : DEFAULTS.nanColorHex;
    };

    private getNaNAlpha = (): number => {
        const nanAlpha = localStorage.getItem(PREFERENCE_KEYS.nanAlpha);
        if (!nanAlpha) {
            return DEFAULTS.nanAlpha;
        }

        const value = Number(nanAlpha);
        return isFinite(value) && value >= 0 && value <= 1 ? value : DEFAULTS.nanAlpha;
    };

    // getters for Contour Config
    private getContourColormapEnabled = (): boolean => {
        const colormapEnabled = localStorage.getItem(PREFERENCE_KEYS.contourColormapEnabled);
        return parseBoolean(colormapEnabled, DEFAULTS.contourColormapEnabled);
    };

    private getContourColormap = (): string => {
        const colormap = localStorage.getItem(PREFERENCE_KEYS.contourColormap);
        return colormap && RenderConfigStore.IsColormapValid(colormap) ? colormap : DEFAULTS.contourColormap;
    };

    private getContourColor = (): string => {
        const contourColor = localStorage.getItem(PREFERENCE_KEYS.contourColor);
        return contourColor && isColorValid(contourColor) ? contourColor : DEFAULTS.contourColor;
    };

    private getContourSmoothingMode = (): CARTA.SmoothingMode => {
        const val = localStorage.getItem(PREFERENCE_KEYS.contourSmoothingMode);
        if (!val) {
            return DEFAULTS.contourSmoothingMode;
        }

        const value = Number(val);
        return value >= 0 && value <= 2 ? value : DEFAULTS.contourSmoothingMode;
    };

    private getContourSmoothingFactor = (): number => {
        const valString = localStorage.getItem(PREFERENCE_KEYS.contourSmoothingFactor);
        if (!valString) {
            return DEFAULTS.contourSmoothingFactor;
        }
        const valInt = parseInt(valString);
        return (isFinite(valInt) && valInt >= 1 && valInt <= 33) ? valInt : DEFAULTS.contourSmoothingFactor;
    };

    private getContourNumLevels = (): number => {
        const valString = localStorage.getItem(PREFERENCE_KEYS.contourNumLevels);
        if (!valString) {
            return DEFAULTS.contourNumLevels;
        }
        const valInt = parseInt(valString);
        return (isFinite(valInt) && valInt >= 1 && valInt <= 15) ? valInt : DEFAULTS.contourNumLevels;
    };

    private getContourThickness = (): number => {
        const valString = localStorage.getItem(PREFERENCE_KEYS.contourThickness);
        if (!valString) {
            return DEFAULTS.contourThickness;
        }
        const value = parseFloat(valString);
        return (isFinite(value) && value > 0 && value <= 10) ? value : DEFAULTS.contourThickness;
    };

    private getContourDecimation = (): number => {
        const valString = localStorage.getItem(PREFERENCE_KEYS.contourDecimation);
        if (!valString) {
            return DEFAULTS.contourDecimation;
        }
        const valInt = parseInt(valString);
        return (isFinite(valInt) && valInt >= 1 && valInt <= 32) ? valInt : DEFAULTS.contourDecimation;
    };

    private getContourCompressionLevel = (): number => {
        const valString = localStorage.getItem(PREFERENCE_KEYS.contourCompressionLevel);
        if (!valString) {
            return DEFAULTS.contourCompressionLevel;
        }
        const valInt = parseInt(valString);
        return (isFinite(valInt) && valInt >= 0 && valInt <= 19) ? valInt : DEFAULTS.contourCompressionLevel;
    };

    private getContourChunkSize = (): number => {
        const valString = localStorage.getItem(PREFERENCE_KEYS.contourChunkSize);
        if (!valString) {
            return DEFAULTS.contourChunkSize;
        }
        const valInt = parseInt(valString);
        return (isFinite(valInt) && valInt >= 1000 && valInt <= 1000000) ? valInt : DEFAULTS.contourChunkSize;
    };

    // getters for WCS overlay
    private getASTColor = (): number => {
        const astColor = localStorage.getItem(PREFERENCE_KEYS.astColor);
        if (!astColor) {
            return DEFAULTS.astColor;
        }

        const value = Number(astColor);
        return isFinite(value) && value >= 0 && value < AST.colors.length ? value : DEFAULTS.astColor;
    };

    private getASTGridVisible = (): boolean => {
        const astGridVisible = localStorage.getItem(PREFERENCE_KEYS.astGridVisible);
        return parseBoolean(astGridVisible, DEFAULTS.astGridVisible);
    };

    private getASTLabelsVisible = (): boolean => {
        const astLabelsVisible = localStorage.getItem(PREFERENCE_KEYS.astLabelsVisible);
        return parseBoolean(astLabelsVisible, DEFAULTS.astLabelsVisible);
    };

    private getWCSType = (): string => {
        const wcsType = localStorage.getItem(PREFERENCE_KEYS.wcsType);
        return wcsType && WCSType.isValid(wcsType) ? wcsType : DEFAULTS.wcsType;
    };

    // getters for region
    private getRegionColor = (): string => {
        const regionColor = localStorage.getItem(PREFERENCE_KEYS.regionColor);
        return regionColor && isColorValid(regionColor) ? regionColor : DEFAULTS.regionColor;
    };

    private getRegionLineWidth = (): number => {
        const regionLineWidth = localStorage.getItem(PREFERENCE_KEYS.regionLineWidth);
        if (!regionLineWidth) {
            return DEFAULTS.regionLineWidth;
        }

        const value = Number(regionLineWidth);
        return isFinite(value) && RegionStore.IsRegionLineWidthValid(value) ? value : DEFAULTS.regionLineWidth;
    };

    private getRegionDashLength = (): number => {
        const regionDashLength = localStorage.getItem(PREFERENCE_KEYS.regionDashLength);
        if (!regionDashLength) {
            return DEFAULTS.regionDashLength;
        }

        const value = Number(regionDashLength);
        return isFinite(value) && RegionStore.IsRegionDashLengthValid(value) ? value : DEFAULTS.regionDashLength;
    };

    private getRegionType = (): CARTA.RegionType => {
        const regionType = localStorage.getItem(PREFERENCE_KEYS.regionType);
        if (!regionType) {
            return DEFAULTS.regionType;
        }

        const value = Number(regionType);
        return isFinite(value) && RegionStore.IsRegionTypeValid(value) ? value : DEFAULTS.regionType;
    };

    private getRegionCreationMode = (): string => {
        const regionCreationMode = localStorage.getItem(PREFERENCE_KEYS.regionCreationMode);
        return regionCreationMode && RegionCreationMode.isValid(regionCreationMode) ? regionCreationMode : DEFAULTS.regionCreationMode;
    };

    // getters for performance
    private getImageCompressionQuality = (): number => {
        const imageCompressionQuality = localStorage.getItem(PREFERENCE_KEYS.imageCompressionQuality);
        if (!imageCompressionQuality) {
            return DEFAULTS.imageCompressionQuality;
        }

        const value = Number(imageCompressionQuality);
        return isFinite(value) && CompressionQuality.isImageCompressionQualityValid(value) ? value : DEFAULTS.imageCompressionQuality;
    };

    private getAnimationCompressionQuality = (): number => {
        const animationCompressionQuality = localStorage.getItem(PREFERENCE_KEYS.animationCompressionQuality);
        if (!animationCompressionQuality) {
            return DEFAULTS.animationCompressionQuality;
        }

        const value = Number(animationCompressionQuality);
        return isFinite(value) && CompressionQuality.isAnimationCompressionQualityValid(value) ? value : DEFAULTS.animationCompressionQuality;
    };

    private getGPUTileCache = (): number => {
        const GPUTileCache = localStorage.getItem(PREFERENCE_KEYS.GPUTileCache);
        if (!GPUTileCache) {
            return DEFAULTS.GPUTileCache;
        }

        const value = Number(GPUTileCache);
        return isFinite(value) && TileCache.isGPUTileCacheValid(value) ? value : DEFAULTS.GPUTileCache;
    };

    private getSystemTileCache = (): number => {
        const systemTileCache = localStorage.getItem(PREFERENCE_KEYS.systemTileCache);
        if (!systemTileCache) {
            return DEFAULTS.systemTileCache;
        }

        const value = Number(systemTileCache);
        return isFinite(value) && TileCache.isSystemTileCacheValid(value) ? value : DEFAULTS.systemTileCache;
    };

    private getStreamTilesWhileZooming = (): boolean => {
        const val = localStorage.getItem(PREFERENCE_KEYS.streamContoursWhileZooming);
        return parseBoolean(val, DEFAULTS.streamContoursWhileZooming);
    };

    // getters for log event, the list saved in local storage should be a string array like ["REGISTER_VIEWER", "OPEN_FILE_ACK", ...]
    private getLogEvents = (): Map<CARTA.EventType, boolean> => {
        let events = new Map<CARTA.EventType, boolean>();
        Event.EVENT_TYPES.forEach(eventType => events.set(eventType, DEFAULTS.eventLoggingEnabled));

        const localStorageEventList = localStorage.getItem(PREFERENCE_KEYS.logEventList);
        if (localStorageEventList && localStorageEventList.length) {
            try {
                const eventNameList = JSON.parse(localStorageEventList);
                if (eventNameList && Array.isArray(eventNameList) && eventNameList.length) {
                    eventNameList.forEach((eventName) => {
                        const eventType = Event.getEventTypeFromName(eventName);
                        if (eventType !== undefined) {
                            events.set(eventType, true);
                        }
                    });
                }
            } catch (e) {
                console.log("Invalid event list read from local storage");
            }
        }
        return events;
    };

    public isEventLoggingEnabled = (eventType: CARTA.EventType): boolean => {
        return Event.isEventTypeValid(eventType) && this.eventsLoggingEnabled.get(eventType);
    };

    public flipEventLoggingEnabled = (eventType: CARTA.EventType): void => {
        if (Event.isEventTypeValid(eventType)) {
            this.eventsLoggingEnabled.set(eventType, !this.eventsLoggingEnabled.get(eventType));
        }
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
        this.eventsLoggingEnabled.forEach((isChecked, eventType) => {
            if (isChecked) {
                eventNames.push(Event.getEventNameFromType(eventType));
            }
        });
        return eventNames;
    }

    // setters for global
    @action setTheme = (theme: string) => {
        this.theme = theme;
        localStorage.setItem(PREFERENCE_KEYS.theme, theme);
    };

    @action setAutoLaunch = (autoLaunch: boolean) => {
        this.autoLaunch = autoLaunch;
        localStorage.setItem(PREFERENCE_KEYS.autoLaunch, autoLaunch ? "true" : "false");
    };

    @action setLayout = (layout: string) => {
        this.layout = layout;
        localStorage.setItem(PREFERENCE_KEYS.layout, layout);
    };

    @action setCursorPosition = (cursorPosition: string) => {
        this.cursorPosition = cursorPosition;
        localStorage.setItem(PREFERENCE_KEYS.cursorPosition, cursorPosition);
    };

    @action setZoomMode = (zoomMode: string) => {
        this.zoomMode = zoomMode;
        localStorage.setItem(PREFERENCE_KEYS.zoomMode, zoomMode);
    };

    @action setDragPanning = (dragPanning: boolean) => {
        this.dragPanning = dragPanning;
        localStorage.setItem(PREFERENCE_KEYS.dragPanning, String(dragPanning));
    };

    // setters for render config
    @action setScaling = (scaling: FrameScaling) => {
        this.scaling = scaling;
        localStorage.setItem(PREFERENCE_KEYS.scaling, scaling.toString(10));
    };

    @action setColormap = (colormap: string) => {
        this.colormap = colormap;
        localStorage.setItem(PREFERENCE_KEYS.colormap, colormap);
    };

    @action setPercentile = (percentile: string) => {
        this.percentile = Number(percentile);
        localStorage.setItem(PREFERENCE_KEYS.percentile, percentile);
    };

    @action setScalingAlpha = (scalingAlpha: number) => {
        this.scalingAlpha = scalingAlpha;
        localStorage.setItem(PREFERENCE_KEYS.scalingAlpha, scalingAlpha.toString(10));
    };

    @action setScalingGamma = (scalingGamma: number) => {
        this.scalingGamma = scalingGamma;
        localStorage.setItem(PREFERENCE_KEYS.scalingGamma, scalingGamma.toString(10));
    };

    @action setNaNColorHex = (nanColorHex: string) => {
        this.nanColorHex = nanColorHex;
        localStorage.setItem(PREFERENCE_KEYS.nanColorHex, nanColorHex);
    };

    @action setNaNAlpha = (nanAlpha: number) => {
        this.nanAlpha = nanAlpha;
        localStorage.setItem(PREFERENCE_KEYS.nanAlpha, nanAlpha.toString(10));
    };

    // setters for contours
    @action setContourSmoothingMode = (val: CARTA.SmoothingMode) => {
        this.contourSmoothingMode = val;
        localStorage.setItem(PREFERENCE_KEYS.contourSmoothingMode, val.toString());
    };

    @action setContourSmoothingFactor = (val: number) => {
        this.contourSmoothingFactor = val;
        localStorage.setItem(PREFERENCE_KEYS.contourSmoothingFactor, val.toString());
    };

    @action setContourNumLevels = (val: number) => {
        this.contourNumLevels = val;
        localStorage.setItem(PREFERENCE_KEYS.contourNumLevels, val.toString());
    };

    @action setContourThickness = (val: number) => {
        this.contourThickness = val;
        localStorage.setItem(PREFERENCE_KEYS.contourThickness, val.toString());
    };

    @action setContourColor = (color: string) => {
        this.contourColor = color;
        localStorage.setItem(PREFERENCE_KEYS.contourColor, color);
    };

    @action setContourColormapEnabled = (val: boolean) => {
        this.contourColormapEnabled = val;
        localStorage.setItem(PREFERENCE_KEYS.contourColormapEnabled, String(val));
    };

    @action setContourColormap = (colormap: string) => {
        this.contourColormap = colormap;
        localStorage.setItem(PREFERENCE_KEYS.contourColormap, colormap);
    };

    @action setContourDecimation = (val: number) => {
        this.contourDecimation = val;
        localStorage.setItem(PREFERENCE_KEYS.contourDecimation, val.toString());
    };

    @action setContourCompressionLevel = (val: number) => {
        this.contourCompressionLevel = val;
        localStorage.setItem(PREFERENCE_KEYS.contourCompressionLevel, val.toString());
    };

    @action setContourChunkSize = (val: number) => {
        this.contourChunkSize = val;
        localStorage.setItem(PREFERENCE_KEYS.contourChunkSize, val.toString());
    };

    // setters for WCS overlay
    @action setASTColor = (astColor: number) => {
        this.astColor = astColor;
        localStorage.setItem(PREFERENCE_KEYS.astColor, astColor.toString(10));
    };

    @action setASTGridVisible = (visible: boolean) => {
        this.astGridVisible = visible;
        localStorage.setItem(PREFERENCE_KEYS.astGridVisible, visible ? "true" : "false");
    };

    @action setASTLabelsVisible = (visible: boolean) => {
        this.astLabelsVisible = visible;
        localStorage.setItem(PREFERENCE_KEYS.astLabelsVisible, visible ? "true" : "false");
    };

    @action setWCSType = (wcsType: string) => {
        this.wcsType = wcsType;
        localStorage.setItem(PREFERENCE_KEYS.wcsType, wcsType);
    };

    // setters for region
    @action setRegionType = (regionType: CARTA.RegionType) => {
        if (this.appStore.activeFrame && this.appStore.activeFrame.regionSet) {
            this.appStore.activeFrame.regionSet.setNewRegionType(regionType);
        }

        this.regionContainer.regionType = regionType;
        localStorage.setItem(PREFERENCE_KEYS.regionType, regionType.toString(10));
    };

    @action setRegionCreationMode = (regionCreationMode: string) => {
        this.regionCreationMode = regionCreationMode;
        localStorage.setItem(PREFERENCE_KEYS.regionCreationMode, regionCreationMode);
    };

    // setters for performance
    @action setImageCompressionQuality = (imageCompressionQuality: number) => {
        this.appStore.compressionQuality = imageCompressionQuality;
        this.imageCompressionQuality = imageCompressionQuality;
        localStorage.setItem(PREFERENCE_KEYS.imageCompressionQuality, imageCompressionQuality.toString(10));
    };

    @action setAnimationCompressionQuality = (animationCompressionQuality: number) => {
        this.animationCompressionQuality = animationCompressionQuality;
        localStorage.setItem(PREFERENCE_KEYS.animationCompressionQuality, animationCompressionQuality.toString(10));
    };

    @action setGPUTileCache = (GPUTileCache: number) => {
        this.GPUTileCache = GPUTileCache;
        localStorage.setItem(PREFERENCE_KEYS.GPUTileCache, GPUTileCache.toString(10));
    };

    @action setSystemTileCache = (systemTileCache: number) => {
        this.systemTileCache = systemTileCache;
        localStorage.setItem(PREFERENCE_KEYS.systemTileCache, systemTileCache.toString(10));
    };

    @action setStreamContoursWhileZooming = (val: boolean) => {
        this.streamTilesWhileZooming = val;
        localStorage.setItem(PREFERENCE_KEYS.streamContoursWhileZooming, String(val));
    };

    // reset functions
    @action resetGlobalSettings = () => {
        this.setTheme(DEFAULTS.theme);
        this.setAutoLaunch(DEFAULTS.autoLaunch);
        this.setLayout(DEFAULTS.layout);
        this.setCursorPosition(DEFAULTS.cursorPosition);
        this.setZoomMode(DEFAULTS.zoomMode);
    };

    @action resetRenderConfigSettings = () => {
        this.setScaling(DEFAULTS.scaling);
        this.setColormap(DEFAULTS.colormap);
        this.setPercentile(DEFAULTS.percentile.toString());
        this.setScalingAlpha(DEFAULTS.scalingAlpha);
        this.setScalingGamma(DEFAULTS.scalingGamma);
        this.setNaNColorHex(DEFAULTS.nanColorHex);
        this.setNaNAlpha(DEFAULTS.nanAlpha);
    };

    @action resetContourConfigSettings = () => {
        this.setContourSmoothingFactor(DEFAULTS.contourSmoothingFactor);
        this.setContourSmoothingMode(DEFAULTS.contourSmoothingMode);
        this.setContourNumLevels(DEFAULTS.contourNumLevels);
        this.setContourThickness(DEFAULTS.contourThickness);
        this.setContourColor(DEFAULTS.contourColor);
        this.setContourColormap(DEFAULTS.contourColormap);
        this.setContourColormapEnabled(DEFAULTS.contourColormapEnabled);
    };

    @action resetWCSOverlaySettings = () => {
        this.setASTColor(DEFAULTS.astColor);
        this.setASTGridVisible(DEFAULTS.astGridVisible);
        this.setASTLabelsVisible(DEFAULTS.astLabelsVisible);
        this.setWCSType(DEFAULTS.wcsType);
    };

    @action resetRegionSettings = () => {
        this.regionContainer.color = DEFAULTS.regionColor;
        this.regionContainer.lineWidth = DEFAULTS.regionLineWidth;
        this.regionContainer.dashLength = DEFAULTS.regionDashLength;
        this.setRegionType(DEFAULTS.regionType);
        this.setRegionCreationMode(DEFAULTS.regionCreationMode);
    };

    @action resetPerformanceSettings = () => {
        this.setImageCompressionQuality(DEFAULTS.imageCompressionQuality);
        this.setAnimationCompressionQuality(DEFAULTS.animationCompressionQuality);
        this.setGPUTileCache(DEFAULTS.GPUTileCache);
        this.setSystemTileCache(DEFAULTS.systemTileCache);
        this.setContourDecimation(DEFAULTS.contourDecimation);
        this.setContourCompressionLevel(DEFAULTS.contourCompressionLevel);
        this.setContourChunkSize(DEFAULTS.contourChunkSize);
        this.setStreamContoursWhileZooming(DEFAULTS.streamContoursWhileZooming);
    };

    @action resetLogEventSettings = () => {
        this.eventsLoggingEnabled.forEach((value, key, map) => map.set(key, DEFAULTS.eventLoggingEnabled));
    };

    constructor(appStore: AppStore, layoutStore: LayoutStore) {
        this.appStore = appStore;
        this.layoutStore = layoutStore;
        this.theme = this.getTheme();
        this.autoLaunch = this.getAutoLaunch();
        this.layout = this.getLayout();
        this.cursorPosition = this.getCursorPosition();
        this.zoomMode = this.getZoomMode();
        this.dragPanning = this.getDragPanning();
        this.scaling = this.getScaling();
        this.colormap = this.getColormap();
        this.percentile = this.getPercentile();
        this.scalingAlpha = this.getScalingAlpha();
        this.scalingGamma = this.getScalingGamma();
        this.nanColorHex = this.getNaNColorHex();
        this.nanAlpha = this.getNaNAlpha();
        this.contourSmoothingMode = this.getContourSmoothingMode();
        this.contourSmoothingFactor = this.getContourSmoothingFactor();
        this.contourNumLevels = this.getContourNumLevels();
        this.contourThickness = this.getContourThickness();
        this.contourColor = this.getContourColor();
        this.contourColormap = this.getContourColormap();
        this.contourColormapEnabled = this.getContourColormapEnabled();
        this.astColor = this.getASTColor();
        this.astGridVisible = this.getASTGridVisible();
        this.astLabelsVisible = this.getASTLabelsVisible();
        this.wcsType = this.getWCSType();
        this.regionCreationMode = this.getRegionCreationMode();
        this.imageCompressionQuality = this.getImageCompressionQuality();
        this.animationCompressionQuality = this.getAnimationCompressionQuality();
        this.GPUTileCache = this.getGPUTileCache();
        this.systemTileCache = this.getSystemTileCache();
        this.contourDecimation = this.getContourDecimation();
        this.contourCompressionLevel = this.getContourCompressionLevel();
        this.contourChunkSize = this.getContourChunkSize();
        this.streamTilesWhileZooming = this.getStreamTilesWhileZooming();
        this.eventsLoggingEnabled = this.getLogEvents();

        // setup region settings container (for AppearanceForm in PreferenceDialogComponent)
        this.regionContainer = new RegionStore(null, -1, null, [{x: 0, y: 0}, {x: 1, y: 1}], this.getRegionType(), -1);
        this.regionContainer.color = this.getRegionColor();
        this.regionContainer.lineWidth = this.getRegionLineWidth();
        this.regionContainer.dashLength = this.getRegionDashLength();

        autorun(() => {
            localStorage.setItem(PREFERENCE_KEYS.regionColor, this.regionContainer.color);
            localStorage.setItem(PREFERENCE_KEYS.regionLineWidth, this.regionContainer.lineWidth.toString(10));
            localStorage.setItem(PREFERENCE_KEYS.regionDashLength, this.regionContainer.dashLength.toString(10));
        });

        autorun(() => {
            try {
                localStorage.setItem(PREFERENCE_KEYS.logEventList, JSON.stringify(this.enabledLoggingEventNames));
            } catch (e) {
                console.log("Save event list to local storage failed!");
            }
        });
    }
}
