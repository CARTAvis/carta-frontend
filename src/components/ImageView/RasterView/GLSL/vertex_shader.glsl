precision highp float;

//Data from bufferData
attribute vec3 aVertexPosition;
attribute vec2 aVertexUV;
varying vec2 vUV;
uniform float uCanvasWidth;
uniform float uCanvasHeight;
// Tiling parameters
uniform bool uTiledRendering;
uniform vec2 uTileSize;
uniform vec2 uTileScaling;
uniform vec2 uTileOffset;
uniform float uTileTextureSize;

void main(void) {
    if (uTiledRendering) {
        vec2 tilePosition = aVertexPosition.xy * uTileScaling * uTileSize + uTileOffset;
        // convert XY from canvas space to [-1, 1]
        vec2 adjustedPosition = vec2(tilePosition.x / uCanvasWidth, tilePosition.y / uCanvasHeight) * 2.0 - 1.0;
        gl_Position = vec4(adjustedPosition.x, adjustedPosition.y, aVertexPosition.z, 1.0);
        vUV = aVertexUV * uTileSize / uTileTextureSize;
    } else {
        gl_Position =  vec4(aVertexPosition, 1.0);
        vUV = aVertexUV;
    }
}