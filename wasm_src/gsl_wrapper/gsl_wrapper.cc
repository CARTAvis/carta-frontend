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

struct fitData
{
  double *t;
  double *y;
  size_t n;
  size_t component;
  int function;
  double **inputs;
  double *orderInputs;
  int **lockedInputs;
  int *lockedOrderInputs;
  gsl_matrix *parameterIndexes;
  gsl_vector *orderParameterIndexes;
};

char logBuffer[4096];

/* y = amp * exp( -4ln2[(x - center)/ fwhm]^2 */
double gaussian(const double amp, const double center, const double fwhm, const double x)
{
  return (amp * exp(-4 * log(2.0) * pow((x - center) / fwhm, 2)));
}

/* y = amp * (0.5fwhm)^2 / [(x - center)^2 + (0.5fwhm)^2] */
double lorentzian(const double amp, const double center, const double fwhm, const double x)
{
  return (amp * 0.25 * pow(fwhm, 2) / (pow(x - center, 2) + 0.25 * pow(fwhm, 2)));
}

int func_f (const gsl_vector * x, void *params, gsl_vector * f) {
    struct fitData *d = (struct fitData *) params;

    for (size_t i = 0; i < d->n; ++i)
    {
        double ti = d->t[i];
        double yi = d->y[i];
        double y = 0;
        for (size_t j = 0; j <  d->component; ++j )
        {
            int *lockedInput = d->lockedInputs[j];
            double amp, center, fwhm;
            if (lockedInput[0] == 0) {
                amp = gsl_vector_get(x, gsl_matrix_get(d->parameterIndexes, j, 0));
            } else {
                amp = d->inputs[j][0];
            }

            if (lockedInput[1] == 0) {
                center = gsl_vector_get(x, gsl_matrix_get(d->parameterIndexes, j, 1));
            } else {
                center = d->inputs[j][1];
            }

            if (lockedInput[2] == 0) {
                fwhm = gsl_vector_get(x, gsl_matrix_get(d->parameterIndexes, j, 2));
            } else {
                fwhm = d->inputs[j][2];
            }

            if (d->function == 0) {
                y = y + gaussian(amp, center, fwhm, ti);
            } else if (d->function == 1) {
                y = y + lorentzian(amp, center, fwhm, ti);
            }
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
solve_system(gsl_vector *x, gsl_multifit_nlinear_fdf *fdf, gsl_multifit_nlinear_parameters *params, gsl_matrix *covar, gsl_vector *residual)
{
  const gsl_multifit_nlinear_type *T = gsl_multifit_nlinear_trust;
  const size_t max_iter = 200;
  const double xtol = 1.0e-8;
  const double gtol = 1.0e-8;
  const double ftol = 1.0e-8;
  const size_t n = fdf->n;
  const size_t p = fdf->p;
  gsl_multifit_nlinear_workspace *work = gsl_multifit_nlinear_alloc(T, params, n, p);
  gsl_vector * f = gsl_multifit_nlinear_residual(work);
  gsl_vector * y = gsl_multifit_nlinear_position(work);
  int info;
  double chisq0, chisq, rcond;

  /* initialize solver */
  gsl_multifit_nlinear_init(x, fdf, work);

  /* store initial cost */
  gsl_blas_ddot(f, f, &chisq0);

  /* iterate until convergence */
  gsl_multifit_nlinear_driver(max_iter, xtol, gtol, ftol, NULL, NULL, &info, work);

  /* compute covariance of best fit parameters */
  gsl_matrix *J = gsl_multifit_nlinear_jac(work);
  gsl_multifit_nlinear_covar (J, 0.0, covar);

  /* store final cost */
  gsl_blas_ddot(f, f, &chisq);

  /* store cond(J(x)) */
  gsl_multifit_nlinear_rcond(&rcond, work);

  gsl_vector_memcpy(x, y);
  gsl_vector_memcpy(residual, f);

  /* print summary */
  snprintf(logBuffer, sizeof(logBuffer), "%s summary from method '%s/%s'\n", logBuffer, gsl_multifit_nlinear_name(work), gsl_multifit_nlinear_trs_name(work));
  snprintf(logBuffer, sizeof(logBuffer), "%s number of iterations = %zu\n", logBuffer, gsl_multifit_nlinear_niter(work));
  snprintf(logBuffer, sizeof(logBuffer), "%s function evaluations = %zu\n", logBuffer, fdf->nevalf);
  snprintf(logBuffer, sizeof(logBuffer), "%s Jacobian evaluations = %zu\n", logBuffer, fdf->nevaldf);
  snprintf(logBuffer, sizeof(logBuffer), "%s reason for stopping  = %s\n", logBuffer, (info == 1) ? "small step size" : "small gradient");
  snprintf(logBuffer, sizeof(logBuffer), "%s initial |f(x)|       = %f\n", logBuffer, sqrt(chisq0));
  snprintf(logBuffer, sizeof(logBuffer), "%s final |f(x)|         = %f\n", logBuffer, sqrt(chisq));
  snprintf(logBuffer, sizeof(logBuffer), "%s initial cost         = %.12e\n", logBuffer, chisq0);
  snprintf(logBuffer, sizeof(logBuffer), "%s final cost           = %.12e\n", logBuffer, chisq);
  snprintf(logBuffer, sizeof(logBuffer), "%s final cond(J)        = %.12e\n", logBuffer, 1.0 / rcond);

  gsl_multifit_nlinear_free(work);
}

/* return the number of unlocked parameters */
size_t setParametersIndexMatrix(int **lockedInputs, gsl_matrix *parameterIndexes, const int componentN, int *lockedOrderInputs, gsl_vector *orderParameterIndexes) {
    size_t n = 0;

    if (lockedOrderInputs[0] == 0) {
        gsl_vector_set(orderParameterIndexes, 0, n);
        n++;
    }

    if (lockedOrderInputs[1] == 0) {
        gsl_vector_set(orderParameterIndexes, 1, n);
        n++;
    }

    for (size_t i = 0; i < componentN; ++i) {
        for (size_t j = 0; j < 3; ++j) {
            if (lockedInputs[i][j] == 0) {
                gsl_matrix_set(parameterIndexes, i, j, n);
                n++;
            }
        }
    }
    return n;
}

char * EMSCRIPTEN_KEEPALIVE fitting(
    double* xInArray, double* yInArray, const int dataN,
    double **inputs, int **lockedInputs, const int componentN,
    int function, double* orderInputs, int* lockedOrderInputs,
    double* ampOut, double* centerOut, double* fwhmOut, double* orderInputsOut, double* integralOut, double* residualOut) {
    snprintf(logBuffer, sizeof(logBuffer), "");
    if (function == 0) {
        snprintf(logBuffer, sizeof(logBuffer), "%s Gaussian function fitting with %d component(s)\n", logBuffer, componentN);
    } else if (function == 1) {
        snprintf(logBuffer, sizeof(logBuffer), "%s Lorentzian function fitting with %d component(s)\n", logBuffer, componentN);
    }

    gsl_vector *orderParameterIndexes = gsl_vector_alloc(2); // the vector to store the indexes of unlocked order inputs in the fitting parameters vector. [fdf.p]
    gsl_matrix *parameterIndexes = gsl_matrix_alloc(componentN, 3); // the matrix to store the indexes of unlocked inputs in the fitting parameters vector. [fdf.p]

    const size_t n = dataN;  /* number of data points to fit */
    const size_t p = setParametersIndexMatrix(lockedInputs, parameterIndexes, componentN, lockedOrderInputs, orderParameterIndexes);  /* number of model parameters */

    gsl_vector *f = gsl_vector_alloc(n); // vector of data points
    gsl_vector *x = gsl_vector_alloc(p); // vector of parameters(unlocked input)
    gsl_vector *residual = gsl_vector_alloc(n); // vector of residual
    gsl_matrix *covar = gsl_matrix_alloc (p, p); // matrix of covariance
    gsl_multifit_nlinear_fdf fdf;
    gsl_multifit_nlinear_parameters fdf_params = gsl_multifit_nlinear_default_parameters();
    struct fitData fit_data;

    fit_data.t = xInArray;
    fit_data.y = yInArray;
    fit_data.n = n;
    fit_data.component = componentN;
    fit_data.function = function;
    fit_data.inputs = inputs;
    fit_data.orderInputs = orderInputs;
    fit_data.lockedInputs = lockedInputs;
    fit_data.lockedOrderInputs = lockedOrderInputs;
    fit_data.parameterIndexes = parameterIndexes;
    fit_data.orderParameterIndexes = orderParameterIndexes;

    /* define function to be minimized */
    fdf.f = func_f;
    fdf.df = NULL;
    fdf.fvv = NULL;
    fdf.n = n;
    fdf.p = p;
    fdf.params = &fit_data;

    /* starting point */
    size_t parameterIndex = 0;
    if (lockedOrderInputs[0] == 0) {
        gsl_vector_set(x, parameterIndex, orderInputs[0]);
        parameterIndex++;
    }
    if (lockedOrderInputs[1] == 0) {
        gsl_vector_set(x, parameterIndex, orderInputs[1]);
        parameterIndex++;
    }

    for (size_t i = 0; i < componentN; ++i)
    {
        for (size_t j = 0; j < 3; ++j)
        {
            if (lockedInputs[i][j] == 0) {
                gsl_vector_set(x, parameterIndex, inputs[i][j]);
                parameterIndex++;
            }
        }
    }

    fdf_params.trs = gsl_multifit_nlinear_trs_lm;
    solve_system(x, &fdf, &fdf_params, covar, residual);

    double residualVariance = 0;
    for (size_t i = 0; i < n; ++i)
    {
        residualVariance = residualVariance + pow(gsl_vector_get(residual, i), 2);
        residualOut[i] = gsl_vector_get(residual, i);
    }
    residualVariance = residualVariance / (n -p);

    size_t index;
    /* set fitting results of orderInputsOut(yIntercept, slope) */
    double yIntercept, yInterceptError, slope, slopeError;
    snprintf(logBuffer, sizeof(logBuffer), "%s\n baseline\n", logBuffer);
    if (lockedOrderInputs[0] == 0) {
        index = gsl_vector_get(orderParameterIndexes, 0);
        yIntercept = gsl_vector_get(x, index);
        yInterceptError = sqrt(residualVariance * gsl_matrix_get(covar, index, index));
        orderInputsOut[0] = yIntercept;
        orderInputsOut[1] = yInterceptError;
        snprintf(logBuffer, sizeof(logBuffer), "%s y intercept          = %.12e +/- %.12e (%.3g%%)\n", logBuffer, yIntercept, yInterceptError, 100 * yInterceptError/ abs(yIntercept));
    } else {
        orderInputsOut[0] = orderInputs[0];
        orderInputsOut[1] = NAN;
        snprintf(logBuffer, sizeof(logBuffer), "%s y intercept  (fixed) = %.12e\n", logBuffer, orderInputs[0]);
    }

    if (lockedOrderInputs[1] == 0) {
        index = gsl_vector_get(orderParameterIndexes, 1);
        slope = gsl_vector_get(x, index);
        slopeError = sqrt(residualVariance * gsl_matrix_get(covar, index, index));
        orderInputsOut[2] = slope;
        orderInputsOut[3] = slopeError;
        snprintf(logBuffer, sizeof(logBuffer), "%s slope                = %.12e +/- %.12e (%.3g%%)\n", logBuffer, slope, slopeError, 100 * slopeError/ abs(slope));
    } else {
        orderInputsOut[2] = orderInputs[1];
        orderInputsOut[3] = NAN;
        snprintf(logBuffer, sizeof(logBuffer), "%s slope        (fixed) = %.12e\n", logBuffer, orderInputs[1]);
    }

    /* set fitting results of components(amp, center, fwhm) */
    double amp, center, fwhm, ampError, centerError, fwhmError, integral, integralError, sigmaAmpFwhm;
    for (size_t i = 0; i < componentN; ++i)
    {
        snprintf(logBuffer, sizeof(logBuffer), "%s component #%zu\n", logBuffer, i + 1);
        if (lockedInputs[i][0] == 0) {
            index = gsl_matrix_get(parameterIndexes, i, 0);
            amp = gsl_vector_get(x, index);
            ampError = sqrt(residualVariance * gsl_matrix_get(covar, index, index));
            snprintf(logBuffer, sizeof(logBuffer), "%s amp%zu                 = %.12e +/- %.12e (%.3g%%)\n", logBuffer, i + 1, amp, ampError, 100 * ampError / abs(amp));
        } else {
            amp = inputs[i][0];
            ampError = NAN;
            snprintf(logBuffer, sizeof(logBuffer), "%s amp%zu         (fixed) = %.12e\n", logBuffer, i + 1, amp);
        }

        if (lockedInputs[i][1] == 0) {
            index = gsl_matrix_get(parameterIndexes, i, 1);
            center = gsl_vector_get(x, index);
            centerError = sqrt(residualVariance * gsl_matrix_get(covar, index, index));
            snprintf(logBuffer, sizeof(logBuffer), "%s center%zu              = %.12e +/- %.12e (%.3g%%)\n", logBuffer, i + 1, center, centerError, 100 * centerError / abs(center));
        } else {
            center = inputs[i][1];
            centerError = NAN;
            snprintf(logBuffer, sizeof(logBuffer), "%s center%zu      (fixed) = %.12e\n", logBuffer, i + 1, center);
        }

        if (lockedInputs[i][2] == 0) {
            index = gsl_matrix_get(parameterIndexes, i, 2);
            fwhm = gsl_vector_get(x, index);
            fwhmError = sqrt(residualVariance * gsl_matrix_get(covar, index, index));
            snprintf(logBuffer, sizeof(logBuffer), "%s fwhm%zu                = %.12e +/- %.12e (%.3g%%)\n", logBuffer, i + 1, fwhm, fwhmError, 100 * fwhmError / abs(fwhm));
        } else {
            fwhm = inputs[i][2];
            fwhmError = NAN;
            snprintf(logBuffer, sizeof(logBuffer), "%s fwhm%zu        (fixed) = %.12e\n", logBuffer, i + 1, fwhm);
        }

        if (function == 0) {
            integral = amp * abs(fwhm / (2 * sqrt(log(2.0)))) * sqrt(M_PI);
        } else if (function == 1) {
            integral = 0.5 * M_PI * amp * fwhm;
        }

        if (lockedInputs[i][0] == 1 && lockedInputs[i][2] == 1) {
            integralError = NAN;
            snprintf(logBuffer, sizeof(logBuffer), "%s integral of function = %.12e\n", logBuffer, integral);
        } else {
            if (lockedInputs[i][0] == 0 && lockedInputs[i][2] == 0) {
                sigmaAmpFwhm = residualVariance * gsl_matrix_get(covar, gsl_matrix_get(parameterIndexes, i, 0), gsl_matrix_get(parameterIndexes, i, 2));
                integralError = integral * sqrt(pow(ampError / amp, 2) + pow(fwhmError / fwhm, 2) + 2 * sigmaAmpFwhm / (amp * fwhm));
            } else if (lockedInputs[i][0] == 0) {
                integralError = integral * abs(ampError / amp);
            } else {
                integralError = integral * abs(fwhmError / fwhm);
            }
            snprintf(logBuffer, sizeof(logBuffer), "%s integral of function ~= %.12e +/- %.12e (%.3g%%)\n", logBuffer, integral, integralError, 100 * integralError / abs(integral));
        }

        ampOut[2 * i] = amp;
        ampOut[2 * i + 1] = ampError;
        centerOut[2 * i] = center;
        centerOut[2 * i + 1] = centerError;
        fwhmOut[2 * i] = fwhm;
        fwhmOut[2 * i + 1] = fwhmError;
        integralOut[2 * i] = integral;
        integralOut[2 * i + 1] = integralError;
    }

    gsl_vector_free(f);
    gsl_vector_free(x);
    gsl_vector_free(residual);
    gsl_matrix_free(covar);
    gsl_matrix_free(parameterIndexes);
    gsl_vector_free(orderParameterIndexes);

    return logBuffer;
}

}