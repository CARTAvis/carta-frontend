precision highp float;

#define LINEAR 0
#define LOG 1
#define SQRT 2
#define SQUARE 3
#define POWER 4
#define GAMMA 5
#define EXP 6
#define CUSTOM 7

#define FLT_MAX 3.402823466e+38

varying vec2 vUV;
// Textures
uniform sampler2D uDataTexture;
uniform sampler2D uCmapTexture;
// Render parameters
uniform int uNumCmaps;
uniform int uCmapIndex;
uniform int uScaleType;
uniform int uInverted;
uniform float uMinVal;
uniform float uMaxVal;
uniform float uBias;
uniform float uContrast;
uniform float uGamma;
uniform float uAlpha;
uniform vec4 uNaNColor;
uniform float uTileMinVal;
uniform float uTileMaxVal;

// Tile texture parameters in pixels
uniform float uTileBorder;
uniform vec2 uTileTextureOffset;
uniform float uTextureSize;
uniform float uTileTextureSize;

// Some shader compilers have trouble with NaN checks, so we instead use a dummy value of -FLT_MAX
bool isnan(float val) {
    return val <= -FLT_MAX;
}

void main(void) {
    // Tile border
    if (uTileBorder > 0.0 && (vUV.x < uTileBorder || vUV.y < uTileBorder)) {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
        return;
    }
    vec2 texCoords;

    // Mimic texel fetch in WebGL1
    vec2 tileCoordsPixel = vUV * uTileTextureSize;
    // Prevent edge artefacts
    vec2 texCoordsPixel = clamp(tileCoordsPixel, 0.5, uTileTextureSize - 0.5) + uTileTextureOffset;
    texCoords = texCoordsPixel / uTextureSize;

    float range = uMaxVal - uMinVal;
    float rawVal = texture2D(uDataTexture, texCoords).r;

    // Per-tile scaling (from [0, 1] -> [uTileMinVal, uTileMaxVal]
    float tileRange = uTileMaxVal - uTileMinVal;
    rawVal = rawVal * tileRange + uTileMinVal;

    // Scaling types
    // LINEAR (Default: uScaleType == LINEAR)
    float x = clamp((rawVal - uMinVal) / range, 0.0, 1.0);
    // Other scaling types
    // normalized to [0, 1] for LOG and POWER, different from the scaling in ds9
    if (uScaleType == SQUARE) {
        x = x * x;
    }
    else if (uScaleType == SQRT) {
        x = sqrt(x);
    }
    else if (uScaleType == LOG) {
        x = log(uAlpha * x + 1.0) / log(uAlpha + 1.0);
    }
    else if (uScaleType == POWER) {
        x = (pow(uAlpha, x) - 1.0) / (uAlpha - 1.0);
    }
    else if (uScaleType == GAMMA) {
        x = pow(x, uGamma);
    }

    // bias mod
    x = clamp(x - uBias, 0.0, 1.0);
    // contrast mod
    x = clamp((x - 0.5) * uContrast + 0.5, 0.0, 1.0);
    // invert mod
    if (uInverted > 0) {
        x = 1.0 - x;
    }

    float cmapYVal = (float(uCmapIndex) + 0.5) / float(uNumCmaps);
    vec2 cmapCoords = vec2(x, cmapYVal);
    gl_FragColor = isnan(rawVal) ? uNaNColor * uNaNColor.a : texture2D(uCmapTexture, cmapCoords);
}