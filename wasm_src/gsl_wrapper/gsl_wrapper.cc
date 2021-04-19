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
#include <stdlib.h>
#include <stdio.h>
#include <gsl/gsl_matrix.h>
#include <gsl/gsl_blas.h>
#include <gsl/gsl_multifit_nlinear.h>
#include <iostream>
#include <string.h>

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

struct data
{
  double *t;
  double *y;
  size_t n;
  size_t component;
  double **inputs;
  int **lockedInputs;
  gsl_matrix *parameterIndexs;
  double *orderInputs;
  int *lockedOrderInputs;
  gsl_vector *orderParameterIndexes;
};

/* model function: amp * exp( -4ln2[(t - center)/ fwhm]^2 */
double
gaussian(const double amp, const double center, const double fwhm, const double x)
{
  const double z = (x - center) / fwhm;
  return (amp * exp(-4 * log(2.0) * z * z));
}

int func_f (const gsl_vector * x, void *params, gsl_vector * f) {
    struct data *d = (struct data *) params;
    size_t i, j;
    for (i = 0; i < d->n; ++i)
    {
        double ti = d->t[i];
        double yi = d->y[i];
        double y = 0;
        for (j = 0; j <  d->component; ++j )
        {
            int *lockedInput = d->lockedInputs[j];
            double amp, center, fwhm;
            if (lockedInput[0] == 0) {
                amp = gsl_vector_get(x, gsl_matrix_get(d->parameterIndexs, j, 0));
            } else {
                amp = d->inputs[j][0];
            }

            if (lockedInput[1] == 0) {
                center = gsl_vector_get(x, gsl_matrix_get(d->parameterIndexs, j, 1));
            } else {
                center = d->inputs[j][1];
            }

            if (lockedInput[2] == 0) {
                fwhm = gsl_vector_get(x, gsl_matrix_get(d->parameterIndexs, j, 2));
            } else {
                fwhm = d->inputs[j][2];
            }
            y = y + gaussian(amp, center, fwhm, ti);
        }

        double yIntercept, slope;
        if (d->lockedOrderInputs[0] == 0) {
            yIntercept = gsl_vector_get(x, gsl_vector_get(d->orderParameterIndexes, 0));
        } else {
            yIntercept = d->orderInputs[0];
        }
        if (d->lockedOrderInputs[1] == 0) {
            slope = gsl_vector_get(x, gsl_vector_get(d->orderParameterIndexes, 1));
        } else {
            slope = d->orderInputs[1];
        }

        y = y + slope * ti + yIntercept;
        gsl_vector_set(f, i, yi - y);
    }

    return GSL_SUCCESS;
}

void
callback(const size_t iter, void *params,
         const gsl_multifit_nlinear_workspace *w)
{
  gsl_vector *f = gsl_multifit_nlinear_residual(w);
  gsl_vector *x = gsl_multifit_nlinear_position(w);
  double avratio = gsl_multifit_nlinear_avratio(w);
  double rcond;

  (void) params; /* not used */

  /* compute reciprocal condition number of J(x) */
  gsl_multifit_nlinear_rcond(&rcond, w);

//   fprintf(stderr, "iter %2zu: a = %.4f, b = %.4f, c = %.4f, |a|/|v| = %.4f cond(J) = %8.4f, |f(x)| = %.4f\n",
//           iter,
//           gsl_vector_get(x, 0),
//           gsl_vector_get(x, 1),
//           gsl_vector_get(x, 2),
//           avratio,
//           1.0 / rcond,
//           gsl_blas_dnrm2(f));
}

