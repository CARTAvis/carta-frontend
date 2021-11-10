import {observable, action, makeObservable} from "mobx";
import {TabId} from "@blueprintjs/core";

export enum LayerListSettingsTabs {
    MATCHING,
    REST_FREQ
}

export class LayerListWidgetStore {
    @observable settingsTabId: TabId = LayerListSettingsTabs.MATCHING;
    @observable selectedFrameIndex: number = -1;

    @action setSettingsTabId = (tab: TabId) => {
        this.settingsTabId = tab;
    };

    @action setSelectedFrameIndex = (index: number) => {
        this.selectedFrameIndex = index;
    };

    @action resetSelectedFrameIndex = () => {
        this.selectedFrameIndex = -1;
    };

    constructor() {
        makeObservable(this);
    }
}
