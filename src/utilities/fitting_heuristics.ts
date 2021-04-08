import * as _ from "lodash";
import * as GSL from "gsl_wrapper";
import { ProfileFittingIndividualStore } from "stores/ProfileFittingStore";

export function hanningSmoothing(data: number[]) {
    // hanning width = 3
    const smoothedData: number[] = [];
    smoothedData.push(data[0]);
    for (let i = 1 ; i < data.length -1; i++) {
        const value = 0.25 * data[i - 1] + 0.5 * data[i] + 0.25 * data[i + 1];
        smoothedData.push(value);
    }
    smoothedData.push(data[data.length - 1]);
    return smoothedData;
}

export function binning(data: number[], binWidth: number) {
    const binnedData: number[] = [];
    for (let i = 0; i < data.length - binWidth; i = i + binWidth ) {
        binnedData.push(_.mean(data.slice(i, (i + binWidth > data.length) ? data.length : i + binWidth)))
    }
    return binnedData;
}

export function getIndexByVelocity(velocity: number[], targetVelocity: number) {
    // const deltaVelocity = Math.abs(velocity[1] - velocity[0]);
    for (let i = 0; i < velocity.length - 1; i ++) {
        if (velocity[i] <= targetVelocity && targetVelocity < velocity[i + 1]) {
            return i;
        } else if (velocity[i] >= targetVelocity && targetVelocity > velocity[i + 1]) {
            return i;
        } else if (targetVelocity === velocity[i + 1]) {
            return i + 1;
        }
    }
    return null;
}

