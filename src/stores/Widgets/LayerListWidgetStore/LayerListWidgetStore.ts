import type {TabId} from "@blueprintjs/core";
import {action, computed, makeObservable, observable} from "mobx";

import {ImageType, LayerListSettingsTabs} from "enums";
import {type Persisted, type WorkspaceLayoutConfigurable} from "models";
import {AppStore} from "stores";

/** The default widths of the columns of the image list, in pixels. */
const DEFAULT_COLUMN_WIDTHS = [132, 97, 140, 75, 95];

/** What the layout copy of a workspace keeps of an Image List widget. A regular layout keeps nothing of it. */
export interface LayerListWidgetConfig {
    /** The tab of the settings panel. */
    settingsTabId: LayerListSettingsTabs;
    /** The image that the rest frequency tab shows, by its place among the images that the workspace saves. Left out for the active image. */
    restFrequencyImageIndex?: number;
    /** The widths of the columns of the image list, in pixels. */
    columnWidths: number[];
    /** The own ID of the widget. A workspace finds the widget of a settings panel by this ID. */
    widgetId?: string;
}

export class LayerListWidgetStore implements WorkspaceLayoutConfigurable<LayerListWidgetConfig> {
    widgetId: string = "";
    @observable settingsTabId: TabId = LayerListSettingsTabs.MATCHING;
    @observable selectedFrameIndex: number = -1;
    @observable columnWidths: number[] = [...DEFAULT_COLUMN_WIDTHS];

    @action setColumnWidth = (index: number, width: number) => {
        if (Number.isInteger(index) && index >= 0 && index < this.columnWidths.length && width > 0) {
            this.columnWidths[index] = width;
        }
    };

    public toWorkspaceLayoutConfig = (): LayerListWidgetConfig => ({
        settingsTabId: this.settingsTabId === LayerListSettingsTabs.REST_FREQ ? LayerListSettingsTabs.REST_FREQ : LayerListSettingsTabs.MATCHING,
        ...(this.selectedFrameIndex >= 0 ? {restFrequencyImageIndex: this.selectedFrameIndex} : {}),
        columnWidths: [...this.columnWidths],
        ...(this.widgetId ? {widgetId: this.widgetId} : {})
    });

    /**
     * Applies what the layout copy of a workspace saved. The restore checks the index of the rest
     * frequency image against the images after the layout is applied.
     */
    @action public applyWorkspaceLayoutConfig = (config: Persisted<LayerListWidgetConfig>) => {
        this.settingsTabId = config?.settingsTabId === LayerListSettingsTabs.REST_FREQ ? LayerListSettingsTabs.REST_FREQ : LayerListSettingsTabs.MATCHING;
        const index = config?.restFrequencyImageIndex;
        this.selectedFrameIndex = typeof index === "number" && Number.isInteger(index) && index >= 0 ? index : -1;
        const widths = config?.columnWidths;
        if (Array.isArray(widths) && widths.length === DEFAULT_COLUMN_WIDTHS.length && widths.every(width => typeof width === "number" && Number.isFinite(width) && width > 0)) {
            this.columnWidths = [...widths];
        }
        if (typeof config?.widgetId === "string" && config.widgetId) {
            this.widgetId = config.widgetId;
        }
    };

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
        const options = [
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
