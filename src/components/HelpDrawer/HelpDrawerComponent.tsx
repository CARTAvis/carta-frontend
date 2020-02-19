import * as React from "react";
import {observer} from "mobx-react";
import {Drawer, IDrawerProps, Position, Classes} from "@blueprintjs/core";
import {HelpFileBrowserComponent} from "./HelpContent/HelpFileBrowserComponent";
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
            content: ""
    }], [
        HelpType.FILE_Browser, {
            title: "File Browser",
            content: <HelpFileBrowserComponent/>
    }], [
        HelpType.FILE_INFO, {
            title: "File Info",
            content: ""
    }], [
        HelpType.SAVE_LAYOUT, {
            title: "Save Layout",
            content: ""
    }], [
        HelpType.OVERLAY_SETTINGS, {
            title: "Overlay Settings",
            content: ""
    }], [
        HelpType.PREFERENCES, {
            title: "Preferences",
            content: ""
    }], [
        HelpType.REGION_DIALOG, {
            title: "Region Dialog",
            content: ""
    }],

    // Widgets
    [
        HelpType.ANIMATOR, {
            title: "Animator",
            content: ""
    }], [
        HelpType.HISTOGRAM, {
            title: "Histogram",
            content: ""
    }], [
        HelpType.HISTOGRAM_SETTINGS, {
            title: "Histogram Settings",
            content: ""
    }], [
        HelpType.ANIMATOR, {
            title: "Animator",
            content: ""
    }], [
        HelpType.IMAGE_VIEW, {
            title: "Image View",
            content: ""
    }], [
        HelpType.LAYER_LIST, {
            title: "Layer List",
            content: ""
    }], [
        HelpType.LOG, {
            title: "Log",
            content: ""
    }], [
        HelpType.PLACEHOLDER, {
            title: "Placeholder",
            content: ""
    }], [
        HelpType.REGION_LIST, {
            title: "Region List",
            content: ""
    }], [
        HelpType.RENDER_CONFIG, {
            title: "Render Configuration",
            content: ""
    }], [
        HelpType.RENDER_CONFIG_SETTINGS, {
            title: "Render Configuration Settings",
            content: ""
    }], [
        HelpType.SPATIAL_PROFILER, {
            title: "Spatial Profiler",
            content: ""
    }], [
        HelpType.SPATIAL_PROFILER_SETTINGS, {
            title: "Spatial Profiler Settings",
            content: ""
    }], [
        HelpType.SPECTRAL_PROFILER, {
            title: "Spectral Profiler",
            content: ""
    }], [
        HelpType.SPECTRAL_PROFILER_SETTINGS, {
            title: "Spectral Profiler Settings",
            content: ""
    }], [
        HelpType.STATS, {
            title: "Statistics",
            content: ""
    }], [
        HelpType.STOKES_ANALYSIS, {
            title: "Stokes Analysis",
            content: ""
    }], [
        HelpType.STOKES_ANALYSIS_SETTINGS, {
            title: "Stokes Settings",
            content: ""
    }]
]);
