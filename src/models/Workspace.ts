import type {RgbaColor} from "@uiw/react-color";
import {type CARTA} from "carta-protobuf";

import {
    type AngularSizeUnit,
    type AnimationMode,
    type BeamType,
    type CatalogDatabase,
    type CatalogDisplayMode,
    type CatalogOverlayShape,
    type CatalogPlotType,
    type CatalogSizeUnits,
    type CatalogSourceRadiusMode,
    type CatalogSystemType,
    type ContourDashMode,
    type CoordinateMode,
    type FittingContinuum,
    type FittingFunction,
    FrameScaling,
    type HipsCoord,
    type HipsProjection,
    type ImageViewLayer,
    type MultiProfileCategory,
    type NumberFormatType,
    type NumericInputType,
    type PlayMode,
    type RadiusUnits,
    type RedshiftType,
    type RegionMode,
    type RegionOpacity,
    type RestFrameShiftMode,
    type SkyRefIs,
    type SpectralLineQueryRangeType,
    type SpectralLineQueryUnit,
    type SpectralSystem,
    type SpectralType,
    type VectorOverlaySource,
    type VelocityConvention,
    type WorkspaceIssueEffect,
    type WorkspaceIssueOutcome,
    type WorkspaceItemKind
} from "enums";
import {sanitizeScalingParameter, type ScalingParameters} from "utilities/scaling/scaling";

import {type Point2D} from "./Point2D/Point2D";
import {type WidgetWorkspaceConfig} from "./Widget/WidgetWorkspaceConfig";

/** The version written by this frontend, matching `workspace_schema_2.json`. */
export const WORKSPACE_VERSION = 2;

export interface WorkspaceRenderConfig {
    scaling?: FrameScaling;
    colorMap?: string;
    customColormapHexEnd?: string;
    customColormapHexStart?: string;
    bias?: number;
    contrast?: number;
    gamma?: number;
    alphaLog?: number;
    alphaPower?: number;
    alphaSinh?: number;
    alphaAsinh?: number;
    inverted?: boolean;
    useCubeHistogram?: boolean;
    useCubeHistogramContours?: boolean;
    selectedPercentile?: number[];
    scaleMin?: number[];
    scaleMax?: number[];
    visible?: boolean;
}

export interface WorkspaceContourConfig {
    levels: number[];
    smoothingMode: CARTA.SmoothingMode;
    smoothingFactor: number;
    color?: RgbaColor;
    colormapEnabled: boolean;
    colormapInverted?: boolean;
    colormap?: string;
    colormapContrast: number;
    colormapBias: number;
    dashMode: ContourDashMode;
    thickness: number;
    visible: boolean;
}

export interface WorkspaceVectorOverlayConfig {
    angularSource: VectorOverlaySource;
    intensitySource: VectorOverlaySource;
    fractionalIntensity: boolean;
    pixelAveraging: number;
    thresholdEnabled: boolean;
    threshold: number;
    debiasing: boolean;
    qError: number;
    uError: number;
    thresholdOption: CARTA.PolarizationType.I | CARTA.PolarizationType.Plinear;

    visible: boolean;
    thickness: number;
    colormapEnabled: boolean;
    colormapInverted?: boolean;
    color?: RgbaColor;
    colormap?: string;
    colormapContrast: number;
    colormapBias: number;
    lengthMin: number;
    lengthMax: number;
    intensityMin: number | undefined;
    intensityMax: number | undefined;
    rotationOffset: number;
}

/** What every mapped catalog axis holds: the column it maps, its clipped range, and its scaling. */
export interface WorkspaceCatalogAxisConfig {
    mapColumn?: string;
    /** Lower end of the mapped data range, as clipped by the user. Absent while it follows the data. */
    columnMinClip?: number;
    /** Upper end of the mapped data range, as clipped by the user. Absent while it follows the data. */
    columnMaxClip?: number;
    scalingType?: FrameScaling;
    scalingParameters?: ScalingParameters;
}

/** One catalog size axis: the major axis, or the minor axis of an ellipse. */
export interface WorkspaceCatalogSizeAxisConfig extends WorkspaceCatalogAxisConfig {
    min?: {area: number; diameter: number};
    max?: {area: number; diameter: number};
    areaMode?: boolean;
    /** Whether the other size axis follows this axis at the lower end. */
    columnMinLocked?: boolean;
    /** Whether the other size axis follows this axis at the upper end. */
    columnMaxLocked?: boolean;
}

export interface WorkspaceCatalogColorAxisConfig extends WorkspaceCatalogAxisConfig {
    colorMap?: string;
    inverted?: boolean;
}

export interface WorkspaceCatalogOrientationAxisConfig extends WorkspaceCatalogAxisConfig {
    /** Lower end of the angle range the mapped data is spread over, in degrees. */
    angleMin?: number;
    /** Upper end of the angle range the mapped data is spread over, in degrees. */
    angleMax?: number;
}

/** The overlay a catalog actually has drawn over its image, which the widget's current plot controls
 * can be changed away from without taking it down. */
export interface WorkspaceCatalogImageOverlay {
    xAxis: string;
    yAxis: string;
    system: CatalogSystemType;
    /** The row limit the overlay was drawn under. Fewer rows may have reached the image, since one whose position columns cannot be read is dropped. */
    maxRows?: number;
}

/** Per-column table state that is independent of whether the column is displayed. */
export interface WorkspaceCatalogColumnConfig {
    filter?: string;
    width?: number;
}

export interface WorkspaceCatalogSortingConfig {
    columnName: string;
    sortingType: CARTA.SortingType;
}

/** How far a catalog table is scrolled, in pixels from its top left. */
export interface WorkspaceCatalogScrollPosition {
    left: number;
    top: number;
}

/**
 * Which rows and columns a catalog holds, and how its table shows them. Owned by the catalog's
 * profile store, which is what the table and the query behind it belong to.
 */
export interface WorkspaceCatalogTableConfig {
    /** Names of catalog columns currently shown in the table. */
    displayedColumns?: string[];
    /** Maximum number of rows requested for the catalog table and image overlay. */
    maxRows?: number;
    /**
     * How many rows of the table's query a file catalog had loaded, by scrolling its table or
     * plotting it, which its plots are drawn from. An online catalog holds all of its rows.
     */
    loadedRows?: number;
    /** Where the table was scrolled to. */
    scrollPosition?: WorkspaceCatalogScrollPosition;
    /** User-entered filters and widths, keyed by catalog column name. */
    columnSettings?: {[columnName: string]: WorkspaceCatalogColumnConfig};
    sorting?: WorkspaceCatalogSortingConfig;
}

