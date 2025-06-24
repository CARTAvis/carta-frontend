import * as React from "react";
import {Classes, Drawer, DrawerProps} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {AppStore, HelpStore} from "stores";
import {HelpType} from "stores/HelpStore/HelpStore";

import "./HelpDrawerComponent.scss";

const url_version = "5.0";
const url_prefix = `https://carta.readthedocs.io/en/${url_version}`;

// note for v5-beta release: URLs are not final. The readthedocs user manual needs a major reorganization of topics to support online in-app help
// dialog URLs
const CONTOUR_HELP_CONTENT_URL = `${url_prefix}/contour_rendering.html`;
const FILE_BROWSER_HELP_CONTENT_URL = `${url_prefix}/file_browser.html`;
const FILE_INFO_HELP_CONTENT_URL = `${url_prefix}/file_info.html`;
const IMAGE_FITTING_HELP_CONTENT_URL = `${url_prefix}/image_fitting.html`;
const PREFERENCES_HELP_CONTENT_URL = `${url_prefix}/preferences.html`;
const REGION_DIALOG_HELP_CONTENT_URL = `${url_prefix}/region_configuration.html`;
const SAVE_LAYOUT_HELP_CONTENT_URL = `${url_prefix}/layout.html`;
const STOKES_HYPERCUBE_DIALOG_HELP_CONTENT_URL = `${url_prefix}/file_browser.html#stokes-hypercube`;
const VECTOR_OVERLAY_HELP_CONTENT_URL = `${url_prefix}/vector_field_rendering.html`;
const ONLINE_CATALOG_QUERY_HELP_CONTENT_URL = `${url_prefix}/online_data_query.html`;
const WORKSPACE_HELP_CONTENT_URL = `${url_prefix}/workspace.html`;

// widgets URLs
const ANIMATOR_HELP_CONTENT_URL = `${url_prefix}/animator.html`;
const HISTOGRAM_HELP_CONTENT_URL = `${url_prefix}/histogram_widget.html`;
const HISTOGRAM_SETTINGS_HELP_CONTENT_URL = `${url_prefix}/histogram_widget.html#settings`;
const IMAGE_VIEW_HELP_CONTENT_URL = `${url_prefix}/image_viewer.html`;
const IMAGE_VIEW_SETTINGS_HELP_CONTENT_URL = `${url_prefix}/image_viewer.html`;
const LAYER_LIST_HELP_CONTENT_URL = `${url_prefix}/image_list_widget.html`;
const LAYER_LIST_SETTINGS_HELP_CONTENT_URL = `${url_prefix}/image_list_widget.html#settings`;
const LOG_HELP_CONTENT_URL = `${url_prefix}/log_widget.html`;
const PLACE_HOLDER_HELP_CONTENT_URL = `${url_prefix}/`;
const REGION_LIST_HELP_CONTENT_URL = `${url_prefix}/region_list_widget.html`;
const RENDER_CONFIG_HELP_CONTENT_URL = `${url_prefix}/raster_rendering.html`;
const RENDER_CONFIG_COLOR_BLENDING_HELP_CONTENT_URL = `${url_prefix}/multicolor_blending.html`;
const RENDER_CONFIG_SETTINGS_HELP_CONTENT_URL = `${url_prefix}/raster_rendering.html#settings`;
const SPATIAL_PROFILER_HELP_CONTENT_URL = `${url_prefix}/spatial_profiler.html`;
const SPATIAL_PROFILER_SETTINGS_STYLING_HELP_CONTENT_URL = `${url_prefix}/spatial_profiler.html#settings`;
const SPATIAL_PROFILER_SETTINGS_SMOOTHING_HELP_CONTENT_URL = `${url_prefix}/profile_smoothing.html`;
const SPATIAL_PROFILER_SETTINGS_COMPUTATION_HELP_CONTENT_URL = `${url_prefix}/spatial_profiler.html`;
const SPECTRAL_PROFILER_HELP_CONTENT_URL = `${url_prefix}/spectral_profiler.html`;
const SPECTRAL_PROFILER_SETTINGS_CONVERSION_HELP_CONTENT_URL = `${url_prefix}/spectral_profiler.html#settings`;
const SPECTRAL_PROFILER_SETTINGS_STYLING_HELP_CONTENT_URL = `${url_prefix}/spectral_profiler.html#settings`;
const SPECTRAL_PROFILER_SETTINGS_SMOOTHING_HELP_CONTENT_URL = `${url_prefix}/profile_smoothing.html`;
const SPECTRAL_PROFILER_SETTINGS_MOMENTS_HELP_CONTENT_URL = `${url_prefix}/moment_generator.html`;
const SPECTRAL_PROFILER_SETTINGS_FITTING_HELP_CONTENT_URL = `${url_prefix}/profile_fitting.html`;
const STATS_HELP_CONTENT_URL = `${url_prefix}/statistics_widget.html`;
const STOKES_ANALYSIS_HELP_CONTENT_URL = `${url_prefix}/stokes_analysis_widget.html`;
const STOKES_ANALYSIS_SETTINGS_CONVERSION_HELP_CONTENT_URL = `${url_prefix}/stokes_analysis_widget.html#settings`;
const STOKES_ANALYSIS_SETTINGS_LINE_PLOT_STYLING_HELP_CONTENT_URL = `${url_prefix}/stokes_analysis_widget.html#settings`;
const STOKES_ANALYSIS_SETTINGS_SCATTER_PLOT_STYLING_HELP_CONTENT_URL = `${url_prefix}/stokes_analysis_widget.html#settings`;
const STOKES_ANALYSIS_SETTINGS_SMOOTHING_HELP_CONTENT_URL = `${url_prefix}/profile_smoothing.html`;
const CATALOG_OVERLAY_HELP_CONTENT_URL = `${url_prefix}/catalog_widget.html`;
const CATALOG_HISTOGRAM_PLOT_HELP_CONTENT_URL = `${url_prefix}/catalog_widget.html#catalog-histogram-plot`;
const CATALOG_SCATTER_PLOT_HELP_CONTENT_URL = `${url_prefix}/catalog_widget.html#catalog-2d-scatter-plot`;
const CATALOG_SETTINGS_COLOR_HELP_CONTENT_URL = `${url_prefix}/catalog_widget.html#catalog-image-overlay-and-settings`;
const CATALOG_SETTINGS_SIZE_HELP_CONTENT_URL = `${url_prefix}/catalog_widget.html#catalog-image-overlay-and-settings`;
const CATALOG_SETTINGS_ORIENTATION_HELP_CONTENT_URL = `${url_prefix}/catalog_widget.html#catalog-image-overlay-and-settings`;
const SPECTRAL_LINE_QUERY_HELP_CONTENT_URL = `${url_prefix}/spectral_line_query.html`;
const PV_GENERATOR_HELP_CONTENT_URL = `${url_prefix}/pv_generator.html`;
const CURSOR_INFO_HELP_CONTENT_URL = `${url_prefix}/cursor_info.html`;
const CHANNEL_MAP_CONTROL_HELP_CONTENT_URL = `${url_prefix}/channel_map_control.html`;

