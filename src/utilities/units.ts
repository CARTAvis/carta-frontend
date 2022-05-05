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

export function trimTrailingDecimals(value: string): string {
    var splitValue: string[] = value.split(".");

    if (splitValue[1] == undefined) {
        return splitValue[0];
    } else {
        for (let i = 0; i < splitValue[1].length; i++) {
            if (splitValue[1][i] !== "0") {
                return value;
            }
        }
        return splitValue[0];
    }
}

export function trimTrailingZeros(value: string): string {
    // Trims the trailing zeros from the input decimal value. If
    // all trailing values are '0', we return only the values
    // left of the decimal

    var decimals = value.split(".");
    var trimmed = decimals[1];
    var temp = [];

    if (typeof decimals[1] != "undefined") {
        temp = decimals[1].split("");
    } else {
        return decimals[0];
    }

    for (var i = decimals[1].length - 1; i >= 0; i--) {
        // Check if trailing value is 0 and pop() value if so.
        if (decimals[1][i] === "0") {
            temp.pop();
            trimmed = temp.join("");
        } else {
            // Once all trailing values are removed, rebuild full value minus
            // trailing zeros and return.

            trimmed = decimals[0] + "." + trimmed;
            return trimmed;
        }
    }
    return decimals[0];
}

export function getVariablePrecision(value: number): number {
    // Estimates the precision of input tick value. Input provides
    // delta between neighboring tick values and iterates through
    // up to 14 decimal places to determine the approxmiate
    // precision.

    var decimalPlacement = 0.1;
    var precision = 2;

    for (var i = 0; i < 10; i++) {
        if (value < decimalPlacement) {
            decimalPlacement = 0.1 * decimalPlacement;
            precision++;
        } else {
            return precision;
        }
    }
    return precision;
}

export function toFormattedNotation(value: number, delta: number): string {
    if (value === null || isNaN(value)) {
        return null;
    }
    // Determine approximate precision
    var precision = getVariablePrecision(Math.abs(delta));

    // Trim trailing zeros
    var trimmedValue = trimTrailingZeros(value.toPrecision(precision));

    return value < 1 ? trimTrailingDecimals(trimmedValue) : trimTrailingDecimals(trimmedValue);
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

export function getAngleInRad(value: number, unit: string): number {
    if (isFinite(value) && unit) {
        const trimmedUnit = unit.trim()?.toLowerCase();
        if (trimmedUnit === "rad") {
            return value;
        } else if (trimmedUnit === "deg") {
            return (value * Math.PI) / 180;
        } else if (trimmedUnit === "arcmin") {
            return (value * Math.PI) / 10800;
        } else if (trimmedUnit === "arcsec") {
            return (value * Math.PI) / 648000;
        } else if (trimmedUnit === "mas") {
            return (value * Math.PI) / 648000000;
        }
        return undefined;
    }
    return undefined;
}

// TODO: possibly move to region class since they are the only callers
export function formattedArcsec(arcsec: number, decimals: number = -1): string {
    if (!isFinite(arcsec) || !isFinite(decimals)) {
        return null;
    }

    let arcString = "";
    if (arcsec < 120) {
        arcString = `${decimals < 0 ? toFixed(arcsec, 6) : toFixed(arcsec, decimals)}"`;
    } else if (arcsec >= 120 && arcsec < 7200) {
        arcString = `${decimals < 0 ? toFixed(arcsec / 60.0, 3) : toFixed(arcsec / 60.0, decimals)}'`;
    } else {
        arcString = `${decimals < 0 ? toFixed(arcsec / 3600.0, 3) : toFixed(arcsec / 3600.0, decimals)} deg`;
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
