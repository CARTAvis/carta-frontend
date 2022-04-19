precision highp float;

//Data from buffers
in vec3 aVertexPosition;
in vec2 aVertexNormal;

uniform vec2 uRangeScale;
uniform vec2 uRangeOffset;
uniform float uRotationAngle;
uniform float uScaleAdjustment;
uniform float uLineThickness;
uniform float uPixelRatio;

// Control-map based transformation
uniform int uControlMapEnabled;
uniform vec2 uControlMapMin;
uniform vec2 uControlMapMax;
uniform vec2 uControlMapSize;
uniform highp sampler2D uControlMapTexture;

out float vLinePosition;
out float vLineSide;

void main(void) {

    // Shift by half a pixel to account for position of pixel center
    vec2 posImageSpace = aVertexPosition.xy - 0.5;

    // Calculate extrusion vector and distance
    vec2 extrudeOffet = vec2(1.0 / uPixelRatio, 1.0) * (aVertexNormal / 16384.0) * uLineThickness * 0.5;
    float extrudeDistance = length(extrudeOffet);

    // If there's a control map, use it to look up location using bilinear filtering
    if (uControlMapEnabled > 0) {
        // Use an offset of 10% of the grid spacing to estimate the direction of the normal
        vec2 deltaVec = 0.1 * (uControlMapMax - uControlMapMin) / uControlMapSize;
        // Use a minimum of 10% in X and 10% in Y directions
        float delta = min(deltaVec.x, deltaVec.y);
        vec2 extrudedPoint = controlMapLookup(uControlMapTexture, posImageSpace + normalize(extrudeOffet) * delta, uControlMapSize, uControlMapMin, uControlMapMax);
        posImageSpace = controlMapLookup(uControlMapTexture, posImageSpace, uControlMapSize, uControlMapMin, uControlMapMax);
        vec2 transformedNormal = extrudedPoint - posImageSpace;
        // Ensure consistent extrusion distance
        posImageSpace += extrudeDistance * normalize(transformedNormal);
    } else {
        // Extrude point along normal
        posImageSpace += extrudeOffet;
    }

    // Scale and rotate
    vec2 posRefSpace = scaleAndRotate2D(posImageSpace, uRotationAngle, uScaleAdjustment);
    // Convert from image space to GL space [-1, 1]
    vec2 adjustedPosition = (posRefSpace * uRangeScale + uRangeOffset) * 2.0 - 1.0;

    vLineSide = sign(aVertexPosition.z);
    vLinePosition = abs(aVertexPosition.z);
    gl_Position = vec4(adjustedPosition.x, adjustedPosition.y, 0.0, 1.0);
}