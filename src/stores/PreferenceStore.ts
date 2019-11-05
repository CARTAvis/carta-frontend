import {observable, computed, action, autorun} from "mobx";
import {Colors} from "@blueprintjs/core";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {AppStore, FrameScaling, RenderConfigStore, RegionStore} from "stores";
import {Theme, PresetLayout, CursorPosition, Zoom, WCSType, RegionCreationMode, CompressionQuality, TileCache, Event} from "models";
import {isColorValid, parseBoolean} from "utilities";
import {BackendService} from "services";

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
    GLOBAL: {
        theme: Theme.LIGHT,
        autoLaunch: true,
        layout: PresetLayout.DEFAULT,
        cursorPosition: CursorPosition.TRACKING,
        zoomMode: Zoom.FIT,
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
        streamContoursWhileZooming: false
    },
    LOG_EVENT: {
        eventLoggingEnabled: false
    }
};

export class PreferenceStore {
    private readonly appStore: AppStore;
    private readonly backendService: BackendService;
    private serverSupport: boolean;

    @observable preference: any;
    @observable global: any;
    @observable renderConfig: any;
    @observable contourConfig: any;
    @observable wcsOverlay: any;
    @observable region: any;
    @observable performance: any;
    @observable eventsLoggingEnabled: Map<CARTA.EventType, boolean>;

    // TODO: all getters need to prevent sending null!
    // getters for global settings
    public getTheme = (): string => {
        return this.global.theme;
    };

    public getAutoLaunch = (): boolean => {
        return this.global.autoLaunch;
    };

    public getLayout = (): string => {
        return this.global.layout;
    };

    public getCursorPosition = (): string => {
        return this.global.cursorPosition;
    };

    public getZoomMode = (): string => {
        return this.global.zoomMode;
    };

    public getDragPanning = (): boolean => {
        return this.global.dragPanning;
    };

    // getters for render config
    public getScaling = (): FrameScaling => {
        return this.renderConfig.scaling;
    };

    public getColormap = (): string => {
        return this.renderConfig.colormap;
    };

    public getPercentile = (): number => {
        return this.renderConfig.percentile;
    };

    public getScalingAlpha = (): number => {
        return this.renderConfig.scalingAlpha;
    };

    public getScalingGamma = (): number => {
        return this.renderConfig.scalingGamma;
    };

    public getNaNColorHex = (): string => {
        return this.renderConfig.nanColorHex;
    };

    public getNaNAlpha = (): number => {
        return this.renderConfig.nanAlpha;
    };

    // getters for Contour Config
    public getContourColormapEnabled = (): boolean => {
        return this.contourConfig.contourColormapEnabled;
    };

    public getContourColormap = (): string => {
        return this.contourConfig.contourColormap;
    };

    public getContourColor = (): string => {
        return this.contourConfig.contourColor;
    };

    public getContourSmoothingMode = (): CARTA.SmoothingMode => {
        return this.contourConfig.contourSmoothingMode;
    };

    public getContourSmoothingFactor = (): number => {
        return this.contourConfig.contourSmoothingFactor;
    };

    public getContourNumLevels = (): number => {
        return this.contourConfig.contourNumLevels;
    };

    public getContourThickness = (): number => {
        return this.contourConfig.contourThickness;
    };

    public getContourDecimation = (): number => {
        return this.performance.contourDecimation;
    };

    public getContourCompressionLevel = (): number => {
        return this.performance.contourCompressionLevel;
    };

    public getContourChunkSize = (): number => {
        return this.performance.contourChunkSize;
    };

    // getters for WCS overlay
    public getASTColor = (): number => {
        return this.wcsOverlay.astColor;
    };

    public getASTGridVisible = (): boolean => {
        return this.wcsOverlay.astGridVisible;
    };

    public getASTLabelsVisible = (): boolean => {
        return this.wcsOverlay.astLabelsVisible;
    };

    public getWCSType = (): string => {
        return this.wcsOverlay.wcsType;
    };

    // getters for region // TODO: check return this.region or this.region.regioncontainer
    public getRegionColor = (): string => {
        return this.region.regionContainer.color;
    };

    public getRegionLineWidth = (): number => {
        return this.region.regionContainer.lineWidth;
    };

    public getRegionDashLength = (): number => {
        return this.region.regionContainer.dashLength;
    };

    public getRegionType = (): CARTA.RegionType => {
        return this.region.regionContainer.regionType;
    };

