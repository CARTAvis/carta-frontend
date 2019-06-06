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
    percentile: "99.9",
    astColor: 4
};

export class PreferenceStore {
    // user configurable settings
    validateScaling(scaling: any) {
        const value = typeof scaling === "string" ? Number(scaling) : scaling;
        return value !== NaN && RenderConfigStore.SCALING_TYPES.has(value) ? value : DEFAULTS.scaling;
    }

    validateColormap(colormap: string) {
        return RenderConfigStore.COLOR_MAPS_SELECTED.includes(colormap) ? colormap : DEFAULTS.colormap;
    }

    validatePercentile(percentile: any): number {
        const value = typeof percentile === "string" ? Number(percentile) : percentile;
        return value !== NaN && RenderConfigStore.PERCENTILE_RANKS.includes(value) ? value : DEFAULTS.percentile;
    }

    validateASTColor(astColor: any) {
        const value = typeof astColor === "string" ? Number(astColor) : astColor;
        return value !== NaN && astColor >= 0 && astColor < AST.colors.length ? value : DEFAULTS.astColor;
    }

    getScaling = (): FrameScaling => {
        return this.validateScaling(localStorage.getItem(PREFERENCE_KEYS.scaling));
    };

    getColormap = (): string => {
        return this.validateColormap(localStorage.getItem(PREFERENCE_KEYS.colormap));
    };

    getPercentile = (): number => {
        return this.validatePercentile(localStorage.getItem(PREFERENCE_KEYS.percentile));
    };

    getASTColor = (): number => {
        return this.validateASTColor(localStorage.getItem(PREFERENCE_KEYS.astColor));
    };

    @action setScaling = (scaling: FrameScaling) => {
        localStorage.setItem(PREFERENCE_KEYS.scaling, this.validateScaling(scaling).toString(10));
    };

    @action setColormap = (colormap: string) => {
        localStorage.setItem(PREFERENCE_KEYS.colormap, this.validateColormap(colormap));
    };

    @action setPercentile = (percentile) => {
        localStorage.setItem(PREFERENCE_KEYS.percentile, this.validatePercentile(percentile).toString());
    };

    @action setASTColor = (astColor: number) => {
        localStorage.setItem(PREFERENCE_KEYS.astColor, this.validateASTColor(astColor).toString(10));
    };
}