/**
 * How one catalog is drawn. Holds only what the user authored: the state a widget keeps for its
 * own presentation, and the values recomputed from the catalog data, are deliberately absent.
 * Which rows the catalog holds is not part of this; that is {@link WorkspaceCatalogTableConfig}.
 */
export interface WorkspaceCatalogConfig {
    /** The size tab of the catalog settings, when it is the minor axis of an ellipse. Left out for the major axis. */
    sizeAxisTab?: "minor";
    color?: string;
    highlightColor?: string;
    shape?: CatalogOverlayShape;
    /** Source size in the current size unit, as entered by the user. */
    size?: number;
    thickness?: number;
    displayMode?: CatalogDisplayMode;
    canvasSizeUnit?: CatalogSizeUnits;
    worldSizeUnit?: AngularSizeUnit;
    /** Whether an authored angular size is the source's radius or its full diameter. */
    sourceRadiusType?: CatalogSourceRadiusMode;
    plotType?: CatalogPlotType;
    xAxis?: string;
    yAxis?: string;
    imageOverlay?: WorkspaceCatalogImageOverlay;
    sizeAxis?: WorkspaceCatalogSizeAxisConfig;
    sizeMinorAxis?: WorkspaceCatalogSizeAxisConfig;
    colorAxis?: WorkspaceCatalogColorAxisConfig;
    orientationAxis?: WorkspaceCatalogOrientationAxisConfig;
}

export interface WorkspaceRegion {
    id: number;
    points: Point2D[];
    rotation: number;
    type: CARTA.RegionType;
    name?: string;
    color?: string;
    lineWidth?: number;
    dashes?: number[];
    locked?: boolean;
    annotationStyles?: any;
    /** The width in pixels that a spatial profile along a line or polyline region samples. */
    lineRegionSampleWidth?: number;
    /** Whether the Region dialog shows the region in image or world coordinates. */
    coordinate?: CoordinateMode;
    /** The opacity of the region: `SemiTransparent` (0.5) or `Invisible` (0). Left out when the region is `Visible` (1). */
    opacity?: RegionOpacity;
}

export interface WorkspaceColorBlending {
    imageListIndex: number;
    selectedFrameId: number[];
    alpha: number[];
    /** Whether the blended raster image, the contours and the vector overlays are shown. Left out when they are shown. */
    rasterVisible?: boolean;
    contourVisible?: boolean;
    vectorOverlayVisible?: boolean;
    /** The custom title of the color-blended image. Left out when it is the default title. */
    titleCustomText?: string;
}

/**
 * The custom texts of the WCS overlay that are the same for every image, and the switches that show
 * the custom texts. Each image saves its own custom title and colorbar label. The layout copy of
 * the workspace saves the other overlay settings with the image view, because those settings do not
 * depend on any image.
 */
export interface WorkspaceWcsOverlayText {
    labels: {hasCustomText: boolean; customLabelX: string; customLabelY: string};
    title: {hasCustomText: boolean};
    colorbar: {hasLabelCustomText: boolean};
}

/** One of the images making up a hypercube. */
export interface WorkspaceStokesFile {
    directory?: string;
    filename: string;
    hdu?: string;
    polarizationType?: CARTA.PolarizationType;
}

export interface WorkspaceFileImageSource {
    type: "file";
    directory?: string;
    filename: string;
    hdu?: string;
}

export interface WorkspaceLelImageSource {
    type: "lel";
    directory?: string;
    expression: string;
}

export interface WorkspaceHypercubeImageSource {
    type: "hypercube";
    directory?: string;
    hdu?: string;
    stokesFiles: WorkspaceStokesFile[];
}

/** How an image is brought back. Images differ in how they are opened, not in how they are displayed. */
export type WorkspaceImageSource = WorkspaceFileImageSource | WorkspaceLelImageSource | WorkspaceHypercubeImageSource;

export interface WorkspaceFile {
    id: number;
    source?: WorkspaceImageSource;
    // Superseded by `source`, and only read from workspaces written before version 2.
    directory?: string;
    filename?: string;
    hdu?: string;
    timeSeriesMember?: boolean;
    /** The channels that the animator plays, as channel indices. Left out when it plays every channel. */
    animationChannelRange?: [number, number];
    references?: {
        spatial?: number;
        spectral?: number;
        raster?: number;
    };
    center?: Point2D;
    zoomLevel?: number;
    axisZoomLevel?: Point2D;
    zoomAxis?: "both" | "x" | "y";
    channel?: number;
    stokes?: number;
    /** The spectral coordinate of the spectral axis, and the secondary spectral coordinate, with the names that the spectral settings use. */
    spectralCoordinate?: string;
    spectralCoordinateSecondary?: string;
    /** The spectral system. {@link SpectralSystem.BARY} is saved as `"BARYCENT"`, and {@link SpectralSystem.TOPO} as `"TOPOCENT"`. */
    spectralSystem?: SpectralSystem;
    /** The intensity unit of the spectral profiles of the image. */
    intensityUnit?: string;
    /** The rest frequency that converts the spectral axis. Left out when it is the rest frequency in the header. */
    restFrequency?: {value: number; unit: string};
    /** The beam overlay settings of an image that has a beam. */
    beam?: {visible: boolean; color: string; type: BeamType; width: number; shiftX: number; shiftY: number};
    /** The offset coordinates, when they are shown. Saves the center in image pixels, and whether the center is the origin or the pole. */
    offsetCoordinates?: {center: Point2D; skyRefIs: SkyRefIs};
    /** The rest frame of the spectral axis, for an image that supports a rest frame. */
    restFrame?: {enabled: boolean; redshift: number; shiftMode: RestFrameShiftMode; velocityConvention: VelocityConvention};
    /**
     * The place of the image in the image list. The places count the images that the workspace does
     * not save, so only their order matters. Left out by a workspace saved before it kept the place.
     */
    imageListIndex?: number;
    /** The result of the last image fitting of the image. Left out when the image has no result. */
    fitResult?: WorkspaceImageFitResult;
    /** The custom title of the image in the WCS overlay. Left out when it is the default title, the file name. */
    titleCustomText?: string;
    /** The custom label of the colorbar of the image. Left out when it is the default label. */
    colorbarLabelCustomText?: string;

