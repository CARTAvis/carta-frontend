#include <emscripten.h>
#include "gsl/gsl_math.h"
#include "gsl/gsl_filter.h"
#include "gsl/gsl_vector.h"
#include "gsl/gsl_sf_trig.h"
#include "gsl/gsl_statistics.h"

// int EMSCRIPTEN_KEEPALIVE filterBoxcar(double* xInArray, const int N, double* xOutArray, const int K) {
//     int status = 0;    /* return value: 0 = success */
//     gsl_vector *xIn = gsl_vector_alloc(N);
//     gsl_vector *xOut = gsl_vector_alloc(N);
//     gsl_movstat_workspace *w;
//     if ( K%2 == 0) {
//         w = gsl_movstat_alloc2(K/2 - 1, K/2);
//     } else {
//         w = gsl_movstat_alloc(K);
//     }
//     size_t i;

//     for (i = 0; i < N; i++) {
//         gsl_vector_set(xIn, i, xInArray[i]);
//     }

//     gsl_movstat_mean(GSL_MOVSTAT_END_PADVALUE, xIn, xOut, w);

//     for (i = 0; i < N; i++) {
//         xOutArray[i] = gsl_vector_get(xOut, i);
//     }

//     gsl_vector_free(xIn);
//     gsl_vector_free(xOut);
//     gsl_movstat_free(w);


//     return status;
// }

int EMSCRIPTEN_KEEPALIVE filterGaussian(double* xInArray, const int N, double* xOutArray, const int K, const double alpha) {
    int status = 0;    /* return value: 0 = success */
    gsl_vector *xIn = gsl_vector_alloc(N);
    gsl_vector *xOut = gsl_vector_alloc(N);
    gsl_vector *k = gsl_vector_alloc(K);
    gsl_filter_gaussian_workspace *w = gsl_filter_gaussian_alloc(K);//
    size_t i;

    for (i = 0; i < N; i++) {
        gsl_vector_set(xIn, i, xInArray[i]);
    }
    
    gsl_filter_gaussian(GSL_FILTER_END_PADVALUE, alpha, 0, xIn, xOut, w);

    for (i = 0; i < N; i++) {
        xOutArray[i] = gsl_vector_get(xOut, i);
    }

    gsl_vector_free(xIn);
    gsl_vector_free(xOut);
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
    gsl_vector *xIn = gsl_vector_alloc(N);
    gsl_vector *xOut = gsl_vector_alloc(N);
    gsl_movstat_workspace *w = gsl_movstat_alloc(K);
    gsl_movstat_function F;
    size_t i;

    for (i = 0; i < N; i++) {
        gsl_vector_set(xIn, i, xInArray[i]);
    }

    F.function = hanningWindow;
    gsl_movstat_apply(GSL_MOVSTAT_END_PADVALUE, &F, xIn, xOut, w);

    for (i = 0; i < N; i++) {
        xOutArray[i] = gsl_vector_get(xOut, i);
    }

    gsl_vector_free(xIn);
    gsl_vector_free(xOut);
    gsl_movstat_free(w);

    return status;
}

// double
// boxcarWindow(const size_t n, double x[], void * params)
// {
//     size_t i;
//     double val = 0;

//     for ( i=0; i<n; i++) {
//         val += x[i];
//     }

//     return val/n;
// }

// int EMSCRIPTEN_KEEPALIVE filterBoxcar(double* xInArray, const int N, double* xOutArray, const int K) {
//     int status = 0;    /* return value: 0 = success */
//     gsl_vector *xIn = gsl_vector_alloc(N);
//     gsl_vector *xOut = gsl_vector_alloc(N);
//     gsl_movstat_workspace *w = gsl_movstat_alloc(K);
//     gsl_movstat_function F;
//     size_t i;

//     for (i = 0; i < N; i++) {
//         gsl_vector_set(xIn, i, xInArray[i]);
//     }

//     F.function = boxcarWindow;
//     gsl_movstat_apply(GSL_MOVSTAT_END_PADVALUE, &F, xIn, xOut, w);

//     for (i = 0; i < N; i++) {
//         xOutArray[i] = gsl_vector_get(xOut, i);
//     }

//     gsl_vector_free(xIn);
//     gsl_vector_free(xOut);
//     gsl_movstat_free(w);

//     return status;
// }


/* compute filtered data by explicitely constructing window, sorting it and finding median */
int EMSCRIPTEN_KEEPALIVE filterBoxcar(double* xInArray, const int N, double* xOutArray, const int K)
{
    size_t H;
    size_t J;
    if(K%2 == 0){
        H = K/2 - 1;
        J = K/2;
    } else {
        H = K/2;
        J = K/2;
    }
    //   const size_t n = x->size;
    double *window = malloc(K * sizeof(double));
    size_t i;

    gsl_vector * xIn = gsl_vector_alloc(N);
    gsl_vector * xOut = gsl_vector_alloc(N);

    for (i = 0; i < N; i++) {
        gsl_vector_set(xIn, i, xInArray[i]);
    }

    for (i = 0; i < N; ++i) {
        size_t wsize = gsl_movstat_fill(GSL_MOVSTAT_END_PADVALUE, xIn, i, H, J, window);
        double yi = gsl_stats_median(window, 1, wsize);

        gsl_vector_set(xOut, i, yi);
    }


    for (i = 0; i < N; i++) {
        xOutArray[i] = gsl_vector_get(xOut, i);
    }

    gsl_vector_free(xIn);
    gsl_vector_free(xOut);
    free(window);

    return GSL_SUCCESS;
}