#include <emscripten.h>
#include "gsl/gsl_math.h"
#include "gsl/gsl_filter.h"
#include "gsl/gsl_vector.h"
#include "gsl/gsl_sf_trig.h"
#include "gsl/gsl_statistics.h"

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

int EMSCRIPTEN_KEEPALIVE filterDecimation(double* xInArray, const int N, double* xOutArray, const int outN, const int decimationValue) {
    int status = 0;    /* return value: 0 = success */
    // gsl_vector_view xIn = gsl_vector_view_array(xInArray, N);
    // gsl_vector_view xOut = gsl_vector_view_array(xOutArray, outN);
    size_t i;

    for (i = 0 ; i < N/decimationValue; i++) {
        xOutArray[i] = xInArray[i*decimationValue + 1];
    }
    // gsl_movstat_workspace* w = gsl_movstat_alloc(K);
    // gsl_movstat_function F;

    // F.function = hanningWindow;
    // gsl_movstat_apply(GSL_MOVSTAT_END_PADVALUE, &F, &xIn.vector, &xOut.vector, w);

    // gsl_movstat_free(w);

    return status;
}

}