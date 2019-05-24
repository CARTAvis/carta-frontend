import {action, observable} from "mobx";

export class PreferencesStore {
    // user configurable settings
    @observable scaling: string;
    @observable colorMap: string;

    // for preference UI
    @observable perferenceActiveTab = "global";
    @action setPreferenceActiveTab(tabId: string) {
        this.perferenceActiveTab = tabId;
    }

    constructor() {
        this.scaling= "Linear";
        this.colorMap = "Blues";
    }
}