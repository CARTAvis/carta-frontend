#include <emscripten.h>
#include "gsl/gsl_math.h"
#include "gsl/gsl_filter.h"
#include "gsl/gsl_vector.h"
#include "gsl/gsl_sf_trig.h"
#include "gsl/gsl_statistics.h"
#include "gsl/gsl_statistics_double.h"
#include "gsl/gsl_sort_int.h"
#include <math.h>
#include "gsl/gsl_fit.h"
#include "gsl/gsl_multifit.h"

extern "C" {

int EMSCRIPTEN_KEEPALIVE filterBoxcar(double* yInArray, const int N, double* yOutArray, const int kernel) {
    int status = 0;    /* return value: 0 = success */
    gsl_vector_view yIn = gsl_vector_view_array(yInArray, N);
    double* window = new double[kernel];
    size_t H, J;
    if (kernel % 2 == 0) {
        H = kernel / 2 - 1;
        J = kernel - H - 1;
    } else {
        H = (kernel - 1) / 2;
        J = (kernel - 1) / 2;
    }

    for (size_t i = 0; i < N; ++i) {
        // set edge values NaN
        if (i < H || i > N - 1 - J) {
            yOutArray[i] = NAN;
            continue;
        }
        size_t wsize = gsl_movstat_fill(GSL_MOVSTAT_END_PADZERO, &yIn.vector, i, H, J, window);
        yOutArray[i] = gsl_stats_mean(window, 1, wsize);
    }


    delete[] window;

    return status;
}

int EMSCRIPTEN_KEEPALIVE filterGaussian(double* yInArray, const int N, double* yOutArray, const int kernel, const double alpha) {
    int status = 0;    /* return value: 0 = success */
    gsl_vector_view yIn = gsl_vector_view_array(yInArray, N);
    gsl_vector_view yOut = gsl_vector_view_array(yOutArray, N);
    gsl_filter_gaussian_workspace* w = gsl_filter_gaussian_alloc(kernel);

    gsl_filter_gaussian(GSL_FILTER_END_PADZERO, alpha, 0, &yIn.vector, &yOut.vector, w);

    // set edge values NaN
    for (size_t i = 0; i < (kernel - 1) / 2; i++) {
        yOutArray[i] = NAN;
        yOutArray[N - 1 - i] = NAN;
    }

    gsl_filter_gaussian_free(w);

    return status;
}

double hanningWindow(const size_t n, double window[], void* params) {
    double val = 0;
    double sum = 0;

    for (size_t i = 0; i < n; i++) {
        double hanningVal = (0.5 * (1 - gsl_sf_cos(2 * M_PI * (i + 1) / (n + 1))));
        val += hanningVal * window[i];
        sum += hanningVal;
    }

    return val / sum;
}

int EMSCRIPTEN_KEEPALIVE filterHanning(double* yInArray, const int N, double* yOutArray, const int kernel) {
    int status = 0;    /* return value: 0 = success */
    gsl_vector_view yIn = gsl_vector_view_array(yInArray, N);
    gsl_vector_view yOut = gsl_vector_view_array(yOutArray, N);
    gsl_movstat_workspace* w = gsl_movstat_alloc(kernel);
    gsl_movstat_function F;

    F.function = hanningWindow;
    gsl_movstat_apply(GSL_MOVSTAT_END_PADZERO, &F, &yIn.vector, &yOut.vector, w);

    // set edge values NaN
    for (size_t i = 0; i < (kernel - 1) / 2; i++) {
        yOutArray[i] = NAN;
        yOutArray[N - 1 - i] = NAN;
    }


    gsl_movstat_free(w);

    return status;
}

int EMSCRIPTEN_KEEPALIVE filterDecimation(double* xInArray, double* yInArray, const int inN, double* xOutArray, double* yOutArray, const int outN, const int decimationWidth) {
    int status = 0;    /* return value: 0 = success */
    int* indexArray = new int[outN];
    int remainder = inN % decimationWidth;

    for (size_t i = 0; i <= inN / decimationWidth; i++) {

        if (i == inN / decimationWidth && (remainder == 0 || remainder == 1)) {
            // remainder = 0, the last data of yIn has already been handled when i = inN / decimationWidth - 1
            // remainder = 1, only 1 data remains, so there is no need to perform min/max search
            if (remainder == 1) {
                indexArray[outN - 1] = inN - 1;
            }
            break;
        }

        int localWidth = decimationWidth;
        if (i == inN / decimationWidth && remainder > 1) {
            localWidth = remainder;
        }

        size_t minIndex, maxIndex;
        gsl_stats_minmax_index(&maxIndex, &minIndex, &yInArray[i * decimationWidth], 1, localWidth);

        indexArray[i*2] = i * decimationWidth + minIndex;
        indexArray[i*2 + 1] = i * decimationWidth + maxIndex;
        if (minIndex == maxIndex) {
            indexArray[i*2 + 1] = i * decimationWidth + (localWidth - 1);
        }
    }

    gsl_sort_int(indexArray, 1, outN);

    for (size_t i = 0; i < outN; i++) {
        xOutArray[i] = xInArray[indexArray[i]];
        yOutArray[i] = yInArray[indexArray[i]];
    }

    delete[] indexArray;

    return status;
}

int EMSCRIPTEN_KEEPALIVE filterBinning(double* inputArray, const int N, double* outputArray, const int binWidth) {
    int status = 0;    /* return value: 0 = success */

    for (size_t i = 0; i < N / binWidth; i++) {
        outputArray[i] = gsl_stats_mean(&inputArray[i * binWidth], 1, binWidth);
    }

    if (N % binWidth != 0) {
        size_t lastBin = floor(N / binWidth);
        outputArray[lastBin] = gsl_stats_mean(&inputArray[lastBin * binWidth], 1, N % binWidth);
    }

    return status;
}

int EMSCRIPTEN_KEEPALIVE filterSavitzkyGolay(double* xInArray, double* yInArray, const int N, double* yOutArray, const int kernel, const int order) {
    int status = 0;    /* return value: 0 = success */

    gsl_vector_view yIn = gsl_vector_view_array(yInArray, N);
    double* window = new double[kernel];
    size_t H;
    if (kernel % 2 == 0) {
        H = kernel / 2;
    } else {
        H = (kernel - 1) / 2;
    }

    size_t cNum = order + 1;

    for (size_t i = 0; i < N; ++i) {
        size_t wsize = gsl_movstat_fill(GSL_MOVSTAT_END_PADZERO, &yIn.vector, i, H, H, window);
        
        // set edge values NaN
        if (i < H || i > N - 1 - H) {
            yOutArray[i] = NAN;
            continue;
        }

        if (order != 1 ) {
            double chisq;
            gsl_matrix *X, *cov;
            gsl_vector_view y;
            gsl_vector *w, *c;

            X = gsl_matrix_alloc (wsize, cNum);
            y = gsl_vector_view_array(window, wsize);
            w = gsl_vector_alloc (wsize);
            c = gsl_vector_alloc (cNum);
            cov = gsl_matrix_alloc (cNum, cNum);

            for (size_t j = 0; j < wsize; j++) {
                for (size_t k = 0; k<cNum; k++) {
                    const double val = xInArray[(i - H) + j];
                    gsl_matrix_set (X, j, k, pow(val,k));
                }
                gsl_vector_set(w, j, 0.2);
            }

            gsl_multifit_linear_workspace * work = gsl_multifit_linear_alloc (wsize, cNum);
            gsl_multifit_wlinear (X, w, &y.vector, c, cov, &chisq, work);

            double sum = 0;
            for (size_t t = 0; t < cNum ; t++) {
                const double val = gsl_vector_get(c,t) * pow(xInArray[i], t);
                sum = sum + val;
            }
            yOutArray[i] = sum;

            gsl_multifit_linear_free (work);

            gsl_matrix_free (X);
            gsl_vector_free (w);
            gsl_vector_free (c);
            gsl_matrix_free (cov);
        } else {
            double c0, c1, cov00, cov01, cov11, chisq;
            double* x = new double[wsize];
            double* w = new double[wsize];;
            for (size_t s = 0; s < wsize; s++) {
                x[s] = xInArray[(i - H) + s];
                w[s] = 0.2;
            }

            gsl_fit_wlinear (x, 1, w, 1, window, 1, wsize, &c0, &c1, &cov00, &cov01, &cov11, &chisq);
            yOutArray[i] = c0 + c1 * xInArray[i]; // best fit Y = c0 + c1 * X;

            delete[] x;
            delete[] w;
        }
    }
    delete[] window;

    return status;
}

}