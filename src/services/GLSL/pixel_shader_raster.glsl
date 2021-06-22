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
uniform int uUseSmoothedBiasContrast;
uniform float uMinVal;
uniform float uMaxVal;
uniform float uBias;
uniform float uContrast;
uniform float uGamma;
uniform float uAlpha;
uniform vec4 uNaNColor;

// Tile texture parameters in pixels
uniform float uTileBorder;
uniform vec2 uTileTextureOffset;
uniform float uTextureSize;
uniform float uTileTextureSize;

// Pixel grid
uniform float uPixelGridCutoff;
uniform vec4 uPixelGridColor;
uniform float uPixelGridOpacity;

// Some shader compilers have trouble with NaN checks, so we instead use a dummy value of -FLT_MAX
bool isnan(float val) {
    return val <= -FLT_MAX;
}

float errorFunction(float x, float c, float x0) {
    float y = exp(c * (x - x0));
    return y / (y + 1.0);
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
    vec2 f = fract(texCoordsPixel);

    float gridOpacity = 0.0;
    float edge = min(f.x, min(f.y, min(1.0 - f.x, 1.0 - f.y)));
    if (edge <= uPixelGridCutoff)  {
        gridOpacity = uPixelGridOpacity;
    }
    texCoords = texCoordsPixel / uTextureSize;

    float range = uMaxVal - uMinVal;
    float rawVal = texture2D(uDataTexture, texCoords).r;

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

    if (uUseSmoothedBiasContrast > 0) {
        if (uContrast <= 1.0) {
            float smoothedBias = 0.5 - uBias / 2.0; // [-1, 1] map to [1, 0]
            x = clamp((x - smoothedBias) * uContrast + smoothedBias, 0.0, 1.0);
        } else {
            float smoothedBias = uBias / 2.0 + 0.5; // [-1, 1] map to [0, 1]
            float smoothedContrast = uContrast < 1.0 ? 0.0 : uContrast - 1.0; // [1, 2] map to [0, 1]
            smoothedContrast = (smoothedContrast == 0.0) ? 0.001 : smoothedContrast * 12.0;
            float offset = errorFunction(0.0, smoothedContrast, smoothedBias);
            float denominator = errorFunction(1.0, smoothedContrast, smoothedBias) - offset;
            if (denominator <= 0.0) {
                denominator = 0.1;
            }
            x = (errorFunction(x, smoothedContrast, smoothedBias) - offset) / denominator;
        }
    } else {
        // bias mod
        x = clamp(x - uBias, 0.0, 1.0);
        // contrast mod
        x = clamp((x - 0.5) * uContrast + 0.5, 0.0, 1.0);
    }
    
    // invert mod
    if (uInverted > 0) {
        x = 1.0 - x;
    }

    float cmapYVal = (float(uCmapIndex) + 0.5) / float(uNumCmaps);
    vec2 cmapCoords = vec2(x, cmapYVal);
    gl_FragColor = isnan(rawVal) ? uNaNColor * uNaNColor.a : texture2D(uCmapTexture, cmapCoords);
    // Apply pixel grid mixing
    gl_FragColor = mix(gl_FragColor, uPixelGridColor, gridOpacity);
}