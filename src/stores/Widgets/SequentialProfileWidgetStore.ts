import {action, computed, makeObservable, observable} from "mobx";

import {LineSettings, PlotType, RelativeTimeUnit, TimeLabelFormat} from "enums";
import {SELECTABLE_COLORS} from "utilities";

export type SequentialXAxisFormat = TimeLabelFormat | RelativeTimeUnit | "index";

export const SEQUENTIAL_X_AXIS_OPTIONS: Array<{value: SequentialXAxisFormat; label: string}> = [
    {value: "index", label: "Index"},
    {value: TimeLabelFormat.AUTO, label: "Automatic (compact UTC)"},
    {value: TimeLabelFormat.ISO, label: "ISO 8601 (UTC)"},
    {value: TimeLabelFormat.MJD, label: "MJD (UTC)"},
    {value: TimeLabelFormat.JD, label: "JD (UTC)"},
    {value: RelativeTimeUnit.SECOND, label: "Relative seconds"},
    {value: RelativeTimeUnit.MINUTE, label: "Relative minutes"},
    {value: RelativeTimeUnit.HOUR, label: "Relative hours"},
    {value: RelativeTimeUnit.DAY, label: "Relative days"},
    {value: RelativeTimeUnit.YEAR, label: "Relative Julian years"}
];

export interface SequentialProfileWidgetPreferenceAccessors {
    getVisibleXAxisFormats: () => unknown;
    setVisibleXAxisFormats: (formats: SequentialXAxisFormat[]) => void;
}

export class SequentialProfileWidgetStore {
    @observable plotType = PlotType.POINTS;
    @observable lineWidth = 1;
    @observable linePlotPointSize = 3;
    @observable settingsTabId: "styling" | "management" | "x-axis" = "styling";
    @observable private selectedXAxisFormat: SequentialXAxisFormat = TimeLabelFormat.AUTO;
    @observable lineColors = observable.map<string, string>();

    constructor(private readonly preferenceAccessors: SequentialProfileWidgetPreferenceAccessors) {
        const visibleFormats = this.loadVisibleXAxisFormats();
        if (!visibleFormats.includes(this.selectedXAxisFormat)) {
            this.selectedXAxisFormat = visibleFormats[0] ?? TimeLabelFormat.AUTO;
        }
        makeObservable(this);
    }

    private loadVisibleXAxisFormats(): SequentialXAxisFormat[] {
        const savedFormats = this.preferenceAccessors.getVisibleXAxisFormats();
        if (Array.isArray(savedFormats)) {
            return savedFormats.filter((format: unknown): format is SequentialXAxisFormat => SEQUENTIAL_X_AXIS_OPTIONS.some(option => option.value === format));
        }
        return SEQUENTIAL_X_AXIS_OPTIONS.map(option => option.value);
    }

    @computed get visibleXAxisFormats(): SequentialXAxisFormat[] {
        return this.loadVisibleXAxisFormats();
    }

    @computed get xAxisFormat(): SequentialXAxisFormat {
        return this.visibleXAxisFormats.includes(this.selectedXAxisFormat) ? this.selectedXAxisFormat : (this.visibleXAxisFormats[0] ?? TimeLabelFormat.AUTO);
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

    @action setSettingsTabId = (tabId: "styling" | "management" | "x-axis") => {
        this.settingsTabId = tabId;
    };

    @action setXAxisFormat = (format: SequentialXAxisFormat) => {
        if (this.visibleXAxisFormats.includes(format)) {
            this.selectedXAxisFormat = format;
        }
    };

    @action setXAxisFormatVisibility = (format: SequentialXAxisFormat, isVisible: boolean) => {
        let visibleFormats = this.visibleXAxisFormats;
        if (isVisible && !this.visibleXAxisFormats.includes(format)) {
            visibleFormats = [...visibleFormats, format];
            if (this.visibleXAxisFormats.length === 0) {
                this.selectedXAxisFormat = format;
            }
        } else if (!isVisible && this.visibleXAxisFormats.includes(format)) {
            visibleFormats = visibleFormats.filter(value => value !== format);
            if (this.xAxisFormat === format) {
                this.selectedXAxisFormat = visibleFormats[0] ?? TimeLabelFormat.AUTO;
            }
        } else {
            return;
        }
        this.preferenceAccessors.setVisibleXAxisFormats(visibleFormats);
    };

    @action setAllXAxisFormatsVisible = (isVisible: boolean) => {
        const visibleFormats = isVisible ? SEQUENTIAL_X_AXIS_OPTIONS.map(option => option.value) : [];
        this.preferenceAccessors.setVisibleXAxisFormats(visibleFormats);
    };

    @action applyConfig = (config: Record<string, any>) => {
        if (config?.plotType === PlotType.LINES || config?.plotType === PlotType.POINTS || config?.plotType === PlotType.STEPS || config?.plotType === PlotType.POINTS_AND_LINES || config?.plotType === PlotType.POINTS_AND_STEPS) {
            this.plotType = config.plotType;
        }
        if (SEQUENTIAL_X_AXIS_OPTIONS.some(option => option.value === config?.xAxisFormat)) {
            this.selectedXAxisFormat = config.xAxisFormat;
        }
        if (!this.visibleXAxisFormats.includes(this.selectedXAxisFormat)) {
            this.selectedXAxisFormat = this.visibleXAxisFormats[0] ?? TimeLabelFormat.AUTO;
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
        xAxisFormat: this.xAxisFormat,
        lineColors: Object.fromEntries(this.lineColors)
    });
}
