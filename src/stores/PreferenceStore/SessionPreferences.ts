import {CARTA} from "carta-protobuf";
import tinycolor from "tinycolor2";

import {FrameScaling, ImagePanelMode, PasteOffsetUnit, PreferenceKeys, RestFrameShiftMode, VelocityConvention} from "enums";
// Import from the modules, not from "utilities". Its color module imports the stores, which import this module.
import {COLOR_MAPS_ALL, SUPPORTED_AUTO_COLORS_REGEX} from "utilities/color/constants";
import {isSupportedFrameScaling} from "utilities/scaling/scaling";

import {type PreferenceStore} from "./PreferenceStore";

/** How a preference that a workspace saves is named, read and checked. */
interface SessionPreference {
    /** How the Preferences dialog names the preference when the session uses the value of a workspace. */
    label: string;
    /** Returns the value in effect, as the getter of the preference gives it. */
    valueOf: (preferences: PreferenceStore) => unknown;
    /** Returns whether a saved value can be applied. A value must also pass the preferences schema when the schema has the key. */
    isValid?: (value: unknown) => boolean;
}

/** The name of the custom colormap, as RenderConfigStore.COLOR_MAPS_CUSTOM. That store imports the stores, which import this module. */
const CUSTOM_COLORMAP = "custom";

function isBoolean(value: unknown): boolean {
    return typeof value === "boolean";
}

function isColor(value: unknown): boolean {
    return typeof value === "string" && tinycolor(value).isValid();
}

function isColorOrAutoColor(value: unknown): boolean {
    return typeof value === "string" && (SUPPORTED_AUTO_COLORS_REGEX.test(value) || tinycolor(value).isValid());
}

function isColormap(value: unknown): boolean {
    return typeof value === "string" && COLOR_MAPS_ALL.includes(value);
}

function isOneOf(values: readonly unknown[]): (value: unknown) => boolean {
    return value => values.includes(value);
}

/**
 * The preferences that change what the user makes next, such as the style of a new region or the
 * render settings of a new image. A workspace saves the values in effect, and a restore applies
 * them for the session only. Then a workspace gives the same results on any machine. The other
 * preferences belong to the machine or the user, such as the theme, the tile caches or the folders
 * of the file browser.
 */
