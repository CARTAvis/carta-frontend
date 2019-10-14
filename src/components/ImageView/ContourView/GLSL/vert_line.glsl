//Data from buffers
attribute vec2 aVertexPosition;
attribute vec2 aVertexNormal;
attribute float aVertexLength;

uniform vec2 uScale;
uniform vec2 uOffset;
uniform float uLineThickness;

varying float vLinePosition;

void main(void) {
    // Convert position to GL space
    vec2 pos = (aVertexPosition + aVertexNormal * uLineThickness * 0.5) * uScale + uOffset;
    vLinePosition = aVertexLength;
    gl_Position =  vec4(pos.x, pos.y, 0.0, 1.0);
    gl_PointSize = 3.0;
}