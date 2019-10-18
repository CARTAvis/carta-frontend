precision highp float;

//Data from buffers
attribute vec2 aVertexPosition;
attribute vec2 aVertexNormal;
attribute float aVertexLength;

uniform vec2 uScale;
uniform vec2 uOffset;
uniform float uLineThickness;

varying float vLinePosition;
varying float vLineSide;

void main(void) {
    // Convert position to GL space
    vec2 pos = (aVertexPosition + aVertexNormal * uLineThickness * 0.5) * uScale + uOffset;
    vLineSide = sign(aVertexLength);
    vLinePosition = abs(aVertexLength);
    gl_Position =  vec4(pos.x, pos.y, 0.0, 1.0);
}