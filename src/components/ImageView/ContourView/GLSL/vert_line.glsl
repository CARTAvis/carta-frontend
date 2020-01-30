precision highp float;

//Data from buffers
attribute vec3 aVertexPosition;
attribute vec2 aVertexNormal;

uniform vec2 uFrameMin;
uniform vec2 uFrameMax;
uniform vec2 uRotationOrigin;
uniform float uRotationAngle;
uniform float uScaleAdjustment;
uniform vec2 uOffset;
uniform float uLineThickness;

// Control-map based transformation
uniform int uControlMapEnabled;
uniform vec2 uControlMapMin;
uniform vec2 uControlMapMax;
uniform vec2 uControlMapSize;
uniform sampler2D uControlMapTextureX;
uniform sampler2D uControlMapTextureY;

varying float vLinePosition;
varying float vLineSide;

vec2 rotate2D(vec2 vector, float theta) {
    float sinTheta = sin(theta);
    float cosTheta = cos(theta);
    return mat2(cosTheta, -sinTheta, sinTheta, cosTheta) * vector;
}

vec2 rotateAboutPoint2D(vec2 vector, vec2 origin, float theta) {
    return rotate2D(vector - origin, theta) + origin;
}

vec2 scaleAboutPoint2D(vec2 vector, vec2 origin, float scale) {
    return (vector - origin) * scale + origin;
}

// Based on NVIDIA GPU Gems 2 Chapter "Fast Third-Order Texture Filtering"
// Adapted from GLSL code available at https://stackoverflow.com/questions/13501081/efficient-bicubic-filtering-code-in-glsl/13502446#13502446
// The basic idea is to utilise the GPU's fixed-function bilinear filtering to perform four samples at once,
// rather than sampling the texture 16 times. This should help GPU performance on lower-end hardware

vec4 cubic(float x) {
    float x2 = x * x;
    float x3 = x2 * x;
    vec4 w;
    w.x =   -x3 + 3.0*x2 - 3.0*x + 1.0;
    w.y =  3.0*x3 - 6.0*x2       + 4.0;
    w.z = -3.0*x3 + 3.0*x2 + 3.0*x + 1.0;
    w.w =  x3;
    return w / 6.0;
}


vec4 bicubicFilter(sampler2D texture, vec2 texcoord, vec2 texscale) {
    float fx = fract(texcoord.x);
    float fy = fract(texcoord.y);
    texcoord.x -= fx;
    texcoord.y -= fy;

    vec4 xcubic = cubic(fx);
    vec4 ycubic = cubic(fy);

    vec4 c = vec4(texcoord.x - 0.5, texcoord.x + 1.5, texcoord.y -
    0.5, texcoord.y + 1.5);
    vec4 s = vec4(xcubic.x + xcubic.y, xcubic.z + xcubic.w, ycubic.x +
    ycubic.y, ycubic.z + ycubic.w);
    vec4 offset = c + vec4(xcubic.y, xcubic.w, ycubic.y, ycubic.w) /
    s;

    vec4 sample0 = texture2D(texture, vec2(offset.x, offset.z) *
    texscale);
    vec4 sample1 = texture2D(texture, vec2(offset.y, offset.z) *
    texscale);
    vec4 sample2 = texture2D(texture, vec2(offset.x, offset.w) *
    texscale);
    vec4 sample3 = texture2D(texture, vec2(offset.y, offset.w) *
    texscale);

    float sx = s.x / (s.x + s.y);
    float sy = s.z / (s.z + s.w);

    return mix(
    mix(sample3, sample2, sx),
    mix(sample1, sample0, sx), sy);
}

void main(void) {
    // Extrude point along normal
    vec2 posImageSpace = (aVertexPosition.xy + (aVertexNormal / 16384.0) * uLineThickness * 0.5);
    // Shift by half a pixel to account for position of pixel center
    posImageSpace += 0.5;

    // If there's a control map, use it to look up location using bilinear filtering
    if (uControlMapEnabled > 0) {
        vec2 texScale = 1.0 / uControlMapSize;
        vec2 range = uControlMapMax - uControlMapMin;
        vec2 shiftedPoint = posImageSpace - uControlMapMin;
        vec2 index = uControlMapSize * (shiftedPoint) / range;
        posImageSpace = vec2(bicubicFilter(uControlMapTextureX, index, texScale).r, bicubicFilter(uControlMapTextureY, index, texScale).r);
    }

    // Scale and rotate
    vec2 posRefSpace = scaleAboutPoint2D(rotateAboutPoint2D(posImageSpace, uRotationOrigin, uRotationAngle), uRotationOrigin, uScaleAdjustment) + uOffset;

    // Convert from image space to GL space [-1, 1]
    vec2 range = uFrameMax - uFrameMin;
    vec2 adjustedPosition = vec2((posRefSpace.x - uFrameMin.x) / range.x, (posRefSpace.y - uFrameMin.y) / range.y) * 2.0 - 1.0;

    vLineSide = sign(aVertexPosition.z);
    vLinePosition = abs(aVertexPosition.z);
    gl_Position =  vec4(adjustedPosition.x, adjustedPosition.y, 0.0, 1.0);
}