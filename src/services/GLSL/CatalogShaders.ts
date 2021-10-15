import catalogVertexShader from "!raw-loader!./vertex_shader_catalog.glsl";
import catalogPixelShader from "!raw-loader!./pixel_shader_catalog.glsl";
import {utilities} from "./utilities";

const macors = `
#define BOX_FILLED 0
#define BOX_LINED 1
#define CIRCLE_FILLED 2
#define CIRCLE_LINED 3
#define HEXAGON_FILLED 4
#define HEXAGON_LINED 5
#define RHOMB_FILLED 6
#define RHOMB_LINED 7
#define TRIANGLE_FILLED_UP 8
#define TRIANGLE_LINED_UP 9
#define ELLIPSE_FILLED 10
#define ELLIPSE_LINED 11
#define TRIANGLE_FILLED_DOWN 12
#define TRIANGLE_LINED_DOWN 13
#define HEXAGON_FILLED_2 14
#define HEXAGON_LINED_2 15
#define CROSS_FILLED 16
#define CROSS_LINED 17
#define X_FILLED 18
#define X_LINED 19
#define LineSegment_FILLED 20
`;
const macorsVertex = `
#define PI radians(180.0)
#define SQRT3 sqrt(3.0)
#define SIN_60 0.86602540378

#define LINEAR 0
#define LOG 1
#define SQRT 2
#define SQUARE 3
#define POWER 4
#define GAMMA 5
`;

const macorsPixel = `
#define SIN_0 0.0
#define COS_0 1.0
#define COS_45 0.70710678118
#define SIN_60 0.86602540378
#define COS_60 0.5
#define SIN_90 1.0
#define COS_90 0.0
`;

export const catalogShaders = {
    vertexShader: `${utilities.version300}\n${macors}\n${macorsVertex}\n${utilities.imageToGL}\n${utilities.bicubicFilter}\n${utilities.rotate2D}\n${catalogVertexShader}`,
    fragmentShader: `${utilities.version300}\n${macors}\n${macorsPixel}\n${catalogPixelShader}`
};
