export enum PreferenceKeys {
    SILENT_FILE_SORTING_STRING = "fileSortingString",
    SILENT_FILE_FILTERING_TYPE = "fileFilteringType",
    SILENT_PV_AXES_ORDER_REVERSE = "pvAxesOrderReverse",

    GLOBAL_THEME = "theme",
    GLOBAL_AUTOLAUNCH = "autoLaunch",
    GLOBAL_FILE_FILTER_MODE = "fileFilterMode",
    GLOBAL_CURSOR_POSITION = "cursorPosition",
    GLOBAL_ZOOM_MODE = "zoomMode",
    GLOBAL_ZOOM_POINT = "zoomPoint",
    GLOBAL_DRAG_PANNING = "dragPanning",
    GLOBAL_SPECTRAL_MATCHING_TYPE = "spectralMatchingType",
    GLOBAL_AUTO_WCS_MATCHING = "autoWCSMatching",
    GLOBAL_TRANSPARENT_IMAGE_BACKGROUND = "transparentImageBackground",
    GLOBAL_CODE_SNIPPETS_ENABLED = "codeSnippetsEnabled",
    GLOBAL_KEEP_LAST_USED_FOLDER = "keepLastUsedFolder",
    GLOBAL_SAVED_LAST_FOLDER = "lastUsedFolder",

    RENDER_CONFIG_SCALING = "scaling",
    RENDER_CONFIG_COLORMAP = "colormap",
    RENDER_CONFIG_COLORMAP_HEX = "colormapHex",
    RENDER_CONFIG_COLORMAP_HEX_START = "colormapHexStart",
    RENDER_CONFIG_PERCENTILE = "percentile",
    RENDER_CONFIG_SCALING_ALPHA = "scalingAlpha",
    RENDER_CONFIG_SCALING_GAMMA = "scalingGamma",
    RENDER_CONFIG_NAN_COLOR_HEX = "nanColorHex",
    RENDER_CONFIG_NAN_ALPHA = "nanAlpha",
    RENDER_CONFIG_USE_SMOOTHED_BIAS_CONTRAST = "useSmoothedBiasContrast",

    CONTOUR_CONFIG_GENERATOR_TYPE = "contourGeneratorType",
    CONTOUR_CONFIG_SMOOTHING_MODE = "contourSmoothingMode",
    CONTOUR_CONFIG_SMOOTHING_FACTOR = "contourSmoothingFactor",
    CONTOUR_CONFIG_NUM_LEVELS = "contourNumLevels",
    CONTOUR_CONFIG_THICKNESS = "contourThickness",
    CONTOUR_CONFIG_COLORMAP_ENABLED = "contourColormapEnabled",
    CONTOUR_CONFIG_COLOR = "contourColor",
    CONTOUR_CONFIG_COLORMAP = "contourColormap",

    VECTOR_OVERLAY_PIXEL_AVERAGING = "vectorOverlayPixelAveraging",
    VECTOR_OVERLAY_FRACTIONAL_INTENSITY = "vectorOverlayFractionalIntensity",
    VECTOR_OVERLAY_THICKNESS = "vectorOverlayThickness",
    VECTOR_OVERLAY_COLORMAP_ENABLED = "vectorOverlayColormapEnabled",
    VECTOR_OVERLAY_COLOR = "vectorOverlayColor",
    VECTOR_OVERLAY_COLORMAP = "vectorOverlayColormap",

    WCS_OVERLAY_AST_COLOR = "astColor",
    WCS_OVERLAY_AST_GRID_VISIBLE = "astGridVisible",
    WCS_OVERLAY_AST_LABELS_VISIBLE = "astLabelsVisible",
    WCS_OVERLAY_WCS_TYPE = "wcsType",
    WCS_OVERLAY_COLORBAR_VISIBLE = "colorbarVisible",
    WCS_OVERLAY_COLORBAR_INTERACTIVE = "colorbarInteractive",
    WCS_OVERLAY_COLORBAR_POSITION = "colorbarPosition",
    WCS_OVERLAY_COLORBAR_WIDTH = "colorbarWidth",
    WCS_OVERLAY_COLORBAR_TICKS_DENSITY = "colorbarTicksDensity",
    WCS_OVERLAY_COLORBAR_LABEL_VISIBLE = "colorbarLabelVisible",
    WCS_OVERLAY_BEAM_VISIBLE = "beamVisible",
    WCS_OVERLAY_BEAM_COLOR = "beamColor",
    WCS_OVERLAY_BEAM_TYPE = "beamType",
    WCS_OVERLAY_BEAM_WIDTH = "beamWidth",
    WCS_OVERLAY_CURSOR_INFO = "cursorInfoVisible",