export const SESSION_PREFERENCES: Partial<Record<PreferenceKeys, SessionPreference>> = {
    [PreferenceKeys.GLOBAL_ZOOM_MODE]: {label: "Global: initial zoom level", valueOf: p => p.zoomMode},
    [PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING]: {label: "Global: WCS matching on append", valueOf: p => p.autoWCSMatching},
    [PreferenceKeys.GLOBAL_TRANSPARENT_IMAGE_BACKGROUND]: {label: "Global: transparent image background", valueOf: p => p.hasTransparentImageBackground},
    [PreferenceKeys.SILENT_PV_AXES_ORDER_REVERSE]: {label: "PV Generator: reverse the axes", valueOf: p => p.isPVAxesOrderReverse},
    [PreferenceKeys.SILENT_IMAGE_VIEW_REST_FRAME_SHIFT_MODE]: {label: "Image List: rest frame shift mode", valueOf: p => p.imageViewRestFrameShiftMode, isValid: isOneOf(Object.values(RestFrameShiftMode))},
    [PreferenceKeys.SILENT_IMAGE_VIEW_REST_FRAME_VELOCITY_CONVENTION]: {
        label: "Image List: rest frame velocity convention",
        valueOf: p => p.imageViewRestFrameVelocityConvention,
        isValid: isOneOf(Object.values(VelocityConvention))
    },
    [PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_SHIFT_MODE]: {
        label: "Spectral Profiler: rest frame shift mode",
        valueOf: p => p.spectralProfilerRestFrameShiftMode,
        isValid: isOneOf(Object.values(RestFrameShiftMode))
    },
    [PreferenceKeys.SILENT_SPECTRAL_PROFILER_REST_FRAME_VELOCITY_CONVENTION]: {
        label: "Spectral Profiler: rest frame velocity convention",
        valueOf: p => p.spectralProfilerRestFrameVelocityConvention,
        isValid: isOneOf(Object.values(VelocityConvention))
    },

    [PreferenceKeys.RENDER_CONFIG_SCALING]: {label: "Render: default scaling", valueOf: p => p.scaling, isValid: value => isSupportedFrameScaling(value as FrameScaling)},
    // The Preferences dialog also offers the custom colormap of one color for new images.
    [PreferenceKeys.RENDER_CONFIG_COLORMAP]: {label: "Render: default colormap", valueOf: p => p.colormap, isValid: value => isColormap(value) || value === CUSTOM_COLORMAP},
    [PreferenceKeys.RENDER_CONFIG_COLORMAP_INVERTED]: {label: "Render: invert the colormap", valueOf: p => p.isColormapInverted, isValid: isBoolean},
    [PreferenceKeys.RENDER_CONFIG_COLORMAP_HEX]: {label: "Render: color of a custom colormap", valueOf: p => p.colormapHex, isValid: isColor},
    [PreferenceKeys.RENDER_CONFIG_COLORMAP_HEX_START]: {label: "Render: start color of a custom colormap", valueOf: p => p.colormapHexStart, isValid: isColor},
    [PreferenceKeys.RENDER_CONFIG_PERCENTILE]: {label: "Render: default percentile ranks", valueOf: p => p.percentile},
    // Save the value in effect of each scaling, so that an old preference of one alpha for log and power is not needed.
    [PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA_LOG]: {label: "Render: alpha of log scaling", valueOf: p => p.getScalingParameter(FrameScaling.LOG)},
    [PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA_POWER]: {label: "Render: alpha of power scaling", valueOf: p => p.getScalingParameter(FrameScaling.POWER)},
    [PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA_SINH]: {label: "Render: alpha of sinh scaling", valueOf: p => p.getScalingParameter(FrameScaling.SINH)},
    [PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA_ASINH]: {label: "Render: alpha of asinh scaling", valueOf: p => p.getScalingParameter(FrameScaling.ASINH)},
    [PreferenceKeys.RENDER_CONFIG_SCALING_GAMMA]: {label: "Render: gamma", valueOf: p => p.getScalingParameter(FrameScaling.GAMMA)},
    [PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX]: {label: "Render: NaN color", valueOf: p => p.nanColorHex, isValid: isColor},
    [PreferenceKeys.RENDER_CONFIG_USE_SMOOTHED_BIAS_CONTRAST]: {label: "Render: smoothed bias and contrast", valueOf: p => p.shouldUseSmoothedBiasContrast},

    [PreferenceKeys.CONTOUR_CONFIG_GENERATOR_TYPE]: {label: "Contour: generator type", valueOf: p => p.contourGeneratorType},
    [PreferenceKeys.CONTOUR_CONFIG_SMOOTHING_MODE]: {label: "Contour: smoothing mode", valueOf: p => p.contourSmoothingMode, isValid: isOneOf(Object.values(CARTA.SmoothingMode))},
    [PreferenceKeys.CONTOUR_CONFIG_SMOOTHING_FACTOR]: {label: "Contour: smoothing factor", valueOf: p => p.contourSmoothingFactor},
    [PreferenceKeys.CONTOUR_CONFIG_NUM_LEVELS]: {label: "Contour: number of levels", valueOf: p => p.contourNumLevels},
    [PreferenceKeys.CONTOUR_CONFIG_THICKNESS]: {label: "Contour: thickness", valueOf: p => p.contourThickness},
    [PreferenceKeys.CONTOUR_CONFIG_COLORMAP_ENABLED]: {label: "Contour: color by colormap", valueOf: p => p.isContourColormapEnabled},
    [PreferenceKeys.CONTOUR_CONFIG_COLORMAP_INVERTED]: {label: "Contour: invert the colormap", valueOf: p => p.isContourColormapInverted, isValid: isBoolean},
    [PreferenceKeys.CONTOUR_CONFIG_COLOR]: {label: "Contour: color", valueOf: p => p.contourColor, isValid: isColor},
    [PreferenceKeys.CONTOUR_CONFIG_COLORMAP]: {label: "Contour: colormap", valueOf: p => p.contourColormap, isValid: isColormap},
    [PreferenceKeys.PERFORMANCE_CONTOUR_DECIMATION]: {label: "Performance: contour rounding factor", valueOf: p => p.contourDecimation},
    [PreferenceKeys.PERFORMANCE_CONTOUR_CONTROL_MAP_WIDTH]: {label: "Performance: contour control map resolution", valueOf: p => p.contourControlMapWidth, isValid: isOneOf([128, 256, 512, 1024])},

    [PreferenceKeys.VECTOR_OVERLAY_PIXEL_AVERAGING]: {label: "Vector overlay: pixel averaging", valueOf: p => p.vectorOverlayPixelAveraging},
    [PreferenceKeys.VECTOR_OVERLAY_FRACTIONAL_INTENSITY]: {label: "Vector overlay: fractional intensity", valueOf: p => p.isVectorOverlayFractionalIntensity},
    [PreferenceKeys.VECTOR_OVERLAY_THICKNESS]: {label: "Vector overlay: thickness", valueOf: p => p.vectorOverlayThickness},
    [PreferenceKeys.VECTOR_OVERLAY_COLORMAP_ENABLED]: {label: "Vector overlay: color by colormap", valueOf: p => p.isVectorOverlayColormapEnabled},
    [PreferenceKeys.VECTOR_OVERLAY_COLORMAP_INVERTED]: {label: "Vector overlay: invert the colormap", valueOf: p => p.isVectorOverlayColormapInverted, isValid: isBoolean},
    [PreferenceKeys.VECTOR_OVERLAY_COLOR]: {label: "Vector overlay: color", valueOf: p => p.vectorOverlayColor, isValid: isColor},
    [PreferenceKeys.VECTOR_OVERLAY_COLORMAP]: {label: "Vector overlay: colormap", valueOf: p => p.vectorOverlayColormap, isValid: isColormap},

    [PreferenceKeys.WCS_OVERLAY_AST_COLOR]: {label: "WCS overlay: color", valueOf: p => p.astColor, isValid: isColorOrAutoColor},
    [PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE]: {label: "WCS overlay: show the grid", valueOf: p => p.isAstGridVisible},
    [PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE]: {label: "WCS overlay: show the labels", valueOf: p => p.isAstLabelsVisible},
    [PreferenceKeys.WCS_OVERLAY_WCS_TYPE]: {label: "WCS overlay: WCS format", valueOf: p => p.wcsType},
    [PreferenceKeys.WCS_OVERLAY_COLORBAR_VISIBLE]: {label: "Colorbar: show the colorbar", valueOf: p => p.isColorbarVisible},
    [PreferenceKeys.WCS_OVERLAY_COLORBAR_INTERACTIVE]: {label: "Colorbar: interactive", valueOf: p => p.isColorbarInteractive},
    [PreferenceKeys.WCS_OVERLAY_COLORBAR_POSITION]: {label: "Colorbar: position", valueOf: p => p.colorbarPosition},
    [PreferenceKeys.WCS_OVERLAY_COLORBAR_WIDTH]: {label: "Colorbar: width", valueOf: p => p.colorbarWidth},
    [PreferenceKeys.WCS_OVERLAY_COLORBAR_TICKS_DENSITY]: {label: "Colorbar: ticks density", valueOf: p => p.colorbarTicksDensity},
    [PreferenceKeys.WCS_OVERLAY_COLORBAR_LABEL_VISIBLE]: {label: "Colorbar: show the label", valueOf: p => p.isColorbarLabelVisible},
    [PreferenceKeys.WCS_OVERLAY_BEAM_VISIBLE]: {label: "Beam: show the beam", valueOf: p => p.isBeamVisible},
    [PreferenceKeys.WCS_OVERLAY_BEAM_COLOR]: {label: "Beam: color", valueOf: p => p.beamColor, isValid: isColorOrAutoColor},
    [PreferenceKeys.WCS_OVERLAY_BEAM_TYPE]: {label: "Beam: type", valueOf: p => p.beamType},
    [PreferenceKeys.WCS_OVERLAY_BEAM_WIDTH]: {label: "Beam: width", valueOf: p => p.beamWidth},
    [PreferenceKeys.WCS_OVERLAY_CURSOR_INFO]: {label: "Image view: cursor info", valueOf: p => p.cursorInfoVisible},
    [PreferenceKeys.PIXEL_GRID_VISIBLE]: {label: "Image view: show the pixel grid", valueOf: p => p.isPixelGridVisible},
    [PreferenceKeys.PIXEL_GRID_COLOR]: {label: "Image view: pixel grid color", valueOf: p => p.pixelGridColor, isValid: isColorOrAutoColor},
    [PreferenceKeys.IMAGE_MULTI_PANEL_ENABLED]: {label: "Image view: multi-panel", valueOf: p => p.isImageMultiPanelEnabled},
    [PreferenceKeys.IMAGE_PANEL_MODE]: {label: "Image view: panel mode", valueOf: p => p.imagePanelMode, isValid: isOneOf([ImagePanelMode.Dynamic, ImagePanelMode.Fixed])},
    [PreferenceKeys.IMAGE_PANEL_COLUMNS]: {label: "Image view: panel columns", valueOf: p => p.imagePanelColumns, isValid: value => Number.isInteger(value)},
    [PreferenceKeys.IMAGE_PANEL_ROWS]: {label: "Image view: panel rows", valueOf: p => p.imagePanelRows, isValid: value => Number.isInteger(value)},

    [PreferenceKeys.REGION_COLOR]: {label: "Region: color", valueOf: p => p.regionColor, isValid: isColor},
    [PreferenceKeys.REGION_LINE_WIDTH]: {label: "Region: line width", valueOf: p => p.regionLineWidth},
    [PreferenceKeys.REGION_DASH_LENGTH]: {label: "Region: dash length", valueOf: p => p.regionDashLength},
    [PreferenceKeys.REGION_TYPE]: {label: "Region: type", valueOf: p => p.regionType},
    [PreferenceKeys.REGION_CREATION_MODE]: {label: "Region: creation mode", valueOf: p => p.regionCreationMode},
    [PreferenceKeys.REGION_SIZE]: {label: "Region: size", valueOf: p => p.regionSize},
    [PreferenceKeys.REGION_PASTE_OFFSET_UNIT]: {label: "Region: paste offset unit", valueOf: p => p.regionPasteOffsetUnit, isValid: isOneOf(Object.values(PasteOffsetUnit))},
    [PreferenceKeys.ANNOTATION_COLOR]: {label: "Annotation: color", valueOf: p => p.annotationColor, isValid: isColor},
    [PreferenceKeys.ANNOTATION_LINE_WIDTH]: {label: "Annotation: line width", valueOf: p => p.annotationLineWidth},
    [PreferenceKeys.ANNOTATION_DASH_LENGTH]: {label: "Annotation: dash length", valueOf: p => p.annotationDashLength},
    [PreferenceKeys.POINT_ANNOTATION_SHAPE]: {label: "Annotation: point shape", valueOf: p => p.pointAnnotationShape},
    [PreferenceKeys.POINT_ANNOTATION_WIDTH]: {label: "Annotation: point width", valueOf: p => p.pointAnnotationWidth},
    [PreferenceKeys.TEXT_ANNOTATION_LINE_WIDTH]: {label: "Annotation: text line width", valueOf: p => p.textAnnotationLineWidth},

    [PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE]: {label: "Catalog: displayed columns", valueOf: p => p.catalogDisplayedColumnSize},
    [PreferenceKeys.CATALOG_AUTO_SELECT_IMAGE_OVERLAY_COLUMNS]: {label: "Catalog: select the image overlay columns", valueOf: p => p.shouldAutoSelectImageOverlayCoordinateColumns, isValid: isBoolean},

    [PreferenceKeys.COMPATIBILITY_AIPS_BEAM_SUPPORT]: {label: "Compatibility: AIPS beam support", valueOf: p => p.hasAipsBeamSupport}
};

/** The keys of {@link SESSION_PREFERENCES}. */
export const SESSION_PREFERENCE_KEYS = Object.keys(SESSION_PREFERENCES) as PreferenceKeys[];