    public getRegionCreationMode = (): string => {
        return this.region.regionCreationMode;
    };

    // getters for performance
    public getImageCompressionQuality = (): number => {
        return this.performance.imageCompressionQuality;
    };

    public getAnimationCompressionQuality = (): number => {
        return this.performance.animationCompressionQuality;
    };

    public getGPUTileCache = (): number => {
        return this.performance.GPUTileCache;
    };

    public getSystemTileCache = (): number => {
        return this.performance.systemTileCache;
    };

    public getStreamTilesWhileZooming = (): boolean => {
        return this.performance.streamContoursWhileZooming;
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
        return this.global.theme === Theme.DARK;
    }

    @computed get isZoomRAWMode(): boolean {
        return this.global.zoomMode === Zoom.RAW;
    }

    @computed get isRegionCornerMode(): boolean {
        return this.region.regionCreationMode === RegionCreationMode.CORNER;
    }

    @computed get isCursorFrozen(): boolean {
        return this.global.cursorPosition === CursorPosition.FIXED;
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
        this.global.theme = theme;
        localStorage.setItem(PREFERENCE_KEYS.theme, theme);
    };

    @action setAutoLaunch = (autoLaunch: boolean) => {
        this.global.autoLaunch = autoLaunch;
        localStorage.setItem(PREFERENCE_KEYS.autoLaunch, autoLaunch ? "true" : "false");
    };

    @action setLayout = (layout: string) => {
        this.global.layout = layout;
        localStorage.setItem(PREFERENCE_KEYS.layout, layout);
    };

    @action setCursorPosition = (cursorPosition: string) => {
        this.global.cursorPosition = cursorPosition;
        localStorage.setItem(PREFERENCE_KEYS.cursorPosition, cursorPosition);
    };

    @action setZoomMode = (zoomMode: string) => {
        this.global.zoomMode = zoomMode;
        localStorage.setItem(PREFERENCE_KEYS.zoomMode, zoomMode);
    };

    @action setDragPanning = (dragPanning: boolean) => {
        this.global.dragPanning = dragPanning;
        localStorage.setItem(PREFERENCE_KEYS.dragPanning, String(dragPanning));
    };

    // setters for render config
    @action setScaling = (scaling: FrameScaling) => {
        this.renderConfig.scaling = scaling;
        localStorage.setItem(PREFERENCE_KEYS.scaling, scaling.toString(10));
    };

    @action setColormap = (colormap: string) => {
        this.renderConfig.colormap = colormap;
        localStorage.setItem(PREFERENCE_KEYS.colormap, colormap);
    };

    @action setPercentile = (percentile: string) => {
        this.renderConfig.percentile = Number(percentile);
        localStorage.setItem(PREFERENCE_KEYS.percentile, percentile);
    };

    @action setScalingAlpha = (scalingAlpha: number) => {
        this.renderConfig.scalingAlpha = scalingAlpha;
        localStorage.setItem(PREFERENCE_KEYS.scalingAlpha, scalingAlpha.toString(10));
    };

    @action setScalingGamma = (scalingGamma: number) => {
        this.renderConfig.scalingGamma = scalingGamma;
        localStorage.setItem(PREFERENCE_KEYS.scalingGamma, scalingGamma.toString(10));
    };

    @action setNaNColorHex = (nanColorHex: string) => {
        this.renderConfig.nanColorHex = nanColorHex;
        localStorage.setItem(PREFERENCE_KEYS.nanColorHex, nanColorHex);
    };

    @action setNaNAlpha = (nanAlpha: number) => {
        this.renderConfig.nanAlpha = nanAlpha;
        localStorage.setItem(PREFERENCE_KEYS.nanAlpha, nanAlpha.toString(10));
    };

    // setters for contours
    @action setContourSmoothingMode = (val: CARTA.SmoothingMode) => {
        this.contourConfig.contourSmoothingMode = val;
        localStorage.setItem(PREFERENCE_KEYS.contourSmoothingMode, val.toString());
    };

    @action setContourSmoothingFactor = (val: number) => {
        this.contourConfig.contourSmoothingFactor = val;
        localStorage.setItem(PREFERENCE_KEYS.contourSmoothingFactor, val.toString());
    };

    @action setContourNumLevels = (val: number) => {
        this.contourConfig.contourNumLevels = val;
        localStorage.setItem(PREFERENCE_KEYS.contourNumLevels, val.toString());
    };

