precision highp float;

uniform vec2 uRangeScale;
uniform vec2 uRangeOffset;
uniform float uRotationOffset;
uniform float uRotationAngle;
uniform float uScaleAdjustment;
uniform vec2 uZoomLevel;
uniform float uPixelRatio;
uniform float uCanvasSpaceLineWidth;
uniform float uFeatherWidth;
uniform sampler2D uDataTexture;
uniform bool uIntensityPlot;

// Length scaling
uniform float uLengthMin;
uniform float uLengthMax;
uniform float uIntensityMin;
uniform float uIntensityMax;

// Control-map based transformation
uniform int uControlMapEnabled;
uniform vec2 uControlMapMin;
uniform vec2 uControlMapMax;
uniform vec2 uControlMapSize;
uniform highp sampler2D uControlMapTexture;

// Color
uniform vec4 uLineColor;
uniform int uCmapEnabled;
uniform sampler2D uCmapTexture;
uniform float uCmapValue;
uniform int uNumCmaps;
uniform int uCmapIndex;
uniform float uBias;
uniform float uContrast;

out vec4 v_colour;
out vec2 v_location;
out float v_length;

#define PI radians(180.0)

float calculateScaledIntensity(float intensity) {
    float intensityRange = uIntensityMax - uIntensityMin;
    float scaledIntensity = (intensity - uIntensityMin) / intensityRange;
    return scaledIntensity;
}
float calculateLength(float intensity) {
    return mix(uLengthMin, uLengthMax, clamp(calculateScaledIntensity(intensity), 0.0, 1.0));
}

void main() {
    int dataPointIndex = gl_VertexID / 6;
    vec4 data = getValueByIndexFromTexture(uDataTexture, dataPointIndex);
    vec2 centerPoint = data.xy;

    if (uControlMapEnabled > 0) {
        centerPoint = controlMapLookup(uControlMapTexture, centerPoint, uControlMapSize, uControlMapMin, uControlMapMax);
    }

    float lineLength = calculateLength(data.z);
    float lineWidth = uCanvasSpaceLineWidth;
    float angle = -data.w * PI / 180.0 - uRotationAngle - uRotationOffset;

    if (uIntensityPlot) {
        angle = -uRotationAngle;
        lineWidth = lineLength;
    }

    vec2 offset = getOffsetFromId(gl_VertexID);
    float featherWidth = uFeatherWidth;
    offset = vec2((lineWidth + featherWidth) * offset.x, (lineLength + featherWidth) * offset.y);
    // location vertex attribute is in line space before rotation
    v_location = offset;
    // Build a screen-space rectangle from the image-space direction. This keeps the
    // edges perpendicular while allowing anisotropic zoom to change the line slope.
    vec2 referenceDirection = rotate2D(vec2(0.0, 1.0), angle + uRotationAngle);
    vec2 screenDirection = normalize(vec2(uPixelRatio * uZoomLevel.x * referenceDirection.x, uZoomLevel.y * referenceDirection.y));
    vec2 screenNormal = vec2(-screenDirection.y, screenDirection.x);
    vec2 screenOffset = offset.x * screenNormal + offset.y * screenDirection;

    // Convert the screen-space offset back into image space before applying the
    // frame's spatial transform below.
    vec2 referenceOffset = vec2(screenOffset.x / (uPixelRatio * uZoomLevel.x), screenOffset.y / uZoomLevel.y);
    vec2 positionOffset = rotate2D(referenceOffset, -uRotationAngle) / uScaleAdjustment;
    vec2 posImageSpace = centerPoint + positionOffset;
    vec2 posRefSpace = scaleAndRotate2D(posImageSpace, uRotationAngle, uScaleAdjustment);
    // Convert from image space to GL space [-1, 1]
    vec2 adjustedPosition = (posRefSpace * uRangeScale + uRangeOffset) * 2.0 - 1.0;

    gl_Position = vec4(adjustedPosition.x, adjustedPosition.y, 0, 1);
    v_length = lineLength;

    if (uCmapEnabled > 0) {
        float x = calculateScaledIntensity(data.z);
        // bias mod
        x = clamp(x - uBias, 0.0, 1.0);
        // contrast mod
        x = clamp((x - 0.5) * uContrast + 0.5, 0.0, 1.0);
        float cmapYVal = (float(uCmapIndex) + 0.5) / float(uNumCmaps);
        vec2 cmapCoords = vec2(x, cmapYVal);
        v_colour = texture(uCmapTexture, cmapCoords);
    } else {
        v_colour = uLineColor;
    }

    if (lineLength <= 0.0) {
        gl_Position = vec4(0);
    }

}
