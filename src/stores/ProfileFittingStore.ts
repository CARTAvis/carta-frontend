import {action, computed, observable, makeObservable} from "mobx";
import * as GSL from "gsl_wrapper";
import {FittingFunction, FittingContinuum} from "components/SpectralProfiler/ProfileFittingComponent/ProfileFittingComponent";
import {SpectralProfileWidgetStore} from "stores/widgets";
import {Point2D} from "models";
import {LinePlotInsideBoxMarker, LinePlotInsideTextMarker} from "components/Shared/LinePlot/LinePlotComponent";
import {autoDetecting, getColorForTheme, toFixed, gaussian, lorentzian} from "utilities";

export class ProfileFittingStore {
    @observable function: FittingFunction;
    @observable components: ProfileFittingIndividualStore[];
    @observable continuum: FittingContinuum;
    @observable yIntercept: number;
    @observable slope: number;
    @observable lockedYIntercept: boolean;
    @observable lockedSlope: boolean;
    @observable resultYIntercept: number;
    @observable resultSlope: number;
    @observable resultYInterceptError: number;
    @observable resultSlopeError: number;
    @observable selectedIndex: number;
    @observable hasResult: boolean;
    @observable resultLog: string;
    @observable resultResidual: Float32Array | Float64Array;
    @observable isCursorSelectingYIntercept: boolean;
    @observable isCursorSelectingSlope: boolean;
    @observable isCursorSelectingComponent: boolean;
    @observable isAutoDetectWithCont: boolean;
    @observable isAutoDetectWithFitting: boolean;
    @observable hasAutoDetectResult: boolean;
    @observable detectedComponentN: number;
    @observable enableResidual: boolean;
    @observable originData: {x: number[]; y: Float32Array | Float64Array};

    private readonly widgetStore: SpectralProfileWidgetStore;

    @action setComponents(length: number, reset?: boolean) {
        this.setSelectedIndex(length - 1);
        const newComponents = [];
        for (let i = 0; i < length; i++) {
            if (reset) {
                newComponents.push(new ProfileFittingIndividualStore());
            } else {
                newComponents.push(i < this.components.length ? this.components[i] : new ProfileFittingIndividualStore());
            }
        }
        this.components = newComponents;
    }

    @action deleteSelectedComponent() {
        if (this.components.length > 1) {
            this.components = this.components.slice(0, this.selectedIndex).concat(this.components.slice(this.selectedIndex + 1));
            this.selectedIndex = this.selectedIndex === 0 ? 0 : this.selectedIndex - 1;
        }
    }

    @action setComponentByCursor(xMin: number, xMax: number, yMin: number, yMax: number) {
        const selectedComponent = this.selectedComponent;
        const centerX = (xMin + xMax) / 2;
        const baselineCenterY = this.slope * centerX + this.yIntercept;
        const isPositiveAmp = (yMin + yMax) / 2 >= baselineCenterY;
        selectedComponent.setAmp(isPositiveAmp ? yMax - yMin : yMin - yMax);
        selectedComponent.setCenter(centerX);
        selectedComponent.setFwhm(xMax - xMin);
        this.isCursorSelectingComponent = false;
    }

    @computed get selectedComponent(): ProfileFittingIndividualStore {
        if (this.components && this.selectedIndex < this.components.length) {
            return this.components[this.selectedIndex];
        }
        return null;
    }

    @computed get fittingData(): {x: number[]; y: Float32Array | Float64Array} {
        if (this.widgetStore.plotData.fittingData) {
            let x = this.widgetStore.plotData.fittingData.x;
            let y = this.widgetStore.plotData.fittingData.y;
            let nonNaNIndex = y.findIndex(yi => !isNaN(yi));
            if (nonNaNIndex > 0) {
                x = x.slice(nonNaNIndex, x.length - nonNaNIndex);
                y = y.slice(nonNaNIndex, y.length - nonNaNIndex);
            }
            return {x, y};
        }
        return null;
    }