    @action setContourThickness = (val: number) => {
        this.contourConfig.contourThickness = val;
        localStorage.setItem(PREFERENCE_KEYS.contourThickness, val.toString());
    };

    @action setContourColor = (color: string) => {
        this.contourConfig.contourColor = color;
        localStorage.setItem(PREFERENCE_KEYS.contourColor, color);
    };

    @action setContourColormapEnabled = (val: boolean) => {
        this.contourConfig.contourColormapEnabled = val;
        localStorage.setItem(PREFERENCE_KEYS.contourColormapEnabled, String(val));
    };

    @action setContourColormap = (colormap: string) => {
        this.contourConfig.contourColormap = colormap;
        localStorage.setItem(PREFERENCE_KEYS.contourColormap, colormap);
    };

    @action setContourDecimation = (val: number) => {
        this.performance.contourDecimation = val;
        localStorage.setItem(PREFERENCE_KEYS.contourDecimation, val.toString());
    };

    @action setContourCompressionLevel = (val: number) => {
        this.performance.contourCompressionLevel = val;
        localStorage.setItem(PREFERENCE_KEYS.contourCompressionLevel, val.toString());
    };

    @action setContourChunkSize = (val: number) => {
        this.performance.contourChunkSize = val;
        localStorage.setItem(PREFERENCE_KEYS.contourChunkSize, val.toString());
    };

    // setters for WCS overlay
    @action setASTColor = (astColor: number) => {
        this.wcsOverlay.astColor = astColor;
        localStorage.setItem(PREFERENCE_KEYS.astColor, astColor.toString(10));
    };

    @action setASTGridVisible = (visible: boolean) => {
        this.wcsOverlay.astGridVisible = visible;
        localStorage.setItem(PREFERENCE_KEYS.astGridVisible, visible ? "true" : "false");
    };

    @action setASTLabelsVisible = (visible: boolean) => {
        this.wcsOverlay.astLabelsVisible = visible;
        localStorage.setItem(PREFERENCE_KEYS.astLabelsVisible, visible ? "true" : "false");
    };

    @action setWCSType = (wcsType: string) => {
        this.wcsOverlay.wcsType = wcsType;
        localStorage.setItem(PREFERENCE_KEYS.wcsType, wcsType);
    };

    // setters for region
    @action setRegionColor = (color: string) => {
        this.region.regionContainer.setColor(color);
        localStorage.setItem(PREFERENCE_KEYS.regionColor, color);
    };

    @action setRegionLineWidth = (lineWidth: number) => {
        this.region.regionContainer.setLineWidth(lineWidth);
        localStorage.setItem(PREFERENCE_KEYS.regionLineWidth, lineWidth.toString(10));
    };

    @action setRegionDashLength = (dashLength: number) => {
        this.region.regionContainer.setDashLengt(dashLength);
        localStorage.setItem(PREFERENCE_KEYS.regionDashLength, dashLength.toString(10));
    };

    @action setRegionType = (regionType: CARTA.RegionType) => {
        if (this.appStore.activeFrame && this.appStore.activeFrame.regionSet) {
            this.appStore.activeFrame.regionSet.setNewRegionType(regionType);
        }

        this.region.regionContainer.regionType = regionType;
        localStorage.setItem(PREFERENCE_KEYS.regionType, regionType.toString(10));
    };

    @action setRegionCreationMode = (regionCreationMode: string) => {
        this.region.regionCreationMode = regionCreationMode;
        localStorage.setItem(PREFERENCE_KEYS.regionCreationMode, regionCreationMode);
    };

    // setters for performance
    @action setImageCompressionQuality = (imageCompressionQuality: number) => {
        this.appStore.compressionQuality = imageCompressionQuality;
        this.performance.imageCompressionQuality = imageCompressionQuality;
        localStorage.setItem(PREFERENCE_KEYS.imageCompressionQuality, imageCompressionQuality.toString(10));
    };

    @action setAnimationCompressionQuality = (animationCompressionQuality: number) => {
        this.performance.animationCompressionQuality = animationCompressionQuality;
        localStorage.setItem(PREFERENCE_KEYS.animationCompressionQuality, animationCompressionQuality.toString(10));
    };

    @action setGPUTileCache = (GPUTileCache: number) => {
        this.performance.GPUTileCache = GPUTileCache;
        localStorage.setItem(PREFERENCE_KEYS.GPUTileCache, GPUTileCache.toString(10));
    };

