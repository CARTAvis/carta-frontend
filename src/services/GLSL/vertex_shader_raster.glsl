precision highp float;

//Data from bufferData
in vec3 aVertexPosition;
in vec2 aVertexUV;
out vec2 vUV;
uniform float uCanvasWidth;
uniform float uCanvasHeight;
uniform vec2 uRotationOrigin;
uniform float uRotationAngle;
uniform float uScaleAdjustment;
uniform float uPixelAspectRatio;

// Tiling parameters
uniform vec2 uTileSize;
uniform vec2 uTileScaling;
uniform vec2 uTileOffset;
uniform vec2 uTileTextureSize;

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
    tilePosition = scaleAboutPoint2D(tilePosition, uRotationOrigin, uScaleAdjustment);

    // Handle pixel rounding while respecting pixel aspect ratios
    vec2 roundingVector = vec2(1.0, 1.0);
    if (uPixelAspectRatio > 1.0) {
        roundingVector = vec2(uPixelAspectRatio, 1.0);
    } else if (uPixelAspectRatio < 1.0) {
        roundingVector = vec2(1.0, 1.0/uPixelAspectRatio);
    }
    tilePosition = floor(tilePosition * roundingVector) / roundingVector;

    // convert XY from canvas space to [-1, 1]
    vec2 adjustedPosition = vec2(tilePosition.x / (uCanvasWidth / uPixelAspectRatio), tilePosition.y / uCanvasHeight) * 2.0 - 1.0;
    gl_Position = vec4(adjustedPosition.x, adjustedPosition.y, aVertexPosition.z, 1.0);
    vUV = aVertexUV * uTileSize / uTileTextureSize;
}