export function profilePreprocessing(data: number[]) {
    let dataProcessed = binning(data, Math.floor(data.length / 128) + 1);
    dataProcessed = hanningSmoothing(dataProcessed);
    dataProcessed = hanningSmoothing(dataProcessed);// seems necessary from testing
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
export function histogram(data: number[], binN: number): {hist: number[], binEdges: number[]} {
    if (isFinite(binN) && binN > 0) {

    }
    const binEdges = [];
    const min = _.min(data);
    const max = _.max(data);
    const binWidth = (max - min) / binN;

    for (let i = 0; i < binN ; i++) {
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


export function autoDetecting(velocity: number[], intensity:number[]) : ProfileFittingIndividualStore[] {
    // pre-processing data based on number of channels
    const xSmoothed = profilePreprocessing(velocity);
    const ySmoothed = profilePreprocessing(intensity);

    // fit a gaussian to the intensity histogram as an estimate of continuum level and noise level
    const bins = Math.floor(Math.sqrt(velocity.length));
    const histResult = histogram(ySmoothed, bins <= 8 ? 8 : bins);

    // padding 0 to both sides of the histogram
    let histY: number[] = [0, ...histResult.hist, 0];
    const histXCenterTmp = [];
    for (let i = 0; i < histResult.binEdges.length - 2 ; i++) {
        histXCenterTmp.push((histResult.binEdges[i] + histResult.binEdges[i + 1])/ 2);
    }
    const deltaHistXCenter = histXCenterTmp[1] - histXCenterTmp[0];
    let histXCenter: number[] = [histXCenterTmp[0] - deltaHistXCenter, ...histXCenterTmp, histXCenterTmp[histXCenterTmp.length - 1] + deltaHistXCenter];

    // [amp, center, fwhm]
    const initialGuess = [_.max(histY), histXCenter[_.findIndex(histY, (y => y === _.max(histY)))], 2 * Math.sqrt(Math.log(10) * 2 ) * 0.5 * (deltaHistXCenter)];
    const histogramGaussianFitting = GSL.gaussianFitting(new Float64Array(histXCenter),new Float64Array(histY), initialGuess, [0, 0, 0]);

    const intensitySmoothedMean = histogramGaussianFitting.center[0];
    const intensitySmoothedStddev = histogramGaussianFitting.fwhm[0] / (2 * Math.sqrt(Math.log(2) * 2 )); 

    // 1st: marking channels with signals
    const lineBoxs:{fromIndex, toIndex, fromIndexOri, toIndexOri}[] = [];
    let switchFrom  = false;
    const nSigmaThreshold = 2;
    const signalChCountThreshold = 4;
    const floor = intensitySmoothedMean - nSigmaThreshold * intensitySmoothedStddev;
    const ceiling = intensitySmoothedMean + nSigmaThreshold * intensitySmoothedStddev;

    let fromIndex = 0, toIndex = 0, fromIndexOri, toIndexOri;
    for (let i = 0; i < ySmoothed.length; i++) {
        const value = ySmoothed[i];
        if((value > ceiling || value < floor) && switchFrom === false) {
            fromIndex = i;
            switchFrom = true;
        } else if (value < ceiling && value > floor && switchFrom === true) {
            toIndex = i - 1;
            switchFrom = false;
            fromIndexOri = getIndexByVelocity(velocity, xSmoothed[fromIndex]);
            toIndexOri = getIndexByVelocity(velocity, xSmoothed[toIndex]);
            if (toIndexOri - fromIndexOri + 1 >= signalChCountThreshold && (_.mean(ySmoothed.slice(fromIndex, toIndex + 1))> intensitySmoothedMean + 3 * intensitySmoothedStddev || _.mean(ySmoothed.slice(fromIndex, toIndex + 1)) < intensitySmoothedMean - 3 * intensitySmoothedStddev)) {
                lineBoxs.push({fromIndexOri, toIndexOri, fromIndex, toIndex});
            }
        } else if((value > ceiling || value < floor) && switchFrom === true && i === ySmoothed.length - 1) {
            toIndex = i;
            fromIndexOri = getIndexByVelocity(velocity, xSmoothed[fromIndex]);
            toIndexOri = getIndexByVelocity(velocity, xSmoothed[toIndex]);
            if (toIndexOri - fromIndexOri + 1 >= signalChCountThreshold && (_.mean(ySmoothed.slice(fromIndex, toIndex + 1))> intensitySmoothedMean + 3 * intensitySmoothedStddev || _.mean(ySmoothed.slice(fromIndex, toIndex + 1)) < intensitySmoothedMean - 3 * intensitySmoothedStddev)) {
                lineBoxs.push({fromIndexOri, toIndexOri, fromIndex, toIndex});
            }
            break;
        }
    }

    // 2nd: checking multiplicity per identified feature in 1st step
    const lineBoxsFinal:{fromIndex, toIndex, fromIndexOri, toIndexOri}[] = [];
    const multiChCountThreshold = 12;
    const multiMeanSnThreshold = 4
    //const multiWidthThreshold = 7;

    for (let i = 0; i < lineBoxs.length; i++) {
        const lineBox = lineBoxs[i];
        const meanSN = (_.mean(ySmoothed.slice(lineBox.fromIndex, lineBox.toIndex)) - intensitySmoothedMean) / intensitySmoothedStddev;
        const chCount = lineBox.toIndex - lineBox.fromIndex + 1;
        const dividerIndex = [];
        const dividerIndexTmp = [];
        const dividerValueTmp = [];
        const dividerLocalMaxIndex = [];
        const dividerLocalMinIndex = [];
        const dividerLocalMaxValue = [];
        const dividerLocalMinValue = [];

        if (Math.abs(meanSN) >= multiMeanSnThreshold && chCount >= multiChCountThreshold) {
            for (let j = lineBox.fromIndex ; j < lineBox.toIndex - 4; j++) {
                const tempData = ySmoothed.slice(j,j + 5);
                const tempMap = tempData.map((data, index) => {return {data, index}})
                const sortedArg = _.sortBy(tempMap, temp => temp.data).map((data) => {return data.index}); 
                if ((sortedArg[3] === 0 && sortedArg[4] === 4) || (sortedArg[3] === 4 && sortedArg[4] === 0)) {
                    dividerLocalMinIndex.push(getIndexByVelocity(velocity, xSmoothed[j + 2]));
                    dividerLocalMinValue.push(ySmoothed[j + 2]);
                }

                if ((sortedArg[0] === 0 && sortedArg[1] === 4) || (sortedArg[0] === 4 && sortedArg[1] === 0)) {
                    dividerLocalMaxIndex.push(getIndexByVelocity(velocity, xSmoothed[j + 2]));
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
            dividerIndexTmp.sort();
            
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
                            dividerIndex.push((left + right)/2);
                        }
                    }
                } else {
                    if (dividerLocalMinIndex.indexOf(left) !== -1) {
                        if (dividerLocalMinIndex.indexOf(right) !== -1) {
                            dividerIndex.push((left + right)/2);
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
                    for (let k = 0; k < dividerIndexTmp.length - 2;  k++) {
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
                                dividerIndex.push((left + middle)/2);
                            }
                        }
                    }

                    const dividerIndexTmpLast1 = dividerIndexTmp[dividerIndexTmp.length - 1];
                    if (dividerLocalMinIndex.indexOf(dividerIndexTmpLast1) !== -1) {
                        dividerIndex.push(dividerIndexTmpLast1);
                    }
                    const dividerIndexTmpLast2 = dividerIndexTmp[dividerIndexTmp.length - 2];
                    if (dividerLocalMaxIndex.indexOf(dividerIndexTmpLast2) !== -1 && dividerLocalMaxIndex.indexOf(dividerIndexTmpLast1) !== -1) {
                        dividerIndex.push((dividerIndexTmpLast2 + dividerIndexTmpLast1) / 2);
                    }
                    const dividerIndexTmpLast3 = dividerIndexTmp[dividerIndexTmp.length - 3];
                    if (dividerLocalMinIndex.indexOf(dividerIndexTmpLast3) !== -1 && dividerLocalMinIndex.indexOf(dividerIndexTmpLast2) !== -1 && dividerLocalMaxIndex.indexOf(dividerIndexTmpLast1) !== -1) {
                        dividerIndex.push(dividerIndexTmpLast2);
                    }
                } else {
                    for (let k = 0; k < dividerIndexTmp.length - 2;  k++) {
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
                                dividerIndex.push((left + middle)/2);
                            }
                        }
                    }

                    const dividerIndexTmpLast1 = dividerIndexTmp[dividerIndexTmp.length - 1];
                    if (dividerLocalMaxIndex.indexOf(dividerIndexTmpLast1) !== -1) {
                        dividerIndex.push(dividerIndexTmpLast1);
                    }
                    const dividerIndexTmpLast2 = dividerIndexTmp[dividerIndexTmp.length - 2];
                    if (dividerLocalMinIndex.indexOf(dividerIndexTmpLast2) !== -1 && dividerLocalMinIndex.indexOf(dividerIndexTmpLast1) !== -1) {
                        dividerIndex.push((dividerIndexTmpLast2 + dividerIndexTmpLast1) / 2);
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
                const toIndexOri = dividerIndex[d+1];
                const fromIndex = getIndexByVelocity(xSmoothed, velocity[dividerIndex[d]]);
                const toIndex = getIndexByVelocity(xSmoothed, velocity[dividerIndex[d + 1]]);
                lineBoxsFinal.push({fromIndexOri, toIndexOri, fromIndex, toIndex});
            }
        } else {
            lineBoxsFinal.push(lineBox);
        }
    }

    const guessComponents: ProfileFittingIndividualStore[] = [];
    for (const lineBox of lineBoxsFinal) {
        const component = new ProfileFittingIndividualStore();
        component.setFwhm(Math.abs(velocity[lineBox.toIndexOri] - velocity[lineBox.fromIndexOri]) / 2);
        const localYSmoothed = ySmoothed.slice(lineBox.fromIndex, lineBox.toIndex);
        const localYExtrema = _.mean(localYSmoothed) > intensitySmoothedMean ? _.max(localYSmoothed) : _.min(localYSmoothed);
        component.setAmp(localYExtrema);
        const localYExtremaIndex = localYSmoothed.indexOf(localYExtrema);
        component.setCenter(xSmoothed[lineBox.fromIndex + localYExtremaIndex]);
        guessComponents.push(component);
    }

    return guessComponents;
}
