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

int EMSCRIPTEN_KEEPALIVE filterBoxcar(double* xInArray, const int N, double* xOutArray, const int K) {
    int status = 0;    /* return value: 0 = success */
    gsl_vector_view xIn = gsl_vector_view_array(xInArray, N);
    double* window = new double[K];
    size_t H;
    size_t J;
    if (K % 2 == 0) {
        H = K / 2 - 1;
        J = K - H - 1;
    } else {
        H = (K - 1) / 2;
        J = (K - 1) / 2;
    }

    for (size_t i = 0; i < N; ++i) {
        size_t wsize = gsl_movstat_fill(GSL_MOVSTAT_END_PADVALUE, &xIn.vector, i, H, J, window);
        xOutArray[i] = gsl_stats_mean(window, 1, wsize);
    }

    delete[] window;

    return status;
}

int EMSCRIPTEN_KEEPALIVE filterGaussian(double* xInArray, const int N, double* xOutArray, const int K, const double alpha) {
    int status = 0;    /* return value: 0 = success */
    gsl_vector_view xIn = gsl_vector_view_array(xInArray, N);
    gsl_vector_view xOut = gsl_vector_view_array(xOutArray, N);
    gsl_filter_gaussian_workspace* w = gsl_filter_gaussian_alloc(K);

    gsl_filter_gaussian(GSL_FILTER_END_PADVALUE, alpha, 0, &xIn.vector, &xOut.vector, w);

    gsl_filter_gaussian_free(w);

    return status;
}

double hanningWindow(const size_t n, double x[], void* params) {
    double val = 0;
    double sum = 0;

    for (size_t i = 0; i < n; i++) {
        double hanningVal = (0.5 * (1 - gsl_sf_cos(2 * M_PI * (i + 1) / (n + 1))));
        val += hanningVal * x[i];
        sum += hanningVal;
    }

    return val / sum;
}

int EMSCRIPTEN_KEEPALIVE filterHanning(double* xInArray, const int N, double* xOutArray, const int K) {
    int status = 0;    /* return value: 0 = success */
    gsl_vector_view xIn = gsl_vector_view_array(xInArray, N);
    gsl_vector_view xOut = gsl_vector_view_array(xOutArray, N);
    gsl_movstat_workspace* w = gsl_movstat_alloc(K);
    gsl_movstat_function F;

    F.function = hanningWindow;
    gsl_movstat_apply(GSL_MOVSTAT_END_PADVALUE, &F, &xIn.vector, &xOut.vector, w);

    gsl_movstat_free(w);

    return status;
}

int EMSCRIPTEN_KEEPALIVE filterDecimation(double* xInArray, const int inN, int* xOutArray, const int outN, const int D) {
    int status = 0;    /* return value: 0 = success */
    size_t i;

    for (size_t i = 0; i < inN / D; i++) {
        size_t* maxIndex = new size_t[1];
        size_t* minIndex = new size_t[1];
        gsl_stats_minmax_index(maxIndex, minIndex, &xInArray[i * D], 1, D);

        xOutArray[i*2] = i * D + minIndex[0];
        xOutArray[i*2 + 1] = i * D + maxIndex[0];
    }

    if (inN % D != 0) {
        size_t lastDecimation = floor(inN / D);
        size_t* maxIndex = new size_t[1];
        size_t* minIndex = new size_t[1];
        gsl_stats_minmax_index(maxIndex, minIndex, &xInArray[lastDecimation * D], 1, inN % D);
        xOutArray[lastDecimation*2] = lastDecimation * D + minIndex[0];
        xOutArray[lastDecimation*2 + 1] = lastDecimation * D + maxIndex[0];
    }

    gsl_sort_int(xOutArray, 1, outN);

    return status;
}

int EMSCRIPTEN_KEEPALIVE filterBinning(double* xInArray, const int inN, double* xOutArray, const int binWidth) {
    int status = 0;    /* return value: 0 = success */
    size_t i;

    for (size_t i = 0; i < inN / binWidth; i++) {
        xOutArray[i] = gsl_stats_mean(&xInArray[i * binWidth], 1, binWidth);
    }

    if (inN % binWidth != 0) {
        size_t lastBin = floor(inN / binWidth);
        xOutArray[lastBin] = gsl_stats_mean(&xInArray[lastBin * binWidth], 1, inN % binWidth);
    }

    return status;
}

int EMSCRIPTEN_KEEPALIVE filterSavitzkyGolay(double* xInArray, double* yInArray, const int N, double* yOutArray, const int K, const int order) {
    int status = 0;    /* return value: 0 = success */

    gsl_vector_view xIn = gsl_vector_view_array(yInArray, N);
    double* window = new double[K];
    size_t H;
    if (K % 2 == 0) {
        H = K / 2;
    } else {
        H = (K - 1) / 2;
    }

    size_t cNum = order + 1;

    for (size_t i = 0; i < N; ++i) {
        size_t wsize = gsl_movstat_fill(GSL_MOVSTAT_END_PADVALUE, &xIn.vector, i, H, H, window);

        if ( i < H || i > N - 1 - H) {
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
            const int n = wsize;
            double c0, c1, cov00, cov01, cov11, chisq;
            double *x = (double *) malloc(n * sizeof(double));
            double *w = (double *) malloc(n * sizeof(double));
            for (size_t s = 0; s < wsize; s++) {
                x[s] = xInArray[(i - H) + s];
                w[s] = 0.2;
            }

            gsl_fit_wlinear (x, 1, w, 1, window, 1, n, &c0, &c1, &cov00, &cov01, &cov11, &chisq);
            // best fit Y = c0 + c1 * X;
            yOutArray[i] = c0 + c1 * xInArray[i];
            free(x);
            free(w);
        }
    }
    delete[] window;

    return status;
}

}