import {FrequencyUnit} from "../Spectral/SpectralDefinition";

export class Freq {
    value: number;
    unit: FrequencyUnit;

    public static convertUnitFromHz = (freq: number): Freq => {
        if (!isFinite(freq)) {
            return {value: undefined, unit: FrequencyUnit.MHZ};
        }

        if (freq >= 1e9) {
            return {value: freq / 1e9, unit: FrequencyUnit.GHZ};
        } else if (freq >= 1e6) {
            return {value: freq / 1e6, unit: FrequencyUnit.MHZ};
        } else if (freq >= 1e3) {
            return {value: freq / 1e3, unit: FrequencyUnit.KHZ};
        } else {
            return {value: freq, unit: FrequencyUnit.HZ};
        }
    };

    public static convertUnitToHz = (freq: Freq): number => {
        switch (freq.unit) {
            case FrequencyUnit.GHZ:
                return freq.value * 1e9;
            case FrequencyUnit.MHZ:
                return freq.value * 1e6;
            case FrequencyUnit.KHZ:
                return freq.value * 1e3;
            default:
                return freq.value;
        }
    };
}
