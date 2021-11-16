import {action, computed, observable, makeObservable} from "mobx";
import {FrequencyUnit} from "models";

export class RestFreqStore {
    private readonly headerVal: number;
    private readonly headerUnit: FrequencyUnit;

    @observable customVal: number;
    @observable customUnit: FrequencyUnit;

    @computed get restFreq(): number {
        if (this.inValidInput) {
            return undefined;
        }
        return RestFreqStore.convertUnitInverse(this.customVal, this.customUnit);
    }

    @computed get inValidInput(): boolean {
        return !isFinite(this.customVal);
    }

    @computed get defaultInfo(): string {
        return isFinite(this.headerVal) ? `Header: ${this.headerVal} ${this.headerUnit}` : undefined;
    }

    constructor(headerRestFreq: number) {
        makeObservable(this);
        const defaultRestFreq = RestFreqStore.convertUnit(headerRestFreq);
        this.headerVal = defaultRestFreq.value;
        this.headerUnit = defaultRestFreq.unit;
        this.customVal = defaultRestFreq.value;
        this.customUnit = defaultRestFreq.unit;
    }

    @action setCustomVal = (val: number) => {
        this.customVal = val;
    };

    @action setCustomUnit = (val: FrequencyUnit) => {
        this.customUnit = val;
    };

    @action restoreDefaults = () => {
        this.customVal = this.headerVal;
        this.customUnit = this.headerUnit;
    };

    private static convertUnit = (restFreq: number) => {
        if (restFreq >= 1e9) {
            return {value: restFreq / 1e9, unit: FrequencyUnit.GHZ};
        } else if (restFreq >= 1e6) {
            return {value: restFreq / 1e6, unit: FrequencyUnit.MHZ};
        } else if (restFreq >= 1e3) {
            return {value: restFreq / 1e3, unit: FrequencyUnit.KHZ};
        } else {
            return {value: restFreq, unit: FrequencyUnit.HZ};
        }
    };

    private static convertUnitInverse = (value: number, unit: FrequencyUnit) => {
        switch (unit) {
            case FrequencyUnit.GHZ:
                return value * 1e9;
            case FrequencyUnit.MHZ:
                return value * 1e6;
            case FrequencyUnit.KHZ:
                return value * 1e3;
            default:
                return value;
        }
    };
}