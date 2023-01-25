import {FrameScaling} from "stores/Frame";

import {CARTA} from "../../protobuf/build";

import {Point2D} from "./Point2D";

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

export interface WorkspaceRegion {
    id: number;
    points: Point2D[];
    rotation: number;
    type: CARTA.RegionType;
    name?: string;
    color?: string;
    lineWidth?: number;
    dashes?: number[];
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
    renderConfig?: WorkspaceRenderConfig;
    regionsSet?: {
        selectedRegion?: number;
        regions?: WorkspaceRegion[];
    };
}

export interface Workspace {
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
}

export interface WorkspaceListItem {
    name: string;
    date: number;
}