    renderConfig?: WorkspaceRenderConfig;
    contourConfig?: WorkspaceContourConfig;
    vectorOverlayConfig?: WorkspaceVectorOverlayConfig;
    /**
     * The contour settings of an image whose contours are off, such as a color that the user chose
     * before applying contours. Left out when they are the settings that a new image starts with.
     * It is not in `contourConfig`, because a workspace with `contourConfig` shows the contours.
     */
    unappliedContourConfig?: WorkspaceContourConfig;
    /** The vector overlay settings of an image whose vector overlay is off, as for `unappliedContourConfig`. */
    unappliedVectorOverlayConfig?: WorkspaceVectorOverlayConfig;
    regionsSet?: {
        selectedRegion?: number;
        /** The regions that were selected together, by their saved IDs. Left out when one region or none was selected. */
        selectedRegions?: number[];
        regions?: WorkspaceRegion[];
    };
}

/** A request for moment images. The request names its image and region by their workspace IDs. */
export interface WorkspaceMomentRequest {
    type: "moment";
    /** The image the moments are taken of. */
    sourceImageId: number;
    /** The region of the moments, by the ID that the region was saved with. When the moments are taken over the whole image, this is the fixed ID of the whole image. */
    regionId: number;
    /** The moments to make again. These are the moments whose images the session still showed. */
    moments: CARTA.Moment[];
    /** The channels the moments are taken over, as channel indices. */
    channelRange: {min: number; max: number};
    /** How the pixel range masks the cube. */
    mask: CARTA.MomentMask;
    pixelRange: {min: number; max: number};
}

/** A request for a PV image. The request names its image and cut by their workspace IDs. */
export interface WorkspacePvRequest {
    type: "pv";
    sourceImageId: number;
    /** The line or polyline region the cut follows, by the ID it was saved with. */
    regionId: number;
    /** How many pixels wide the cut is averaged over. */
    width: number;
    /** The channels that the PV image covers, as channel indices. Left out when the PV image covers all channels. */
    channelRange?: {min: number; max: number};
    /** Whether the position axis is drawn vertically. */
    reverse: boolean;
}

/** A HiPS query. It does not depend on any other data in the session. */
export interface WorkspaceHipsRequest {
    type: "hips";
    survey: string;
    width: number;
    height: number;
    /** The object that the image is centered on. When it is left out, `center` gives the center of the image. */
    object?: string;
    center?: Point2D;
    /** The field of view, in degrees. */
    fov: number;
    coordsys: HipsCoord;
    projection: HipsProjection;
    /** The rotation angle, in degrees. */
    rotationAngle: number;
}

/** A value of an initial guess of an image fitting. It is null when the backend generates the value. */
type WorkspaceFittingGuess = number | null;

/**
 * An image fitting that made a model image, a residual image or both. The request names its image
 * and region by their workspace IDs.
 */
export interface WorkspaceFittingRequest {
    type: "fitting";
    sourceImageId: number;
    /** The region of the fit, by the ID that the region was saved with. 0 is the field of view in `fov`, and -1 is the whole image. */
    regionId: number;
    /** The field of view that was fitted, as a rectangle in the pixels of the source image. */
    fov?: {center: Point2D; size: Point2D; rotation: number};
    /** The initial values of each component. */
    components: {center: {x: WorkspaceFittingGuess; y: WorkspaceFittingGuess}; amp: WorkspaceFittingGuess; fwhm: {x: WorkspaceFittingGuess; y: WorkspaceFittingGuess}; pa: WorkspaceFittingGuess}[];
    /** Whether each value is fixed: six values for each component, in the order center x, center y, amplitude, FWHM x, FWHM y and P.A., and then the background offset. */
    fixedParams: boolean[];
    /** The initial background offset. */
    offset: number;
    solver: CARTA.FittingSolverType;
}

export type WorkspaceGenerationRequest = WorkspaceMomentRequest | WorkspacePvRequest | WorkspaceHipsRequest | WorkspaceFittingRequest;

/** An image that a request made. It is saved like a file image, but without a source, because a restore makes it again instead of opening it. */
export interface WorkspaceGeneratedFile extends Omit<WorkspaceFile, "source" | "directory" | "filename" | "hdu"> {
    /** The name the image had when it was saved, for naming it to the user. */
    name?: string;
    /** For a moment image, the moment of the request that the image shows. */
    moment?: CARTA.Moment;
    /** For an image that an image fitting made, whether it is the model or the residual. */
    fittingImage?: "model" | "residual";
}

/**
 * One request that made images, and the images from it that the session still showed.
 *
 * The workspace records the request instead of the images. It records the request once, not once
 * per image, because one request for moments makes one image for each moment.
 */
export interface WorkspaceGeneratedImages {
    request: WorkspaceGenerationRequest;
    images: WorkspaceGeneratedFile[];
}

/** A short name for an image source, for showing to the user. */
export function describeImageSource(source: WorkspaceImageSource | undefined): string {
    switch (source?.type) {
        case "lel":
            return source.expression;
        case "hypercube":
            return source.stokesFiles.map(stokesFile => stokesFile.filename).join(", ");
        case "file":
            return source.filename;
        default:
            return "an image of an unknown kind";
    }
}

/** One file on disk an image source is made of. */
export interface WorkspaceFilePath {
    directory?: string;
    filename: string;
    hdu?: string;
}

/** The files an image source names, which a hypercube has more than one of and an expression none of. */
export function getWorkspaceFilePaths(source: WorkspaceImageSource | undefined): WorkspaceFilePath[] {
    switch (source?.type) {
        case "file":
            return [source];
        case "hypercube":
            return source.stokesFiles.map(stokesFile => ({directory: stokesFile.directory ?? source.directory, filename: stokesFile.filename, hdu: stokesFile.hdu}));
        default:
            return [];
    }
}

/** A short name for a catalog source, for showing to the user. */
export function describeCatalogSource(source: WorkspaceCatalogSource): string {
    if (source.type === "file") {
        return source.filename;
    }
    // Reads after "the catalog", as in "the catalog from the SIMBAD query".
    const service = source.type === "simbad" ? "SIMBAD" : "VizieR";
    const tableDescription = source.table ? ` for ${source.table}` : "";
    return `from the ${service} query${tableDescription}`;
}

