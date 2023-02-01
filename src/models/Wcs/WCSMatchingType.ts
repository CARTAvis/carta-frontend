export enum WCSMatchingType {
    NONE = 0,
    SPATIAL = 1,
    SPECTRAL = 2
}

export function IsWCSMatchingTypeValid(type: string) {
    const enumVal = parseInt(type);
    return type && enumVal >= 0 && enumVal <= 3;
}
