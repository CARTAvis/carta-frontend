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
const CONTOUR_HELP_CONTENT_URL = `${url_prefix}/image_visualization.html#contour-rendering`;
const FILE_BROWSER_HELP_CONTENT_URL = `${url_prefix}/image_visualization.html#file-browser`;
const FILE_INFO_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#file-header`;
const IMAGE_FITTING_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#image-fitting`;
const PREFERENCES_HELP_CONTENT_URL = `${url_prefix}/about_gui.html#user-preferences`;
const REGION_DIALOG_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#region-of-interest`;
const SAVE_LAYOUT_HELP_CONTENT_URL = `${url_prefix}/about_gui.html#configuring-the-layout`;
const STOKES_HYPERCUBE_DIALOG_HELP_CONTENT_URL = `${url_prefix}/image_visualization.html#forming-a-stokes-hypercube`;
const VECTOR_OVERLAY_HELP_CONTENT_URL = `${url_prefix}/image_visualization.html#vector-field-rendering`;
const ONLINE_CATALOG_QUERY_HELP_CONTENT_URL = `${url_prefix}/catalogue_visualization.html#catalog-visualization`;
const WORKSPACE_HELP_CONTENT_URL = `${url_prefix}/workspace.html`;

// widgets URLs
const ANIMATOR_HELP_CONTENT_URL = `${url_prefix}/image_visualization.html#animator`;
const HISTOGRAM_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#histogram-widget`;
const HISTOGRAM_SETTINGS_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#histogram-widget`;
const IMAGE_VIEW_HELP_CONTENT_URL = `${url_prefix}/image_visualization.html#image-viewer`;
const IMAGE_VIEW_SETTINGS_HELP_CONTENT_URL = `${url_prefix}/image_visualization.html#image-viewer`;
const LAYER_LIST_HELP_CONTENT_URL = `${url_prefix}/image_visualization.html#matching-images-spatially-and-spectrally`;
const LAYER_LIST_SETTINGS_HELP_CONTENT_URL = `${url_prefix}/image_visualization.html#matching-images-spatially-and-spectrally`;
const LOG_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#log-widget`;
const PLACE_HOLDER_HELP_CONTENT_URL = `${url_prefix}/`;
const REGION_LIST_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#region-of-interest`;
const RENDER_CONFIG_HELP_CONTENT_URL = `${url_prefix}/image_visualization.html#raster-rendering`;
const RENDER_CONFIG_SETTINGS_HELP_CONTENT_URL = `${url_prefix}/image_visualization.html#raster-rendering`;
const SPATIAL_PROFILER_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#spatial-profiler`;
const SPATIAL_PROFILER_SETTINGS_STYLING_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#spatial-profiler`;
const SPATIAL_PROFILER_SETTINGS_SMOOTHING_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#profile-smoothing`;
const SPATIAL_PROFILER_SETTINGS_COMPUTATION_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#spatial-profiler`;
const SPECTRAL_PROFILER_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#spectral-profiler`;
const SPECTRAL_PROFILER_SETTINGS_CONVERSION_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#spectral-profiler`;
const SPECTRAL_PROFILER_SETTINGS_STYLING_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#spectral-profiler`;
const SPECTRAL_PROFILER_SETTINGS_SMOOTHING_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#profile-smoothing`;
const SPECTRAL_PROFILER_SETTINGS_MOMENTS_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#moment-map-generator`;
const SPECTRAL_PROFILER_SETTINGS_FITTING_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#profile-fitting`;
const STATS_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#statistics-widget`;
const STOKES_ANALYSIS_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#stokes-analysis-widget`;
const STOKES_ANALYSIS_SETTINGS_CONVERSION_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#stokes-analysis-widget`;
const STOKES_ANALYSIS_SETTINGS_LINE_PLOT_STYLING_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#stokes-analysis-widget`;
const STOKES_ANALYSIS_SETTINGS_SCATTER_PLOT_STYLING_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#stokes-analysis-widget`;
const STOKES_ANALYSIS_SETTINGS_SMOOTHING_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#profile-smoothing`;
const CATALOG_OVERLAY_HELP_CONTENT_URL = `${url_prefix}/catalogue_visualization.html#catalog-image-overlay`;
const CATALOG_HISTOGRAM_PLOT_HELP_CONTENT_URL = `${url_prefix}/catalogue_visualization.html#catalog-histogram-plot`;
const CATALOG_SCATTER_PLOT_HELP_CONTENT_URL = `${url_prefix}/catalogue_visualization.html#catalog-2d-scatter-plot`;
const CATALOG_SETTINGS_COLOR_HELP_CONTENT_URL = `${url_prefix}/catalogue_visualization.html#catalog-image-overlay`;
const CATALOG_SETTINGS_SIZE_HELP_CONTENT_URL = `${url_prefix}/catalogue_visualization.html#catalog-image-overlay`;
const CATALOG_SETTINGS_ORIENTATION_HELP_CONTENT_URL = `${url_prefix}/catalogue_visualization.html#catalog-image-overlay`;
const SPECTRAL_LINE_QUERY_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#spectral-line-query`;
const PV_GENERATOR_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#position-velocity-pv-generator`;
const CURSOR_INFO_HELP_CONTENT_URL = `${url_prefix}/analysis_tools.html#cursor-info-widget`;

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
    [HelpType.CURSOR_INFO, CURSOR_INFO_HELP_CONTENT_URL]
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
                    <iframe
                        src={HELP_CONTENT_MAP.get(helpStore.type) ?? ""}
                        loading="eager"
                        sandbox="allow-scripts allow-same-origin"
                        referrerPolicy="same-origin"
                        allow="camera 'none'; microphone 'none'; geolocation 'none'"
                        title={helpStore.type ?? ""}
                    ></iframe>
                </div>
            </Drawer>
        );
    }
}
