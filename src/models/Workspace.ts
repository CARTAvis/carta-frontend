import type {RGBColor} from "react-color";
import {type CARTA} from "carta-protobuf";

import {type ContourDashMode, type FrameScaling, type VectorOverlaySource} from "enums";
import {type ContourConfigStore, type RenderConfigStore, type VectorOverlayConfigStore} from "stores/Frame";

import {type Point2D} from "./Point2D/Point2D";

// don't apply naming convention here to backward-compatible deserialization for legacy workspace keys
export interface WorkspaceRenderConfig {
    scaling?: FrameScaling;
    colorMap?: string;
    customColormapHexEnd?: string;
    customColormapHexStart?: string;
    bias?: number;
    contrast?: number;
    gamma?: number;
    alpha?: number;
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
    color?: RGBColor;
    colormap?: string;
    colormapContrast: number;
    colormapBias: number;
    lengthMin: number;
    lengthMax: number;
    intensityMin: number | undefined;
    intensityMax: number | undefined;
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

export class WorkspaceConfig {
    public static createRenderConfig(renderConfig: RenderConfigStore): WorkspaceRenderConfig {
        const {scaling, colorMap, bias, contrast, gamma, alphaLog, alphaPower, alphaSinh, alphaAsinh, isInverted, isUsingCubeHistogram, isUsingCubeHistogramContours, selectedPercentile, scaleMin, scaleMax, isVisible} = renderConfig;

        return {
            scaling,
            colorMap,
            bias,
            contrast,
            gamma,
            alphaLog,
            alphaPower,
            alphaSinh,
            alphaAsinh,
            inverted: isInverted,
            useCubeHistogram: isUsingCubeHistogram,
            useCubeHistogramContours: isUsingCubeHistogramContours,
            selectedPercentile,
            scaleMin,
            scaleMax,
            visible: isVisible
        };
    }

    public static createContourConfig(contourConfig: ContourConfigStore): WorkspaceContourConfig | undefined {
        const {isEnabled, levels, smoothingMode, smoothingFactor, color, isColormapEnabled, colormap, colormapContrast, colormapBias, dashMode, thickness, isVisible} = contourConfig;

        if (!isEnabled) {
            return undefined;
        }

        return {
            levels,
            smoothingMode,
            smoothingFactor,
            color,
            colormapEnabled: isColormapEnabled,
            colormap,
            colormapContrast,
            colormapBias,
            dashMode,
            thickness,
            visible: isVisible
        };
    }

    public static createVectorOverlayConfig(vectorOverlayConfig: VectorOverlayConfigStore): WorkspaceVectorOverlayConfig | undefined {
        const {
            isEnabled,
            angularSource,
            intensitySource,
            isFractionalIntensity,
            pixelAveraging,
            isThresholdEnabled,
            threshold,
            isDebiasing,
            qError,
            uError,
            thresholdOption,
            isVisible,
            thickness,
            isColormapEnabled,
            color,
            colormap,
            colormapContrast,
            colormapBias,
            lengthMin,
            lengthMax,
            intensityMin,
            intensityMax,
            rotationOffset
        } = vectorOverlayConfig;

        if (!isEnabled) {
            return undefined;
        }

        return {
            angularSource,
            intensitySource,
            fractionalIntensity: isFractionalIntensity,
            pixelAveraging,
            thresholdEnabled: isThresholdEnabled,
            threshold,
            debiasing: isDebiasing,
            qError,
            uError,
            thresholdOption,
            visible: isVisible,
            thickness,
            colormapEnabled: isColormapEnabled,
            color,
            colormap,
            colormapContrast,
            colormapBias,
            lengthMin,
            lengthMax,
            intensityMin,
            intensityMax,
            rotationOffset
        };
    }
}
