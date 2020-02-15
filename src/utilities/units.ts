import {CARTA} from "carta-protobuf";

export function velocityFromFrequency(freq: number, refFreq: number): number {
    const c = 299792458;
    return c * (1.0 - freq / refFreq);
}

export function velocityStringFromFrequency(freq: number, refFreq: number): string {
    if (isFinite(refFreq)) {
        const velocityVal = velocityFromFrequency(freq, refFreq);
        return `Velocity:\u00a0${toFixed(velocityVal * 1e-3, 4)}\u00a0km/s`;
    }
    return null;
}

export function frequencyFromVelocity(velocity: number, refFreq: number): number {
    const c = 299792458;
    return refFreq * (1.0 - velocity / c);
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

export function degree2hms(degree: number): string {
    if (isNaN(degree)) {
        return "";
    }
    const h = Math.floor(degree / 15);
    const m = Math.floor((degree - h * 15 ) * 60 / 15);
    const s = toFixed((degree - h * 15 - m / 60 * 15 ) * 3600 / 15, 2);
    return h.toString() + ":" + m.toString() + ":" + s;
}

export function degree2dms(degree: number): string {
    if (isNaN(degree)) {
        return "";
    }
    const sign = degree < 0 ? -1 : 1;
    const positive = degree * sign;
    const d = Math.floor(positive);
    const m = Math.floor((positive - d) * 60);
    const s = toFixed((positive - d - m / 60) * 3600, 2);
    return (d * sign).toString() + ":" + m.toString() + ":" + s;
}

export function obsCoordinate(x: number, y: number, z: number): {obsLon: number, obsLat: number} {
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
        return {obsLon: 0, obsLat:  0};
    }
    const r = Math.sqrt(x * x + y * y + z * z);
    const theta = Math.acos(z / r);
    const phi = Math.atan(y / x);
    return {obsLon: phi / Math.PI * 180, obsLat:  90.0 - theta / Math.PI * 180};
}
