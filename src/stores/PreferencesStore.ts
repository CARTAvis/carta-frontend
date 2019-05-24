import {action, observable} from "mobx";

export class PreferencesStore {
    // user configurable settings
    @observable scaling: string;
    @observable colorMap: string;

    // for preference UI
    @observable perferenceSelectedTab = "renderConfig";
    @action setPreferenceSelectedTab(tabId: string) {
        this.perferenceSelectedTab = tabId;
    }

    constructor() {
        this.scaling= "Linear";
        this.colorMap = "Blues";
    }
}