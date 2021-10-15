import imageToGL from "!raw-loader!./ImageToGL.glsl";
import bicubicFilter from "!raw-loader!./BicubicFilter.glsl";
import rotate2D from "!raw-loader!./Rotate2D.glsl";

export const utilities = {
    version300: `#version 300 es`,
    imageToGL: imageToGL,
    bicubicFilter: bicubicFilter,
    rotate2D: rotate2D
};
