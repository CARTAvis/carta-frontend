precision highp float;
precision highp int;

#define SIN_0 0.0
#define COS_0 1.0
#define COS_45 0.70710678118
#define SIN_60 0.86602540378
#define COS_60 0.5
#define SIN_90 1.0
#define COS_90 0.0

uniform float uLineThickness;
uniform int uShapeType;
uniform vec3 uSelectedSourceColor;
uniform bool uOmapEnabled;

in vec2 v_pointCoord;
in vec3 v_colour;
in float v_pointSize;
in float v_orientation;
in float v_selected;
in float v_minorSize;
in float v_featherWidth;
out vec4 outColor;

mat2 rot45 = mat2(COS_45, -COS_45, COS_45, COS_45);
mat2 rot60 = mat2(COS_60, -SIN_60, SIN_60, COS_60);
mat2 rot90 = mat2(COS_90, -SIN_90, SIN_90, COS_90);
mat2 rot120 = mat2(-COS_60, -SIN_60, SIN_60, -COS_60);
mat2 rot180 = mat2(-COS_0, SIN_0, -SIN_0, -COS_0);

mat2 rotateMat(float deg) {
    float rads = radians(deg);
    float cosRads = cos(rads);
    float sinRads = sin(rads);
    return mat2(cosRads, -sinRads, sinRads, cosRads);
}

// Circle
float featherRange(vec2 a, float rMax) {
    float r = length(a);
    float v = (rMax - r - v_featherWidth) / (2.0 * v_featherWidth);
    return smoothstep(0.0, 1.0, v);
}

float featherRange(vec2 a, float rMin, float rMax) {
    float r = length(a);
    vec2 v = (vec2(rMax, rMin) - r - v_featherWidth) / (2.0 * v_featherWidth);
    vec2 alpha = smoothstep(0.0, 1.0, v);
    // subtract inner feathered circle
    return (alpha.x) * (1.0 - alpha.y);
}

// Ellipse
float featherRangeEllipse(vec2 r, float rMax) {
    float v = ((pow(rMax, 2.0) - pow(r.x, 2.0) * 3.0) - v_featherWidth - pow(r.y, 2.0)) / (2.0 * v_featherWidth);
    return smoothstep(0.0, 1.0, v);
}

float featherRangeEllipse(vec2 r, float rMin, float rMax) {
    vec2 p = vec2(2.0, 2.0);
    vec2 bb = pow(vec2(rMax, rMin), p);
    vec2 aa = bb / 3.0;
    float featherWidth = 6.0 * v_featherWidth;
    if (v_minorSize >= 0.0) {
        float rMaxMinor = v_minorSize * 0.5;
        float rMinMinor = rMaxMinor - uLineThickness;
        if(v_selected == 1.0){
            rMaxMinor = rMaxMinor - uLineThickness * 0.5;
            rMinMinor = rMinMinor - uLineThickness * 0.7;
        }
        aa = pow(vec2(rMaxMinor, rMinMinor), p);
        if (aa.x > bb.x) {
            featherWidth = 0.5 * featherWidth;
        }
    }
    vec2 v = ((1.0 - pow(r.x, 2.0) / aa) * bb - pow(r.y, 2.0) - v_featherWidth) / featherWidth;
    vec2 alpha = smoothstep(0.0, 1.0, v);
    return alpha.x * (1.0 - alpha.y);
}

// Rhomb
float featherRangeRhomb(vec2 r, float rMax) {
    float v = (rMax - abs(r.x) - v_featherWidth - abs(r.y)) / (2.0 * v_featherWidth);
    return smoothstep(0.0, 1.0, v);
}

float featherRangeRhomb(vec2 r, float rMin, float rMax) {
    float v = (rMax - abs(r.x) - v_featherWidth - abs(r.y)) / (2.0 * v_featherWidth);
    float v2 = (rMin - abs(r.x) - v_featherWidth - abs(r.y)) / (2.0 * v_featherWidth);
    float alpha = smoothstep(0.0, 1.0, v);
    float alpha2 = smoothstep(0.0, 1.0, v2);
    return alpha * (1.0 - alpha2);
}

// Square
float featherRangeSquare(vec2 r, float rMax) {
    r*= rot45;
    return featherRangeRhomb(r, rMax);
}

float featherRangeSquare(vec2 r, float rMin, float rMax) {
    r*= rot45;
    return featherRangeRhomb(r, rMin, rMax);
}

// Hexagon
// Calculates the minimum distance to a hexagon of a given radius
float distHex(vec2 r, float radius) {
    float height = radius * SIN_60;
    // Compare two sides at a time
    float dist = max(r.y - height, -height - r.y);
    for (int i = 0; i < 2; i++) {
        // Rotate by 60 degrees
        r*= rot60;
        float currentDist = max(r.y - height, -height - r.y);
        dist = max(dist, currentDist);
    }
    return dist;
}

