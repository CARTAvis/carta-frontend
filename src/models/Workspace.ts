import {FrameScaling} from "stores/Frame";
import {Point2D} from "./Point2D";
import {CARTA} from "../../protobuf/build";

export interface WorkspaceRenderConfig {
    scaling?: FrameScaling;
    colormap?: string;
    bias?: number;
    contrast?: number;
    gamma?: number;
    alpha?: number;
    inverted?: boolean;
    useCubeHistogram?: boolean;
    useCubeHistogramContours?: boolean;
    selectedPercentile?: number[];
    scaleMin?: number[];
    scaleMax?: number;
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
    path: string;
    hdu?: string;
    spatialMatching?: boolean;
    spectralMatching?: boolean;
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
    spatialReference?: number;
    spectralReference?: number;
}

export const exampleWorkspace: Workspace = {
    workspaceVersion: 0,
    frontendVersion: 4,
    description: "Example workspace",
    files: [
        {
            id: 1,
            path: "fits/m51/m51_xray.fits",
            spatialMatching: true,
            spectralMatching: true
        },
        {
            id: 2,
            path: "fits/m51/h_m51_b_s05_drz_sci.fits",
            spatialMatching: true,
            spectralMatching: true
        },
        {
            id: 3,
            path: "fits/m51/h_m51_h_s05_drz_sci.fits",
            spatialMatching: true,
            spectralMatching: true
        },
        {
            id: 4,
            path: "fits/m51/h_m51_i_s05_drz_sci.fits",
            spatialMatching: true,
            spectralMatching: true
        }
    ]
};
