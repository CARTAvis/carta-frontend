import * as _ from "lodash";
import * as GSL from "gsl_wrapper";
import {ProfileFittingIndividualStore} from "stores";
import {FittingFunction} from "components/SpectralProfiler/ProfileFittingComponent/ProfileFittingComponent";

export function hanningSmoothing(data: number[]) {
    // hanning width = 3
    const smoothedData: number[] = [];
    smoothedData.push(data[0]);
    for (let i = 1; i < data.length - 1; i++) {
        const value = 0.25 * data[i - 1] + 0.5 * data[i] + 0.25 * data[i + 1];
        smoothedData.push(value);
    }
    smoothedData.push(data[data.length - 1]);
    return smoothedData;
}

export function binning(data: number[], binWidth: number) {
    const binnedData: number[] = [];
    for (let i = 0; i < data.length - binWidth; i = i + binWidth) {
        binnedData.push(_.mean(data.slice(i, i + binWidth > data.length ? data.length : i + binWidth)));
    }
    return binnedData;
}

export function getIndexByValue(values: number[], targetValue: number) {
    // const deltaVelocity = Math.abs(values[1] - values[0]);
    for (let i = 0; i < values.length - 1; i++) {
        if (values[i] <= targetValue && targetValue < values[i + 1]) {
            return i;
        } else if (values[i] >= targetValue && targetValue > values[i + 1]) {
            return i;
        } else if (targetValue === values[i + 1]) {
            return i + 1;
        }
    }
    return null;
}

export function profilePreprocessing(data: number[]) {
    let dataProcessed = binning(data, Math.floor(data.length / 128) + 1);
    dataProcessed = hanningSmoothing(dataProcessed);
    dataProcessed = hanningSmoothing(dataProcessed); // seems necessary from testing
    return dataProcessed;
}

/**
 * Compute the histogram of a set of data.
 *
 * @param {number[]} data Input data.
 * @param {number[]} binN defines the number of equal-width bins in the given range.
 * @return {hist: number[], binEdges: number[]}
 *
 * hist: The values of the histogram.
 * binEdges: Return the bin edges.
 */
export function histogram(data: number[], binN: number): {hist: number[]; binEdges: number[]} {
    if (isFinite(binN) && binN > 0) {
    }
    const binEdges = [];
    const min = _.min(data);
    const max = _.max(data);
    const binWidth = (max - min) / binN;

    for (let i = 0; i < binN; i++) {
        binEdges.push(min + i * binWidth);
    }

    binEdges.push(max);

    const hist = new Array(binN).fill(0);

    for (const value of data) {
        for (let j = 0; j < binN; j++) {
            if (value >= binEdges[j] && value < binEdges[j + 1]) {
                hist[j] = hist[j] + 1;
                break;
            } else if (value === binEdges[binN]) {
                hist[binN - 1] = hist[binN - 1] + 1;
                break;
            }
        }
    }

    return {hist, binEdges};
}

export function histogramGaussianFit(y: number[], bins: number) {
    const histResult = histogram(y, bins);

    // padding 0 to both sides of the histogram
    const histY: number[] = [0, ...histResult.hist, 0];
    const histXCenterTmp = [];
    for (let i = 0; i < histResult.binEdges.length - 2; i++) {
        histXCenterTmp.push((histResult.binEdges[i] + histResult.binEdges[i + 1]) / 2);
    }
    const deltaHistXCenter = histXCenterTmp[1] - histXCenterTmp[0];
    const histXCenter: number[] = [histXCenterTmp[0] - deltaHistXCenter, ...histXCenterTmp, histXCenterTmp[histXCenterTmp.length - 1] + deltaHistXCenter];

    const maxHistYIndex = _.findIndex(histY, y => y === _.max(histY));
    // when maxHistYIndex is on the edge of the histY(excluded added zero), return values without Gaussian fitting
    if (maxHistYIndex === 1 || maxHistYIndex === histY.length - 2) {
        return {center: histXCenter[maxHistYIndex], stddev: deltaHistXCenter};
    }
    // [amp, center, fwhm]
    const initialGuess = [_.max(histY), histXCenter[maxHistYIndex], 2 * Math.sqrt(Math.log(10) * 2) * 0.5 * deltaHistXCenter];
    const histogramGaussianFitting = GSL.fitting(FittingFunction.GAUSSIAN, new Float64Array(histXCenter), new Float64Array(histY), initialGuess, [0, 0, 0], [0, 0], [1, 1]);

    const intensitySmoothedMean = histogramGaussianFitting.center[0];
    const intensitySmoothedStddev = histogramGaussianFitting.fwhm[0] / (2 * Math.sqrt(Math.log(2) * 2));
    return {center: intensitySmoothedMean, stddev: intensitySmoothedStddev};
}

