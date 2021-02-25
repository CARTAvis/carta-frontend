import { action, observable, makeObservable } from "mobx";
import {Position} from "@blueprintjs/core";

export class HelpStore {
    private static staticInstance: HelpStore;

    constructor() {
        makeObservable(this);
    }

    static get Instance() {
        if (!HelpStore.staticInstance) {
            HelpStore.staticInstance = new HelpStore();
        }
        return HelpStore.staticInstance;
    }

    @observable type: HelpType;
    @observable helpVisible: boolean = false;
    @observable position: Position = Position.RIGHT;

    @action showHelpDrawer = (helpType: HelpType, centerX: number) => {
        this.type = helpType;
        this.position = centerX > document.body.clientWidth * 0.5 ? Position.LEFT : Position.RIGHT;
        this.helpVisible = true;
    };

    @action hideHelpDrawer = () => {
        this.helpVisible = false;
    };
}

export enum HelpType {
    // Dialogs
    CONTOUR = "contour",
    PREFERENCES = "preferences",
    FILE_Browser = "file-browser",
    FILE_INFO = "file-info",
    SAVE_LAYOUT = "save-layout",
    REGION_DIALOG = "region-dialog",
    STOKES = "STOKES",

    // Widgets
    ANIMATOR = "animator",
    HISTOGRAM = "histogram",
    HISTOGRAM_SETTINGS = "histogram-settings",
    IMAGE_VIEW = "image-view",
    IMAGE_VIEW_SETTINGS  = "image-view-settings",
    LAYER_LIST = "layer-list",
    LOG = "log",
    PLACEHOLDER = "placeholder",
    REGION_LIST = "region-list",
    RENDER_CONFIG = "render-config",
    RENDER_CONFIG_SETTINGS = "render-config-settings",
    SPATIAL_PROFILER = "spatial-profiler",
    SPATIAL_PROFILER_SETTINGS_STYLING = "spatial-profiler-settings-styling",
    SPATIAL_PROFILER_SETTINGS_SMOOTHING = "spatial-profiler-settings-smoothing",
    SPECTRAL_PROFILER = "spectral-profiler",
    SPECTRAL_PROFILER_SETTINGS_CONVERSION = "spectral-profiler-settings-conversion",
    SPECTRAL_PROFILER_SETTINGS_STYLING = "spectral-profiler-settings-styling",
    SPECTRAL_PROFILER_SETTINGS_SMOOTHING = "spectral-profiler-settings-smoothing",
    SPECTRAL_PROFILER_SETTINGS_MOMENTS = "spectral-profiler-settings-moments",
    STATS = "stats",
    STOKES_ANALYSIS = "stoke-analysis",
    STOKES_ANALYSIS_SETTINGS_CONVERSION = "stoke-analysis-settings-conversion",
    STOKES_ANALYSIS_SETTINGS_LINE_PLOT_STYLING = "stoke-analysis-settings-line-plot-styling",
    STOKES_ANALYSIS_SETTINGS_SCATTER_PLOT_STYLING = "stoke-analysis-settings-scatter-plot-styling",
    STOKES_ANALYSIS_SETTINGS_SMOOTHING = "stoke-analysis-settings-smoothing",
    CATALOG_OVERLAY = "catalog-overlay",
    CATALOG_HISTOGRAM_PLOT = "catalog-histogram-plot",
    CATALOG_SCATTER_PLOT = "catalog-scatter-plot",
    CATALOG_SETTINGS_GOLBAL = "catalog-settings-golbal",
    CATALOG_SETTINGS_OVERLAY = "catalog-settings-overlay",
    CATALOG_SETTINGS_COLOR = "catalog-settings-color",
    SPECTRAL_LINE_QUERY = "spectral-line-query"
}
