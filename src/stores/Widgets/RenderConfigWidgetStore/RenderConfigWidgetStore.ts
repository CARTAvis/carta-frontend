import {action, computed, makeObservable, observable} from "mobx";
import tinycolor from "tinycolor2";

import {LineSettings, PlotType} from "enums";
import {type ConfigurableStore, type Persisted, type WorkspaceConfigurableWidget, type WorkspaceIdReader, type WorkspaceRenderConfigWidgetConfig} from "models";
import {isAutoColor} from "utilities";

import {applyWorkspacePlotRange, toWorkspacePlotRange} from "../WorkspacePlotRange";

/** What a render config widget saves of its histogram plot. */
export interface RenderConfigWidgetConfig {
    /** The widget's own ID, which stays the same across the sessions a layout is applied in. */
    widgetId: string;
    primaryLineColor: string;
    lineWidth: number;
    linePlotPointSize: number;
    logScaleY: boolean;
    markerTextVisible: boolean;
    meanRmsVisible: boolean;
    plotType: PlotType;
}

export class RenderConfigWidgetStore implements ConfigurableStore<RenderConfigWidgetConfig, Persisted<RenderConfigWidgetConfig>>, WorkspaceConfigurableWidget<WorkspaceRenderConfigWidgetConfig> {
    widgetId: string = "";
    @observable minX: number | undefined = undefined;
    @observable maxX: number | undefined = undefined;
    @observable minY: number | undefined = undefined;
    @observable maxY: number | undefined = undefined;
    @observable cursorX: number = 0;

    // settings
    @observable plotType: PlotType = PlotType.STEPS;
    @observable primaryLineColor: string = "auto-blue";
    @observable lineWidth: number = 1;
    @observable linePlotPointSize: number = 1.5;
    @observable isLogScaleY: boolean = true;
    @observable isMarkerTextVisible: boolean = true;
    @observable isMeanRmsVisible: boolean = true;
    @observable linePlotInitXYBoundaries: {minXVal: number; maxXVal: number; minYVal: number; maxYVal: number} = {minXVal: 0, maxXVal: 0, minYVal: 0, maxYVal: 0};

    @action setXBounds = (minVal: number, maxVal: number) => {
        this.minX = minVal;
        this.maxX = maxVal;
    };

    @action clearXBounds = () => {
        this.minX = undefined;
        this.maxX = undefined;
    };

    @action setYBounds = (minVal: number, maxVal: number) => {
        this.minY = minVal;
        this.maxY = maxVal;
    };

    @action clearYBounds = () => {
        this.minX = undefined;
        this.maxX = undefined;
    };

    @action setXYBounds = (minX: number, maxX: number, minY: number, maxY: number) => {
        this.minX = minX;
        this.maxX = maxX;
        this.minY = minY;
        this.maxY = maxY;
    };

    @action clearXYBounds = () => {
        this.minX = undefined;
        this.maxX = undefined;
        this.minY = undefined;
        this.maxY = undefined;
    };

    @action setMarkerTextVisible = (isMarkerTextVisible: boolean) => {
        this.isMarkerTextVisible = isMarkerTextVisible;
    };

    @action setMeanRmsVisible = (isMeanRmsVisible: boolean) => {
        this.isMeanRmsVisible = isMeanRmsVisible;
    };

    @action setLogScale = (isLogScale: boolean) => {
        this.isLogScaleY = isLogScale;
    };

    @action setPlotType = (val: PlotType) => {
        this.plotType = val;
    };

    @action setCursor = (cursorVal: number) => {
        this.cursorX = cursorVal;
    };

    constructor() {
        makeObservable(this);
    }

    @computed get isAutoScaledX() {
        return this.minX === undefined || this.maxX === undefined;
    }

    @computed get isAutoScaledY() {
        return this.minY === undefined || this.maxY === undefined;
    }

    // settings
    @action setPrimaryLineColor = (color: string) => {
        this.primaryLineColor = color;
    };