export function getEstimatedPoints(xInput: number[], yInput: number[]): {x: number; y: number}[] {
    const yDataFlippedSum = yInput.map((value, i) => {
        return value + yInput[yInput.length - 1 - i];
    });

    const fitHistogramResult = histogramGaussianFit(yDataFlippedSum, Math.floor(Math.sqrt(yDataFlippedSum.length)));
    const flippedSumMean = fitHistogramResult.center;
    const flippedSumStddev = fitHistogramResult.stddev;

    let INDEX_FROM, INDEX_TO;
    let SWITCH = false;
    const xMeanSegment = [];
    const yMeanSegment = [];
    const SN = 2;
    const FLOOR = flippedSumMean - SN * flippedSumStddev;
    const CEILING = flippedSumMean + SN * flippedSumStddev;
    for (let i = 0; i < yDataFlippedSum.length; i++) {
        const value = yDataFlippedSum[i];
        if (value < CEILING && value > FLOOR && SWITCH === false && i <= yDataFlippedSum.length - 2) {
            INDEX_FROM = i;
            SWITCH = true;
        } else if ((value > CEILING || value < FLOOR) && SWITCH === true) {
            INDEX_TO = i;
            SWITCH = false;
            xMeanSegment.push(_.mean(xInput.slice(INDEX_FROM, INDEX_TO)));
            yMeanSegment.push(_.mean(yInput.slice(INDEX_FROM, INDEX_TO)));
        } else if (value < CEILING && value > FLOOR && SWITCH === true && i === yDataFlippedSum.length - 1) {
            INDEX_TO = i;
            xMeanSegment.push(_.mean(xInput.slice(INDEX_FROM, INDEX_TO)));
            yMeanSegment.push(_.mean(yInput.slice(INDEX_FROM, INDEX_TO)));
            break;
        }
    }

    if (xMeanSegment.length <= 1) {
        xMeanSegment.push(_.mean(xInput.slice(0, Math.floor(xInput.length) / 2)));
        xMeanSegment.push(_.mean(xInput.slice(Math.floor(xInput.length / 2), xInput.length)));
        yMeanSegment.push(_.mean(yInput.slice(0, Math.floor(yInput.length) / 2)));
        yMeanSegment.push(_.mean(yInput.slice(Math.floor(yInput.length / 2), yInput.length)));
    }
    return [
        {x: xMeanSegment[0], y: yMeanSegment[0]},
        {x: xMeanSegment[xMeanSegment.length - 1], y: yMeanSegment[yMeanSegment.length - 1]}
    ];
}