vec2 distHex(vec2 r, vec2 radius) {
    vec2 height = radius * SIN_60;
    // Compare two sides at a time
    vec2 dist = max(r.y - height, -height - r.y);
    for (int i = 0; i < 2; i++) {
        // Rotate by 60 degrees
        r*= rot60;
        vec2 currentDist = max(r.y - height, -height - r.y);
        dist = max(dist, currentDist);
    }
    return dist;
}

vec2 distHexSelected(vec2 radius) {
    float dist = radius.x;
    for (int i = 0; i < 2; i++) {
        radius*= rot60;
        float currentDist = radius.x;
        dist = max(dist, currentDist);
    }
    return vec2(dist, dist);
}

float featherRangeHex(vec2 r, float rMax) {
    float maxDist = distHex(r, rMax);
    float v = (v_featherWidth - maxDist) / (2.0 * v_featherWidth);
    return smoothstep(0.0, 1.0, v);
}

float featherRangeHex(vec2 r, float rMin, float rMax) {
    vec2 maxDist = distHex(r, vec2(rMax, rMin));
    vec2 v = (v_featherWidth - maxDist) / (2.0 * v_featherWidth);
    vec2 alpha = smoothstep(0.0, 1.0, v);
    return alpha.x * (1.0 - alpha.y);
}

// Hexagon 2
float featherRangeHex2(vec2 r, float rMax) {
    r*= rot90;
    return featherRangeHex(r, rMax);
}

float featherRangeHex2(vec2 r, float rMin, float rMax) {
    r*= rot90;
    return featherRangeHex(r, rMin, rMax);
}

// Triangle Down
float distTriangleDown(vec2 r, float radius) {
    float height = radius * COS_60;
    float dist = r.y - height;
    for (int i = 0; i < 2; i++) {
        r*= rot120;
        float currentDist = r.y - height;
        dist = max(dist, currentDist);
    }
    return dist;
}

vec2 distTriangleDown(vec2 r, vec2 radius) {
    vec2 height = radius * COS_60;
    vec2 dist = r.y - height;
    for (int i = 0; i < 2; i++) {
        r*= rot120;
        vec2 currentDist = r.y - height;
        dist = max(dist, currentDist);
    }
    return dist;
}

vec2 distTriangleSelected(vec2 radius) {
    float dist = radius.x;
    for (int i = 0; i < 2; i++) {
        radius*= rot120;
        float currentDist = radius.x;
        dist = max(dist, currentDist);
    }
    return vec2(dist, dist);
}

float featherRangeTriangleDown(vec2 r, float rMax) {
    float maxDist = distTriangleDown(r, rMax);
    float v = (v_featherWidth - maxDist) / (2.0 * v_featherWidth);
    return smoothstep(0.0, 1.0, v);
}

float featherRangeTriangleDown(vec2 r, float rMin, float rMax) {
    vec2 maxDist = distTriangleDown(r, vec2(rMax, rMin));
    vec2 v = (v_featherWidth - maxDist) / (2.0 * v_featherWidth);
    vec2 alpha = smoothstep(0.0, 1.0, v);
    return alpha.x * (1.0 - alpha.y);
}

// Triangle Up
float featherRangeTriangleUp(vec2 r, float rMax) {
    r*= rot180;
    return featherRangeTriangleDown(r, rMax);
}

float featherRangeTriangleUp(vec2 r, float rMin, float rMax) {
    r*= rot180;
    return featherRangeTriangleDown(r, rMin, rMax);
}

// Cross
float featherRangeCross(vec2 r, float rMin, float rMax) {
    float lineThickness = (rMax - rMin) * 0.5;
    if(r.y > -lineThickness && r.y < lineThickness){
        float v = (lineThickness + v_featherWidth - abs(r.y)) / (2.0 * v_featherWidth);
        float v2 = (rMax - lineThickness - v_featherWidth - abs(r.x)) / (2.0 * v_featherWidth);
        float alpha = smoothstep(0.0, 1.0, v);
        float alpha2 = smoothstep(0.0, 1.0, v2);
        return alpha * alpha2;
    }
    if(r.x > -lineThickness && r.x < lineThickness){
        float v = (lineThickness + v_featherWidth - abs(r.x)) / (2.0 * v_featherWidth);
        float v2 = (rMax - lineThickness - v_featherWidth - abs(r.y)) / (2.0 * v_featherWidth);
        float alpha3 = smoothstep(0.0, 1.0, v);
        float alpha4 = smoothstep(0.0, 1.0, v2);
        return alpha3 * alpha4;
    }
    return 0.0;
}