export interface WorkspaceCatalogFileSource {
    type: "file";
    directory?: string;
    filename: string;
}

/** The parameters an online query is re-run from. The center is in degrees, so that it does not
 * depend on the image the query was originally centered on. */
export interface WorkspaceCatalogQuerySource {
    type: "simbad" | "vizier";
    center: Point2D;
    system: CatalogSystemType;
    radius: number;
    radiusUnits: RadiusUnits;
    maxObjects: number;
    /** VizieR only: the table this catalog came from. */
    table?: string;
    /** VizieR only: the keywords the table search was narrowed by. */
    keywords?: string;
}

export type WorkspaceCatalogSource = WorkspaceCatalogFileSource | WorkspaceCatalogQuerySource;

export interface WorkspaceCatalogSelection {
    columns: string[];
    rowHashes: string[];
    searchRows?: number;
    isShowingSelectedData?: boolean;
}

export interface WorkspaceCatalog {
    /** Stable identifier within this workspace, not the session's catalog file ID. */
    id: number;
    source: WorkspaceCatalogSource;
    coordinateSystem?: CatalogSystemType;
    associatedImageId?: number;
    rowCount?: number;
    /** Fingerprint of the rows an online catalog held, so that a re-run query can be told apart
     * from the one that was saved even when it returns the same number of rows. */
    contentHash?: string;
    tableConfig?: WorkspaceCatalogTableConfig;
    displayConfig?: WorkspaceCatalogConfig;
    selection?: WorkspaceCatalogSelection;
}

/** What one catalog table widget shows. */
export interface WorkspaceCatalogOverlayConfig {
    /** Workspace ID of the catalog the widget shows. */
    catalogId?: number;
    /** The settings tab that was open for each catalog, by Workspace catalog ID. */
    settingsTabs?: {[workspaceCatalogId: string]: number};
}

/** What one catalog plot widget shows, and the columns that it plots. */
export interface WorkspaceCatalogPlotConfig {
    /** Workspace ID of the catalog the widget shows. */
    catalogId?: number;
    xColumnName?: string;
    yColumnName?: string;
    statisticColumnName?: string;
    isLogScaleY?: boolean;
    nBinX?: number;
    /** Whether a linear fit is drawn. The fit itself is recomputed from the rows the plot shows. */
    isFittingEnabled?: boolean;
    /** The values the cursor last read off the plot: a scatter point, or a histogram bin's center and count. */
    cursor?: Point2D;
}

/** The image and region that a widget shows, by their IDs in the workspace. When the image is left out, the widget shows the active image. */
export interface WorkspaceWidgetBinding {
    /** The Workspace ID of the image that the widget shows. Left out when the widget shows the active image, or an image that the workspace does not save. */
    imageId?: number;
    /** The region that the widget shows, by the ID that the region was saved with. */
    regions?: {imageId?: number; regionId: number}[];
}

/** The zoom range of a line plot, in the units that the plot showed. An axis that was not zoomed is left out. */
export interface WorkspacePlotRange {
    minX?: number;
    maxX?: number;
    minY?: number;
    maxY?: number;
}

export interface WorkspaceRenderConfigWidgetConfig extends WorkspacePlotRange {
    /** Whether the Bias / Contrast section is open. Left out when it is closed. */
    biasContrastOpen?: boolean;
}

export interface WorkspaceSpatialProfileWidgetConfig extends WorkspaceWidgetBinding, WorkspacePlotRange {
    /** The Stokes of the profile, such as `"Q"`. Left out when the profile uses the current Stokes of the image. */
    stokes?: string;
}

export interface WorkspaceHistogramWidgetConfig extends WorkspaceWidgetBinding, WorkspacePlotRange {
    /** The Stokes of the histogram, such as `"Qz"`. `"z"` means the current Stokes of the image. */
    coordinate?: string;
    /** The pixel value bounds of the histogram. Left out when the histogram uses the bounds of the image. */
    pixelBounds?: {min: number; max: number};
}

export interface WorkspaceStatsWidgetConfig extends WorkspaceWidgetBinding {
    /** The Stokes of the statistics, such as `"Qz"`. `"z"` means the current Stokes of the image. */
    coordinate?: string;
}

/** The zoom ranges of the plots of a Stokes analysis widget. */
export type WorkspaceStokesAnalysisRange =
    | "sharedMinX"
    | "sharedMaxX"
    | "quMinY"
    | "quMaxY"
    | "polIntensityMinY"
    | "polIntensityMaxY"
    | "polAngleMinY"
    | "polAngleMaxY"
    | "quScatterMinX"
    | "quScatterMaxX"
    | "quScatterMinY"
    | "quScatterMaxY"
    | "quScatterEqualXmin"
    | "quScatterEqualXmax"
    | "quScatterEqualYmin"
    | "quScatterEqualYmax";

export interface WorkspaceStokesAnalysisWidgetConfig extends WorkspaceWidgetBinding {
    ranges?: Partial<Record<WorkspaceStokesAnalysisRange, number>>;
}

export interface WorkspaceSpectralProfileWidgetConfig extends WorkspaceWidgetBinding, WorkspacePlotRange {
    /** The category that the profiles shown together differ in, such as image or region. {@link MultiProfileCategory.STOKES} is saved as `"Polarization"`. Left out when the widget shows one profile. */
    profileCategory?: MultiProfileCategory;
    /** The images whose profiles are shown together, by Workspace image ID. */
    imageIds?: number[];
    /** The regions of the shown image whose profiles are shown, by the IDs that the regions were saved with. */
    regionIds?: number[];
    /** The statistics whose profiles are shown. */
    statsTypes?: CARTA.StatsType[];
    /** The Stokes of the profiles shown, such as `"Iz"` or `"Qz"`. `"z"` means the current Stokes of the image. */
    coordinates?: string[];
    /** The color of each profile shown together. The key is a Workspace image ID, a saved region ID, a statistic or a Stokes, by the category. */
    profileColors?: {key: number | string; color: string}[];
    /** The intensity unit of the profiles when the widget shows the profiles of several images together. */
    intensityUnit?: string;
    /** The redshift of the source, and whether each axis is shown in the rest frame of the source. */
    restFrameRedshift?: number;
    xAxisRestFrameEnabled?: boolean;
    yAxisRestFrameEnabled?: boolean;
    /** The spectral lines that a spectral line query plotted on the widget, at the frequencies they were plotted at, in MHz. The query shifted them by its redshift. */
    spectralLines?: {species: string; value: number; qn: string}[];
    /** The fitting settings. Left out when the widget does not show an image that the workspace saves. */
    fitting?: WorkspaceSpectralFitting;
    /** The moment generator settings. Left out when the widget does not show an image that the workspace saves. */
    moments?: WorkspaceSpectralMoments;
}

