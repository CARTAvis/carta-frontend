precision highp float;
varying vec2 vUV;

void main(void) {
    gl_FragColor = vec4(sin(10.0*vUV.x),cos(5.0*vUV.y),0,1);
}