void
solve_system(gsl_vector *x, gsl_multifit_nlinear_fdf *fdf, gsl_multifit_nlinear_parameters *params)
{
  const gsl_multifit_nlinear_type *T = gsl_multifit_nlinear_trust;
  const size_t max_iter = 200;
  const double xtol = 1.0e-8;
  const double gtol = 1.0e-8;
  const double ftol = 1.0e-8;
  const size_t n = fdf->n;
  const size_t p = fdf->p;
  gsl_multifit_nlinear_workspace *work =
    gsl_multifit_nlinear_alloc(T, params, n, p);
  gsl_vector * f = gsl_multifit_nlinear_residual(work);
  gsl_vector * y = gsl_multifit_nlinear_position(work);
  int info;
  double chisq0, chisq, rcond;

  /* initialize solver */
  gsl_multifit_nlinear_init(x, fdf, work);

  /* store initial cost */
  gsl_blas_ddot(f, f, &chisq0);

  /* iterate until convergence */
  gsl_multifit_nlinear_driver(max_iter, xtol, gtol, ftol,
                              callback, NULL, &info, work);

  /* store final cost */
  gsl_blas_ddot(f, f, &chisq);

  /* store cond(J(x)) */
  gsl_multifit_nlinear_rcond(&rcond, work);

  gsl_vector_memcpy(x, y);

  /* print summary */
  fprintf(stderr, "NITER         = %zu\n", gsl_multifit_nlinear_niter(work));
  fprintf(stderr, "NFEV          = %zu\n", fdf->nevalf);
  fprintf(stderr, "NJEV          = %zu\n", fdf->nevaldf);
  fprintf(stderr, "NAEV          = %zu\n", fdf->nevalfvv);
  fprintf(stderr, "initial cost  = %.12e\n", chisq0);
  fprintf(stderr, "final cost    = %.12e\n", chisq);
  fprintf(stderr, "final x       = (%.12e, %.12e, %12e)\n", gsl_vector_get(x, 0), gsl_vector_get(x, 1), gsl_vector_get(x, 2));
  fprintf(stderr, "final cond(J) = %.12e\n", 1.0 / rcond);

  gsl_multifit_nlinear_free(work);
}

// return number of model parameters(unlocked input)
size_t getModelParametersIndexMatrix(int **lockedInputs, gsl_matrix *parameterIndexs, const int componentN, int *lockedOrderInputs, gsl_vector *orderParameterIndexes) {
    size_t n = 0;
    size_t i, j;

    if (lockedOrderInputs[0] == 0) {
        gsl_vector_set(orderParameterIndexes, 0, n);
        n++;
    } else {
        gsl_vector_set(orderParameterIndexes, 0, NAN);
    }

    if (lockedOrderInputs[1] == 0) {
        gsl_vector_set(orderParameterIndexes, 1, n);
        n++;
    } else {
        gsl_vector_set(orderParameterIndexes, 1, NAN);
    }

    for (i = 0; i < componentN; ++i) {
        for (j = 0; j < 3; ++j) {
            if (lockedInputs[i][j] == 0) {
                gsl_matrix_set(parameterIndexs, i, j, n);
                n++;
            } else {
                gsl_matrix_set(parameterIndexs, i, j, NAN);
            }
        }
    }
    return n;
}