/**
 * The query settings of a spectral line query widget. A restore does not query again, so the
 * table of lines is empty. The user queries again to see the lines.
 */
export interface WorkspaceSpectralLineQueryWidgetConfig {
    rangeType: SpectralLineQueryRangeType;
    /** The range, from and to, in `unit`. */
    range: [number, number];
    /** The center and the width on each side of it, in `unit`. */
    rangeByCenter: [number, number];
    unit: SpectralLineQueryUnit;
    intensityLimitEnabled: boolean;
    intensityLimit: number;
    redshiftType: RedshiftType;
    redshift: number;
    /** The spectral profiler that the lines are plotted on, by its widget ID. */
    spectralProfilerId?: string;
    /** The widths of the columns of the table that lists the columns of the result: name, display and description. */
    headerTableColumnWidths?: number[];
    /** The result table. Left out when the widget showed no result. A restore runs the query again. */
    result?: WorkspaceSpectralLineQueryResult;
}

/** The result table of a spectral line query. The lines themselves are not saved. */
export interface WorkspaceSpectralLineQueryResult {
    /** The frequency range of the query, in MHz. */
    frequencyRange: [number, number];
    /** The lowest intensity of the query. Left out when the query had no intensity limit. */
    intensityLimit?: number;
    /** The number of lines that the query returned. */
    rowCount: number;
    /** Whether each column is shown, its filter text and its width, by the column name. */
    columns: Record<string, {display: boolean; filter: string; width: number}>;
    /** Whether the filters were applied. A filter text can be typed without being applied. */
    filtered: boolean;
    sort?: {columnName: string; sortingType: CARTA.SortingType};
    /** The selected lines, by their row in the result of the query. */
    selectedRows: number[];
}

/** The settings of a PV generator widget. The PV image itself is saved with the request that made it. */
export interface WorkspacePvGeneratorWidgetConfig extends WorkspaceWidgetBinding {
    /** How many pixels wide the cut is averaged over. */
    width: number;
    reverse: boolean;
    /** Whether a new PV image keeps the PV images made before it. */
    keep: boolean;
    xyRebin: number;
    zRebin: number;
    /** The spectral range, in the units of `channelUnit`. Left out when it is the whole spectral axis. */
    channelRange?: [number, number];
    channelUnit?: string;
    /**
     * The Workspace ID of the image that the spectral range was chosen on. Left out when it is the
     * image of the widget. A PV image has no spectral axis, so the range of the image of the cut is
     * saved with that image while the PV image is active.
     */
    channelRangeImageId?: number;
    /** The region that the preview shows, by the ID that the region was saved with. -1 is the whole image. */
    previewRegionId: number;
    /** The PV preview. Left out when no preview was shown. A restore asks the backend for the preview again. */
    preview?: WorkspacePvPreview;
}

/** A PV preview: how its image was drawn, and where its viewer panel was. */
export interface WorkspacePvPreview {
    renderConfig?: WorkspaceRenderConfig;
    /** Whether the preview was the active image. Left out when it was not. */
    isActive?: boolean;
    /**
     * The place and the size of the PV Preview Viewer panel, in pixels. `widgetsBelow` is how many
     * other floating widgets were below the panel. Settings panels are not counted, because they
     * save their own place in the stack.
     */
    panel?: {x: number; y: number; width: number; height: number; widgetsBelow?: number};
    /** The request that made the preview. The widget can show other settings than the ones the preview was made with. */
    request?: WorkspacePvPreviewRequest;
}

/** The request that made a PV preview. A restore asks for the preview with it. */
export interface WorkspacePvPreviewRequest {
    /** The cube, by its workspace ID. */
    imageId: number;
    /** The line region of the cut, by the ID that the workspace saved it with. */
    regionId: number;
    /** The width of the cut, in pixels. */
    width: number;
    /** The first and the last channel. Left out for the whole spectral axis. */
    channels?: [number, number];
    reverse: boolean;
    /** The region that bounds the preview, by the ID that the workspace saved it with. -1 is the whole image. */
    previewRegionId: number;
    xyRebin: number;
    zRebin: number;
}

/** What the Log widget shows: the lowest level of the entries that it shows, and the tags that it hides. */
export interface WorkspaceLog {
    level: CARTA.ErrorSeverity;
    hiddenTags: string[];
}

/** The fields of the online catalog query dialog. The results of a query are saved with each catalog. */
export interface WorkspaceOnlineCatalogQuery {
    database: CatalogDatabase;
    /** The center, in the pixels of the image in front, as the dialog keeps it. */
    center: {x?: string; y?: string};
    coordinateSystem: CatalogSystemType;
    coordinateFormat: NumberFormatType;
    radius: number;
    radiusUnits: RadiusUnits;
    maxObjects: number;
    objectName: string;
    vizierKeywords: string;
    /**
     * The VizieR tables that the last query listed, with their descriptions. Left out when no list is
     * shown. A restore shows the list again without a query. Loading a table queries it by its name.
     */
    vizierTables?: {name: string; description: string}[];
    /** The names of the VizieR tables that are selected in the list. */
    vizierSelectedTables?: string[];
}

/** The fields of the HiPS query form of the Online Data Query dialog. A value that is not set is left out. */
export interface WorkspaceHipsQuery {
    survey: string;
    /** The width and the height of the image, in pixels. */
    width?: number;
    height?: number;
    /** Whether the form queries by an object name or by a center. */
    byObject: boolean;
    object: string;
    /** The center, in ICRS degrees. */
    center?: {x: number; y: number};
    /** The field of view, in degrees. */
    fov?: number;
    coordinateSystem: HipsCoord;
    projection: HipsProjection;
    /** The rotation angle, in degrees. */
    rotation: number;
}

/** The image toolbar: whether it is expanded, the layer that the mouse works on, and the region that a new region gets. */
export interface WorkspaceToolbar {
    expanded: boolean;
    activeLayer: ImageViewLayer;
    /** The image in front: the type of a new region, and whether the mouse creates regions. */
    newRegionType?: CARTA.RegionType;
    regionMode?: RegionMode;
}

