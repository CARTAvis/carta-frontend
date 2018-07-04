//Data from bufferData
attribute vec3 aVertexPosition;
attribute vec2 aVertexUV;
varying vec2 vUV;

void main(void) {
    gl_Position =  vec4(aVertexPosition, 1.0);
    vUV = aVertexUV;
}