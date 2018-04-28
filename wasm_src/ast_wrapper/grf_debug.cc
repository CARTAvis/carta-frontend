extern "C" {
#include "grf.h"
#include "ast.h"
#include <stdio.h>
#include <string.h>
#include <emscripten.h>
#include <math.h>

#define PI 3.14159265
#define LOG //printf

double colorVal = 0;

int appliedColorVal = -1;

double lineThickness = 1.0;

double interval = 100;

int counter = 0;

int numColors = 1;

double fontHeight = -1;

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

void applyColor()
{
	int index = ((int) colorVal) % numColors;
	if (index != appliedColorVal)
	{
		EM_ASM_({
					Module.gridContext.strokeStyle = Module.colors[$0];
			Module.gridContext.fillStyle = Module.colors[$0];
				}, index);
		LOG("setting line color to %i\n", index);
		appliedColorVal = index;
	}
}

int astGFlush(void)
{
	LOG("astGFlush\n");
	return 1;
}

int astGLine(int n, const float* x, const float* y)
{
	applyColor();
	LOG("astGLine (%i points)", n);
	if (n == 0)
	{
		return 1;
	}
	EM_ASM_({
				Module.gridContext.beginPath();
		Module.gridContext.moveTo($0, $1);
			}, x[0], y[0]);

	for (int i = 0; i < n; i++)
	{
		LOG(" (%0.3f, %0.3f)", x[i], y[i]);
		EM_ASM_({Module.gridContext.lineTo($0, $1);}, x[i], y[i]);
	}
	EM_ASM(Module.gridContext.stroke(););
	LOG("\n");
	return 1;
}

int astGQch(float* chv, float* chh)
{
	// canvas does not provide an easy method of measuring height.
	// measuring the width of the character "E" and doubling is a crude approximation
	float height = fontHeight;
	if (height < 0)
	{
		height = EM_ASM_DOUBLE({return 2*Module.gridContext.measureText("e").width;});
	}
	LOG("astGQch: %f\n", height);

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
	applyColor();
	LOG("astGMark (%i points)", n);
	for (int i = 0; i < n; i++)
	{
		LOG(" (%0.3f, %0.3f)", x[i], y[i]);
	}
	LOG("\n");
	return 1;
}

int astGText(const char* text, float x, float y, const char* just,
			 float upx, float upy)
{
	//float width = EM_ASM_DOUBLE({return Module.gridContext.measureText(UTF8ToString($0)).width;}, text);
	LOG("astGText (%s) @ (%0.2f, %0.2f) just: %s up %0.2f %0.2f\n", text, x, y, just, upx, upy);
	applyColor();

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
	LOG("astGTxExt (%s) @ (%0.2f, %0.2f) just: %s  up: %0.2f %0.2f\n", text, x, y, just, upx, upy);
	float height = fontHeight;
	if (height < 0)
	{
		height = EM_ASM_DOUBLE({return 2*Module.gridContext.measureText("e").width;});
	}
	float width = EM_ASM_DOUBLE({return Module.gridContext.measureText(UTF8ToString($0)).width;}, text);

	applyColor();

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

//	EM_ASM_({Module.gridContext.fillRect($0 - 2, $1 - 2, 4, 4);}, x, y);
//
//	EM_ASM_({
//				Module.gridContext.beginPath();
//		Module.gridContext.moveTo($0, $1);
//			}, xb[0], yb[0]);
//
//	EM_ASM_({
//				Module.gridContext.lineTo($0, $1);
//			}, xb[1], yb[1]);
//
//	EM_ASM_({
//				Module.gridContext.lineTo($0, $1);
//			}, xb[2], yb[2]);
//
//	EM_ASM_({
//				Module.gridContext.lineTo($0, $1);
//			}, xb[3], yb[3]);
//
//	EM_ASM_({
//				Module.gridContext.lineTo($0, $1);
//		Module.gridContext.stroke();
//			}, xb[0], yb[0]);

	return 1;
}

int astGAttr(int attr, double value, double* old_value, int prim)
{
	if (attr == GRF__WIDTH)
	{
		*old_value = lineThickness;

		if (value != AST__BAD)
		{
			lineThickness = value;
			EM_ASM_({Module.gridContext.lineWidth = $0;}, lineThickness);
			LOG("setting line width to %f\n", value);
		}
	}
	else if (attr == GRF__COLOUR)
	{
		*old_value = colorVal;

		if (value != AST__BAD)
		{
			colorVal = value;
		}
	}

	return 1;
}

int astGScales(float* alpha, float* beta)
{
	LOG("astGScales\n");
	*alpha = 1.0f;
	*beta = 1.0f;
	return 1;
}

int astGCap(int cap, int value)
{
	LOG("astGCap %i:%i\n", cap, value);
	if (cap == GRF__SCALES)
	{
		return 1;
	}
	else
	{
		return 0;
	}
}

int astGBBuf(void)
{
	LOG("astGBBuf\n");
	numColors = EM_ASM_INT({return Module.colors.length;});
	EM_ASM_({Module.gridContext.lineWidth = $0;}, lineThickness);
	EM_ASM(Module.gridContext.clearRect(0, 0, Module.gridContext.canvas.width, Module.gridContext.canvas.height););
	fontHeight = -1;
	return 1;
}

int astGEBuf(void)
{
	LOG("astGEBuf\n");
	return 1;
}

/* 3D Function definitions */
/* ==================== */
int astG3DCap(int cap, int value)
{
	LOG("astG3DCap %i:%i\n", cap, value);
	return 1;
}

int astG3DFlush(void)
{
	LOG("astG3DFlush\n");
	return 1;
}

int astG3DLine(int n, float* x, float* y, float* z)
{
	LOG("astG3DLine  (%i points)\n", n);
	return 1;
}

int astG3DQch(float* ch)
{
	LOG("astG3DQch\n");
	*ch = 10.0f;
	return 1;
}

int astG3DMark(int n, float* x, float* y, float* z, int type, float norm[3])
{
	LOG("astG3DMark  (%i points)\n", n);
	return 1;
}

int astG3DText(const char* text, float ref[3], const char* just,
			   float up[3], float norm[3])
{
	LOG("astG3DText  (%s)\n", text);
	return 1;
}

int astG3DTxExt(const char* text, float ref[3], const char* just,
				float up[3], float norm[3], float* xb, float* yb,
				float* zb, float bl[3])
{
	LOG("astG3DTxExt  (%s)\n", text);
	return 1;
}

int astG3DAttr(int attr, double value, double* old_value, int prim)
{
	LOG("astG3DAttr %i -> %f\n", attr, value);
	return 1;
}

}