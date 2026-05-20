import pixelShader from "./pixel_shader_contours.glsl";
import utilities from "./utilities.glsl";
import vertexShader from "./vertex_shader_contours.glsl";

export const CONTOUR_SHADERS = {
    vertexShader: `#version 300 es\n${utilities}\n${vertexShader}`,
    fragmentShader: `#version 300 es\n${pixelShader}`
};
