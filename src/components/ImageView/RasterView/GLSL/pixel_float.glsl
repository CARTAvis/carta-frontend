precision highp float;
uniform vec2 uViewportSize;
varying vec2 vUV;
uniform sampler2D uDataTexture;
uniform sampler2D uCmapTexture;

uniform float uMinVal;
uniform float uMaxVal;
uniform float uBias;
uniform float uContrast;
uniform int uScaleType;
uniform int uNumCmaps;
uniform int uCmapIndex;

bool isnan( float val )
{
    return ( val < 0.0 || 0.0 < val || val == 0.0 ) ? false : true;
}

void main(void) {
    float range = uMaxVal-uMinVal;
    float zVal = texture2D(uDataTexture, vUV).r;
    float alpha = clamp((zVal - uMinVal) / range, 0.0, 1.0);

    if (uScaleType==1)
        alpha = alpha*alpha;
    else if (uScaleType==2)
        alpha = sqrt(alpha);
    else if (uScaleType==3)
        alpha = clamp(log(alpha)/3.0+1.0, 0.0, 1.0);
    else if (uScaleType==4)
        alpha = pow(10.0, range*(alpha-1.0));
    // bias mod
    alpha = clamp(alpha-uBias, 0.0, 1.0);
    // contrast mod
    alpha = clamp((alpha-0.5)*uContrast+0.5, 0.0, 1.0);
    float cmapYVal = (float(uCmapIndex)+0.5)/float(uNumCmaps);
    vec2 cmapCoords = vec2(alpha, cmapYVal);
    gl_FragColor = isnan(zVal)?vec4(1,0,0,1):texture2D(uCmapTexture, cmapCoords);
}