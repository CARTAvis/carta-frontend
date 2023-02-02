import pixelShader from "!raw-loader!./pixel_shader_contours.glsl";
import utilities from "!raw-loader!./utilities.glsl";
import vertexShader from "!raw-loader!./vertex_shader_contours.glsl";

export const contourShaders = {
    vertexShader: `#version 300 es\n${utilities}\n${vertexShader}`,
    fragmentShader: `#version 300 es\n${pixelShader}`
};
