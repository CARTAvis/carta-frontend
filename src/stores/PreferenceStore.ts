import {action, observable} from "mobx";
import * as AST from "ast_wrapper";
import {FrameScaling, RenderConfigStore} from "stores/RenderConfigStore";

export class PreferenceStore {
    private static readonly CARTA_PREFERENCE = "CARTA_preference";
    private static readonly DEFAULT_SETTINGS_JSON: string = `{
        "scaling": 0,
        "colormap": "inferno",
        "percentile": 99.9,
        "astColor": 4
    }`;

    private defaultSettings;
    @observable json;

    // user configurable settings
    getScaling = (): FrameScaling => {
        const scaling = this.json.scaling;
        return (scaling && RenderConfigStore.SCALING_TYPES.has(scaling)) ? scaling : this.defaultSettings.scaling;
    };

    getColormap = (): string => {
        const colormap = this.json.colormap;
        return (colormap && RenderConfigStore.COLOR_MAPS_ALL.includes(colormap)) ? colormap : this.defaultSettings.colormap;
    };

    getPercentile = (): number => {
        const percentile = this.json.percentile;
        return (percentile && RenderConfigStore.PERCENTILE_RANKS.includes(percentile)) ? percentile : this.defaultSettings.percentile;
    };

    getASTColor = (): number => {
        const astColor = this.json.astColor;
        return (astColor && astColor >= 0 && astColor < AST.colors.length) ? astColor : this.defaultSettings.astColor;
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

    @action setASTColor = (newColor: number) => {
        this.json.astColor = (newColor >= 0 && newColor < AST.colors.length) ? newColor : this.defaultSettings.astColor;
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
