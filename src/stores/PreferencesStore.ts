import {action, computed, observable} from "mobx";
import {FrameScaling, RenderConfigStore} from "stores/RenderConfigStore";

export class PreferencesStore {
    // user configurable settings
    @observable scaling: FrameScaling;
    @observable colorMap: string;

    @computed get scalingName() {
        const scalingType = RenderConfigStore.SCALING_TYPES.get(this.scaling);
        if (scalingType) {
            return scalingType;
        } else {
            return "Unknown";
        }
    }

    @action setScaling = (newScaling: FrameScaling) => {
        if (RenderConfigStore.SCALING_TYPES.has(newScaling)) {
            this.scaling = newScaling;
        }
    };

    // for preference UI
    @observable perferenceSelectedTab = "renderConfig";
    @action setPreferenceSelectedTab(tabId: string) {
        this.perferenceSelectedTab = tabId;
    }

    constructor() {
        this.scaling = FrameScaling.SQUARE;
        this.colorMap = "Blues";
    }
}