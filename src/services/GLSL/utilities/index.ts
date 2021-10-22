import {rotate2D, imageToGL, bicubicFilter} from "./utilities";

export type shaders = {vertexShader: string[], fragmentShader: string[]};

export const utilities = {
    versionString: `#version 300 es`,
    imageToGL: imageToGL,
    bicubicFilter: bicubicFilter,
    rotate2D: rotate2D
};
