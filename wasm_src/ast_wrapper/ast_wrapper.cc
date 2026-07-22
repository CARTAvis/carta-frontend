#include <string.h>
#include <emscripten.h>
#include <cmath>
#include <string>

extern "C" {
#include "ast.h"

char lastErrorMessage[256];

EMSCRIPTEN_KEEPALIVE const char * getLastErrorMessage() {
    return lastErrorMessage;
}

EMSCRIPTEN_KEEPALIVE void clearLastErrorMessage() {
    strncpy(lastErrorMessage, "", sizeof(lastErrorMessage));
}

void astPutErr_(int statusValue, const char* message)
{
	int* status = astGetStatusPtr;
	(void) fprintf(stderr, "%s%s\n", astOK ? "!! " : "!  ", message);
        
	strncpy(lastErrorMessage, message, sizeof(lastErrorMessage));
}
}

#include <iostream>

using namespace std;

extern "C" {

EMSCRIPTEN_KEEPALIVE AstFitsChan* emptyFitsChan()
{
    return astFitsChan(nullptr, nullptr, "");
}

EMSCRIPTEN_KEEPALIVE void putFits(AstFitsChan* fitsChan, const char* card)
{
    astPutFits(fitsChan, card, true);
}

EMSCRIPTEN_KEEPALIVE AstFrameSet* getFrameFromFitsChan(AstFitsChan* fitsChan, bool checkSkyDomain)
{
    astClear(fitsChan, "Card");
    AstFrameSet* frameSet = static_cast<AstFrameSet*>(astRead(fitsChan));
    if (!frameSet || !astIsAFrameSet(frameSet))
    {
        cout << "Creating frame set failed." << endl;
        astClearStatus;
        return nullptr;
    }

    AstFrame* pixFrame = static_cast<AstFrame*> astGetFrame(frameSet, 1);
    astSet(pixFrame, "Label(1)=X coordinate,Label(2)=Y coordinate");

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
    AstSpecFrame *specFrame = static_cast<AstSpecFrame*>astGetFrame(found, AST__CURRENT);
    if (!specFrame)
    {
        cout << "Getting spectral frame failed." << endl;
        return nullptr;
    }

    return static_cast<AstSpecFrame*> astCopy(specFrame);
}

EMSCRIPTEN_KEEPALIVE AstFrameSet* getSkyFrameSet(AstFrameSet* frameSet)
{
    if (!frameSet || !astIsAFrameSet(frameSet))
    {
        cout << "Invalid frame set." << endl;
        return nullptr;
    }

    // Create 2D base frame
    AstFrame *baseFrame = astFrame(2, "Title=Pixel Coordinates,Domain=GRID,Label(1)=X coordinate,Label(2)=Y coordinate");
    if (!baseFrame)
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
    AstSkyFrame *skyFrame = static_cast<AstSkyFrame*>astGetFrame(found, AST__CURRENT);
    if (!skyFrame)
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
    AstFrameSet *skyFrameSet = astFrameSet(baseFrame, "");
    if (!skyFrameSet)
    {
        cout << "Creating sky frame set failed." << endl;
        return nullptr;
    }
    astAddFrame(skyFrameSet, AST__CURRENT, astSimplify(map2D), skyFrame);

    return skyFrameSet;
}

EMSCRIPTEN_KEEPALIVE AstCmpMap* getSpatialMapping(AstFrameSet* src, AstFrameSet* dest) {
    astInvert(dest);
    AstCmpMap* spatialMapping = astCmpMap(src, dest, 1, "");
    astInvert(dest);

    if (!astOK)
    {
        astClearStatus;
        return nullptr;
    }
    return spatialMapping;
}

EMSCRIPTEN_KEEPALIVE AstFrameSet* createTransformedFrameset(AstFrameSet* wcsInfo, double offsetX, double offsetY, double angle, double originX, double originY, double scaleX, double scaleY)
{
    auto clearStatusAndReturnNull = []() -> AstFrameSet* {
        if (!astOK) {
            astClearStatus;
        }
        return nullptr;
    };

    // 2D scale and rotation matrix
    double sinTheta = sin(angle);
    double cosTheta = cos(angle);
    double matrixElements[] = {cosTheta * scaleX, -sinTheta * scaleX, sinTheta * scaleY, cosTheta * scaleY};
    AstMatrixMap* matrixMap = astMatrixMap(2, 2, 0, matrixElements, "");

    if (matrixMap == AST__NULL) {
        cout << "Creating matrix map failed." << endl;
        return clearStatusAndReturnNull();
    }

    AstFrame* pixFrame = static_cast<AstFrame*> astGetFrame(wcsInfo, AST__BASE);
    AstFrame* pixFrameCopy = static_cast<AstFrame*> astCopy(pixFrame);
    AstFrame* skyFrame = static_cast<AstFrame*> astGetFrame(wcsInfo, AST__CURRENT);
    AstMapping* pixToSkyMapping = static_cast<AstMapping*> astGetMapping(wcsInfo, AST__BASE, AST__CURRENT);
    AstFrameSet* wcsInfoTransformed = astFrameSet(pixFrame, "");

    // 2D shifts
    double offsetToOrigin[] = {-originX, -originY};
    double offsetFromOrigin[] = {originX + offsetX, originY + offsetY};
    AstShiftMap* shiftMapToOrigin = astShiftMap(2, offsetToOrigin, "");
    AstShiftMap* shiftMapFromOrigin = astShiftMap(2, offsetFromOrigin, "");

    // Combined mapping
    AstCmpMap* combinedMap = astCmpMap(shiftMapToOrigin, matrixMap, 1, "");
    AstCmpMap* combinedMap2 = astCmpMap(combinedMap, shiftMapFromOrigin, 1, "");

    auto cleanUpAfterFailure = [&]() {
        if (wcsInfoTransformed) {
            astDelete(wcsInfoTransformed);
        }
        if (combinedMap2) {
            astAnnul(combinedMap2);
        }
        if (combinedMap) {
            astAnnul(combinedMap);
        }
        if (shiftMapFromOrigin) {
            astAnnul(shiftMapFromOrigin);
        }
        if (shiftMapToOrigin) {
            astAnnul(shiftMapToOrigin);
        }
        if (pixToSkyMapping) {
            astAnnul(pixToSkyMapping);
        }
        if (skyFrame) {
            astAnnul(skyFrame);
        }
        if (pixFrameCopy) {
            astAnnul(pixFrameCopy);
        }
        if (pixFrame) {
            astAnnul(pixFrame);
        }
        if (matrixMap) {
            astAnnul(matrixMap);
        }
    };

    if (!astOK || !pixFrame || !pixFrameCopy || !skyFrame || !pixToSkyMapping || !wcsInfoTransformed || !shiftMapToOrigin || !shiftMapFromOrigin || !combinedMap || !combinedMap2) {
        cout << "Creating transformed frame set failed." << endl;
        cleanUpAfterFailure();
        return clearStatusAndReturnNull();
    }

    astAddFrame(wcsInfoTransformed, 1, combinedMap2, pixFrameCopy);
    astAddFrame(wcsInfoTransformed, 2, pixToSkyMapping, skyFrame);
    astSetI(wcsInfoTransformed, "Current", 3);
    if (!astOK) {
        cout << "Creating transformed frame set failed." << endl;
        cleanUpAfterFailure();
        return clearStatusAndReturnNull();
    }
    return wcsInfoTransformed;
}

EMSCRIPTEN_KEEPALIVE AstFrameSet* createOffsetFrameset(AstFrameSet* wcsInfo, double offsetX, double offsetY, double pixelOffsetX, double pixelOffsetY, int skyRefIs)
{
    if (!wcsInfo || !astIsAFrameSet(wcsInfo)) {
        return nullptr;
    }

    AstFrameSet* wcsInfoOffset = static_cast<AstFrameSet*> astCopy(wcsInfo);
    if (!wcsInfoOffset || !astOK) {
        astClearStatus;
        return nullptr;
    }

    int currentFrame = astGetI(wcsInfoOffset, "Current");
    int baseFrame = astGetI(wcsInfoOffset, "Base");
    if (!astOK) {
        astClearStatus;
        wcsInfoOffset = static_cast<AstFrameSet*>(astAnnul(wcsInfoOffset));
        return nullptr;
    }

    // Use AST's built-in offset coordinate system which properly handles spherical geometry
    // Temporarily switch to the sky frame to ensure SkyRef attributes apply correctly.
    astSetI(wcsInfoOffset, "Current", 2);
    astSetD(wcsInfoOffset, "SkyRef(1)", offsetX);
    astSetD(wcsInfoOffset, "SkyRef(2)", offsetY);
    if (skyRefIs == 1) {
        astSet(wcsInfoOffset, "SkyRefIs=Pole");
        astSet(wcsInfoOffset, "Label(1)=Offset longitude,Label(2)=Offset colatitude");

        // Remap the sky frame so the latitude axis shows colatitude: lat' = pi/2 - lat.
        double matrixElements[] = {1.0, 0.0, 0.0, -1.0};
        double shifts[] = {0.0, 0.5 * M_PI};
        AstMatrixMap* flipLatMap = astMatrixMap(2, 2, 0, matrixElements, "");
        AstShiftMap* shiftLatMap = astShiftMap(2, shifts, "");
        AstCmpMap* colatMap = astCmpMap(flipLatMap, shiftLatMap, 1, "");
        if (!flipLatMap || !shiftLatMap || !colatMap || !astOK) {
            astClearStatus;
            if (colatMap) {
                colatMap = static_cast<AstCmpMap*>(astAnnul(colatMap));
            }
            if (shiftLatMap) {
                shiftLatMap = static_cast<AstShiftMap*>(astAnnul(shiftLatMap));
            }
            if (flipLatMap) {
                flipLatMap = static_cast<AstMatrixMap*>(astAnnul(flipLatMap));
            }
            wcsInfoOffset = static_cast<AstFrameSet*>(astAnnul(wcsInfoOffset));
            return nullptr;
        }
        astRemapFrame(wcsInfoOffset, 2, colatMap);

        colatMap = static_cast<AstCmpMap*>(astAnnul(colatMap));
        shiftLatMap = static_cast<AstShiftMap*>(astAnnul(shiftLatMap));
        flipLatMap = static_cast<AstMatrixMap*>(astAnnul(flipLatMap));
        if (!astOK) {
            astClearStatus;
            wcsInfoOffset = static_cast<AstFrameSet*>(astAnnul(wcsInfoOffset));
            return nullptr;
        }
    } else {
        astSet(wcsInfoOffset, "SkyRefIs=Origin");
        astSet(wcsInfoOffset, "Label(1)=Offset coordinate,Label(2)=Offset coordinate");
    }
    astSetI(wcsInfoOffset, "Current", currentFrame);

    // 2D pixel offset
    double pixelOffset[] = {-pixelOffsetX, -pixelOffsetY};
    AstShiftMap* pixelShiftMap = astShiftMap(2, pixelOffset, "");
    AstFrame* offsetGridFrame = astFrame(2, "Label(1)=X offset coordinate,Label(2)=Y offset coordinate,Domain=GRID");
    astAddFrame(wcsInfoOffset, AST__BASE, pixelShiftMap, offsetGridFrame);

    pixelShiftMap = static_cast<AstShiftMap*>(astAnnul(pixelShiftMap));
    offsetGridFrame = static_cast<AstFrame*>(astAnnul(offsetGridFrame));
    if (!astOK) {
        astClearStatus;
        wcsInfoOffset = static_cast<AstFrameSet*>(astAnnul(wcsInfoOffset));
        return nullptr;
    }

    // If the current frame was the base (image coordinates), switch to the newly-added offset image frame.
    if (currentFrame == baseFrame) {
        int offsetFrame = astGetI(wcsInfoOffset, "Nframe");
        astSetI(wcsInfoOffset, "Current", offsetFrame);
    }
    if (!astOK) {
        astClearStatus;
        wcsInfoOffset = static_cast<AstFrameSet*>(astAnnul(wcsInfoOffset));
        return nullptr;
    }

    return wcsInfoOffset;
}

EMSCRIPTEN_KEEPALIVE AstFrameSet* initDummyFrame()
{
    double offsets[] = {0, 0};
    AstFrameSet* frameSet = astFrameSet(astFrame(2, ""), "");
    astAddFrame(frameSet, 1, astShiftMap(2, offsets, ""), astFrame(2, "Label(1)=X coordinate,Label(2)=Y coordinate,Domain=PIXEL"));
    return frameSet;
}

EMSCRIPTEN_KEEPALIVE int plotGrid(AstFrameSet* wcsInfo, double imageX1, double imageX2, double imageY1, double imageY2, double width, double height,
                                        double paddingLeft, double paddingRight, double paddingTop, double paddingBottom, const char* args)
{
    if (!wcsInfo)
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
    plot = astPlot(wcsInfo, gbox, pbox, args);


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

EMSCRIPTEN_KEEPALIVE const char* format(AstFrameSet* wcsInfo, int axis, double value)
{
    if (!wcsInfo)
    {
        return nullptr;
    }

    const char* formattedVal = astFormat(wcsInfo, axis, value);
    if (!astOK)
    {
        astClearStatus;
        return nullptr;
    }
    return formattedVal;
}

EMSCRIPTEN_KEEPALIVE int unformat(AstFrameSet* wcsInfo, int axis, const char* formattedString, double *value)
{
    if (!wcsInfo)
    {
        return 1;
    }

    astUnformat(wcsInfo, axis, formattedString, value);
    if (!astOK)
    {
        astClearStatus;
        return 1;
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE int set(AstFrameSet* wcsInfo, const char* attrib)
{
    if (!wcsInfo)
    {
        return 1;
    }

    astSet(wcsInfo, attrib);
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

EMSCRIPTEN_KEEPALIVE void dump(AstFrameSet* wcsInfo)
{
    if (wcsInfo)
    {
        astShow(wcsInfo);
    }
}

EMSCRIPTEN_KEEPALIVE const char* getString(AstFrameSet* wcsInfo, const char* attribute)
{
    if (!wcsInfo || !astHasAttribute(wcsInfo, attribute))
    {
        return nullptr;
    }
    return astGetC(wcsInfo, attribute);
}

EMSCRIPTEN_KEEPALIVE int norm(AstFrameSet* wcsInfo, double inout[])
{
    if (!wcsInfo)
    {
        return 1;
    }
    astNorm(wcsInfo, inout);
    return 0;
}

EMSCRIPTEN_KEEPALIVE int transform(AstFrameSet* wcsInfo, int npoint, const double xin[], const double yin[], int forward, double xout[], double yout[])
{
    if (!wcsInfo)
    {
        return 1;
    }

    astTran2(wcsInfo, npoint, xin, yin, forward, xout, yout);
    if (!astOK)
    {
        astClearStatus;
        return 1;
    }
    return 0;
}

//xin and yin needs to be transformed
EMSCRIPTEN_KEEPALIVE int pointList(AstFrameSet* wcsInfo, int npoint, double xin[], double yin[], double out[])
{
    if (!wcsInfo)
    {
        cout << "Invalid wcsInfo." << endl;
        return 1;
    }

    double start[] = {xin[0], yin[0]};
    double finish[] = {xin[1], yin[1]};

    double dist = astDistance(wcsInfo, start, finish);
    double discreteDist = dist/npoint;
    double output[2];

    double* xout = new double[npoint];
    double* yout = new double[npoint];
    double* xOut = new double[npoint];
    double* yOut = new double[npoint];
    
    for(int i = 0; i < npoint; i++) {
        double distance = discreteDist * i;
        astOffset(wcsInfo, start, finish, distance, output);
        xout[i] = output[0];
        yout[i] = output[1];
    }

    astTran2(wcsInfo, npoint, xout, yout, 0, xOut, yOut);

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
EMSCRIPTEN_KEEPALIVE int axPointList(AstFrameSet* wcsInfo, int npoint, int axis, double x, double y, double dist, double out[])
{
    if (!wcsInfo)
    {
        cout << "Invalid wcsInfo." << endl;
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
            output = astAxOffset(wcsInfo, axis, x, distance);
            xout[i] = output;
            yout[i] = y;
        } else if (axis == 2) {
            output = astAxOffset(wcsInfo, axis, y, distance);
            xout[i] = x;
            yout[i] = output;
        }
    }

    astTran2(wcsInfo, npoint, xout, yout, 0, xOut, yOut);

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

EMSCRIPTEN_KEEPALIVE int transform3D(AstSpecFrame* wcsInfo, double x, double y, double z, const int forward, double* out)
{
    if (!wcsInfo)
    {
        return 1;
    }

    double in[] = {x, y, z};
    astTranN(wcsInfo, 1, 3, 1, in, forward, 3, 1, out);
    if (!astOK)
    {
        astClearStatus;
        return 1;
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE int transform3DArray(AstFrameSet* wcsInfo, int npoint, double in[], const int forward, double out[])
{
    if (!wcsInfo)
    {
        return 1;
    }

    astTranN(wcsInfo, npoint, 3, npoint, in, forward, 3, npoint, out);  
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

EMSCRIPTEN_KEEPALIVE double parseDateToMJD(const char* dateString, const char* timeScale)
{
    if (!dateString || !strlen(dateString))
    {
        return NAN;
    }

    astBegin;
    AstTimeFrame* timeFrame = astTimeFrame("System=MJD");
    if (timeScale && strlen(timeScale))
    {
        char buffer[64];
        snprintf(buffer, sizeof(buffer), "TimeScale=%s", timeScale);
        astSet(timeFrame, buffer);
    }

    double mjd = AST__BAD;
    int charsRead = astUnformat(timeFrame, 1, dateString, &mjd);
    astEnd;

    // Reject partial parses so that malformed date strings are not silently truncated
    if (!astOK || charsRead != (int) strlen(dateString) || mjd == AST__BAD)
    {
        astClearStatus;
        return NAN;
    }
    return mjd;
}

EMSCRIPTEN_KEEPALIVE double convertMJD(double mjd, const char* scaleIn, const char* scaleOut)
{
    astBegin;
    char buffer[64];
    AstTimeFrame* frameIn = astTimeFrame("System=MJD");
    if (scaleIn && strlen(scaleIn))
    {
        snprintf(buffer, sizeof(buffer), "TimeScale=%s", scaleIn);
        astSet(frameIn, buffer);
    }
    AstTimeFrame* frameOut = static_cast<AstTimeFrame*> astCopy(frameIn);
    if (scaleOut && strlen(scaleOut))
    {
        snprintf(buffer, sizeof(buffer), "TimeScale=%s", scaleOut);
        astSet(frameOut, buffer);
    }

    double result = AST__BAD;
    AstFrameSet* cvt = static_cast<AstFrameSet*> astConvert(frameIn, frameOut, "");
    if (cvt)
    {
        astTran1(cvt, 1, &mjd, 1, &result);
    }
    astEnd;

    if (!astOK || result == AST__BAD)
    {
        astClearStatus;
        return NAN;
    }
    return result;
}

EMSCRIPTEN_KEEPALIVE const char* formatMJDToDate(double mjd, const char* timeScale, int digits)
{
    static std::string formattedValue;
    formattedValue.clear();

    astBegin;
    AstTimeFrame* timeFrame = astTimeFrame("System=MJD");
    char buffer[64];
    if (timeScale && strlen(timeScale))
    {
        snprintf(buffer, sizeof(buffer), "TimeScale=%s", timeScale);
        astSet(timeFrame, buffer);
    }
    if (digits < 0)
    {
        digits = 0;
    }
    else if (digits > 9)
    {
        digits = 9;
    }
    snprintf(buffer, sizeof(buffer), "Format(1)=iso.%dT", digits);
    astSet(timeFrame, buffer);

    const char* formattedVal = astFormat(timeFrame, 1, mjd);
    const bool formatSucceeded = astOK && formattedVal;
    if (formatSucceeded)
    {
        // astFormat may return storage owned by timeFrame, which is released by astEnd.
        formattedValue = formattedVal;
    }
    astEnd;

    if (!astOK || !formatSucceeded)
    {
        astClearStatus;
        return nullptr;
    }
    return formattedValue.c_str();
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

EMSCRIPTEN_KEEPALIVE AstFrameSet* convert(AstFrameSet* from, AstFrameSet* to, const char* domainList)
{
    return static_cast<AstFrameSet*> astConvert(from, to, domainList);
}

EMSCRIPTEN_KEEPALIVE AstShiftMap* shiftMap2D(double x, double y)
{
    double coords[] = {x, y};
    return astShiftMap(2, coords, "");
}

EMSCRIPTEN_KEEPALIVE double axDistance(AstFrameSet* wcsInfo, int axis, double v1, double v2)
{
    return astAxDistance(wcsInfo, axis, v1, v2);
}

EMSCRIPTEN_KEEPALIVE double geodesicDistance(AstFrameSet* wcsInfo, double x1, double y1, double x2, double y2)
{
    const double x[] = {x1, x2};
    const double y[] = {y1, y2};
    double xtran[2];
    double ytran[2];
    astTran2(wcsInfo, 2, x, y, 1, xtran, ytran);

    double start[] = {xtran[0], ytran[0]};
    double finish[] = {xtran[1], ytran[1]};
    return astDistance(wcsInfo, start, finish) * 180.0 / M_PI * 3600.0;
}

EMSCRIPTEN_KEEPALIVE AstFrame* frame(int numAxes, const char* options)
{
    return astFrame(numAxes, options);
}

EMSCRIPTEN_KEEPALIVE void addFrame(AstFrameSet* frameSet, int index, AstMapping* map, AstFrame* frame)
{
    astAddFrame(frameSet, index, map, frame);
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
