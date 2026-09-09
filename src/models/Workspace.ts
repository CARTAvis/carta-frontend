import type {RgbaColor} from "@uiw/react-color";
import {type CARTA} from "carta-protobuf";

import {type AngularSizeUnit, type CatalogDisplayMode, type CatalogOverlayShape, type CatalogPlotType, type CatalogSizeUnits, type ContourDashMode, FrameScaling, type VectorOverlaySource} from "enums";
import {sanitizeScalingParameter, type ScalingParameters} from "utilities/scaling/scaling";

import {type Point2D} from "./Point2D/Point2D";

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

/**
 * How one catalog is drawn. Holds only what the user authored: the state a panel keeps for its
 * own presentation, and the values recomputed from the catalog data, are deliberately absent.
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

export interface WorkspaceFile {
    id: number;
    directory?: string;
    filename: string;
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

export interface Workspace {
    id?: string;
    name?: string;
    editable?: boolean;
    workspaceVersion: number;
    frontendVersion: number;
    description?: string;
    files?: WorkspaceFile[];
    colorBlendingImages?: WorkspaceColorBlending[];
    references?: {
        spatial?: number;
        spectral?: number;
        raster?: number;
    };
    selectedFile?: number;
    thumbnail?: string;
    date?: number;
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
    /** Upgrade legacy fields on a runtime copy without modifying or persisting the stored workspace. */
    public static upgradeForRuntime(workspace: Workspace): Workspace {
        if (!Array.isArray(workspace.files)) {
            return {...workspace};
        }

        return {
            ...workspace,
            files: workspace.files.map(file => {
                if (!file || typeof file !== "object" || Array.isArray(file)) {
                    return file;
                }

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
