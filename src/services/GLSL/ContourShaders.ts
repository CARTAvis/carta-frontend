import contourVertexShader from "!raw-loader!./vertex_shader_contours.glsl";
import contourPixelShader from "!raw-loader!./pixel_shader_contours.glsl";
import {utilities} from "./utilities";

export const contourShaders = {
    vertexShader: `${utilities.versionString}\n${utilities.bicubicFilter}\n${utilities.rotate2D}\n${contourVertexShader}`,
    fragmentShader: `${utilities.versionString}\n${contourPixelShader}`
};
