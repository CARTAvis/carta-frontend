precision highp float;
varying vec2 vUV;
// Textures
uniform sampler2D uDataTexture;
uniform sampler2D uCmapTexture;
// Render parameters
uniform int uNumCmaps;
uniform int uCmapIndex;
uniform float uMinVal;
uniform float uMaxVal;
uniform vec4 uNaNColor;

bool isnan( float val )
{
    return ( val < 0.0 || 0.0 < val || val == 0.0 ) ? false : true;
}

void main(void) {
    float range = uMaxVal-uMinVal;
    float rawVal = texture2D(uDataTexture, vUV).r;
    float alpha = clamp((rawVal - uMinVal) / range, 0.0, 1.0);
    float scaledValue = rawVal/6.0;
    float cmapYVal = (float(uCmapIndex)+0.5)/float(uNumCmaps);
    vec2 cmapCoords = vec2(alpha, cmapYVal);
    gl_FragColor = isnan(rawVal) ? uNaNColor : texture2D(uCmapTexture, cmapCoords);
}