export const rotate2D = /* glsl */ `
vec2 rotate2D(vec2 vector, float theta) {
    float sinTheta = sin(theta);
    float cosTheta = cos(theta);
    return mat2(cosTheta, -sinTheta, sinTheta, cosTheta) * vector;
}
`;

export const imageToGL = /* glsl */ `
vec2 imageToGL(vec2 imageVec) {
    return 2.0 * imageVec - 1.0;
}
`;

export const bicubicFilter = /* glsl */ `
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

vec4 bicubicFilter(sampler2D textureData, vec2 P, vec2 controlMapSize) {
    // Calculate offset and base pixel coordiante
    vec2 pixelSize = 1.0 / controlMapSize;
    vec2 pixel = P * controlMapSize + 0.5;
    vec2 frac = fract(pixel);
    pixel = floor(pixel) / controlMapSize - pixelSize / 2.0;

    // Texture lookups
    vec4 C00 = texture(textureData, pixel + pixelSize * vec2(-1.0, -1.0));
    vec4 C10 = texture(textureData, pixel + pixelSize * vec2(0.0, -1.0));
    vec4 C20 = texture(textureData, pixel + pixelSize * vec2(1.0, -1.0));
    vec4 C30 = texture(textureData, pixel + pixelSize * vec2(2.0, -1.0));

    vec4 C01 = texture(textureData, pixel + pixelSize * vec2(-1.0, 0.0));
    vec4 C11 = texture(textureData, pixel + pixelSize * vec2(0.0, 0.0));
    vec4 C21 = texture(textureData, pixel + pixelSize * vec2(1.0, 0.0));
    vec4 C31 = texture(textureData, pixel + pixelSize * vec2(2.0, 0.0));

    vec4 C02 = texture(textureData, pixel + pixelSize * vec2(-1.0, 1.0));
    vec4 C12 = texture(textureData, pixel + pixelSize * vec2(0.0, 1.0));
    vec4 C22 = texture(textureData, pixel + pixelSize * vec2(1.0, 1.0));
    vec4 C32 = texture(textureData, pixel + pixelSize * vec2(2.0, 1.0));

    vec4 C03 = texture(textureData, pixel + pixelSize * vec2(-1.0, 2.0));
    vec4 C13 = texture(textureData, pixel + pixelSize * vec2(0.0, 2.0));
    vec4 C23 = texture(textureData, pixel + pixelSize * vec2(1.0, 2.0));
    vec4 C33 = texture(textureData, pixel + pixelSize * vec2(2.0, 2.0));

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
    vec2 texScale = 1.0 / controlMapSize;
    vec2 range = controlMapMax - controlMapMin;
    vec2 shiftedPoint = pos - controlMapMin;
    vec2 index = shiftedPoint / range + 0.5 / controlMapSize;
    return bicubicFilter(controlMapTexture, index, controlMapSize).rg;
}
`;