/** The settings of the animator. */
export interface WorkspaceAnimator {
    frameRate: number;
    step: number;
    playMode: PlayMode;
    /** What the animator steps through: the channels, the Stokes, the images or a time series. */
    mode: AnimationMode;
    /** The setting that the animator shows beside the playback buttons: "Frame rate" or "Step". */
    numericInputType?: NumericInputType;
}

/**
 * The fitting settings of a spectral profiler: the function, the continuum, the initial guesses and
 * the fit result.
 */
export interface WorkspaceSpectralFitting {
    /** The fitting function, saved as its number: 0 is Gaussian and 1 is Lorentzian. */
    function: FittingFunction;
    /** The order of the continuum, saved as its number: -1 is none, 0 is constant and 1 is linear. */
    continuum: FittingContinuum;
    yIntercept: number;
    slope: number;
    yInterceptLocked: boolean;
    slopeLocked: boolean;
    /** The initial guesses of each component. */
    components: {center: number; amp: number; fwhm: number; centerLocked: boolean; ampLocked: boolean; fwhmLocked: boolean}[];
    autoDetectWithContinuum: boolean;
    autoDetectWithFitting: boolean;
    residualVisible: boolean;
    /** The component whose guesses the settings show, counted from 0. Left out for the first component. */
    selectedComponent?: number;
    /** How many components auto detect found, when the settings show its message. Left out when auto detect has not run. */
    autoDetectedComponents?: number;
    /**
     * The units of the x and y axes that the guesses are in, such as "Frequency (GHz), LSRK, rest
     * frame" and "Jy/beam". A restore applies the guesses only when it shows the same profile in
     * the same units.
     */
    xUnit: string;
    yUnit: string;
    /**
     * The fit result, in the same units as the guesses. Left out when the profile has no fit result.
     * The residual is not saved. A restore computes it from the profile and the result.
     */
    result?: WorkspaceSpectralFitResult;
}

/** The result of a spectral fitting. A value that is not finite, such as the error of a locked value, is saved as null. */
export interface WorkspaceSpectralFitResult {
    yIntercept: number | null;
    yInterceptError: number | null;
    slope: number | null;
    slopeError: number | null;
    /** The result of each component, in the order of the components of the guesses. */
    components: {
        center: number | null;
        centerError: number | null;
        amp: number | null;
        ampError: number | null;
        fwhm: number | null;
        fwhmError: number | null;
        integral: number | null;
        integralError: number | null;
    }[];
    /** The log of the fit, as the "View log" button shows it. */
    log: string;
}

/** A value of the Image Fitting dialog that the user can leave empty. It is null when it is empty. */
type WorkspaceImageFittingValue = number | null;

/**
 * The settings of the Image Fitting dialog. The initial values are in the pixels and the units of the
 * image that the dialog fits.
 */
export interface WorkspaceImageFitting {
    /** The image to fit, by its workspace ID. Left out when the dialog fits the active image. */
    imageId?: number;
    /** The region to fit, by the ID that the region was saved with. 0 is the field of view, and -1 is the whole image. */
    regionId: number;
    components: {
        center: {x: WorkspaceImageFittingValue; y: WorkspaceImageFittingValue};
        amp: WorkspaceImageFittingValue;
        fwhm: {x: WorkspaceImageFittingValue; y: WorkspaceImageFittingValue};
        pa: WorkspaceImageFittingValue;
        /** Whether each value is fixed, in the order center x, center y, amplitude, FWHM x, FWHM y and P.A. */
        fixed: boolean[];
    }[];
    /** Whether the backend generates the initial values. */
    autoInitialValues: boolean;
    backgroundOffset: number;
    backgroundOffsetFixed: boolean;
    solver: CARTA.FittingSolverType;
    createModelImage: boolean;
    createResidualImage: boolean;
    /** The component that the dialog shows, counted from 0. Left out for the first component. */
    selectedComponent?: number;
    /** Whether the dialog shows the values in image or world coordinates. Left out for image coordinates. */
    coordinate?: CoordinateMode;
}

/** The result of the last image fitting of an image, as the Image Fitting dialog shows it. */
export interface WorkspaceImageFitResult {
    /** The text of the result. */
    result: string;
    log: string;
    /** The ellipse of each component, in the pixels of the image: the center, the half axes and the rotation in degrees. */
    ellipses: {center: Point2D; size: Point2D; rotation: number}[];
}

/** The moment generator settings of a spectral profiler. */
export interface WorkspaceSpectralMoments {
    moments: CARTA.Moment[];
    /** The region that the moments are made from, by the ID that the region was saved with. -1 is the whole image, and -3 is the active region. */
    regionId: number;
    /** The spectral range, in the units of `channelUnit`. Left out when it is the whole spectral axis. */
    channelRange?: [number, number];
    channelUnit?: string;
    mask: CARTA.MomentMask;
    /** The range of pixel values that the mask uses, in the units of `maskUnit`. Left out when it is the default, 0 to 1. */
    maskRange?: [number, number];
    maskUnit?: string;
    /** Whether new moment images keep the moment images made before them. Left out when they replace them. */
    keep?: boolean;
}

/** What one profile, analysis or statistics widget shows. This is a Widget Config, so the workspace saves it. */
export type WorkspacePlotWidgetConfig = WidgetWorkspaceConfig<"render-config" | "spatial-profiler" | "spectral-profiler" | "histogram" | "stats" | "stokes" | "spectral-line-query" | "pv-generator">;

/**
 * What one catalog table or plot widget shows. This is a Widget Config. It has no meaning for other
 * data, so the workspace saves it and the layout does not.
 */
export type WorkspaceCatalogWidgetConfig = WidgetWorkspaceConfig<"catalog-overlay" | "catalog-plot">;

/**
 * The arrangement a workspace was saved in, in the same form a saved layout takes.
 *
 * A workspace keeps its own copy rather than naming a layout, so that reopening it restores the
 * widgets that show its images and catalogs. Saved layouts stay what they are: arrangements that
 * can be reused across workspaces.
 */
export interface WorkspaceLayout {
    layoutVersion: number;
    docked: any;
    floating: any[];
}

