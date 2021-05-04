import * as React from "react";
import {observer} from "mobx-react";
import {Drawer, IDrawerProps, Classes} from "@blueprintjs/core";
import {
    ContourHelpComponent,
    FileBrowserHelpComponent,
    FileInfoHelpComponent,
    SaveLayoutHelpComponent,
    PreferencesHelpComponent,
    RegionDialogHelpComponent,
    AnimatorHelpComponent,
    HistogramHelpComponent,
    HistogramSettingsHelpComponent,
    ImageViewHelpComponent,
    ImageViewSettingsHelpComponent,
    LayerListHelpComponent,
    LogHelpComponent,
    PlaceholderHelpComponent,
    RegionListHelpComponent,
    RenderConfigHelpComponent,
    RenderConfigSettingsHelpComponent,
    SpatialProfilerHelpComponent,
    SpatialProfilerSettingsStylingHelpComponent,
    SpatialProfilerSettingsSmoothingHelpComponent,
    SpectralProfilerHelpComponent,
    SpectralProfilerSettingsConversionHelpComponent,
    SpectralProfilerSettingsStylingHelpComponent,
    SpectralProfilerSettingsSmoothingHelpComponent,
    SpectralProfilerSettingsMomentsHelpComponent,
    StatsHelpComponent,
    StokesAnalysisHelpComponent,
    StokesAnalysisSettingsConversionHelpComponent,
    StokesAnalysisSettingsLinePlotStylingHelpComponent,
    StokesAnalysisSettingsScatterPlotStylingHelpComponent,
    StokesAnalysisSettingsSmoothingHelpComponent,
    CatalogOverlayHelpComponent,
    CatalogHistogramPlotHelpComponent,
    CatalogScatterPlotHelpComponent,
    SpectralLineQueryHelpComponent,
    StokesDialogHelpComponent
} from "./HelpContent";
import {AppStore, HelpStore, HelpType} from "stores";

@observer
export class HelpDrawerComponent extends React.Component {

    render() {
        let className = "help-drawer";
        if (AppStore.Instance.darkTheme) {
            className += " bp3-dark";
        }

        const helpStore = HelpStore.Instance;

        const drawerProps: IDrawerProps = {
            icon: "help",
            className: className,
            lazy: true,
            isOpen: helpStore.helpVisible,
            onClose: helpStore.hideHelpDrawer,
            title: this.HELP_MAP.get(helpStore.type) ? this.HELP_MAP.get(helpStore.type).title : "",
            position: helpStore.position,
            size: "33%",
            hasBackdrop: false
        };

        return (
            <Drawer {...drawerProps} >
                <div className={Classes.DRAWER_BODY}>
                    <div className={Classes.DIALOG_BODY}>
                        {this.HELP_MAP.get(helpStore.type) ? this.HELP_MAP.get(helpStore.type).content : ""}
                    </div>
                </div>
            </Drawer>
        );
    }

