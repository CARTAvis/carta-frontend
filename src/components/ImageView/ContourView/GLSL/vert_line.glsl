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

void main(void) {
    // Extrude point along normal
    vec2 posImageSpace = (aVertexPosition.xy + (aVertexNormal / 16384.0) * uLineThickness * 0.5);
    // Shift by half a pixel to account for position of pixel center
    posImageSpace += 0.5;

    // If there's a control map, use it to look up location using bilinear filtering
    if (uControlMapEnabled > 0) {
        vec2 range = uControlMapMax - uControlMapMin;
        vec2 shiftedPoint = posImageSpace - uControlMapMin;
        vec2 index = (shiftedPoint) / range + 0.5 / uControlMapSize;
        posImageSpace = vec2(texture2D(uControlMapTextureX, index).r, texture2D(uControlMapTextureY, index).r);
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