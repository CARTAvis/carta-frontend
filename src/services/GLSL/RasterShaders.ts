import rasterVertexShader from "!raw-loader!./vertex_shader_raster.glsl";
import rasterPixelShader from "!raw-loader!./pixel_shader_raster.glsl";
import {utilities} from "./utilities";

const macorsPixel = `
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
    vertexShader: `${utilities.version300}\n${utilities.rotate2D}\n${rasterVertexShader}`,
    fragmentShader: `${utilities.version300}\n${macorsPixel}\n${rasterPixelShader}`
}