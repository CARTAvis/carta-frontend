import {action, autorun} from "mobx";
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
    scaling: 0,
    colormap: "inferno",
    percentile: 99.9,
    astColor: 4,
    astGridVisible: true,
    astLabelsVisible: true,
    wcsType: WCSType.AUTOMATIC,
    regionColor: "#2EE6D6",
    regionLineWidth: 2,
    regionDashLength: 0,
    regionType: 3,
    regionCreationMode: RegionCreationMode.CENTER
};

export class PreferenceStore {
    private regionContainer: RegionStore;

    // user configurable settings
    validateScaling(scaling: string) {
        const value = Number(scaling);
        return scaling && isFinite(value) && RenderConfigStore.IsScalingValid(value) ? value : null;
    }

    validateColormap(colormap: string) {
        return colormap && RenderConfigStore.IsColormapValid(colormap) ? colormap : null;
    }

    validatePercentile(percentile: string) {
        const value = Number(percentile);
        return percentile && isFinite(value) && RenderConfigStore.IsPercentileValid(value) ? value : null;
    }

    validateASTColor(astColor: string) {
        const value = Number(astColor);
        return astColor && isFinite(value) && value >= 0 && value < AST.colors.length ? value : null;
    }

    validateWCSType(wcsType: string) {
        return wcsType && (wcsType === WCSType.AUTOMATIC || wcsType === WCSType.DEGREES || wcsType === WCSType.SEXIGESIMAL) ? wcsType : null;
    }

    validateRegionType(regionType: string) {
        const value = Number(regionType);
        return value && isFinite(value) && RegionStore.IsRegionTypeValid(value) ? value : null;
    }

    validateRegionColor(regionColor: string) {
        return regionColor && RegionStore.IsRegionColorValid(regionColor) ? regionColor : null;
    }

    validateRegionLineWidth(regionLineWidth: string) {
        const value = Number(regionLineWidth);
        return value && isFinite(value) && RegionStore.IsRegionLineWidthValid(value) ? value : null;
    }

    validateRegionDashLength(regionDashLength: string) {
        const value = Number(regionDashLength);
        return value && isFinite(value) && RegionStore.IsRegionDashLengthValid(value) ? value : null;
    }

    validateRegionCreationMode(regionCreationMode: string) {
        return regionCreationMode && (regionCreationMode === RegionCreationMode.CENTER || regionCreationMode === RegionCreationMode.CORNER) ? regionCreationMode : null;
    }

    // getters
    getTheme = (): string => {
        const theme = localStorage.getItem(PREFERENCE_KEYS.theme);
        return Theme.isValid(theme) ? theme : DEFAULTS.theme;
    }

    getAutoLaunch = (): boolean => {
        return localStorage.getItem(PREFERENCE_KEYS.autoLaunch) === "false" ? false : DEFAULTS.autoLaunch;
    }

    getLayout = (): string => {
        const layout = localStorage.getItem(PREFERENCE_KEYS.layout);
        return Layout.isValid(layout) ? layout : DEFAULTS.layout;
    }

    getCursorFreeze = (): boolean => {
        return localStorage.getItem(PREFERENCE_KEYS.cursorFreeze) === "true" ? true : DEFAULTS.cursorFreeze;
    }

    getZoomMode = (): string => {
        const zoomMode = localStorage.getItem(PREFERENCE_KEYS.zoomMode);
        return Zoom.isValid(zoomMode) ? zoomMode : DEFAULTS.zoomMode;
    }

    getScaling = (): FrameScaling => {
        const scaling = this.validateScaling(localStorage.getItem(PREFERENCE_KEYS.scaling));
        return scaling !== null ? scaling : DEFAULTS.scaling;
    };

    getColormap = (): string => {
        return this.validateColormap(localStorage.getItem(PREFERENCE_KEYS.colormap)) || DEFAULTS.colormap;
    };

    getPercentile = (): number => {
        return this.validatePercentile(localStorage.getItem(PREFERENCE_KEYS.percentile)) || DEFAULTS.percentile;
    };

    getASTColor = (): number => {
        const astColor = this.validateASTColor(localStorage.getItem(PREFERENCE_KEYS.astColor));
        return astColor !== null ? astColor : DEFAULTS.astColor;
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
        return this.validateWCSType(localStorage.getItem(PREFERENCE_KEYS.wcsType)) || DEFAULTS.wcsType;
    };

