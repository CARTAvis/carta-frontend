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

out vec4 v_colour;
out vec2 v_location;
out float v_length;
out float v_timeOffset;

#define PI radians(180.0)

float calculateLength(float intensity) {
    float intensityRange = uIntensityMax - uIntensityMin;
    float scaledIntensity = (intensity - uIntensityMin) / intensityRange;
    return mix(uLengthMin, uLengthMax, clamp(scaledIntensity, 0.0, 1.0));
}


vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
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
    float angle = data.w;
    float cmapVal = mod(angle, PI);

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
    v_colour = vec4(hsv2rgb(vec3(cmapVal, 0.7, 0.7)), 1.0);
    v_timeOffset = sin(float(dataPointIndex) * 1.0);

    if (lineLength <= 0.0) {
        gl_Position = vec4(0);
    }

}