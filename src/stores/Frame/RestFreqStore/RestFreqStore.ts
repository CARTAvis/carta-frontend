import {action, computed, makeObservable, observable} from "mobx";

import {Freq, FrequencyUnit} from "models";

export class RestFreqStore {
    readonly headerRestFreq: Freq;
    @observable customRestFreq: Freq;

    @computed get restFreqInHz(): number {
        if (this.inValidInput) {
            return undefined;
        }
        return Freq.convertUnitToHz(this.customRestFreq);
    }

    @computed get inValidInput(): boolean {
        return !isFinite(this.customRestFreq.value);
    }

    @computed get resetDisable(): boolean {
        return !isFinite(this.headerRestFreq.value);
    }

    @computed get defaultInfo(): string {
        return isFinite(this.headerRestFreq.value) ? `Header: ${this.headerRestFreq.value} ${this.headerRestFreq.unit}` : undefined;
    }

    constructor(headerRestFreq: number) {
        makeObservable(this);
        const defaultRestFreq = Freq.convertUnitFromHz(headerRestFreq);
        this.headerRestFreq = defaultRestFreq;
        this.customRestFreq = defaultRestFreq;
    }

    /**
     * Customize the rest frequency value. Set unit using {@link setCustomUnit}.
     * @param val - Value of rest frequency.
     */
    @action setCustomVal = (val: number) => {
        this.customRestFreq.value = val;
    };

    /**
     * Set the unit of the rest frequency. Customize the rest frequency value using {@link setCustomVal}.
     * @param val - Unit of rest frequency in {@link FrequencyUnit}.
     */
    @action setCustomUnit = (val: FrequencyUnit) => {
        this.customRestFreq.unit = val;
    };

    /**
     * Reset the rest frequency to the value and unit of the header.
     */
    @action restoreDefaults = () => {
        this.customRestFreq = this.headerRestFreq;
    };
}
