precision highp float;

//Data from buffers
attribute vec3 aVertexPosition;
attribute vec2 aVertexNormal;

uniform vec2 uRangeScale;
uniform vec2 uRangeOffset;
uniform vec2 uRotationOrigin;
uniform float uRotationAngle;
uniform float uScaleAdjustment;
uniform vec2 uLineThickness;

// Control-map based transformation
uniform int uControlMapEnabled;
uniform vec2 uControlMapMin;
uniform vec2 uControlMapMax;
uniform vec2 uControlMapSize;
uniform highp sampler2D uControlMapTexture;

varying float vLinePosition;
varying float vLineSide;

vec2 rotate2D(vec2 vector, float theta) {
    float sinTheta = sin(theta);
    float cosTheta = cos(theta);
    return mat2(cosTheta, -sinTheta, sinTheta, cosTheta) * vector;
}

vec2 scaleAndRotate2D(vec2 vector, float theta, float scale) {
    return rotate2D(vector, theta) * scale;
}

// Adapted from https://www.shadertoy.com/view/MllSzX to work with non-square vec4 textures of variable size

vec4 cubic(vec4 A, vec4 B, vec4 C, vec4 D, float t) {
    float t2 = t * t;
    float t3 = t * t * t;
    vec4 a = -A / 2.0 + (3.0 * B) / 2.0 - (3.0 * C) / 2.0 + D / 2.0;
    vec4 b = A - (5.0 * B) / 2.0 + 2.0 * C - D / 2.0;
    vec4 c = -A / 2.0 + C / 2.0;
    vec4 d = B;

    return a * t3 + b * t2 + c * t + d;
}

vec4 bicubicFilter(sampler2D texture, vec2 P) {
    // Calculate offset and base pixel coordiante
    vec2 pixelSize = 1.0 / uControlMapSize;
    vec2 pixel = P * uControlMapSize + 0.5;
    vec2 frac = fract(pixel);
    pixel = floor(pixel) / uControlMapSize - pixelSize / 2.0;

    // Texture lookups
    vec4 C00 = texture2D(texture, pixel + pixelSize * vec2(-1.0, -1.0));
    vec4 C10 = texture2D(texture, pixel + pixelSize * vec2(0.0, -1.0));
    vec4 C20 = texture2D(texture, pixel + pixelSize * vec2(1.0, -1.0));
    vec4 C30 = texture2D(texture, pixel + pixelSize * vec2(2.0, -1.0));

    vec4 C01 = texture2D(texture, pixel + pixelSize * vec2(-1.0, 0.0));
    vec4 C11 = texture2D(texture, pixel + pixelSize * vec2(0.0, 0.0));
    vec4 C21 = texture2D(texture, pixel + pixelSize * vec2(1.0, 0.0));
    vec4 C31 = texture2D(texture, pixel + pixelSize * vec2(2.0, 0.0));

    vec4 C02 = texture2D(texture, pixel + pixelSize * vec2(-1.0, 1.0));
    vec4 C12 = texture2D(texture, pixel + pixelSize * vec2(0.0, 1.0));
    vec4 C22 = texture2D(texture, pixel + pixelSize * vec2(1.0, 1.0));
    vec4 C32 = texture2D(texture, pixel + pixelSize * vec2(2.0, 1.0));

    vec4 C03 = texture2D(texture, pixel + pixelSize * vec2(-1.0, 2.0));
    vec4 C13 = texture2D(texture, pixel + pixelSize * vec2(0.0, 2.0));
    vec4 C23 = texture2D(texture, pixel + pixelSize * vec2(1.0, 2.0));
    vec4 C33 = texture2D(texture, pixel + pixelSize * vec2(2.0, 2.0));

    // Cubic along x
    vec4 CP0X = cubic(C00, C10, C20, C30, frac.x);
    vec4 CP1X = cubic(C01, C11, C21, C31, frac.x);
    vec4 CP2X = cubic(C02, C12, C22, C32, frac.x);
    vec4 CP3X = cubic(C03, C13, C23, C33, frac.x);

    // Final cubic along y
    return cubic(CP0X, CP1X, CP2X, CP3X, frac.y);
}

// end adapted from https://www.shadertoy.com/view/MllSzX

vec2 controlMapLookup(vec2 pos) {
    vec2 texScale = 1.0 / uControlMapSize;
    vec2 range = uControlMapMax - uControlMapMin;
    vec2 shiftedPoint = pos - uControlMapMin;
    vec2 index = shiftedPoint / range + 0.5 / uControlMapSize;
    return bicubicFilter(uControlMapTexture, index).ra;
}

void main(void) {

    // Shift by half a pixel to account for position of pixel center
    vec2 posImageSpace = aVertexPosition.xy - 0.5;

    // Calculate extrusion vector and distance
    vec2 extrudeOffet = (aVertexNormal / 16384.0) * uLineThickness * 0.5;
    float extrudeDistance = length(extrudeOffet);

    // If there's a control map, use it to look up location using bilinear filtering
    if (uControlMapEnabled > 0) {
        // Use an offset of 10% of the grid spacing to estimate the direction of the normal
        vec2 deltaVec = 0.1 * (uControlMapMax - uControlMapMin) / uControlMapSize;
        // Use a minimum of 10% in X and 10% in Y directions
        float delta = min(deltaVec.x, deltaVec.y);
        vec2 extrudedPoint = controlMapLookup(posImageSpace + normalize(extrudeOffet) * delta);
        posImageSpace = controlMapLookup(posImageSpace);
        vec2 transformedNormal = extrudedPoint - posImageSpace;
        // Ensure consistent extrusion distance
        posImageSpace += extrudeDistance * normalize(transformedNormal);
    } else {
        // Extrude point along normal
        posImageSpace += extrudeOffet;
    }

    // Scale and rotate
    vec2 posRefSpace = scaleAndRotate2D(posImageSpace, uRotationAngle, uScaleAdjustment);
    // Convert from image space to GL space [-1, 1]
    vec2 adjustedPosition = (posRefSpace * uRangeScale + uRangeOffset) * 2.0 - 1.0;

    vLineSide = sign(aVertexPosition.z);
    vLinePosition = abs(aVertexPosition.z);
    gl_Position = vec4(adjustedPosition.x, adjustedPosition.y, 0.0, 1.0);
}