    @computed get componentPlottingBoxes(): LinePlotInsideBoxMarker[] {
        const boxes: LinePlotInsideBoxMarker[] = [];
        if (this.components) {
            for (let i = 0; i < this.components.length; i++) {
                const component = this.components[i];
                if (component.isReadyToFit && !(isFinite(component.resultCenter) && isFinite(component.resultAmp) && isFinite(component.resultFwhm))) {
                    const deltaYForContinuum = component.center * this.slope + this.yIntercept;
                    const initialBox: LinePlotInsideBoxMarker = {
                        boundary: {
                            xMin: component.center - 0.5 * component.fwhm,
                            xMax: component.center + 0.5 * component.fwhm,
                            yMin: 0 + deltaYForContinuum,
                            yMax: component.amp + deltaYForContinuum
                        },
                        color: getColorForTheme("auto-lime"),
                        opacity: i === this.selectedIndex ? 0.5 : 0.2,
                        strokeColor: i === this.selectedIndex ? getColorForTheme("auto-grey") : null,
                        text: `${i + 1}`
                    };
                    boxes.push(initialBox);
                }
            }
        }
        return boxes;
    }

    @computed get componentResultNumber(): LinePlotInsideTextMarker[] {
        const texts: LinePlotInsideTextMarker[] = [];
        if (this.components && this.hasResult) {
            for (let i = 0; i < this.components.length; i++) {
                const component = this.components[i];
                if (isFinite(component.resultCenter) && isFinite(component.resultAmp) && isFinite(component.resultFwhm)) {
                    const deltaYForContinuum = component.resultCenter * this.resultSlope + this.resultYIntercept;
                    const insideText: LinePlotInsideTextMarker = {
                        x: component.resultCenter,
                        y: deltaYForContinuum + 0.5 * component.resultAmp,
                        text: `${i + 1}`
                    };
                    texts.push(insideText);
                }
            }
        }
        return texts;
    }

    @computed get resultString(): string {
        if (!this.widgetStore?.effectiveFrame) {
            return "";
        }

        let resultString = "";
        const xUnit = this.widgetStore.effectiveFrame.spectralUnitStr;
        const yUnit = this.widgetStore.yUnit;
        if (this.components && this.hasResult) {
            if (this.continuum !== FittingContinuum.NONE) {
                resultString += `Y Intercept = ${toFixed(this.resultYIntercept, 6)} (${yUnit})\n`;
                resultString += this.resultYInterceptError ? `Y Intercept Error = ${toFixed(this.resultYInterceptError, 6)} (${toFixed(Math.abs((this.resultYInterceptError * 100) / this.resultYIntercept), 3)}%)\n` : "";
            }
            if (this.continuum === FittingContinuum.FIRST_ORDER) {
                resultString += `Slope = ${toFixed(this.resultSlope, 6)} (${yUnit} / ${xUnit})\n`;
                resultString += this.resultSlopeError ? `Slope Error = ${toFixed(this.resultSlopeError, 6)} (${toFixed(Math.abs((this.resultSlopeError * 100) / this.resultSlope), 3)}%)\n` : "";
            }
            if (this.continuum !== FittingContinuum.NONE) {
                resultString += "\n";
            }
            for (let i = 0; i < this.components.length; i++) {
                const component = this.components[i];
                resultString += `Component #${i + 1}\n`;
                resultString += `Center = ${toFixed(component.resultCenter, 6)} (${xUnit})\n`;
                resultString += component.resultCenterError ? `Center Error = ${toFixed(component.resultCenterError, 6)} (${toFixed(Math.abs((component.resultCenterError * 100) / component.resultCenter), 3)}%)\n` : "";
                resultString += `Amplitude = ${toFixed(component.resultAmp, 6)} (${yUnit})\n`;
                resultString += component.resultAmpError ? `Amplitude Error = ${toFixed(component.resultAmpError, 6)} (${toFixed(Math.abs((component.resultAmpError * 100) / component.resultAmp), 3)}%)\n` : "";
                resultString += `FWHM = ${toFixed(component.resultFwhm, 6)} (${xUnit})\n`;
                resultString += component.resultFwhmError ? `FWHM Error = ${toFixed(component.resultFwhmError, 6)} (${toFixed(Math.abs((component.resultFwhmError * 100) / component.resultFwhm), 3)}%)\n` : "";
                resultString += `Integral = ${toFixed(component.resultIntegral, 6)} (${yUnit} * ${xUnit})\n`;
                resultString += component.resultIntegralError ? `Integral Error ~= ${toFixed(component.resultIntegralError, 6)} (${toFixed(Math.abs((component.resultIntegralError * 100) / component.resultIntegral), 3)}%)\n\n` : "";
            }
        }

        return resultString;
    }

