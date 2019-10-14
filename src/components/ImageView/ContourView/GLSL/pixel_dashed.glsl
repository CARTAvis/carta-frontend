precision highp float;

varying float vLinePosition;
varying float vLineSide;

uniform float uDashLength;
uniform vec4 uLineColor;

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

    gl_FragColor = dashStrength * uLineColor;
}