    @action setSystemTileCache = (systemTileCache: number) => {
        this.performance.systemTileCache = systemTileCache;
        localStorage.setItem(PREFERENCE_KEYS.systemTileCache, systemTileCache.toString(10));
    };

    @action setStreamContoursWhileZooming = (val: boolean) => {
        this.performance.streamTilesWhileZooming = val;
        localStorage.setItem(PREFERENCE_KEYS.streamContoursWhileZooming, String(val));
    };

    // reset functions
    @action resetGlobalSettings = () => {
        this.setTheme(DEFAULTS.GLOBAL.theme);
        this.setAutoLaunch(DEFAULTS.GLOBAL.autoLaunch);
        this.setLayout(DEFAULTS.GLOBAL.layout);
        this.setCursorPosition(DEFAULTS.GLOBAL.cursorPosition);
        this.setZoomMode(DEFAULTS.GLOBAL.zoomMode);
    };

    @action resetRenderConfigSettings = () => {
        this.setScaling(DEFAULTS.RENDER_CONFIG.scaling);
        this.setColormap(DEFAULTS.RENDER_CONFIG.colormap);
        this.setPercentile(DEFAULTS.RENDER_CONFIG.percentile.toString());
        this.setScalingAlpha(DEFAULTS.RENDER_CONFIG.scalingAlpha);
        this.setScalingGamma(DEFAULTS.RENDER_CONFIG.scalingGamma);
        this.setNaNColorHex(DEFAULTS.RENDER_CONFIG.nanColorHex);
        this.setNaNAlpha(DEFAULTS.RENDER_CONFIG.nanAlpha);
    };

    @action resetContourConfigSettings = () => {
        this.setContourSmoothingFactor(DEFAULTS.CONTOUR_CONFIG.contourSmoothingFactor);
        this.setContourSmoothingMode(DEFAULTS.CONTOUR_CONFIG.contourSmoothingMode);
        this.setContourNumLevels(DEFAULTS.CONTOUR_CONFIG.contourNumLevels);
        this.setContourThickness(DEFAULTS.CONTOUR_CONFIG.contourThickness);
        this.setContourColor(DEFAULTS.CONTOUR_CONFIG.contourColor);
        this.setContourColormap(DEFAULTS.CONTOUR_CONFIG.contourColormap);
        this.setContourColormapEnabled(DEFAULTS.CONTOUR_CONFIG.contourColormapEnabled);
    };

    @action resetWCSOverlaySettings = () => {
        this.setASTColor(DEFAULTS.WCS_OVERLAY.astColor);
        this.setASTGridVisible(DEFAULTS.WCS_OVERLAY.astGridVisible);
        this.setASTLabelsVisible(DEFAULTS.WCS_OVERLAY.astLabelsVisible);
        this.setWCSType(DEFAULTS.WCS_OVERLAY.wcsType);
    };

    @action resetRegionSettings = () => {
        this.setRegionColor(DEFAULTS.REGION.regionColor);
        this.setRegionLineWidth(DEFAULTS.REGION.regionLineWidth);
        this.setRegionDashLength(DEFAULTS.REGION.regionDashLength);
        this.setRegionType(DEFAULTS.REGION.regionType);
        this.setRegionCreationMode(DEFAULTS.REGION.regionCreationMode);
    };

    @action resetPerformanceSettings = () => {
        this.setImageCompressionQuality(DEFAULTS.PERFORMANCE.imageCompressionQuality);
        this.setAnimationCompressionQuality(DEFAULTS.PERFORMANCE.animationCompressionQuality);
        this.setGPUTileCache(DEFAULTS.PERFORMANCE.GPUTileCache);
        this.setSystemTileCache(DEFAULTS.PERFORMANCE.systemTileCache);
        this.setContourDecimation(DEFAULTS.PERFORMANCE.contourDecimation);
        this.setContourCompressionLevel(DEFAULTS.PERFORMANCE.contourCompressionLevel);
        this.setContourChunkSize(DEFAULTS.PERFORMANCE.contourChunkSize);
        this.setStreamContoursWhileZooming(DEFAULTS.PERFORMANCE.streamContoursWhileZooming);
    };

    @action resetLogEventSettings = () => {
        this.eventsLoggingEnabled.forEach((value, key, map) => map.set(key, DEFAULTS.LOG_EVENT.eventLoggingEnabled));
    };

