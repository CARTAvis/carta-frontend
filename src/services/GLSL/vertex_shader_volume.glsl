// varying vec3 vUv;
// void main() {
//     vUv = position * 0.5 + 0.5;  // Normalize from [-0.5,0.5] to [0,1]
//     gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
// }


// Michaela's

// varying vec3 v_origin;
// varying vec3 v_direction;

// void main() {
//     v_origin = vec3(inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
//     v_direction = position - v_origin;

//     gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
// }


// adapted from https://github.com/mrdoob/three.js/blob/master/examples/webgl_texture3d_partialupdate.html

// in vec3 position;

// uniform mat4 modelMatrix;
// uniform mat4 modelViewMatrix;
// uniform mat4 projectionMatrix;
// uniform vec3 cameraPos; // in the original it's cameraPos but in Michaela's it is not defined

varying vec3 vOrigin; // out
varying vec3 vDirection; //out

void main() {
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

    vOrigin = vec3( inverse( modelMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz;
    vDirection = position - vOrigin;

    gl_Position = projectionMatrix * mvPosition;
}

