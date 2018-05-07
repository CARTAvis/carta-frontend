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

AstFitsChan* fitschan = nullptr;
AstFrameSet* wcsinfo = nullptr;

extern "C" {

EMSCRIPTEN_KEEPALIVE int initFrame(const char* header)
{
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
        return 1;
    }
    if (!header)
    {
        cout << "Missing header argument." << endl;
        return 1;
    }

    astPutCards(fitschan, header);
    wcsinfo = static_cast<AstFrameSet*>(astRead(fitschan));

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
    return 0;
}


EMSCRIPTEN_KEEPALIVE int plotGrid(int imageX1, int imageX2, int imageY1, int imageY2, int width, int height,
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
}