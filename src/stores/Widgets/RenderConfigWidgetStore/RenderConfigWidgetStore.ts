import {action, computed, makeObservable, observable} from "mobx";
import tinycolor from "tinycolor2";

import {LineSettings, PlotType} from "enums";
import {type ConfigurableStore, IMAGE_NOT_RESTORED, type Persisted, type WorkspaceConfigurableWidget, type WorkspaceIdReader, type WorkspaceIdWriter, type WorkspaceLayoutConfigurable, type WorkspaceRenderConfigWidgetConfig} from "models";
import {AppStore} from "stores";
import {isAutoColor} from "utilities";

import {applyLinePlotDataRange, type LinePlotDataRangeField} from "../LinePlotDataRange";
import {applyWorkspacePlotRange, toWorkspacePlotRange} from "../WorkspacePlotRange";

/** What a render config widget saves of its histogram plot in a regular layout. */
export interface RenderConfigWidgetConfig {
    primaryLineColor: string;
    lineWidth: number;
    linePlotPointSize: number;
    logScaleY: boolean;
    markerTextVisible: boolean;
    meanRmsVisible: boolean;
    plotType: PlotType;
    /** The range of the data that the widget last plotted. The settings panel shows it in its range inputs before the widget plots data. */
    minXVal: number;
    maxXVal: number;
    minYVal: number;
    maxYVal: number;
}

/** What a render config widget saves in the layout copy of a workspace. */
export interface RenderConfigWorkspaceLayoutConfig extends Omit<RenderConfigWidgetConfig, LinePlotDataRangeField> {
    /** The own ID of the widget. It stays the same in every session that restores the workspace. */
    widgetId: string;
}

export class RenderConfigWidgetStore
    implements ConfigurableStore<RenderConfigWidgetConfig, Persisted<RenderConfigWidgetConfig>>, WorkspaceLayoutConfigurable<RenderConfigWorkspaceLayoutConfig>, WorkspaceConfigurableWidget<WorkspaceRenderConfigWidgetConfig>
{
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

    /** Returns the zoom range of the histogram of the image in front. The workspace saves nothing else for this widget. */
    public toWorkspaceConfig = (ids: WorkspaceIdWriter): WorkspaceRenderConfigWidgetConfig => {
        const fileId = AppStore.Instance.activeFrame?.frameInfo.fileId;
        return fileId !== undefined && ids.imageIdOf(fileId) !== undefined ? toWorkspacePlotRange(this) : {};
    };

    /** Whether a restore found the image in front that the widget showed when the workspace was saved. If not, the saved zoom range does not apply. */
    private isShowingWorkspaceData = true;

    public applyWorkspaceBinding = (_config: WorkspaceRenderConfigWidgetConfig, ids: WorkspaceIdReader): string[] => {
        this.isShowingWorkspaceData = ids.wasActiveImageRestored();
        return this.isShowingWorkspaceData ? [] : [IMAGE_NOT_RESTORED];
    };

    public applyWorkspaceConfig = (): string[] => [];

    public applyWorkspaceView = (config: WorkspaceRenderConfigWidgetConfig): void => {
        if (this.isShowingWorkspaceData) {
            applyWorkspacePlotRange(this, config);
        }
    };

    /** Applies the settings of a regular layout. */
    public applyConfig = (widgetSettings: Persisted<RenderConfigWidgetConfig>): void => {
        if (!widgetSettings) {
            return;
        }
        this.applyPlotSettings(widgetSettings);
        applyLinePlotDataRange(this.linePlotInitXYBoundaries, widgetSettings);
    };

    /**
     * Applies the settings in the layout copy of a workspace. The range of the data is not applied.
     * The workspace restores the range that the widget was zoomed to.
     */
    public applyWorkspaceLayoutConfig = (widgetSettings: Persisted<RenderConfigWorkspaceLayoutConfig>): void => {
        if (!widgetSettings) {
            return;
        }
        this.applyPlotSettings(widgetSettings);
        if (typeof widgetSettings.widgetId === "string" && widgetSettings.widgetId) {
            this.widgetId = widgetSettings.widgetId;
        }
    };

    private applyPlotSettings = (widgetSettings: Persisted<RenderConfigWidgetConfig>): void => {
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

    /** Returns the settings of a regular layout. */
    public toConfig = (): RenderConfigWidgetConfig => {
        return {
            primaryLineColor: this.primaryLineColor,
            lineWidth: this.lineWidth,
            linePlotPointSize: this.linePlotPointSize,
            logScaleY: this.isLogScaleY,
            markerTextVisible: this.isMarkerTextVisible,
            meanRmsVisible: this.isMeanRmsVisible,
            plotType: this.plotType,
            minXVal: this.linePlotInitXYBoundaries.minXVal,
            maxXVal: this.linePlotInitXYBoundaries.maxXVal,
            minYVal: this.linePlotInitXYBoundaries.minYVal,
            maxYVal: this.linePlotInitXYBoundaries.maxYVal
        };
    };

    /** Returns the settings in the layout copy of a workspace. It keeps no range of the data. */
    public toWorkspaceLayoutConfig = (): RenderConfigWorkspaceLayoutConfig => ({
        primaryLineColor: this.primaryLineColor,
        lineWidth: this.lineWidth,
        linePlotPointSize: this.linePlotPointSize,
        logScaleY: this.isLogScaleY,
        markerTextVisible: this.isMarkerTextVisible,
        meanRmsVisible: this.isMeanRmsVisible,
        plotType: this.plotType,
        widgetId: this.widgetId
    });
}