    private readonly HELP_MAP = new Map<HelpType, {title: string, content: any}>([
        // Dialog
        [
            HelpType.CONTOUR, {
                title: "Contour Configuration",
                content: <ContourHelpComponent/>
        }], [
            HelpType.FILE_Browser, {
                title: "File Browser",
                content: <FileBrowserHelpComponent/>
        }], [
            HelpType.FILE_INFO, {
                title: "File Header",
                content: <FileInfoHelpComponent/>
        }], [
            HelpType.SAVE_LAYOUT, {
                title: "Save Layout",
                content: <SaveLayoutHelpComponent/>
        }], [
            HelpType.PREFERENCES, {
                title: "Preferences",
                content: <PreferencesHelpComponent/>
        }], [
            HelpType.REGION_DIALOG, {
                title: "Region Dialog",
                content: <RegionDialogHelpComponent/>
        }], [
            HelpType.STOKES, {
                title: "Stokes Dialog",
                content: <StokesDialogHelpComponent/>
        }],

        // Widgets
        [
            HelpType.ANIMATOR, {
                title: "Animator",
                content: <AnimatorHelpComponent/>
        }], [
            HelpType.HISTOGRAM, {
                title: "Histogram",
                content: <HistogramHelpComponent/>
        }], [
            HelpType.HISTOGRAM_SETTINGS, {
                title: "Histogram Settings",
                content: <HistogramSettingsHelpComponent/>
        }], [
            HelpType.IMAGE_VIEW, {
                title: "Image View",
                content: <ImageViewHelpComponent/>
        }], [
            HelpType.IMAGE_VIEW_SETTINGS, {
                title: "Image View Settings",
                content: <ImageViewSettingsHelpComponent/>
        }], [
            HelpType.LAYER_LIST, {
                title: "Image List",
                content: <LayerListHelpComponent/>
        }], [
            HelpType.LOG, {
                title: "Log",
                content: <LogHelpComponent/>
        }], [
            HelpType.PLACEHOLDER, {
                title: "Placeholder",
                content: <PlaceholderHelpComponent/>
        }], [
            HelpType.REGION_LIST, {
                title: "Region List",
                content: <RegionListHelpComponent/>
        }], [
            HelpType.RENDER_CONFIG, {
                title: "Render Configuration",
                content: <RenderConfigHelpComponent/>
        }], [
            HelpType.RENDER_CONFIG_SETTINGS, {
                title: "Render Configuration Settings",
                content: <RenderConfigSettingsHelpComponent/>
        }], [
            HelpType.SPATIAL_PROFILER, {
                title: "Spatial Profiler",
                content: <SpatialProfilerHelpComponent/>
        }], [
            HelpType.SPATIAL_PROFILER_SETTINGS_STYLING, {
                title: "Spatial Profiler Settings",
                content: <SpatialProfilerSettingsStylingHelpComponent/>
        }], [
            HelpType.SPATIAL_PROFILER_SETTINGS_SMOOTHING, {
                title: "Spatial Profiler Settings",
                content: <SpatialProfilerSettingsSmoothingHelpComponent/>
        }], [
            HelpType.SPECTRAL_PROFILER, {
                title: "Spectral Profiler",
                content: <SpectralProfilerHelpComponent/>
        }], [
            HelpType.SPECTRAL_PROFILER_SETTINGS_CONVERSION, {
                title: "Spectral Profiler Settings",
                content: <SpectralProfilerSettingsConversionHelpComponent/>
        }], [
            HelpType.SPECTRAL_PROFILER_SETTINGS_STYLING, {
                title: "Spectral Profiler Settings",
                content: <SpectralProfilerSettingsStylingHelpComponent/>
        }], [
            HelpType.SPECTRAL_PROFILER_SETTINGS_SMOOTHING, {
                title: "Spectral Profiler Settings",
                content: <SpectralProfilerSettingsSmoothingHelpComponent/>
        }], [
            HelpType.SPECTRAL_PROFILER_SETTINGS_MOMENTS, {
                title: "Spectral Profiler Settings",
                content: <SpectralProfilerSettingsMomentsHelpComponent/>
        }], [
            HelpType.STATS, {
                title: "Statistics",
                content: <StatsHelpComponent/>
        }], [
            HelpType.STOKES_ANALYSIS, {
                title: "Stokes Analysis",
                content: <StokesAnalysisHelpComponent/>
        }], [
            HelpType.STOKES_ANALYSIS_SETTINGS_CONVERSION, {
                title: "Stokes Settings",
                content: <StokesAnalysisSettingsConversionHelpComponent/>
        }], [
            HelpType.STOKES_ANALYSIS_SETTINGS_LINE_PLOT_STYLING, {
                title: "Stokes Settings",
                content: <StokesAnalysisSettingsLinePlotStylingHelpComponent/>
        }], [
            HelpType.STOKES_ANALYSIS_SETTINGS_SCATTER_PLOT_STYLING, {
                title: "Stokes Settings",
                content: <StokesAnalysisSettingsScatterPlotStylingHelpComponent/>
        }], [
            HelpType.STOKES_ANALYSIS_SETTINGS_SMOOTHING, {
                title: "Stokes Settings",
                content: <StokesAnalysisSettingsSmoothingHelpComponent/>
        }], [
            HelpType.CATALOG_OVERLAY, {
                title: "Catalog Overlay",
                content: <CatalogOverlayHelpComponent/>
        }], [
                HelpType.CATALOG_HISTOGRAM_PLOT, {
                title: "Catalog Histogram Plot",
                content: <CatalogHistogramPlotHelpComponent/>
        }], [
            HelpType.CATALOG_SCATTER_PLOT, {
                title: "Catalog Scatter Plot",
                content: <CatalogScatterPlotHelpComponent/>
        }], [
            HelpType.CATALOG_SETTINGS_GOLBAL, {
                title: "Catalog Settings",
                content: ""
        }],[
            HelpType.CATALOG_SETTINGS_OVERLAY, {
                title: "Catalog Styling",
                content: ""
        }],[
            HelpType.CATALOG_SETTINGS_COLOR, {
                title: "Catalog Color",
                content: ""
        }],[
            HelpType.CATALOG_SETTINGS_SIZE, {
                title: "Catalog Size",
                content: ""
        }],[
            HelpType.CATALOG_SETTINGS_ORIENTATION, {
                title: "Catalog Orientation",
                content: ""
        }],[
            HelpType.SPECTRAL_LINE_QUERY, {
                title: "Spectral Line Query",
                content: <SpectralLineQueryHelpComponent/>
        }]
    ]);
}
