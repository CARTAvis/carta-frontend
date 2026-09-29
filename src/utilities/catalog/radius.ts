import {RadiusUnits} from "enums";

const UNITS_PER_DEGREE: Record<RadiusUnits, number> = {
    [RadiusUnits.DEGREES]: 1,
    [RadiusUnits.ARCMINUTES]: 60,
    [RadiusUnits.ARCSECONDS]: 3600
};

/**
 * A search radius in other units, to six significant figures, as the online query dialog shows it
 * and a SIMBAD query sends it.
 *
 * Going to a larger unit divides by a whole factor and going to a smaller one multiplies by one, so
 * the result carries no rounding from a reciprocal such as 1/60.
 */
export function convertRadius(radius: number, from: RadiusUnits, to: RadiusUnits): number {
    const fromPerDegree = UNITS_PER_DEGREE[from];
    const toPerDegree = UNITS_PER_DEGREE[to];
    const converted = toPerDegree >= fromPerDegree ? radius * (toPerDegree / fromPerDegree) : radius / (fromPerDegree / toPerDegree);
    return Number(converted.toPrecision(6));
}
