import {observable, computed, action, autorun} from "mobx";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {FrameScaling, RenderConfigStore, RegionStore} from "stores";
import {Theme, Layout, Zoom, WCSType, RegionCreationMode} from "models";
import { AppStore } from "./AppStore";

const PREFERENCE_KEYS = {
    theme: "CARTA_theme",
    autoLaunch: "CARTA_autoLaunch",
    layout: "CARTA_layout",
    cursorFreeze: "CARTA_cursorFreeze",
    zoomMode: "CARTA_zoomMode",
    scaling: "CARTA_scaling",
    colormap: "CARTA_colormap",
    percentile: "CARTA_percentile",
    astColor: "CARTA_astColor",
    astGridVisible: "CARTA_astGridVisible",
    astLabelsVisible: "CARTA_astLabelsVisible",
    wcsType: "CARTA_wcsType",
    regionColor: "CARTA_regionColor",
    regionLineWidth: "CARTA_regionLineWidth",
    regionDashLength: "CARTA_regionDashLength",
    regionType: "CARTA_regionType",
    regionCreationMode: "CARTA_regionCreationMode"
};

const DEFAULTS = {
    theme: Theme.LIGHT,
    autoLaunch: true,
    layout: Layout.CUBEVIEW,
    cursorFreeze: false,
    zoomMode: Zoom.FIT,
    scaling: FrameScaling.LINEAR,
    colormap: "inferno",
    percentile: 99.9,
    astColor: 4,
    astGridVisible: true,
    astLabelsVisible: true,
    wcsType: WCSType.AUTOMATIC,
    regionColor: "#2EE6D6",
    regionLineWidth: 2,
    regionDashLength: 0,
    regionType: CARTA.RegionType.RECTANGLE,
    regionCreationMode: RegionCreationMode.CENTER
};

export class PreferenceStore {
    private readonly appStore: AppStore;

    @observable theme: string;
    @observable autoLaunch: boolean;
    @observable layout: string;
    @observable cursorFreeze: boolean;
    @observable zoomMode: string;
    @observable scaling: FrameScaling;
    @observable colormap: string;
    @observable percentile: number;
    @observable astColor: number;
    @observable astGridVisible: boolean;
    @observable astLabelsVisible: boolean;
    @observable wcsType: string;
    @observable regionContainer: RegionStore;
    @observable regionCreationMode: string;

    // getters for global settings
    private getTheme = (): string => {
        const theme = localStorage.getItem(PREFERENCE_KEYS.theme);
        return theme && Theme.isValid(theme) ? theme : DEFAULTS.theme;
    }

    private getAutoLaunch = (): boolean => {
        return localStorage.getItem(PREFERENCE_KEYS.autoLaunch) === "false" ? false : DEFAULTS.autoLaunch;
    }

    private getLayout = (): string => {
        const layout = localStorage.getItem(PREFERENCE_KEYS.layout);
        return layout && Layout.isValid(layout) ? layout : DEFAULTS.layout;
    }

    private getCursorFreeze = (): boolean => {
        return localStorage.getItem(PREFERENCE_KEYS.cursorFreeze) === "true" ? true : DEFAULTS.cursorFreeze;
    }

    private getZoomMode = (): string => {
        const zoomMode = localStorage.getItem(PREFERENCE_KEYS.zoomMode);
        return zoomMode && Zoom.isValid(zoomMode) ? zoomMode : DEFAULTS.zoomMode;
    }

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
        return astGridVisible === "false" ? false : DEFAULTS.astGridVisible;
    };

    private getASTLabelsVisible = (): boolean => {
        const astLabelsVisible = localStorage.getItem(PREFERENCE_KEYS.astLabelsVisible);
        return astLabelsVisible === "false" ? false : DEFAULTS.astLabelsVisible;
    };

    private getWCSType = (): string => {
        const wcsType = localStorage.getItem(PREFERENCE_KEYS.wcsType);
        return wcsType && WCSType.isValid(wcsType) ? wcsType : DEFAULTS.wcsType;
    };

    // getters for region
    private getRegionColor = (): string => {
        const regionColor = localStorage.getItem(PREFERENCE_KEYS.regionColor);
        return regionColor && RegionStore.IsRegionColorValid(regionColor) ? regionColor : DEFAULTS.regionColor;
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
    }
    
    // getters for boolean(convenient)
    @computed get isDarkTheme(): boolean {
        return this.theme === Theme.DARK ? true : false;
    }

    @computed get isZoomRAWMode(): boolean {
        return this.zoomMode === Zoom.RAW ? true : false;
    }

    @computed get isRegionCornerMode(): boolean {
        return this.regionCreationMode === RegionCreationMode.CORNER ? true : false;
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

    @action setCursorFreeze = (cursorFreeze: boolean) => {
        this.cursorFreeze = cursorFreeze;
        localStorage.setItem(PREFERENCE_KEYS.cursorFreeze, cursorFreeze ? "true" : "false");
    };

    @action setZoomMode = (zoomMode: string) => {
        this.zoomMode = zoomMode;
        localStorage.setItem(PREFERENCE_KEYS.zoomMode, zoomMode);
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

    // reset functions
    @action resetGlobalSettings = () => {
        this.setTheme(DEFAULTS.theme);
        this.setAutoLaunch(DEFAULTS.autoLaunch);
        this.setLayout(DEFAULTS.layout);
        this.setCursorFreeze(DEFAULTS.cursorFreeze);
        this.setZoomMode(DEFAULTS.zoomMode);
    };

    @action resetRenderConfigSettings = () => {
        this.setScaling(DEFAULTS.scaling);
        this.setColormap(DEFAULTS.colormap);
        this.setPercentile(DEFAULTS.percentile.toString());
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

    constructor(appStore: AppStore) {
        this.appStore = appStore;
        this.theme = this.getTheme();
        this.autoLaunch = this.getAutoLaunch();
        this.layout = this.getLayout();
        this.cursorFreeze = this.getCursorFreeze();
        this.zoomMode = this.getZoomMode();
        this.scaling = this.getScaling();
        this.colormap = this.getColormap();
        this.percentile = this.getPercentile();
        this.astColor = this.getASTColor();
        this.astGridVisible = this.getASTGridVisible();
        this.astLabelsVisible = this.getASTLabelsVisible();
        this.wcsType = this.getWCSType();
        this.regionCreationMode = this.getRegionCreationMode();

        // setup region settings container (for AppearanceForm in PreferenceDialogComponent)
        this.regionContainer = new RegionStore(null, -1, [{x: 0, y: 0}, {x: 1, y: 1}], this.getRegionType(), -1);
        this.regionContainer.color = this.getRegionColor();
        this.regionContainer.lineWidth = this.getRegionLineWidth();
        this.regionContainer.dashLength = this.getRegionDashLength();

        autorun(() => {
            localStorage.setItem(PREFERENCE_KEYS.regionColor, this.regionContainer.color);
            localStorage.setItem(PREFERENCE_KEYS.regionLineWidth, this.regionContainer.lineWidth.toString(10));
            localStorage.setItem(PREFERENCE_KEYS.regionDashLength, this.regionContainer.dashLength.toString(10));
        });
    }
}
