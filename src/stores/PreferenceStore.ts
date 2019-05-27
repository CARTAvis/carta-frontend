import {action, observable} from "mobx";
import {FrameScaling, RenderConfigStore} from "stores/RenderConfigStore";

export class PreferenceStore {
    // default settings json
    private static readonly DEFAULT_SETTINGS: string = `{
        "scaling": 0
    }`;
    @observable json;

    // user configurable settings
    getScaling = (): FrameScaling => {
        return this.json.scaling;
    };

    @action setScaling = (newScaling: FrameScaling) => {
        if (RenderConfigStore.SCALING_TYPES.has(newScaling)) {
            this.json.scaling = newScaling;
            localStorage.setItem("CARTA_preference", JSON.stringify(this.json));
        }
    };

    // for preference UI
    @observable perferenceSelectedTab = "renderConfig";
    @action setPreferenceSelectedTab(tabId: string) {
        this.perferenceSelectedTab = tabId;
    }

    constructor() {
        const preference = localStorage.getItem("CARTA_preference");
        this.json = JSON.parse(preference ? preference : PreferenceStore.DEFAULT_SETTINGS);
    }
}