export function autoDetecting(xInput: number[], yInput: number[], orderInputs?: {order: number; yIntercept: number; slope: number}): {components: ProfileFittingIndividualStore[]; order: number; yIntercept: number; slope: number} {
    // This part of codes tries to analyze the input spectrum and guesses where spectral and continuum features are, then sets up a set of initial solution for the GSL profile fitter. The procedure is outlined below.

    // On the GUI, there is a toggle 'w/ cont.' which sets a flag to the guesser if continuum needs to be taken into account or not.
    // When the flag is False (ie no continuum), a histogram of the input spectrum will be computed and a Gaussian is fitted to the peak of the histogram.
    // If the input spectrum is mostly line free, the center of the final Gaussian represents the mean value of the line-free part of the spectrum and the stddev of the Gaussian represents the 1-sigma noise level of the line-free part.
    // Note that if line feature dominates the spectrum, the derived mean and stddev values are over-estimated, which might affect the subsequent procedures.

    // Then, the second part of the procedures is to identify segments of channels that _contain_ line features based on the derived mean and stddev from the histogram.
    // The output of this part is a list of channel segments.

    // Then the third (final) part of the procedures is to check multiplicity of each line segment to see if there are more than one line feature (ie Gaussian-like profile).
    // The procedure is to identify local min and max first then analyze the "pattern" of min and max.
    // For example, if we see the distribution max-min-max in one line segment and the mean value in this segment is greater than the mean derived from the histogram, then we guess there are TWO line features in this segment.
    // If we see min-min and the mean value in this segment is less than the mean derived from the histogram, then we guess there are TWO absorption features in this segment.

    // Once all line segments pass the multiplicity check, a final list of channel ranges is derived with each representing a line feature for the GSL profile fitter.
    // The initial values of a Gaussian component are derived from a given channel range (ie an identified line feature).

    // If the toggle 'w/ cont.' is enabled (ie there is continuum), before computing a histogram to estimate mean and stddev of line free part of the spectrum, an extra step is taken.
    // This extra step is to remove the apparent continuum (a constant or a line with a slope) so that the procedures mentioned above can work properly in most of cases.
    // To remove the apparent continuum, we form a new array as the input spectrum plus the reversed spectrum.
    // Then we apply the same trick by forming a histogram and fitting a Gaussian to guess which channel ranges are _line free_.
    // These line free channels are thus used for estimating the apparent continuum (as a constant or a line with a slope) and set up the initial solution for GSL profile fitter.
    // Once the continuum is estimated, we remove the continuum from the input spectrum first then apply the same procedures as 'w/ cont.'=False.
    // Note that when estimating the continuum, if the input spectrum are dominated with line features (especially when their distributions have mirror symmetry), the final estimated continuum may not be ideal.
    // Therefore, the following line feature identification procedures (2nd and 3rd) may not work well.

    let x: number[] = xInput;
    let y: number[] = yInput;

    let order;
    let yMean;
    let slope;
    let yIntercept;

    const estimatedPoints = getEstimatedPoints(x, y);
    const startPoint = estimatedPoints[0];
    const endPoint = estimatedPoints[1];

    // set baseline
    if (orderInputs) {
        slope = orderInputs.slope;
        yIntercept = orderInputs.yIntercept;
    } else {
        yMean = (startPoint.y + endPoint.y) / 2;
        slope = (endPoint.y - startPoint.y) / (endPoint.x - startPoint.x);
        yIntercept = startPoint.y - slope * startPoint.x;
    }

    // adjust y with given baseline
    y = yInput.map((yi, i) => {
        return yi - (slope * x[i] + yIntercept);
    });

    // pre-processing data based on number of channels
    const xSmoothed = profilePreprocessing(x);
    const ySmoothed = profilePreprocessing(y);

    // fit a gaussian to the intensity histogram as an estimate of continuum level and noise level
    const bins = Math.floor(Math.sqrt(y.length));
    const fitHistogramResult = histogramGaussianFit(ySmoothed, bins <= 8 ? 8 : bins);
    const intensitySmoothedMean = fitHistogramResult.center;
    const intensitySmoothedStddev = fitHistogramResult.stddev;

    if (orderInputs) {
        order = orderInputs.order;
    } else {
        // validate order of baseline with estimatedPoints and histogram fitting stddev
        const orderValidWidth = 3 * intensitySmoothedStddev;
        if (-orderValidWidth < startPoint.y && startPoint.y < orderValidWidth && -orderValidWidth < endPoint.y && endPoint.y < orderValidWidth) {
            order = -1;
            yIntercept = 0;
            slope = 0;
        } else if (yMean - orderValidWidth < startPoint.y && startPoint.y < yMean + orderValidWidth && yMean - orderValidWidth < endPoint.y && endPoint.y < yMean + orderValidWidth) {
            order = 0;
            yIntercept = yMean;
            slope = 0;
        } else {
            order = 1;
        }
    }

    // 1st: marking channels with signals
    const lineBoxs: {fromIndex; toIndex; fromIndexOri; toIndexOri}[] = [];
    let switchFrom = false;
    const nSigmaThreshold = 2;
    const signalChCountThreshold = 4;
    const floor = intensitySmoothedMean - nSigmaThreshold * intensitySmoothedStddev;
    const ceiling = intensitySmoothedMean + nSigmaThreshold * intensitySmoothedStddev;

    let fromIndex = 0,
        toIndex = 0,
        fromIndexOri,
        toIndexOri;
    for (let i = 0; i < ySmoothed.length; i++) {
        const value = ySmoothed[i];
        if ((value > ceiling || value < floor) && switchFrom === false) {
            fromIndex = i;
            switchFrom = true;
        } else if (value < ceiling && value > floor && switchFrom === true) {
            toIndex = i - 1;
            switchFrom = false;
            fromIndexOri = getIndexByValue(x, xSmoothed[fromIndex]);
            toIndexOri = getIndexByValue(x, xSmoothed[toIndex]);
            if (
                toIndexOri - fromIndexOri + 1 >= signalChCountThreshold &&
                (_.mean(ySmoothed.slice(fromIndex, toIndex + 1)) > intensitySmoothedMean + 3 * intensitySmoothedStddev || _.mean(ySmoothed.slice(fromIndex, toIndex + 1)) < intensitySmoothedMean - 3 * intensitySmoothedStddev)
            ) {
                lineBoxs.push({fromIndexOri, toIndexOri, fromIndex, toIndex});
            }
        } else if ((value > ceiling || value < floor) && switchFrom === true && i === ySmoothed.length - 1) {
            toIndex = i;
            fromIndexOri = getIndexByValue(x, xSmoothed[fromIndex]);
            toIndexOri = getIndexByValue(x, xSmoothed[toIndex]);
            if (
                toIndexOri - fromIndexOri + 1 >= signalChCountThreshold &&
                (_.mean(ySmoothed.slice(fromIndex, toIndex + 1)) > intensitySmoothedMean + 3 * intensitySmoothedStddev || _.mean(ySmoothed.slice(fromIndex, toIndex + 1)) < intensitySmoothedMean - 3 * intensitySmoothedStddev)
            ) {
                lineBoxs.push({fromIndexOri, toIndexOri, fromIndex, toIndex});
            }
            break;
        }
    }

    // 2nd: checking multiplicity per identified feature in 1st step
    const lineBoxsFinal: {fromIndex; toIndex; fromIndexOri; toIndexOri}[] = [];
    const multiChCountThreshold = 12;
    const multiMeanSnThreshold = 4;
    //const multiWidthThreshold = 7;

    for (let i = 0; i < lineBoxs.length; i++) {
        const lineBox = lineBoxs[i];
        const meanSN = (_.mean(ySmoothed.slice(lineBox.fromIndex, lineBox.toIndex)) - intensitySmoothedMean) / intensitySmoothedStddev;
        const chCount = lineBox.toIndex - lineBox.fromIndex + 1;
        const dividerIndex = [];
        let dividerIndexTmp = [];
        const dividerValueTmp = [];
        const dividerLocalMaxIndex = [];
        const dividerLocalMinIndex = [];
        const dividerLocalMaxValue = [];
        const dividerLocalMinValue = [];

        if (Math.abs(meanSN) >= multiMeanSnThreshold && chCount >= multiChCountThreshold) {
            for (let j = lineBox.fromIndex; j < lineBox.toIndex - 4; j++) {
                const tempData = ySmoothed.slice(j, j + 5);
                const tempMap = tempData.map((data, index) => {
                    return {data, index};
                });
                const sortedArg = _.sortBy(tempMap, temp => temp.data).map(data => {
                    return data.index;
                });
                if ((sortedArg[3] === 0 && sortedArg[4] === 4) || (sortedArg[3] === 4 && sortedArg[4] === 0)) {
                    dividerLocalMinIndex.push(getIndexByValue(x, xSmoothed[j + 2]));
                    dividerLocalMinValue.push(ySmoothed[j + 2]);
                }

                if ((sortedArg[0] === 0 && sortedArg[1] === 4) || (sortedArg[0] === 4 && sortedArg[1] === 0)) {
                    dividerLocalMaxIndex.push(getIndexByValue(x, xSmoothed[j + 2]));
                    dividerLocalMaxValue.push(ySmoothed[j + 2]);
                }
            }
            // validating each divider index

            for (const index of dividerLocalMinIndex) {
                dividerIndexTmp.push(index);
            }
            for (const index of dividerLocalMaxIndex) {
                dividerIndexTmp.push(index);
            }
            dividerIndexTmp = dividerIndexTmp.sort((a, b) => a - b);

            // dividerValueTmp is not used elsewhere
            for (const index of dividerIndexTmp) {
                if (dividerLocalMinIndex.indexOf(index) !== -1) {
                    dividerValueTmp.push(dividerLocalMinValue[dividerLocalMinIndex.indexOf(index)]);
                } else {
                    dividerValueTmp.push(dividerLocalMaxValue[dividerLocalMaxIndex.indexOf[index]]);
                }
            }
            dividerIndex.push(lineBox.fromIndexOri);

            if (dividerIndexTmp.length === 0) {
            } else if (dividerIndexTmp.length === 1) {
                const middle = dividerIndexTmp[0];
                if (meanSN > 0) {
                    if (dividerLocalMinIndex.indexOf(middle) !== -1) {
                        dividerIndex.push(middle);
                    }
                } else {
                    if (dividerLocalMaxIndex.indexOf(middle) !== -1) {
                        dividerIndex.push(middle);
                    }
                }
            } else if (dividerIndexTmp.length === 2) {
                const left = dividerIndexTmp[0];
                const right = dividerIndexTmp[1];
                if (meanSN > 0) {
                    if (dividerLocalMinIndex.indexOf(left) !== -1) {
                        if (dividerLocalMinIndex.indexOf(right) !== -1) {
                            dividerIndex.push(left);
                            dividerIndex.push(right);
                        } else if (dividerLocalMaxIndex.indexOf(right) !== -1) {
                            dividerIndex.push(left);
                        }
                    } else if (dividerLocalMaxIndex.indexOf(left) !== -1) {
                        if (dividerLocalMinIndex.indexOf(right) !== -1) {
                            dividerIndex.push(right);
                        } else if (dividerLocalMaxIndex.indexOf(right) !== -1) {
                            dividerIndex.push(Math.floor((left + right) / 2));
                        }
                    }
                } else {
                    if (dividerLocalMinIndex.indexOf(left) !== -1) {
                        if (dividerLocalMinIndex.indexOf(right) !== -1) {
                            dividerIndex.push(Math.floor((left + right) / 2));
                        } else if (dividerLocalMaxIndex.indexOf(right) !== -1) {
                            dividerIndex.push(right);
                        }
                    } else if (dividerLocalMaxIndex.indexOf(left) !== -1) {
                        if (dividerLocalMinIndex.indexOf(right) !== -1) {
                            dividerIndex.push(left);
                        } else if (dividerLocalMaxIndex.indexOf(right) !== -1) {
                            dividerIndex.push(left);
                            dividerIndex.push(right);
                        }
                    }
                }
            } else if (dividerIndexTmp.length >= 3) {
                if (meanSN > 0) {
                    for (let k = 0; k < dividerIndexTmp.length - 2; k++) {
                        const left = dividerIndexTmp[k];
                        const middle = dividerIndexTmp[k + 1];
                        const right = dividerIndexTmp[k + 2];
                        if (dividerLocalMinIndex.indexOf(left) !== -1) {
                            if (dividerLocalMinIndex.indexOf(middle) !== -1) {
                                dividerIndex.push(left);
                            } else if (dividerLocalMaxIndex.indexOf(middle) !== -1 && k === 0) {
                                dividerIndex.push(left);
                            }
                        } else if (dividerLocalMaxIndex.indexOf(left) !== -1) {
                            if (dividerLocalMinIndex.indexOf(middle) !== -1 && dividerLocalMaxIndex.indexOf(right) !== -1) {
                                dividerIndex.push(middle);
                            } else if (dividerLocalMaxIndex.indexOf(middle) !== -1) {
                                dividerIndex.push(Math.floor((left + middle) / 2));
                            }
                        }
                    }

                    const dividerIndexTmpLast1 = dividerIndexTmp[dividerIndexTmp.length - 1];
                    if (dividerLocalMinIndex.indexOf(dividerIndexTmpLast1) !== -1) {
                        dividerIndex.push(dividerIndexTmpLast1);
                    }
                    const dividerIndexTmpLast2 = dividerIndexTmp[dividerIndexTmp.length - 2];
                    if (dividerLocalMaxIndex.indexOf(dividerIndexTmpLast2) !== -1 && dividerLocalMaxIndex.indexOf(dividerIndexTmpLast1) !== -1) {
                        dividerIndex.push(Math.floor((dividerIndexTmpLast2 + dividerIndexTmpLast1) / 2));
                    }
                    const dividerIndexTmpLast3 = dividerIndexTmp[dividerIndexTmp.length - 3];
                    if (dividerLocalMinIndex.indexOf(dividerIndexTmpLast3) !== -1 && dividerLocalMinIndex.indexOf(dividerIndexTmpLast2) !== -1 && dividerLocalMaxIndex.indexOf(dividerIndexTmpLast1) !== -1) {
                        dividerIndex.push(dividerIndexTmpLast2);
                    }
                } else {
                    for (let k = 0; k < dividerIndexTmp.length - 2; k++) {
                        const left = dividerIndexTmp[k];
                        const middle = dividerIndexTmp[k + 1];
                        const right = dividerIndexTmp[k + 2];
                        if (dividerLocalMaxIndex.indexOf(left) !== -1) {
                            if (dividerLocalMaxIndex.indexOf(middle) !== -1) {
                                dividerIndex.push(left);
                            } else if (dividerLocalMinIndex.indexOf(middle) !== -1 && k === 0) {
                                dividerIndex.push(left);
                            }
                        } else if (dividerLocalMinIndex.indexOf(left) !== -1) {
                            if (dividerLocalMaxIndex.indexOf(middle) !== -1 && dividerLocalMinIndex.indexOf(right) !== -1) {
                                dividerIndex.push(middle);
                            } else if (dividerLocalMinIndex.indexOf(middle) !== -1) {
                                dividerIndex.push(Math.floor((left + middle) / 2));
                            }
                        }
                    }

                    const dividerIndexTmpLast1 = dividerIndexTmp[dividerIndexTmp.length - 1];
                    if (dividerLocalMaxIndex.indexOf(dividerIndexTmpLast1) !== -1) {
                        dividerIndex.push(dividerIndexTmpLast1);
                    }
                    const dividerIndexTmpLast2 = dividerIndexTmp[dividerIndexTmp.length - 2];
                    if (dividerLocalMinIndex.indexOf(dividerIndexTmpLast2) !== -1 && dividerLocalMinIndex.indexOf(dividerIndexTmpLast1) !== -1) {
                        dividerIndex.push(Math.floor((dividerIndexTmpLast2 + dividerIndexTmpLast1) / 2));
                    }
                    const dividerIndexTmpLast3 = dividerIndexTmp[dividerIndexTmp.length - 3];
                    if (dividerLocalMaxIndex.indexOf(dividerIndexTmpLast3) !== -1 && dividerLocalMaxIndex.indexOf(dividerIndexTmpLast2) !== -1 && dividerLocalMinIndex.indexOf(dividerIndexTmpLast1) !== -1) {
                        dividerIndex.push(dividerIndexTmpLast2);
                    }
                }
            }

            dividerIndex.push(lineBox.toIndexOri);

            for (let d = 0; d < dividerIndex.length - 1; d++) {
                const fromIndexOri = dividerIndex[d];
                const toIndexOri = dividerIndex[d + 1];
                const fromIndex = getIndexByValue(xSmoothed, x[dividerIndex[d]]);
                const toIndex = getIndexByValue(xSmoothed, x[dividerIndex[d + 1]]);
                lineBoxsFinal.push({fromIndexOri, toIndexOri, fromIndex, toIndex});
            }
        } else {
            lineBoxsFinal.push(lineBox);
        }
    }

    const components: ProfileFittingIndividualStore[] = [];
    for (const lineBox of lineBoxsFinal) {
        const component = new ProfileFittingIndividualStore();
        component.setFwhm(Math.abs(x[lineBox.toIndexOri] - x[lineBox.fromIndexOri]) / 2);
        const localYSmoothed = ySmoothed.slice(lineBox.fromIndex, lineBox.toIndex + 1);
        const localYExtrema = _.mean(localYSmoothed) > intensitySmoothedMean ? _.max(localYSmoothed) : _.min(localYSmoothed);
        component.setAmp(localYExtrema);
        const localYExtremaIndex = localYSmoothed.indexOf(localYExtrema);
        component.setCenter(xSmoothed[lineBox.fromIndex + localYExtremaIndex]);
        components.push(component);
    }

    return {components, order, yIntercept, slope};
}
