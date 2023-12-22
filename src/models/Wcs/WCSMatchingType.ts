export enum WCSMatchingType {
    NONE = 0,
    SPATIAL = 1,
    SPECTRAL = 2,
    RASTER = 4
}

export function IsWCSMatchingTypeValid(type: string) {
    const enumVal = parseInt(type);
    return type && enumVal >= 0 && enumVal <= 7;
}

export class WCSMatchingClass {
    public static readonly MATCHING_TYPES = Object.values(WCSMatchingType).filter(v => !isNaN(Number(v)) && Number(v) !== 0) as WCSMatchingType[];
    public static readonly MATCHING_NUMBER = WCSMatchingClass.MATCHING_TYPES.length;

    public static isMatchingTypeValid = (matchingType: WCSMatchingType): boolean => {
        return WCSMatchingClass.MATCHING_TYPES.includes(matchingType);
    };

    public static getMatchingTypeFromName = (matchingName: string): WCSMatchingType => {
        return WCSMatchingType[matchingName];
    };

    public static getMatchingNameFromType = (matchingType: WCSMatchingType): string => {
        return WCSMatchingType[matchingType];
    };
}