    LAYOUT = "layout",
    LAYOUT_DYNAMIC_LAYOUT_ENABLE = "dynamicLayoutEnable",
    LAYOUT_IS_HIGH_DIM_PRIORITY = "isHighDimPriority",
    LAYOUT_DYNAMIC_LAYOUT = "dynamicLayout",

    REGION_COLOR = "regionColor",
    REGION_LINE_WIDTH = "regionLineWidth",
    REGION_DASH_LENGTH = "regionDashLength",
    REGION_TYPE = "regionType",
    REGION_CREATION_MODE = "regionCreationMode",
    REGION_SIZE = "regionSize",

    ANNOTATION_COLOR = "annotationColor",
    ANNOTATION_LINE_WIDTH = "annotationLineWidth",
    ANNOTATION_DASH_LENGTH = "annotationDashLength",
    POINT_ANNOTATION_SHAPE = "pointAnnotationShape",
    POINT_ANNOTATION_WIDTH = "pointAnnotationWidth",
    TEXT_ANNOTATION_LINE_WIDTH = "textAnnotationLineWidth",

    PERFORMANCE_IMAGE_COMPRESSION_QUALITY = "imageCompressionQuality",
    PERFORMANCE_ANIMATION_COMPRESSION_QUALITY = "animationCompressionQuality",
    PERFORMANCE_GPU_TILE_CACHE = "GPUTileCache",
    PERFORMANCE_SYSTEM_TILE_CACHE = "systemTileCache",
    PERFORMANCE_CONTOUR_DECIMATION = "contourDecimation",
    PERFORMANCE_CONTOUR_COMPRESSION_LEVEL = "contourCompressionLevel",
    PERFORMANCE_CONTOUR_CHUNK_SIZE = "contourChunkSize",
    PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH = "contourControlMapWidth",
    PERFORMANCE_STREAM_CONTOURS_WHILE_ZOOMING = "streamContoursWhileZooming",
    PERFORMANCE_LOW_BAND_WIDTH_MODE = "lowBandwidthMode",
    PERFORMANCE_STOP_ANIMATION_PLAYBACK_MINUTES = "stopAnimationPlaybackMinutes",
    PERFORMANCE_LIMIT_OVERLAY_REDRAW = "limitOverlayRedraw",
    PERFORMANCE_PV_PREVIEW_CUBE_SIZE_LIMIT = "pvPreviewCubeSizeLimit",
    PERFORMANCE_PV_PREVIEW_CUBE_SIZE_LIMIT_UNIT = "pvPreviewCubeSizeLimitUnit",

    LOG_EVENT = "logEventList",

    CATALOG_DISPLAYED_COLUMN_SIZE = "catalogDisplayedColumnSize",
    CATALOG_TABLE_SEPARATOR_POSITION = "catalogTableSeparatorPosition",
    CATALOG_AUTO_SELECT_IMAGE_OVERLAY_COLUMNS = "catalogAutoSelectImageOverlayColumns",

    PIXEL_GRID_VISIBLE = "pixelGridVisible",
    PIXEL_GRID_COLOR = "pixelGridColor",
    IMAGE_MULTI_PANEL_ENABLED = "imageMultiPanelEnabled",
    IMAGE_PANEL_MODE = "imagePanelMode",
    IMAGE_PANEL_COLUMNS = "imagePanelColumns",
    IMAGE_PANEL_ROWS = "imagePanelRows",

    STATS_PANEL_ENABLED = "statsPanelEnabled",
    STATS_PANEL_MODE = "statsPanelMode",

    TELEMETRY_UUID = "telemetryUuid",
    TELEMETRY_MODE = "telemetryMode",
    TELEMETRY_CONSENT_SHOWN = "telemetryConsentShown",
    TELEMETRY_LOGGING = "telemetryLogging",

    CHECK_NEW_RELEASE = "checkNewRelease",
    LATEST_RELEASE = "latestRelease",

    COMPATIBILITY_AIPS_BEAM_SUPPORT = "compatibilityAipsBeamSupport"
}

export enum CursorInfoVisibility {
    Always = "always",
    Never = "never",
    ActiveImage = "activeImage",
    HideTiled = "hideTiled"
}

export enum FileFilterMode {
    Content = "content",
    Extension = "extension",
    All = "all"
}
