#version 300 es
precision highp float;

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

#define SIN_0 0.0
#define COS_0 1.0
#define COS_45 0.70710678118
#define SIN_60 0.86602540378
#define COS_60 0.5
#define SIN_90 1.0
#define COS_90 0.0

#define FLT_MAX 3.402823466e+38

uniform float uLineThickness;
uniform highp int uShapeType;
uniform float uFeatherWidth;
uniform vec3 uPointColor;

// color map
uniform bool uCmapEnabled;
uniform sampler2D uCmapTexture;
uniform int uNumCmaps;
uniform int uCmapIndex;

in float v_colour;
in float v_pointSize;
out vec4 outColor;

mat2 rot45 = mat2(COS_45, -COS_45, COS_45, COS_45);
mat2 rot60 = mat2(COS_60, -SIN_60, SIN_60, COS_60);
mat2 rot90 = mat2(COS_90, -SIN_90, SIN_90, COS_90);
mat2 rot120 = mat2(-COS_60, -SIN_60, SIN_60, -COS_60);
mat2 rot180 = mat2(-COS_0, SIN_0, -SIN_0, -COS_0);

// Circle
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

// Ellipse
float featherRangeEllipse(vec2 r, float rMax) {
    float v =  ((1.0 / 3.0) * (pow(rMax, 2.0) - pow(r.x, 2.0)) - uFeatherWidth - pow(r.y, 2.0)) / (2.0 * uFeatherWidth);
    return smoothstep(0.0, 1.0, v);
}

float featherRangeEllipse(vec2 r, float rMin, float rMax) {
    float v = ((1.0 / 3.0) * (pow(rMax, 2.0) - pow(r.x, 2.0)) - uFeatherWidth - pow(r.y, 2.0)) / (4.0 * uFeatherWidth);
    float v2 = ((1.0 / 3.0) * (pow(rMin, 2.0) - pow(r.x, 2.0)) - uFeatherWidth - pow(r.y, 2.0)) / (4.0 * uFeatherWidth);
    float alpha = smoothstep(0.0, 1.0, v);
    float alpha2 = smoothstep(0.0, 1.0, v2);
    return alpha * (1.0 - alpha2);
}

// Square
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

// Rhomb
float featherRangeRhomb(vec2 r, float rMax) {
    float v = (rMax - abs(r.x) - uFeatherWidth - abs(r.y)) / (2.0 * uFeatherWidth);
    return smoothstep(0.0, 1.0, v);
}

float featherRangeRhomb(vec2 r, float rMin, float rMax) {
    float v = (rMax - abs(r.x) - uFeatherWidth - abs(r.y)) / (2.0 * uFeatherWidth);
    float v2 = (rMin - abs(r.x) - uFeatherWidth - abs(r.y)) / (2.0 * uFeatherWidth);
    float alpha = smoothstep(0.0, 1.0, v);
    float alpha2 = smoothstep(0.0, 1.0, v2);
    return alpha * (1.0 - alpha2);
}

// Hexagon
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

// Hexagon 2
float featherRangeHex2(vec2 r, float rMax) {
    r*= rot90;
    return featherRangeHex(r, rMax);
}

float featherRangeHex2(vec2 r, float rMin, float rMax) {
    r*= rot90;
    return featherRangeHex(r, rMin, rMax);
}

// Triangle Down
float distTriangleDown(vec2 r, float radius) {
    float height = radius * COS_60;
    float dist = r.y - height;
    for (int i = 0; i < 2; i++) {
        r*= rot120;
        float currentDist = r.y - height;
        dist = max(dist, currentDist);
    }
    return dist;
}

vec2 distTriangleDown(vec2 r, vec2 radius) {
    vec2 height = radius * COS_60;
    vec2 dist = r.y - height;
    for (int i = 0; i < 2; i++) {
        r*= rot120;
        vec2 currentDist = r.y - height;
        dist = max(dist, currentDist);
    }
    return dist;
}

float featherRangeTriangleDown(vec2 r, float rMax) {
    float maxDist = distTriangleDown(r, rMax);
    float v = (uFeatherWidth - maxDist) / (2.0 * uFeatherWidth);
    return smoothstep(0.0, 1.0, v);
}

float featherRangeTriangleDown(vec2 r, float rMin, float rMax) {
    vec2 maxDist = distTriangleDown(r, vec2(rMax, rMin));
    vec2 v = (uFeatherWidth - maxDist) / (2.0 * uFeatherWidth);
    vec2 alpha = smoothstep(0.0, 1.0, v);
    return alpha.x * (1.0 - alpha.y);
}

