// adapted from https://github.com/mrdoob/three.js/blob/master/examples/webgl_texture3d_partialupdate.html

#define FLT_MAX 3.402823466e+38

precision highp float;
precision highp sampler3D;

// uniform mat4 modelViewMatrix;
// uniform mat4 projectionMatrix;

varying vec3 vOrigin; // in
varying vec3 vDirection; // in

// out vec4 color;

// uniform vec3 base;
uniform sampler3D uTexture;

// uniform float uThreshold;
// uniform float uRange;
uniform float uOpacity;
uniform float uSteps;
uniform float uFrame; // it is used for the random seed
// uniform sampler2D uColourMap;

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

    return vec2( t0, t1 );
}

float samplePoint(vec3 point) {
    return texture(uTexture, point).r;
}

// vec4 sampleColourMap(float value) {
//     return texture(uColourMap, vec2(value, 0.5));
// }

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
    vec3 size = vec3( textureSize( uTexture, 0 ) );
    float randNum = randomFloat( seed ) * 2.0 - 1.0;
    point += rayDir * randNum * ( 1.0 / size );

    vec3 white = vec3(1.0, 1.0, 1.0);
    vec4 color = vec4(white, 0.0);

    // float accumulator = 0.0;
    float max_value = 0.0;

    // vec4 ac = vec4( base, 0.0 );

    // ray march through the volume
    for(float i = bounds.x; i < bounds.y; i += delta) {
        float d = samplePoint( point + 0.5 );

        // if ( isNan(d) ) d = 0.0;
        // give it a nan color but make it transparent.

        // get also the minimum value.

        if( d > max_value ) max_value = d;
        // accumulator += d;
        d *= uOpacity;
        color.a += ( 1.0 - color.a ) * d;

        // stop ray if it has accumulated enough opacity
        if( color.a >= 0.95 ) break;

        // move point on step in direction of the ray
        point += rayDir * delta;
    }

    // color.rgb = sampleColourMap( max_value * 4.0 ).rgb;
    gl_FragColor = color;

    // discard point if it is empty
    if ( color.a == 0.0 ) discard;

}