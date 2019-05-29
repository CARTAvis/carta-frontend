import {action, observable} from "mobx";
import * as AST from "ast_wrapper";
import {FrameScaling, RenderConfigStore} from "stores/RenderConfigStore";

export class PreferenceStore {
    private static readonly CARTA_PREFERENCE = "CARTA_preference";
    private static readonly DEFAULT_SETTINGS_JSON: string = `{
        "scaling": 0,
        "colormap": "inferno",
        "percentile": 99.9,
        "astColor": "blue"
    }`;

    private defaultSettings;
    @observable json;

    // user configurable settings
    getScaling = (): FrameScaling => {
        return this.json.scaling ? this.json.scaling : this.defaultSettings.scaling;
    };

    getColormap = (): string => {
        return this.json.colormap ? this.json.colormap : this.defaultSettings.colormap;
    };

    getPercentile = (): number => {
        return this.json.percentile ? this.json.percentile : this.defaultSettings.percentile;
    };

    getASTColor = (): string => {
        return this.json.astColor ? this.json.astColor : this.defaultSettings.astColor;
    };

    @action setScaling = (newScaling: FrameScaling) => {
        this.json.scaling = RenderConfigStore.SCALING_TYPES.has(newScaling) ? newScaling : this.defaultSettings.scaling;
        localStorage.setItem(PreferenceStore.CARTA_PREFERENCE, JSON.stringify(this.json));
    };

    @action setColormap = (newColormap: string) => {
        this.json.colormap = RenderConfigStore.COLOR_MAPS_ALL.includes(newColormap) ? newColormap : this.defaultSettings.colormap;
        localStorage.setItem(PreferenceStore.CARTA_PREFERENCE, JSON.stringify(this.json));
    };

    @action setPercentile = (newPercentile: string) => {
        const percentile = parseFloat(newPercentile);
        this.json.percentile = (percentile && RenderConfigStore.PERCENTILE_RANKS.includes(percentile)) ? percentile : this.defaultSettings.percentile;
        localStorage.setItem(PreferenceStore.CARTA_PREFERENCE, JSON.stringify(this.json));
    };

    @action setASTColor = (newColor: string) => {
        this.json.astColor = newColor;
        this.json.astColor = AST.colors.includes(newColor) ? newColor : this.defaultSettings.astColor;
        localStorage.setItem(PreferenceStore.CARTA_PREFERENCE, JSON.stringify(this.json));
    };

    constructor() {
        this.defaultSettings = JSON.parse(PreferenceStore.DEFAULT_SETTINGS_JSON);
        const preference = localStorage.getItem(PreferenceStore.CARTA_PREFERENCE);
        if (preference) {
            try {
                this.json = JSON.parse(preference);
            } catch (e) {
                console.log("parse CARTA_preference from local storage error.");
                this.json = this.defaultSettings;
            }
        } else {
            this.json = this.defaultSettings;
        }
    }
}
