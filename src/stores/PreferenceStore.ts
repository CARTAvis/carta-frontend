import {action, observable} from "mobx";
import {FrameScaling, RenderConfigStore} from "stores/RenderConfigStore";

export class PreferenceStore {
    // default settings json
    private static readonly DEFAULT_SETTINGS_JSON: string = `{
        "scaling": 0,
        "colormap": "inferno"
    }`;
    private defaultSettings;
    @observable json;

    // user configurable settings
    getScaling = (): FrameScaling => {
        return this.json.scaling;
    };

    getColormap = (): string => {
        return this.json.colormap;
    };

    @action setScaling = (newScaling: FrameScaling) => {
        if (RenderConfigStore.SCALING_TYPES.has(newScaling)) {
            this.json.scaling = newScaling;
            localStorage.setItem("CARTA_preference", JSON.stringify(this.json));
        }
    };

    @action setColormap = (newColormap: string) => {
        if (RenderConfigStore.COLOR_MAPS_ALL.includes(newColormap)) {
            this.json.colormap = newColormap;
            localStorage.setItem("CARTA_preference", JSON.stringify(this.json));
        }
    };

    constructor() {
        this.defaultSettings = JSON.parse(PreferenceStore.DEFAULT_SETTINGS_JSON);
        const preference = localStorage.getItem("CARTA_preference");
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