// Triangle Up
float featherRangeTriangleUp(vec2 r, float rMax) {
    r*= rot180;
    return featherRangeTriangleDown(r, rMax);
}

float featherRangeTriangleUp(vec2 r, float rMin, float rMax) {
    r*= rot180;
    return featherRangeTriangleDown(r, rMin, rMax);
}

// Cross
float featherRangeCross(vec2 r) {
    float lineThickness = uLineThickness * 0.5;
    if(r.y > -lineThickness && r.y < lineThickness){
        return 1.0;
    }
    if(r.x > -lineThickness && r.x < lineThickness){
        return 1.0;
    }
    return 0.0;
}

float featherRangeCrossLined(vec2 r) {
    float lineThickness = uLineThickness * 0.5;
    if(r.y > -lineThickness * 3.0 && r.y < -lineThickness && (r.x < -lineThickness || r.x > lineThickness)) {
        return 1.0;
    }

    if(r.y < lineThickness * 3.0 && r.y > lineThickness && (r.x < -lineThickness || r.x > lineThickness)) {
        return 1.0;
    }

    if(r.x > -lineThickness * 3.0 && r.x < -lineThickness && (r.y < -lineThickness || r.y > lineThickness)) {
        return 1.0;
    }

    if(r.x < lineThickness * 3.0 && r.x > lineThickness && (r.y < -lineThickness || r.y > lineThickness)) {
        return 1.0;
    }
    return 0.0;
}

// X
float featherRangeX(vec2 r) {
    float v1 = (abs(r.y) + uLineThickness + uFeatherWidth - abs(r.x)) / (2.0 * uFeatherWidth);
    float v2 = (abs(r.x) + uLineThickness - abs(r.y) - uFeatherWidth) / (2.0 * uFeatherWidth);
    float alpha1 = smoothstep(0.0, 1.0, v1);
    float alpha2 = smoothstep(0.0, 1.0, v2);
    return alpha1 * alpha2;
}

float featherRangeXLined(vec2 r) {
    r*= rot45;
    return featherRangeCrossLined(r);
}

bool isnan(float val) {
    return val != val;
}

void main() {
    vec2 posPixelSpace = (0.5 - gl_PointCoord) * (v_pointSize + uFeatherWidth);

    float rMax = v_pointSize * 0.5;
    // to do rmin < 0?
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
        case RHOMB_FILLED:
        alpha = featherRangeRhomb(posPixelSpace, rMax);
        break;
        case RHOMB_LINED:
        alpha = featherRangeRhomb(posPixelSpace, rMin, rMax);
        break;
        case TRIANGLE_FILLED_UP:
        alpha = featherRangeTriangleUp(posPixelSpace, rMax);
        break;
        case TRIANGLE_LINED_UP:
        alpha = featherRangeTriangleUp(posPixelSpace, rMin, rMax);
        break;
        case ELLIPSE_FILLED:
        alpha = featherRangeEllipse(posPixelSpace, rMax);
        break;
        case ELLIPSE_LINED:
        alpha = featherRangeEllipse(posPixelSpace, rMin, rMax);
        break;
        case TRIANGLE_FILLED_DOWN:
        alpha = featherRangeTriangleDown(posPixelSpace, rMax);
        break;
        case TRIANGLE_LINED_DOWN:
        alpha = featherRangeTriangleDown(posPixelSpace, rMin, rMax);
        break;
        case HEXAGON_FILLED_2:
        alpha = featherRangeHex2(posPixelSpace, rMax);
        break;
        case HEXAGON_LINED_2:
        alpha = featherRangeHex2(posPixelSpace, rMin, rMax);
        break;
        case CROSS_FILLED:
        alpha = featherRangeCross(posPixelSpace);
        break;
        case CROSS_LINED:
        alpha = featherRangeCrossLined(posPixelSpace);
        break;
        case X_FILLED:
        alpha = featherRangeX(posPixelSpace);
        break;
        case X_LINED:
        alpha = featherRangeXLined(posPixelSpace);
        break;
    }

    // Blending
    if (uCmapEnabled && !isnan(v_colour)) {
        float x = clamp(v_colour, 0.0, 1.0);
        float cmapYVal = (float(uCmapIndex) + 0.5) / float(uNumCmaps);
        vec2 cmapCoords = vec2(x, cmapYVal);
        outColor = vec4(texture(uCmapTexture, cmapCoords).xyz, alpha);
    } else {
        outColor = vec4(uPointColor, alpha);
    }
}