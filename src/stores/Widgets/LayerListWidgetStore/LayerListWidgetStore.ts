import {TabId} from "@blueprintjs/core";
import {action, computed, makeObservable, observable} from "mobx";

import {ImageType} from "models";
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
            const imageListIndex = appStore.imageViewConfigStore.getImageListIndex(ImageType.FRAME, frame.id);
            const isAcitve = imageListIndex === appStore.activeImageIndex;
            options.push({
                label: imageListIndex + ": " + frame.filename + (isAcitve ? " (Active)" : ""),
                frameIndex: index,
                active: isAcitve,
                disable: !frame.isRestFreqEditable
            });
        });
        return options;
    }

    constructor() {
        makeObservable(this);
    }
}
