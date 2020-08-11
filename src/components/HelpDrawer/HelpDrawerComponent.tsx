import * as React from "react";
import {observer} from "mobx-react";
import {Drawer, IDrawerProps, Classes} from "@blueprintjs/core";
import {
    ContourHelpComponent,
    FileBrowserHelpComponent,
    FileInfoHelpComponent,
    SaveLayoutHelpComponent,
    OverlaySettingsHelpComponent,
    PreferencesHelpComponent,
    RegionDialogHelpComponent,
    AnimatorHelpComponent,
    HistogramHelpComponent,
    HistogramSettingsHelpComponent,
    ImageViewHelpComponent,
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
    CatalogScatterHelpComponent,
    SpectralLineQueryHelpComponent
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
            HelpType.OVERLAY_SETTINGS, {
                title: "Overlay Settings",
                content: <OverlaySettingsHelpComponent/>
        }], [
            HelpType.PREFERENCES, {
                title: "Preferences",
                content: <PreferencesHelpComponent/>
        }], [
            HelpType.REGION_DIALOG, {
                title: "Region Dialog",
                content: <RegionDialogHelpComponent/>
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
                title: "Spatial Profiler Settings Styling",
                content: <SpatialProfilerSettingsStylingHelpComponent/>
        }], [
            HelpType.SPATIAL_PROFILER_SETTINGS_SMOOTHING, {
                title: "Spatial Profiler Settings Smoothing",
                content: <SpatialProfilerSettingsSmoothingHelpComponent/>
        }], [
            HelpType.SPECTRAL_PROFILER, {
                title: "Spectral Profiler",
                content: <SpectralProfilerHelpComponent/>
        }], [
            HelpType.SPECTRAL_PROFILER_SETTINGS_CONVERSION, {
                title: "Spectral Profiler Settings Conversion",
                content: <SpectralProfilerSettingsConversionHelpComponent/>
        }], [
            HelpType.SPECTRAL_PROFILER_SETTINGS_STYLING, {
                title: "Spectral Profiler Settings Styling",
                content: <SpectralProfilerSettingsStylingHelpComponent/>
        }], [
            HelpType.SPECTRAL_PROFILER_SETTINGS_SMOOTHING, {
                title: "Spectral Profiler Settings Smoothing",
                content: <SpectralProfilerSettingsSmoothingHelpComponent/>
        }], [
            HelpType.SPECTRAL_PROFILER_SETTINGS_MOMENTS, {
                title: "Spectral Profiler Settings Moments",
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
                title: "Stokes Settings Conversion",
                content: <StokesAnalysisSettingsConversionHelpComponent/>
        }], [
            HelpType.STOKES_ANALYSIS_SETTINGS_LINE_PLOT_STYLING, {
                title: "Stokes Settings Line Plot Styling",
                content: <StokesAnalysisSettingsLinePlotStylingHelpComponent/>
        }], [
            HelpType.STOKES_ANALYSIS_SETTINGS_SCATTER_PLOT_STYLING, {
                title: "Stokes Settings Scatter Plot Styling",
                content: <StokesAnalysisSettingsScatterPlotStylingHelpComponent/>
        }], [
            HelpType.STOKES_ANALYSIS_SETTINGS_SMOOTHING, {
                title: "Stokes Settings Smoothing",
                content: <StokesAnalysisSettingsSmoothingHelpComponent/>
        }], [
            HelpType.CATALOG_OVERLAY, {
                title: "Catalog Overlay",
                content: <CatalogOverlayHelpComponent/>
        }], [
            HelpType.CATALOG_SCATTER, {
                title: "Catalog Scatter",
                content: <CatalogScatterHelpComponent/>
        }], [
            HelpType.SPECTRAL_LINE_QUERY, {
                title: "Spectral Line Query",
                content: <SpectralLineQueryHelpComponent/>
        }]
    ]);
}
