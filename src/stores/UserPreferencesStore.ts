import {action, observable} from "mobx";

export class UserPreferencesStore {
    // user configurable settings
    @observable darkTheme: boolean;
    @observable colorMap: number;

    @action setDarkTheme = () => {
        this.darkTheme = true;
    };

    // for preference UI
    @observable perferenceActiveTab = "global";

    @action setPreferenceActiveTab(tabId: string) {
        this.perferenceActiveTab = tabId;
    }

    constructor() {
        this.darkTheme = false;
    }
}