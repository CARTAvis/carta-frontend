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

    public static isTypeValid = (matchingType: WCSMatchingType): boolean => {
        return WCSMatchingClass.MATCHING_TYPES.includes(matchingType);
    };

    public static getTypeFromName = (matchingName: string): WCSMatchingType => {
        return WCSMatchingType[matchingName];
    };

    public static getNameFromType = (matchingType: WCSMatchingType): string => {
        return WCSMatchingType[matchingType];
    };

    public static getList = (value: number) => {
        let b = 1;
        let powerOfTwo = [];
        while (b <= value) {
            if (b & value) powerOfTwo.push(b);
            b <<= 1;
        }
        return powerOfTwo;
    };
}
