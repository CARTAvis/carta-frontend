import {action, computed, observable, makeObservable} from "mobx";
import {FittingFunction, FittingContinuum} from "components/SpectralProfiler/ProfileFittingComponent/ProfileFittingComponent";
// import * as GSL from "gsl_wrapper";

export class ProfileFittingStore {
    @observable function: FittingFunction;
    @observable components: ProfileFittingIndividualStore[];
    @observable continuum: FittingContinuum;
    @observable selectedIndex: number;
    @observable hasResult: boolean;

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
                    `FWHM = ${component.resultFwhm}\n` +
                    `Integrated = ?\n\n`;
                resultString += componentString;
            }
        }

        return resultString;
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

    @computed get readyToFit(): boolean {
        return (isFinite(this.center) && isFinite(this.amp) && isFinite(this.fwhm));
    }

    constructor() {
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