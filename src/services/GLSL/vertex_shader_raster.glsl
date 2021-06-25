precision highp float;

//Data from bufferData
attribute vec3 aVertexPosition;
attribute vec2 aVertexUV;
varying vec2 vUV;
uniform float uCanvasWidth;
uniform float uCanvasHeight;
uniform vec2 uRotationOrigin;
uniform float uRotationAngle;
uniform float uScaleAdjustment;
// Tiling parameters
uniform vec2 uTileSize;
uniform vec2 uTileScaling;
uniform vec2 uTileOffset;
uniform float uTileTextureSize;

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
    vec2 tilePosition = aVertexPosition.xy * uTileScaling * uTileSize + uTileOffset;
    tilePosition = rotateAboutPoint2D(tilePosition, uRotationOrigin, uRotationAngle);
    // adjust based on pixel scales
    tilePosition = floor(scaleAboutPoint2D(tilePosition, uRotationOrigin, uScaleAdjustment));
    // convert XY from canvas space to [-1, 1]
    vec2 adjustedPosition = vec2(tilePosition.x / uCanvasWidth, tilePosition.y / uCanvasHeight) * 2.0 - 1.0;
    gl_Position = vec4(adjustedPosition.x, adjustedPosition.y, aVertexPosition.z, 1.0);
    vUV = aVertexUV * uTileSize / (uTileTextureSize + 1.0);
}