import {action, makeObservable} from "mobx";

import {AppToaster, WarningToast} from "components/Shared";

export enum HelpURL {
    // Dialogs
    CONTOUR = "https://carta.readthedocs.io/en/latest/image_visualization.html#contour-rendering",
    PREFERENCES = "https://carta.readthedocs.io/en/latest/about_gui.html#user-preferences",
    FILE_BROWSER = "https://carta.readthedocs.io/en/latest/image_visualization.html#file-browser",
    FILE_INFO = "https://carta.readthedocs.io/en/latest/analysis_tools.html#file-header",
    SAVE_LAYOUT = "https://carta.readthedocs.io/en/latest/about_gui.html#custom-layout-save-and-restore",
    REGION_DIALOG = "https://carta.readthedocs.io/en/latest/analysis_tools.html#region-of-interest",
    STOKES = "https://carta.readthedocs.io/en/latest/image_visualization.html#forming-a-stokes-hypercube",
    ONLINE_CATALOG_QUERY = "https://carta.readthedocs.io/en/latest/catalogue_visualization.html#catalog-visualization",
    VECTOR_OVERLAY = "https://carta.readthedocs.io/en/latest/image_visualization.html#vector-field-rendering",
    IMAGE_FITTING = "https://carta.readthedocs.io/en/latest/analysis_tools.html#image-fitting",
    WORKSPACE = "https://carta.readthedocs.io/en/latest/workspace.html",

    // Widgets
    ANIMATOR = "https://carta.readthedocs.io/en/latest/image_visualization.html#animator",
    HISTOGRAM = "https://carta.readthedocs.io/en/latest/analysis_tools.html#histogram-widget",
    HISTOGRAM_SETTINGS = "https://carta.readthedocs.io/en/latest/analysis_tools.html#histogram-widget",
    IMAGE_VIEW = "https://carta.readthedocs.io/en/latest/image_visualization.html#image-viewer",
    IMAGE_VIEW_SETTINGS = "https://carta.readthedocs.io/en/latest/image_visualization.html#image-viewer",
    LAYER_LIST = "https://carta.readthedocs.io/en/latest/image_visualization.html#matching-images-spatially-and-spectrally",
    LAYER_LIST_SETTINGS = "https://carta.readthedocs.io/en/latest/image_visualization.html#matching-images-spatially-and-spectrally",
    LOG = "https://carta.readthedocs.io/en/latest/analysis_tools.html#log-widget",
    PLACEHOLDER = "https://carta.readthedocs.io/en/latest",
    REGION_LIST = "https://carta.readthedocs.io/en/latest/analysis_tools.html#region-of-interest",
    RENDER_CONFIG = "https://carta.readthedocs.io/en/latest/image_visualization.html#raster-rendering",
    RENDER_CONFIG_SETTINGS = "https://carta.readthedocs.io/en/latest/image_visualization.html#raster-rendering",
    SPATIAL_PROFILER = "https://carta.readthedocs.io/en/latest/analysis_tools.html#spatial-profiler",
    SPATIAL_PROFILER_SETTINGS_STYLING = "https://carta.readthedocs.io/en/latest/analysis_tools.html#spatial-profiler",
    SPATIAL_PROFILER_SETTINGS_SMOOTHING = "https://carta.readthedocs.io/en/latest/analysis_tools.html#profile-smoothing",
    SPATIAL_PROFILER_SETTINGS_COMPUTATION = "https://carta.readthedocs.io/en/latest/analysis_tools.html#spatial-profiler",
    SPECTRAL_PROFILER = "https://carta.readthedocs.io/en/latest/analysis_tools.html#spectral-profiler",
    SPECTRAL_PROFILER_SETTINGS_CONVERSION = "https://carta.readthedocs.io/en/latest/analysis_tools.html#spectral-profiler",
    SPECTRAL_PROFILER_SETTINGS_STYLING = "https://carta.readthedocs.io/en/latest/analysis_tools.html#spectral-profiler",
    SPECTRAL_PROFILER_SETTINGS_SMOOTHING = "https://carta.readthedocs.io/en/latest/analysis_tools.html#profile-smoothing",
    SPECTRAL_PROFILER_SETTINGS_MOMENTS = "https://carta.readthedocs.io/en/latest/analysis_tools.html#moment-map-generator",
    SPECTRAL_PROFILER_SETTINGS_FITTING = "https://carta.readthedocs.io/en/latest/analysis_tools.html#profile-fitting",
    STATS = "https://carta.readthedocs.io/en/latest/analysis_tools.html#statistics-widget",
    STOKES_ANALYSIS = "https://carta.readthedocs.io/en/latest/analysis_tools.html#stokes-analysis-widget",
    STOKES_ANALYSIS_SETTINGS_CONVERSION = "https://carta.readthedocs.io/en/latest/analysis_tools.html#stokes-analysis-widget",
    STOKES_ANALYSIS_SETTINGS_LINE_PLOT_STYLING = "https://carta.readthedocs.io/en/latest/analysis_tools.html#stokes-analysis-widget",
    STOKES_ANALYSIS_SETTINGS_SCATTER_PLOT_STYLING = "https://carta.readthedocs.io/en/latest/analysis_tools.html#stokes-analysis-widget",
    STOKES_ANALYSIS_SETTINGS_SMOOTHING = "https://carta.readthedocs.io/en/latest/analysis_tools.html#profile-smoothing",
    CATALOG_OVERLAY = "https://carta.readthedocs.io/en/latest/catalogue_visualization.html",
    CATALOG_HISTOGRAM_PLOT = "https://carta.readthedocs.io/en/latest/catalogue_visualization.html#catalog-histogram-plot",
    CATALOG_SCATTER_PLOT = "https://carta.readthedocs.io/en/latest/catalogue_visualization.html#catalog-2d-scatter-plot",
    CATALOG_SETTINGS_GOLBAL = "https://carta.readthedocs.io/en/latest/catalogue_visualization.html",
    CATALOG_SETTINGS_OVERLAY = "https://carta.readthedocs.io/en/latest/catalogue_visualization.html",
    CATALOG_SETTINGS_COLOR = "https://carta.readthedocs.io/en/latest/catalogue_visualization.html",
    CATALOG_SETTINGS_SIZE = "https://carta.readthedocs.io/en/latest/catalogue_visualization.html",
    CATALOG_SETTINGS_ORIENTATION = "https://carta.readthedocs.io/en/latest/catalogue_visualization.html",
    SPECTRAL_LINE_QUERY = "https://carta.readthedocs.io/en/latest/analysis_tools.html#spectral-line-query",
    PV_GENERATOR = "https://carta.readthedocs.io/en/latest/analysis_tools.html#position-velocity-pv-generator",
    CURSOR_INFO = "https://carta.readthedocs.io/en/latest/analysis_tools.html#cursor-info-widget"
}

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

    @action openHelpURL = (helpURL: HelpURL) => {
        window.open(helpURL, "_blank", "width=1024");
        AppToaster.show(WarningToast("Documentation will open in a new tab. Please ensure any popup blockers are disabled.", 10000));
    };
}
