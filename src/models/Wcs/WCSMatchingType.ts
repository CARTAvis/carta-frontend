import {WCSMatchingType} from "enums";

export class WCSMatching {
    public static readonly MATCHING_TYPES = Object.values(WCSMatchingType).filter(v => !isNaN(Number(v)) && Number(v) !== WCSMatchingType.NONE) as WCSMatchingType[];
    public static readonly MATCHING_NUMBER = WCSMatching.MATCHING_TYPES.length;

    public static IsTypeValid = (value: number): boolean => {
        return value >= 0 && value <= WCSMatching.MATCHING_TYPES.reduce((a: number, b: number) => a | b, 0);
    };

    public static GetNameFromType = (matchingType: WCSMatchingType): string => {
        const string = WCSMatchingType[matchingType];
        return this.capitalizeFirstLetter(string);
    };

    private static capitalizeFirstLetter(string: string) {
        return string.charAt(0) + string.slice(1).toLowerCase();
    }
}
