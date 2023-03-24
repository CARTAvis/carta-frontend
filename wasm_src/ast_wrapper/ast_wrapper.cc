#include <string.h>
#include <emscripten.h>
#include <cmath>

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

EMSCRIPTEN_KEEPALIVE AstFitsChan* emptyFitsChan()
{
    return astFitsChan(nullptr, nullptr, "");
}

EMSCRIPTEN_KEEPALIVE void putFits(AstFitsChan* fitschan, const char* card)
{
    astPutFits(fitschan, card, true);
}

EMSCRIPTEN_KEEPALIVE AstFrameSet* getFrameFromFitsChan(AstFitsChan* fitschan, bool checkSkyDomain)
{
    astClear(fitschan, "Card");
    AstFrameSet* frameSet = static_cast<AstFrameSet*>(astRead(fitschan));
    if (!frameSet || !astIsAFrameSet(frameSet))
    {
        cout << "Creating frame set failed." << endl;
        return nullptr;
    }

    // work around for missing CTYPE1 & CTYPE2
    if (checkSkyDomain) {
        const char *domain = astGetC(frameSet, "Domain");
        if (!strstr(domain, "SKY")) {
            astDelete(frameSet);
            return nullptr;
        }
    }

    return frameSet;
}

EMSCRIPTEN_KEEPALIVE AstSpecFrame* getSpectralFrame(AstFrameSet* frameSet)
{
    if (!frameSet || !astIsAFrameSet(frameSet))
    {
        cout << "Invalid frame set." << endl;
        return nullptr;
    }

    // Find spectral frame with spectral template
    AstSpecFrame *spectralTemplate = astSpecFrame("MaxAxes=100,MinAxes=0");
    if (!spectralTemplate)
    {
        cout << "Creating spectral template failed." << endl;
        return nullptr;
    }
    AstFrameSet* found = static_cast<AstFrameSet*>astFindFrame(frameSet, spectralTemplate, " ");
    if (!found)
    {
        cout << "Spectral frame not found." << endl;
        return nullptr;
    }
    AstSpecFrame *specframe = static_cast<AstSpecFrame*>astGetFrame(found, AST__CURRENT);
    if (!specframe)
    {
        cout << "Getting spectral frame failed." << endl;
        return nullptr;
    }

    return static_cast<AstSpecFrame*> astCopy(specframe);
}

EMSCRIPTEN_KEEPALIVE AstFrameSet* getSkyFrameSet(AstFrameSet* frameSet)
{
    if (!frameSet || !astIsAFrameSet(frameSet))
    {
        cout << "Invalid frame set." << endl;
        return nullptr;
    }

    // Create 2D base frame
    AstFrame *baseframe = astFrame(2, "Title=Pixel Coordinates,Domain=GRID,Label(1)=Pixel axis 1,Label(2)=Pixel axis 2");
    if (!baseframe)
    {
        cout << "Create 2D base frame failed." << endl;
        return nullptr;
    }

    // Find sky frame with sky template
    AstSkyFrame *skyTemplate = astSkyFrame("MaxAxes=100,MinAxes=0");
    if (!skyTemplate)
    {
        cout << "Creating sky template failed." << endl;
        return nullptr;
    }
    AstFrameSet* found = static_cast<AstFrameSet*>astFindFrame(frameSet, skyTemplate, " ");
    if (!found)
    {
        cout << "Sky frame not found." << endl;
        return nullptr;
    }
    AstSkyFrame *skyframe = static_cast<AstSkyFrame*>astGetFrame(found, AST__CURRENT);
    if (!skyframe)
    {
        cout << "Getting sky frame failed." << endl;
        return nullptr;
    }

    // Get 2D map
    int inaxes[2] = {1, 2};
    int outaxes[3];
    AstMapping *map2D;
    astMapSplit(frameSet, 2, inaxes, outaxes, &map2D); // map is a deep copy
    if (!map2D)
    {
        cout << "Getting 2D mapping failed." << endl;
        return nullptr;
    }

    // Create frame set with base frame, sky frame, 2D mapping
    AstFrameSet *skyframeSet = astFrameSet(baseframe, "");
    if (!skyframeSet)
    {
        cout << "Creating sky frame set failed." << endl;
        return nullptr;
    }
    astAddFrame(skyframeSet, AST__CURRENT, astSimplify(map2D), skyframe);

    return skyframeSet;
}