float featherRangeCrossLined(vec2 r, float rMin, float rMax) {
    float lineThicknessMin = uLineThickness * 0.5;
    float lineThicknessMax = uLineThickness;
    if(rMax > length(r)) {
        if((abs(r.y) < lineThicknessMax && abs(r.y) > lineThicknessMin) && (r.x < -lineThicknessMin || r.x > lineThicknessMin)) {
            return 1.0;
        }

        if(abs(r.y) < uLineThickness && abs(r.x) > rMin && abs(r.x) < rMax) {
            return 1.0;
        }

        if((abs(r.x) < lineThicknessMax && abs(r.x) > lineThicknessMin) && (r.y < -lineThicknessMin || r.y > lineThicknessMin)) {
            return 1.0;
        }

        if(abs(r.x) < uLineThickness && abs(r.y) > rMin && abs(r.y) < rMax) {
            return 1.0;
        }
    }
    
    return 0.0;
}

// X
float featherRangeX(vec2 r, float rMin, float rMax) {
    r*= rot45;
    return featherRangeCross(r, rMin, rMax);
}

float featherRangeXLined(vec2 r, float rMin, float rMax) {
    r*= rot45;
    return featherRangeCrossLined(r, rMin, rMax);
}

// Line Segment
float featherLineSegment(vec2 r, float rMin, float rMax) {
    float lineThickness = (rMax - rMin) * 0.5;
    float v = (lineThickness + v_featherWidth - abs(r.x)) / (2.0 * v_featherWidth);
    float v2 = (rMax - lineThickness - v_featherWidth - abs(r.y)) / (2.0 * v_featherWidth);
    float alpha = smoothstep(0.0, 1.0, v);
    float alpha2 = smoothstep(0.0, 1.0, v2);
    return alpha * alpha2;
}

float featherLineSegmentLined(vec2 r, float rMin, float rMax) {
    if(rMax > abs(r.y)) {
        if(abs(r.x) < uLineThickness && abs(r.x) > uLineThickness * 0.4) {
            return 1.0;
        }

        if(abs(r.x) < uLineThickness && abs(r.y) > rMin && abs(r.y) < rMax) {
            return 1.0;
        }
    }
    return 0.0;
}

float drawOutline(vec2 posPixelSpace, float borderWidth, float rMin, float rMax) {
    vec2 pos = vec2(0.0, 0.0);
    vec2 pos2 = vec2(0.0, 0.0);
    if (uShapeType == BOX_FILLED || uShapeType == BOX_LINED){
        pos = rMin + borderWidth - abs(posPixelSpace * rot45);
        return step(length(pos), length(posPixelSpace * rot45));
    } else if (uShapeType == RHOMB_FILLED || uShapeType == RHOMB_LINED) {
        pos = rMin + borderWidth - abs(posPixelSpace);
        return step(length(pos), length(posPixelSpace));
    } else if (uShapeType == CIRCLE_FILLED || uShapeType == CIRCLE_LINED) {
        return step(rMin + borderWidth, length(posPixelSpace));
    } else if (uShapeType == ELLIPSE_FILLED || uShapeType == ELLIPSE_LINED) { 
        float bb = pow(rMin + borderWidth, 2.0);
        float aa = bb / 3.0;
        if (v_minorSize >= 0.0) {
            float rMinMinor = v_minorSize * 0.5 - 2.0 * uLineThickness + borderWidth;
            aa = pow(rMinMinor, 2.0);
            pos.y = (1.0 - pow(posPixelSpace.x, 2.0) / aa) * bb;
        } else {
            pos.y = (1.0 - pow(posPixelSpace.x, 2.0) / aa) * bb;
        }
        pos.x = posPixelSpace.x * posPixelSpace.x;
        return step(pos.x + pos.y, pos.x + posPixelSpace.y * posPixelSpace.y);
    } else if (uShapeType == HEXAGON_FILLED || uShapeType == HEXAGON_LINED) {
        pos = rMin + borderWidth - distHexSelected(vec2(rMin, rMin));
        pos2 = distHex(posPixelSpace, vec2(rMin, rMin));
        return step(length(pos), length(pos2));
    } else if (uShapeType == HEXAGON_FILLED_2 || uShapeType == HEXAGON_LINED_2) {
        pos = rMin + borderWidth - distHexSelected(vec2(rMin, rMin));
        pos2 = distHex(posPixelSpace * rot90, vec2(rMin, rMin));
        return step(length(pos), length(pos2));
    } else if (uShapeType == TRIANGLE_FILLED_DOWN || uShapeType == TRIANGLE_LINED_DOWN) {
        pos = rMin + borderWidth - distTriangleSelected(vec2(rMin, rMin));
        pos2 = distTriangleDown(posPixelSpace, vec2(rMin, rMin));
        return step(length(pos), length(pos2));
    } else if (uShapeType == TRIANGLE_FILLED_UP || uShapeType == TRIANGLE_LINED_UP) {
        pos = rMin + borderWidth - distTriangleSelected(vec2(rMin, rMin));
        pos2 = distTriangleDown(posPixelSpace * rot180, vec2(rMin, rMin));
        return step(length(pos), length(pos2));
    } else if (uShapeType == CROSS_FILLED || uShapeType == CROSS_LINED) {
        return featherRangeCrossLined(posPixelSpace, rMin, rMax);
    } else if (uShapeType == X_FILLED) {
        return featherRangeCrossLined(posPixelSpace * rot45, rMin, rMax);
    } else if (uShapeType == LineSegment_FILLED) {
        return featherLineSegmentLined(posPixelSpace, rMin, rMax);
    } else {
        return 0.0;
    }
}

