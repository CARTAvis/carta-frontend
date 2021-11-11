precision highp float;
precision highp usampler2D;
precision highp int;

uniform sampler2D uCmapTexture;
uniform highp sampler2D uControlMapTexture;
uniform sampler2D uSizeTexture;
uniform sampler2D uColorTexture;
uniform sampler2D uOrientationTexture;
uniform usampler2D uSelectedSourceTexture;
uniform sampler2D uSizeMinorTexture;

uniform vec2 uFrameViewMin;
uniform vec2 uFrameViewMax;
uniform vec3 uPointColor;
uniform int uShapeType;
uniform int uNumCmaps;
uniform int uCmapIndex;
uniform float uFeatherWidth;
uniform float uPointSize;
uniform bool uSizeMajorMapEnabled;
uniform bool uAreaMode;
uniform bool uShowSelectedSource;
uniform bool uSizeMinorMapEnabled;
uniform bool uAreaModeMinor;
uniform bool uCmapEnabled;
uniform bool uOmapEnabled;

uniform float uRotationAngle;
uniform vec2 uRangeOffset;
uniform vec2 uRangeScale;
uniform float uScaleAdjustment;

// Control-map based transformation
uniform int uControlMapEnabled;
uniform vec2 uControlMapMin;
uniform vec2 uControlMapMax;
uniform vec2 uControlMapSize;
uniform float uLineThickness;
uniform float uPixelRatio;

in vec4 a_position;
out vec3 v_colour;
out float v_pointSize;
out float v_orientation;
out float v_selected;
out float v_minorSize;
out float v_featherWidth;


vec4 getValueByIndexFromTexture(sampler2D texture, int index) {
    ivec2 size = textureSize(texture, 0);
    int row = index / size.x;
    int col = index - row * size.x;
    return texelFetch(texture, ivec2(col, row), 0);
}

uvec4 getValueByIndexFromTextureU(usampler2D texture, int index) {
    ivec2 size = textureSize(texture, 0);
    int row = index / size.x;
    int col = index - row * size.x;
    return texelFetch(texture, ivec2(col, row), 0);
}

float getSquareSideByArea(float area, float minorSize) {
    if (uShapeType == BOX_FILLED || uShapeType == BOX_LINED || uShapeType == RHOMB_FILLED || uShapeType == RHOMB_LINED || uShapeType == CROSS_FILLED || uShapeType == CROSS_LINED || uShapeType == X_FILLED || uShapeType == X_LINED || uShapeType == LineSegment_FILLED) {
        return sqrt(area);
    } else if (uShapeType == CIRCLE_FILLED || uShapeType == CIRCLE_LINED) {
        return sqrt(area / PI) * 2.0;
    } else if (uShapeType == HEXAGON_FILLED || uShapeType == HEXAGON_LINED || uShapeType == HEXAGON_FILLED_2 || uShapeType == HEXAGON_LINED_2) {
        return sqrt((2.0 * area) / (3.0 * SQRT3)) * SIN_60 * 2.0;
    } else if (uShapeType == TRIANGLE_FILLED_UP || uShapeType == TRIANGLE_LINED_UP || uShapeType == TRIANGLE_FILLED_DOWN || uShapeType == TRIANGLE_LINED_DOWN) {
        return sqrt(area * 4.0 / SQRT3);
    } else if (uShapeType == ELLIPSE_FILLED || uShapeType == ELLIPSE_LINED) {
        float side = sqrt(area / PI) * 2.0;
        if (minorSize >= 0.0 && area < minorSize) {
            side = sqrt(minorSize / PI) * 2.0;
        }   
        return side;
    } else {
        return 0.0;
    }
}

bool isNaN(float val) {
    return isnan(val) || isinf(val);
}

void main() {
    uvec4 selectedSource = getValueByIndexFromTextureU(uSelectedSourceTexture, gl_VertexID);
    // Scale and rotate
    vec2 posImageSpace = vec2(a_position.x,a_position.y);

    if (uControlMapEnabled > 0) {
        posImageSpace = controlMapLookup(uControlMapTexture, posImageSpace, uControlMapSize, uControlMapMin, uControlMapMax);
    }

    vec2 pos = rotate2D(posImageSpace, uRotationAngle) * uScaleAdjustment * uRangeScale + uRangeOffset;

    gl_Position = vec4(imageToGL(pos), 0.5, 1.0);

    v_colour = uPointColor;
    v_orientation = 0.0;
    v_minorSize = -1.0;
    v_selected = float(selectedSource.x);
    v_pointSize = uPointSize;
    v_featherWidth = uFeatherWidth;

    if (uCmapEnabled) {
        vec4 color = getValueByIndexFromTexture(uColorTexture, gl_VertexID);
        float x = clamp(color.x, 0.0, 1.0);
        float cmapYVal = (float(uCmapIndex) + 0.5) / float(uNumCmaps);
        vec2 cmapCoords = vec2(x, cmapYVal);
        v_colour = texture(uCmapTexture, cmapCoords).xyz;
    }

    if (uOmapEnabled) {
        vec4 orientation = getValueByIndexFromTexture(uOrientationTexture, gl_VertexID);
        if (!isNaN(orientation.x)) {
            v_orientation = orientation.x;
        }
    }

    if (uSizeMajorMapEnabled) {
        vec4 sizeMajor = getValueByIndexFromTexture(uSizeTexture, gl_VertexID);
        float size = sizeMajor.x;
        if(!isNaN(size)) {
            v_pointSize = size;
        }
    }

    if (uAreaMode) {
        v_pointSize = getSquareSideByArea(v_pointSize, v_minorSize);
    }

    if (uShowSelectedSource) {
        if (v_selected == 1.0) {
            gl_PointSize = v_pointSize + v_featherWidth;
        } else {
            gl_PointSize = 0.0;
        }
    } else {
        gl_PointSize = v_pointSize + v_featherWidth;
    }

    if (uSizeMinorMapEnabled) {
        vec4 sizeMinor = getValueByIndexFromTexture(uSizeMinorTexture, gl_VertexID);
        v_minorSize = sizeMinor.x;
        if (uAreaModeMinor) {
            v_minorSize = getSquareSideByArea(v_pointSize, v_minorSize);
        }
        if (v_pointSize < v_minorSize) {
            gl_PointSize = v_minorSize + v_featherWidth;
        }
    }

    if (uShapeType == ELLIPSE_LINED) {
        v_featherWidth = v_pointSize / 50.0 * 15.0 + 0.7;
    }
}