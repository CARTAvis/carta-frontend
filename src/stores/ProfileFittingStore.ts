import {action, computed, observable, makeObservable} from "mobx";
import {FittingFunction, FittingContinuum} from "components/SpectralProfiler/ProfileFittingComponent/ProfileFittingComponent";
import { Point2D } from "models";
import * as GSL from "gsl_wrapper";

export class ProfileFittingStore {
    @observable function: FittingFunction;
    @observable components: ProfileFittingIndividualStore[];
    @observable continuum: FittingContinuum;
    @observable selectedIndex: number;
    @observable hasResult: boolean;
    @observable resultLog: string;

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

    @computed get selectedComponent(): ProfileFittingIndividualStore {
        if (this.components && this.selectedIndex < this.components.length) {
            return this.components[this.selectedIndex];
        }
        return null;
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

        for (const component of this.components) {
            if (!component.isReadyToFit) {
                return false;
            }
        }
        return true;
    }

    getFittingPoint2DArray(x: number[]): Point2D[] {
        if (this.components && this.hasResult) {
            const fittingPoint2DArray = new Array<{ x: number, y: number }>(x.length);
            for (let i = 0; i <x.length; i++) {
                let yi = 0;
                for (const component of this.components) {
                    const z = (x[i] - component.resutlCenter) / component.resultFwhm;
                    yi += component.resultAmp * Math.exp(-4 * Math.log(2) * z * z)
                }
                fittingPoint2DArray.push({x:x[i], y:yi})
            }
            return fittingPoint2DArray;
        }
        return [];
    }

    fitData = (x: number[], y: Float32Array | Float64Array): void => {        
        const inputData = [];
        this.components.forEach(component => { inputData.push(component.amp); inputData.push(component.center); inputData.push(component.fwhm);})


        const fittingResult = GSL.gaussianFitting(x, y, inputData);

        const newComponents = [];        
        for (let i = 0; i < this.components.length ; i++) {
            const component = this.components[i];
            component.setResultCenter(fittingResult.center[i]);
            component.setResultAmp(fittingResult.amp[i]);
            component.setResultFwhm(fittingResult.fwhm[i]);
            
            newComponents.push(component);
        }
        this.components = newComponents;
        this.setResultLog(fittingResult.log);
        this.setHasResult(true);
    }

    constructor() {
        makeObservable(this);
        this.function = FittingFunction.GAUSSIAN;
        this.components = [];
        this.setComponents(1);
        this.continuum = FittingContinuum.NONE;
        this.selectedIndex = 0;
    }

    @action setFunction = (val: FittingFunction) => {
        this.function = val;
    }

    @action setContinuum = (val: FittingContinuum) => {
        this.continuum = val;
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
        return (isFinite(this.center) && isFinite(this.amp) && isFinite(this.fwhm));
    }

    constructor() {
        makeObservable(this);
        this.center = 0;
        this.amp = 0;
        this.fwhm = 0;
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