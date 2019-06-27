import {observable, action, autorun} from "mobx";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {FrameScaling, RenderConfigStore, RegionStore} from "stores";
import {Theme, Layout, Zoom, WCSType, RegionCreationMode} from "models";

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
    @observable regionContainer: RegionStore;

    // getters
    getTheme = (): string => {
        const theme = localStorage.getItem(PREFERENCE_KEYS.theme);
        return theme && Theme.isValid(theme) ? theme : DEFAULTS.theme;
    }

    getAutoLaunch = (): boolean => {
        return localStorage.getItem(PREFERENCE_KEYS.autoLaunch) === "false" ? false : DEFAULTS.autoLaunch;
    }

    getLayout = (): string => {
        const layout = localStorage.getItem(PREFERENCE_KEYS.layout);
        return layout && Layout.isValid(layout) ? layout : DEFAULTS.layout;
    }

    getCursorFreeze = (): boolean => {
        return localStorage.getItem(PREFERENCE_KEYS.cursorFreeze) === "true" ? true : DEFAULTS.cursorFreeze;
    }

    getZoomMode = (): string => {
        const zoomMode = localStorage.getItem(PREFERENCE_KEYS.zoomMode);
        return zoomMode && Zoom.isValid(zoomMode) ? zoomMode : DEFAULTS.zoomMode;
    }

    getScaling = (): FrameScaling => {
        const scaling = localStorage.getItem(PREFERENCE_KEYS.scaling);
        if (!scaling) {
            return DEFAULTS.scaling;
        }

        const value = Number(scaling);
        return isFinite(value) && RenderConfigStore.IsScalingValid(value) ? value : DEFAULTS.scaling;
    };

    getColormap = (): string => {
        const colormap = localStorage.getItem(PREFERENCE_KEYS.colormap);
        return colormap && RenderConfigStore.IsColormapValid(colormap) ? colormap : DEFAULTS.colormap;
    };

    getPercentile = (): number => {
        const percentile = localStorage.getItem(PREFERENCE_KEYS.percentile);
        if (!percentile) {
            return DEFAULTS.percentile;
        }

        const value = Number(percentile);
        return isFinite(value) && RenderConfigStore.IsPercentileValid(value) ? value : DEFAULTS.percentile;
    };

    getASTColor = (): number => {
        const astColor = localStorage.getItem(PREFERENCE_KEYS.astColor);
        if (!astColor) {
            return DEFAULTS.astColor;
        }

        const value = Number(astColor);
        return isFinite(value) && value >= 0 && value < AST.colors.length ? value : DEFAULTS.astColor;
    };

    getASTGridVisible = (): boolean => {
        const astGridVisible = localStorage.getItem(PREFERENCE_KEYS.astGridVisible);
        return astGridVisible === "false" ? false : DEFAULTS.astGridVisible;
    };

    getASTLabelsVisible = (): boolean => {
        const astLabelsVisible = localStorage.getItem(PREFERENCE_KEYS.astLabelsVisible);
        return astLabelsVisible === "false" ? false : DEFAULTS.astLabelsVisible;
    };

    getWCSType = (): string => {
        const wcsType = localStorage.getItem(PREFERENCE_KEYS.wcsType);
        return wcsType && WCSType.isValid(wcsType) ? wcsType : DEFAULTS.wcsType;
    };

    getDefaultRegion = (): RegionStore => {
        return this.regionContainer;
    };

    getRegionType = (): CARTA.RegionType => {
        const regionType = localStorage.getItem(PREFERENCE_KEYS.regionType);
        if (!regionType) {
            return DEFAULTS.regionType;
        }

        const value = Number(regionType);
        return isFinite(value) && RegionStore.IsRegionTypeValid(value) ? value : DEFAULTS.regionType;
    };

    getRegionColor = (): string => {
        const regionColor = localStorage.getItem(PREFERENCE_KEYS.regionColor);
        return regionColor && RegionStore.IsRegionColorValid(regionColor) ? regionColor : DEFAULTS.regionColor;
    };

    getRegionLineWidth = (): number => {
        const regionLineWidth = localStorage.getItem(PREFERENCE_KEYS.regionLineWidth);
        if (!regionLineWidth) {
            return DEFAULTS.regionLineWidth;
        }

        const value = Number(regionLineWidth);
        return isFinite(value) && RegionStore.IsRegionLineWidthValid(value) ? value : DEFAULTS.regionLineWidth;
    };

    getRegionDashLength = (): number => {
        const regionDashLength = localStorage.getItem(PREFERENCE_KEYS.regionDashLength);
        if (!regionDashLength) {
            return DEFAULTS.regionDashLength;
        }

        const value = Number(regionDashLength);
        return isFinite(value) && RegionStore.IsRegionDashLengthValid(value) ? value : DEFAULTS.regionDashLength;
    };

    getRegionCreationMode = (): string => {
        const regionCreationMode = localStorage.getItem(PREFERENCE_KEYS.regionCreationMode);
        return regionCreationMode && RegionCreationMode.isValid(regionCreationMode) ? regionCreationMode : DEFAULTS.regionCreationMode;
    }
    
    isDarkTheme = (): boolean => {
        return localStorage.getItem(PREFERENCE_KEYS.theme) === Theme.DARK ? true : false;
    };

    isZoomFitMode = (): boolean => {
        return localStorage.getItem(PREFERENCE_KEYS.zoomMode) === Zoom.FIT ? true : false;
    }

    isRegionCornerMode = (): boolean => {
        return localStorage.getItem(PREFERENCE_KEYS.regionCreationMode) === RegionCreationMode.CORNER ? true : false;
    }

    // setters
    setTheme = (theme: string) => {
        localStorage.setItem(PREFERENCE_KEYS.theme, theme);
    };

    setAutoLaunch = (autoLaunch: boolean) => {
        localStorage.setItem(PREFERENCE_KEYS.autoLaunch, autoLaunch ? "true" : "false");
    };

    setLayout = (layout: string) => {
        localStorage.setItem(PREFERENCE_KEYS.layout, layout);
    };

    setCursorFreeze = (cursorFreeze: boolean) => {
        localStorage.setItem(PREFERENCE_KEYS.cursorFreeze, cursorFreeze ? "true" : "false");
    };

    setZoomMode = (zoomMode: string) => {
        localStorage.setItem(PREFERENCE_KEYS.zoomMode, zoomMode);
    };

    setScaling = (scaling: FrameScaling) => {
        localStorage.setItem(PREFERENCE_KEYS.scaling, scaling.toString(10));
    };

    setColormap = (colormap: string) => {
        localStorage.setItem(PREFERENCE_KEYS.colormap, colormap);
    };

    setPercentile = (percentile: string) => {
        localStorage.setItem(PREFERENCE_KEYS.percentile, percentile);
    };

    setASTColor = (astColor: number) => {
        localStorage.setItem(PREFERENCE_KEYS.astColor, astColor.toString(10));
    };

    setASTGridVisible = (visible: boolean) => {
        localStorage.setItem(PREFERENCE_KEYS.astGridVisible, visible ? "true" : "false");
    };

    setASTLabelsVisible = (visible: boolean) => {
        localStorage.setItem(PREFERENCE_KEYS.astLabelsVisible, visible ? "true" : "false");
    };

    setWCSType = (wcsType: string) => {
        localStorage.setItem(PREFERENCE_KEYS.wcsType, wcsType);
    };

    setRegionType = (regionType: CARTA.RegionType) => {
        this.regionContainer.regionType = regionType;
        localStorage.setItem(PREFERENCE_KEYS.regionType, regionType.toString(10));
    };

    setRegionCreationMode = (regionCreationMode: string) => {
        localStorage.setItem(PREFERENCE_KEYS.regionCreationMode, regionCreationMode);
    };

    resetGlobalSettings = () => {
        this.setTheme(DEFAULTS.theme);
        this.setAutoLaunch(DEFAULTS.autoLaunch);
        this.setLayout(DEFAULTS.layout);
        this.setCursorFreeze(DEFAULTS.cursorFreeze);
        this.setZoomMode(DEFAULTS.zoomMode);
    };

    resetRenderConfigSettings = () => {
        this.setScaling(DEFAULTS.scaling);
        this.setColormap(DEFAULTS.colormap);
        this.setPercentile(DEFAULTS.percentile.toString());
    };

    resetWCSOverlaySettings = () => {
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

    constructor() {
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
