import {TabId} from "@blueprintjs/core";
import {action, computed, makeObservable, observable} from "mobx";

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

    @computed get restFreqFrameOptions() {
        const appStore = AppStore.Instance;
        let options = [
            {
                label: "Active",
                frameIndex: -1,
                active: false,
                disable: false
            }
        ];

        appStore.frames?.forEach((frame, index) => {
            options.push({
                label: index + ": " + frame.filename + (index === appStore.activeFrameIndex ? " (Active)" : ""),
                frameIndex: index,
                active: index === appStore.activeFrameIndex,
                disable: !frame.isRestFreqEditable
            });
        });
        return options;
    }

    constructor() {
        makeObservable(this);
    }
}
