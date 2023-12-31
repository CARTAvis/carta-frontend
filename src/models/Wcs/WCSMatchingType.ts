export enum WCSMatchingType {
    NONE = 0,
    SPATIAL = 1,
    SPECTRAL = 2,
    RASTER = 4
}

export function IsWCSMatchingTypeValid(type: string) {
    const enumVal = parseInt(type);
    return type && enumVal >= 0 && enumVal <= WCSMatching.MATCHING_TYPES.reduce((a: number, b: number) => a | b, 0);
}

export class WCSMatching {
    public static readonly MATCHING_TYPES = Object.values(WCSMatchingType).filter(v => !isNaN(Number(v)) && Number(v) !== WCSMatchingType.NONE) as WCSMatchingType[];
    public static readonly MATCHING_NUMBER = WCSMatching.MATCHING_TYPES.length;

    public static isTypeValid = (value: number): boolean => {
        return value >= 0 && value <= WCSMatching.MATCHING_TYPES.reduce((a: number, b: number) => a | b, 0);
    };

    public static getTypeFromName = (matchingName: string): WCSMatchingType => {
        return WCSMatchingType[matchingName];
    };

    public static getNameFromType = (matchingType: WCSMatchingType): string => {
        let string = WCSMatchingType[matchingType];
        return this.capitalizeFirstLetter(string);
    };

    public static capitalizeFirstLetter(string: string) {
        return string.charAt(0) + string.slice(1).toLowerCase();
    }
}
