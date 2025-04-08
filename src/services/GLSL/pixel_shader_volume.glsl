// precision highp sampler3D;
// uniform sampler3D uTexture;
// varying vec3 vUv;

// void main() {
//     float intensity = texture(uTexture, vUv).r;
//     gl_FragColor = vec4(vec3(intensity), intensity);
// }


// Michaela's


// // #define STEPS 100.0
// #define MAX_DIST 100.
// // #define THRESHOLD .25
// // #define RANGE .1
// // #define OPACITY .1

// precision highp float;
// precision mediump sampler3D;

// uniform sampler3D u_textureData;
// uniform float u_threshold;
// uniform float u_range;
// uniform float u_opacity;
// uniform float u_steps;
// // uniform sampler2D u_colourMap;

// varying vec3 v_origin;
// varying vec3 v_direction;

// vec2 hitBox(vec3 origin, vec3 direction) {
//     const vec3 boxMin = vec3(-0.5);
//     const vec3 boxMax = vec3(0.5);

//     vec3 inverseDirection = 1.0 / direction;

//     vec3 tempMinValue = (boxMin - origin) * inverseDirection;
//     vec3 tempMaxValue = (boxMax - origin) * inverseDirection;

//     vec3 minValue = min(tempMinValue, tempMaxValue);
//     vec3 maxValue = max(tempMinValue, tempMaxValue);

//     float t0 = max(minValue.x, max(minValue.y, minValue.z));
//     float t1 = min(maxValue.x, min(maxValue.y, maxValue.z));

//     return vec2(t0, t1);
// }

// float samplePoint(vec3 point) {
//     return texture(u_textureData, point).r;
// }

// // vec4 sampleColourMap(float value) {
// //     return texture(u_colourMap, vec2(value, 0.5));
// // }

// void main() {
//     vec3 rayDirection = normalize(v_direction);
//     vec2 bounds = hitBox(v_origin, rayDirection);

//     if ( bounds.x > bounds.y ) discard;

//     bounds.x = max( bounds.x, 0.0 );

//     vec3 point = v_origin + bounds.x * rayDirection;
//     vec3 inc = 1.0 / abs(rayDirection);
//     float delta = min(inc.x, min(inc.y, inc.z));
//     delta /= u_steps;

//     vec3 white = vec3(1.0, 1.0, 1.0);

//     vec4 color = vec4(white, 0.0);
//     // float accumulator = 0.0;
//     float max = 0.0;
//     // ray march through the volume
//     for(float i = bounds.x; i < bounds.y; i+=delta){
//         float d = samplePoint(point + 0.5);
//         if(d > max) max = d;
//         // accumulator += d;
//         d *= u_opacity;
//         color.a += (1.0 - color.a) * d;
        
//         // stop ray if it has accumulated enough opacity
//         if(color.a >= 0.95) break;

//         // move point on step in direction of the ray
//         point += rayDirection * delta;
//     }
    
//     // color.rgb = sampleColourMap(max*4.0).rgb;
//     gl_FragColor = color;

//     // discard point if it is empty
//     if ( color.a == 0.0 ) discard;
// }


// adapted from https://github.com/mrdoob/three.js/blob/master/examples/webgl_texture3d_partialupdate.html

precision highp float;
precision highp sampler3D;

// uniform mat4 modelViewMatrix;
// uniform mat4 projectionMatrix;

varying vec3 vOrigin; // in
varying vec3 vDirection; // in

// out vec4 color;

// uniform vec3 base;
uniform sampler3D uTexture;

uniform float threshold;
uniform float range;
uniform float opacity;
uniform float steps;
uniform float frame; // it is used for the random seed
// uniform sampler2D uColourMap;

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
    delta /= steps;

    // Nice little seed from
    // https://blog.demofox.org/2020/05/25/casual-shadertoy-path-tracing-1-basic-camera-diffuse-emissive/
    // 
    uint seed = uint( gl_FragCoord.x ) * uint( 1973 ) + uint( gl_FragCoord.y ) * uint( 9277 ) + uint( frame ) * uint( 26699 );  // instead of the 0 put frame
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
        if( d > max_value ) max_value = d;
        // accumulator += d;
        d *= opacity;
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