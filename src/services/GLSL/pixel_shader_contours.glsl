precision highp float;

in float vLinePosition;
in float vLineSide;
out vec4 outColor;

uniform float uDashLength;
uniform vec4 uLineColor;
uniform int uCmapEnabled;

uniform sampler2D uCmapTexture;
uniform float uCmapValue;
uniform int uNumCmaps;
uniform int uCmapIndex;
uniform float uBias;
uniform float uContrast;

void main(void) {
    float dashStrength;
    // Modulate dash strength based on dash length and line position
    if (uDashLength > 1e-3) {
        float dashRepeatLength = 2.0 * uDashLength;
        dashStrength = mod(vLinePosition, dashRepeatLength) / dashRepeatLength <= 0.75 ? 1.0: 0.0;
        if (dashStrength == 0.0) {
            discard;
        }
    }
    else {
        dashStrength = 1.0;
    }

    vec4 color;
    if (uCmapEnabled > 0) {
        // bias mod
        float x = clamp(uCmapValue - uBias, 0.0, 1.0);
        // contrast mod
        x = clamp((x - 0.5) * uContrast + 0.5, 0.0, 1.0);
        float cmapYVal = (float(uCmapIndex) + 0.5) / float(uNumCmaps);
        vec2 cmapCoords = vec2(x, cmapYVal);
        color = texture(uCmapTexture, cmapCoords);
    } else {
        color = uLineColor;
    }

    outColor = dashStrength * color;
}