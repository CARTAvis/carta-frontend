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
#include <emscripten.h>

using namespace std;

extern "C" {

EMSCRIPTEN_KEEPALIVE AstFrameSet* initFrame(const char* header)
{
    AstFitsChan* fitschan = nullptr;
    AstFrameSet* wcsinfo = nullptr;
    int status = 0;
    if (wcsinfo)
    {
        astEnd;
    }
	astClearStatus;
    astBegin;

    fitschan = astFitsChan(NULL, NULL, "");
    if (!fitschan)
    {
        cout << "astFitsChan returned null :(" << endl;
        return nullptr;
    }
    if (!header)
    {
        cout << "Missing header argument." << endl;
        return nullptr;
    }

    astPutCards(fitschan, header);
    wcsinfo = static_cast<AstFrameSet*>(astRead(fitschan));

    if (!astOK)
    {
        cout << "Some AST LIB error, check logs." << endl;
        return nullptr;
    }
    else if (wcsinfo == AST__NULL)
    {
        cout << "No WCS found" << endl;
        return nullptr;
    }
    else if (strcmp(astGetC(wcsinfo, "Class"), "FrameSet"))
    {
        cout << "check FITS header (astlib)" << endl;
        return nullptr;
    }
    return wcsinfo;
}

EMSCRIPTEN_KEEPALIVE AstFrameSet* initDummyFrame() {
    AstFrame* frame = astFrame(2, "");
    return astFrameSet(frame, "");
}

EMSCRIPTEN_KEEPALIVE int plotGrid(AstFrameSet* wcsinfo, int imageX1, int imageX2, int imageY1, int imageY2, int width, int height,
                                        int paddingLeft, int paddingRight, int paddingTop, int paddingBottom, const char* args)
{
 if (!wcsinfo)
    {
        return 1;
    }
	AstPlot* plot;
	float hi = 1, lo = -1, scale, x1 = paddingLeft, x2 = width - paddingRight, xleft, xright, xscale;
	float y1 = paddingBottom, y2 = height - paddingTop, ybottom, yscale, ytop;

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
	plot = astPlot(wcsinfo, gbox, pbox, args);
	astBBuf(plot);
    astGrid(plot);
    astEBuf(plot);
    astAnnul(plot);
    return 0;
}

EMSCRIPTEN_KEEPALIVE const char* format(AstFrameSet* wcsinfo, int axis, double value)
{
    if (!wcsinfo)
    {
        return nullptr;
    }

    return astFormat(wcsinfo, axis, value);
}

EMSCRIPTEN_KEEPALIVE int set(AstFrameSet* wcsinfo, const char* attrib)
{
    if (!wcsinfo)
    {
        return 1;
    }

    astSet(wcsinfo, attrib);
    return 0;
}


EMSCRIPTEN_KEEPALIVE const char* getString(AstFrameSet* wcsinfo, const char* attribute)
{
    if (!wcsinfo)
    {
        return nullptr;
    }
    return astGetC(wcsinfo, attribute);
}

EMSCRIPTEN_KEEPALIVE int norm(AstFrameSet* wcsinfo, double inout[])
{
    if (!wcsinfo)
    {
        return 1;
    }
    astNorm(wcsinfo, inout);
    return 0;
}

EMSCRIPTEN_KEEPALIVE int transform(AstFrameSet* wcsinfo, int npoint, const double xin[], const double yin[], int forward, double xout[], double yout[])
{
    if (!wcsinfo)
    {
        return 1;
    }

    astTran2(wcsinfo, npoint, xin, yin, forward, xout, yout);
    return 0;
}
}