precision highp float;

//Data from buffers
attribute vec3 aVertexPosition;
attribute vec2 aVertexNormal;

uniform vec2 uRangeScale;
uniform vec2 uRangeOffset;
uniform vec2 uRotationOrigin;
uniform float uRotationAngle;
uniform float uScaleAdjustment;
uniform float uLineThickness;

// Control-map based transformation
uniform int uControlMapEnabled;
uniform vec2 uControlMapMin;
uniform vec2 uControlMapMax;
uniform vec2 uControlMapSize;
uniform sampler2D uControlMapTexture;

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

// Based on NVIDIA GPU Gems 2 Chapter "Fast Third-Order Texture Filtering"
// Adapted from GLSL code available at https://stackoverflow.com/questions/13501081/efficient-bicubic-filtering-code-in-glsl/13502446#13502446
// The basic idea is to utilise the GPU's fixed-function bilinear filtering to perform four samples at once,
// rather than sampling the texture 16 times. This should help GPU performance on lower-end hardware

vec4 cubic(float x) {
    float x2 = x * x;
    float x3 = x2 * x;
    vec4 w;
    w.x = -x3 + 3.0 * x2 - 3.0 * x + 1.0;
    w.y = 3.0 * x3 - 6.0 * x2 + 4.0;
    w.z = -3.0 * x3 + 3.0 * x2 + 3.0 * x + 1.0;
    w.w = x3;
    return w / 6.0;
}

vec4 bicubicFilter(sampler2D texture, vec2 texcoord, vec2 texscale) {
    float fx = fract(texcoord.x);
    float fy = fract(texcoord.y);
    texcoord.x -= fx;
    texcoord.y -= fy;

    vec4 xcubic = cubic(fx);
    vec4 ycubic = cubic(fy);

    vec4 c = vec4(texcoord.x - 0.5, texcoord.x + 1.5, texcoord.y - 0.5, texcoord.y + 1.5);
    vec4 s = vec4(xcubic.x + xcubic.y, xcubic.z + xcubic.w, ycubic.x + ycubic.y, ycubic.z + ycubic.w);
    vec4 offset = c + vec4(xcubic.y, xcubic.w, ycubic.y, ycubic.w) / s;

    vec4 sample0 = texture2D(texture, vec2(offset.x, offset.z) * texscale);
    vec4 sample1 = texture2D(texture, vec2(offset.y, offset.z) * texscale);
    vec4 sample2 = texture2D(texture, vec2(offset.x, offset.w) * texscale);
    vec4 sample3 = texture2D(texture, vec2(offset.y, offset.w) * texscale);

    float sx = s.x / (s.x + s.y);
    float sy = s.z / (s.z + s.w);

    return mix(mix(sample3, sample2, sx), mix(sample1, sample0, sx), sy);
}

// end adapted from NVIDIA GPU Gems 2

vec2 controlMapLookup(vec2 pos) {
    vec2 texScale = 1.0 / uControlMapSize;
    vec2 range = uControlMapMax - uControlMapMin;
    vec2 shiftedPoint = pos - uControlMapMin;
    vec2 index = uControlMapSize * (shiftedPoint) / range;
    return bicubicFilter(uControlMapTexture, index, texScale).ra;
}

void main(void) {

    // Shift by half a pixel to account for position of pixel center
    vec2 posImageSpace = aVertexPosition.xy + 0.5;

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