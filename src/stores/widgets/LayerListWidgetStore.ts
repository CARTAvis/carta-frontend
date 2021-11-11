import {action, computed, makeObservable, observable} from "mobx";
import {TabId} from "@blueprintjs/core";
import {AppStore} from "stores";

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

    @computed get frameOptions() {
        const appStore = AppStore.Instance;
        let options = [{label: "Active", value: -1, disable: false, active: false}];
        appStore.frames?.forEach((frame, index) => {
            options.push({
                label: index + ": " + frame.filename + (index === appStore.activeFrameIndex ? " (Active)" : ""),
                value: index,
                disable: !frame.isRestFreqEditable,
                active: index === appStore.activeFrameIndex
            });
        });
        return options;
    }

    constructor() {
        makeObservable(this);
    }
}