    public initUserDefinedPreferences = (serverSupport: boolean, preference: { [k: string]: string; }) => {
        this.serverSupport = serverSupport;
        if (serverSupport) {
            this.initPreferenceFromServer(preference);
        } else {
            this.initPreferenceFromLocalStorage();
        }
    }

    private initPreferenceFromDefault = () => {
        this.global = Object.assign(DEFAULTS.GLOBAL);
        this.renderConfig = Object.assign(DEFAULTS.RENDER_CONFIG);
        this.contourConfig = Object.assign(DEFAULTS.CONTOUR_CONFIG);
        this.wcsOverlay = Object.assign(DEFAULTS.WCS_OVERLAY);
        this.region = Object.assign(DEFAULTS.REGION);
        this.region.regionContainer = new RegionStore(null, -1, null, [{x: 0, y: 0}, {x: 1, y: 1}], DEFAULTS.REGION.regionType, -1);
        this.performance = Object.assign(DEFAULTS.PERFORMANCE);
        this.eventsLoggingEnabled = new Map<CARTA.EventType, boolean>();
        Event.EVENT_TYPES.forEach(eventType => this.eventsLoggingEnabled.set(eventType, DEFAULTS.LOG_EVENT.eventLoggingEnabled));
    };

    private initPreferenceFromServer = (preference: { [k: string]: string; }) => {
        // TODO
    };

    private initPreferenceFromLocalStorage = () => {
        this.initGlobalFromLocalStorage();
        this.initRenderConfigFromLocalStorage();
        this.initContourConfigFromLocalStorage();
        this.initWCSOverlayFromLocalStorage();
        this.initPerformanceFromLocalStorage();
        this.initRegionFromLocalStorage();
        this.initLogEventsFromLocalStorage();
    };

    private initGlobalFromLocalStorage = () => {
        let value;
        value = localStorage.getItem(PREFERENCE_KEYS.theme);
        this.global.theme = value && Theme.isValid(value) ? value : DEFAULTS.GLOBAL.theme;

        value = localStorage.getItem(PREFERENCE_KEYS.autoLaunch);
        this.global.autoLaunch = parseBoolean(value, DEFAULTS.GLOBAL.autoLaunch);

        value = localStorage.getItem(PREFERENCE_KEYS.layout);
        this.global.layout = value && this.appStore.layoutStore.layoutExist(value) ? value : DEFAULTS.GLOBAL.layout;

        value = localStorage.getItem(PREFERENCE_KEYS.cursorPosition);
        this.global.cursorPosition = value && CursorPosition.isValid(value) ? value : DEFAULTS.GLOBAL.cursorPosition;

        value = localStorage.getItem(PREFERENCE_KEYS.zoomMode);
        this.global.zoomMode = value && Zoom.isValid(value) ? value : DEFAULTS.GLOBAL.zoomMode;

        value = localStorage.getItem(PREFERENCE_KEYS.dragPanning);
        this.global.dragPanning = value === "false" ? false : DEFAULTS.GLOBAL.dragPanning;
    };

    private initRenderConfigFromLocalStorage = () => {
        let value;
        value = localStorage.getItem(PREFERENCE_KEYS.scaling);
        this.renderConfig.scaling = value && isFinite(Number(value)) && RenderConfigStore.IsScalingValid(Number(value)) ? Number(value) : DEFAULTS.RENDER_CONFIG.scaling;

        value = localStorage.getItem(PREFERENCE_KEYS.colormap);
        this.renderConfig.colormap =  value && RenderConfigStore.IsColormapValid(value) ? value : DEFAULTS.RENDER_CONFIG.colormap;

        value = localStorage.getItem(PREFERENCE_KEYS.percentile);
        this.renderConfig.percentile = value && isFinite(Number(value)) && RenderConfigStore.IsPercentileValid(Number(value)) ? Number(value) : DEFAULTS.RENDER_CONFIG.percentile;

        value = localStorage.getItem(PREFERENCE_KEYS.scalingAlpha);
        this.renderConfig.scalingAlpha = value && isFinite(Number(value)) ? Number(value) : DEFAULTS.RENDER_CONFIG.scalingAlpha;

        value = localStorage.getItem(PREFERENCE_KEYS.scalingGamma);
        this.renderConfig.scalingGamma = value && isFinite(Number(value)) && RenderConfigStore.IsGammaValid(Number(value)) ? Number(value) : DEFAULTS.RENDER_CONFIG.scalingGamma;

        value = localStorage.getItem(PREFERENCE_KEYS.nanColorHex);
        this.renderConfig.nanColorHex =  value && isColorValid(value) ? value : DEFAULTS.RENDER_CONFIG.nanColorHex;

        value = localStorage.getItem(PREFERENCE_KEYS.nanAlpha);
        this.renderConfig.nanAlpha = value && isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1 ? Number(value) : DEFAULTS.RENDER_CONFIG.nanAlpha;
    };