EMSCRIPTEN_KEEPALIVE AstFrameSet* createTransformedFrameset(AstFrameSet* wcsinfo, double offsetX, double offsetY, double angle, double originX, double originY, double scaleX, double scaleY)
{
    // 2D scale and rotation matrix
    double sinTheta = sin(angle);
    double cosTheta = cos(angle);
    double matrixElements[] = {cosTheta * scaleX, -sinTheta * scaleX, sinTheta * scaleY, cosTheta * scaleY};
    AstMatrixMap* matrixMap = astMatrixMap(2, 2, 0, matrixElements, "");

    if (matrixMap == AST__NULL) {
        cout << "Creating matrix map failed." << endl;
        return nullptr;
    }

    AstFrame* pixFrame = static_cast<AstFrame*> astGetFrame(wcsinfo, 1);
    AstFrame* pixFrameCopy = static_cast<AstFrame*> astCopy(pixFrame);
    AstFrame* skyFrame = static_cast<AstFrame*> astGetFrame(wcsinfo, 2);
    AstMapping* pixToSkyMapping = static_cast<AstMapping*> astGetMapping(wcsinfo, 1, 2);
    AstFrameSet* wcsInfoTransformed = astFrameSet(pixFrame, "");

    // 2D shifts
    double offsetToOrigin[] = {-originX, -originY};
    double offsetFromOrigin[] = {originX + offsetX, originY + offsetY};
    AstShiftMap* shiftMapToOrigin = astShiftMap(2, offsetToOrigin, "");
    AstShiftMap* shiftMapFromOrigin = astShiftMap(2, offsetFromOrigin, "");

    //  Combined mapping
    AstCmpMap* combinedMap = astCmpMap(shiftMapToOrigin, matrixMap, 1, "");
    AstCmpMap* combinedMap2 = astCmpMap(combinedMap, shiftMapFromOrigin, 1, "");

    astAddFrame(wcsInfoTransformed, 1, combinedMap2, pixFrameCopy);
    astAddFrame(wcsInfoTransformed, 2, pixToSkyMapping, skyFrame);
    astSetI(wcsInfoTransformed, "Current", 3);
    return wcsInfoTransformed;
}

EMSCRIPTEN_KEEPALIVE AstFrameSet* initDummyFrame()
{
    double offsets[] = {-1, -1};
    AstFrameSet* frameSet = astFrameSet(astFrame(2, ""), "");
    astAddFrame(frameSet, 1, astShiftMap(2, offsets, ""), astFrame(2, "Label(1)=X Coordinate,Label(2)=Y Coordinate,Domain=PIXEL"));
    return frameSet;
}

void plotDistText(AstFrameSet* wcsinfo, AstPlot* plot, double* start, double* finish)
{
    double dist = astDistance(wcsinfo, start, finish);
    double middle[2];
    astOffset(plot, start, finish, dist / 2, middle);
    float up[] = {0.0f, 1.0f}; // horizontal text
    string distString;
    const char* unit = astGetC(wcsinfo, "Unit(1)");
    if (strstr(unit, "degree") != nullptr || strstr(unit, "hh:mm:s") != nullptr)
    {
        if (dist < M_PI / 180.0 / 60.0)
        {
            distString = to_string(dist * 180.0 / M_PI * 3600.0);
            distString += '"';
        }
        else if (dist < M_PI / 180.0)
        {
            distString = to_string(dist * 180.0 / M_PI * 60.0);
            distString += "'";
        }
        else
        {
            distString = to_string(dist * 180.0 / M_PI);
            distString += "\u00B0";
        }
    }
    else
    {
        distString = to_string(dist);
        if (unit[0] == '\0') {
            distString += "pix";
        }
    }
    const char* distChar = distString.c_str();

    astText(plot, distChar, middle, up, "TC");
}

