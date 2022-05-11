precision highp usampler2D;
precision highp int;
precision highp float;

vec2 rotate2D(vec2 vector, float theta) {
    float sinTheta = sin(theta);
    float cosTheta = cos(theta);
    return mat2(cosTheta, -sinTheta, sinTheta, cosTheta) * vector;
}

vec2 scaleAndRotate2D(vec2 vector, float theta, float scale) {
    return rotate2D(vector, theta) * scale;
}

vec2 imageToGL(vec2 imageVec) {
    return 2.0 * imageVec - 1.0;
}

// Adapted from https://www.shadertoy.com/view/MllSzX to work with non-square vec4 textures of variable size
vec4 cubic(vec4 A, vec4 B, vec4 C, vec4 D, float t) {
    float t2 = t * t;
    float t3 = t * t * t;
    vec4 a = -A / 2.0 + (3.0 * B) / 2.0 - (3.0 * C) / 2.0 + D / 2.0;
    vec4 b = A - (5.0 * B) / 2.0 + 2.0 * C - D / 2.0;
    vec4 c = -A / 2.0 + C / 2.0;
    vec4 d = B;

    return a * t3 + b * t2 + c * t + d;
}

ivec2 clampPixel(ivec2 pixel, vec2 controlMapSize) {
    pixel.x = clamp(pixel.x, 0, int(controlMapSize.x) - 1);
    pixel.y = clamp(pixel.y, 0, int(controlMapSize.y) - 1);
    return pixel;
}

vec4 bicubicFilter(sampler2D textureData, vec2 P, vec2 controlMapSize) {
    // Calculate offset and base pixel coordiante
    vec2 frac = fract(P);
    ivec2 pixel = ivec2(floor(P));

    // Texture lookups
    vec4 C00 = texelFetch(textureData, clampPixel(pixel + ivec2(-1, -1), controlMapSize), 0);
    vec4 C10 = texelFetch(textureData, clampPixel(pixel + ivec2(0, -1), controlMapSize), 0);
    vec4 C20 = texelFetch(textureData, clampPixel(pixel + ivec2(1, -1), controlMapSize), 0);
    vec4 C30 = texelFetch(textureData, clampPixel(pixel + ivec2(2, -1), controlMapSize), 0);

    vec4 C01 = texelFetch(textureData, clampPixel(pixel + ivec2(-1, 0), controlMapSize), 0);
    vec4 C11 = texelFetch(textureData, clampPixel(pixel + ivec2(0, 0), controlMapSize), 0);
    vec4 C21 = texelFetch(textureData, clampPixel(pixel + ivec2(1, 0), controlMapSize), 0);
    vec4 C31 = texelFetch(textureData, clampPixel(pixel + ivec2(2, 0), controlMapSize), 0);

    vec4 C02 = texelFetch(textureData, clampPixel(pixel + ivec2(-1, 1), controlMapSize), 0);
    vec4 C12 = texelFetch(textureData, clampPixel(pixel + ivec2(0, 1), controlMapSize), 0);
    vec4 C22 = texelFetch(textureData, clampPixel(pixel + ivec2(1, 1), controlMapSize), 0);
    vec4 C32 = texelFetch(textureData, clampPixel(pixel + ivec2(2, 1), controlMapSize), 0);

    vec4 C03 = texelFetch(textureData, clampPixel(pixel + ivec2(-1, 2), controlMapSize), 0);
    vec4 C13 = texelFetch(textureData, clampPixel(pixel + ivec2(0, 2), controlMapSize), 0);
    vec4 C23 = texelFetch(textureData, clampPixel(pixel + ivec2(1, 2), controlMapSize), 0);
    vec4 C33 = texelFetch(textureData, clampPixel(pixel + ivec2(2, 2), controlMapSize), 0);

    // Cubic along x
    vec4 CP0X = cubic(C00, C10, C20, C30, frac.x);
    vec4 CP1X = cubic(C01, C11, C21, C31, frac.x);
    vec4 CP2X = cubic(C02, C12, C22, C32, frac.x);
    vec4 CP3X = cubic(C03, C13, C23, C33, frac.x);

    // Final cubic along y
    return cubic(CP0X, CP1X, CP2X, CP3X, frac.y);
}
// end adapted from https://www.shadertoy.com/view/MllSzX

vec2 controlMapLookup(sampler2D controlMapTexture, vec2 pos, vec2 controlMapSize, vec2 controlMapMin, vec2 controlMapMax) {
    vec2 range = controlMapMax - controlMapMin;
    vec2 shiftedPoint = pos - controlMapMin;
    vec2 index = shiftedPoint / range * controlMapSize;
    return bicubicFilter(controlMapTexture, index, controlMapSize).rg;
}

vec4 getValueByIndexFromTexture(sampler2D texture, int index) {
    ivec2 size = textureSize(texture, 0);
    int row = index / size.x;
    int col = index - row * size.x;
    return texelFetch(texture, ivec2(col, row), 0);
}

uvec4 getValueByIndexFromTextureU(usampler2D texture, int index) {
    ivec2 size = textureSize(texture, 0);
    int row = index / size.x;
    int col = index - row * size.x;
    return texelFetch(texture, ivec2(col, row), 0);
}
