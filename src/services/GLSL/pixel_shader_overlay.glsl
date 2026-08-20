precision highp float;

uniform vec2 uZoomLevel;
uniform float uScaleAdjustment;
uniform float uCanvasSpaceLineWidth;
uniform float uFeatherWidth;
uniform bool uIntensityPlot;

in vec4 v_colour;
in vec2 v_location;
in float v_length;

out vec4 outColor;

void main() {
    float W = uIntensityPlot ? v_length : uCanvasSpaceLineWidth / (uZoomLevel.y * uScaleAdjustment);
    float L = v_length;
    float F = uFeatherWidth / uZoomLevel.y;
    float Fx = F;
    float x = abs(v_location.x);
    float y = abs(v_location.y);
    float alphaX, alphaY;
    if (x < 0.5 * W - Fx) {
        alphaX = 1.0;
    } else {
        alphaX = 1.0 - smoothstep(x, 0.5 * W - Fx, 0.5 * W + Fx);
    }

    if (y < 0.5 * L - F) {
        alphaY = 1.0;
    } else {
        alphaY = 1.0 - smoothstep(y, 0.5 * L - F, 0.5 * L + F);
    }

    float alpha = alphaX * alphaY;
    outColor = vec4(v_colour.rgb, v_colour.a * alpha);
}
