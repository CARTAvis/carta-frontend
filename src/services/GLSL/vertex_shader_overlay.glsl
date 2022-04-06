precision highp float;

uniform vec2 uFrameViewMin;
uniform vec2 uFrameViewMax;
uniform float uZoomLevel;
uniform float uCanvasSpaceLineWidth;
uniform float uFeatherWidth;
uniform sampler2D uDataTexture;
uniform bool uIntensityPlot;

// Length scaling
uniform float uLengthMin;
uniform float uLengthMax;
uniform float uIntensityMin;
uniform float uIntensityMax;

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

// Get vertex offset in units of length, based on the vertex ID
vec2 getOffsetFromId(int id) {
    int index = id % 6;
    switch(index) {
        // First triangle is TRC, TLC, BRC
        case 0:
        return vec2(0.5, 0.5);
        case 1:
        return vec2(-0.5, 0.5);
        case 2:
        return vec2(0.5, -0.5);
        // Second triangle is BRC, TLC, BLC
        case 3:
        return vec2(0.5, -0.5);
        case 4:
        return vec2(-0.5, 0.5);
        case 5:
        default:
        return vec2(-0.5, -0.5);
    }
}

vec2 imageToGL2(vec2 imageVec) {
    return 2.0 * (imageVec - uFrameViewMin) / (uFrameViewMax - uFrameViewMin) - 1.0;
}

void main() {
    int dataPointIndex = gl_VertexID / 6;
    vec4 data = getValueByIndexFromTexture(uDataTexture, dataPointIndex);
    vec2 centerPoint = data.xy;
    float lineLength = calculateLength(data.z) / uZoomLevel;
    float lineWidth = uCanvasSpaceLineWidth / uZoomLevel;
    float angle = data.w * PI / 180.0;

    if (uIntensityPlot) {
        angle = 0.0;
        lineWidth = lineLength;
    }

    vec2 offset = getOffsetFromId(gl_VertexID);
    offset = vec2((lineWidth + uFeatherWidth / uZoomLevel) * offset.x, (lineLength + uFeatherWidth / uZoomLevel) * offset.y);
    // location vertex attribute is in line space before rotation
    v_location = offset;
    // position is in canvas space
    gl_Position = vec4(imageToGL2(centerPoint + rotate2D(offset, angle)), 0, 1);
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