/** An open settings panel of a widget, and where it was. */
export interface WorkspaceWidgetSettingsPanel {
    /** The stable ID of the widget that the panel sets, such as "spectral-profiler-0". */
    widgetId: string;
    /** The type of that widget, such as "spectral-profiler". */
    widgetType: string;
    /** The title of that widget. The panel is titled after it. */
    title: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    /**
     * How many floating widgets were below the panel. The panels and the floating widgets share one
     * stacking order. A restore puts the panel back between them.
     */
    widgetsBelow?: number;
}

/** Where an open analysis dialog was and the tab that it showed. */
export interface WorkspaceDialog {
    /** Where the dialog was, in pixels of the browser window. Left out when it was in the middle of the window, where it opens. */
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    /** The name of the tab that the dialog showed, such as "Styling". Left out when the user did not choose a tab. */
    tab?: string;
    /** The File Info dialog: the text of the header search. Left out when the search was closed. */
    search?: string;
    /**
     * How many floating widgets and settings panels were below the dialog. The dialogs and the
     * floating widgets share one stacking order, so a restore puts the dialog back between them.
     */
    widgetsBelow?: number;
}

/**
 * The levels and the smoothing that the Contour dialog shows for its image but that are not applied
 * to the image.
 */
export interface WorkspaceContourDialogSettings {
    /** The image that the dialog shows the settings of. */
    imageId: number;
    levels: number[];
    smoothingMode: number;
    smoothingFactor: number;
    /**
     * The values of the level generator that differ from the values that it starts with. Kept only
     * when the dialog was open, because the generator starts again from its first values when the
     * dialog opens.
     */
    generator?: WorkspaceContourGeneratorSettings;
}

/** The values of the level generator of the Contour dialog. A value that is left out is not changed. */
export interface WorkspaceContourGeneratorSettings {
    generator?: string;
    numLevels?: number;
    /** The values that the user typed. Left out when the generator takes the value from the histogram. */
    minValue?: number;
    maxValue?: number;
    startValue?: number;
    stepValue?: number;
    refValue?: number;
    meanValue?: number;
    sigmaValue?: number;
    scaling?: number;
    /** The alpha of each scaling, by the number of the scaling. */
    scalingAlphas?: {[scaling: string]: number};
    scalingGamma?: number;
    multiplier?: number;
    lowerPercentage?: number;
    upperPercentage?: number;
    sigmaLevels?: number[];
}

/** The settings that the Vector Overlay dialog shows for the active image but that are not applied to it. */
export interface WorkspaceVectorOverlayDialogSettings {
    /** The image that the dialog shows the settings of. */
    imageId: number;
    angularSource: number;
    intensitySource: number;
    pixelAveraging: number;
    fractionalIntensity: boolean;
    thresholdEnabled: boolean;
    threshold: number;
    debiasing: boolean;
    qError: number;
    uError: number;
    thresholdOption: number;
}

export interface Workspace {
    id?: string;
    name?: string;
    editable?: boolean;
    workspaceVersion: number;
    frontendVersion: number;
    description?: string;
    files?: WorkspaceFile[];
    catalogs?: WorkspaceCatalog[];
    colorBlendingImages?: WorkspaceColorBlending[];
    /**
     * The moment, PV, HiPS and image fitting images, by the requests that made them. Each request
     * comes after the requests that made the images it uses.
     */
    generatedImages?: WorkspaceGeneratedImages[];
    references?: {
        spatial?: number;
        spectral?: number;
        raster?: number;
    };
    /** The spectral coordinate that spectrally matched images are matched by, such as "VRAD". */
    spectralMatchingType?: SpectralType;
    selectedFile?: number;
    /** The settings of the animator. */
    animator?: WorkspaceAnimator;
    /** What the Log widget shows. The log entries are not saved. */
    log?: WorkspaceLog;
    /**
     * The image that the Contour dialog shows. Left out while the dialog follows the active image,
     * which is the default.
     */
    contourDataSource?: {imageId: number};
    /**
     * Whether the cursor was frozen, and where it was, in the pixels of the image in front. A restore
     * puts the cursor there, so that the cursor profiles show that position. A cursor that was not
     * frozen then follows the mouse again when the mouse moves over the image.
     */
    cursor?: {
        frozen: boolean;
        position?: Point2D;
        /** Whether the cursor is shown on every panel of a multi-panel view. Left out when it is not. */
        mirrored?: boolean;
    };
    /** The image toolbar. */
    toolbar?: WorkspaceToolbar;
    /** Whether new moment images of the spatial reference are matched to it. Left out when they are. */
    momentAutoMatching?: boolean;
    /**
     * The image whose beam the Beam tab of the image view settings shows, by its workspace ID. Left
     * out when it is the image in front, which the tab follows.
     */
    beamSettingsImageId?: number;
    /** The fields of the online catalog query dialog. */
    onlineCatalogQuery?: WorkspaceOnlineCatalogQuery;
    /** The fields of the HiPS query form of the Online Data Query dialog. */
    hipsQuery?: WorkspaceHipsQuery;
    /**
     * The analysis dialogs that were open, such as "contour-dialog", from the bottom one to the top
     * one. Left out by a workspace saved before it kept the dialogs. A restore then leaves the
     * dialogs as they are.
     */
    openDialogs?: string[];
    /**
     * Where each open analysis dialog was and the tab that it showed, by the ID of the dialog. A
     * dialog that the user did not move and whose tab the user did not choose is left out.
     */
    dialogs?: {[dialogId: string]: WorkspaceDialog};
    /**
     * The settings that the Contour and Vector Overlay dialogs showed but that were not applied. Left
     * out when the dialogs showed the settings of their image.
     */
    dialogSettings?: {
        contour?: WorkspaceContourDialogSettings;
        vectorOverlay?: WorkspaceVectorOverlayDialogSettings;
        /**
         * The saved snippet that the Snippet dialog shows, by its name. The code is not saved. A
         * restore shows the snippet of that name that the opener has saved.
         */
        snippet?: {name: string};
    };
    /**
     * The settings panels of widgets that were open as floating panels, from the bottom one to the
     * top one. Left out by a workspace saved before it kept them. A restore then leaves the panels
     * as they are.
     */
    openWidgetSettings?: WorkspaceWidgetSettingsPanel[];
    /**
     * The color-blended image in front, when it is one, by the `imageListIndex` its entry in
     * `colorBlendingImages` carries. `selectedFile` then names the image it is blended onto.
     */
    selectedColorBlending?: number;
    /** What each catalog table and plot widget shows, keyed by the widget's stable ID. */
    catalogWidgets?: {[widgetId: string]: WorkspaceCatalogWidgetConfig};
    /** What each profile, analysis and statistics widget shows, by the stable ID of the widget. */
    plotWidgets?: {[widgetId: string]: WorkspacePlotWidgetConfig};
    /** The settings of the Image Fitting dialog. */
    imageFitting?: WorkspaceImageFitting;
    wcsOverlay?: WorkspaceWcsOverlayText;
    layout?: WorkspaceLayout;
    thumbnail?: string;
    date?: number;
}

