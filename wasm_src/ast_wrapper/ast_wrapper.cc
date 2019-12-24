#include <string.h>
#include <emscripten.h>

extern "C" {
#include "ast.h"

char lastErrorMessage[256];

EMSCRIPTEN_KEEPALIVE const char * getLastErrorMessage() {
    return lastErrorMessage;
}

EMSCRIPTEN_KEEPALIVE void clearLastErrorMessage() {
    strncpy(lastErrorMessage, "", sizeof(lastErrorMessage));
}

void astPutErr_(int status_value, const char* message)
{
	int* status = astGetStatusPtr;
	(void) fprintf(stderr, "%s%s\n", astOK ? "!! " : "!  ", message);
        
	strncpy(lastErrorMessage, message, sizeof(lastErrorMessage));
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
        astClearStatus;
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
        astClearStatus;
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
    double offsets[] = {-1, -1};
    AstFrameSet* frameSet = astFrameSet(astFrame(2, ""), "");
    astAddFrame(frameSet, 1, astShiftMap(2, offsets, ""), astFrame(2, "Label(1)=X Coordinate,Label(2)=Y Coordinate,Domain=PIXEL"));
    return frameSet;
}

EMSCRIPTEN_KEEPALIVE int plotGrid(AstFrameSet* wcsinfo, double imageX1, double imageX2, double imageY1, double imageY2, double width, double height,
                                        double paddingLeft, double paddingRight, double paddingTop, double paddingBottom, const char* args)
{
 if (!wcsinfo)
    {
        return 1;
    }
	AstPlot* plot;
	double hi = 1, lo = -1, scale, x1 = paddingLeft, x2 = width - paddingRight, xleft, xright, xscale;
	double y1 = paddingBottom, y2 = height - paddingTop, ybottom, yscale, ytop;

	double nx = imageX2 - imageX1;
	double ny = imageY2 - imageY1;

	xscale = (x2 - x1) / nx;
	yscale = (y2 - y1) / ny;
	scale = (xscale < yscale) ? xscale : yscale;
	xleft = 0.5f * (x1 + x2 - nx * scale);
	xright = 0.5f * (x1 + x2 + nx * scale);
	ybottom = 0.5f * (y1 + y2 - ny * scale);
	ytop = 0.5f * (y1 + y2 + ny * scale);

	float gbox[] = {(float)xleft, (float)ybottom, (float)xright, (float)ytop};
	double pbox[] = {imageX1, imageY1, imageX2, imageY2};
	plot = astPlot(wcsinfo, gbox, pbox, args);
	astBBuf(plot);
    astGrid(plot);
    astEBuf(plot);
    astAnnul(plot);
    if (!astOK)
    {
        astClearStatus;
        return 1;
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE const char* format(AstFrameSet* wcsinfo, int axis, double value)
{
    if (!wcsinfo)
    {
        return nullptr;
    }

    const char* formattedVal = astFormat(wcsinfo, axis, value);
    if (!astOK)
    {
        astClearStatus;
        return nullptr;
    }
    return formattedVal;
}

EMSCRIPTEN_KEEPALIVE int set(AstFrameSet* wcsinfo, const char* attrib)
{
    if (!wcsinfo)
    {
        return 1;
    }

    astSet(wcsinfo, attrib);
    if (!astOK)
    {
        astClearStatus;
        return 1;
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE void dump(AstFrameSet* wcsinfo)
{
    if (wcsinfo)
    {
        astShow(wcsinfo);
    }
}

EMSCRIPTEN_KEEPALIVE const char* getString(AstFrameSet* wcsinfo, const char* attribute)
{
    if (!wcsinfo || !astHasAttribute(wcsinfo, attribute))
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
    if (!astOK)
    {
        astClearStatus;
        return 1;
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE double axDistance(AstFrameSet* wcsinfo, int axis, double v1, double v2)
{
    return astAxDistance(wcsinfo, axis, v1, v2);
}
}