    @computed get readyToFit(): boolean {
        if (!this.components) {
            return false;
        }

        let lockedInputCount = 0;
        for (const component of this.components) {
            if (!component.isReadyToFit) {
                return false;
            }
            if (component.lockedCenter) {
                lockedInputCount++;
            }
            if (component.lockedAmp) {
                lockedInputCount++;
            }
            if (component.lockedFwhm) {
                lockedInputCount++;
            }
        }

        if (lockedInputCount === this.components.length * 3) {
            return false;
        }
        return true;
    }

    @computed get autoDetectResultText(): string {
        let text = "";
        if (this.hasAutoDetectResult) {
            text = `detected ${this.detectedComponentN} component${this.detectedComponentN > 1 ? "s" : ""}.`;
        }
        return text;
    }

    @computed get baseLinePoint2DArray(): Point2D[] {
        if (this.components && this.continuum !== FittingContinuum.NONE) {
            const x = this.widgetStore.plotData.fittingData.x;
            const continuumPoint2DArray = new Array<{x: number; y: number}>(x.length);
            for (let i = 0; i < x.length; i++) {
                let yi = this.yIntercept;
                if (this.continuum === FittingContinuum.FIRST_ORDER) {
                    yi += x[i] * this.slope;
                }
                continuumPoint2DArray[i] = {x: x[i], y: yi};
            }
            return continuumPoint2DArray;
        }
        return [];
    }

    @computed get modelPoint2DArray(): Point2D[] {
        if (this.components && this.hasResult) {
            const x = this.originData.x;
            const modelPoint2DArray = new Array<Point2D>(x.length);
            for (let i = 0; i < x.length; i++) {
                let yi = 0;
                for (const component of this.components) {
                    if (this.function === FittingFunction.GAUSSIAN) {
                        yi += gaussian(x[i], component.resultAmp, component.resultCenter, component.resultFwhm);
                    } else if (this.function === FittingFunction.LORENTZIAN) {
                        yi += lorentzian(x[i], component.resultAmp, component.resultCenter, component.resultFwhm);
                    }
                }
                modelPoint2DArray[i] = {x: x[i], y: yi + (this.resultSlope * x[i] + this.resultYIntercept)};
            }
            return modelPoint2DArray;
        }
        return [];
    }

    @computed get individualModelPoint2DArrays(): Array<Point2D[]> {
        if (this.components && this.hasResult) {
            const x = this.originData.x;
            const individualModelPoint2DArrays = new Array<Point2D[]>();
            for (const component of this.components) {
                let individualResultPoint2DArray: Point2D[] = [];
                for (let i = 0; i < x.length; i++) {
                    const yi =
                        this.function === FittingFunction.GAUSSIAN ? gaussian(x[i], component.resultAmp, component.resultCenter, component.resultFwhm) : lorentzian(x[i], component.resultAmp, component.resultCenter, component.resultFwhm);
                    individualResultPoint2DArray.push({x: x[i], y: yi + (this.resultSlope * x[i] + this.resultYIntercept)});
                }
                individualModelPoint2DArrays.push(individualResultPoint2DArray);
            }
            return individualModelPoint2DArrays;
        }
        return [];
    }

    @computed get residualPoint2DArray(): Point2D[] {
        if (this.components && this.hasResult) {
            const x = this.originData.x;
            const residualPoint2DArray = new Array<{x: number; y: number}>(x.length);
            for (let i = 0; i < x.length; i++) {
                residualPoint2DArray[i] = {x: x[i], y: this.resultResidual[i]};
            }
            return residualPoint2DArray;
        }
        return [];
    }

    autoDetect = (): void => {
        const x = this.fittingData.x;
        const y = Array.prototype.slice.call(this.fittingData.y);
        const result = autoDetecting(x, y, this.isAutoDetectWithCont ? null : {order: this.continuum, yIntercept: this.yIntercept, slope: this.slope});
        if (result.components?.length > 0) {
            this.setComponents(result.components.length, true);
            for (let i = 0; i < result.components.length; i++) {
                this.components[i].setAmp(result.components[i].amp);
                this.components[i].setCenter(result.components[i].center);
                this.components[i].setFwhm(result.components[i].fwhm);
            }
            this.setContinuum(result.order);
            this.setYIntercept(result.yIntercept);
            this.setSlope(result.slope);
        }
        this.setDetectedComponentN(result.components ? result.components.length : 0);
    };

