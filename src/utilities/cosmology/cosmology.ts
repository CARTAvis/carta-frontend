import {VelocityConvention} from "enums";

/** Speed of light in metres per second. */
export const SPEED_OF_LIGHT = 299792458;

/** Speed of light in kilometres per second. */
export const SPEED_OF_LIGHT_KMS = SPEED_OF_LIGHT / 1e3;

/** Return whether a redshift is physically valid for frequency conversion. */
export function isValidRedshift(redshift: number): boolean {
    return isFinite(redshift) && redshift > -1;
}

/**
 * Return whether a velocity is valid for the selected velocity convention.
 * The bounds are convention-specific because radio and optical velocities are
 * spectroscopic conventions, while relativistic velocity is bounded by c.
 */
export function isValidVelocity(velocityKms: number, convention: VelocityConvention): boolean {
    if (!isFinite(velocityKms)) {
        return false;
    }

    switch (convention) {
        case VelocityConvention.RADIO:
            return velocityKms < SPEED_OF_LIGHT_KMS;
        case VelocityConvention.OPTICAL:
            return velocityKms > -SPEED_OF_LIGHT_KMS;
        case VelocityConvention.RELATIVISTIC:
            return velocityKms > -SPEED_OF_LIGHT_KMS && velocityKms < SPEED_OF_LIGHT_KMS;
        default:
            return false;
    }
}

/**
 * Convert a radial velocity in km/s to redshift using an explicit velocity convention.
 * Positive values indicate recession and negative values indicate approach.
 *
 * Radio velocity is a spectroscopic convention rather than a physical velocity;
 * its domain only requires the velocity to stay below c so that the corresponding
 * redshift is greater than -1. It therefore has no symmetric lower bound at -c.
 */
export function redshiftFromVelocity(velocityKms: number, convention: VelocityConvention): number {
    if (!isValidVelocity(velocityKms, convention)) {
        return NaN;
    }

    switch (convention) {
        case VelocityConvention.RADIO:
            return velocityKms / (SPEED_OF_LIGHT_KMS - velocityKms);
        case VelocityConvention.OPTICAL:
            return velocityKms / SPEED_OF_LIGHT_KMS;
        case VelocityConvention.RELATIVISTIC:
            return redshiftFromRelativisticVelocity(velocityKms);
        default:
            return NaN;
    }
}

/** Convert redshift to radial velocity in km/s using an explicit velocity convention. */
export function velocityFromRedshift(redshift: number, convention: VelocityConvention): number {
    if (!isValidRedshift(redshift)) {
        return NaN;
    }

    switch (convention) {
        case VelocityConvention.RADIO:
            return SPEED_OF_LIGHT_KMS * (redshift / (1 + redshift));
        case VelocityConvention.OPTICAL:
            return SPEED_OF_LIGHT_KMS * redshift;
        case VelocityConvention.RELATIVISTIC:
            return relativisticVelocityFromRedshift(redshift);
        default:
            return NaN;
    }
}

/** Convert a relativistic radial velocity in km/s to redshift. */
export function redshiftFromRelativisticVelocity(velocityKms: number): number {
    if (!isValidVelocity(velocityKms, VelocityConvention.RELATIVISTIC)) {
        return NaN;
    }

    const beta = velocityKms / SPEED_OF_LIGHT_KMS;
    return Math.sqrt((1 + beta) / (1 - beta)) - 1;
}

/** Convert redshift to a relativistic radial velocity in km/s. */
export function relativisticVelocityFromRedshift(redshift: number): number {
    if (!isValidRedshift(redshift)) {
        return NaN;
    }

    const redshiftFactor = 1 + redshift;
    const inverseRedshiftFactor = 1 / redshiftFactor;
    return SPEED_OF_LIGHT_KMS * ((redshiftFactor - inverseRedshiftFactor) / (redshiftFactor + inverseRedshiftFactor));
}

/**
 * Return the frequency factor for converting an observed frequency to a rest frequency.
 * The factor is 1 + z.
 */
export function restFrequencyFactorFromRedshift(redshift: number): number {
    return isValidRedshift(redshift) ? 1 + redshift : NaN;
}

/**
 * Return the frequency factor for converting a rest frequency to an observed frequency.
 * The factor is 1 / (1 + z).
 */
export function observedFrequencyFactorFromRedshift(redshift: number): number {
    const restFrequencyFactor = restFrequencyFactorFromRedshift(redshift);
    return isFinite(restFrequencyFactor) ? 1 / restFrequencyFactor : NaN;
}

/** Convert a radial velocity to the rest-frequency-to-observed-frequency factor. */
export function observedFrequencyFactorFromVelocity(velocityKms: number, convention: VelocityConvention): number {
    return observedFrequencyFactorFromRedshift(redshiftFromVelocity(velocityKms, convention));
}