const HELP_CONTENT_MAP = new Map<HelpType, string>([
    // Dialog
    [HelpType.CONTOUR, CONTOUR_HELP_CONTENT_URL],
    [HelpType.FILE_BROWSER, FILE_BROWSER_HELP_CONTENT_URL],
    [HelpType.FILE_INFO, FILE_INFO_HELP_CONTENT_URL],
    [HelpType.IMAGE_FITTING, IMAGE_FITTING_HELP_CONTENT_URL],
    [HelpType.PREFERENCES, PREFERENCES_HELP_CONTENT_URL],
    [HelpType.REGION_DIALOG, REGION_DIALOG_HELP_CONTENT_URL],
    [HelpType.SAVE_LAYOUT, SAVE_LAYOUT_HELP_CONTENT_URL],
    [HelpType.STOKES, STOKES_HYPERCUBE_DIALOG_HELP_CONTENT_URL],
    [HelpType.VECTOR_OVERLAY, VECTOR_OVERLAY_HELP_CONTENT_URL],
    [HelpType.ONLINE_CATALOG_QUERY, ONLINE_CATALOG_QUERY_HELP_CONTENT_URL],
    [HelpType.WORKSPACE, WORKSPACE_HELP_CONTENT_URL],

    // Widgets
    [HelpType.ANIMATOR, ANIMATOR_HELP_CONTENT_URL],
    [HelpType.HISTOGRAM, HISTOGRAM_HELP_CONTENT_URL],
    [HelpType.HISTOGRAM_SETTINGS, HISTOGRAM_SETTINGS_HELP_CONTENT_URL],
    [HelpType.IMAGE_VIEW, IMAGE_VIEW_HELP_CONTENT_URL],
    [HelpType.IMAGE_VIEW_SETTINGS, IMAGE_VIEW_SETTINGS_HELP_CONTENT_URL],
    [HelpType.LAYER_LIST, LAYER_LIST_HELP_CONTENT_URL],
    [HelpType.LAYER_LIST_SETTINGS, LAYER_LIST_SETTINGS_HELP_CONTENT_URL],
    [HelpType.LOG, LOG_HELP_CONTENT_URL],
    [HelpType.PLACEHOLDER, PLACE_HOLDER_HELP_CONTENT_URL],
    [HelpType.REGION_LIST, REGION_LIST_HELP_CONTENT_URL],
    [HelpType.RENDER_CONFIG, RENDER_CONFIG_HELP_CONTENT_URL],
    [HelpType.RENDER_CONFIG_COLOR_BLENDING, RENDER_CONFIG_COLOR_BLENDING_HELP_CONTENT_URL],
    [HelpType.RENDER_CONFIG_SETTINGS, RENDER_CONFIG_SETTINGS_HELP_CONTENT_URL],
    [HelpType.SPATIAL_PROFILER, SPATIAL_PROFILER_HELP_CONTENT_URL],
    [HelpType.SPATIAL_PROFILER_SETTINGS_STYLING, SPATIAL_PROFILER_SETTINGS_STYLING_HELP_CONTENT_URL],
    [HelpType.SPATIAL_PROFILER_SETTINGS_SMOOTHING, SPATIAL_PROFILER_SETTINGS_SMOOTHING_HELP_CONTENT_URL],
    [HelpType.SPATIAL_PROFILER_SETTINGS_COMPUTATION, SPATIAL_PROFILER_SETTINGS_COMPUTATION_HELP_CONTENT_URL],
    [HelpType.SPECTRAL_PROFILER, SPECTRAL_PROFILER_HELP_CONTENT_URL],
    [HelpType.SPECTRAL_PROFILER_SETTINGS_CONVERSION, SPECTRAL_PROFILER_SETTINGS_CONVERSION_HELP_CONTENT_URL],
    [HelpType.SPECTRAL_PROFILER_SETTINGS_STYLING, SPECTRAL_PROFILER_SETTINGS_STYLING_HELP_CONTENT_URL],
    [HelpType.SPECTRAL_PROFILER_SETTINGS_SMOOTHING, SPECTRAL_PROFILER_SETTINGS_SMOOTHING_HELP_CONTENT_URL],
    [HelpType.SPECTRAL_PROFILER_SETTINGS_MOMENTS, SPECTRAL_PROFILER_SETTINGS_MOMENTS_HELP_CONTENT_URL],
    [HelpType.SPECTRAL_PROFILER_SETTINGS_FITTING, SPECTRAL_PROFILER_SETTINGS_FITTING_HELP_CONTENT_URL],
    [HelpType.STATS, STATS_HELP_CONTENT_URL],
    [HelpType.STOKES_ANALYSIS, STOKES_ANALYSIS_HELP_CONTENT_URL],
    [HelpType.STOKES_ANALYSIS_SETTINGS_CONVERSION, STOKES_ANALYSIS_SETTINGS_CONVERSION_HELP_CONTENT_URL],
    [HelpType.STOKES_ANALYSIS_SETTINGS_LINE_PLOT_STYLING, STOKES_ANALYSIS_SETTINGS_LINE_PLOT_STYLING_HELP_CONTENT_URL],
    [HelpType.STOKES_ANALYSIS_SETTINGS_SCATTER_PLOT_STYLING, STOKES_ANALYSIS_SETTINGS_SCATTER_PLOT_STYLING_HELP_CONTENT_URL],
    [HelpType.STOKES_ANALYSIS_SETTINGS_SMOOTHING, STOKES_ANALYSIS_SETTINGS_SMOOTHING_HELP_CONTENT_URL],
    [HelpType.CATALOG_OVERLAY, CATALOG_OVERLAY_HELP_CONTENT_URL],
    [HelpType.CATALOG_HISTOGRAM_PLOT, CATALOG_HISTOGRAM_PLOT_HELP_CONTENT_URL],
    [HelpType.CATALOG_SCATTER_PLOT, CATALOG_SCATTER_PLOT_HELP_CONTENT_URL],
    [HelpType.CATALOG_SETTINGS_GOLBAL, undefined],
    [HelpType.CATALOG_SETTINGS_OVERLAY, undefined],
    [HelpType.CATALOG_SETTINGS_COLOR, CATALOG_SETTINGS_COLOR_HELP_CONTENT_URL],
    [HelpType.CATALOG_SETTINGS_SIZE, CATALOG_SETTINGS_SIZE_HELP_CONTENT_URL],
    [HelpType.CATALOG_SETTINGS_ORIENTATION, CATALOG_SETTINGS_ORIENTATION_HELP_CONTENT_URL],
    [HelpType.SPECTRAL_LINE_QUERY, SPECTRAL_LINE_QUERY_HELP_CONTENT_URL],
    [HelpType.PV_GENERATOR, PV_GENERATOR_HELP_CONTENT_URL],
    [HelpType.CURSOR_INFO, CURSOR_INFO_HELP_CONTENT_URL],
    [HelpType.CHANNEL_MAP_CONTROL, CHANNEL_MAP_CONTROL_HELP_CONTENT_URL]
]);

@observer
export class HelpDrawerComponent extends React.Component {
    render() {
        const helpStore = HelpStore.Instance;
        const className = classNames("help-drawer", {[Classes.DARK]: AppStore.Instance.darkTheme});

        const drawerProps: DrawerProps = {
            className: className,
            lazy: true,
            isOpen: helpStore.helpVisible,
            onClose: helpStore.hideHelpDrawer,
            position: helpStore.position,
            size: "40%",
            hasBackdrop: true,
            backdropClassName: "help-drawer-backdrop"
        };

        return (
            <Drawer {...drawerProps}>
                <div className={Classes.DRAWER_BODY}>
                    <iframe src={HELP_CONTENT_MAP.get(helpStore.type) ?? ""} loading="eager" allow="camera 'none'; microphone 'none'; geolocation 'none'" title={helpStore.type ?? ""}></iframe>
                </div>
            </Drawer>
        );
    }
}
