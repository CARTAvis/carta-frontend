import contourVertexShader from "!raw-loader!./vertex_shader_contours.glsl";
import contourPixelShader from "!raw-loader!./pixel_shader_contours.glsl";
import utilities from "!raw-loader!./utilities.glsl";

export const contourShaders = {
    vertexShader: `#version 300 es\n${utilities}\n${contourVertexShader}`,
    fragmentShader: `#version 300 es\n${contourPixelShader}`
};
