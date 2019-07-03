precision highp float;

//Data from bufferData
attribute vec3 aVertexPosition;
attribute vec2 aVertexUV;
varying vec2 vUV;
// Tiling parameters
uniform bool uTiledRendering;
uniform vec2 uTileSize;
uniform vec2 uTileScaling;
uniform vec2 uTileOffset;

void main(void) {
    if (uTiledRendering) {
        vec2 tilePosition = aVertexPosition.xy * uTileScaling * uTileSize + uTileOffset;
        // Convert XY from [0, 1] -> [-1, 1]
        vec2 adjustedPosition = tilePosition * 2.0 - 1.0;
        gl_Position = vec4(adjustedPosition.x, adjustedPosition.y, aVertexPosition.z, 1.0);
        vUV = aVertexUV * uTileSize;
    } else {
        gl_Position =  vec4(aVertexPosition, 1.0);
        vUV = aVertexUV;
    }
}