    @action setLineWidth = (val: number) => {
        if (val >= LineSettings.MIN_WIDTH && val <= LineSettings.MAX_WIDTH) {
            this.lineWidth = val;
        }
    };

    @action setLinePlotPointSize = (val: number) => {
        if (val >= LineSettings.MIN_POINT_SIZE && val <= LineSettings.MAX_POINT_SIZE) {
            this.linePlotPointSize = val;
        }
    };

    @action initXYBoundaries(minXVal: number, maxXVal: number, minYVal: number, maxYVal: number) {
        this.linePlotInitXYBoundaries = {minXVal: minXVal, maxXVal: maxXVal, minYVal: minYVal, maxYVal: maxYVal};
    }

    /** What the widget shows of the image in front: only the range its histogram was zoomed to. */
    public toWorkspaceConfig = (): WorkspaceRenderConfigWidgetConfig => toWorkspacePlotRange(this);

    /** Whether a restore found the image in front the widget was saved showing, so that the range it was zoomed to still applies. */
    private isShowingWorkspaceData = true;

    public applyWorkspaceBinding = (_config: WorkspaceRenderConfigWidgetConfig, ids: WorkspaceIdReader): string[] => {
        this.isShowingWorkspaceData = ids.wasActiveImageRestored();
        return this.isShowingWorkspaceData ? [] : ["the image it showed was not restored, so it shows the active image"];
    };

    public applyWorkspaceConfig = (config: WorkspaceRenderConfigWidgetConfig): string[] => {
        if (this.isShowingWorkspaceData) {
            applyWorkspacePlotRange(this, config);
        }
        return [];
    };

    public applyConfig = (widgetSettings: Persisted<RenderConfigWidgetConfig>): void => {
        if (!widgetSettings) {
            return;
        }
        if (typeof widgetSettings.widgetId === "string" && widgetSettings.widgetId) {
            this.widgetId = widgetSettings.widgetId;
        }
        if (typeof widgetSettings.primaryLineColor === "string" && (tinycolor(widgetSettings.primaryLineColor).isValid() || isAutoColor(widgetSettings.primaryLineColor))) {
            this.primaryLineColor = widgetSettings.primaryLineColor;
        }
        if (typeof widgetSettings.lineWidth === "number" && widgetSettings.lineWidth >= LineSettings.MIN_WIDTH && widgetSettings.lineWidth <= LineSettings.MAX_WIDTH) {
            this.lineWidth = widgetSettings.lineWidth;
        }
        if (typeof widgetSettings.linePlotPointSize === "number" && widgetSettings.linePlotPointSize >= LineSettings.MIN_POINT_SIZE && widgetSettings.linePlotPointSize <= LineSettings.MAX_POINT_SIZE) {
            this.linePlotPointSize = widgetSettings.linePlotPointSize;
        }
        if (typeof widgetSettings.logScaleY === "boolean") {
            this.isLogScaleY = widgetSettings.logScaleY;
        }
        if (typeof widgetSettings.markerTextVisible === "boolean") {
            this.isMarkerTextVisible = widgetSettings.markerTextVisible;
        }
        if (typeof widgetSettings.meanRmsVisible === "boolean") {
            this.isMeanRmsVisible = widgetSettings.meanRmsVisible;
        }
        if (typeof widgetSettings.plotType === "string" && (widgetSettings.plotType === PlotType.STEPS || widgetSettings.plotType === PlotType.LINES || widgetSettings.plotType === PlotType.POINTS)) {
            this.plotType = widgetSettings.plotType;
        }
    };

    public toConfig = (): RenderConfigWidgetConfig => {
        return {
            widgetId: this.widgetId,
            primaryLineColor: this.primaryLineColor,
            lineWidth: this.lineWidth,
            linePlotPointSize: this.linePlotPointSize,
            logScaleY: this.isLogScaleY,
            markerTextVisible: this.isMarkerTextVisible,
            meanRmsVisible: this.isMeanRmsVisible,
            plotType: this.plotType
        };
    };
}
