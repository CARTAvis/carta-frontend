precision highp float;

//Data from buffers
attribute vec3 aVertexPosition;
attribute vec2 aVertexNormal;

uniform vec2 uScale;
uniform vec2 uOffset;
uniform float uLineThickness;

varying float vLinePosition;
varying float vLineSide;

void main(void) {
    // Convert position to GL space
    vec2 pos = (aVertexPosition.xy + (aVertexNormal / 16384.0) * uLineThickness * 0.5) * uScale + uOffset;
    vLineSide = sign(aVertexPosition.z);
    vLinePosition = abs(aVertexPosition.z);
    gl_Position =  vec4(pos.x, pos.y, 0.0, 1.0);
}