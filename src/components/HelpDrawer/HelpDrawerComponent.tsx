import * as React from "react";
import {observer} from "mobx-react";
import {Drawer, IDrawerProps, Position, Classes} from "@blueprintjs/core";
import {AppStore, HelpType} from "stores";
import "./HelpDrawerComponent.css";

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
            title: HELP_CONFIG.get(helpStore.type) ? HELP_CONFIG.get(helpStore.type).title : "",
            position: Position.RIGHT,
            size: "33%",
            hasBackdrop: true
        };

        return (
            <Drawer {...drawerProps} >
                <div className={Classes.DRAWER_BODY}>
                    <div className={Classes.DIALOG_BODY} dangerouslySetInnerHTML={{__html: HELP_CONFIG.get(helpStore.type) ? HELP_CONFIG.get(helpStore.type).conten : "" }}/>
                </div>
            </Drawer>
        );
    }
}

const HELP_CONFIG = new Map<HelpType, { title: string, conten: string }>([
    // Dialog
    [
        HelpType.CONTOUR, {
            title: "Contour Configuration",
            conten: ""
    }], [
        HelpType.FILE_Browser, {
            title: "File Browser",
            conten: require("!raw-loader!./HelpContent/file_browser.html")
    }], [
        HelpType.FILE_INFO, {
            title: "File Info",
            conten: ""
    }], [
        HelpType.SAVE_LAYOUT, {
            title: "Save Layout",
            conten: ""
    }], [
        HelpType.OVERLAY_SETTINGS, {
            title: "Overlay Settings",
            conten: ""
    }], [
        HelpType.PREFERENCES, {
            title: "Preferences",
            conten: ""
    }], [
        HelpType.REGION_DIALOG, {
            title: "Region Dialog",
            conten: ""
    }],

    // Widgets
    [
        HelpType.ANIMATOR, {
            title: "Animator",
            conten: ""
    }], [
        HelpType.HISTOGRAM, {
            title: "Histogram",
            conten: ""
    }], [
        HelpType.HISTOGRAM_SETTINGS, {
            title: "Histogram Settings",
            conten: ""
    }], [
        HelpType.ANIMATOR, {
            title: "Animator",
            conten: ""
    }], [
        HelpType.IMAGE_VIEW, {
            title: "Image View",
            conten: require("!raw-loader!./HelpContent/image_view.html")
    }], [
        HelpType.LAYER_LIST, {
            title: "Layer List",
            conten: ""
    }], [
        HelpType.LOG, {
            title: "Log",
            conten: ""
    }], [
        HelpType.PLACEHOLDER, {
            title: "Placeholder",
            conten: ""
    }], [
        HelpType.REGION_LIST, {
            title: "Region List",
            conten: ""
    }], [
        HelpType.RENDER_CONFIG, {
            title: "Render Configuration",
            conten: ""
    }], [
        HelpType.RENDER_CONFIG_SETTINGS, {
            title: "Render Configuration Settings",
            conten: ""
    }], [
        HelpType.SPATIAL_PROFILER, {
            title: "Spatial Profiler",
            conten: ""
    }], [
        HelpType.SPATIAL_PROFILER_SETTINGS, {
            title: "Spatial Profiler Settings",
            conten: ""
    }], [
        HelpType.SPECTRAL_PROFILER, {
            title: "Spectral Profiler",
            conten: ""
    }], [
        HelpType.SPECTRAL_PROFILER_SETTINGS, {
            title: "Spectral Profiler Settings",
            conten: ""
    }], [
        HelpType.STATS, {
            title: "Statistics",
            conten: ""
    }], [
        HelpType.STOKES_ANALYSIS, {
            title: "Stokes Analysis",
            conten: ""
    }], [
        HelpType.STOKES_ANALYSIS_SETTINGS, {
            title: "Stokes Settings",
            conten: ""
    }]
]);
