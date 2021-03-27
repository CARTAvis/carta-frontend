#version 300 es
precision highp float;

uniform vec2 uFrameViewMin;
uniform vec2 uFrameViewMax;
uniform float uFeatherWidth;
uniform sampler2D uPositionTexture;
uniform bool uSmapEnabled;
uniform float uPointSize;

out vec4 v_colour;
out float v_pointSize;

#define PI radians(180.0)


vec4 getValueByIndexFromTexture(sampler2D texture, int index) {
    ivec2 size = textureSize(texture, 0);
    int row = index / size.x;
    int col = index - row * size.x;
    return texelFetch(texture, ivec2(col, row), 0);
}

vec2 imageToGL(vec2 imageVec) {
    return 2.0 * (imageVec - uFrameViewMin) / (uFrameViewMax - uFrameViewMin) - 1.0;
}

vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec4 data = getValueByIndexFromTexture(uPositionTexture, gl_VertexID);
    vec2 pos = data.xy;
    float size = data.z;
    float cmapVal = data.w;

    gl_Position = vec4(imageToGL(pos), 0, 1);
    if (uSmapEnabled) {
        v_pointSize = size;
    } else {
        v_pointSize = uPointSize;
    }
    gl_PointSize = v_pointSize + uFeatherWidth;
    v_colour = vec4(hsv2rgb(vec3(cmapVal, 0.5, 1.0)), 1.0);

}