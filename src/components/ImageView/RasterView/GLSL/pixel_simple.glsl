precision highp float;

#define LINEAR 0
#define LOG 1
#define SQRT 2
#define SQUARE 3
#define POWER 4
#define GAMMA 5
#define EXP 6
#define CUSTOM 7

varying vec2 vUV;
// Textures
uniform sampler2D
uDataTexture;
uniform sampler2D
uCmapTexture;
// Render parameters
uniform int uNumCmaps;
uniform int uCmapIndex;
uniform int uScaleType;
uniform float uMinVal;
uniform float uMaxVal;
uniform float uBias;
uniform float uContrast;
uniform float uGamma;
uniform float uAlpha;
uniform vec4 uNaNColor;

bool isnan(float val) {
    return (val < 0.0 || 0.0 < val || val == 0.0) ? false : true;
}

void main(void) {
    float range = uMaxVal - uMinVal;
    float rawVal = texture2D(uDataTexture, vUV).r;

    // Scaling types
    // LINEAR (Default: uScaleType == LINEAR)
    float x = clamp((rawVal - uMinVal) / range, 0.0, 1.0);
    // Other scaling types
    if (uScaleType == SQUARE) {
        x = x * x;
    }
    else if (uScaleType == SQRT) {
        x = sqrt(x);
    }
    else if (uScaleType == LOG) {
        x = clamp(log(uAlpha * x + 1.0) / log(uAlpha), 0.0, 1.0);
    }
    else if (uScaleType == POWER) {
        x = (pow(uAlpha, x) -1.0)/uAlpha;
    }
    else if (uScaleType == GAMMA) {
        x = pow(x, uGamma);
    }

    // bias mod
    x = clamp(x - uBias, 0.0, 1.0);
    // contrast mod
    x = clamp((x - 0.5) * uContrast + 0.5, 0.0, 1.0);

    float cmapYVal = (float(uCmapIndex) + 0.5) / float(uNumCmaps);
    vec2 cmapCoords = vec2(x, cmapYVal);
    gl_FragColor = isnan(rawVal) ? uNaNColor : texture2D(uCmapTexture, cmapCoords);
}