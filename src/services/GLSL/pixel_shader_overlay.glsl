precision highp float;

uniform float uZoomLevel;
uniform float uCanvasSpaceLineWidth;
uniform float uFeatherWidth;
uniform bool uIntensityPlot;

in vec4 v_colour;
in vec2 v_location;
in float v_length;
in float v_timeOffset;

out vec4 outColor;

void main() {
    float W = uIntensityPlot ? v_length : uCanvasSpaceLineWidth / uZoomLevel;
    float L = v_length;
    float F = uFeatherWidth;
    float x = abs(v_location.x);
    float y = abs(v_location.y);
    float alphaX, alphaY;
    if (x < 0.5 * W - F) {
        alphaX = 1.0;
    } else {
        alphaX = 1.0 - smoothstep(x, 0.5 * W - F, 0.5 * W + F);
    }

    if (y < 0.5 * L - F) {
        alphaY = 1.0;
    } else {
        alphaY = 1.0 - smoothstep(y, 0.5 * L - F, 0.5 * L + F);
    }

    float alpha = alphaX * alphaY;
    outColor = vec4(v_colour.rgb, v_colour.a * alpha);
}