import {AngularSizeUnit} from "enums";
import {AngularSize} from "models";

export const SPEED_OF_LIGHT = 299792458;

export function VelocityFromFrequency(freq: number, refFreq: number): number {
    return SPEED_OF_LIGHT * (1.0 - freq / refFreq);
}

export function VelocityStringFromFrequency(freq: number, refFreq: number): string | null {
    if (isFinite(refFreq)) {
        const velocityVal = VelocityFromFrequency(freq, refFreq);
        return `Velocity:\u00a0${ToFixed(velocityVal * 1e-3, 4)}\u00a0km/s`;
    }
    return null;
}

export function FrequencyFromVelocity(velocity: number, refFreq: number): number {
    return refFreq * (1.0 - velocity / SPEED_OF_LIGHT);
}

export function FrequencyStringFromVelocity(velocity: number, refFreq: number): string | null {
    if (isFinite(refFreq)) {
        const frequencyVal = FrequencyFromVelocity(velocity, refFreq);
        return `Frequency:\u00a0${ToFixed(frequencyVal * 1e-9, 4)}\u00a0GHz`;
    }
    return null;
}

export function ToExponential(val: number, decimals: number = 0): string {
    if (isFinite(val) && isFinite(decimals) && decimals >= 0 && decimals <= 20) {
        return val.toExponential(decimals);
    }
    // leave undefined or non-finite values as is (+- INF, NaN and undefined will still appear properly)
    return String(val);
}

// According to MDN, toFixed only works for up to 20 decimals
export function ToFixed(val: number, decimals: number = 0): string {
    if (isFinite(val) && isFinite(decimals) && decimals >= 0 && decimals <= 20) {
        return val.toFixed(decimals);
    }
    // leave undefined or non-finite values as is (+- INF, NaN and undefined will still appear properly)
    return String(val);
}

export function TrimTrailingDecimals(value: string): string {
    return value.replace(/^(\d+?\.\d+?)0+$/, "$1");
}

export function GetVariablePrecision(value: number): number {
    // Estimates the precision of input tick value. Input provides
    // delta between neighboring tick values and iterates through
    // up to 14 decimal places to determine the approxmiate
    // precision.

    let decimalPlacement = 0.1;
    let precision = 3; // The additional 2-precision is added to accomdate for rounding and improve UX experience

    for (let i = 0; i < 9; i++) {
        if (value < decimalPlacement) {
            decimalPlacement *= 0.1;
            precision++;
        } else {
            return precision;
        }
    }
    return precision;
}

export function ToFormattedNotationByDiff(value: number, delta: number): string | null {
    if (value === null || isNaN(value)) {
        return null;
    }
    const precision = GetVariablePrecision(Math.abs(delta));
    return TrimTrailingDecimals(value.toFixed(precision));
}

export function FormattedNotation(value: number): string | null {
    if (value === null || isNaN(value)) {
        return null;
    }
    return value < 1e-2 ? ToExponential(value, 2) : ToFixed(value, 2);
}

export function FormattedExponential(val: number, digits: number, unit: string = "", shouldTrim: boolean = true, shouldPad: boolean = false) {
    let valString = ToExponential(val, digits);
    if (shouldTrim) {
        // remove unnecessary trailing decimals
        valString = valString.replace(/0+e/, "e");
        valString = valString.replace(".e", ".0e");
        // strip unnecessary exponential notation
        valString = valString.replace("e+0", "");
    }
    if (shouldPad && val >= 0) {
        valString = " " + valString;
    }
    // append unit
    if (unit && unit.length) {
        valString = `${valString} ${unit}`;
    }
    return valString;
}

export function FormattedFrequency(freqGHz: number): string | null {
    if (!isFinite(freqGHz)) {
        return null;
    }

    let freqString = "";
    if (freqGHz < 3) {
        freqString = `${ToFixed(freqGHz * 1000, 4)} MHz`;
    } else if (freqGHz >= 3 && freqGHz < 1000) {
        freqString = `${ToFixed(freqGHz, 4)} GHz`;
    } else {
        freqString = `${ToFixed(freqGHz / 1000, 4)} THz`;
    }
    return freqString;
}

export function GetAngleInRad(arcsec: number): number {
    return isFinite(arcsec) ? (arcsec * Math.PI) / 648000 : NaN;
}

// TODO: possibly move to region class since they are the only callers
export function FormattedArcsec(arcsec: number, decimals: number = -1): string | null {
    if (!isFinite(arcsec) || !isFinite(decimals)) {
        return null;
    }

    const angularSize = AngularSize.ConvertFromArcsec(arcsec);
    let arcString = decimals < 0 ? ToFixed(angularSize.value, 6) : ToFixed(angularSize.value, decimals);
    switch (angularSize.unit) {
        case AngularSizeUnit.ARCSEC:
            arcString += '"';
            break;
        case AngularSizeUnit.ARCMIN:
            arcString += "'";
            break;
        case AngularSizeUnit.DEG:
            arcString += " deg";
            break;
        default:
            break;
    }
    return arcString;
}

export function WavelengthToFrequency(meter: number) {
    // return in Hz
    if (!isFinite(meter) || meter === 0 || meter === null) {
        return undefined;
    }
    return SPEED_OF_LIGHT / meter;
}

export function GetValueFromArcsecString(formattedString: string): number | null {
    const trimmedString = formattedString?.trim();
    if (!trimmedString) {
        return null;
    }

    const arcsecRegExp = /^(\d+(\.\d+)?)"?$/;
    const arcminRegExp = /^(\d+(\.\d+)?)'$/;
    const degreeRegExp = /^(\d+(\.\d+)?)\s*deg(ree)?$/i;
    if (arcsecRegExp.test(trimmedString)) {
        return parseFloat(RegExp.$1);
    } else if (arcminRegExp.test(trimmedString)) {
        return parseFloat(RegExp.$1) * 60;
    } else if (degreeRegExp.test(trimmedString)) {
        return parseFloat(RegExp.$1) * 3600;
    }
    return null;
}

export function PixelToFluxDensityUnit(pixelUnit: string): string {
    if (pixelUnit === "K") {
        return "K*arcsec^2";
    }
    return pixelUnit.replace(/\/beam|\/arcsec\^2|\/arcsec2|\/sr|\/pixel/i, "");
}
