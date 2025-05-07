// adapted from https://github.com/mrdoob/three.js/blob/master/examples/webgl_texture3d_partialupdate.html

#define FLT_MAX 3.402823466e+38

precision highp float;
precision highp sampler3D;

// uniform mat4 modelViewMatrix;
// uniform mat4 projectionMatrix;

varying vec3 vOrigin; // in
varying vec3 vDirection; // in

// varying float tNear;
// varying float tFar;

// out vec4 color;

// uniform vec3 base;
uniform sampler3D uDataTexture;

uniform float uMinThreshold;
uniform float uMaxThreshold;
uniform float uMinValue;
uniform float uMaxValue;
// uniform float uRange;
uniform float uOpacity;
uniform float uSteps;
uniform float uFrame; // it is used for the random seed

uniform sampler2D uCmapTexture;
uniform int uNumCmaps;
uniform int uCmapIndex;

uniform float uMinVal;
uniform float uMaxVal;

bool isNaN(float val) {
    return val <= -FLT_MAX;
}

uint wang_hash(uint seed){
        seed = (seed ^ 61u) ^ (seed >> 16u);
        seed *= 9u;
        seed = seed ^ (seed >> 4u);
        seed *= 0x27d4eb2du;
        seed = seed ^ (seed >> 15u);
        return seed;
}

float randomFloat(inout uint seed) {
    return float(wang_hash(seed)) / 4294967296.;
}

vec2 hitBox( vec3 origin, vec3 direction ) {
    const vec3 box_min = vec3( - 0.5 );
    const vec3 box_max = vec3( 0.5 );

    vec3 inverse_direction = 1.0 / direction;
    vec3 temp_min_value = ( box_min - origin ) * inverse_direction;
    vec3 temp_max_value = ( box_max - origin ) * inverse_direction;

    vec3 min_value = min( temp_min_value, temp_max_value );
    vec3 max_value = max( temp_min_value, temp_max_value );

    float t0 = max( min_value.x, max( min_value.y, min_value.z ) );
    float t1 = min( max_value.x, min( max_value.y, max_value.z ) );

    // tNear = t0;
    // tFar = t1;

    return vec2( t0, t1 );
}

float samplePoint(vec3 point) {
    return texture(uDataTexture, point).r;
}


void main(){
    vec3 rayDir = normalize( vDirection );
    vec2 bounds = hitBox( vOrigin, rayDir );

    if ( bounds.x > bounds.y ) discard;

    bounds.x = max( bounds.x, 0.0 );

    vec3 point = vOrigin + bounds.x * rayDir;
    vec3 inc = 1.0 / abs( rayDir );
    float delta = min( inc.x, min( inc.y, inc.z ) );
    delta /= uSteps;

    // Nice little seed from
    // https://blog.demofox.org/2020/05/25/casual-shadertoy-path-tracing-1-basic-camera-diffuse-emissive/
    // 
    uint seed = uint( gl_FragCoord.x ) * uint( 1973 ) + uint( gl_FragCoord.y ) * uint( 9277 ) + uint( uFrame ) * uint( 26699 );
    vec3 size = vec3( textureSize( uDataTexture, 0 ) );
    float randNum = randomFloat( seed ) * 2.0 - 1.0;
    point += rayDir * randNum * ( 1.0 / size );

    float rayVal = -3.402823466;

    float range = uMaxVal - uMinVal;

    // ray march through the volume
    for(float i = bounds.x; i < bounds.y; i += delta) {
        float stepVal = samplePoint( point + 0.5 );

        if ( !isNaN( stepVal ) ) {
            if( stepVal > rayVal ) rayVal = stepVal;
        }

        point += rayDir * delta;
    }

    // float x = (rayVal - uMinVal) / range;

    // x = clamp(rayVal, (uMinThreshold - uMinVal) / range, ( uMaxThreshold - uMinVal) / range);
    
    float x = (rayVal - uMinThreshold) / (uMaxThreshold - uMinThreshold);

    // for colormap
    float cmapYVal = (float(uCmapIndex) + 0.5) / float(uNumCmaps);

    vec4 color = texture(uCmapTexture, vec2(x, cmapYVal)); // use .rgb for michaela's method
    color.a = x;

    gl_FragColor = color;

    // discard point if it is empty
    if ( color.a == 0.0 ) discard;

}