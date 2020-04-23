#include <emscripten.h>
#include "gsl/gsl_math.h"
#include "gsl/gsl_filter.h"
#include "gsl/gsl_vector.h"
#include "gsl/gsl_cblas.h"

int EMSCRIPTEN_KEEPALIVE filterGaussian(double* xInArray, const int N, double* xOutArray, const int K) {
    int status = 0;    /* return value: 0 = success */
    const double alpha = 1;//
    gsl_vector *xIn = gsl_vector_alloc(N);
    gsl_vector *xOut = gsl_vector_alloc(N);
    gsl_vector *k = gsl_vector_alloc(K);
    gsl_filter_gaussian_workspace *gauss_p = gsl_filter_gaussian_alloc(K);//
    size_t i;
    size_t j;

    for (i = 0; i < N; i++) {
        gsl_vector_set(xIn, i, xInArray[i]);
    }
    
    gsl_filter_gaussian(GSL_FILTER_END_PADVALUE, alpha, 0, xIn, xOut, gauss_p);

    for (j = 0; j < N; j++) {
        xOutArray[j] = gsl_vector_get(xOut, j);
    }

    gsl_vector_free(xIn);
    gsl_vector_free(xOut);
    gsl_vector_free(k);
    gsl_filter_gaussian_free(gauss_p);


    return status;
}
