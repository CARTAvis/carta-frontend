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
};

/* model function: a * exp( -1/2 * [ (t - b) / c ]^2 ) */
double
gaussian(const double a, const double b, const double c, const double x)
{
  const double z = (x - b) / c;
  return (a * exp(-0.5 * z * z));
}

int func_f (const gsl_vector * x, void *params, gsl_vector * f) {
    struct data *d = (struct data *) params;
    double a = gsl_vector_get(x, 0);
    double b = gsl_vector_get(x, 1);
    double c = gsl_vector_get(x, 2);
    size_t i;

    for (i = 0; i < d->n; ++i)
        {
        double ti = d->t[i];
        double yi = d->y[i];
        double y = gaussian(a, b, c, ti);

        gsl_vector_set(f, i, yi - y);
        }

    return GSL_SUCCESS;
}

int func_df (const gsl_vector * x, void *params, gsl_matrix * J) {
  struct data *d = (struct data *) params;
  double a = gsl_vector_get(x, 0);
  double b = gsl_vector_get(x, 1);
  double c = gsl_vector_get(x, 2);
  size_t i;

  for (i = 0; i < d->n; ++i)
    {
      double ti = d->t[i];
      double zi = (ti - b) / c;
      double ei = exp(-0.5 * zi * zi);

      gsl_matrix_set(J, i, 0, -ei);
      gsl_matrix_set(J, i, 1, -(a / c) * ei * zi);
      gsl_matrix_set(J, i, 2, -(a / c) * ei * zi * zi);
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


int EMSCRIPTEN_KEEPALIVE fittingGaussian(double* xInArray, double* yInArray, const int N, double* center, double* amp, double* fwhm, double* centerOut, double* ampOut, double* fwhmOut, const int N2, char* logOut ) {
    int status = 0; /* return value: 0 = success */

    const size_t n = N;  /* number of data points to fit */
    const size_t p = 3;    /* number of model parameters */
    const double a = amp[0];  /* amplitude */
    const double b = center[0];  /* center */
    const double xx = log(2.0);
    const double c = fwhm[0] / pow( 8 * log(2.0), 0.5); /* width = fwhm / (8ln2)^0.5 */

    gsl_vector *f = gsl_vector_alloc(n);
    gsl_vector *x = gsl_vector_alloc(p);
    gsl_multifit_nlinear_fdf fdf;
    gsl_multifit_nlinear_parameters fdf_params = gsl_multifit_nlinear_default_parameters();
    struct data fit_data;
    size_t i;

    fit_data.t = xInArray;
    fit_data.y = yInArray;
    fit_data.n = n;

    /* define function to be minimized */
    fdf.f = func_f;
    fdf.df = func_df;
    fdf.fvv = NULL;
    fdf.n = n;
    fdf.p = p;
    fdf.params = &fit_data;

    /* starting point */
    gsl_vector_set(x, 0, a);
    gsl_vector_set(x, 1, b);
    gsl_vector_set(x, 2, c);

    fdf_params.trs = gsl_multifit_nlinear_trs_lm;
    solve_system(x, &fdf, &fdf_params);

    /* print data and model */
    double A = gsl_vector_get(x, 0);
    double B = gsl_vector_get(x, 1);
    double C = gsl_vector_get(x, 2);

    centerOut[0] = B;
    ampOut[0] = A;
    fwhmOut[0] = C * pow( 8 * log(2.0), 0.5);

    // snprintf(logOut, sizeof(logOut), "Test=%.3e\n", test);
    
    gsl_vector_free(f);
    gsl_vector_free(x);

    return 0;
}

}