    private initContourConfigFromLocalStorage = () => {
        let value;
        value = localStorage.getItem(PREFERENCE_KEYS.contourSmoothingMode);
        this.contourConfig.contourSmoothingMode = value && isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 2 ? Number(value) : DEFAULTS.CONTOUR_CONFIG.contourSmoothingMode;

        value = localStorage.getItem(PREFERENCE_KEYS.contourSmoothingFactor);
        this.contourConfig.contourSmoothingFactor = value && (isFinite(parseInt(value)) && parseInt(value) >= 1 && parseInt(value) <= 33) ? parseInt(value) : DEFAULTS.CONTOUR_CONFIG.contourSmoothingFactor;

        value = localStorage.getItem(PREFERENCE_KEYS.contourNumLevels);
        this.contourConfig.contourNumLevels = value && (isFinite(parseInt(value)) && parseInt(value) >= 1 && parseInt(value) <= 15) ? parseInt(value) : DEFAULTS.CONTOUR_CONFIG.contourNumLevels;

        value = localStorage.getItem(PREFERENCE_KEYS.contourThickness);
        this.contourConfig.contourThickness = value && (isFinite(parseFloat(value)) && parseFloat(value) > 0 && parseFloat(value) <= 10) ? parseFloat(value) : DEFAULTS.CONTOUR_CONFIG.contourThickness;

        value = localStorage.getItem(PREFERENCE_KEYS.contourColor);
        this.contourConfig.contourColor = value && isColorValid(value) ? value : DEFAULTS.CONTOUR_CONFIG.contourColor;

        value = localStorage.getItem(PREFERENCE_KEYS.contourColormap);
        this.contourConfig.colormap = value && RenderConfigStore.IsColormapValid(value) ? value : DEFAULTS.CONTOUR_CONFIG.contourColormap;

        value = localStorage.getItem(PREFERENCE_KEYS.contourColormapEnabled);
        this.contourConfig.contourColormapEnabled = parseBoolean(value, DEFAULTS.CONTOUR_CONFIG.contourColormapEnabled);
    };

    private initWCSOverlayFromLocalStorage = () => {
        let value;
        value = localStorage.getItem(PREFERENCE_KEYS.astColor);
        this.wcsOverlay.astColor = value && isFinite(Number(value)) && Number(value) >= 0 && Number(value) < AST.colors.length ? Number(value) : DEFAULTS.WCS_OVERLAY.astColor;

        value = localStorage.getItem(PREFERENCE_KEYS.astGridVisible);
        this.wcsOverlay.astGridVisible = parseBoolean(value, DEFAULTS.WCS_OVERLAY.astGridVisible);

        value = localStorage.getItem(PREFERENCE_KEYS.astLabelsVisible);
        this.wcsOverlay.astLabelsVisible = parseBoolean(value, DEFAULTS.WCS_OVERLAY.astLabelsVisible);

        value = localStorage.getItem(PREFERENCE_KEYS.wcsType);
        this.wcsOverlay.wcsType = value && WCSType.isValid(value) ? value : DEFAULTS.WCS_OVERLAY.wcsType;
    };

    private initRegionFromLocalStorage = () => {
        let value;
        value = localStorage.getItem(PREFERENCE_KEYS.regionColor);
        this.region.regionContainer.setColor(value && isColorValid(value) ? value : DEFAULTS.REGION.regionColor);

        value = localStorage.getItem(PREFERENCE_KEYS.regionLineWidth);
        this.region.regionContainer.setLineWidth(value && isFinite(Number(value)) && RegionStore.IsRegionLineWidthValid(Number(value)) ? Number(value) : DEFAULTS.REGION.regionLineWidth);

        value = localStorage.getItem(PREFERENCE_KEYS.regionDashLength);
        this.region.regionContainer.setDashLength(value && isFinite(Number(value)) && RegionStore.IsRegionDashLengthValid(Number(value)) ? Number(value) : DEFAULTS.REGION.regionDashLength);

        value = localStorage.getItem(PREFERENCE_KEYS.regionType);
        this.region.regionContainer.regionType = value && isFinite(Number(value)) && RegionStore.IsRegionTypeValid(Number(value)) ? Number(value) : DEFAULTS.REGION.regionType;

        value = localStorage.getItem(PREFERENCE_KEYS.regionCreationMode);
        this.region.regionCreationMode = value && RegionCreationMode.isValid(value) ? value : DEFAULTS.REGION.regionCreationMode;
    };

