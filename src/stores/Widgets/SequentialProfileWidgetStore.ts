import {action, makeObservable, observable} from "mobx";

import {LineSettings, PlotType} from "enums";
import {SELECTABLE_COLORS} from "utilities";

export class SequentialProfileWidgetStore {
    @observable plotType = PlotType.LINES;
    @observable lineWidth = 1;
    @observable linePlotPointSize = 3;
    @observable settingsTabId: "styling" | "management" = "styling";
    @observable lineColors = observable.map<string, string>();

    constructor() {
        makeObservable(this);
    }

    getLineColor = (regionGroupId: string, index: number) => this.lineColors.get(regionGroupId) ?? `auto-${SELECTABLE_COLORS[index % SELECTABLE_COLORS.length]}`;

    @action setLineColor = (regionGroupId: string, color: string) => this.lineColors.set(regionGroupId, color);
    @action setLineWidth = (width: number) => {
        if (width >= LineSettings.MIN_WIDTH && width <= LineSettings.MAX_WIDTH) {
            this.lineWidth = width;
        }
    };
    @action setLinePlotPointSize = (size: number) => {
        if (size >= LineSettings.MIN_POINT_SIZE && size <= LineSettings.MAX_POINT_SIZE) {
            this.linePlotPointSize = size;
        }
    };
    @action setPlotType = (plotType: PlotType) => {
        this.plotType = plotType;
    };

    @action setSettingsTabId = (tabId: "styling" | "management") => {
        this.settingsTabId = tabId;
    };

    @action applyConfig = (config: Record<string, any>) => {
        if (config?.plotType === PlotType.LINES || config?.plotType === PlotType.POINTS || config?.plotType === PlotType.STEPS) {
            this.plotType = config.plotType;
        }
        this.setLineWidth(config?.lineWidth);
        this.setLinePlotPointSize(config?.linePlotPointSize);
        if (config?.lineColors && typeof config.lineColors === "object") {
            Object.entries(config.lineColors).forEach(([id, color]) => {
                if (typeof color === "string") {
                    this.lineColors.set(id, color);
                }
            });
        }
    };

    toConfig = () => ({
        plotType: this.plotType,
        lineWidth: this.lineWidth,
        linePlotPointSize: this.linePlotPointSize,
        lineColors: Object.fromEntries(this.lineColors)
    });
}