int EMSCRIPTEN_KEEPALIVE fittingGaussian(
    double* xInArray, double* yInArray, const int dataN,
    double **inputs, int **lockedInputs, const int componentN,
    double* orderInputs, int* lockedOrderInputs,
    double* ampOut, double* centerOut, double* fwhmOut, double* orderInputsOut,
    char* logOut) {
    int status = 0; /* return value: 0 = success */

    fprintf(stderr, "input yIntercept    = %f\n", orderInputs[0]);
    fprintf(stderr, "input slope         = %f\n", orderInputs[1]);
    fprintf(stderr, "locked yIntercept    = %d\n", lockedOrderInputs[0]);
    fprintf(stderr, "locked slope         = %d\n", lockedOrderInputs[1]);

    gsl_matrix *parameterIndexs = gsl_matrix_alloc(componentN, 3); // the matrix to store the indexes of unlocked inputs in vector of model parameters
    gsl_vector *orderParameterIndexes = gsl_vector_alloc(2);

    const size_t n = dataN;  /* number of data points to fit */
    const size_t p = getModelParametersIndexMatrix(lockedInputs, parameterIndexs, componentN, lockedOrderInputs, orderParameterIndexes);  /* number of model parameters */

    fprintf(stderr, "testp         = %zu\n", p);
    fprintf(stderr, "testn         n= %zu\n", n);

    gsl_vector *f = gsl_vector_alloc(n); // vector of data points
    gsl_vector *x = gsl_vector_alloc(p); // vector of model parameters(unlocked input)
    gsl_multifit_nlinear_fdf fdf;
    gsl_multifit_nlinear_parameters fdf_params = gsl_multifit_nlinear_default_parameters();
    struct data fit_data;
    size_t i, j, parameterIndex;

    fprintf(stderr, "orderParameterIndexes:\n");
    for (i = 0; i < 2; i++) {
        fprintf(stderr, "   %f\n", gsl_vector_get(orderParameterIndexes, i));
    }
    fprintf(stderr, "parameterIndexs:\n");
    for (i = 0; i < componentN; i++) {
        fprintf(stderr, "   %f\n", gsl_matrix_get(parameterIndexs, i, 0));
        fprintf(stderr, "   %f\n", gsl_matrix_get(parameterIndexs, i, 1));
        fprintf(stderr, "   %f\n", gsl_matrix_get(parameterIndexs, i, 2));
    }

    fit_data.t = xInArray;
    fit_data.y = yInArray;
    fit_data.n = n;
    fit_data.component = componentN;
    fit_data.inputs = inputs;
    fit_data.lockedInputs = lockedInputs;
    fit_data.parameterIndexs = parameterIndexs;
    fit_data.orderInputs = orderInputs;
    fit_data.lockedOrderInputs = lockedOrderInputs;
    fit_data.orderParameterIndexes = orderParameterIndexes;

    /* define function to be minimized */
    fdf.f = func_f;
    fdf.df = NULL;
    fdf.fvv = NULL;
    fdf.n = n;
    fdf.p = p;
    fdf.params = &fit_data;
    /* starting point */
    parameterIndex = 0;
    if (lockedOrderInputs[0] == 0) {
        gsl_vector_set(x, parameterIndex, orderInputs[0]);
        parameterIndex++;
    }
    if (lockedOrderInputs[1] == 0) {
        gsl_vector_set(x, parameterIndex, orderInputs[1]);
        parameterIndex++;
    }

    for (i = 0; i < componentN; ++i)
    {
        for (j = 0; j < 3; ++j)
        {
            if (lockedInputs[i][j] == 0) {
                gsl_vector_set(x, parameterIndex, inputs[i][j]);
                parameterIndex++;
            }
        }
    }

    fprintf(stderr, "vector x:");
    for (i = 0; i < p; i++) {
        fprintf(stderr, "%f\n", gsl_vector_get(x, i));
    }

    fdf_params.trs = gsl_multifit_nlinear_trs_lm;
    solve_system(x, &fdf, &fdf_params);

    if (lockedOrderInputs[0] == 0) {
        orderInputsOut[0] = gsl_vector_get(x, gsl_vector_get(orderParameterIndexes, 0));
    } else {
        orderInputsOut[0] = orderInputs[0];
    }

    if (lockedOrderInputs[1] == 0) {
        orderInputsOut[1] = gsl_vector_get(x, gsl_vector_get(orderParameterIndexes, 1));
    } else {
        orderInputsOut[1] = orderInputs[1];
    }

    // /* print data and model */
    for (i = 0; i < componentN; ++i)
    {
        if (lockedInputs[i][0] == 0) {
            ampOut[i] = gsl_vector_get(x, gsl_matrix_get(parameterIndexs, i, 0));
        } else {
            ampOut[i] = inputs[i][0];
        }

        if (lockedInputs[i][1] == 0) {
            centerOut[i] = gsl_vector_get(x, gsl_matrix_get(parameterIndexs, i, 1));
        } else {
            centerOut[i] = inputs[i][1];
        }

        if (lockedInputs[i][2] == 0) {
            fwhmOut[i] = gsl_vector_get(x, gsl_matrix_get(parameterIndexs, i, 2));
        } else {
            fwhmOut[i] = inputs[i][2];
        }
    }

    // snprintf(logOut, sizeof(logOut), "Test=%.3e\n", test);
    
    gsl_vector_free(f);
    gsl_vector_free(x);
    gsl_matrix_free(parameterIndexs);

    return 0;
}

}