    private initPerformanceFromLocalStorage = () => {
        let value;
        value = localStorage.getItem(PREFERENCE_KEYS.imageCompressionQuality);
        this.performance.imageCompressionQuality = value && isFinite(Number(value)) && CompressionQuality.isImageCompressionQualityValid(Number(value)) ? Number(value) : DEFAULTS.PERFORMANCE.imageCompressionQuality;

        value = localStorage.getItem(PREFERENCE_KEYS.animationCompressionQuality);
        this.performance.animationCompressionQuality = value && isFinite(Number(value)) && CompressionQuality.isAnimationCompressionQualityValid(Number(value)) ? Number(value) : DEFAULTS.PERFORMANCE.animationCompressionQuality;

        value = localStorage.getItem(PREFERENCE_KEYS.GPUTileCache);
        this.performance.GPUTileCache = value && isFinite(Number(value)) && TileCache.isGPUTileCacheValid(Number(value)) ? Number(value) : DEFAULTS.PERFORMANCE.GPUTileCache;

        value = localStorage.getItem(PREFERENCE_KEYS.systemTileCache);
        this.performance.systemTileCache = value && isFinite(Number(value)) && TileCache.isSystemTileCacheValid(Number(value)) ? Number(value) : DEFAULTS.PERFORMANCE.systemTileCache;

        value = localStorage.getItem(PREFERENCE_KEYS.streamContoursWhileZooming);
        this.performance.streamContoursWhileZooming = parseBoolean(value, DEFAULTS.PERFORMANCE.streamContoursWhileZooming);

        value = localStorage.getItem(PREFERENCE_KEYS.contourDecimation);
        this.performance.contourDecimation = value && (isFinite(parseInt(value)) && parseInt(value) >= 1 && parseInt(value) <= 32) ? parseInt(value) : DEFAULTS.PERFORMANCE.contourDecimation;

        value = localStorage.getItem(PREFERENCE_KEYS.contourCompressionLevel);
        this.performance.contourCompressionLevel = value && (isFinite(parseInt(value)) && parseInt(value) >= 0 && parseInt(value) <= 19) ? parseInt(value) : DEFAULTS.PERFORMANCE.contourCompressionLevel;

        value = localStorage.getItem(PREFERENCE_KEYS.contourChunkSize);
        this.performance.contourChunkSize = value && (isFinite(parseInt(value)) && parseInt(value) >= 1000 && parseInt(value) <= 1000000) ? parseInt(value) : DEFAULTS.PERFORMANCE.contourChunkSize;
    };

    // getters for log event, the list saved in local storage should be a string array like ["REGISTER_VIEWER", "OPEN_FILE_ACK", ...]
    private initLogEventsFromLocalStorage = () => {
        const localStorageEventList = localStorage.getItem(PREFERENCE_KEYS.logEventList);
        if (localStorageEventList && localStorageEventList.length) {
            try {
                const eventNameList = JSON.parse(localStorageEventList);
                if (eventNameList && Array.isArray(eventNameList) && eventNameList.length) {
                    eventNameList.forEach((eventName) => {
                        const eventType = Event.getEventTypeFromName(eventName);
                        if (eventType !== undefined) {
                            this.eventsLoggingEnabled.set(eventType, true);
                        }
                    });
                }
            } catch (e) {
                console.log("Invalid event list read from local storage");
            }
        }
    };

    constructor(appStore: AppStore) {
        this.appStore = appStore;
        this.initPreferenceFromDefault();

        autorun(() => {
            try {
                localStorage.setItem(PREFERENCE_KEYS.regionColor, this.region.regionContainer.color);
                localStorage.setItem(PREFERENCE_KEYS.regionLineWidth, this.region.regionContainer.lineWidth.toString(10));
                localStorage.setItem(PREFERENCE_KEYS.regionDashLength, this.region.regionContainer.dashLength.toString(10));
            } catch (e) {
                console.log("Save region settings to local storage failed!");
            }
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