    fitData = (): void => {
        if (!this.widgetStore?.plotData?.fittingData || !this.widgetStore.effectiveFrame) {
            return;
        }
        const x = this.fittingData.x;
        const y = this.fittingData.y;
        this.setOriginData(x, y);
        const inputData = [];
        const lockedInputData = [];
        this.components.forEach(component => {
            inputData.push(component.amp);
            inputData.push(component.center);
            inputData.push(component.fwhm);
            lockedInputData.push(component.lockedAmp ? 1 : 0);
            lockedInputData.push(component.lockedCenter ? 1 : 0);
            lockedInputData.push(component.lockedFwhm ? 1 : 0);
        });

        const orderInputData = [];
        const lockedOrderInputData = [];
        if (this.continuum === FittingContinuum.NONE) {
            orderInputData.push(0);
            orderInputData.push(0);
            lockedOrderInputData.push(1);
            lockedOrderInputData.push(1);
        } else if (this.continuum === FittingContinuum.ZEROTH_ORDER) {
            orderInputData.push(this.yIntercept);
            orderInputData.push(0);
            lockedOrderInputData.push(this.lockedYIntercept ? 1 : 0);
            lockedOrderInputData.push(1);
        } else if (this.continuum === FittingContinuum.FIRST_ORDER) {
            orderInputData.push(this.yIntercept);
            orderInputData.push(this.slope);
            lockedOrderInputData.push(this.lockedYIntercept ? 1 : 0);
            lockedOrderInputData.push(this.lockedSlope ? 1 : 0);
        }

        const fittingResult = GSL.fitting(this.function, x, y, inputData, lockedInputData, orderInputData, lockedOrderInputData);
        this.setResultYIntercept(fittingResult.yIntercept);
        this.setResultYInterceptError(fittingResult.yInterceptError);
        this.setResultSlope(fittingResult.slope);
        this.setResultSlopeError(fittingResult.slopeError);
        for (let i = 0; i < this.components.length; i++) {
            const component = this.components[i];
            component.setResultCenter(fittingResult.center[2 * i]);
            component.setResultCenterError(fittingResult.center[2 * i + 1]);
            component.setResultAmp(fittingResult.amp[2 * i]);
            component.setResultAmpError(fittingResult.amp[2 * i + 1]);
            component.setResultFwhm(fittingResult.fwhm[2 * i]);
            component.setResultFwhmError(fittingResult.fwhm[2 * i + 1]);
            component.setResultIntegral(fittingResult.integral[2 * i]);
            component.setResultIntegralError(fittingResult.integral[2 * i + 1]);
        }
        const xUnit = this.widgetStore.effectiveFrame.spectralUnitStr;
        const yUnit = this.widgetStore.yUnit;
        let log: string = fittingResult.log;
        log = log.replaceAll("@yUnit", yUnit ? `(${yUnit})` : "");
        log = log.replaceAll("@xUnit", xUnit ? `(${xUnit})` : "");
        log = log.replace("@slopeUnit", yUnit && xUnit ? `(${yUnit} / ${xUnit})` : "");
        log = log.replaceAll("@integralUnit", yUnit && xUnit ? `(${yUnit} * ${xUnit})` : "");
        this.setResultLog(log);
        this.setResultResidual(fittingResult.residual);
        this.setHasResult(true);
    };

    constructor(widgetStore: SpectralProfileWidgetStore) {
        makeObservable(this);
        this.widgetStore = widgetStore;
        this.function = FittingFunction.GAUSSIAN;
        this.components = [new ProfileFittingIndividualStore()];
        this.continuum = FittingContinuum.NONE;
        this.yIntercept = 0;
        this.slope = 0;
        this.selectedIndex = 0;
        this.isAutoDetectWithCont = false;
        this.isAutoDetectWithFitting = false;
        this.enableResidual = true;
    }

    @action setFunction = (val: FittingFunction) => {
        this.function = val;
    };

    @action setContinuum = (val: FittingContinuum) => {
        this.continuum = val;
    };

