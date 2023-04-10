import {Position} from "@blueprintjs/core";
import {action, makeObservable, observable} from "mobx";

export enum HelpType {
    // Dialogs
    CONTOUR = "Contour Configuration",
    DISTANCE_MEASUREMENT = "Distance Measurement",
    PREFERENCES = "Preferences",
    FILE_BROWSER = "File Browser",
    FILE_INFO = "File Header",
    SAVE_LAYOUT = "Save Layout",
    SAVE_WORKSPACE = "Save Workspace",
    REGION_DIALOG = "Region Dialog",
    STOKES = "Stokes Hypercube Dialog",
    ONLINE_CATALOG_QUERY = "Online Catalog Query",
    VECTOR_OVERLAY = "Vector Overlay Configuration",
    IMAGE_FITTING = "Image Fitting",

    // Widgets
    ANIMATOR = "Animator",
    HISTOGRAM = "Histogram",
    HISTOGRAM_SETTINGS = "Histogram Settings",
    IMAGE_VIEW = "Image View",
    IMAGE_VIEW_SETTINGS = "Image View Settings",
    LAYER_LIST = "Image List",
    LAYER_LIST_SETTINGS = "Image List Settings",
    LOG = "Log",
    PLACEHOLDER = "Placeholder",
    REGION_LIST = "Region List",
    RENDER_CONFIG = "Render Configuration",
    RENDER_CONFIG_SETTINGS = "Render Configuration Settings",
    SPATIAL_PROFILER = "Spatial Profiler",
    SPATIAL_PROFILER_SETTINGS_STYLING = "Spatial Profiler Style Settings",
    SPATIAL_PROFILER_SETTINGS_SMOOTHING = "Spatial Profiler Smoothing Settings",
    SPATIAL_PROFILER_SETTINGS_COMPUTATION = "Spatial Profiler Computation Settings",
    SPECTRAL_PROFILER = "Spectral Profiler",
    SPECTRAL_PROFILER_SETTINGS_CONVERSION = "Spectral Profiler Conversion Settings",
    SPECTRAL_PROFILER_SETTINGS_STYLING = "Spectral Profiler Style Settings",
    SPECTRAL_PROFILER_SETTINGS_SMOOTHING = "Spectral Profiler Smoothing Settings",
    SPECTRAL_PROFILER_SETTINGS_MOMENTS = "Spectral Profiler Moments Settings",
    SPECTRAL_PROFILER_SETTINGS_FITTING = "Spectral Profiler Fitting Settings",
    STATS = "Statistics",
    STOKES_ANALYSIS = "Stokes Analysis",
    STOKES_ANALYSIS_SETTINGS_CONVERSION = "Stokes Conversion Settings",
    STOKES_ANALYSIS_SETTINGS_LINE_PLOT_STYLING = "Stokes Line Plot Settings",
    STOKES_ANALYSIS_SETTINGS_SCATTER_PLOT_STYLING = "Stokes Scatter Plot Settings",
    STOKES_ANALYSIS_SETTINGS_SMOOTHING = "Stokes Smoothing Settings",
    CATALOG_OVERLAY = "Catalog Overlay",
    CATALOG_HISTOGRAM_PLOT = "Catalog Histogram Plot",
    CATALOG_SCATTER_PLOT = "Catalog Scatter Plot",
    CATALOG_SETTINGS_GOLBAL = "Catalog Global Settings",
    CATALOG_SETTINGS_OVERLAY = "Catalog Overlay Settings",
    CATALOG_SETTINGS_COLOR = "Catalog Color Settings",
    CATALOG_SETTINGS_SIZE = "Catalog Size Settings",
    CATALOG_SETTINGS_ORIENTATION = "Catalog Orientation Settings",
    SPECTRAL_LINE_QUERY = "Spectral Line Query",
    PV_GENERATOR = "PV Generator",
    CURSOR_INFO = "Cursor Information"
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
