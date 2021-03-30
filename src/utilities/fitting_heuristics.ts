import * as _ from "lodash";
import * as GSL from "gsl_wrapper";
import { ProfileFittingIndividualStore } from "stores/ProfileFittingStore";


export function Gaussian(x, a, c0, s) {
    return a * Math.exp(-1 *Math.pow( (x - c0), 2)/ 2 /Math.pow(s,2));
}

export function hanning_smoothing(intensity: number[]) {
    const aaa: number[] = [];
    for (let i = 1 ; i < intensity.length -1; i++) {
        const value = 0.25 * intensity[i - 1] + 0.5 * intensity[i] + 0.25 * intensity[i + 1];
        aaa.push(value);
    }
    return aaa;
}

export function binning(data: number[], binWidth: number) {
    const bbb: number[] = [];
    for (let i = 0; i < data.length - 1; i = i + binWidth ) {
        bbb.push(_.mean(data.slice(i, (i + binWidth > data.length) ? data.length : i + binWidth)))
    }
    return bbb;
}

export function getIndexByVelocity(velocity: number[], targetVelocity: number) {
    // const delta = Math.abs(velocity[1] - velocity[0]);
    for (let i = 0; i < velocity.length - 1; i ++) {
        if (velocity[i] <= targetVelocity && targetVelocity < velocity[i + 1]) {
            return i;
        }
    }
    return null;
}

export function profilePreprocessing(data: number[]) {
    let dataProcessed = binning(data, (data.length / 128) + 1);
    dataProcessed = hanning_smoothing(dataProcessed);
    dataProcessed = hanning_smoothing(dataProcessed);
    return dataProcessed;
}

export function histogram(data: number[], binN: number): {y: number[], x: number[]} {
    const x = [];
    const min = _.min(data);
    const max = _.max(data);
    const binWidth = (max - min ) / binN;

    for (let i = 0; i < binN ; i++) {
        x.push(min + i * binWidth);
    }

    x.push(max);

    const y: number[] = [binN];

    for (const value of data) {
        for (let j = 0; j < binN; j++) {
            if ((value >= x[j] && value <= x[j + 1]) || (value <= x[j] && value >= x[j + 1])) {
                y[j] = y[j] + 1;
                break;
            }
        }
    }

    return {y, x};
}


export function autoDetecting(velocity: number[], intensity:number[]) : ProfileFittingIndividualStore[] {
    const xSmoothed = profilePreprocessing(velocity);
    const ySmoothed = profilePreprocessing(intensity);
    const bins = Number.parseInt(Math.sqrt(velocity.length).toFixed(0));

    const histResult = histogram(ySmoothed, bins);

    let histY: number[] = [0, ...histResult.y, 0];
    const histXCenterTmp = [];
    for (let i = 0; i < histResult.x.length - 1 ; i++) {
        histXCenterTmp.push((histResult.x[i] + histResult.x[i + 1])/ 2);
    }
    const deltaHistXCenter = histXCenterTmp[1] - histXCenterTmp[0];
    let histXCenter: number[] = [histXCenterTmp[0] - deltaHistXCenter, ...histXCenterTmp, histXCenterTmp[histXCenterTmp.length - 1] + deltaHistXCenter];

    // [amp, center, fwhm]
    const initialGuess = [_.max(histY), histXCenter[_.findIndex(histY, (y => y === _.max(histY)))], 2 * Math.sqrt(Math.log(10) * 2 ) * 0.5 * (deltaHistXCenter)];
    const histogramGaussianFitting = GSL.gaussianFitting(new Float64Array(histXCenter),new Float64Array(histY), initialGuess);

    const intensitySmoothedMean = histogramGaussianFitting.center[0];
    const intensitySmoothedStddev = histogramGaussianFitting.fwhm[0] / (2 * Math.sqrt(Math.log(2) * 2 )); 

    // 1st
    const lineBoxs:{fromIndex, toIndex, fromIndexOri, toIndexOri}[] = [];
    let switchFrom  = false;
    const nSigmaThreshold = 2; // 
    const signalChCountThreshold = 4;
    const floor = intensitySmoothedMean - nSigmaThreshold * intensitySmoothedStddev;
    const ceiling = intensitySmoothedMean + nSigmaThreshold * intensitySmoothedStddev;

    let fromIndex, toIndex, fromIndexOri, toIndexOri;
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
        }
    }

    // 2nd
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
        const dividerValueTmp = []; //
        const dividerLocalMaxIndex = [];
        const dividerLocalMinIndex = [];
        const dividerLocalMaxValue = []; //
        const dividerLocalMinValue = []; //

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

            for (const index of dividerLocalMinIndex) {
                dividerIndexTmp.push(index);
            }

            for (const index of dividerLocalMaxValue) {
                dividerIndexTmp.push(index);
            }

            dividerIndexTmp.sort();
            
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
                lineBoxsFinal.push({fromIndexOri:dividerIndex[d], toIndexOri:dividerIndex[d+1], fromIndex: getIndexByVelocity(xSmoothed, velocity[dividerIndex[d]]), toIndex: getIndexByVelocity(xSmoothed, velocity[dividerIndex[d + 1]])});
            }
        } else {
            lineBoxsFinal.push(lineBox);
        }
    }

    const guessComponents: ProfileFittingIndividualStore[] = [];
    for (const lineBox of lineBoxsFinal) {
        const component = new ProfileFittingIndividualStore();
        component.setCenter((velocity[lineBox.fromIndexOri] + velocity[lineBox.toIndexOri]) / 2);
        component.setFwhm(Math.abs(velocity[lineBox.toIndexOri] - velocity[lineBox.fromIndexOri]) / 2);
        component.setAmp(ySmoothed[Math.floor((lineBox.fromIndex + lineBox.toIndex ) / 2)] - intensitySmoothedMean);
        guessComponents.push(component);
    }

    return guessComponents;
}
