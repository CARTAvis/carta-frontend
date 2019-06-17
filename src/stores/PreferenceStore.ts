import {action, autorun} from "mobx";
import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {FrameScaling, RenderConfigStore, RegionStore, AppStore} from "stores";

const PREFERENCE_KEYS = {
    scaling: "CARTA_scaling",
    colormap: "CARTA_colormap",
    percentile: "CARTA_percentile",
    astColor: "CARTA_astColor",
    astGridVisible: "CARTA_astGridVisible",
    astLabelsVisible: "CARTA_astLabelsVisible",
    regionColor: "CARTA_regionColor",
    regionLineWidth: "CARTA_regionLineWidth",
    regionDashLength: "CARTA_regionDashLength",
    regionType: "CARTA_regionType",
    regionCreationMode: "CARTA_regionCreationMode"
};

const DEFAULTS = {
    scaling: 0,
    colormap: "inferno",
    percentile: 99.9,
    astColor: 4,
    astGridVisible: true,
    astLabelsVisible: true,
    regionColor: "#2EE6D6",
    regionLineWidth: 2,
    regionDashLength: 0,
    regionType: 3,
    regionCreationMode: "center"
};

export class PreferenceStore {
    private appStore: AppStore;
    private regionContainer: RegionStore;

    // validators
    validateScaling(scaling: string) {
        const value = Number(scaling);
        return scaling && isFinite(value) && RenderConfigStore.SCALING_TYPES.has(value) ? value : null;
    }

    validateColormap(colormap: string) {
        return colormap && RenderConfigStore.COLOR_MAPS_SELECTED.includes(colormap) ? colormap : null;
    }

    validatePercentile(percentile: string) {
        const value = Number(percentile);
        return percentile && isFinite(value) && RenderConfigStore.PERCENTILE_RANKS.includes(value) ? value : null;
    }

    validateASTColor(astColor: string) {
        const value = Number(astColor);
        return astColor && isFinite(value) && value >= 0 && value < AST.colors.length ? value : null;
    }

    validateRegionType(regionType: string) {
        const value = Number(regionType);
        return value && value !== NaN && RegionStore.IsRegionTypeValid(value) ? value : null;
    }

     validateRegionColor(regionColor: string) {
        return regionColor && RegionStore.IsRegionColorValid(regionColor) ? regionColor : null;
    }

    validateRegionLineWidth(regionLineWidth: string) {
        const value = Number(regionLineWidth);
        return value && value !== NaN && RegionStore.IsRegionLineWidthValid(value) ? value : null;
    }

    validateRegionDashLength(regionDashLength: string) {
        const value = Number(regionDashLength);
        return value && value !== NaN && RegionStore.IsRegionDashLengthValid(value) ? value : null;
    }

    validateRegionCreationMode(regionCreationMode: string) {
        return regionCreationMode && (regionCreationMode === "centner" || regionCreationMode === "corner") ? regionCreationMode : null;
    }

    // getters
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
        return localStorage.getItem(PREFERENCE_KEYS.regionCreationMode) === "corner" ? true : false;
    }

    // setters
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

    @action setRegionType = (regionType: CARTA.RegionType) => {
        this.regionContainer.regionType = regionType;
        localStorage.setItem(PREFERENCE_KEYS.regionType, regionType.toString(10));
    };

    @action setRegionCreationMode = (regionCreationMode: string) => {
        localStorage.setItem(PREFERENCE_KEYS.regionCreationMode, regionCreationMode);
    };

    constructor(appStore: AppStore) {
        this.appStore = appStore;

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
