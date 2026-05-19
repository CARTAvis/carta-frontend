import pixelShader from "./pixel_shader_overlay.glsl";
import utilities from "./utilities.glsl";
import vertexShader from "./vertex_shader_overlay.glsl";

const SHARED_MACROS = `
#define PI radians(180.0)
`;
const VERTEX_MACROS = `
#define SQRT3 sqrt(3.0)
#define SIN_60 0.86602540378
`;

const PIXEL_MACROS = `
#define SIN_0 0.0
#define COS_0 1.0
#define COS_45 0.70710678118
#define SIN_60 0.86602540378
#define COS_60 0.5
#define SIN_90 1.0
#define COS_90 0.0
`;

export const VECTOR_OVERLAY_SHADERS = {
    vertexShader: `#version 300 es\n${SHARED_MACROS}\n${VERTEX_MACROS}\n${utilities}\n${vertexShader}`,
    fragmentShader: `#version 300 es\n${SHARED_MACROS}\n${PIXEL_MACROS}\n${pixelShader}`
};
