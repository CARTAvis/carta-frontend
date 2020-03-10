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
    SpatialProfilerSettingsHelpComponent,
    SpectralProfilerHelpComponent,
    SpectralProfilerSettingsHelpComponent,
    StatsHelpComponent,
    StokesAnalysisHelpComponent,
    StokesAnalysisSettingsHelpComponent
} from "./HelpContent";
import {AppStore, HelpType} from "stores";

@observer
export class HelpDrawerComponent extends React.Component<{ appStore: AppStore }> {

    render() {
        let className = "help-drawer";
        if (this.props.appStore.darkTheme) {
            className += " bp3-dark";
        }

        const appStore = this.props.appStore;
        const helpStore = appStore.helpStore;

        const drawerProps: IDrawerProps = {
            icon: "help",
            className: className,
            lazy: true,
            isOpen: helpStore.helpVisible,
            onClose: helpStore.hideHelpDrawer,
            title: this.HELP_MAP.get(helpStore.type) ? this.HELP_MAP.get(helpStore.type).title : "",
            position: helpStore.position,
            size: "33%",
            hasBackdrop: true
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
                content: <ContourHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.FILE_Browser, {
                title: "File Browser",
                content: <FileBrowserHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.FILE_INFO, {
                title: "File Info",
                content: <FileInfoHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.SAVE_LAYOUT, {
                title: "Save Layout",
                content: <SaveLayoutHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.OVERLAY_SETTINGS, {
                title: "Overlay Settings",
                content: <OverlaySettingsHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.PREFERENCES, {
                title: "Preferences",
                content: <PreferencesHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.REGION_DIALOG, {
                title: "Region Dialog",
                content: <RegionDialogHelpComponent appStore={this.props.appStore}/>
        }],

        // Widgets
        [
            HelpType.ANIMATOR, {
                title: "Animator",
                content: <AnimatorHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.HISTOGRAM, {
                title: "Histogram",
                content: <HistogramHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.HISTOGRAM_SETTINGS, {
                title: "Histogram Settings",
                content: <HistogramSettingsHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.IMAGE_VIEW, {
                title: "Image View",
                content: <ImageViewHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.LAYER_LIST, {
                title: "Layer List",
                content: <LayerListHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.LOG, {
                title: "Log",
                content: <LogHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.PLACEHOLDER, {
                title: "Placeholder",
                content: <PlaceholderHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.REGION_LIST, {
                title: "Region List",
                content: <RegionListHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.RENDER_CONFIG, {
                title: "Render Configuration",
                content: <RenderConfigHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.RENDER_CONFIG_SETTINGS, {
                title: "Render Configuration Settings",
                content: <RenderConfigSettingsHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.SPATIAL_PROFILER, {
                title: "Spatial Profiler",
                content: <SpatialProfilerHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.SPATIAL_PROFILER_SETTINGS, {
                title: "Spatial Profiler Settings",
                content: <SpatialProfilerSettingsHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.SPECTRAL_PROFILER, {
                title: "Spectral Profiler",
                content: <SpectralProfilerHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.SPECTRAL_PROFILER_SETTINGS, {
                title: "Spectral Profiler Settings",
                content: <SpectralProfilerSettingsHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.STATS, {
                title: "Statistics",
                content: <StatsHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.STOKES_ANALYSIS, {
                title: "Stokes Analysis",
                content: <StokesAnalysisHelpComponent appStore={this.props.appStore}/>
        }], [
            HelpType.STOKES_ANALYSIS_SETTINGS, {
                title: "Stokes Settings",
                content: <StokesAnalysisSettingsHelpComponent appStore={this.props.appStore}/>
        }]
    ]);
}
