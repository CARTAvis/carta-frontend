import {RGBColor} from "react-color";
import {CARTA} from "carta-protobuf";

import {ContourDashMode, FrameScaling, VectorOverlaySource} from "stores/Frame";

import {Point2D} from "./Point2D/Point2D";

export interface WorkspaceRenderConfig {
    scaling?: FrameScaling;
    colorMap?: string;
    bias?: number;
    contrast?: number;
    gamma?: number;
    alpha?: number;
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
    color?: RGBColor;
    colormapEnabled: boolean;
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
    pixelAveragingEnabled: boolean;
    pixelAveraging: number;
    thresholdEnabled: boolean;
    threshold: number;
    debiasing: boolean;
    qError: number;
    uError: number;

    visible: boolean;
    thickness: number;
    colormapEnabled: boolean;
    color?: RGBColor;
    colormap?: string;
    colormapContrast: number;
    colormapBias: number;
    lengthMin: number;
    lengthMax: number;
    intensityMin: number;
    intensityMax: number;
    rotationOffset: number;
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

export interface WorkspaceFile {
    id: number;
    directory?: string;
    filename: string;
    hdu?: string;
    references?: {
        spatial?: number;
        spectral?: number;
        raster?: number;
    };
    center?: Point2D;
    zoomLevel?: number;
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
