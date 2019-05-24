import {action, observable} from "mobx";

export enum Theme {
    LIGHT = 0,
    DARK = 1
}

export class PreferencesStore {
    // user configurable settings
    @observable theme: string;
    @observable colorMap: number;

    @action setTheme(theme: string) {
        this.theme = theme;
        console.log(this.theme);
    }

    @action getTheme(): string {
        return this.theme;
    }

    // for preference UI
    @observable perferenceActiveTab = "global";

    @action setPreferenceActiveTab(tabId: string) {
        this.perferenceActiveTab = tabId;
    }

    constructor() {
        this.theme = "Light";
    }
}