float getAlphaValue(vec2 posPixelSpace, float rMin, float rMax) {
    if (uShapeType == BOX_FILLED) {
        return featherRangeSquare(posPixelSpace, rMax);
    } else if (uShapeType == BOX_LINED) {
        return featherRangeSquare(posPixelSpace, rMin, rMax);
    } else if (uShapeType == CIRCLE_FILLED) {
        return featherRange(posPixelSpace, rMax);
    } else if (uShapeType == CIRCLE_LINED) {
        return featherRange(posPixelSpace, rMin, rMax);
    } else if (uShapeType == HEXAGON_FILLED) {
        return featherRangeHex(posPixelSpace, rMax);
    } else if (uShapeType == HEXAGON_LINED) {
        return featherRangeHex(posPixelSpace, rMin, rMax);
    } else if (uShapeType == RHOMB_FILLED) {
        return featherRangeRhomb(posPixelSpace, rMax);
    } else if (uShapeType == RHOMB_LINED) {
        return featherRangeRhomb(posPixelSpace, rMin, rMax);
    } else if (uShapeType == TRIANGLE_FILLED_UP) {
        return featherRangeTriangleUp(posPixelSpace, rMax);
    } else if (uShapeType == TRIANGLE_LINED_UP) {
        return featherRangeTriangleUp(posPixelSpace, rMin, rMax);
    } else if (uShapeType == ELLIPSE_FILLED) {
        return featherRangeEllipse(posPixelSpace, rMax);
    } else if (uShapeType == ELLIPSE_LINED) {
        return featherRangeEllipse(posPixelSpace, rMin, rMax);
    } else if (uShapeType == TRIANGLE_FILLED_DOWN) {
        return featherRangeTriangleDown(posPixelSpace, rMax);
    } else if (uShapeType == TRIANGLE_LINED_DOWN) {
        return featherRangeTriangleDown(posPixelSpace, rMin, rMax);
    } else if (uShapeType == HEXAGON_FILLED_2) {
        return featherRangeHex2(posPixelSpace, rMax);
    } else if (uShapeType == HEXAGON_LINED_2) {
        return featherRangeHex2(posPixelSpace, rMin, rMax);
    } else if (uShapeType == CROSS_FILLED) {
        return featherRangeCross(posPixelSpace, rMin, rMax);
    } else if (uShapeType == CROSS_LINED) {
        return featherRangeCrossLined(posPixelSpace, rMin, rMax);
    } else if (uShapeType == X_FILLED) {
        return featherRangeX(posPixelSpace, rMin, rMax);
    } else if (uShapeType == X_LINED) {
        return featherRangeXLined(posPixelSpace, rMin, rMax);
    } else if (uShapeType == LineSegment_FILLED) {
        return featherLineSegment(posPixelSpace, rMin, rMax);
    } else {
        return 0.0;
    }
}

void main() {
    float side = v_pointSize;
    if (v_minorSize > v_pointSize) {
        side = v_minorSize;
    }
    vec2 posPixelSpace = (0.5 - v_pointCoord) * (side + v_featherWidth);
    float rMax = v_pointSize * 0.5;
    float rMin = rMax - uLineThickness;
    float outline = 0.0;
    float alpha2 = 0.0;
    // orientation
    if(uOmapEnabled){
        posPixelSpace*= rotateMat(v_orientation);
    }

    // highlight selected source
    gl_FragDepth = 0.5;
    if(v_selected == 1.0){
        rMax = rMax - uLineThickness;
        rMin = rMin - uLineThickness;
        float borderWidth = uLineThickness * 0.5;
        outline = drawOutline(posPixelSpace, borderWidth, rMin, rMax);
        alpha2 = getAlphaValue(posPixelSpace, rMin, rMax + uLineThickness);
        if(outline > 0.5 && alpha2 == 1.0) {
            gl_FragDepth = 0.0;
        } 
    }
    float alpha = getAlphaValue(posPixelSpace, rMin, rMax);

    // Blending
    outColor = (1.0 - outline) * vec4(v_colour, alpha) + outline * vec4(uSelectedSourceColor, alpha2);
}