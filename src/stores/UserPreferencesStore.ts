import {action, observable} from "mobx";

export class UserPreferencesStore {
    @observable darkTheme: boolean;
    @observable colorMap: number;

    constructor() {
        this.darkTheme = false;
    }
}