/**
 * One item a workspace could not be saved with, or could not be brought back as it was saved.
 *
 * The message is what a person reads; the kind and subject are what code groups and filters by, so
 * that a session with many items does not report one flat list of sentences. They repeat what the
 * message says on purpose: the message has to stand on its own in a log.
 */
export interface WorkspaceIssue {
    kind: WorkspaceItemKind;
    /** How the item is named to the user: a filename, a query, or a widget ID. */
    subject: string;
    /** What happened, as a whole sentence naming the subject. */
    message: string;
    /**
     * Set by a restore when the item is not in the session, so a save of the session leaves the
     * item out. Undefined when the item is in the session, but not as it was saved.
     */
    outcome?: WorkspaceIssueOutcome;
    /**
     * How the restore report names the item, such as "The image cube.fits". The report shows the
     * label next to the outcome tag. So the label does not need to say "Skipped" or "Could not".
     * The report names a widget by its title instead.
     */
    label?: string;
    /** Why the item is not restored as saved, without the name of the item. The report shows it after the label. */
    reason?: string;
    /** The Workspace IDs of the saved images that are not in the session because of this item. */
    imageIds?: number[];
    /** The Workspace ID of the saved image that caused this issue. The issue happened because this image is not in the session. */
    causeImageId?: number;
    /** The Workspace IDs of the saved catalogs that are not in the session because of this item. */
    catalogIds?: number[];
    /** The Workspace ID of the saved catalog that caused this issue. For example, the catalog is not in the session, or it is the first query to a mirror that timed out. */
    causeCatalogId?: number;
    /** How a widget differs from the workspace. The report groups the widgets with the same effect. */
    effect?: WorkspaceIssueEffect;
    /**
     * What the widget shows now, when it differs between widgets with the same effect, such as "the
     * catalog sources.vot" for a catalog widget. The report groups the widgets with the same detail.
     */
    effectDetail?: string;
}

export interface WorkspaceListItem {
    name: string;
    id?: string;
    date: number;
}

interface LegacyWorkspaceRenderConfig extends WorkspaceRenderConfig {
    alpha?: unknown;
}

export class WorkspaceConfig {
    /** Workspaces written before version 2 name their file directly instead of describing a source. */
    private static upgradeImageSource(file: WorkspaceFile): WorkspaceFile {
        if (file.source || !file.filename) {
            return file;
        }
        return {...file, source: {type: "file", directory: file.directory, filename: file.filename, hdu: file.hdu}};
    }

    /**
     * Workspaces written before the table state was given back to the catalog's profile store keep
     * it inside the display config.
     */
    private static upgradeCatalogTableConfig(catalog: WorkspaceCatalog): WorkspaceCatalog {
        const storedDisplayConfig = catalog.displayConfig as (WorkspaceCatalogConfig & WorkspaceCatalogTableConfig) | undefined;
        if (catalog.tableConfig || !storedDisplayConfig) {
            return catalog;
        }

        const {displayedColumns, maxRows, columnSettings, sorting, ...displayConfig} = storedDisplayConfig;
        if (displayedColumns === undefined && maxRows === undefined && columnSettings === undefined && sorting === undefined) {
            return catalog;
        }
        return {...catalog, tableConfig: {displayedColumns, maxRows, columnSettings, sorting}, displayConfig};
    }

    /**
     * Workspaces written before a plot's linear fit was recomputed on showing it keep the range it
     * was drawn over, which nothing reads any more.
     */
    private static upgradeCatalogWidgets(catalogWidgets: Workspace["catalogWidgets"]): Workspace["catalogWidgets"] {
        if (!catalogWidgets || typeof catalogWidgets !== "object" || Array.isArray(catalogWidgets)) {
            return catalogWidgets;
        }
        return Object.fromEntries(
            Object.entries(catalogWidgets).map(([widgetId, config]) => {
                if (!config || typeof config !== "object" || !("fittingRange" in config)) {
                    return [widgetId, config];
                }
                const upgraded: WorkspaceCatalogWidgetConfig & {fittingRange?: unknown} = {...config};
                delete upgraded.fittingRange;
                return [widgetId, upgraded];
            })
        );
    }

    /** Upgrade legacy fields on a runtime copy without modifying or persisting the stored workspace. */
    public static upgradeForRuntime(workspace: Workspace): Workspace {
        const catalogs = Array.isArray(workspace.catalogs)
            ? workspace.catalogs.map(catalog => (catalog && typeof catalog === "object" && !Array.isArray(catalog) ? WorkspaceConfig.upgradeCatalogTableConfig(catalog) : catalog))
            : workspace.catalogs;
        const catalogWidgets = WorkspaceConfig.upgradeCatalogWidgets(workspace.catalogWidgets);

        if (!Array.isArray(workspace.files)) {
            return {...workspace, catalogs, catalogWidgets};
        }

        return {
            ...workspace,
            catalogs,
            catalogWidgets,
            files: workspace.files.map(file => {
                if (!file || typeof file !== "object" || Array.isArray(file)) {
                    return file;
                }

                file = WorkspaceConfig.upgradeImageSource(file);
                const storedRenderConfig = file.renderConfig;
                if (!storedRenderConfig || typeof storedRenderConfig !== "object" || Array.isArray(storedRenderConfig) || !("alpha" in storedRenderConfig)) {
                    return file;
                }

                const {alpha, ...renderConfig} = storedRenderConfig as LegacyWorkspaceRenderConfig;
                if (typeof alpha === "number" && Number.isFinite(alpha) && alpha > 0) {
                    renderConfig.alphaLog ??= sanitizeScalingParameter(FrameScaling.LOG, alpha);
                    renderConfig.alphaPower ??= sanitizeScalingParameter(FrameScaling.POWER, alpha);
                }

                return {...file, renderConfig};
            })
        };
    }
}
