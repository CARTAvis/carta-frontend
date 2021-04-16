import {action, computed, observable, makeObservable} from "mobx";
import {FittingFunction, FittingContinuum} from "components/SpectralProfiler/ProfileFittingComponent/ProfileFittingComponent";
import { Point2D } from "models";
import * as GSL from "gsl_wrapper";
import { LinePlotInsideBoxMarker } from "components/Shared/LinePlot/LinePlotComponent";
import { getColorForTheme } from "utilities";

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
    @observable selectedIndex: number;
    @observable hasResult: boolean;
    @observable resultLog: string;
    @observable isCursorSelectingYIntercept: boolean;
    @observable isCursorSelectingSlope: boolean;
    @observable isCursorSelectionOn: boolean

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

    @action setComponentByCursor(xMin: number, xMax: number, yMin: number, yMax: number) {
        const selectedComponent = this.selectedComponent;
        selectedComponent.setAmp(yMax - yMin);
        selectedComponent.setCenter((xMin + xMax)/ 2);
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
            for (let i = 0; i <  this.components.length; i++) {
                const component = this.components[i];
                const componentString =
                    `Component #${i+1}\n`+
                    `Center = ${component.resutlCenter}\n` +
                    `Amplitude = ${component.resultAmp}\n` +
                    `FWHM = ${component.resultFwhm}\n`;
                resultString += componentString;
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
                resultPoint2DArray.push({x: x[i], y: yi + (this.slope * x[i] + this.yIntercept)}); // TODO
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
                    individualResultPoint2DArray.push({x: x[i], y: yi + (this.slope * x[i] + this.yIntercept)}); // TODO
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
                residualPoint2DArray.push({x: x[i], y: y[i] - (yi + (this.slope * x[i] + this.yIntercept))}); // TODO
            }
            return residualPoint2DArray;
        }
        return [];
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

        const fittingResult = GSL.gaussianFitting(x, y, inputData, lockedInputData);
        for (let i = 0; i < this.components.length ; i++) {
            const component = this.components[i];
            component.setResultCenter(fittingResult.center[i]);
            component.setResultAmp(fittingResult.amp[i]);
            component.setResultFwhm(fittingResult.fwhm[i]);
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
}