EMSCRIPTEN_KEEPALIVE int plotGrid(AstFrameSet* wcsinfo, double imageX1, double imageX2, double imageY1, double imageY2, double width, double height,
                                        double paddingLeft, double paddingRight, double paddingTop, double paddingBottom, const char* args,
                                        bool showCurve, bool isPVImage, double curveX1, double curveY1, double curveX2, double curveY2)
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

    if (showCurve)
    {
        const double x[] = {curveX1, curveX2};
        const double y[] = {curveY1, curveY2};
        double xtran[2];
        double ytran[2];
        astTran2(wcsinfo, 2, x, y, 1, xtran, ytran);
        
        double in[2][4] = {{xtran[0], xtran[1], xtran[1], xtran[0]}, {ytran[0], ytran[1], ytran[0], ytran[0]}};
        const double* inPtr = in[0];
        astPolyCurve(plot, 4, 2, 4, inPtr);

        double start[] = {xtran[0], ytran[0]};
        double finish[] = {xtran[1], ytran[1]};
        if (isPVImage)
        {
            double corner[] = {xtran[1], ytran[0]};
            plotDistText(wcsinfo, plot, start, corner);
            plotDistText(wcsinfo, plot, finish, corner);
        }
        else
        {
            plotDistText(wcsinfo, plot, start, finish);
        }        
    }

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