    @action setYIntercept = (val: number) => {
        this.yIntercept = val;
    };

    @action setSlope = (val: number) => {
        this.slope = val;
    };

    @action setLockedYIntercept = (val: boolean) => {
        this.lockedYIntercept = val;
    };

    @action setLockedSlope = (val: boolean) => {
        this.lockedSlope = val;
    };

    @action setResultYIntercept = (val: number) => {
        this.resultYIntercept = val;
    };

    @action setResultSlope = (val: number) => {
        this.resultSlope = val;
    };

    @action setResultYInterceptError = (val: number) => {
        this.resultYInterceptError = val;
    };

    @action setResultSlopeError = (val: number) => {
        this.resultSlopeError = val;
    };

    @action setSelectedIndex = (val: number) => {
        this.selectedIndex = val;
    };

    @action setHasResult = (val: boolean) => {
        this.hasResult = val;
    };

    @action setResultLog = (val: string) => {
        this.resultLog = val;
    };

    @action setResultResidual = (val: Float32Array | Float64Array) => {
        this.resultResidual = val;
    };

    @action setIsCursorSelectingYIntercept = (val: boolean) => {
        this.isCursorSelectingYIntercept = val;
    };

    @action setIsCursorSelectingSlope = (val: boolean) => {
        this.isCursorSelectingSlope = val;
    };

    @action setIsCursorSelectingComponentOn = (val: boolean) => {
        this.isCursorSelectingComponent = val;
    };

    @action setIsAutoDetectWithCont = (val: boolean) => {
        this.isAutoDetectWithCont = val;
    };

    @action setIsAutoDetectWithFitting = (val: boolean) => {
        this.isAutoDetectWithFitting = val;
    };

    @action setHasAutoDetectResult = (val: boolean) => {
        this.hasAutoDetectResult = val;
    };

    @action setDetectedComponentN = (val: number) => {
        this.detectedComponentN = val;
    };

    @action setEnableResidual = (val: boolean) => {
        this.enableResidual = val;
    };

    @action setOriginData = (x: number[], y: Float32Array | Float64Array) => {
        this.originData = {x, y};
    };
}

export class ProfileFittingIndividualStore {
    @observable center: number;
    @observable amp: number;
    @observable fwhm: number;
    @observable lockedCenter: boolean;
    @observable lockedAmp: boolean;
    @observable lockedFwhm: boolean;
    @observable resultCenter: number;
    @observable resultAmp: number;
    @observable resultFwhm: number;
    @observable resultCenterError: number;
    @observable resultAmpError: number;
    @observable resultFwhmError: number;
    @observable resultIntegral: number;
    @observable resultIntegralError: number;

    @computed get isReadyToFit(): boolean {
        return isFinite(this.center) && isFinite(this.amp) && isFinite(this.fwhm) && this.amp !== 0 && this.fwhm !== 0;
    }

    constructor() {
        makeObservable(this);
        this.center = 0;
        this.amp = 0;
        this.fwhm = 0;
        this.lockedCenter = false;
        this.lockedAmp = false;
        this.lockedFwhm = false;
    }

    @action setCenter = (val: number) => {
        this.center = val;
    };

    @action setAmp = (val: number) => {
        this.amp = val;
    };

    @action setFwhm = (val: number) => {
        this.fwhm = val;
    };

    @action setLockedCenter = (val: boolean) => {
        this.lockedCenter = val;
    };

    @action setLockedAmp = (val: boolean) => {
        this.lockedAmp = val;
    };

    @action setLockedFwhm = (val: boolean) => {
        this.lockedFwhm = val;
    };

    @action setResultCenter = (val: number) => {
        this.resultCenter = val;
    };

    @action setResultAmp = (val: number) => {
        this.resultAmp = val;
    };

    @action setResultFwhm = (val: number) => {
        this.resultFwhm = val;
    };

    @action setResultCenterError = (val: number) => {
        this.resultCenterError = val;
    };

    @action setResultAmpError = (val: number) => {
        this.resultAmpError = val;
    };

    @action setResultFwhmError = (val: number) => {
        this.resultFwhmError = val;
    };

    @action setResultIntegral = (val: number) => {
        this.resultIntegral = val;
    };

    @action setResultIntegralError = (val: number) => {
        this.resultIntegralError = val;
    };
}
