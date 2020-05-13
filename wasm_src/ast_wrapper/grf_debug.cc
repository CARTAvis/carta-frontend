#include <stdio.h>
#include <string.h>
#include <emscripten.h>
#include <math.h>

extern "C" {
#include "grf.h"
#include "ast.h"

#define LOG printf
#define PI 3.14159265

double colorVals[3];
int appliedColorVal = -1;
double lineThickness = 1.0;
double interval = 100;
int counter = 0;
int numColors = 1;

int numFonts = 1;
int fontVals[3];
double fontSizeVals[3];

void rot2D(float* x, float* y, float cx, float cy, float angle)
{
    // move origin to (cx, cy)
    float offsetX = *x - cx;
    float offsetY = *y - cy;

    //rotate
    float c = cos(angle);
    float s = sin(angle);
    float rotatedX = c * offsetX - s * offsetY;
    float rotatedY = s * offsetX + c * offsetY;

    // move origin back to (0, 0)
    *x = rotatedX + cx;
    *y = rotatedY + cy;
}

void applyColor(int primType)
{
    int index = ((int) colorVals[primType]) % numColors;
    EM_ASM_({
        Module.gridContext.strokeStyle = Module.colors[$0];
        Module.gridContext.fillStyle = Module.colors[$0];
    }, index);
    appliedColorVal = index;
}

void applyFont(int primType)
{
    double height = fontSizeVals[primType];
    int index = ((int) fontVals[primType]) % numFonts;

    EM_ASM_({
        var font = Module.fonts[$0];
        font = font.replace("{size}", $1 * devicePixelRatio + "px");
        Module.gridContext.font = font;
    }, index, height);
}

int astGFlush(void)
{
    return 1;
}

int astGLine(int n, const float* x, const float* y)
{
    applyColor(GRF__LINE);
    if (n == 0)
    {
        return 1;
    }
    EM_ASM_({
        Module.gridContext.beginPath();
        Module.gridContext.moveTo($0, $1);
    }, x[0], y[0]);

    if (lineThickness <= 1)
    {
        // Round coordinates to the nearest pixel center for sharp lines
        for (int i = 0; i < n; i++)
        {
            EM_ASM_({Module.gridContext.lineTo(Math.floor($0)+0.5, Math.floor($1)+0.5);}, x[i], y[i]);
        }
    }
    else
    {
        for (int i = 0; i < n; i++)
        {
            EM_ASM_({Module.gridContext.lineTo($0, $1);}, x[i], y[i]);
        }
    }
    EM_ASM(Module.gridContext.stroke(););
    return 1;
}

int astGQch(float* chv, float* chh)
{
    // canvas does not provide an easy method of measuring height.
    // measuring the width of the character "E" and doubling is a crude approximation
    float height = fontSizeVals[GRF__TEXT];
    applyFont(GRF__FONT);
    if (height < 0)
    {
        height = EM_ASM_DOUBLE({return 2*Module.gridContext.measureText("e").width;});
    }

    if (chh)
    {
        *chh = height;
    }

    if (chv)
    {
        *chv = height;
    }

    return 1;
}

int astGMark(int n, const float* x, const float* y, int type)
{
    applyColor(GRF__MARK);
    applyFont(GRF__MARK);
    if (n == 0)
    {
        return 1;
    }

    EM_ASM_({
        Module.gridContext.textAlign = "center";
        Module.gridContext.textBaseline = "middle";
        var index = Math.max(Math.min($0, Module.shapes.length -1), 0);
        Module.gridContext.symbolText = Module.shapes[index];
    }, type);

    for (int i = 0; i < n; i++)
    {
        EM_ASM_({
            Module.gridContext.save();
            Module.gridContext.translate($0, $1);
            Module.gridContext.scale(1, -1);
            Module.gridContext.fillText(Module.gridContext.symbolText, 0, 0);
            Module.gridContext.restore();
        }, x[i], y[i]);
    }
    return 1;
}

int astGText(const char* text, float x, float y, const char* just,
             float upx, float upy)
{
    applyColor(GRF__TEXT);
    applyFont(GRF__TEXT);
    if (!just)
    {
        return 0;
    }
    int justLength = strlen(just);
    if (justLength >= 2)
    {
        char hJust = just[1];
        if (hJust == 'C')
        {
            EM_ASM(Module.gridContext.textAlign = "center";);
        }
        else if (hJust == 'L')
        {
            EM_ASM(Module.gridContext.textAlign = "left";);
        }
        else if (hJust == 'R')
        {
            EM_ASM(Module.gridContext.textAlign = "right";);
        }
        else
        {
            LOG("Unknown text justification: %s\n", just);
        }
    }

    char vJust = just[0];
    if (vJust == 'T')
    {
        EM_ASM(Module.gridContext.textBaseline = "top";);
    }
    else if (vJust == 'C')
    {
        EM_ASM(Module.gridContext.textBaseline = "middle";);
    }
    else if (vJust == 'B')
    {
        EM_ASM(Module.gridContext.textBaseline = "bottom";);
    }
    else
    {
        LOG("Unknown text justification: %s\n", just);
    }

    float angle = atan2f(-upx, upy);
    EM_ASM_({
        Module.gridContext.save();
        Module.gridContext.translate($1, $2);
        Module.gridContext.rotate($3);
        Module.gridContext.scale(1, -1);
        Module.gridContext.fillText(UTF8ToString($0), 0, 0);
        Module.gridContext.restore();
    }, text, x, y, angle);

    return 1;
}

int astGTxExt(const char* text, float x, float y, const char* just,
              float upx, float upy, float* xb, float* yb)
{
    float height = fontSizeVals[GRF__TEXT];
    applyFont(GRF__TEXT);
    if (height < 0)
    {
        height = EM_ASM_DOUBLE({return 2*Module.gridContext.measureText("e").width;});
    }
    float width = EM_ASM_DOUBLE({return Module.gridContext.measureText(UTF8ToString($0)).width;}, text);

    if (!just)
    {
        return 0;
    }
    int justLength = strlen(just);
    if (justLength >= 2)
    {
        char hJust = just[1];
        if (hJust == 'C')
        {
            xb[0] = x - width / 2;
            xb[1] = x + width / 2;
            xb[2] = x + width / 2;
            xb[3] = x - width / 2;
        }
        else if (hJust == 'L')
        {
            xb[0] = x;
            xb[1] = x + width;
            xb[2] = x + width;
            xb[3] = x;
        }
        else if (hJust == 'R')
        {
            xb[0] = x - width;
            xb[1] = x;
            xb[2] = x;
            xb[3] = x - width;
        }
        else
        {
            LOG("Unknown text justification: %s\n", just);
        }
    }

    char vJust = just[0];
    if (vJust == 'T')
    {
        yb[0] = y - height;
        yb[1] = y - height;
        yb[2] = y;
        yb[3] = y;
    }
    else if (vJust == 'C')
    {
        yb[0] = y - height / 2;
        yb[1] = y - height / 2;
        yb[2] = y + height / 2;
        yb[3] = y + height / 2;
    }
    else if (vJust == 'B')
    {
        yb[0] = y;
        yb[1] = y;
        yb[2] = y + height;
        yb[3] = y + height;
    }
    else
    {
        LOG("Unknown text justification: %s\n", just);
    }

    float angle = atan2f(-upx, upy);

    rot2D(xb, yb, x, y, angle);
    rot2D(xb + 1, yb + 1, x, y, angle);
    rot2D(xb + 2, yb + 2, x, y, angle);
    rot2D(xb + 3, yb + 3, x, y, angle);
    return 1;
}

int astGAttr(int attr, double value, double* old_value, int prim)
{
    const char attrStrings[5][32] = {"GRF__STYLE", "GRF__WIDTH", "GRF__SIZE", "GRF__FONT", "GRF__COLOUR"};
    const char primStrings[3][32] = {"GRF__TEXT", "GRF__LINE", "GRF__MARK"};

    if (attr == GRF__WIDTH)
    {
        *old_value = lineThickness;

        if (value != AST__BAD)
        {
            lineThickness = value;
            EM_ASM_({Module.gridContext.lineWidth = $0;}, lineThickness);
        }
    }
    else if (attr == GRF__COLOUR)
    {
        *old_value = colorVals[prim];

        if (value != AST__BAD)
        {
            colorVals[prim] = value;
        }
    }
    else if (attr == GRF__SIZE)
    {
        *old_value = fontSizeVals[prim];
        if (value != AST__BAD)
        {
            fontSizeVals[prim] = value;
        }
    }
    else if (attr == GRF__FONT)
    {
        *old_value = fontVals[prim];
        if (value != AST__BAD)
        {
            fontVals[prim] = (int)value;
        }
    }

    return 1;
}

int astGScales(float* alpha, float* beta)
{
    return 1;
}

int astGCap(int cap, int value)
{
    if (cap == GRF__SCALES)
    {
        return 0;
    }
    else
    {
        return 0;
    }
}

int astGBBuf(void)
{
    numColors = EM_ASM_INT({return Module.colors.length;});
    numFonts = EM_ASM_INT({return Module.fonts.length;});
    EM_ASM_({
        Module.gridContext.lineWidth = $0 * devicePixelRatio;
        Module.gridContext.font = Module.fonts[0];
        Module.gridContext.clearRect(0, 0, Module.gridContext.canvas.width, Module.gridContext.canvas.height);
    }, lineThickness);
    fontSizeVals[0] = 20;
    fontSizeVals[1] = 20;
    fontSizeVals[2] = 20;
    return 1;
}

int astGEBuf(void)
{
    return 1;
}

/* Unused 3D Function definitions */
int astG3DCap(int cap, int value)
{
    return 1;
}

int astG3DFlush(void)
{
    return 1;
}

int astG3DLine(int n, float* x, float* y, float* z)
{
    return 1;
}

int astG3DQch(float* ch)
{
    *ch = 10.0f;
    return 1;
}

int astG3DMark(int n, float* x, float* y, float* z, int type, float norm[3])
{
    return 1;
}

int astG3DText(const char* text, float ref[3], const char* just,
               float up[3], float norm[3])
{
    return 1;
}

int astG3DTxExt(const char* text, float ref[3], const char* just,
                float up[3], float norm[3], float* xb, float* yb,
                float* zb, float bl[3])
{
    return 1;
}

int astG3DAttr(int attr, double value, double* old_value, int prim)
{
    return 1;
}

}