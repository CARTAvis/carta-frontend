import {action, observable} from "mobx";

export class HelpStore {
    @observable helpVisible: boolean = false;
    @observable helpTitle: string;
    @observable helpContext: string;

    @action showHelpDrawer = (helpType: HelpType) => {
        this.helpTitle = HELP_CONFIG.get(helpType).title;
        this.helpContext = HELP_CONFIG.get(helpType).context;
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
    OVERLAY_SETTINGS  = "overlay-settings",
    REGION_DIALOG = "region-dialog",

    // Widgets
    ANIMATOR = "animator",
    HISTOGRAM = "histogram",
    HISTOGRAM_SETTINGS = "histogram-settings",
    IMAGE_VIEW = "image-view",
    LAYER_LIST = "layer-list",
    LOG = "log",
    PLACEHOLDER = "placeholder",
    REGION_LIST = "region-list",
    RENDER_CONFIG = "render-config",
    RENDER_CONFIG_SETTINGS = "render-config-settings",
    SPATIAL_PROFILER = "spatial-profiler",
    SPATIAL_PROFILER_SETTINGS = "spatial-profiler-settings",
    SPECTRAL_PROFILER = "spectral-profiler",
    SPECTRAL_PROFILER_SETTINGS = "spectral-profiler-settings",
    STATS = "stats",
    STOKES_ANALYSIS = "stoke-analysis",
    STOKES_ANALYSIS_SETTINGS = "stoke-analysis-settings"
}

const HELP_CONFIG = new Map<HelpType, any>([
    [
        HelpType.CONTOUR, {
            title: "Contour Configuration",
            context: "<h2>Drawer Test</h2><p><strong>Data integration is the seminal problem of the digital age. For over ten years,we’ve helped the world’s premier organizations rise to the challenge.</strong></p><p>Palantir Foundry radically reimagines the way enterprises interact with data by amplifying and extending the power of data integration. With Foundry, anyone can source, fuse, and transform data into any shape they desire. Business analysts become data engineers — and leaders in their organization’s data revolution.</p>"
    }], [
        HelpType.FILE_Browser, {
            title: "File Browser",
            context: ""
    }], [
        HelpType.FILE_INFO, {
            title: "File Info",
            context: ""
    }], [
        HelpType.SAVE_LAYOUT, {
            title: "Save Layout",
            context: ""
    }], [
        HelpType.OVERLAY_SETTINGS, {
            title: "Overlay Settings",
            context: ""
    }], [
        HelpType.PREFERENCES, {
            title: "Preferences",
            context: ""
    }], [
        HelpType.REGION_DIALOG, {
            title: "Region Dialog",
            context: ""
    }], [
        HelpType.ANIMATOR, {
            title: "Animator",
            context: ""
    }], [
        HelpType.HISTOGRAM, {
            title: "Histogram",
            context: ""
    }], [
        HelpType.HISTOGRAM_SETTINGS, {
            title: "Histogram Settings",
            context: ""
    }], [
        HelpType.ANIMATOR, {
            title: "Animator",
            context: ""
    }], [
        HelpType.IMAGE_VIEW, {
            title: "Image View",
            context: ""
    }], [
        HelpType.LAYER_LIST, {
            title: "Layer List",
            context: ""
    }], [
        HelpType.LOG, {
            title: "Log",
            context: ""
    }], [
        HelpType.PLACEHOLDER, {
            title: "Placeholder",
            context: ""
    }], [
        HelpType.REGION_LIST, {
            title: "Region List",
            context: ""
    }], [
        HelpType.RENDER_CONFIG, {
            title: "Render Configuration",
            context: ""
    }], [
        HelpType.RENDER_CONFIG_SETTINGS, {
            title: "Render Configuration Settings",
            context: ""
    }], [
        HelpType.SPATIAL_PROFILER, {
            title: "Spatial Profiler",
            context: ""
    }], [
        HelpType.SPATIAL_PROFILER_SETTINGS, {
            title: "Spatial Profiler Settings",
            context: ""
    }], [
        HelpType.SPECTRAL_PROFILER, {
            title: "Spectral Profiler",
            context: ""
    }], [
        HelpType.SPECTRAL_PROFILER_SETTINGS, {
            title: "Spectral Profiler Settings",
            context: ""
    }], [
        HelpType.STATS, {
            title: "Statistics",
            context: ""
    }], [
        HelpType.STOKES_ANALYSIS, {
            title: "Stokes Analysis",
            context: ""
    }], [
        HelpType.STOKES_ANALYSIS_SETTINGS, {
            title: "Stokes Settings",
            context: ""
    }]
]);
