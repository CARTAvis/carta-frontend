precision highp float;

varying float vLinePosition;
varying float vLineSide;

uniform float uDashLength;
uniform vec4 uLineColor;
uniform int uCmapEnabled;

uniform sampler2D uCmapTexture;
uniform float uCmapValue;
uniform int uNumCmaps;
uniform int uCmapIndex;

void main(void) {
    float dashStrength;
    // Modulate dash strength based on dash length and line position
    if (uDashLength > 1e-3) {
        float dashRepeatLength = 2.0 * uDashLength;
        dashStrength = mod(vLinePosition, dashRepeatLength) / dashRepeatLength <= 0.75 ? 1.0: 0.0;
    }
    else {
        dashStrength = 1.0;
    }

    vec4 color;
    if (uCmapEnabled > 0) {
        float cmapYVal = (float(uCmapIndex) + 0.5) / float(uNumCmaps);
        vec2 cmapCoords = vec2(uCmapValue, cmapYVal);
        color = texture2D(uCmapTexture, cmapCoords);
    } else {
        color = uLineColor;
    }

    gl_FragColor = dashStrength * color;
}