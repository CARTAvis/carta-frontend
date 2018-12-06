export function velocityFromFrequency(freq: number, refFreq: number): number {
    const c = 299792458;
    return c * (1.0 - freq / refFreq);
}

export function velocityStringFromFrequency(freq: number, refFreq: number): string {
    if (isFinite(refFreq)) {
        const velocityVal = velocityFromFrequency(freq, refFreq);
        return `Velocity:\u00a0${(velocityVal * 1e-3).toFixed(4)}\u00a0km/s`;
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
        return `Frequency:\u00a0${(frequencyVal * 1e-9).toFixed(4)}\u00a0GHz`;
    }
    return null;
}