EMSCRIPTEN_KEEPALIVE int unformat(AstFrameSet* wcsinfo, int axis, const char* formattedString, double *value)
{
    if (!wcsinfo)
    {
        return 1;
    }

    astUnformat(wcsinfo, axis, formattedString, value);
    if (!astOK)
    {
        astClearStatus;
        return 1;
    }
    return 0;
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

EMSCRIPTEN_KEEPALIVE void  setI(AstObject* obj, const char* attrib, int val)
{
    astSetI(obj, attrib, val);
}

EMSCRIPTEN_KEEPALIVE void  setD(AstObject* obj, const char* attrib, double val)
{
    astSetD(obj, attrib, val);
}


EMSCRIPTEN_KEEPALIVE int clear(AstObject* obj, const char* attrib)
{
    if (!obj)
    {
        return 1;
    }

    astSet(obj, attrib);
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

//xin and yin needs to be transformed
EMSCRIPTEN_KEEPALIVE int pointList(AstFrameSet* wcsinfo, int npoint, double xin[], double yin[], double out[])
{
    if (!wcsinfo)
    {
        cout << "not wcsinfo" << endl;
        return 1;
    }

    double start[] = {xin[0], yin[0]};
    double finish[] = {xin[1], yin[1]};

    double dist = astDistance(wcsinfo, start, finish);
    double discreteDist = dist/npoint;
    double output[2];

    double* xout = new double[npoint];
    double* yout = new double[npoint];
    double* xOut = new double[npoint];
    double* yOut = new double[npoint];
    
    for(int i = 0; i < npoint; i++) {
        double distance = discreteDist * i;
        astOffset(wcsinfo, start, finish, distance, output);
        xout[i] = output[0];
        yout[i] = output[1];
    }

    astTran2(wcsinfo, npoint, xout, yout, 0, xOut, yOut);

    for(int i = 0; i < npoint; i++) {
         out[i * 2] = xOut[i];
         out[i * 2 + 1] = yOut[i];
    }

    delete[] xout;
    delete[] yout;
    delete[] xOut;
    delete[] yOut;

    if (!astOK)
    {
        astClearStatus;
        return 1;
    }
    return 0;
}

//point list along the direction of axis
EMSCRIPTEN_KEEPALIVE int axPointList(AstFrameSet* wcsinfo, int npoint, int axis, double x, double y, double dist, double out[])
{
    if (!wcsinfo)
    {
        cout << "not wcsinfo" << endl;
        return 1;
    }

    double discreteDist = dist/npoint;

    double output;
    double* xout = new double[npoint];
    double* yout = new double[npoint];
    double* xOut = new double[npoint];
    double* yOut = new double[npoint];

    for(int i = 0; i < npoint; i++) {
        double distance = discreteDist * i;

        if(axis == 1) {
            output = astAxOffset(wcsinfo, axis, x, distance);
            xout[i] = output;
            yout[i] = y;
        } else if (axis == 2) {
            output = astAxOffset(wcsinfo, axis, y, distance);
            xout[i] = x;
            yout[i] = output;
        }
    }

    astTran2(wcsinfo, npoint, xout, yout, 0, xOut, yOut);

    for(int i = 0; i < npoint; i++) {
         out[i * 2] = xOut[i];
         out[i * 2 + 1] = yOut[i];
    }

    delete[] xout;
    delete[] yout;
    delete[] xOut;
    delete[] yOut;

    if (!astOK)
    {
        astClearStatus;
        return 1;
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE int transform3D(AstSpecFrame* wcsinfo, double x, double y, double z, const int forward, double* out)
{
    if (!wcsinfo)
    {
        return 1;
    }

    double in[] = {x, y, z};
    astTranN(wcsinfo, 1, 3, 1, in, forward, 3, 1, out);
    if (!astOK)
    {
        astClearStatus;
        return 1;
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE int spectralTransform(AstSpecFrame* specFrameFrom, const char* specTypeTo, const char* specUnitTo, const char* specSysTo, const int npoint, const double zIn[], const int forward, double zOut[])
{
    if (!specFrameFrom)
    {
        return 1;
    }

    AstSpecFrame* specFrameTo = nullptr;
    specFrameTo = static_cast<AstSpecFrame*> astCopy(specFrameFrom);
    if (!specFrameTo)
    {
        return 1;
    }

    char buffer[128];
    if (specTypeTo) {
        snprintf(buffer, sizeof(buffer), "System=%s", specTypeTo);
        astSet(specFrameTo, buffer);
    }
    if (specUnitTo) {
        snprintf(buffer, sizeof(buffer), "Unit=%s", specUnitTo);
        astSet(specFrameTo, buffer);
    }
    if (specSysTo) {
        snprintf(buffer, sizeof(buffer), "StdOfRest=%s", specSysTo);
        astSet(specFrameTo, buffer);
    }

    AstFrameSet *cvt;
    cvt = static_cast<AstFrameSet*> astConvert(specFrameFrom, specFrameTo, "");

    astTran1(cvt, npoint, zIn, forward, zOut);
    if (!astOK)
    {
        astClearStatus;
        return 1;
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE void deleteObject(AstFrameSet* src)
{
    astDelete(src);
}

EMSCRIPTEN_KEEPALIVE AstObject* copy(AstObject* src)
{
    return static_cast<AstObject*> astCopy(src);
}

EMSCRIPTEN_KEEPALIVE void invert(AstFrameSet* src)
{
    astInvert(src);
}

EMSCRIPTEN_KEEPALIVE AstFrameSet* convert(AstFrameSet* from, AstFrameSet* to, const char* domainlist)
{
    return static_cast<AstFrameSet*> astConvert(from, to, domainlist);
}

EMSCRIPTEN_KEEPALIVE AstShiftMap* shiftMap2D(double x, double y)
{
    double coords[] = {x, y};
    return astShiftMap(2, coords, "");
}

EMSCRIPTEN_KEEPALIVE double axDistance(AstFrameSet* wcsinfo, int axis, double v1, double v2)
{
    return astAxDistance(wcsinfo, axis, v1, v2);
}

EMSCRIPTEN_KEEPALIVE double geodesicDistance(AstFrameSet* wcsinfo, double x1, double y1, double x2, double y2)
{
    const double x[] = {x1, x2};
    const double y[] = {y1, y2};
    double xtran[2];
    double ytran[2];
    astTran2(wcsinfo, 2, x, y, 1, xtran, ytran);

    double start[] = {xtran[0], ytran[0]};
    double finish[] = {xtran[1], ytran[1]};
    return astDistance(wcsinfo, start, finish) * 180.0 / M_PI * 3600.0;
}

EMSCRIPTEN_KEEPALIVE AstFrame* frame(int naxes, const char* options)
{
    return astFrame(naxes, options);
}

EMSCRIPTEN_KEEPALIVE void addFrame(AstFrameSet* frameSet, int iframe, AstMapping* map, AstFrame* frame)
{
    astAddFrame(frameSet, iframe, map, frame);
}

EMSCRIPTEN_KEEPALIVE AstMatrixMap* scaleMap2D(double sx, double sy)
{
    double diags[] = {sx, sy};
    return astMatrixMap(2, 2, 1, diags, "");
}

EMSCRIPTEN_KEEPALIVE float* fillTransformGrid(AstFrameSet* wcsInfo, double xMin, double xMax, int nx, double yMin, double yMax, int ny, int forward)
{
    if (!wcsInfo)
    {
        return nullptr;
    }
    
    int N = nx * ny;
    double deltaX = (xMax - xMin) / nx;
    double deltaY = (yMax - yMin) / ny;
    double* pixAx = new double[N];
    double* pixAy = new double[N];
    double* pixBx = new double[N];
    double* pixBy = new double[N];
    float* out = new float[N * 2];

    // Fill input array
    for (auto i = 0; i < nx; i++) {
        for (auto j = 0; j < ny; j++) {
            pixAx[j * nx + i] = xMin + i * deltaX;
            pixAy[j * nx + i] = yMin + j * deltaY;
        }
    }

    // Debug: pass-through
    if (forward < 0)
    {
        memcpy(pixBx, pixAx, N * sizeof(double));
        memcpy(pixBy, pixAy, N * sizeof(double));
    }
    else
    {
        astTran2(wcsInfo, N, pixAx, pixAy, forward, pixBx, pixBy);
    }

    // Convert to float and fill output array
    for (auto i = 0; i < N; i++)
    {
        out[2* i] = pixBx[i];
        out[2 * i + 1] = pixBy[i];
    }

    // Clean up temp double precision pixels
    delete[] pixAx;
    delete[] pixAy;
    delete[] pixBx;
    delete[] pixBy;

    return out;
}

EMSCRIPTEN_KEEPALIVE AstFrameSet* makeSwappedFrameSet(AstFrameSet* originFrameSet, int dirAxis, int spectralAxis, int pixelZ, int nsample)
{
    astBegin;
    int axisCount = 3;

    if (astGetI(originFrameSet, "Nin") != axisCount || astGetI(originFrameSet, "Nout") != axisCount)
    {
        std::cerr << "Bad frame set!\n";
        return nullptr;
    }

    if (dirAxis < 1 || dirAxis > axisCount || spectralAxis < 1 || spectralAxis > axisCount)
    {
        std::cerr << "Bad axis index!\n";
        return nullptr;
    }

    AstMapping* originMap = static_cast<AstMapping*> astGetMapping(originFrameSet, AST__BASE, AST__CURRENT);

    AstMapping* spectralMap = nullptr;
    int spectralAxisOut;
    astMapSplit(originMap, 1, &spectralAxis, &spectralAxisOut, &spectralMap);

    if (!spectralMap || astGetI(spectralMap, "Nin") != 1 || astGetI(spectralMap, "Nout") != 1)
    {
        std::cerr << "The spectral axis cannot be split from the original axes!\n";
        return nullptr;
    }

    // Work space holding 3D pixel positions
    double* posData = static_cast<double*>(astMalloc(axisCount * nsample * sizeof(double)));

    if (!posData)
    {
        std::cerr << "Fail to allocate input position data array!\n";
        return nullptr;
    }

    // Fill the above array with pixel positions
    for (int i = 0; i < nsample; i++)
    {
        for (int j = 0; j < axisCount; j++)
        {
            int workIndex = j * nsample + i;
            if (j == dirAxis - 1)
            {
                // For rendered direction axis
                posData[workIndex] = i + 1;
            }
            else if (j == spectralAxis - 1)
            {
                // For rendered spectral axis
                posData[workIndex] = 1;
            }
            else
            {
                // For hidden direction axis (not rendered axis)
                if (pixelZ > 0) {
                    posData[workIndex] = pixelZ;
                }
                else
                {
                    posData[workIndex] = 0;
                }
            }
        }
    }

    // Work space holding 3D world positions
    double* worldData = static_cast<double*>(astMalloc(axisCount * nsample * sizeof(double)));

    if (!worldData)
    {
        std::cerr << "Fail to allocate output world data array!\n";
        return nullptr;
    }

    // Transform the pixel positions into world coordinates
    astTranN(originFrameSet, nsample, axisCount, nsample, posData, 1, axisCount, nsample, worldData);

    // "Smooth" the delta rad that its max difference between two adjacent elements should not be greater than PI
    bool smoothDeltaRad(false);
    for (int i = 0; i < nsample - 1; ++i)
    {
        double rad1 = *(worldData + (dirAxis - 1) * nsample + i);
        double rad2 = *(worldData + (dirAxis - 1) * nsample + i + 1);
        if ((std::signbit(rad1) != std::signbit(rad2)) && (fabs(rad1 - rad2) >= M_PI))
        {
            smoothDeltaRad = true;
            break;
        }
    }

    if (smoothDeltaRad)
    {
        for (int i = 0; i < nsample; ++i)
        {
            double tmpRad = *(worldData + (dirAxis - 1) * nsample + i);
            if (tmpRad < 0)
            {
                *(worldData + (dirAxis - 1) * nsample + i) = M_PI * 2 + tmpRad;
            }
        }
    }

    // Create a lookup table that transforms 1D pixel axis (on the pixel axis that is being retained) into the
    // corresponding value on the retained celestial axis
    AstLutMap* dirLutMap = astLutMap(nsample, worldData + (dirAxis - 1) * nsample, 1.0, 1.0, " ");

    // Create a new 2D frame to represent direction v.s. spectral axis
    int axes[2]; // 1-based indices of axes to be picked
    if (spectralAxis == 2)
    {
        axes[0] = dirAxis;
        axes[1] = spectralAxis;
    }
    else
    {
        // For spectralAxis == 1
        axes[0] = spectralAxis;
        axes[1] = dirAxis;
    }

    // Set returned frame set
    AstFrameSet* result = astFrameSet(astPickAxes(astGetFrame(originFrameSet, AST__BASE), 2, axes, NULL), " ");

    // 2-d Mapping from pixel to world
    AstCmpMap* newCmpMap = nullptr;

    if (spectralAxis == 2)
    {
        newCmpMap = astCmpMap(dirLutMap, spectralMap, 0, " ");
    }
    else
    {
        // For spectralAxis == 1
        newCmpMap = astCmpMap(spectralMap, dirLutMap, 0, " ");
    }

    astAddFrame(result, AST__BASE, newCmpMap, astPickAxes(originFrameSet, 2, axes, NULL));
    astExport(result);

    // Free work spaces
    worldData = static_cast<double*>(astFree(worldData));
    posData = static_cast<double*>(astFree(posData));

    astEnd;

    return result;
}
}
