import type {RgbaColor} from "@uiw/react-color";
import {type CARTA} from "carta-protobuf";

import {
    type AngularSizeUnit,
    type CatalogDisplayMode,
    type CatalogOverlayShape,
    type CatalogPlotType,
    type CatalogSizeUnits,
    type CatalogSystemType,
    type ContourDashMode,
    FrameScaling,
    type RadiusUnits,
    type VectorOverlaySource,
    type WorkspaceItemKind
} from "enums";
import {sanitizeScalingParameter, type ScalingParameters} from "utilities/scaling/scaling";

import {type Point2D} from "./Point2D/Point2D";

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

/** One catalog size axis: the major axis, or the minor axis of an ellipse. */
export interface WorkspaceCatalogSizeAxisConfig {
    mapColumn?: string;
    /** Lower end of the mapped data range, as clipped by the user. Absent while it follows the data. */
    columnMinClip?: number;
    /** Upper end of the mapped data range, as clipped by the user. Absent while it follows the data. */
    columnMaxClip?: number;
    min?: {area: number; diameter: number};
    max?: {area: number; diameter: number};
    areaMode?: boolean;
    scalingType?: FrameScaling;
    scalingParameters?: ScalingParameters;
    /** Whether the minor axis follows this axis at the lower end. */
    columnMinLocked?: boolean;
    /** Whether the minor axis follows this axis at the upper end. */
    columnMaxLocked?: boolean;
}

export interface WorkspaceCatalogColorAxisConfig {
    mapColumn?: string;
    /** Lower end of the mapped data range, as clipped by the user. Absent while it follows the data. */
    columnMinClip?: number;
    /** Upper end of the mapped data range, as clipped by the user. Absent while it follows the data. */
    columnMaxClip?: number;
    colorMap?: string;
    inverted?: boolean;
    scalingType?: FrameScaling;
    scalingParameters?: ScalingParameters;
}

export interface WorkspaceCatalogOrientationAxisConfig {
    mapColumn?: string;
    /** Lower end of the mapped data range, as clipped by the user. Absent while it follows the data. */
    columnMinClip?: number;
    /** Upper end of the mapped data range, as clipped by the user. Absent while it follows the data. */
    columnMaxClip?: number;
    /** Lower end of the angle range the mapped data is spread over, in degrees. */
    angleMin?: number;
    /** Upper end of the angle range the mapped data is spread over, in degrees. */
    angleMax?: number;
    scalingType?: FrameScaling;
    scalingParameters?: ScalingParameters;
}

/** The overlay a catalog actually has drawn over its image, which the panel's current plot controls
 * can be changed away from without taking it down. */
export interface WorkspaceCatalogImageOverlay {
    xAxis: string;
    yAxis: string;
    system: CatalogSystemType;
    /** Number of rows that were actually drawn when the overlay was created. */
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

/**
 * Which rows and columns a catalog holds, and how its table shows them. Owned by the catalog's
 * profile store, which is what the table and the query behind it belong to.
 */
export interface WorkspaceCatalogTableConfig {
    /** Names of catalog columns currently shown in the table. */
    displayedColumns?: string[];
    /** Maximum number of rows requested for the catalog table and image overlay. */
    maxRows?: number;
    /** User-entered filters and widths, keyed by catalog column name. */
    columnSettings?: {[columnName: string]: WorkspaceCatalogColumnConfig};
    sorting?: WorkspaceCatalogSortingConfig;
}

/**
 * How one catalog is drawn. Holds only what the user authored: the state a panel keeps for its
 * own presentation, and the values recomputed from the catalog data, are deliberately absent.
 * Which rows the catalog holds is not part of this; that is {@link WorkspaceCatalogTableConfig}.
 */
export interface WorkspaceCatalogConfig {
    color?: string;
    highlightColor?: string;
    shape?: CatalogOverlayShape;
    /** Source size in the current size unit, as entered by the user. */
    size?: number;
    thickness?: number;
    displayMode?: CatalogDisplayMode;
    canvasSizeUnit?: CatalogSizeUnits;
    worldSizeUnit?: AngularSizeUnit;
    plotType?: CatalogPlotType;
    xAxis?: string;
    yAxis?: string;
    imageOverlay?: WorkspaceCatalogImageOverlay;
    headerTableColumnWidths?: number[];
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
}

export interface WorkspaceColorBlending {
    imageListIndex: number;
    selectedFrameId: number[];
    alpha: number[];
}

/** One of the images making up a hypercube. */
export interface WorkspaceStokesFile {
    directory?: string;
    filename: string;
    hdu?: string;
    polarizationType?: number;
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

    renderConfig?: WorkspaceRenderConfig;
    contourConfig?: WorkspaceContourConfig;
    vectorOverlayConfig?: WorkspaceVectorOverlayConfig;
    regionsSet?: {
        selectedRegion?: number;
        regions?: WorkspaceRegion[];
    };
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
    const tableDescription = source.table ? ` for ${source.table}` : "";
    return `the ${source.type} query${tableDescription}`;
}

export interface WorkspaceCatalogFileSource {
    type: "file";
    directory?: string;
    filename: string;
}

/** The parameters an online query is re-run from. The centre is in degrees, so that it does not
 * depend on the image the query was originally centred on. */
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
    references?: {
        spatial?: number;
        spectral?: number;
        raster?: number;
    };
    selectedFile?: number;
    /** Workspace catalog selected by each catalog panel, keyed by stable panel ID. */
    selectedCatalogIds?: {[panelId: string]: number};
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

    /** Upgrade legacy fields on a runtime copy without modifying or persisting the stored workspace. */
    public static upgradeForRuntime(workspace: Workspace): Workspace {
        const catalogs = Array.isArray(workspace.catalogs)
            ? workspace.catalogs.map(catalog => (catalog && typeof catalog === "object" && !Array.isArray(catalog) ? WorkspaceConfig.upgradeCatalogTableConfig(catalog) : catalog))
            : workspace.catalogs;

        if (!Array.isArray(workspace.files)) {
            return {...workspace, catalogs};
        }

        return {
            ...workspace,
            catalogs,
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
