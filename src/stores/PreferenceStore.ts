import {action} from "mobx";
import * as AST from "ast_wrapper";
import {FrameScaling, RenderConfigStore} from "stores";

const PREFERENCE_KEYS = {
    scaling: "CARTA_scaling",
    colormap: "CARTA_colormap",
    percentile: "CARTA_percentile",
    astColor: "CARTA_astColor"
};

const DEFAULTS = {
    scaling: 0,
    colormap: "inferno",
    percentile: 99.9,
    astColor: 4
};

export class PreferenceStore {
    // user configurable settings
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
}
