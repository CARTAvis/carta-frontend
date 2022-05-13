import {AngularSize, AngularSizeUnit} from "models";

export const SPEED_OF_LIGHT = 299792458;

export function velocityFromFrequency(freq: number, refFreq: number): number {
    return SPEED_OF_LIGHT * (1.0 - freq / refFreq);
}

export function velocityStringFromFrequency(freq: number, refFreq: number): string {
    if (isFinite(refFreq)) {
        const velocityVal = velocityFromFrequency(freq, refFreq);
        return `Velocity:\u00a0${toFixed(velocityVal * 1e-3, 4)}\u00a0km/s`;
    }
    return null;
}

export function frequencyFromVelocity(velocity: number, refFreq: number): number {
    return refFreq * (1.0 - velocity / SPEED_OF_LIGHT);
}

export function frequencyStringFromVelocity(velocity: number, refFreq: number): string {
    if (isFinite(refFreq)) {
        const frequencyVal = frequencyFromVelocity(velocity, refFreq);
        return `Frequency:\u00a0${toFixed(frequencyVal * 1e-9, 4)}\u00a0GHz`;
    }
    return null;
}

export function toExponential(val: number, decimals: number = 0): string {
    if (isFinite(val) && isFinite(decimals) && decimals >= 0 && decimals <= 20) {
        return val.toExponential(decimals);
    }
    // leave undefined or non-finite values as is (+- INF, NaN and undefined will still appear properly)
    return String(val);
}

// According to MDN, toFixed only works for up to 20 decimals
export function toFixed(val: number, decimals: number = 0): string {
    if (isFinite(val) && isFinite(decimals) && decimals >= 0 && decimals <= 20) {
        return val.toFixed(decimals);
    }
    // leave undefined or non-finite values as is (+- INF, NaN and undefined will still appear properly)
    return String(val);
}

export function formattedNotation(value: number): string {
    if (value === null || isNaN(value)) {
        return null;
    }
    return value < 1e-2 ? toExponential(value, 2) : toFixed(value, 2);
}

export function formattedExponential(val: number, digits: number, unit: string = "", trim: boolean = true, pad: boolean = false) {
    let valString = toExponential(val, digits);
    if (trim) {
        // remove unnecessary trailing decimals
        valString = valString.replace(/0+e/, "e");
        valString = valString.replace(".e", ".0e");
        // strip unnecessary exponential notation
        valString = valString.replace("e+0", "");
    }
    if (pad && val >= 0) {
        valString = " " + valString;
    }
    // append unit
    if (unit && unit.length) {
        valString = `${valString} ${unit}`;
    }
    return valString;
}

export function formattedFrequency(freqGHz: number): string {
    if (!isFinite(freqGHz)) {
        return null;
    }

    let freqString = "";
    if (freqGHz < 3) {
        freqString = `${toFixed(freqGHz * 1000, 4)} MHz`;
    } else if (freqGHz >= 3 && freqGHz < 1000) {
        freqString = `${toFixed(freqGHz, 4)} GHz`;
    } else {
        freqString = `${toFixed(freqGHz / 1000, 4)} THz`;
    }
    return freqString;
}

export function getAngleInRad(arcsec: number): number {
    return isFinite(arcsec) ? (arcsec * Math.PI) / 648000 : undefined;
}

// TODO: possibly move to region class since they are the only callers
export function formattedArcsec(arcsec: number, decimals: number = -1): string {
    if (!isFinite(arcsec) || !isFinite(decimals)) {
        return null;
    }

    const angularSize = AngularSize.convertFromArcsec(arcsec);
    let arcString = decimals < 0 ? toFixed(angularSize.value, 6) : toFixed(angularSize.value, decimals);
    switch (angularSize.unit) {
        case AngularSizeUnit.ARCSEC:
            arcString += "\"";
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

export function wavelengthToFrequency(meter: number) {
    // return in Hz
    if (!isFinite(meter) || meter === 0 || meter === null) {
        return undefined;
    }
    return SPEED_OF_LIGHT / meter;
}

export function getValueFromArcsecString(formattedString: string): number {
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
