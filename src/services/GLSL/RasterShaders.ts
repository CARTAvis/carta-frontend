import rasterPixelShader from "./pixel_shader_raster.glsl";
import utilities from "./utilities.glsl";
import rasterVertexShader from "./vertex_shader_raster.glsl";

const pixelMacros = `
#define LINEAR 0
#define LOG 1
#define SQRT 2
#define SQUARE 3
#define POWER 4
#define GAMMA 5
#define EXP 6
#define CUSTOM 7
#define FLT_MAX 3.402823466e+38
`;

export const rasterShaders = {
    vertexShader: `#version 300 es\n${utilities}\n${rasterVertexShader}`,
    fragmentShader: `#version 300 es\n${pixelMacros}\n${rasterPixelShader}`
};
