//Data from bufferData
attribute vec2 aVertexPosition;
//attribute float aVertexLength;

//uniform float uWidth;
//uniform float uHeight;
//uniform float uRasterWidth;
//uniform float uRasterHeight;
//uniform vec2 uLB;
//uniform vec2 uRT;

uniform vec2 uScale;
uniform vec2 uOffset;

//varying float vLinePosition;

void main(void) {
    // Convert position to GL space
    vec2 pos = aVertexPosition * uScale + uOffset;

//    float x = mix(uLB.x, uRT.x, aVertexPosition.x / uRasterWidth);
//    float y = mix(uLB.y, uRT.y, aVertexPosition.y / uRasterHeight);
    // Convert line position to pixel space
    //vLinePosition = aVertexLength * uWidth * (uRT.x - uLB.x) / (2.0 * uRasterWidth);
    gl_Position =  vec4(pos.x, pos.y, 0.0, 1.0);
}