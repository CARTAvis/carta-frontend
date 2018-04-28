extern "C" {
#include "ast.h"
void astPutErr_(int status_value, const char* message)
{
	int* status = astGetStatusPtr;
	(void) fprintf(stderr, "%s%s\n", astOK ? "!! " : "!  ", message);
}
}

#include <iostream>
#include <string.h>
#include <chrono>
#include <vector>
#include <emscripten.h>
struct AstGuard
{
	AstGuard()
	{ astBegin; }
	~AstGuard()
	{ astEnd; }
};

using namespace std;

vector<string> systems = {
	"ECLIPTIC",
	"FK4",
	"FK5",
	"GALACTIC",
	"ICRS",
	"J2000"
};

string headerStr =
	"SIMPLE  =                    T / conforms to FITS standard                      BITPIX  =                  -32 / array data type                                NAXIS   =                    3 / number of array dimensions                     NAXIS1  =                 5850                                                  NAXIS2  =                 1074                                                  NAXIS3  =                    1                                                  OBJECT  = 'GALFACTS_N4 Stokes I'                                  /  Object nameCTYPE1  = 'RA---CAR'           /  1st axis type                                 CRVAL1  =           333.750000 /  Reference pixel value                         CRPIX1  =              2925.50 /  Reference pixel                               CDELT1  =           -0.0166667 /  Pixel size in world coordinate units          CROTA1  =               0.0000 /  Axis rotation in degrees                      CTYPE2  = 'DEC--CAR'           /  2nd axis type                                 CRVAL2  =             0.000000 /  Reference pixel value                         CRPIX2  =             -1181.50 /  Reference pixel                               CDELT2  =            0.0166667 /  Pixel size in world coordinate units          CROTA2  =               0.0000 /  Axis rotation in degrees                      CTYPE3  = 'FREQ'               /  3rd axis type                                 CRVAL3  =    1524717952.000000 /  Reference pixel value                         CRPIX3  =                 1.00 /  Reference pixel                               CDELT3  =      -420000.0000000 /  Pixel size in world coordinate units          CROTA3  =               0.0000 /  Axis rotation in degrees                      EQUINOX =              2000.00 /  Equinox of coordinates (if any)               BUNIT   = 'Kelvin'                                 /  Units of pixel data valuesHISTORY Image was compressed by CFITSIO using scaled integer quantization:      HISTORY   q = 2.000000 / quantized level scaling parameter                      HISTORY 'SUBTRACTIVE_DITHER_1' / Pixel Quantization Algorithm                   CHECKSUM= '4LTe5LRd4LRd4LRd'   / HDU checksum updated 2017-06-01T10:19:12       DATASUM = '159657855'          / data unit checksum updated 2017-06-01T10:19:12 END                                                                             ";

extern "C" {
EMSCRIPTEN_KEEPALIVE int plotCustomGrid(int imageX1, int imageX2, int imageY1, int imageY2, int width, int height, int padding, int gridColor,
										int tickColor, int axesColor, int borderColor, int titleColor, int numLabColor,
										int textLabColor, int labelType, double tol, double gapAxis1, double gapAxis2, int sys)
{
	int status = 0;

	astClearStatus;
	AstGuard astGuard;

	AstFitsChan* fitschan = astFitsChan(NULL, NULL, "");
	if (!fitschan)
	{
		cout << "astFitsChan returned null :(" << endl;
		return 1;
	}
	astPutCards(fitschan, headerStr.c_str());
	AstFrameSet* wcsinfo = static_cast<AstFrameSet*>(astRead(fitschan));

	if (!astOK)
	{
		cout << "Some AST LIB error, check logs." << endl;
		return 1;
	}
	else if (wcsinfo == AST__NULL)
	{
		cout << "No WCS found" << endl;
		return 1;
	}
	else if (strcmp(astGetC(wcsinfo, "Class"), "FrameSet"))
	{
		cout << "check FITS header (astlib)" << endl;
		return 1;
	}

	AstPlot* plot;
	float hi = 1, lo = -1, scale, x1 = padding, x2 = width - padding, xleft, xright, xscale;
	float y1 = padding, y2 = height - padding, ybottom, yscale, ytop;

	int nx = imageX2 - imageX1;
	int ny = imageY2 - imageY1;

	xscale = (x2 - x1) / nx;
	yscale = (y2 - y1) / ny;
	scale = (xscale < yscale) ? xscale : yscale;
	xleft = 0.5f * (x1 + x2 - nx * scale);
	xright = 0.5f * (x1 + x2 + nx * scale);
	ybottom = 0.5f * (y1 + y2 - ny * scale);
	ytop = 0.5f * (y1 + y2 + ny * scale);


	float gbox[] = {xleft, ybottom, xright, ytop};
	double pbox[] = {(double)imageX1, (double)imageY1, (double)imageX2, (double)imageY2};
	auto tStart = chrono::high_resolution_clock::now();
	plot = astPlot(wcsinfo, gbox, pbox, "");

	if (sys >= 0 && sys < systems.size())
	{
		astSet(plot, "System=%s", systems[sys].c_str());
	}

	astSet(plot, "Font=%i", 3);
	astSet(plot, "Color=%i", 1);

	astSet(plot, "Grid=%i", gridColor >= 0 ? 1 : 0);
	if (gridColor >= 0)
	{
		astSet(plot, "Color(grid)=%i", gridColor);
	}

	astSet(plot, "Border=%i", borderColor >= 0 ? 1 : 0);
	if (borderColor >= 0)
	{
		astSet(plot, "Color(border)=%i", borderColor);
	}

	astSet(plot, "DrawTitle=%i", titleColor >= 0 ? 1 : 0);
	if (titleColor >= 0)
	{
		astSet(plot, "Color(title)=%i", titleColor);
	}

	astSet(plot, "DrawAxes=%i", axesColor >= 0 ? 1 : 0);
	if (axesColor >= 0)
	{
		astSet(plot, "Color(axes)=%i", axesColor);
	}

	if (tickColor >= 0)
	{
		astSet(plot, "Color(ticks)=%i", tickColor);
	}
	else
	{
		astSet(plot, "MinTick=0");
	}

	astSet(plot, "NumLab=%i", numLabColor >= 0 ? 1 : 0);
	if (numLabColor >= 0)
	{
		astSet(plot, "Color(numlab)=%i", numLabColor);
	}

	astSet(plot, "textLab=%i", textLabColor >= 0 ? 1 : 0);
	if (numLabColor >= 0)
	{
		astSet(plot, "Color(textLab)=%i", textLabColor);
	}

	if (labelType)
	{
		astSet(plot, "Labelling=interior");
	}
	else
	{
		astSet(plot, "Labelling=exterior");
	}

	astSet(plot, "Tol=%f", tol);

	if (gapAxis1 > 0)
	{
		astSet(plot, "Gap(1)=%f", gapAxis1);
	}
	if (gapAxis2 > 0)
	{
		astSet(plot, "Gap(2)=%f", gapAxis2);
	}

	astBBuf(plot);
	astGrid(plot);
	astEBuf(plot);
	auto tEnd = chrono::high_resolution_clock::now();
	astAnnul(plot);
	auto dt = chrono::duration_cast<chrono::milliseconds>(tEnd - tStart).count();
	cout << "Plotted in " << dt << " ms" << endl;
	return 0;
}
}

int main(int argc, char* argv[])
{
	plotCustomGrid(0, 1024, 0, 1024, 1024, 1024, 100, 1, 1, 1, 1, 1, 1, 1, 1, 0.02, -1, -1, -1);
}