import {action, computed, observable, makeObservable} from "mobx";
import {FittingFunction, FittingContinuum} from "components/SpectralProfiler/ProfileFittingComponent/ProfileFittingComponent";
import {Point2D} from "models";
import * as GSL from "gsl_wrapper";
import {LinePlotInsideBoxMarker} from "components/Shared/LinePlot/LinePlotComponent";
import {getColorForTheme} from "utilities";
import {autoDetecting} from "utilities/fitting_heuristics";

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
    @observable isCursorSelectingYIntercept: boolean;
    @observable isCursorSelectingSlope: boolean;
    @observable isCursorSelectionOn: boolean;
    @observable isAutoDetectWithCont: boolean;
    @observable isAutoDetectWithFitting: boolean;
    @observable hasAutoDetectResult: boolean;
    @observable detectedComponentN: number;
    @observable enableResidual: boolean

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
            this.selectedIndex = this.selectedIndex === 0 ? 0: this.selectedIndex - 1;
        }
    }

    @action setComponentByCursor(xMin: number, xMax: number, yMin: number, yMax: number) {
        const selectedComponent = this.selectedComponent;
        const centerX = (xMin + xMax)/ 2
        const baselineCenterY = this.slope * centerX + this.yIntercept;
        const isPositiveAmp = ((yMin + yMax) / 2) >= baselineCenterY;
        selectedComponent.setAmp(isPositiveAmp ? yMax - yMin: yMin - yMax);
        selectedComponent.setCenter(centerX);
        selectedComponent.setFwhm(xMax - xMin);
        this.isCursorSelectionOn = false;
    }

    @computed get selectedComponent(): ProfileFittingIndividualStore {
        if (this.components && this.selectedIndex < this.components.length) {
            return this.components[this.selectedIndex];
        }
        return null;
    }

    @computed get componentPlottingBoxs(): LinePlotInsideBoxMarker[] {
        const boxs: LinePlotInsideBoxMarker[] = [];
        if (this.components) {
            for (let i = 0; i < this.components.length; i++) {
                const component = this.components[i];
                if (component.isReadyToFit && !(isFinite(component.resutlCenter) && isFinite(component.resultAmp) && isFinite(component.resultFwhm))) {
                    const deltaYForContinuum = component.center * this.slope + this.yIntercept;
                    const initialBox: LinePlotInsideBoxMarker = {
                        boundary: {xMin: component.center - 0.5 * component.fwhm, xMax: component.center + 0.5 * component.fwhm, yMin: 0 + deltaYForContinuum, yMax: component.amp + deltaYForContinuum},
                        color: getColorForTheme("auto-lime"),
                        opacity: (i === this.selectedIndex) ? 0.5 : 0.2,
                        strokeColor: (i === this.selectedIndex) ? getColorForTheme("auto-grey") : null
                    }
                    boxs.push(initialBox);
                }
            }
        }
        return boxs;
    }

    @computed get resultString(): string {
        let resultString = "";
        if (this.components && this.hasResult) {
            if (this.continuum !== FittingContinuum.NONE) {
                resultString += `Y Intercept = ${this.resultYIntercept}\n`;
                resultString +=  !this.lockedYIntercept ? `Y Intercept Error : ${this.resultYInterceptError}\n` : "";
            }
            if (this.continuum === FittingContinuum.FIRST_ORDER) {
                resultString += `Slope = ${this.resultSlope}\n`;
                resultString += !this.lockedSlope ? `Slope Error : ${this.resultSlopeError}\n` : "";
            }
            if (this.continuum !== FittingContinuum.NONE) {
                resultString += "\n";
            }
            for (let i = 0; i <  this.components.length; i++) {
                const component = this.components[i];
                resultString += `Component #${i+1}\nCenter = ${component.resutlCenter}\n`;
                resultString += !component.lockedCenter ? `Center Error : ${component.resutlCenterError}\n` : "";
                resultString += `Amplitude = ${component.resultAmp}\n`;
                resultString += !component.lockedAmp ? `Amplitude Error : ${component.resultAmpError}\n` : "";
                resultString += `FWHM = ${component.resultFwhm}\n`;
                resultString += !component.lockedFwhm ? `FWHM Error : ${component.resultFwhmError}\n` : "";
                resultString += `Integral = ${component.resultIntegral}\n\n`;
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

    getBaseLinePoint2DArray(x: number[]): Point2D[] {
        if (this.components && this.continuum !== FittingContinuum.NONE) {
            const continuumPoint2DArray = new Array<{ x: number, y: number }>(x.length);
            for (let i = 0; i < x.length; i++) {
                let yi = this.yIntercept;
                if (this.continuum === FittingContinuum.FIRST_ORDER) {
                    yi += x[i] * this.slope;
                }
                continuumPoint2DArray.push({x:x[i], y:yi});
            }
            return continuumPoint2DArray;
        }
        return [];
    }

    getFittingResultPoint2DArray(x: number[]): Point2D[] {
        if (this.components && this.hasResult) {
            const resultPoint2DArray = new Array<Point2D>(x.length);
            for (let i = 0; i < x.length; i++) {
                let yi = 0;
                for (const component of this.components) {
                    const z = (x[i] - component.resutlCenter) / component.resultFwhm;
                    yi += component.resultAmp * Math.exp(-4 * Math.log(2) * z * z);
                }
                resultPoint2DArray.push({x: x[i], y: yi + (this.resultSlope * x[i] + this.resultYIntercept)});
            }
            return resultPoint2DArray;
        }
        return [];
    }

    getFittingIndividualResultPoint2DArrays(x: number[]): Array<Point2D[]> {
        if (this.components && this.hasResult) {
            const individualResultPoint2DArrays = new Array<Point2D[]>(this.components.length);
            for (const component of this.components) {
                let individualResultPoint2DArray: Point2D[] = [];
                for (let i = 0; i < x.length; i++) {
                    const z = (x[i] - component.resutlCenter) / component.resultFwhm;
                    const yi = component.resultAmp * Math.exp(-4 * Math.log(2) * z * z);
                    individualResultPoint2DArray.push({x: x[i], y: yi + (this.resultSlope * x[i] + this.resultYIntercept)});
                }
                individualResultPoint2DArrays.push(individualResultPoint2DArray);
            }
            return individualResultPoint2DArrays;
        }
        return [];
    }

    getFittingResidualPoint2DArray(x: number[], y: Float32Array | Float64Array): Point2D[] {
        if (this.components && this.hasResult) {
            const residualPoint2DArray = new Array<{ x: number, y: number }>(x.length);
            for (let i = 0; i < x.length; i++) {
                let yi = 0;
                for (const component of this.components) {
                    const z = (x[i] - component.resutlCenter) / component.resultFwhm;
                    yi += component.resultAmp * Math.exp(-4 * Math.log(2) * z * z);
                }
                residualPoint2DArray.push({x: x[i], y: y[i] - (yi + (this.resultSlope * x[i] + this.resultYIntercept))});
            }
            return residualPoint2DArray;
        }
        return [];
    }

    autoDetect = (x: number[], y: number[]): void => {
        const result = autoDetecting(x, y, this.isAutoDetectWithCont ? null: {order: this.continuum, yIntercept: this.yIntercept, slope: this.slope});
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
        this.setDetectedComponentN(result.components? result.components.length : 0);
    }

    fitData = (x: number[], y: Float32Array | Float64Array): void => {        
        const inputData = [];
        const lockedInputData = [];
        this.components.forEach(component => {
            inputData.push(component.amp);
            inputData.push(component.center);
            inputData.push(component.fwhm);
            lockedInputData.push(component.lockedAmp ? 1: 0);
            lockedInputData.push(component.lockedCenter ? 1: 0);
            lockedInputData.push(component.lockedFwhm ? 1: 0);
        })

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
            lockedOrderInputData.push(this.lockedYIntercept ? 1: 0);
            lockedOrderInputData.push(1);
        } else if (this.continuum === FittingContinuum.FIRST_ORDER) {
            orderInputData.push(this.yIntercept);
            orderInputData.push(this.slope);
            lockedOrderInputData.push(this.lockedYIntercept ? 1: 0);
            lockedOrderInputData.push(this.lockedSlope ? 1: 0);
        }

        const fittingResult = GSL.gaussianFitting(x, y, inputData, lockedInputData, orderInputData, lockedOrderInputData);
        this.setResultYIntercept(fittingResult.yIntercept);
        this.setResultYInterceptError(fittingResult.yInterceptError)
        this.setResultSlope(fittingResult.slope);
        this.setResultSlopeError(fittingResult.slopeError);
        for (let i = 0; i < this.components.length ; i++) {
            const component = this.components[i];
            component.setResultCenter(fittingResult.center[2 * i]);
            component.setResultCenterError(fittingResult.center[2 * i + 1]);
            component.setResultAmp(fittingResult.amp[2 * i]);
            component.setResultAmpError(fittingResult.amp[2 * i + 1]);
            component.setResultFwhm(fittingResult.fwhm[2 * i]);
            component.setResultFwhmError(fittingResult.fwhm[2 * i + 1]);
            component.setResultIntegral(fittingResult.integral[i])
        }
        this.setResultLog(fittingResult.log);
        this.setHasResult(true);
    }

    constructor() {
        makeObservable(this);
        this.function = FittingFunction.GAUSSIAN;
        this.components = [new ProfileFittingIndividualStore()];
        this.continuum = FittingContinuum.NONE;
        this.yIntercept = 0;
        this.slope = 0;
        this.selectedIndex = 0;
        this.isAutoDetectWithCont = false;
        this.isAutoDetectWithFitting = false;
        this.enableResidual = false;
    }

    @action setFunction = (val: FittingFunction) => {
        this.function = val;
    }

    @action setContinuum = (val: FittingContinuum) => {
        this.continuum = val;
    }

    @action setYIntercept = (val: number) => {
        this.yIntercept = val;
    }

    @action setSlope = (val: number) => {
        this.slope = val;
    }

    @action setLockedYIntercept = (val: boolean) => {
        this.lockedYIntercept = val;
    }

    @action setLockedSlope = (val: boolean) => {
        this.lockedSlope = val;
    }

    @action setResultYIntercept = (val: number) => {
        this.resultYIntercept = val;
    }

    @action setResultSlope = (val: number) => {
        this.resultSlope = val;
    }

    @action setResultYInterceptError = (val: number) => {
        this.resultYInterceptError = val;
    }

    @action setResultSlopeError = (val: number) => {
        this.resultSlopeError = val;
    }

    @action setSelectedIndex = (val: number) => {
        this.selectedIndex = val;
    }

    @action setHasResult = (val: boolean) => {
        this.hasResult = val;
    }

    @action setResultLog = (val: string) => {
        this.resultLog = val;
    }

    @action setIsCursorSelectingYIntercept = (val: boolean) => {
        this.isCursorSelectingYIntercept = val;
    }

    @action setIsCursorSelectingSlope = (val: boolean) => {
        this.isCursorSelectingSlope = val;
    }

    @action setIsCursorSelectionOn = (val: boolean) => {
        this.isCursorSelectionOn = val;
    }

    @action setIsAutoDetectWithCont = (val: boolean) => {
        this.isAutoDetectWithCont = val;
    }

    @action setIsAutoDetectWithFitting = (val: boolean) => {
        this.isAutoDetectWithFitting = val;
    }

    @action setHasAutoDetectResult = (val: boolean) => {
        this.hasAutoDetectResult = val;
    }

    @action setDetectedComponentN = (val: number) => {
        this.detectedComponentN = val;
    }

    @action setEnableResidual = (val: boolean) => {
        this.enableResidual = val;
    }

}

export class ProfileFittingIndividualStore {

    @observable center: number;
    @observable amp: number;
    @observable fwhm: number;
    @observable lockedCenter: boolean;
    @observable lockedAmp: boolean;
    @observable lockedFwhm: boolean;
    @observable resutlCenter: number;
    @observable resultAmp: number;
    @observable resultFwhm: number;
    @observable resutlCenterError: number;
    @observable resultAmpError: number;
    @observable resultFwhmError: number;
    @observable resultIntegral: number;

    @computed get isReadyToFit(): boolean {
        return (isFinite(this.center) && isFinite(this.amp) && isFinite(this.fwhm) && (this.amp !== 0 && this.fwhm !== 0));
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
    }

    @action setAmp = (val: number) => {
        this.amp = val;
    }

    @action setFwhm = (val: number) => {
        this.fwhm = val;
    }

    @action setLockedCenter = (val: boolean) => {
        this.lockedCenter = val;
    }

    @action setLockedAmp = (val: boolean) => {
        this.lockedAmp = val;
    }

    @action setLockedFwhm = (val: boolean) => {
        this.lockedFwhm = val;
    }

    @action setResultCenter = (val: number) => {
        this.resutlCenter = val;
    }

    @action setResultAmp = (val: number) => {
        this.resultAmp = val;
    }

    @action setResultFwhm = (val: number) => {
        this.resultFwhm = val;
    }

    @action setResultCenterError = (val: number) => {
        this.resutlCenterError = val;
    }

    @action setResultAmpError = (val: number) => {
        this.resultAmpError = val;
    }

    @action setResultFwhmError = (val: number) => {
        this.resultFwhmError = val;
    }

    @action setResultIntegral = (val: number) => {
        this.resultIntegral = val;
    }
}