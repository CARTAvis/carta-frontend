#version 300 es
precision highp float;

uniform float uLineThickness;
uniform int uShapeType;
uniform float uFeatherWidth;
uniform vec3 uPointColor;
uniform bool uCmapEnabled;

#define BOX_FILLED 0
#define BOX_LINED 1
#define CIRCLE_FILLED 2
#define CIRCLE_LINED 3
#define HEXAGON_FILLED 4
#define HEXAGON_LINED 5

#define SIN_60 0.86602540378
#define COS_60 0.5

mat2 rot60 = mat2(COS_60, -SIN_60, SIN_60, COS_60);

in vec4 v_colour;
in float v_pointSize;
out vec4 outColor;

float featherRange(vec2 a, float rMax) {
    float r = length(a);
    float v = (rMax - r - uFeatherWidth) / (2.0 * uFeatherWidth);
    return smoothstep(0.0, 1.0, v);
}

float featherRange(vec2 a, float rMin, float rMax) {
    float r = length(a);
    vec2 v = (vec2(rMax, rMin) - r - uFeatherWidth) / (2.0 * uFeatherWidth);
    vec2 alpha = smoothstep(0.0, 1.0, v);
    // subtract inner feathered circle
    return (alpha.x) * (1.0 - alpha.y);
}

float featherRangeSquare(vec2 r, float rMax) {
    vec2 v = (rMax - abs(r) - uFeatherWidth) / (2.0 * uFeatherWidth);
    vec2 alpha = smoothstep(0.0, 1.0, v);
    return alpha.x * alpha.y;
}

float featherRangeSquare(vec2 r, float rMin, float rMax) {
    vec2 v = (rMax - abs(r) - uFeatherWidth) / (2.0 * uFeatherWidth);
    vec2 v2 = (rMin - abs(r) - uFeatherWidth) / (2.0 * uFeatherWidth);
    vec2 alpha = smoothstep(0.0, 1.0, v);
    vec2 alpha2 = smoothstep(0.0, 1.0, v2);
    // subtract inner feathered square
    return (alpha.x * alpha.y) * (1.0 - (alpha2.x * alpha2.y));
}

// Calculates the minimum distance to a hexagon of a given radius
float distHex(vec2 r, float radius) {
    float height = radius * SIN_60;
    // Compare two sides at a time
    float dist = max(r.y - height, -height - r.y);
    for (int i = 0; i < 2; i++) {
        // Rotate by 60 degrees
        r*= rot60;
        float currentDist = max(r.y - height, -height - r.y);
        dist = max(dist, currentDist);
    }
    return dist;
}

vec2 distHex(vec2 r, vec2 radius) {
    vec2 height = radius * SIN_60;
    // Compare two sides at a time
    vec2 dist = max(r.y - height, -height - r.y);
    for (int i = 0; i < 2; i++) {
        // Rotate by 60 degrees
        r*= rot60;
        vec2 currentDist = max(r.y - height, -height - r.y);
        dist = max(dist, currentDist);
    }
    return dist;
}

float featherRangeHex(vec2 r, float rMax) {
    float maxDist = distHex(r, rMax);
    float v = (uFeatherWidth - maxDist) / (2.0 * uFeatherWidth);
    return smoothstep(0.0, 1.0, v);
}

float featherRangeHex(vec2 r, float rMin, float rMax) {
    vec2 maxDist = distHex(r, vec2(rMax, rMin));
    vec2 v = (uFeatherWidth - maxDist) / (2.0 * uFeatherWidth);
    vec2 alpha = smoothstep(0.0, 1.0, v);
    return alpha.x * (1.0 - alpha.y);
}

void main() {
    vec2 posPixelSpace = (0.5 - gl_PointCoord) * (v_pointSize + uFeatherWidth);

    float rMax = v_pointSize * 0.5;
    float rMin = rMax - uLineThickness;
    bool shouldDrawPoint = false;
    float alpha = 1.0;
    switch (uShapeType) {
        case BOX_FILLED:
        alpha = featherRangeSquare(posPixelSpace, rMax);
        break;
        case BOX_LINED:
        alpha = featherRangeSquare(posPixelSpace, rMin, rMax);
        break;
        case CIRCLE_FILLED:
        alpha = featherRange(posPixelSpace, rMax);
        break;
        case CIRCLE_LINED:
        alpha = featherRange(posPixelSpace, rMin, rMax);
        break;
        case HEXAGON_FILLED:
        alpha = featherRangeHex(posPixelSpace, rMax);
        break;
        case HEXAGON_LINED:
        alpha = featherRangeHex(posPixelSpace, rMin, rMax);
        break;
    }

    // Blending
    // outColor = vec4(v_colour.xyz, alpha);
    if (uCmapEnabled) {
        outColor = vec4(uPointColor, alpha);
    } else {
        outColor = vec4(uPointColor, alpha);
    }
}