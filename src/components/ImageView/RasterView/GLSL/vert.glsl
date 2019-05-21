//Data from bufferData
attribute vec3 aVertexPosition;
attribute vec2 aVertexUV;
varying vec2 vUV;

// Tiling parameters
uniform float uTileWidthCutoff;
uniform float uTileHeightCutoff;

void main(void) {
    gl_Position =  vec4(min(aVertexPosition.x, uTileWidthCutoff * 2.0 - 1.0), min(aVertexPosition.y, uTileHeightCutoff * 2.0 - 1.0), aVertexPosition.z, 1.0);
    vUV = vec2(min(aVertexUV.x, uTileWidthCutoff), min(aVertexUV.y, uTileHeightCutoff));
}