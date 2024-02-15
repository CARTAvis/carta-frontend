/**
 * @privateRemarks the enum element should be a power of 2 value
 */
export enum WCSMatchingType {
    NONE = 0,
    SPATIAL = 1,
    SPECTRAL = 2,
    RASTER = 4
}

export class WCSMatching {
    public static readonly MATCHING_TYPES = Object.values(WCSMatchingType).filter(v => !isNaN(Number(v)) && Number(v) !== WCSMatchingType.NONE) as WCSMatchingType[];
    public static readonly MATCHING_NUMBER = WCSMatching.MATCHING_TYPES.length;

    public static isTypeValid = (value: number): boolean => {
        return value >= 0 && value <= WCSMatching.MATCHING_TYPES.reduce((a: number, b: number) => a | b, 0);
    };

    public static getNameFromType = (matchingType: WCSMatchingType): string => {
        let string = WCSMatchingType[matchingType];
        return this.capitalizeFirstLetter(string);
    };

    private static capitalizeFirstLetter(string: string) {
        return string.charAt(0) + string.slice(1).toLowerCase();
    }
}