    getDefaultRegion = (): RegionStore => {
        return this.regionContainer;
    };

    getRegionType = (): CARTA.RegionType => {
        const regionType = this.validateRegionType(localStorage.getItem(PREFERENCE_KEYS.regionType));
        return regionType !== null ? regionType : DEFAULTS.regionType;
    };

    getRegionColor = (): string => {
        return this.validateRegionColor(localStorage.getItem(PREFERENCE_KEYS.regionColor)) || DEFAULTS.regionColor;
    };

    getRegionLineWidth = (): number => {
        const regionLineWidth = this.validateRegionLineWidth(localStorage.getItem(PREFERENCE_KEYS.regionLineWidth));
        return regionLineWidth !== null ? regionLineWidth : DEFAULTS.regionLineWidth;
    };

    getRegionDashLength = (): number => {
        const regionDashLength = this.validateRegionDashLength(localStorage.getItem(PREFERENCE_KEYS.regionDashLength));
        return regionDashLength !== null ? regionDashLength : DEFAULTS.regionDashLength;
    };

    getRegionCreationMode = (): string => {
        return this.validateRegionCreationMode(localStorage.getItem(PREFERENCE_KEYS.regionCreationMode)) || DEFAULTS.regionCreationMode;
    }

    isRegionCornerMode = (): boolean => {
        return localStorage.getItem(PREFERENCE_KEYS.regionCreationMode) === RegionCreationMode.CORNER ? true : false;
    }
    
    isDarkTheme = (): boolean => {
        return localStorage.getItem(PREFERENCE_KEYS.theme) === Theme.DARK ? true : false;
    };

    isZoomFitMode = (): boolean => {
        return localStorage.getItem(PREFERENCE_KEYS.zoomMode) === Zoom.FIT ? true : false;
    }

    // setters
    @action setTheme = (theme: string) => {
        localStorage.setItem(PREFERENCE_KEYS.theme, theme);
    };

    @action setAutoLaunch = (autoLaunch: boolean) => {
        localStorage.setItem(PREFERENCE_KEYS.autoLaunch, autoLaunch ? "true" : "false");
    };

    @action setLayout = (layout: string) => {
        localStorage.setItem(PREFERENCE_KEYS.layout, layout);
    };

    @action setCursorFreeze = (cursorFreeze: boolean) => {
        localStorage.setItem(PREFERENCE_KEYS.cursorFreeze, cursorFreeze ? "true" : "false");
    };

    @action setZoomMode = (zoomMode: string) => {
        localStorage.setItem(PREFERENCE_KEYS.zoomMode, zoomMode);
    };

    @action setScaling = (scaling: FrameScaling) => {
        localStorage.setItem(PREFERENCE_KEYS.scaling, scaling.toString(10));
    };

    @action setColormap = (colormap: string) => {
        localStorage.setItem(PREFERENCE_KEYS.colormap, colormap);
    };

    @action setPercentile = (percentile: string) => {
        localStorage.setItem(PREFERENCE_KEYS.percentile, percentile);
    };

    @action setASTColor = (astColor: number) => {
        localStorage.setItem(PREFERENCE_KEYS.astColor, astColor.toString(10));
    };

    @action setASTGridVisible = (visible: boolean) => {
        localStorage.setItem(PREFERENCE_KEYS.astGridVisible, visible ? "true" : "false");
    };

    @action setASTLabelsVisible = (visible: boolean) => {
        localStorage.setItem(PREFERENCE_KEYS.astLabelsVisible, visible ? "true" : "false");
    };

    @action setWCSType = (wcsType: string) => {
        localStorage.setItem(PREFERENCE_KEYS.wcsType, wcsType);
    };

    @action setRegionType = (regionType: CARTA.RegionType) => {
        this.regionContainer.regionType = regionType;
        localStorage.setItem(PREFERENCE_KEYS.regionType, regionType.toString(10));
    };

    @action setRegionCreationMode = (regionCreationMode: string) => {
        localStorage.setItem(PREFERENCE_KEYS.regionCreationMode, regionCreationMode);
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
