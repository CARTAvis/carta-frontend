import vertexShader from "!raw-loader!./vertex_shader_overlay.glsl";
import pixelShader from "!raw-loader!./pixel_shader_overlay.glsl";
import utilities from "!raw-loader!./utilities.glsl";

const sharedMacros = `

`;
const vertexMacros = `
#define PI radians(180.0)
#define SQRT3 sqrt(3.0)
#define SIN_60 0.86602540378
`;

const pixelMacros = `
#define SIN_0 0.0
#define COS_0 1.0
#define COS_45 0.70710678118
#define SIN_60 0.86602540378
#define COS_60 0.5
#define SIN_90 1.0
#define COS_90 0.0
`;

export const vectorOverlayShaders = {
    vertexShader: `#version 300 es\n${sharedMacros}\n${vertexMacros}\n${utilities}\n${vertexShader}`,
    fragmentShader: `#version 300 es\n${sharedMacros}\n${pixelMacros}\n${pixelShader}`
};
