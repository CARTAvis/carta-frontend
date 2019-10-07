//Data from bufferData
attribute vec2 aVertexPosition;
attribute float aVertexLength;

uniform vec2 uScale;
uniform vec2 uOffset;

varying float vLinePosition;

void main(void) {
    // Convert position to GL space
    vec2 pos = aVertexPosition * uScale + uOffset;
    vLinePosition = aVertexLength;
    gl_Position =  vec4(pos.x, pos.y, 0.0, 1.0);
}