#include <emscripten.h>
#include "gsl/gsl_math.h"
#include "gsl/gsl_filter.h"
#include "gsl/gsl_vector.h"
#include "gsl/gsl_sf_trig.h"
#include "gsl/gsl_statistics.h"

int EMSCRIPTEN_KEEPALIVE filterGaussian(double* xInArray, const int N, double* xOutArray, const int K, const double alpha) {
    int status = 0;    /* return value: 0 = success */
    gsl_vector_view xIn = gsl_vector_view_array(xInArray, N);
    gsl_vector_view xOut = gsl_vector_view_array(xOutArray, N);
    gsl_vector *k = gsl_vector_alloc(K);
    gsl_filter_gaussian_workspace *w = gsl_filter_gaussian_alloc(K);

    gsl_filter_gaussian(GSL_FILTER_END_PADVALUE, alpha, 0, &xIn.vector, &xOut.vector, w);

    gsl_vector_free(k);
    gsl_filter_gaussian_free(w);

    return status;
}

double
hanningWindow(const size_t n, double x[], void * params)
{
    size_t i;
    double val = 0;
    double sum = 0;

    for ( i=0; i<n; i++) {
        double hanningVal = (0.5 * (1-gsl_sf_cos( 2 * M_PI * (i+1) / (n+1))));
        val += hanningVal * x[i];
        sum += hanningVal;
    }

    return val/sum;
}

int EMSCRIPTEN_KEEPALIVE filterHanning(double* xInArray, const int N, double* xOutArray, const int K) {
    int status = 0;    /* return value: 0 = success */
    gsl_vector_view xIn = gsl_vector_view_array(xInArray, N);
    gsl_vector_view xOut = gsl_vector_view_array(xOutArray, N);
    gsl_movstat_workspace *w = gsl_movstat_alloc(K);
    gsl_movstat_function F;

    F.function = hanningWindow;
    gsl_movstat_apply(GSL_MOVSTAT_END_PADVALUE, &F, &xIn.vector, &xOut.vector, w);

    gsl_movstat_free(w);

    return status;
}

/* compute filtered data by explicitely constructing window, sorting it and finding median */
int EMSCRIPTEN_KEEPALIVE filterBoxcar(double* xInArray, const int N, double* xOutArray, const int K) {
    int status = 0;    /* return value: 0 = success */
    gsl_vector_view xIn = gsl_vector_view_array(xInArray, N);
    double *window = malloc(K * sizeof(double));
    size_t H;
    size_t J = K/2;
    if (K%2 == 0){
        H = K/2 - 1;
    } else {
        H = K/2;
    }

    size_t i;
    for (i = 0; i < N; ++i) {
        size_t wsize = gsl_movstat_fill(GSL_MOVSTAT_END_PADVALUE, &xIn.vector, i, H, J, window);
        xOutArray[i] = gsl_stats_median(window, 1, wsize);
    }

    free(window);

    return status;
}