precision highp float;

//Data from buffers
attribute vec3 aVertexPosition;
attribute vec2 aVertexNormal;

uniform vec2 uScale;
uniform vec2 uOffset;
uniform vec2 uRotationOrigin;
uniform float uRotationAngle;
uniform float uLineThickness;
uniform float uScaleAdjustment;

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
    // Convert position to GL space
    vec2 posImageSpace = (aVertexPosition.xy + (aVertexNormal / 16384.0) * uLineThickness * 0.5);
    vec2 posRefSpace = scaleAboutPoint2D(rotateAboutPoint2D(posImageSpace, uRotationOrigin, uRotationAngle), uRotationOrigin, uScaleAdjustment);
    vec2 pos = posRefSpace * uScale + uOffset;
    vLineSide = sign(aVertexPosition.z);
    vLinePosition = abs(aVertexPosition.z);
    gl_Position =  vec4(pos.x, pos.y, 0.0, 1.0);
}