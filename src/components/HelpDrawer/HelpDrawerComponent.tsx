import * as React from "react";
import {observer} from "mobx-react";
import {Drawer, IDrawerProps, Position, Classes} from "@blueprintjs/core";
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
            backdropClassName: "minimal-drawer-backdrop",
            lazy: true,
            isOpen: helpStore.helpVisible,
            onClose: helpStore.hideHelpDrawer,
            title: HELP_MAP.get(helpStore.type) ? HELP_MAP.get(helpStore.type).title : "",
            position: Position.RIGHT,
            size: "33%",
            hasBackdrop: true
        };

        return (
            <Drawer {...drawerProps} >
                <div className={Classes.DRAWER_BODY}>
                    <div className={Classes.DIALOG_BODY}>
                        {HELP_MAP.get(helpStore.type) ? HELP_MAP.get(helpStore.type).content : ""}
                    </div>
                </div>
            </Drawer>
        );
    }
}

const HELP_MAP = new Map<HelpType, {title: string, content: any}>([
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
            title: "File Info",
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
            title: "Layer List",
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
        HelpType.SPATIAL_PROFILER_SETTINGS, {
            title: "Spatial Profiler Settings",
            content: <SpatialProfilerSettingsHelpComponent/>
    }], [
        HelpType.SPECTRAL_PROFILER, {
            title: "Spectral Profiler",
            content: <SpectralProfilerHelpComponent/>
    }], [
        HelpType.SPECTRAL_PROFILER_SETTINGS, {
            title: "Spectral Profiler Settings",
            content: <SpectralProfilerSettingsHelpComponent/>
    }], [
        HelpType.STATS, {
            title: "Statistics",
            content: <StatsHelpComponent/>
    }], [
        HelpType.STOKES_ANALYSIS, {
            title: "Stokes Analysis",
            content: <StokesAnalysisHelpComponent/>
    }], [
        HelpType.STOKES_ANALYSIS_SETTINGS, {
            title: "Stokes Settings",
            content: <StokesAnalysisSettingsHelpComponent/>
    }]
]);
