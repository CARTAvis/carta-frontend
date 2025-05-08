import pixelShader from "./pixel_shader_volume.glsl";
import vertexShader from "./vertex_shader_volume.glsl";

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

// #version 300 es\n when using VolumeWebGLService
export const volumeShaders = {
    vertexShader: `${vertexShader}`,
    fragmentShader: `${pixelMacros}\n${pixelShader}`
};